/*!
 * Copyright (c) 2020-2021 Digital Bazaar, Inc. All rights reserved.
 */
'use strict';

const {restrictions} = require('bedrock-resource-restriction');

const {
  ACQUIRER_ID, RESOURCES, ZONES, assertResourceRestriction, generateId
} = require('./helpers.js');

describe('restrictions', function() {
  it('should insert a restriction', async function() {
    const id = await generateId();
    const actualRestriction = await restrictions.insert({
      restriction: {
        id,
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
      id,
      zone: ZONES.ONE,
      resource: RESOURCES.KIWI,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P30D'
      }
    };
    should.exist(actualRestriction);
    should.exist(actualRestriction.meta);
    should.exist(actualRestriction.restriction);
    actualRestriction.restriction.should.deep.equal(expectedRestriction);
  });

  it('should throw error with no id', async function() {
    let result;
    let err;
    try {
      result = await restrictions.insert({
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
    } catch(e) {
      err = e;
    }
    should.not.exist(result);
    should.exist(err);
    err.name.should.equal('TypeError');
    err.message.should.equal('"restriction.id" is required.');
  });

  it('should throw DuplicateError if restriction with same id is inserted',
    async function() {
      const id = await generateId();
      const actualRestriction = await restrictions.insert({
        restriction: {
          id,
          zone: ZONES.ONE,
          resource: RESOURCES.STRAWBERRY,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 1,
            duration: 'P30D'
          }
        }
      });
      const expectedRestriction = {
        id,
        zone: ZONES.ONE,
        resource: RESOURCES.STRAWBERRY,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 1,
          duration: 'P30D'
        }
      };
      should.exist(actualRestriction);
      should.exist(actualRestriction.meta);
      should.exist(actualRestriction.restriction);
      actualRestriction.restriction.should.deep.equal(expectedRestriction);

      let result;
      let err;
      try {
        // inserting the same restriction again should fail
        result = await restrictions.insert({
          restriction: {
            id,
            zone: ZONES.ONE,
            resource: RESOURCES.STRAWBERRY,
            method: 'limitOverDuration',
            methodOptions: {
              limit: 1,
              duration: 'P30D'
            }
          }
        });
      } catch(e) {
        err = e;
      }
      should.not.exist(result);
      should.exist(err);
      err.name.should.equal('DuplicateError');
      err.message.should.equal('Duplicate restriction.');
    });

  it('should not throw DuplicateError if id is different',
    async function() {
      const id = await generateId();
      await restrictions.insert({
        restriction: {
          id,
          zone: ZONES.TWO,
          resource: RESOURCES.STRAWBERRY,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 1,
            duration: 'P30D'
          }
        }
      });
      // inserting the same restriction with different id should succeed
      const secondId = await generateId();
      const secondRestriction = await restrictions.insert({
        restriction: {
          id: secondId,
          zone: ZONES.TWO,
          resource: RESOURCES.STRAWBERRY,
          method: 'limitOverDuration',
          methodOptions: {
            limit: 1,
            duration: 'P30D'
          }
        }
      });
      should.exist(secondRestriction);
      should.exist(secondRestriction.meta);
      should.exist(secondRestriction.restriction);
      secondRestriction.restriction.methodOptions.duration.should.equal('P30D');
    });

  it('should get a restriction by id', async function() {
    const mockRestriction = {
      id: await generateId(),
      zone: ZONES.TWO,
      resource: RESOURCES.STRAWBERRY,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P30D'
      }
    };
    await restrictions.insert({
      restriction: mockRestriction
    });
    const getRestriction = await restrictions.get({id: mockRestriction.id});
    should.exist(getRestriction);
    getRestriction.restriction.should.eql(mockRestriction);
  });

  it('should get all restrictions for zone and resource', async function() {
    const mockRestriction1 = {
      id: await generateId(),
      zone: ZONES.ONE,
      resource: RESOURCES.MANGO,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 10,
        duration: 'P30D'
      }
    };
    const mockRestriction2 = {
      id: await generateId(),
      zone: ZONES.ONE,
      resource: RESOURCES.MANGO,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P7D'
      }
    };
    await restrictions.insert({
      restriction: mockRestriction1
    });
    await restrictions.insert({
      restriction: mockRestriction2
    });
    const restrictionsArray = await restrictions.getAll({
      zone: ZONES.ONE,
      resource: RESOURCES.MANGO
    });
    should.exist(restrictionsArray);
    restrictionsArray.restrictions.should.be.an('array');
    restrictionsArray.restrictions.length.should.equal(2);
    restrictionsArray.restrictions.should.have.deep.members(
      [mockRestriction1, mockRestriction2]
    );
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

  it('should remove a restriction from the database', async function() {
    // create restrictions
    const mockRestriction1 = {
      id: await generateId(),
      zone: ZONES.ONE,
      resource: RESOURCES.ASPARAGUS,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 10,
        duration: 'P30D'
      }
    };
    const mockRestriction2 = {
      id: await generateId(),
      zone: ZONES.ONE,
      resource: RESOURCES.ASPARAGUS,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P7D'
      }
    };
    await restrictions.insert({
      restriction: mockRestriction1
    });
    await restrictions.insert({
      restriction: mockRestriction2
    });
    const restrictionsArray = await restrictions.getAll({
      zone: ZONES.ONE,
      resource: RESOURCES.ASPARAGUS
    });
    should.exist(restrictionsArray);
    restrictionsArray.restrictions.should.be.an('array');
    restrictionsArray.restrictions.length.should.equal(2);
    restrictionsArray.restrictions.should.have.deep.members(
      [mockRestriction1, mockRestriction2]
    );

    // remove the restriction
    await restrictions.removeAll({
      zone: ZONES.ONE,
      resource: RESOURCES.ASPARAGUS
    });
    let restrictionsArray2;
    let err;
    try {
      // try getting the removed restriction, this should return an empty array
      restrictionsArray2 = await restrictions.getAll({
        zone: ZONES.ONE,
        resource: RESOURCES.ASPARAGUS
      });
    } catch(e) {
      err = e;
    }
    should.not.exist(err);
    should.exist(restrictionsArray2);
    restrictionsArray2.restrictions.should.be.an('array');
    restrictionsArray2.restrictions.length.should.equal(0);
  });

  it('should remove a restriction from the database by id', async function() {
    // create restriction
    const mockRestriction = {
      id: await generateId(),
      zone: ZONES.ONE,
      resource: RESOURCES.MANGO,
      method: 'limitOverDuration',
      methodOptions: {
        limit: 1,
        duration: 'P30D'
      }
    };
    const actualRestriction = await restrictions.insert({
      restriction: mockRestriction
    });
    should.exist(actualRestriction);
    actualRestriction.restriction.should.eql(mockRestriction);

    const restriction = await restrictions.get({
      id: mockRestriction.id
    });

    restriction.restriction.should.eql(mockRestriction);

    // remove the restriction
    await restrictions.remove({id: mockRestriction.id});
    let restriction2;
    let err;
    try {
      // try getting the removed restriction, this should throw a NotFoundError
      restriction2 = await restrictions.get({id: mockRestriction.id});
    } catch(e) {
      err = e;
    }
    should.not.exist(restriction2);
    should.exist(err);
    err.name.should.equal('NotFoundError');
    err.message.should.equal('Restriction not found.');
  });

  it('should insert multiple restrictions', async function() {
    const idOne = await generateId();
    const idTwo = await generateId();
    const restrictionsList = [
      {
        id: idOne,
        zone: ZONES.ONE,
        resource: RESOURCES.MANGO,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 1,
          duration: 'P30D'
        }
      },
      {
        id: idTwo,
        zone: ZONES.TWO,
        resource: RESOURCES.MANGO,
        method: 'limitOverDuration',
        methodOptions: {
          limit: 1,
          duration: 'P30D'
        }
      },
    ];
    const result = await restrictions.bulkInsert({
      restrictions: restrictionsList
    });
    should.exist(result);
    should.exist(result[0].meta);
    should.exist(result[1].meta);
    result[0].restriction.should.equal(restrictionsList[0]);
    result[1].restriction.should.equal(restrictionsList[1]);
    result.length.should.equal(restrictionsList.length);
  });
});
