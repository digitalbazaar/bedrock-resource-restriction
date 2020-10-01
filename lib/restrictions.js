/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from 'bedrock';
import * as database from 'bedrock-mongodb';
import {promisify} from 'util';
import {ResourceRestriction} from './ResourceRestriction.js';

const {util: {BedrockError}} = bedrock;
const RESTRICTION_METHODS = new Map();

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await promisify(database.openCollections)(
    ['resource-restriction-restriction']);

  await promisify(database.createIndexes)([{
    // for getting restrictions for a particular resource within a zone
    collection: 'resource-restriction-restriction',
    fields: {'restriction.resource': 1, 'restriction.zone': 1},
    options: {unique: true, background: false}
  }, {
    // for getting all restrictions in a zone
    collection: 'resource-restriction-restriction',
    fields: {'restriction.zone': 1},
    options: {unique: false, background: false}
  }]);

  // FIXME: do we need shard keys?
});

/**
 * Inserts a restriction.
 *
 * @param {object} options - Options to use.
 * @param {object} options.restriction - An application-specific string that
 *   unambiguously identifies a particular entity to the application.
 * @param {string} options.restriction.zone - The ID of the zone that the
 *   restriction applies to.
 * @param {string} options.restriction.resource - The ID of the resource that
 *   the restriction applies to.
 * @param {string} options.restriction.method - The method of restriction,
 *   which is used to identify a function that must be registered so it can
 *   be later used to apply the restriction.
 * @param {object} [options.restrictions.methodOptions] - A dictionary of
 *   options to pass to the method function for applying the restriction.
 *
 * @returns {Promise<object>} An object with the inserted record.
 */
export async function insert({restriction} = {}) {
  const collection = database.collections['resource-restriction-restriction'];
  const now = Date.now();
  const meta = {created: now, updated: now};
  let record = {
    meta,
    restriction
  };
  try {
    const result = await collection.insertOne(record, database.writeOptions);
    record = result.ops[0];
  } catch(e) {
    if(!database.isDuplicateError(e)) {
      throw e;
    }
    throw new BedrockError(
      'Duplicate restriction.',
      'DuplicateError', {
        public: true,
        httpStatusCode: 409
      }, e);
  }
  return record;
}

/**
 * Updates an existing restriction, replacing it entirely.
 *
 * @param {object} options - Options to use.
 * @param {object} options.restriction - An application-specific string that
 *   unambiguously identifies a particular entity to the application.
 * @param {string} options.restriction.zone - The ID of the zone that the
 *   restriction applies to.
 * @param {string} options.restriction.resource - The ID of the resource that
 *   the restriction applies to.
 * @param {string} options.restriction.method - The method of restriction,
 *   which is used to identify a function that must be registered so it can
 *   be later used to apply the restriction.
 * @param {object} [options.restrictions.methodOptions] - A dictionary of
 *   options to pass to the method function for applying the restriction.
 *
 * @returns {Promise} Settles once the operation completes.
 */
export async function update({restriction} = {}) {
  const query = {
    'restriction.zone': restriction.zone,
    'restriction.resource': restriction.resource
  };
  const collection = database.collections['resource-restriction-restriction'];
  const $set = {
    'meta.updated': Date.now(),
    restriction
  };
  const result = await collection.updateOne(
    query, {$set}, database.writeOptions);
  if(result.matchedCount === 0) {
    const details = {
      httpStatusCode: 404,
      public: true
    };
    throw new BedrockError(
      'Restriction not found.',
      'NotFoundError', details);
  }
}

/**
 * Gets a restriction given a zone ID and a resource ID.
 *
 * @param {object} options - Options to use.
 * @param {string} options.zone - The ID of the zone that the
 *   restriction applies to.
 * @param {string} options.resource - The ID of the resource that the
 *   restriction applies to.
 *
 * @returns {Promise<object>} An object with the record.
 */
export async function get({zone, resource} = {}) {
  const query = {
    'restriction.zone': zone,
    'restriction.resource': resource
  };
  const projection = {_id: 0};
  const collection = database.collections['resource-restriction-restriction'];
  const record = await collection.findOne(query, {projection});
  if(!record) {
    const details = {
      httpStatusCode: 404,
      public: true
    };
    throw new BedrockError(
      'Restriction not found.',
      'NotFoundError', details);
  }
  return record;
}

// TODO: implement bulk insert, bulk update, and removal

/**
 * Finds all restriction records that match the given request and instantiates
 * `ResourceRestriction` instances for applying them.
 *
 * @param {object} options - Options to use.
 * @param {array} options.request - An array of objects, each with a `resource`,
 *   `count`, and `requested` millisecond timestamp specifying the resource
 *   identifier, number of that particular resource to acquire, and the time
 *   at which the request for the particular resource was made (which may be
 *   different for every resource), respectively.
 * @param {array} options.zones - A list of zone IDs that are applicable to
 *   the acquisition and that will be used to determine which restrictions
 *   apply to the request.
 *
 * @returns {Promise<object>} An object with `restrictions` with an array
 *   of applicable `ResourceRestriction` instances to be applied to the
 *   request.
 */
export async function matchRequest({request, zones} = {}) {
  const restrictions = [];

  const resourceIds = request.map(e => e.resource);
  const query = {
    'restriction.zone': {$in: zones},
    'restriction.resource': {$in: resourceIds}
  };
  const projection = {_id: 0};
  const collection = database.collections['resource-restriction-restriction'];
  const records = await collection.find(query, {projection}).toArray();

  // create `ResourceRestriction` instances for every restriction
  for(const record of records) {
    const {restriction, restriction: {method}} = record;
    const fn = getMethodFunction({method});
    restrictions.push(new ResourceRestriction({restriction, fn}));
  }

  return {restrictions};
}

/**
 * Registers the function to call for a particular restriction method.
 *
 * @param {object} options - Options to use.
 * @param {string} options.method - An identifier for the restriction method.
 * @param {function} options.fn - The function to call with the following
 *   signature:
 *   Promise<{authorized, excess}> method(
 *     {acquirerId, acquired, request, zones, restriction})
 */
export function registerMethod({method, fn}) {
  // TODO: validate `method` and `fn`
  if(typeof fn !== 'function') {
    throw new TypeError('"fn" must be a function.');
  }

  if(RESTRICTION_METHODS.has(method)) {
    throw new Error(`Restriction method "${method}" is already registered.`);
  }
  RESTRICTION_METHODS.set(method, fn);
}

/**
 * Gets the function for a registered restriction method.
 *
 * @param {object} options - Options to use.
 * @param {string} options.method - An identifier for the restriction method.
 *
 * @returns {function} The registered function.
 */
export function getMethodFunction({method}) {
  const fn = RESTRICTION_METHODS.get(method);
  if(!fn) {
    throw new Error(`Restriction method "${method}" not registered.`);
  }
  return fn;
}

async function _limitOverDuration(
  {/*acquirerId,*/ acquired, request, /*zones,*/ restriction}) {
  const {methodOptions: {limit, duration}} = restriction;

  // TODO: fully support ISO 8601 `duration` w/another library, this only
  // handles a duration of a period of 30 days
  if(duration !== 'P30D') {
    // bad data of this sort should be prevented by validators such that
    // this code path isn't hit
    throw new Error(`Unsupported duration "${duration}".`);
  }

  // determine when the duration started
  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - 30);
  const startTime = start.getTime();

  // go through acquisitions list [{count, requested}], ignoring
  // any acquisitions before the period started, totaling the rest
  const acquisitions = acquired.get(restriction.resource) || [];
  let total = 0;
  for(const {count, requested} of acquisitions) {
    if(requested >= startTime) {
      total += count;
    }
  }

  // add new acquisitions that fall into the period after the start time,
  // including into the future
  for(const {resource, count, requested} of request) {
    if(resource !== restriction.resource || requested < startTime) {
      continue;
    }
    total += count;
  }

  // excess is if the total of acquisitions in the duration plus new
  // durations is over the limit
  const excess = Math.max(0, total - limit);

  return {
    authorized: excess === 0,
    excess
  };
}

// add built-in method that checks limits over a period
registerMethod({method: 'limitOverDuration', fn: _limitOverDuration});
