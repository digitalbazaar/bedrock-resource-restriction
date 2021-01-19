/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {pattern} from 'iso8601-duration';
// convert Regex to a string
const iso8601RegexString = pattern.toString();
// remove leading and trailing slashes
const iso8601Regex =
  iso8601RegexString.substring(1, iso8601RegexString.length - 1);

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
            pattern: iso8601Regex
          }
        }
      }
    }
  }
};
