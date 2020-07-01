/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {resources} = require('bedrock-resource-restriction');

const {ACQUIRER_ID, RESOURCES, assertCheckResult} = require('./helpers.js');

describe('resources', function() {
  it('should check a request', async function() {
    const now = Date.now();
    const acquirerId = ACQUIRER_ID;
    const request = [
      {resource: RESOURCES.APPLE, count: 1, requested: now}
    ];
    const acquisitionTtl = 30000;
    const result = await resources.check({acquirerId, request, acquisitionTtl});
    assertCheckResult(result);
  });
});
