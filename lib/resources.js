/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from 'bedrock';
import * as database from 'bedrock-mongodb';
import {tokenizers} from 'bedrock-tokenizer';
import {promisify} from 'util';
import {ResourceTokenizer} from './ResourceTokenizer.js';
import {getMatches} from './restrictions.js';

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)([
    'resource-restriction-acquisition'
  ]);

  await promisify(database.createIndexes)([{
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
 * `factors`.
 *
 * @param {object} options - Options to use.
 * @param {string} options.acquirerId - The ID of the acquirer.
 * @param {array} options.request - An array of objects, each with a `resource`,
 *   `count`, and `requested` millisecond timestamp specifying the resource
 *   identifier, number of that particular resource to acquire, and the time
 *   at which the request for the particular resource was made (which may be
 *   different for every resource), respectively.
 * @param {number} options.acquisitionTtl - The maximum time, in milliseconds,
 *   for a resource to be considered acquired before automatically being
 *   released.
 * @param {object} options.factors - A set of parameters to be used to
 *   determine which restrictions to apply to the request.
 *
 * @returns {object} An object with `authorized` as a boolean indicating
 *   whether the request is authorized (can be fulfilled); if the request
 *   cannot be fulfilled, the object also contains `excessResources` expressing
 *   the number of resources that caused an overage; if any resources in the
 *   request are not tracked by any restrictions they are reported as
 *   `untrackedResources` regardless of the value of `authorized`.
 */
export async function check(
  {acquirerId, request, acquisitionTtl, factors} = {}) {
  // 1. Get the acquisition record associated with `acquirerId`.
  const acquisitionRecord = await _getAcquisitionRecord({acquirerId});

  // 2. Create tokenizer for resource IDs.
  const resourceTokenizer = new ResourceTokenizer(
    {acquirerId, request, acquisitionTtl});
  await resourceTokenizer.process({acquisitionRecord});

  // 3. Run internal check helper to see if acquisition is possible.
  const checkResults = await _check({request, factors, resourceTokenizer});

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
 * @param {array} options.request - An array of objects, each with a `resource`,
 *   `count`, and `requested` millisecond timestamp specifying the resource
 *   identifier, number of that particular resource to acquire, and the time
 *   at which the request for the particular resource was made (which may be
 *   different for every resource), respectively.
 * @param {number} options.acquisitionTtl - The maximum time, in milliseconds,
 *   for a resource to be considered acquired before automatically being
 *   released.
 * @param {object} options.factors - A set of parameters to be used to
 *   determine which restrictions to apply to the request.
 * @param {boolean} - [options.forceAcquisition=false] - Forcibly marks the
 *   resources as acquired even if the request is not authorized.
 *
 * @returns {object} An object with `authorized` as a boolean indicating
 *   whether the request is authorized (can be fulfilled); if the request
 *   cannot be fulfilled, the object also contains `excessResources` expressing
 *   the number of resources that caused an overage; if any resources in the
 *   request are not tracked by any restrictions they are reported as
 *   `untrackedResources` regardless of the value of `authorized`.
 */
export async function acquire({
  acquirerId, request, acquisitionTtl, factors, forceAcquisition = false
} = {}) {
  /* Keep attempting to authorize acquisition and mark resources as
    acquired until success or check fails. This pattern handles the
    potential for concurrent operations that may alter whether a
    check passes after the check has been run but before the resources
    are marked as acquired. */

  // 1. Get the acquisition record associated with `acquirerId`.
  let acquisitionRecord = await _getAcquisitionRecord({acquirerId});

  // 2. Create tokenizer for resource IDs.
  const resourceTokenizer = new ResourceTokenizer(
    {acquirerId, request, acquisitionTtl});
  await resourceTokenizer.process({acquisitionRecord});

  // TODO: implement timeout
  while(true) {
    // 3. Run internal check helper to see if acquisition is possible.
    const checkResults = await _check({request, factors, resourceTokenizer});
    const {authorized, excessResources, untrackedResources} = checkResults;

    // 4. If authorization failed, return relevant results -- unless force
    //   acquisition flag is set.
    if(!authorized && !forceAcquisition) {
      return {authorized, excessResources, untrackedResources};
    }

    // 5. If nothing was tracked, there is nothing to record, return results.
    if(checkResults.tracked.size === 0) {
      return {authorized, excessResources, untrackedResources};
    }

    // 6. Authorization passed, now attempt to mark resources as acquired
    //   noting that a concurrent acquistion may cause recording to fail
    //   and then a loop to check again will be required.
    if(await _record({acquirerId, checkResults})) {
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
 * @param {array} options.request - An array of objects, each with a `resource`
 *   and `count`, specifying the resource identifier, number of that particular
 *   resource to acquire, respectively.
 * @param {number} options.acquisitionTtl - The maximum time, in milliseconds,
 *   for a resource to be considered acquired before automatically being
 *   released.
 *
 * @returns {object} An object with `authorized` set to `true` and, if the
 *   request specified more resources than were available to be released,
 *   the object will also contain `excessResources` expressing the number of
 *   resources that could not be released because they had not been acquired.
 */
export async function release({acquirerId, request, acquisitionTtl} = {}) {
  /* Keep attempting to release resources until they are released atomically.
    This pattern handles the potential for concurrent operations that may alter
    the results. */

  // 1. Get the acquisition record associated with `acquirerId`.
  let acquisitionRecord = await _getAcquisitionRecord({acquirerId});

  // 2. Create tokenizer for resource IDs.
  const resourceTokenizer = new ResourceTokenizer(
    {acquirerId, request, acquisitionTtl});
  await resourceTokenizer.process({acquisitionRecord});

  // TODO: implement timeout
  while(true) {
    // 3. Build new `tokenized` entry for acquisition record from the request.
    const {newTokenized, excessResources, expires} =
      resourceTokenizer.applyReleaseRequest();

    // 4. If `newTokenized` has no acquired resources left, remove the
    //   acquisition record and return on success.
    if(newTokenized.length === 1 &&
      Object.keys(newTokenized[0].resources).length === 0) {
      // remove acquisition record and return on success, otherwise proceed
      // to loop below and try again
      if(await _removeAcquisitionRecord({acquirerId, acquisitionRecord})) {
        return {excessResources};
      }
    } else {
      // 5. Else, if there was a change that should be recorded, record it
      //   and return on success.
      if(await _upsertAcquisitionRecord(
        {acquirerId, acquisitionRecord, newTokenized, expires})) {
        // recording successful, return relevant results
        return {excessResources};
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

async function _check({request, factors, resourceTokenizer} = {}) {
  // get already acquired resources that match `request`
  const acquired = resourceTokenizer.getUntokenizedAcquisitionMap();

  // get applicable restrictions
  const restrictions = await getMatches({acquired, request, factors});

  // aggregate excess and untracked resources
  let authorized = true;
  const excessResources = new Map();
  const trackedResources = new Set();
  const resources = request.map(e => e.resource);
  for(const restriction of restrictions) {
    const result = restriction.apply({acquired, request, factors});
    // all restrictions must be authorized or none are not authorized
    authorized &= result.authorized;
    result.trackedResources.forEach(r => trackedResources.add(r));
    // choose maximum excess count for each resource
    for(const [k, v] of result.excessResources) {
      const count = Math.max(excessResources.get(k) || 0, v);
      excessResources.set(k, count);
    }
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
    trackedResources
  };
}

async function _record({acquirerId, checkResults} = {}) {
  // convert `checkResults` into a mongodb upsert query that depends on
  // the previous resource numbers being unchanged (or the record not existing)
  // in order to detect conflicting concurrent updates
  const {acquisitionRecord, resourceTokenizer} = checkResults;

  // build new `tokenized` entry for acquisition record from request
  const {newTokenized, expires} = resourceTokenizer.applyAcquireRequest();

  // if `newTokenized` has no acquired resources left, remove the
  // acquisition record entirely
  if(newTokenized.length === 1 &&
    Object.keys(newTokenized[0].resources).length === 0) {
    return _removeAcquisitionRecord({acquirerId, acquisitionRecord});
  }

  // otherwise there are acquisitions to track so record them
  return _upsertAcquisitionRecord(
    {acquirerId, acquisitionRecord, newTokenized, expires});
}

async function _getAcquisitionRecord({acquirerId}) {
  const query = {'acquisition.acquirerId': acquirerId};
  const projection = {_id: 0};
  const collection = database.collections['resource-restriction-acquisition'];
  let record = await collection.findOne(query, projection);
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
        }]
      }
    };
  }
  return record;
}

async function _upsertAcquisitionRecord(
  {acquirerId, acquisitionRecord, newTokenized, expires}) {
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
    'acquisition.expires': expires
  };
  const collection = database.collections['resource-restriction-acquisition'];
  const upsertOptions = {...database.writeOptions, upsert: true};
  const result = await collection.updateOne(query, {
    $set,
    $setOnInsert: {'meta.created': now, 'acquisition.acquirerId': acquirerId}
  }, upsertOptions);
  // return `true` if something changed
  if(result.result.n > 0) {
    return true;
  }
  // since no change was recorded, this is only acceptable if the
  // `acquisitionRecord` was NOT new (i.e., it had `meta`) AND
  // the old and new tokenized data were identical...
  // otherwise a change should have been recorded but wasn't, so an intervening
  // process must have changed the record and we need to return `false` so
  // we will try again against the new record in the database
  // TODO: determine the fastest way to do the deep comparison (stringify?)
  return (acquisitionRecord.meta &&
    (JSON.stringify(newTokenized) === JSON.stringify(tokenized)));
}

async function _removeAcquisitionRecord({acquirerId, acquisitionRecord}) {
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
  const result = await collection.deleteOne(query, database.writeOptions);
  // return `true` if something changed
  return result.result.n > 0;
}
