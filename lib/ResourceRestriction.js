/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */

/**
 * A ResourceRestriction provides an interface for applying a restriction.
 */
export class ResourceRestriction {
  /**
   * Constructs a ResourceRestriction.
   *
   * @param {object} options - Options to use.
   * @param {object} options.restriction - The restriction.
   * @param {function} options.fn - The restriction method function.
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
   * @param {array} options.request - An array of objects, each with a
   *   `resource`, `count`, and `requested` millisecond timestamp specifying
   *   the resource identifier, number of that particular resource to acquire,
   *   and the time at which the request for the particular resource was made
   *   (which may be different for every resource), respectively.
   * @param {array} options.zones - A list of zone IDs that are applicable to
   *   the acquisition and that will be used to determine which restrictions
   *   apply to the request.
   *
   * @returns {Promise} A promise that settles once the operation is complete.
   */
  async apply({acquirerId, acquirer, request, zones} = {}) {
    const {restriction, fn} = this;
    const {methodOptions: options = {}} = restriction;
    return fn.call(this, {acquirerId, acquirer, request, zones, options});
  }
}
