// src/data-layer/validator.js
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

let validateFn = null;

/** Lazy‐load & compile the JSON‐Schema only once */
async function initValidator() {
  if (validateFn) return;
  const resp   = await fetch('src/data-layer/schema_v0.1.json');
  const schema = await resp.json();
  const ajv    = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  validateFn    = ajv.compile(schema);
}

/**
 * Validate a screenplay object.
 * @param {object} obj
 * @returns {Promise<{ok: boolean, errors: object[]}>}
 */
export async function validateScrypt(obj) {
  await initValidator();
  const ok = validateFn(obj);
  return { ok, errors: validateFn.errors || [] };
}
