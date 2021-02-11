/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const database = require('bedrock-mongodb');
const uuid = require('uuid-random');
const crypto = require('crypto');

exports.createId = function createId(restriction) {
  let id = `${restriction.zone}${restriction.resource}${restriction.method}`;

  if(restriction.method === 'limitOverDuration' &&
  restriction.methodOptions && restriction.methodOptions.duration) {
    id = `${id}${restriction.methodOptions.duration}`;
  }

  return crypto.createHash('sha256').update(id).digest('base64');
};

exports.ACQUIRER_ID = uuid();

exports.RESOURCES = {
  APPLE: uuid(),
  ORANGE: uuid(),
  KIWI: uuid(),
  CARROT: uuid(),
  CHERRY: uuid(),
  MANGO: uuid(),
  STRAWBERRY: uuid(),
  CUCUMBER: uuid(),
  LIME: uuid()
};

exports.ZONES = {
  ONE: uuid(),
  TWO: uuid()
};

exports.assertCheckResult = (result, expectedResult) => {
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
};

exports.assertResourceRestriction = (actual, expected) => {
  should.exist(actual);
  actual.should.be.an('object');
  actual.should.have.property('restriction');
  actual.restriction.should.be.an('object');
  actual.should.have.property('fn');
  actual.fn.should.be.a('function');
  if(expected.restriction) {
    actual.restriction.should.deep.equal(expected.restriction);
  }
};

exports.cleanDB = async () => {
  await database.collections['tokenizer-tokenizer'].deleteMany({});
  await database.collections['resource-restriction-acquisition'].deleteMany({});
};
