// Opt-in for small, delegated panels: retain matching controls, images and reading hosts.
// Root ownership, lifecycle and listeners remain with the caller.
function identity(node) {
  if (node.nodeType !== 1) return String(node.nodeType);
  const element = /** @type {Element} */ (node);
  const attributes = ['id', 'data-preset', 'data-target-id', 'data-card-id', 'data-action', 'data-act', 'data-field', 'data-role'];
  const attribute = attributes.find(name => element.hasAttribute(name));
  const detail = attribute ? `${attribute}=${element.getAttribute(attribute)}`
    : element.tagName === 'OPTION' ? `value=${element.getAttribute('value')}`
      : (element.getAttribute('class') || '').trim().split(/\s+/)[0];
  return `${element.namespaceURI}/${element.tagName}/${detail}`;
}

/**
 * @param {Node} target
 * @param {Node} source
 * @param {{preserveValue?:(element:Element)=>boolean}} [options]
 */
export function syncViewChildren(target, source, options = {}) {
  const buckets = new Map();
  for (const child of target.childNodes) {
    const key = identity(child);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(child);
  }
  let cursor = target.firstChild;
  for (const fresh of [...source.childNodes]) {
    const existing = buckets.get(identity(fresh))?.shift();
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

function syncNode(target, source, options) {
  if (target.nodeType !== 1) {
    if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
    return;
  }
  const current = /** @type {Element} */ (target);
  const next = /** @type {Element} */ (source);
  const form = /^(INPUT|TEXTAREA|SELECT)$/.test(current.tagName);
  const control = /** @type {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} */ (current);
  const freshControl = /** @type {typeof control} */ (next);
  const keepValue = form && options.preserveValue?.(current);
  const value = form ? (keepValue ? control.value : freshControl.value) : null;
  const multiple = current.tagName === 'SELECT' && /** @type {HTMLSelectElement} */ (current).multiple;
  const selected = multiple ? [.../** @type {HTMLSelectElement} */ (keepValue ? current : next).selectedOptions].map(option => option.value) : null;
  const keepAttribute = name => current.tagName === 'DETAILS' && name === 'open';
  for (const attribute of [...current.attributes]) {
    if (!keepAttribute(attribute.name) && !next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of next.attributes) {
    if (!keepAttribute(attribute.name) && current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
  }
  syncViewChildren(current, next, options);
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
