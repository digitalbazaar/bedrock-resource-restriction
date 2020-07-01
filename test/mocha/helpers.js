/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const database = require('bedrock-mongodb');
const uuid = require('uuid-random');

exports.ACQUIRER_ID = uuid();

exports.RESOURCES = {
  APPLE: uuid(),
  ORANGE: uuid()
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

exports.cleanDB = async () => {
  await database.collections['tokenizer-tokenizer'].deleteMany({});
  await database.collections['resource-restriction-acquisition'].deleteMany({});
};
