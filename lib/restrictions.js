/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import * as database from '@bedrock/mongodb';
import {getCount, paginateGetResult} from './helpers.js';
import assert from 'assert-plus';
import moment from 'moment';
import {ResourceRestriction} from './ResourceRestriction.js';

const {util: {BedrockError}} = bedrock;
const RESTRICTION_METHODS = new Map();

bedrock.events.on('bedrock-mongodb.ready', async () => {
  await database.openCollections(['resource-restriction-restriction']);

  await database.createIndexes([{
    // for getting restrictions for a particular resource within a zone
    collection: 'resource-restriction-restriction',
    fields: {'restriction.id': 1},
    options: {unique: true}
  }, {
    // for getting all restrictions in a zone
    collection: 'resource-restriction-restriction',
    fields: {'restriction.zone': 1},
    options: {unique: false}
  }]);
});

/**
 * @typedef {object} Restriction
 * @typedef {object} ExplainObject
 * @property {string} zone - The ID of the zone that the
 *   restriction applies to.
 * @property {string} resource - The ID of the resource that
 *   the restriction applies to.
 * @property {string} method - The method of restriction,
 *   which is used to identify a function that must be registered so it can
 *   be later used to apply the restriction.
 * @property {string} id - An id for the restriction.
 * @property {object} [methodOptions] - A dictionary of
 *   options to pass to the method function for applying the restriction.
 */

/**
 * Inserts a restriction.
 *
 * @param {object} options - The options to use.
 * @param {Restriction} options.restriction - An object with a set of parameters
 *   for restricting the acquisition of resources.
 *
 * @returns {Promise<object>} An object with the inserted record.
 */
export async function insert({restriction} = {}) {
  const collection = database.collections['resource-restriction-restriction'];
  const now = Date.now();
  const meta = {created: now, updated: now};
  if(!restriction.id) {
    throw new TypeError(`"restriction.id" is required.`);
  }
  const record = {
    meta,
    restriction
  };
  try {
    await collection.insertOne(record);
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
 * Inserts multiple restrictions into the database.
 *
 * @param {object} options - The options to use.
 * @param {Array} options.restrictions - An array of restrictions.
 *
 * @returns {Promise} - Settles once the operation completes.
 */
export async function bulkInsert({restrictions} = {}) {
  assert.array(restrictions, 'restrictions');
  const now = Date.now();
  const meta = {created: now, updated: now};
  const records = restrictions.map(restriction => ({restriction, meta}));
  // allow unordered writes
  const writeOptions = {ordered: false};
  const collection = database.collections['resource-restriction-restriction'];
  try {
    await collection.insertMany(records, writeOptions);
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
  return records;
}

/**
 * Updates an existing restriction, replacing it entirely.
 *
 * @param {object} options - The options to use.
 * @param {Restriction} options.restriction - An object with a set of parameters
 *   for restricting the acquisition of resources.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<ExplainObject>} Resolves with the ExplainObject if
 *   `explain=true`.
 */
export async function update({restriction, explain = false} = {}) {
  const query = {
    'restriction.id': restriction.id
  };
  const collection = database.collections['resource-restriction-restriction'];
  const $set = {
    'meta.updated': Date.now(),
    restriction
  };

  if(explain) {
    // 'find().limit(1)' is used here because 'updateOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query).limit(1);
    return cursor.explain('executionStats');
  }

  const result = await collection.updateOne(query, {$set});
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
 * Gets a restriction given a restriction ID.
 *
 * @param {object} options - Options to use.
 * @param {string} options.id - The ID of the restriction.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<object | ExplainObject>} Resolves with an object with the
 *   record or an ExplainObject if `explain=true`.
 */
export async function get({id, explain = false} = {}) {
  const query = {
    'restriction.id': id
  };
  const projection = {_id: 0};
  const collection = database.collections['resource-restriction-restriction'];

  if(explain) {
    // 'find().limit(1)' is used here because 'findOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query, {projection}).limit(1);
    return cursor.explain('executionStats');
  }

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

/**
* Gets restrictions given a zone ID and a resource ID.
 *
 * @param {object} options - Options to use.
 * @param {object} options.query - The query.
 * @param {string} [options.limit] - The maximum number of documents to be
 *   returned in the result.
 * @param {string} [options.offset] - The number of documents to skip in a
 *   query result.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<object | ExplainObject>} Resolves with an object with the
 *   `restrictions` property which is an array of matching records or an
 *   ExplainObject if `explain=true`.
 */
export async function getAll({
  query, limit = 10, offset = 0, explain = false
} = {}) {
  const projection = {_id: 0};
  const sort = {'restriction.id': 1};
  const collection = database.collections['resource-restriction-restriction'];

  if(explain) {
    const cursor = await collection.find(query, {projection});
    return cursor.explain('executionStats');
  }

  const records = await paginateGetResult({
    limit, offset, collection, query, sort, projection
  });

  const restrictions = records.map(record => record.restriction);
  const {count} = await getCount({collection, query});

  return {records: restrictions, limit, offset, count};
}

/**
 * Deletes a restriction from the database.
 *
 * @param {object} options - The options to use.
 * @param {string} options.zone - The ID of the zone that the
 *   restriction applies to.
 * @param {string} options.resource - The ID of the resource that the
 *   restriction applies to.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<ExplainObject>} Resolves with the ExplainObject if
 *   `explain=true`.
 */
export async function removeAll({zone, resource, explain = false} = {}) {
  const query = {
    'restriction.zone': zone,
    'restriction.resource': resource
  };
  const collection = database.collections['resource-restriction-restriction'];

  if(explain) {
    // 'find()' is used here because 'deleteMany()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query);
    return cursor.explain('executionStats');
  }

  await collection.deleteMany(query);
}

/**
 * Deletes a restriction from the database by ID.
 *
 * @param {object} options - The options to use.
 * @param {string} options.id - The ID of restriction.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<ExplainObject>} Resolves with the ExplainObject if
 *   `explain=true`.
 */
export async function remove({id, explain = false}) {
  const query = {
    'restriction.id': id
  };
  const collection = database.collections['resource-restriction-restriction'];

  if(explain) {
    // 'find().limit(1)' is used here because 'deleteOne()' doesn't return a
    // cursor which allows the use of the explain function.
    const cursor = await collection.find(query).limit(1);
    return cursor.explain('executionStats');
  }

  await collection.deleteOne(query);
}

/**
 * Finds all restriction records that match the given request and instantiates
 * `ResourceRestriction` instances for applying them.
 *
 * @param {object} options - Options to use.
 * @param {Array} options.request - An array of objects, each with a `resource`,
 *   `count`, and `requested` millisecond timestamp specifying the resource
 *   identifier, number of that particular resource to acquire, and the time
 *   at which the request for the particular resource was made (which may be
 *   different for every resource), respectively.
 * @param {Array} options.zones - A list of zone IDs that are applicable to
 *   the acquisition and that will be used to determine which restrictions
 *   apply to the request.
 * @param {boolean} [options.explain=false] - An optional explain boolean.
 *
 * @returns {Promise<object | ExplainObject>} Resolves with an object with
 *   `restrictions` with an array of applicable `ResourceRestriction` instances
 *   to be applied to the request or an ExplainObject if `explain=true`.
 */
export async function matchRequest({request, zones, explain = false} = {}) {
  const restrictions = [];

  const resourceIds = request.map(e => e.resource);
  const query = {
    'restriction.zone': {$in: zones},
    'restriction.resource': {$in: resourceIds}
  };
  const projection = {_id: 0};
  const collection = database.collections['resource-restriction-restriction'];

  if(explain) {
    const cursor = await collection.find(query, {projection});
    return cursor.explain('executionStats');
  }

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
 * @param {Function} options.fn - The function to call with the following
 *   signature:
 *   Promise<{authorized, excess}> method(
 *     {acquirerId, acquired, request, zones, restriction}).
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
 * @returns {Function} The registered function.
 */
export function getMethodFunction({method}) {
  const fn = RESTRICTION_METHODS.get(method);
  if(!fn) {
    throw new Error(`Restriction method "${method}" not registered.`);
  }
  return fn;
}

async function _limitOverDuration({
  /*acquirerId,*/ acquired, request, /*zones,*/ restriction, now = Date.now()
}) {
  const {methodOptions: {limit, duration}} = restriction;

  // determine the earliest starting time for the duration; rounded down to
  // second-level precision
  const parsedDuration = moment.duration(duration);
  const startTime = moment(now).subtract(parsedDuration).unix() * 1000;

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
    excess,
    // how long this restriction applies to acquired resources; i.e., how
    // long acquisitions must be tracked
    ttl: parsedDuration.asMilliseconds()
  };
}

// add built-in method that checks limits over a period
registerMethod({method: 'limitOverDuration', fn: _limitOverDuration});
