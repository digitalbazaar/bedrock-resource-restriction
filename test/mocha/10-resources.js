/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {resources} = require('bedrock-resource-restriction');

const {ACQUIRER_ID, RESOURCES, assertCheckResult} = require('./helpers.js');

describe('resources', function() {
  it('should authorize a request with no restrictions', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.check({acquirerId, request, acquisitionTtl});
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
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: [RESOURCES.APPLE]
    };
    assertCheckResult(result, expectedResult);
  });

  it.skip('should authorize a request with a restriction', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.check({acquirerId, request, acquisitionTtl});
    const expectedResult = {
      authorized: true,
      excessResources: [],
      untrackedResources: [RESOURCES.APPLE]
    };
    assertCheckResult(result, expectedResult);
  });

  it.skip('should acquire a restricted resource', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl});
    assertCheckResult(result);
  });

  it.skip('should deny a request with a restriction', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.check({acquirerId, request, acquisitionTtl});
    assertCheckResult(result);
  });

  it.skip('should deny an acquisition with a restriction', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl});
    assertCheckResult(result);
  });

  it.skip('should force-record an unauthorized acquisition', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.acquire(
      {acquirerId, request, acquisitionTtl, forceAcquisition: true});
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
