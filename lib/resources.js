/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import {createRequire} from 'node:module';
import {matchRequest} from './restrictions.js';
import {ResourceTokenizer} from './ResourceTokenizer.js';
import {tokenizers} from '@bedrock/tokenizer';
const require = createRequire(import.meta.url);
const assert = require('assert-plus');

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections([
    'resource-restriction-acquisition'
  ]);

  await database.createIndexes([{
    // acquisitions are sharded by acquirer ID, which must be unique
    collection: 'resource-restriction-acquisition',
    fields: {'acquisition.acquirerId': 1},
    options: {unique: true, background: false}
  }, {
    // automatically expire acquisitions with an `expires` date field
    collection: 'resource-restriction-acquisition',
    fields: {'acquisition.expires': 1},
    options: {
      unique: false,
      background: false,
      expireAfterSeconds: 0
    }
  }]);
});

/**
 * Checks if the acquirer identified by `acquirerId` is authorized to acquire
 * the resources specified by the given `request`. The acquisition of
 * resources is atomic; either the entire request can be fulfilled or none
 * of it can be. Whether or not the request is authorized will be determined
 * by applying a set of restrictions according to the given `request` and
 * `zones`.
 *
 * @param {object} options - Options to use.
 * @param {string} options.acquirerId - The ID of the acquirer.
 * @param {Array} options.request - An array of objects, each with a `resource`,
 *   `count`, and `requested` millisecond timestamp specifying the resource
 *   identifier, number of that particular resource to acquire, and the time
 *   at which the request for the particular resource was made (which may be
 *   different for every resource), respectively.
 * @param {number} options.acquisitionTtl - The default time, in milliseconds,
 *   for a resource to be considered acquired (held) before being
 *   automatically released. If any applied restriction does not provide a TTL
 *   for how long the acquisition must be tracked, then this value will be
 *   used instead. All acquired resources will be tracked for the maximum TTL
 *   indicated by applied restrictions (or this default).
 * @param {Array} options.zones - A list of zone IDs that are applicable to
 *   the acquisition and that will be used to determine which restrictions
 *   apply to the request.
 *
 * @returns {object} An object with `authorized` as a boolean indicating
 *   whether the request is authorized (can be fulfilled); if the request
 *   cannot be fulfilled, the object also contains `excessResources` expressing
 *   the number of resources that caused an overage; if any resources in the
 *   request are not tracked by any restrictions they are reported as
 *   `untrackedResources` regardless of the value of `authorized`.
 */
export async function check(
  {acquirerId, request, acquisitionTtl, zones} = {}) {
  assert.string(acquirerId, 'acquirerId');
  // 1. Get the acquisition record associated with `acquirerId`.
  const acquisitionRecord = await _getAcquisitionRecord({acquirerId});

  // 2. Create tokenizer for resource IDs.
  const resourceTokenizer = new ResourceTokenizer({acquirerId, request});
  await resourceTokenizer.process({acquisitionRecord});

  // 3. Run internal check helper to see if acquisition is possible.
  const checkResults = await _check(
    {acquirerId, request, zones, resourceTokenizer, acquisitionTtl});

  // 4. Return only `authorized`, `excessResources`, and `untrackedResources`
  const {authorized, excessResources, untrackedResources} = checkResults;
  return {authorized, excessResources, untrackedResources};
}

/**
 * Performs the same function as `check` but marks resources as acquired if
 * their acquisition is authorized. See `check` for more details.
 *
 * @param {object} options - Options to use.
 * @param {string} options.acquirerId - The ID of the acquirer.
 * @param {Array} options.request - An array of objects, each with a `resource`,
 *   `count`, and `requested` millisecond timestamp specifying the resource
 *   identifier, number of that particular resource to acquire, and the time
 *   at which the request for the particular resource was made (which may be
 *   different for every resource), respectively.
 * @param {number} options.acquisitionTtl - The default time, in milliseconds,
 *   for a resource to be considered acquired (held) before being
 *   automatically released. If any applied restriction does not provide a TTL
 *   for how long the acquisition must be tracked, then this value will be
 *   used instead. All acquired resources will be tracked for the maximum TTL
 *   indicated by applied restrictions (or this default).
 * @param {Array} options.zones - A list of zone IDs that are applicable to
 *   the acquisition and that will be used to determine which restrictions
 *   apply to the request.
 * @param {boolean} [options.forceAcquisition=false] - Forcibly marks the
 *   resources as acquired even if the request is not authorized.
 *
 * @returns {object} An object with `authorized` as a boolean indicating
 *   whether the request is authorized (can be fulfilled); the object also
 *   contains `excessResources` expressing the number of resources that caused
 *   an overage (which may be empty); if any resources in the request are not
 *   tracked by any restrictions they are reported as `untrackedResources`.
 */
export async function acquire({
  acquirerId, request, acquisitionTtl, zones, forceAcquisition = false
} = {}) {
  assert.string(acquirerId, 'acquirerId');
  /* Keep attempting to authorize acquisition and mark resources as
    acquired until success or check fails. This pattern handles the
    potential for concurrent operations that may alter whether a
    check passes after the check has been run but before the resources
    are marked as acquired. */

  // 1. Get the acquisition record associated with `acquirerId`.
  let acquisitionRecord = await _getAcquisitionRecord({acquirerId});

  // 2. Create tokenizer for resource IDs.
  const resourceTokenizer = new ResourceTokenizer({acquirerId, request});
  await resourceTokenizer.process({acquisitionRecord});

  // TODO: implement timeout
  while(true) {
    // 3. Run internal check helper to see if acquisition is possible.
    const checkResults = await _check(
      {acquirerId, request, zones, resourceTokenizer, acquisitionTtl});
    const {authorized, excessResources, untrackedResources} = checkResults;

    // 4. If authorization failed, return relevant results -- unless force
    //   acquisition flag is set.
    if(!authorized && !forceAcquisition) {
      return {authorized, excessResources, untrackedResources};
    }

    // 5. If nothing was tracked, there is nothing to record, return results.
    // Note: Expired acquired resources will not be pruned at this time.
    if(checkResults.trackedResources.size === 0) {
      return {authorized, excessResources, untrackedResources};
    }

    // 6. Authorization passed, now attempt to mark resources as acquired
    //   noting that a concurrent acquistion may cause recording to fail
    //   and then a loop to check again will be required.
    if(await _record(
      {acquirerId, acquisitionRecord, resourceTokenizer, checkResults})) {
      // recording successful, return relevant results
      return {authorized, excessResources, untrackedResources};
    }

    // 7. Get the acquisition record associated with `acquirerId` again
    //   as a concurrent process has interfered in the resource acquisition.
    acquisitionRecord = await _getAcquisitionRecord({acquirerId});

    // 8. Process the new acquisition record as acquisitions may have changed
    //   and the current tokenizer may have been rotated.
    await resourceTokenizer.process({acquisitionRecord});
  }
}

/**
 * Releases previously acquired resources up to the counts specified. If
 * more resources are requested to be released than are available, then
 * the return value will include `excessResources` reporting the overage.
 *
 * @param {object} options - Options to use.
 * @param {string} options.acquirerId - The ID of the acquirer.
 * @param {Array} options.request - An array of objects, each with a
 *   `resource`, `count`, and optional `latest` options, specifying the
 *   resource identifier, number of that particular resource to release,
 *   and whether the earliest acquired (default) or latest acquired
 *   resources should be released, respectively.
 *
 * @returns {object} An object with `authorized` set to `true` and `expires`
 *   set to the earliest date that all remaining acquired resources expire, and
 *   `excessResources` expressing the number of resources that could not be
 *   released because they had not been acquired, which may be empty.
 */
export async function release({acquirerId, request} = {}) {
  assert.string(acquirerId, 'acquirerId');
  /* Keep attempting to release resources until they are released atomically.
    This pattern handles the potential for concurrent operations that may alter
    the results. */

  // 1. Get the acquisition record associated with `acquirerId`.
  let acquisitionRecord = await _getAcquisitionRecord({acquirerId});

  // 2. Create tokenizer for resource IDs.
  const resourceTokenizer = new ResourceTokenizer({acquirerId, request});
  await resourceTokenizer.process({acquisitionRecord});

  // TODO: implement timeout
  while(true) {
    // 3. Build new `tokenized` entry for acquisition record from the request.
    const {newTokenized, excessResources, expires, ttl} =
      resourceTokenizer.applyReleaseRequest();

    // 4. If `newTokenized` has no acquired resources left, remove the
    //   acquisition record and return on success.
    if(newTokenized.length === 1 &&
      Object.keys(newTokenized[0].resources).length === 0) {
      // remove acquisition record and return on success, otherwise proceed
      // to loop below and try again
      if(await _removeAcquisitionRecord({acquirerId, acquisitionRecord})) {
        return {authorized: true, excessResources, expires};
      }
    } else {
      // 5. Else, if there was a change that should be recorded, record it
      //   and return on success; do not upsert a record if none exists.
      if(await _updateAcquisitionRecord({
        acquirerId, acquisitionRecord, newTokenized, expires, ttl, upsert: false
      })) {
        // recording successful, return relevant results
        return {authorized: true, excessResources, expires};
      }
    }

    // 6. Get the acquisition record associated with `acquirerId` again
    //   as a concurrent process has interfered in the resource release.
    acquisitionRecord = await _getAcquisitionRecord({acquirerId});

    // 7. Process the new acquisition record as acquisitions may have changed
    //   and the current tokenizer may have been rotated.
    await resourceTokenizer.process({acquisitionRecord});
  }
}

async function _check({
  acquirerId, request, zones, resourceTokenizer, acquisitionTtl
} = {}) {
  // get already acquired resources that match `request`
  const acquired = resourceTokenizer.getUntokenizedAcquisitionMap();

  // get applicable restrictions
  const {restrictions} = await matchRequest({request, zones});

  // aggregate excess and untracked resources
  let authorized = true;
  const excessResources = new Map();
  const trackedResources = new Set();
  const resources = request.map(e => e.resource);
  let maxRestrictionTtl = 0;
  for(const restriction of restrictions) {
    const result = await restriction.apply(
      {acquirerId, acquired, request, zones});
    // all restrictions must be authorized or none are not authorized
    authorized = authorized && result.authorized;
    const {resource} = restriction.restriction;
    trackedResources.add(resource);
    if(!result.authorized) {
      // record maximum excess count across all restrictions
      const count = Math.max(excessResources.get(resource) || 0, result.excess);
      excessResources.set(resource, count);
    }
    // update max restriction TTL
    const {ttl = acquisitionTtl} = result;
    maxRestrictionTtl = Math.max(0, ttl);
  }

  // subtract tracked resources to get untracked resources
  const untrackedResources = resources.filter(r => !trackedResources.has(r));

  // output results
  return {
    authorized,
    acquired,
    excessResources: [...excessResources.entries()].map(
      ([resource, count]) => ({resource, count})),
    untrackedResources,
    trackedResources,
    maxRestrictionTtl
  };
}

async function _record(
  {acquirerId, acquisitionRecord, resourceTokenizer, checkResults} = {}) {
  // convert `acquisitionRecord` into a mongodb upsert query that depends on
  // the previous resource numbers being unchanged (or the record not existing)
  // in order to detect conflicting concurrent updates

  // build new `tokenized` entry for acquisition record from request
  const {newTokenized, expires, ttl} = resourceTokenizer.applyAcquireRequest(
    {checkResults});

  // if `newTokenized` has no acquired resources left, remove the
  // acquisition record entirely
  if(newTokenized.length === 1 &&
    Object.keys(newTokenized[0].resources).length === 0) {
    return _removeAcquisitionRecord({acquirerId, acquisitionRecord});
  }

  // otherwise there are acquisitions to track so record them
  return _updateAcquisitionRecord(
    {acquirerId, acquisitionRecord, newTokenized, expires, ttl, upsert: true});
}

export async function _getAcquisitionRecord({
  acquirerId, explain = false
} = {}) {
  const query = {'acquisition.acquirerId': acquirerId};
  const projection = {_id: 0};
  const collection = database.collections['resource-restriction-acquisition'];

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

  let record = await collection.findOne(query, {projection});
  if(!record) {
    // creating a default record if none exists
    const {id: tokenizerId} = await tokenizers.getCurrent();
    record = {
      // no `meta` set for a default record, used to determine if the record
      // is a totally new record
      acquisition: {
        acquirerId,
        tokenized: [{
          tokenizerId,
          resources: {}
        }],
        // since this is the default record, it should expire immediately if
        // nothing gets added to it; defaulting `expires` to any other time
        // would be arbitrary and could cause it to unnecessarily persist
        expires: new Date(),
        ttl: 0
      }
    };
  }
  // expose `expires` as milliseconds since the epoch
  record.acquisition.expires = record.acquisition.expires.getTime();
  return record;
}

export async function _updateAcquisitionRecord({
  acquirerId, acquisitionRecord, newTokenized, expires, ttl, upsert,
  explain = false
} = {}) {
  // Note: If `upsert=false` and `acquisitionRecord` is new, we should not
  // hit this code path because we're dealing with a release where there
  // would be nothing acquired; it should hit the `_removeAcquisitionRecord`
  // code path instead and return early without having to hit the database.

  // TODO: optimize to more selectively edit `tokenized` entry vs. full replace

  // build a query that requires the old `tokenized` values to be unchanged
  // in order to apply an update (to ensure a concurrent change didn't
  // intervene)
  const {acquisition: {tokenized}} = acquisitionRecord;
  const query = {
    'acquisition.acquirerId': acquirerId,
    'acquisition.tokenized': tokenized
  };
  const now = Date.now();
  const $set = {
    'meta.updated': now,
    'acquisition.tokenized': newTokenized,
    // store `expires` as a Date instance to enable mongo's TTL index
    'acquisition.expires': new Date(expires),
    'acquisition.ttl': ttl
  };
  const update = {$set};
  let dbOptions;
  if(upsert) {
    dbOptions = {...database.writeOptions, upsert: true};
    update.$setOnInsert = {
      'meta.created': now,
      'acquisition.acquirerId': acquirerId
    };
  } else {
    dbOptions = database.writeOptions;
  }
  const collection = database.collections['resource-restriction-acquisition'];

  if(explain) {
    // 'find().limit(1)' is used here because 'updateOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query).limit(1);
    return cursor.explain('executionStats');
  }

  try {
    const result = await collection.updateOne(query, update, dbOptions);
    // return `true` if the record was updated
    if(result.result.n > 0) {
      return true;
    }
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    // a duplicate error happens when the query does not match and `upsert`
    // is true; a query should only fail to match when a concurrent process
    // updated the record -- so we ignore duplicate errors here to treat them
    // the same as when a query does not match and `upsert` is false
  }
  // no change was recorded which means the query did not match or the
  // update itself would have caused no change to the existing record; since
  // the update itself includes at least changing `meta.updated`, we assume
  // that the query did not match and return `false` indicating that the
  // update failed due to a concurrent change and that it needs to be re-run;
  // note that the query may not have matched because:
  // 1. the record expired and was removed by mongo's expiration service
  // 2. the record was removed due to a release/expiration of acquisitions
  // 3. the record's current resource acquisitions changed (release or acquire)
  return false;
}

export async function _removeAcquisitionRecord({
  acquirerId, acquisitionRecord, explain = false
}) {
  // existing `acquisitionRecord` is new if it has no `meta`, so there is
  // nothing to delete, optimize away making the call
  if(!acquisitionRecord.meta) {
    return true;
  }

  // TODO: optimize to more selectively edit `tokenized` entry vs. full replace

  // build a query that requires the old `tokenized` values to be unchanged
  // in order to apply a delete (to ensure a concurrent change didn't
  // intervene)
  const query = {
    'acquisition.acquirerId': acquirerId,
    'acquisition.tokenized': acquisitionRecord.acquisition.tokenized
  };
  const collection = database.collections['resource-restriction-acquisition'];

  if(explain) {
    // 'find().limit(1)' is used here because 'deleteOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query).limit(1);
    return cursor.explain('executionStats');
  }

  const result = await collection.deleteOne(query);
  // return `true` if something changed
  return result.result.n > 0;
}
