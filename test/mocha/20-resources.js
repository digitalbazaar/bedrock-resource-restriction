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

  it.skip('should force-record an unauthorized acquisition', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const zones = [ZONES.ONE, ZONES.TWO];
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, zones, forceAcquisition: true});
    assertCheckResult(result);
  });

  it.skip('should release an acquired resource', async function() {
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.release(
      {acquirerId, request, acquisitionTtl});
    assertCheckResult(result);
  });
});
