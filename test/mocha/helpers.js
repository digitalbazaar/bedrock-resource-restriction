/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as database from '@bedrock/mongodb';
import uuid from 'uuid-random';

export async function generateId() {
  return uuid();
}

export const ACQUIRER_ID = uuid();

export const RESOURCES = {
  APPLE: uuid(),
  ORANGE: uuid(),
  KIWI: uuid(),
  CARROT: uuid(),
  CHERRY: uuid(),
  MANGO: uuid(),
  STRAWBERRY: uuid(),
  CUCUMBER: uuid(),
  ASPARAGUS: uuid(),
  LIME: uuid(),
  PLUM: uuid()
};

export const ZONES = {
  ONE: uuid(),
  TWO: uuid()
};

export function assertCheckResult(result, expectedResult) {
  should.exist(result);
  result.should.be.an('object');
  result.should.have.property('authorized');
  result.authorized.should.be.a('boolean');
  result.should.have.property('excessResources');
  result.excessResources.should.be.an('array');
  result.should.have.property('untrackedResources');
  result.untrackedResources.should.be.an('array');
  if(expectedResult) {
    result.should.deep.equal(expectedResult);
  }
}

export function assertResourceRestriction(actual, expected) {
  should.exist(actual);
  actual.should.be.an('object');
  actual.should.have.property('restriction');
  actual.restriction.should.be.an('object');
  actual.should.have.property('fn');
  actual.fn.should.be.a('function');
  if(expected.restriction) {
    actual.restriction.should.deep.equal(expected.restriction);
  }
}

export async function insertRecord({record, collectionName}) {
  const collection = database.collections[collectionName];
  await collection.insertOne(record);
}

export async function cleanDB() {
  await database.collections['tokenizer-tokenizer'].deleteMany({});
  await database.collections['resource-restriction-restriction'].deleteMany({});
  await database.collections['resource-restriction-acquisition'].deleteMany({});
}
