/*
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import restrictionSchema from '../schemas/restrictions.js';
import Ajv from 'ajv';

const ajv = new Ajv({verbose: true});
ajv.addSchema(restrictionSchema.restriction, 'restrictionSchema');

// throws if validation fails
export async function validateSchema({restriction}) {
  // validate payload against JSON schema
  const valid = ajv.validate('restrictionSchema', restriction);
  if(valid) {
    return true;
  }
  const error = new SyntaxError('Validation error.');
  error.errors = ajv.errors;
  throw error;
}
