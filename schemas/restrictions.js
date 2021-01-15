/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */

import {pattern} from 'iso8601-duration';

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
            minimum: 1
          },
          duration: {
            type: 'string',
            pattern: `P(?:(\d+(?:[\.,]\d+)?W)|(\d+(?:[\.,]\d+)?Y)?(\d+(?:[\.,` +
            `]\d+)?M)?(\d+(?:[\.,]\d+)?D)?(?:T(\d+(?:[\.,]\d+)?H)?(\d+(?:[\.` +
            `,]\d+)?M)?(\d+(?:[\.,]\d+)?S)?)?)`
          }
        }
      }
    }
  }
};
