/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {restrictions} = require('bedrock-resource-restriction');

const {
  ACQUIRER_ID, RESOURCES, ZONES, assertResourceRestriction
} = require('./helpers.js');

describe('restrictions', function() {
  it('should insert a restriction', async function() {
    const result = await restrictions.insert({
      restriction: {
        zone: ZONES.ONE,
        resource: RESOURCES.KIWI,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 1,
          duration: 'P30D'
        }
      }
    });
    const expectedRestriction = {
      zone: ZONES.ONE,
      resource: RESOURCES.KIWI,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P30D'
      }
    };
    should.exist(result);
    should.exist(result.meta);
    should.exist(result.restriction);
    result.restriction.should.deep.equal(expectedRestriction);
  });

  // TODO: add duplicate restriction test

  it('should get a restriction', async function() {
    const result = await restrictions.get({
      zone: ZONES.ONE,
      resource: RESOURCES.KIWI
    });
    const expectedRestriction = {
      zone: ZONES.ONE,
      resource: RESOURCES.KIWI,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P30D'
      }
    };
    should.exist(result);
    should.exist(result.meta);
    should.exist(result.restriction);
    result.restriction.should.deep.equal(expectedRestriction);
  });

  it('should get zero restrictions that match a request', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const result = await restrictions.matchRequest({
      request, zones: [ZONES.ONE, ZONES.TWO]
    });
    should.exist(result);
    result.should.be.an('object');
    should.exist(result.restrictions);
    result.restrictions.should.be.an('array');
    result.restrictions.length.should.equal(0);
  });

  it('should get the restrictions that match a request', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.KIWI, count: 1, requested: now}
    ];
    const result = await restrictions.matchRequest({
      request, zones: [ZONES.ONE, ZONES.TWO]
    });
    const expectedRestriction = {
      zone: ZONES.ONE,
      resource: RESOURCES.KIWI,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P30D'
      }
    };
    should.exist(result);
    result.should.be.an('object');
    should.exist(result.restrictions);
    result.restrictions.should.be.an('array');
    result.restrictions.length.should.equal(1);
    assertResourceRestriction(
      result.restrictions[0], {expected: expectedRestriction});
  });

  it('should apply a restriction w/ an authorized result', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.KIWI, count: 1, requested: now}
    ];
    const zones = [ZONES.ONE, ZONES.TWO];
    const matches = await restrictions.matchRequest({request, zones});
    const acquired = new Map();
    const result = await matches.restrictions[0].apply({
      acquirerId: ACQUIRER_ID,
      acquired,
      request,
      zones
    });
    const expectedResult = {
      authorized: true,
      excess: 0
    };
    should.exist(result);
    result.should.deep.equal(expectedResult);
  });

  it('apply should throw error if missing "acquirerId"', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.KIWI, count: 1, requested: now}
    ];
    const zones = [ZONES.ONE, ZONES.TWO];
    const matches = await restrictions.matchRequest({request, zones});
    const acquired = new Map();
    let result;
    let err;
    try {
      result = await matches.restrictions[0].apply({
        acquired,
        request,
        zones
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(result);
    should.exist(err);
    err.message.should.equal('acquirerId (string) is required');
  });

  it('should ignore an expired acquisition', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.KIWI, count: 1, requested: now}
    ];
    const zones = [ZONES.ONE, ZONES.TWO];
    const matches = await restrictions.matchRequest({request, zones});
    const acquired = new Map();
    const daysAgo31 = 31 * 24 * 60 * 60 * 1000;
    acquired.set(RESOURCES.KIWI, [{count: 1, requested: now - daysAgo31}]);
    const result = await matches.restrictions[0].apply({
      acquirerId: ACQUIRER_ID,
      acquired,
      request,
      zones
    });
    const expectedResult = {
      authorized: true,
      excess: 0
    };
    should.exist(result);
    result.should.deep.equal(expectedResult);
  });

  it('should apply a restriction w/ an unauthorized result', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.KIWI, count: 1, requested: now}
    ];
    const zones = [ZONES.ONE, ZONES.TWO];
    const matches = await restrictions.matchRequest({request, zones});
    const acquired = new Map();
    acquired.set(RESOURCES.KIWI, [{count: 1, requested: now}]);
    const result = await matches.restrictions[0].apply({
      acquirerId: ACQUIRER_ID,
      acquired,
      request,
      zones
    });
    const expectedResult = {
      authorized: false,
      excess: 1
    };
    should.exist(result);
    result.should.deep.equal(expectedResult);
  });
});
