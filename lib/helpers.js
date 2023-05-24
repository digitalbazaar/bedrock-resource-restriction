/*!
 * Copyright (c) 2023 Digital Bazaar, Inc. All rights reserved.
 */
export function getLimitAndOffset({query}) {
  let offset;
  let limit;
  if(query?.limit) {
    limit = parseInt(query.limit);
    if(limit > 100) {
      throw new Error('"limit" cannot be greater than 100.');
    }
  } else {
    limit = 10;
  }

  if(query?.offset) {
    offset = parseInt(query.offset);
  } else {
    offset = 0;
  }

  return {limit, offset};
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

export async function getCount({
  collection, query = {}
}) {
  const count = await collection.countDocuments(query);
  return {count};
}

export function formatQuery({query}) {
  const formattedQuery = {};
  for(const [key, value] of Object.entries(query)) {
    if(key === 'limit' || key === 'offset') {
      continue;
    }
    formattedQuery[`restriction.${key}`] = value;
  }
  return formattedQuery;
}
