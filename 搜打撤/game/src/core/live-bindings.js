/** @template {Function} F @param {string} name @param {F} fn @returns {F} */
export function namedBinding(name, fn) {
  Object.defineProperty(fn, 'name', { value: name, configurable: true });
  return fn;
}

/** Read through the instance on every access; descriptor and key order match
 * object-literal getters when the owner subsequently freezes the public API.
 * @template {object} T @template {object} S
 * @param {T} target @param {S} state @returns {T & Readonly<S>}
 */
export function bindReadonlyState(target, state) {
  for (const key of Object.keys(state)) {
    Object.defineProperty(target, key, {
      enumerable: true, configurable: true,
      get: namedBinding(`get ${key}`, () => state[/** @type {keyof S} */ (key)]),
    });
  }
  return /** @type {T & Readonly<S>} */ (target);
}

/** Only explicitly allowed fields receive setters. Ordinary functions preserve
 * the former setters' length, constructability and own prototype property.
 * @template {object} S @template {keyof S & string} K
 * @param {S} state @param {readonly K[]} keys
 * @returns {{[P in K as `set$${P}`]: (value: S[P]) => void}}
 */
export function createStateSetters(state, keys) {
  return /** @type {{[P in K as `set$${P}`]: (value: S[P]) => void}} */ (
    Object.fromEntries(keys.map(key => [`set$${key}`, namedBinding(`set$${key}`,
      /** @param {S[K]} value */
      function (value) { state[key] = value; })]))
  );
}

/** Keep one synchronous subscriber per compatibility module. Only the changed
 * own field is read, so unrelated or inherited names stay unobserved.
 * @template {object} S
 * @param {S & {subscribe(listener: (state: S, key: PropertyKey) => void): unknown}} runtime
 * @param {{[K in keyof S]?: (value: S[K]) => void}} bindings
 */
export function subscribeStateBindings(runtime, bindings) {
  return runtime.subscribe((state, key) => {
    if (Object.prototype.hasOwnProperty.call(bindings, key)) {
      const field = /** @type {keyof S} */ (key);
      bindings[field]?.(state[field]);
    }
  });
}
