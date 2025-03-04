/*!
 * Copyright (c) 2020-2024 Digital Bazaar, Inc. All rights reserved.
 */
import assert from 'assert-plus';

/**
 * A ResourceRestriction provides an interface for applying a restriction.
 */
export class ResourceRestriction {
  /**
   * Constructs a ResourceRestriction.
   *
   * @param {object} options - Options to use.
   * @param {object} options.restriction - An object with a set of parameters
   *   for restricting the acquisition of resources.
   * @param {Function} options.fn - The restriction method function.
   *
   * @returns {ResourceRestriction} The `ResourceRestriction` instance.
   */
  constructor({restriction, fn} = {}) {
    this.restriction = restriction;
    this.fn = fn;
  }

  /**
   * Applies the restriction using the restriction method function.
   *
   * @param {object} options - Options to use.
   *
   * @param {string} options.acquirerId - The ID of the acquirer.
   * @param {Map} options.acquired - The map of untokenized resource IDs =>
   *   [{count, requested}] that represents already acquired resources for
   *   the acquirer ID.
   * @param {Array} options.request - An array of objects, each with a
   *   `resource`, `count`, and `requested` millisecond timestamp specifying
   *   the resource identifier, number of that particular resource to acquire,
   *   and the time at which the request for the particular resource was made
   *   (which may be different for every resource), respectively.
   * @param {Array} options.zones - A list of zone IDs that are applicable to
   *   the acquisition and that will be used to determine which restrictions
   *   apply to the request.
   * @param {number} [options.now=Date.now()] - The current system time to use
   *   in milliseconds.
   * @param {Function} options.getAcquisitionMap - A function for retrieving a
   *   map that expresses the current acquisition of any resources identified
   *   by the caller via an array of resourceIds, i.e., with the signature
   *   `getAcquisitionMap({resourceIds})`.
   *
   * @returns {Promise} A promise that settles once the operation is complete.
   */
  async apply({
    acquirerId, acquired, request, zones, now, getAcquisitionMap
  } = {}) {
    assert.string(acquirerId, 'acquirerId');
    const {restriction, fn} = this;
    return fn.call(this, {
      acquirerId, acquired, request, zones, restriction, now, getAcquisitionMap
    });
  }
}
