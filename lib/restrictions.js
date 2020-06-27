/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import './config.js';

// TODO: export public APIs

// TODO: `restriction.apply` takes
// `acquired` map with resource => {count, requested}
// `request` array with {resource, count, requested}
// `factors`?
// should return a result with
// `authorized` boolean
// `trackedResources` array of resource IDs
// `excessResources` array of {resource, count}

async function getMatches(
  {acquirerId, request, factors, resourceIdMap} = {}) {
  /*
  match request resource IDs and `key+value` pairs against database of
  restrictions; get registered functions by identifier associated with the
  restrictions, throwing an error if a function is not registered for a found
  identifier; functions must return:

  authorized, trackedResources, excessResources
  */
}

// TODO: add APIs for bulk insertion, update, and removal of restrictions
