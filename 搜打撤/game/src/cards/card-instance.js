// Pure acquisition factory: UID allocation stays with the existing caller.
// Card faces use the same JSON-data clone contract as their persisted library.
// @ts-check
import { clone } from '../core/shared.js';
import { isTransientCardInstanceField, retainCardInstanceField } from './card-instance-fields.js';

/** @template {object} T @param {T} source @returns {T} */
function copyCardFace(source) {
  const copy = clone(source);
  const fields = /** @type {Record<string, unknown>} */ (copy);
  for (const field of Object.keys(fields)) {
    if (isTransientCardInstanceField(field)) delete fields[field];
  }
  return copy;
}

/** Manufacture one owned card without sharing nested rules, pouch contents or custom data.
 * @template {object} T @param {T} template @param {string} uid */
export function createCardInstance(template, uid) {
  return { uid, card: copyCardFace(template) };
}

/** Current definitions win ordinary fields; run/custom underscore state keeps its prior value.
 * @template {object} T @param {T} template @param {object} previous @returns {T} */
export function refreshedCardFace(template, previous) {
  const retained = Object.fromEntries(Object.entries(previous).filter(([field]) => retainCardInstanceField(field)));
  return copyCardFace({ ...template, ...retained });
}
