/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */

'use strict';

const data = {};

// mock product IDs and reverse lookup for webkms/edv/etc service products
data.productIdMap = new Map();

const products = [{
  // Use default webkms dev `id` and `serviceId`
  id: 'urn:uuid:80a82316-e8c2-11eb-9570-10bf48838a29',
  name: 'Example KMS',
  service: {
    // default dev `id` configured in `bedrock-kms-http`
    id: 'did:key:z6MkwZ7AXrDpuVi5duY2qvVSx1tBkGmVnmRjDvvwzoVnAzC4',
    type: 'webkms',
  }
}];

for(const product of products) {
  data.productIdMap.set(product.id, product);
  data.productIdMap.set(product.name, product);
}

const now = Date.now();
const mockAcquisition = {
  meta: {
    created: now,
    updated: now
  },
  acquisition: {
    acquirerId: '5caf4057-94cc-4899-9318-a3ab11038072',
    tokenized: [
      {
        tokenizerId: 'did:key:z6Mki64UYzgRGZYLqLxAdJBypbcKt3qEBvDBG8xwbg23a5fc',
        resources: {
          IekttPgFM1txTMnFQFef_WP4we5cxUQeFnnD0juRJvM: [
            {
              count: 2,
              requested: 1636134372681
            }
          ]
        }
      }
    ],
    expires: new Date(now + 3000),
    ttl: 2592000000
  }
};

module.exports = {data, mockAcquisition};
