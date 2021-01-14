/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */

export default {
  restriction: {title: 'restriction',
    type: 'object',
    required: ['zone', 'resource', 'method', 'methodOptions'],
    additionalProperties: false,
    properties: {
      zone: {
        type: 'string'
      },
      resource: {
        type: 'string'
      },
      method: {
        type: 'string',
        enum: ['limitOverDuration']
      },
      methodOptions: {
        type: 'object',
        required: ['limit', 'duration'],
        additionalProperties: false,
        properties: {
          limit: {
            type: 'integer',
            minimum: 0
          },
          duration: {
            type: 'string'
          }
        }
      }
    }
  }
};
