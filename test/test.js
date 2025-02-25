/*!
 * Copyright (c) 2020-2025 Digital Bazaar, Inc. All rights reserved.
 */
import * as bedrock from '@bedrock/core';
import {handlers} from '@bedrock/meter-http';
import {restrictions} from '@bedrock/resource-restriction';
import '@bedrock/https-agent';
import '@bedrock/kms';
import '@bedrock/kms-http';
import '@bedrock/meter';
import '@bedrock/meter-usage-reporter';
import '@bedrock/tokenizer';
import '@bedrock/security-context';
import '@bedrock/ssm-mongodb';
import '@bedrock/test';

import {mockData} from './mocha/mock.data.js';

bedrock.events.on('bedrock.init', async () => {
  /* Handlers need to be added before `bedrock.start` is called. These are
  no-op handlers to enable meter usage without restriction */
  handlers.setCreateHandler({
    handler({meter} = {}) {
      // use configured meter usage reporter as service ID for tests
      const {service} = mockData.productIdMap.get(meter.product.id);
      meter.serviceId = service.id;
      return {meter};
    }
  });
  handlers.setUpdateHandler({handler: ({meter} = {}) => ({meter})});
  handlers.setRemoveHandler({handler: ({meter} = {}) => ({meter})});
  handlers.setUseHandler({handler: ({meter} = {}) => ({meter})});

  // register custom restrictions for testing
  restrictions.registerMethod({
    method: 'limitOneGeographicalRegion',
    fn: _limitOneGeographicalRegion
  });
});

bedrock.start();

async function _limitOneGeographicalRegion({
  /*acquirerId, acquired,*/ request,
  /*zones, restriction, now = Date.now(),*/ getAcquisitionMap
}) {
  // ensure that all acquisitions will be in the same geographical region...

  // get any previous region where resources were acquired, assuming only
  // one region is possible because of this rule
  const resourceIds = ['urn:geo:east', 'urn:geo:west'];
  const allPreviousAcquired = await getAcquisitionMap({resourceIds});
  let region;
  for(const resourceId of resourceIds) {
    const acquisitions = allPreviousAcquired.get(resourceId) ?? [];
    if(acquisitions.length > 0) {
      region = resourceId;
      break;
    }
  }

  // ensure any new acquisitions will not introduce a new region
  let excess = 0;
  let newRegion;
  for(const {resource} of request) {
    // process any non-"any" geo resource...
    if(resource.startsWith('urn:geo:') && resource !== 'urn:geo:any') {
      // save the prospective new region...
      newRegion = resource;
      // if resource in another region was already acquired, then this new
      // resource in a new region is in excess and the acquisition will be
      // denied
      if(region && newRegion !== region) {
        excess++;
      }
    }
  }

  return {
    authorized: excess === 0,
    excess,
    // how long this restriction applies to acquired resources; i.e., how
    // long acquisitions must be tracked
    ttl: 30000,
    // only track the new region, not the "any" geo resource that triggers
    // the restriction
    trackedResources: [newRegion]
  };
}
