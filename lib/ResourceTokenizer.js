/*!
 * Copyright (c) 2020-2022 Digital Bazaar, Inc. All rights reserved.
 */
import * as base64url from 'base64url-universal';
import {tokenizers} from '@bedrock/tokenizer';

const TEXT_ENCODER = new TextEncoder();

export class ResourceTokenizer {
  /**
   * Constructs a ResourceTokenizer instance that provides three main functions:
   *
   * 1. Determining the tokenizer ID to use for any new resource acquisitions.
   * 2. Pruning expired acquisitions from an acquisition record or request.
   * 3. Mapping the given acquirer ID and resource IDs to tokenized resource
   *    IDs for an acquisition record or vice versa.
   *
   * @param {object} options - Options to use.
   * @param {string} options.acquirerId - The ID of the acquirer.
   * @param {Array} options.request - A resource acquisition or release
   *   request containing resource IDs to compute the mappings for.
   *
   * @returns {ResourceTokenizer} The `ResourceTokenizer` instance.
   */
  constructor({acquirerId, request} = {}) {
    this.acquirerId = acquirerId;
    this.maps = new Map();
    this.prunedTokenized = null;
    this.pruneTime = null;
    this.reverseMaps = new Map();
    this.request = request;
    this.resourceIds = request.map(e => e.resource);
    this.rotate = false;
    this.newTokenizerId = null;
    this.previousAcquisitionTtl = 0;
  }

  /**
   * Processes the given `acquisitionRecord` to prune expired entries and
   * compute mappings from external resource identifiers to internal tokenized
   * resource identifiers and vice versa.
   *
   * @param {object} options - Options to use.
   * @param {object} options.acquisitionRecord - The acquisition record to
   *   compute the mappings for.
   * @param {number} [options.now=Date.now()] - The current system time to use
   *   in milliseconds.
   *
   * @returns {Promise} A promise that settles once the operation is complete.
   */
  async process({acquisitionRecord, now = Date.now()} = {}) {
    // save previous TTL
    this.previousAcquisitionTtl = acquisitionRecord.acquisition.ttl;

    // get current tokenizer
    const currentTokenizer = await tokenizers.getCurrent();

    // prune acquisition record and save prune time so that the request can
    // be pruned at the same time to avoid discrepancies
    this.pruneTime = now;
    const {acquirerId, resourceIds} = this;
    this.prunedTokenized = _pruneTokenized({acquisitionRecord, now});
    if(this.prunedTokenized.length === 0) {
      // add an entry for the current tokenizer
      this.prunedTokenized.push({
        tokenizerId: currentTokenizer.id,
        resources: {}
      });
      // as there are no acquisitions, reset TTL
      this.previousAcquisitionTtl = 0;
    }

    // determine required tokenizer IDs
    const requiredTokenizerIds = this.prunedTokenized.map(
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
          map.set(resourceId, tokenized);
          reverseMap.set(tokenized, resourceId);
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

  /**
   * Gets a map of untokenized resource ID => list of count and requested
   * time information.
   *
   * @returns {Map} The map of untokenized resource IDs => [{count, requested}].
   */
  getUntokenizedAcquisitionMap() {
    // convert tokenized resources tracked in `acquisitionRecord` into a map
    // currently acquired resources applicable to `request` using keys of
    // non-tokenized resource identifiers and values of `{count, requested}`
    const acquired = new Map();
    const {request, prunedTokenized} = this;
    for(const {resource} of request) {
      // `resource` appears (tokenized) in one or fewer entries in `tokenized`
      for(const {tokenizerId, resources} of prunedTokenized) {
        // TODO: could optimize further by only getting this map once
        const tokenizeMap = this.getTokenizeMap({tokenizerId});
        const tokenizedId = tokenizeMap.get(resource);
        const list = resources[tokenizedId];
        if(list) {
          acquired.set(resource, list);
        }
      }
    }
    return acquired;
  }

  /**
   * Creates a new `tokenized` section for an acquisition record by
   * applying an acquire request.
   *
   * @param {object} options - Options to use.
   * @param {object} options.checkResults - The results from running a
   *   resource check.
   *
   * @returns {object} An object with `newTokenized` representing a new
   *   `tokenized` section for an acquisition record, `expires` representing
   *   the earliest time that an expiration of all tracked acquisitions would
   *   be permissible (when a full database record clean up can safely occur),
   *   and `ttl` for more granularly expiring individual acquisitions.
   */
  applyAcquireRequest({checkResults} = {}) {
    /* Compute the new TTL for the acquisition record by considering the
    previous value and the maximum TTL from the applied restrictions. The new
    TTL must be greater than or equal to the previous one unless it has been
    set to `0` to indicate there are no current acquisitions. This ensures that
    previous resource acquisitions continue to be tracked for at least as long
    as was required when the resources were first acquired. */
    const {maxRestrictionTtl} = checkResults;
    const {previousAcquisitionTtl: previousTtl} = this;
    // new TTL must be no less than the previous TTL (unless it is zero)
    const ttl = Math.max(previousTtl, maxRestrictionTtl);

    // add new resources from request, skipping expired ones; prune request
    // using prune time that was used when pruning tokenized record to avoid
    // discrepancies
    const {newTokenizerId, pruneTime: now, request} = this;
    const {newTokenized} = this._createNewTokenizedAcquisition();
    const entry = newTokenized[1] || newTokenized[0];
    const tokenizeMap = this.getTokenizeMap({tokenizerId: newTokenizerId});
    const prunedRequest = _pruneRequest({request, now, ttl});
    for(const {resource, count, requested} of prunedRequest) {
      const tokenizedId = tokenizeMap.get(resource);
      let list = entry.resources[tokenizedId];
      if(!list) {
        entry.resources[tokenizedId] = list = [];
      }
      // add entry in `requested` sort order
      let i = 0;
      while(i < list.length && list[i].requested < requested) {
        i++;
      }
      list.splice(i, 0, {count, requested});
    }

    // compute the new expires
    const expires = _computeExpires({newTokenized, ttl});

    return {newTokenized, expires, ttl};
  }

  /**
   * Creates a new `tokenized` section for an acquisition record by
   * applying a release request.
   *
   * @returns {object} An object with `newTokenized` representing a new
   *   `tokenized` section for an acquisition record and `excessResources`
   *   expressing requested resources that could not be released because they
   *   were not currently acquired, `expires` representing the earliest time
   *   that an expiration of all tracked acquisitions would be permissible
   *   (when a full database record clean up can safely occur), and `ttl` for
   *   more granularly expiring individual acquisitions.
   */
  applyReleaseRequest() {
    const {newTokenizerId, request} = this;
    const {newTokenized} = this._createNewTokenizedAcquisition();
    const entry = newTokenized[1] || newTokenized[0];

    // remove resources expressed in request, according to earliest/latest
    // policy in the request; dedupe resources before removing them
    const tokenizeMap = this.getTokenizeMap({tokenizerId: newTokenizerId});
    const excessResources = new Map();
    for(const {resource, count, latest = false} of request) {
      const tokenizedId = tokenizeMap.get(resource);
      let list = entry.resources[tokenizedId] || [];
      // entries are sorted, remove entries starting from beginning unless
      // `latest` is true (then reverse the list) until `count` is fully
      // consumed
      if(latest) {
        list = list.slice().reverse();
      }
      let toRemove = count;
      const newList = [];
      for(const e of list) {
        if(toRemove >= e.count) {
          // do not include entry
          toRemove -= e.count;
          continue;
        }
        if(toRemove > 0) {
          e.count -= toRemove;
          toRemove = 0;
        }
        newList.push(e);
      }
      if(latest) {
        // ensure `newList` is sorted by earliest acquisition time
        newList.reverse();
      }
      if(newList.length > 0) {
        entry.resources[tokenizedId] = newList;
      } else {
        // all resources released
        delete entry.resources[tokenizedId];
      }
      if(toRemove > 0) {
        // track excess
        const excess = excessResources.get(resource);
        if(excess) {
          excess.count += toRemove;
        } else {
          excessResources.set(resource, toRemove);
        }
      }
    }

    // reuse previous TTL
    const {previousAcquisitionTtl: ttl} = this;
    const expires = _computeExpires({newTokenized, ttl});

    return {
      newTokenized,
      // convert to array form
      excessResources: [...excessResources.entries()].map(
        ([resource, count]) => ({resource, count})),
      expires,
      ttl
    };
  }

  /**
   * Creates a new `tokenized` section for an acquisition record by
   * performing any necessary tokenizer rotation and acquisition expiration.
   *
   * @returns {object} An object with `newTokenized` representing a new
   *   `tokenized` section for an acquisition record.
   */
  _createNewTokenizedAcquisition() {
    /* Note: Since tokenizers can be rotated, the identifiers for previously
      acquired resources may have been tokenized using a tokenizer that has been
      deprecated; we must -- whenever a request comes in containing the resource
      identifiers in question -- convert them from the deprecated tokenizer to
      the new one. If `rotate` is `true`, we know it's time to convert any
      resource identifiers we can by tokenizing them using the new tokenizer. We
      can only convert those resource identifiers if they have been given in
      the request since tokenization uses a one-way hash; we can't build a
      reverse map without knowledge of the non-tokenized resource identifiers.
      Those resource identifiers that can't be converted will eventually either
      expire or be converted by subsequent requests, whichever comes first. */
    const {rotate, newTokenizerId, prunedTokenized} = this;
    let newTokenized = [];
    let entry;
    if(!rotate) {
      // no need to convert old tokenized resources to new ones
      entry = prunedTokenized[0];
      newTokenized = [entry];
    } else {
      entry = prunedTokenized[1] || {
        tokenizerId: newTokenizerId,
        resources: {}
      };
      // convert old tokenized resources to new using new tokenizer ID
      const unconverted = {
        tokenizedId: prunedTokenized[0].tokenizedId,
        resources: {}
      };
      for(const {tokenizerId, resources} of prunedTokenized[0]) {
        const untokenizeMap = this.getUntokenizeMap({tokenizerId});
        const tokenizeMap = this.getTokenizeMap({tokenizerId: newTokenizerId});
        for(const [k, v] of resources.entries()) {
          const resourceId = untokenizeMap.get(k);
          if(resourceId === undefined) {
            // cannot convert, resource is not part of the current request
            unconverted.resources[k] = v;
          } else {
            // do conversion
            const tokenizedId = tokenizeMap.get(resourceId);
            const list = entry.resources[tokenizedId];
            if(!list) {
              entry.resources[tokenizedId] = [...v];
            } else {
              list.push(...v);
            }
          }
        }
      }
      if(Object.keys(unconverted.resources).length > 0) {
        // some old tokenized resources could not be converted yet (they are
        // not part of the request), so retain them for now (they may later
        // expire or be converted by another request)
        newTokenized = [unconverted, entry];
      } else {
        // every old tokenized resource was converted, drop the old set
        newTokenized = [entry];
      }
    }

    return {newTokenized};
  }
}

async function _hmacString({hmac, value}) {
  const data = TEXT_ENCODER.encode(value);
  const signature = await hmac.sign({data});
  // TODO: worth using hmac type to add prefix to signature for future proofing?
  // ... `sha256:<signature>`? ... note that this could complicate key rotation
  return base64url.encode(signature);
}

function _pruneTokenized({acquisitionRecord, now}) {
  const {acquisition: {tokenized, ttl}} = acquisitionRecord;
  const prunedTokenized = [];
  for(const {tokenizerId, resources} of tokenized) {
    const entry = {tokenizerId, resources: {}};
    let empty = true;
    for(const key in resources) {
      // filter out expired acquisitions and shallow copy to prevent
      // changes to `tokenized`'s entries
      entry.resources[key] = resources[key]
        .filter(({requested}) => (requested + ttl) >= now)
        .map(e => ({...e}));
      empty = false;
    }
    if(!empty) {
      prunedTokenized.push(entry);
    }
  }
  return prunedTokenized;
}

function _pruneRequest({request, now, ttl}) {
  return request.filter(
    ({requested}) => requested === undefined || (requested + ttl) >= now);
}

function _computeExpires({newTokenized, ttl}) {
  // calculate `expires`
  let maxRequested;
  for(const {resources} of newTokenized) {
    for(const key in resources) {
      const list = resources[key];
      for(const {requested} of list) {
        maxRequested = Math.max(requested, maxRequested || 0);
      }
    }
  }
  const expires = maxRequested === undefined ? undefined : maxRequested + ttl;
  return expires;
}
