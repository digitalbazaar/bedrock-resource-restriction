/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import {tokenizers} from 'bedrock-tokenizer';
import {TextEncoder} from 'util';

const TEXT_ENCODER = new TextEncoder();

export class ResourceMapper {
  /**
   * Constructs a ResourceMapper instance that is capable of mapping the
   * given acquirer ID and resource IDs to tokenized resource IDs for an
   * acquisition record or vice versa.
   *
   * @param {object} options - Options to use.
   * @param {string} options.acquirerId - The ID of the acquirer.
   * @param {array} options.resourceIds - An array of resource IDs to compute
   *   the mappings for.
   *
   * @returns {Promise} A promise that settles once the operation is complete.
   */
  constructor({acquirerId, resourceIds} = {}) {
    this.acquirerId = acquirerId;
    this.acquisitionRecord = null;
    this.maps = new Map();
    this.reverseMaps = new Map();
    this.resourceIds = resourceIds;
    this.rotate = false;
    this.newTokenizerId = null;
  }

  /**
   * Computes (or recomputes) mappings from external resource identifiers to
   * internal tokenized resource identifiers and vice versa.
   *
   * @param {object} options - Options to use.
   * @param {object} options.acquisitionRecord - The acquisition record to
   *   compute the mappings for.
   *
   * @returns {Promise} A promise that settles once the operation is complete.
   */
  async compute({acquisitionRecord} = {}) {
    // get current tokenizer
    const currentTokenizer = await tokenizers.getCurrent();
    const {acquirerId, resourceIds} = this;

    // determine required tokenizer IDs
    const requiredTokenizerIds = acquisitionRecord.tokenized.map(
      ({tokenizerId}) => tokenizerId);

    // determine the `newTokenizerId` to use (which tokenizer should be used
    // for mapping resource identifiers for storage)... there can be at
    // most two entries in `tokenized` at a time and rotation may be needed
    this.rotate = false;
    if(requiredTokenizerIds.length === 1) {
      // always use current tokenizer as there is room to rotate; current
      // tokenizer will either already match `tokenized` or we should rotate
      this.newTokenizerId = currentTokenizer.id;
      // add the current tokenizer ID as required if it is not represented
      // in the given `acquisitionRecord`
      if(requiredTokenizerIds[0] !== currentTokenizer.id) {
        requiredTokenizerIds.push(currentTokenizer.id);
        // rotation should be performed, there will be two entries
        this.rotate = true;
      }
    } else {
      // no room to add the current tokenizer if not already in use in
      // `tokenized`, so use the one in the second position as the
      // `newTokenizerId` (which may incidentally be the current one anyway)
      this.newTokenizerId = requiredTokenizerIds[1];
      // rotation should be performed, there are two entries
      this.rotate = true;
    }

    // compute maps for all required tokenizer IDs
    for(const tokenizerId of requiredTokenizerIds) {
      if(!this.maps.has(tokenizerId)) {
        // compute new maps
        const map = new Map();
        const reverseMap = new Map();
        this.maps.set(tokenizerId, map);
        this.reverseMaps.set(tokenizerId, reverseMap);
        const {hmac} = await tokenizers.get({id: tokenizerId});
        for(const resourceId of resourceIds) {
          // combine acquirer ID and resource ID when tokenizing to
          // create a pairwise identifier, use JSON.stringify to
          // ensure no two different acquirer ID and resource ID pairs
          // can produce the same tokenized value
          const value = JSON.stringify([acquirerId, resourceId]);
          const tokenized = await _hmacString({hmac, value});
          map.set(value, tokenized);
          reverseMap.set(tokenized, value);
        }
      }
    }
  }

  /**
   * Gets the computed resource identifier => tokenized resource identifier map
   * for the given tokenizer ID.
   *
   * @param {object} options - Options to use.
   * @param {object} options.tokenizerId - The tokenizer ID to get the map
   *   for.
   *
   * @returns {Map} The map of resource IDs => tokenized resource IDs.
   */
  getTokenizeMap({tokenizerId} = {}) {
    return this.maps.get(tokenizerId);
  }

  /**
   * Gets the computed tokenized resource identifier => resource identifier map
   * for the given tokenizer ID.
   *
   * @param {object} options - Options to use.
   * @param {object} options.tokenizerId - The tokenizer ID to get the reverse
   *   map for.
   *
   * @returns {Map} The map of tokenized resource IDs => resource IDs.
   */
  getUntokenizeMap({tokenizerId} = {}) {
    return this.reverseMaps.get(tokenizerId);
  }
}

async function _hmacString({hmac, value}) {
  const data = TEXT_ENCODER.encode(value);
  const signature = await hmac.sign({data});
  // TODO: worth using hmac type to add prefix to signature for future proofing?
  // ... `sha256:<signature>`? ... note that this could complicate key rotation
  return signature;
}
