// Opt-in for small, delegated panels: retain matching controls, images and reading hosts.
// Root ownership, lifecycle and listeners remain with the caller.
/** @typedef {{preserveValue?:(element:Element)=>boolean, key?:(element:Element)=>string|null|undefined,
 * preserveNode?:(current:Element,next:Element)=>boolean,
 * preserveAttribute?:(current:Element,next:Element,name:string)=>boolean}} ViewSyncOptions */
function identity(node, options) {
  if (node.nodeType !== 1) return String(node.nodeType);
  const element = /** @type {Element} */ (node);
  const customKey = options.key?.(element);
  const attributes = ['data-view-key', 'id', 'data-preset', 'data-target-id', 'data-card-id', 'data-action', 'data-act', 'data-field', 'data-role'];
  const attribute = attributes.find(name => element.hasAttribute(name));
  const detail = customKey != null ? `key=${customKey}` : attribute ? `${attribute}=${element.getAttribute(attribute)}`
    : element.tagName === 'OPTION' ? `value=${element.getAttribute('value')}`
      : (element.getAttribute('class') || '').trim().split(/\s+/)[0];
  return `${element.namespaceURI}/${element.tagName}/${detail}`;
}

/**
 * @param {Node} target
 * @param {Node} source
 * @param {ViewSyncOptions} [options]
 */
export function syncViewChildren(target, source, options = {}) {
  const buckets = new Map();
  for (const child of target.childNodes) {
    const key = identity(child, options);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(child);
  }
  let cursor = target.firstChild;
  for (const fresh of [...source.childNodes]) {
    const existing = buckets.get(identity(fresh, options))?.shift();
    const node = existing || fresh;
    if (existing) syncNode(existing, fresh, options);
    if (node !== cursor) target.insertBefore(node, cursor);
    cursor = node.nextSibling;
  }
  while (cursor) {
    const next = cursor.nextSibling;
    target.removeChild(cursor);
    cursor = next;
  }
}

/** Sync a caller-owned matching element through the same child and control rules.
 * @param {Element} target
 * @param {Element} source
 * @param {ViewSyncOptions} [options]
 */
export function syncViewElement(target, source, options = {}) {
  syncNode(target, source, options);
}

function syncNode(target, source, options) {
  if (target.nodeType !== 1) {
    if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
    return;
  }
  const current = /** @type {Element} */ (target);
  const next = /** @type {Element} */ (source);
  if (options.preserveNode?.(current, next)) return;
  const form = /^(INPUT|TEXTAREA|SELECT)$/.test(current.tagName);
  const control = /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (current);
  const freshControl = /** @type {typeof control} */ (next);
  const keepValue = form && options.preserveValue?.(current);
  const value = form ? (keepValue ? control.value : freshControl.value) : null;
  const multiple = current.tagName === 'SELECT' && /** @type {HTMLSelectElement} */ (current).multiple;
  const selected = multiple ? [.../** @type {HTMLSelectElement} */ (keepValue ? current : next).selectedOptions].map(option => option.value) : null;
  const saveLocked = current.tagName === 'BUTTON' && current.hasAttribute('data-room-save-locked');
  if (saveLocked) current.setAttribute('data-room-disabled-after-save', String(next.hasAttribute('disabled')));
  const keepAttribute = name => current.tagName === 'DETAILS' && name === 'open'
    || saveLocked && ['disabled', 'data-room-save-locked', 'data-room-disabled-after-save'].includes(name)
    || options.preserveAttribute?.(current, next, name);
  for (const attribute of [...current.attributes]) {
    if (!keepAttribute(attribute.name) && !next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (!keepAttribute(attribute.name) && current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  if (current.tagName === 'TEMPLATE') {
    syncViewChildren(/** @type {HTMLTemplateElement} */ (current).content,
      /** @type {HTMLTemplateElement} */ (next).content, options);
  } else syncViewChildren(current, next, options);
  if (selected) {
    for (const option of /** @type {HTMLSelectElement} */ (current).options) option.selected = selected.includes(option.value);
  } else if (form && control.value !== value) {
    // A removed draft option is cleared instead of silently selecting another item.
    control.value = value;
  }
  if (current.tagName === 'INPUT' && /^(checkbox|radio)$/.test(/** @type {HTMLInputElement} */ (current).type) && !keepValue) {
    /** @type {HTMLInputElement} */ (current).checked = /** @type {HTMLInputElement} */ (next).checked;
  }
}
