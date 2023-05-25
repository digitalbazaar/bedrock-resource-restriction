/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
export async function getCount({
  collection, query = {}
}) {
  const count = await collection.countDocuments(query);
  return {count};
}

export async function paginateGetResult({
  limit, offset, collection, query = {}, sort = {}, projection = {}
}) {
  if(Object.keys(sort).length === 0) {
    throw new Error('"sort" must define at least one sort field.');
  }
  return collection.find(query, {projection})
    .sort(sort)
    .skip(offset)
    .limit(limit)
    .toArray();
}
