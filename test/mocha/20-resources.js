/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as database from '@bedrock/mongodb';
import {
  ACQUIRER_ID, assertCheckResult, cleanDB, generateId, insertRecord,
  RESOURCES, ZONES
} from './helpers.js';
import {resources, restrictions} from '@bedrock/resource-restriction';
import delay from 'delay';
import {mockAcquisition} from './mock.data.js';
import uuid from 'uuid-random';

describe('Resources', function() {
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
    const id = await generateId();
    await restrictions.insert({
      restriction: {
        id,
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

  it('should deny an acquire request with multiple time restrictions',
    async function() {
      // add monthly restriction
      const monthId = await generateId();
      await restrictions.insert({
        restriction: {
          id: monthId,
          zone: ZONES.ONE,
          resource: RESOURCES.LIME,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 8,
            duration: 'P30D'
          }
        }
      });
      // add weekly restriction
      const weekId = await generateId();
      await restrictions.insert({
        restriction: {
          id: weekId,
          zone: ZONES.ONE,
          resource: RESOURCES.LIME,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 2,
            duration: 'P7D'
          }
        }
      });

      // acquire resource
      const now = Date.now();
      const acquirerId = ACQUIRER_ID;
      const request = [
        {resource: RESOURCES.LIME, count: 3, requested: now}
      ];
      const acquisitionTtl = 30000;
      const zones = [ZONES.ONE];
      const result = await resources.acquire(
        {acquirerId, request, acquisitionTtl, zones});
      const expectedResult = {
        authorized: false,
        excessResources: [{
          resource: RESOURCES.LIME,
          count: 1
        }],
        untrackedResources: []
      };
      assertCheckResult(result, expectedResult);
    });

  it('should allow acquisitions with multiple time restrictions over time',
    async function() {
      // add monthly restriction
      await restrictions.insert({
        restriction: {
          id: await generateId(),
          zone: ZONES.ONE,
          resource: RESOURCES.TANGERINE,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 2,
            duration: 'P30D'
          }
        }
      });
      // add minute restriction
      await restrictions.insert({
        restriction: {
          id: await generateId(),
          zone: ZONES.TWO,
          resource: RESOURCES.TANGERINE,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 1,
            duration: 'PT1M'
          }
        }
      });

      const now = Date.now();
      const acquirerId = ACQUIRER_ID;
      // `acquisitionTtl` is only a default (it should not be used, because the
      // restriction types indicate the TTL)
      const acquisitionTtl = 30000;

      // acquire resource
      {
        const request = [
          {resource: RESOURCES.TANGERINE, count: 1, requested: now}
        ];
        const zones = [ZONES.ONE, ZONES.TWO];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones, now});
        const expectedResult = {
          authorized: true,
          excessResources: [],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // fail to acquire another resource at the same time
      {
        const request = [
          {resource: RESOURCES.TANGERINE, count: 1, requested: now}
        ];
        const zones = [ZONES.ONE, ZONES.TWO];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones, now});
        const expectedResult = {
          authorized: false,
          excessResources: [{
            resource: RESOURCES.TANGERINE,
            count: 1
          }],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // fail to acquire another resource later but before zone two expiration
      {
        const lessThan1MLater = now + 1000 * 59;
        const request = [{
          resource: RESOURCES.TANGERINE,
          count: 1,
          requested: lessThan1MLater
        }];
        const zones = [ZONES.ONE, ZONES.TWO];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones, now: lessThan1MLater});
        const expectedResult = {
          authorized: false,
          excessResources: [{
            resource: RESOURCES.TANGERINE,
            count: 1
          }],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // acquire resource after zone two restriction expires
      {
        const oneMinuteLater = now + 1000 * 61;
        const request = [{
          resource: RESOURCES.TANGERINE,
          count: 1,
          requested: oneMinuteLater
        }];
        const zones = [ZONES.ONE, ZONES.TWO];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones, now: oneMinuteLater});
        const expectedResult = {
          authorized: true,
          excessResources: [],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // fail to acquire another resource later due to zone one restriction
      {
        const fiveMinutesLater = now + 1000 * 60 * 5;
        const request = [{
          resource: RESOURCES.TANGERINE,
          count: 1,
          requested: fiveMinutesLater
        }];
        const zones = [ZONES.ONE];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones, now: fiveMinutesLater});
        const expectedResult = {
          authorized: false,
          excessResources: [{
            resource: RESOURCES.TANGERINE,
            count: 1
          }],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // release resources (to avoid invalidating assertions in
      // inter-related tests)
      const request = [{resource: RESOURCES.TANGERINE, count: 2}];
      await resources.release({acquirerId, request, acquisitionTtl});
    });

  it('should acquire with updated restriction', async function() {
    const id = await generateId();
    await restrictions.insert({
      restriction: {
        id,
        zone: ZONES.ONE,
        resource: RESOURCES.ASPARAGUS,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 1,
          duration: 'P30D'
        }
      }
    });
    // change restriction to allow additional acquisition
    await restrictions.update({
      restriction: {
        id,
        zone: ZONES.ONE,
        resource: RESOURCES.ASPARAGUS,
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
      {resource: RESOURCES.ASPARAGUS, count: 2, requested: now}
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
      const id = await generateId();
      await restrictions.insert({
        restriction: {
          id,
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

  it('should acquire and then release fewer than acquired', async function() {
    // add restriction
    const id = await generateId();
    await restrictions.insert({
      restriction: {
        id,
        zone: ZONES.ONE,
        resource: RESOURCES.CUCUMBER,
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
      {resource: RESOURCES.CUCUMBER, count: 5, requested: now}
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
      {resource: RESOURCES.CUCUMBER, count: 1}
    ];
    let releaseResult = await resources.release(
      {acquirerId, request, acquisitionTtl});
    let expectedExcess = [];
    should.exist(releaseResult);
    releaseResult.should.be.an('object');
    releaseResult.should.have.property('excessResources');
    releaseResult.excessResources.should.be.an('array');
    releaseResult.excessResources.should.deep.equal(expectedExcess);

    // release remaining resources and check for excess
    request = [
      {resource: RESOURCES.CUCUMBER, count: 5}
    ];
    releaseResult = await resources.release(
      {acquirerId, request, acquisitionTtl});
    expectedExcess = [{resource: RESOURCES.CUCUMBER, count: 1}];
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
    const id = await generateId();
    await restrictions.insert({
      restriction: {
        id,
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
    /* NOTE: This test requires that no other test have acquired resources
    for longer, causing a longer `expires` value in the response. */
    const diff = latestExpires - middleExpires;
    const expectedDiff = 1;
    diff.should.equal(expectedDiff);
  });

  // only run this test during CI as it is a long-running test
  if(process.env.CI) {
    it('should acquire successfully after ttl', async function() {
      // use local `acquirerId` so uninfluenced by previous acquisitions
      const acquirerId = uuid();
      const seconds = 2;

      const id = await generateId();
      await restrictions.insert({
        restriction: {
          id,
          zone: ZONES.ONE,
          resource: RESOURCES.PLUM,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 1,
            duration: `PT${seconds}S`
          }
        }
      });

      // acquire first resource
      {
        const now = Date.now();
        const request = [
          {resource: RESOURCES.PLUM, count: 1, requested: now}
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
      }

      // fail to acquire second resource
      {
        const now = Date.now();
        const request = [
          {resource: RESOURCES.PLUM, count: 1, requested: now}
        ];
        const acquisitionTtl = 30000;
        const zones = [ZONES.ONE, ZONES.TWO];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones});
        const expectedResult = {
          authorized: false,
          excessResources: [{
            resource: RESOURCES.PLUM,
            count: 1
          }],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // wait for ttl-based expiration period
      await delay(seconds * 1000);

      // acquire second resource
      {
        const now = Date.now();
        const request = [
          {resource: RESOURCES.PLUM, count: 1, requested: now}
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
      }
    });
  }

  // only run this test during CI as it is a long-running test
  if(process.env.CI) {
    it('should acquire successfully after expiration', async function() {
      // this test needs to run for up to 3 minutes to allow mongodb's record
      // clean up worker to execute
      this.timeout(3 * 60 * 1000);

      // use local `acquirerId` so uninfluenced by previous acquisitions
      const acquirerId = uuid();
      const seconds = 2;

      const id = await generateId();
      await restrictions.insert({
        restriction: {
          id,
          zone: ZONES.ONE,
          resource: RESOURCES.PLUM,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 1,
            duration: `PT${seconds}S`
          }
        }
      });

      // acquire first resource
      {
        const now = Date.now();
        const request = [
          {resource: RESOURCES.PLUM, count: 1, requested: now}
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
      }

      // fail to acquire second resource
      {
        const now = Date.now();
        const request = [
          {resource: RESOURCES.PLUM, count: 1, requested: now}
        ];
        const acquisitionTtl = 30000;
        const zones = [ZONES.ONE, ZONES.TWO];
        const result = await resources.acquire(
          {acquirerId, request, acquisitionTtl, zones});
        const expectedResult = {
          authorized: false,
          excessResources: [{
            resource: RESOURCES.PLUM,
            count: 1
          }],
          untrackedResources: []
        };
        assertCheckResult(result, expectedResult);
      }

      // wait for mongodb-worker-driven expiration period (mongodb's worker runs
      // every 60 seconds but we don't know when, so we need to allow for two
      // full 60 second cycles + time for the record removal to occur to ensure
      // the record is cleaned up; hence we wait for 2 minutes + 10 seconds)
      await delay((60 * 2 + 10) * 1000);

      // check to see that the record has been removed
      const query = {'acquisition.acquirerId': acquirerId};
      const projection = {_id: 0};
      const collection =
        database.collections['resource-restriction-acquisition'];
      const record = await collection.findOne(query, projection);
      should.not.exist(record);
    });
  }
});

describe('Resources Database Tests', function() {
  describe('Indexes', function() {
    beforeEach(async () => {
      await cleanDB();

      const collectionName = 'resource-restriction-acquisition';
      const mockAcquisition2 = JSON.parse(JSON.stringify(mockAcquisition));
      mockAcquisition2.acquisition
        .acquirerId = '22287e9c-5c32-4e59-b103-138f99fe872d';
      await insertRecord({record: mockAcquisition, collectionName});
      // second record is inserted here in order to do proper assertions for
      // 'nReturned', 'totalKeysExamined' and 'totalDocsExamined'.
      await insertRecord({record: mockAcquisition2, collectionName});
    });
    it(`is properly indexed for 'acquisition.acquirerId' in ` +
      '_getAcquisitionRecord()', async function() {
      const {acquirerId} = mockAcquisition.acquisition;
      const {executionStats} = await resources._getAcquisitionRecord({
        acquirerId, explain: true
      });
      executionStats.nReturned.should.equal(1);
      executionStats.totalKeysExamined.should.equal(1);
      executionStats.totalDocsExamined.should.equal(1);
      executionStats.executionStages.inputStage.inputStage.inputStage.stage
        .should.equal('IXSCAN');
      executionStats.executionStages.inputStage.inputStage.inputStage.keyPattern
        .should.eql({'acquisition.acquirerId': 1});
    });
    it(`is properly indexed for 'acquisition.acquirerId' and ` +
      `'acquisition.tokenized' in ` +
      '_updateAcquisitionRecord()', async function() {
      const {acquirerId, expires, ttl, tokenized} = mockAcquisition.acquisition;
      const newTokenized = [...JSON.parse(JSON.stringify(tokenized))];
      newTokenized[0].tokenizerId = '371593a1-a5aa-4346-8663-dba5ebc854b9';

      const {executionStats} = await resources._updateAcquisitionRecord({
        acquirerId, acquisitionRecord: mockAcquisition, newTokenized,
        expires: expires.getTime(),
        ttl, explain: true
      });
      executionStats.nReturned.should.equal(1);
      executionStats.totalKeysExamined.should.equal(1);
      executionStats.totalDocsExamined.should.equal(1);
      executionStats.executionStages.inputStage.inputStage.stage
        .should.equal('IXSCAN');
      executionStats.executionStages.inputStage.inputStage.keyPattern
        .should.eql({'acquisition.acquirerId': 1});
    });
    it(`is properly indexed for 'acquisition.acquirerId' and ` +
      `'acquisition.tokenized' in ` +
      '_removeAcquisitionRecord()', async function() {
      const {acquirerId} = mockAcquisition.acquisition;
      const {executionStats} = await resources._removeAcquisitionRecord({
        acquirerId, acquisitionRecord: mockAcquisition, explain: true
      });
      executionStats.nReturned.should.equal(1);
      executionStats.totalKeysExamined.should.equal(1);
      executionStats.totalDocsExamined.should.equal(1);
      executionStats.executionStages.inputStage.inputStage.stage
        .should.equal('IXSCAN');
      executionStats.executionStages.inputStage.inputStage.keyPattern
        .should.eql({'acquisition.acquirerId': 1});
    });
  });
});
