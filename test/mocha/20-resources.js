/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {resources, restrictions} = require('bedrock-resource-restriction');

const {
  ACQUIRER_ID, RESOURCES, ZONES, assertCheckResult
} = require('./helpers.js');

describe('resources', function() {
  it('should authorize a request with no restrictions', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.check(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: [RESOURCES.APPLE]
    };
    assertCheckResult(result, expectedResult);
  });

  it('check should throw error if missing "acquirerId"', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    let result;
    let err;
    try {
      result = await resources.check(
        {request, acquisitionTtl, zones});
    } catch(e) {
      err = e;
    }
    should.not.exist(result);
    should.exist(err);
    err.message.should.equal('acquirerId (string) is required');
  });

  it('should allow acquire on an unrestricted resource', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: [RESOURCES.APPLE]
    };
    assertCheckResult(result, expectedResult);
  });

  it('should authorize a request with a restriction', async function() {
    await restrictions.insert({
      restriction: {
        zone: ZONES.ONE,
        resource: RESOURCES.ORANGE,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 1,
          duration: 'P30D'
        }
      }
    });
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.check(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
  });

  it('should deny a request with a restriction', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 2, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.check(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: false,
      excessResources: [{
        resource: RESOURCES.ORANGE,
        count: 1
      }],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
  });

  it('should acquire with a restriction', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
  });

  it('acquire should throw error if missing "acquirerId"', async function() {
    const now = Date.now();
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    let result;
    let err;
    try {
      result = await resources.acquire(
        {request, acquisitionTtl, zones});
    } catch(e) {
      err = e;
    }
    should.not.exist(result);
    should.exist(err);
    err.message.should.equal('acquirerId (string) is required');
  });

  it('should deny an acquire request with a restriction', async function() {
    // TODO: make independent, currently depends on previous `acquire`
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: false,
      excessResources: [{
        resource: RESOURCES.ORANGE,
        count: 1
      }],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
  });

  it('should acquire with updated restriction', async function() {
    // change restriction to allow additional acquisition
    await restrictions.update({
      restriction: {
        zone: ZONES.ONE,
        resource: RESOURCES.ORANGE,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 2,
          duration: 'P30D'
        }
      }
    });
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
  });

  it('should force-record an unauthorized acquisition', async function() {
    // TODO: make independent, currently depends on previous `acquire`
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones, forceAcquisition: true});
    const expectedResult = {
      authorized: false,
      excessResources: [{
        resource: RESOURCES.ORANGE,
        count: 1
      }],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
    // TODO: get acquisition record and add assertions
  });

  it('should acquire and then release more than acquired with excess',
    async function() {
      // add restriction
      await restrictions.insert({
        restriction: {
          zone: ZONES.ONE,
          resource: RESOURCES.CHERRY,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 5,
            duration: 'P30D'
          }
        }
      });

      // acquire resource
      const now = Date.now();
      const acquirerId = ACQUIRER_ID;
      let request = [
        {resource: RESOURCES.CHERRY, count: 5, requested: now}
      ];
      const acquisitionTtl = 30000;
      const zones = [ZONES.ONE, ZONES.TWO];
      const acquireResult = await resources.acquire(
        {acquirerId, request, acquisitionTtl, zones});
      const expectedAcquireResult = {
        authorized: true,
        excessResources: [],
        untrackedResources: []
      };
      assertCheckResult(acquireResult, expectedAcquireResult);

      // release resource
      request = [
        {resource: RESOURCES.CHERRY, count: 6}
      ];
      const releaseResult = await resources.release(
        {acquirerId, request, acquisitionTtl});
      const expectedExcess = [{resource: RESOURCES.CHERRY, count: 1}];
      should.exist(releaseResult);
      releaseResult.should.be.an('object');
      releaseResult.should.have.property('excessResources');
      releaseResult.excessResources.should.be.an('array');
      releaseResult.excessResources.should.deep.equal(expectedExcess);
    });

  it('should fail to release a non-acquired resource', async function() {
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.release(
      {acquirerId, request, acquisitionTtl});
    const expectedExcess = [{resource: RESOURCES.APPLE, count: 1}];
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('excessResources');
    result.excessResources.should.be.an('array');
    result.excessResources.should.deep.equal(expectedExcess);
  });

  it('release should throw error if missing "acquirerId"', async function() {
    const request = [
      {resource: RESOURCES.APPLE, count: 1}
    ];
    const acquisitionTtl = 30000;
    let result;
    let err;
    try {
      result = await resources.release(
        {request, acquisitionTtl});
    } catch(e) {
      err = e;
    }
    should.not.exist(result);
    should.exist(err);
    err.message.should.equal('acquirerId (string) is required');
  });

  it('should release acquired resources', async function() {
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 2}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.release(
      {acquirerId, request, acquisitionTtl});
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('excessResources');
    result.excessResources.should.be.an('array');
    result.excessResources.should.deep.equal([]);
  });

  it('should acquire successfully again after release', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.ORANGE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);
  });

  it('should release an early acquisition', async function() {
    // add restriction
    await restrictions.insert({
      restriction: {
        zone: ZONES.ONE,
        resource: RESOURCES.CARROT,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 10,
          duration: 'P30D'
        }
      }
    });
    // acquire resource at early time
    const acquirerId = ACQUIRER_ID;
    const zones = [ZONES.ONE];
    const now = Date.now();
    const acquisitionTtl = 30000;
    let request = [
      {resource: RESOURCES.CARROT, count: 1, requested: now - 2}
    ];
    let result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: []
    };
    assertCheckResult(result, expectedResult);

    // acquire resource at middle time
    request = [
      {resource: RESOURCES.CARROT, count: 1, requested: now - 1}
    ];
    result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    assertCheckResult(result, expectedResult);

    // acquire resource at latest time
    request = [
      {resource: RESOURCES.CARROT, count: 1, requested: now}
    ];
    result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones});
    assertCheckResult(result, expectedResult);

    // release earliest resource
    request = [
      {resource: RESOURCES.CARROT, count: 1}
    ];
    result = await resources.release(
      {acquirerId, request, acquisitionTtl});
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('expires');
    result.expires.should.be.a('number');
    // expires result should reflect the expiration of the "latest" acquisition
    const {expires: latestExpires} = result;

    // release latest resource
    request = [
      {resource: RESOURCES.CARROT, count: 1, latest: true}
    ];
    result = await resources.release(
      {acquirerId, request, acquisitionTtl});
    should.exist(result);
    result.should.be.an('object');
    result.should.have.property('expires');
    result.expires.should.be.a('number');
    // expires should should now reflect the expiration of the "middle"
    // acquisition since the latest has been removed
    const {expires: middleExpires} = result;

    // the difference between when the middle acquisition and the "latest"
    // should be 1 per the above parameters used when acquiring them
    const diff = latestExpires - middleExpires;
    const expectedDiff = 1;
    diff.should.equal(expectedDiff);
  });
});
