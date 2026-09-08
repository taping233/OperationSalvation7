'use strict';

function parseSuggestionDocument(value) {
  if (Array.isArray(value)) return { bare: true, list: value };
  if (value && typeof value === 'object' && Array.isArray(value.suggestions)) {
    return { bare: false, list: value.suggestions };
  }
  return { bare: false, list: [] };
}

function appendSuggestionDocument(value, item) {
  const { bare, list } = parseSuggestionDocument(value);
  const next = [...list, item];
  if (bare) return next;
  return { ...(value && typeof value === 'object' ? value : {}), suggestions: next };
}

function deleteSuggestionDocument(value, timestamp) {
  const { bare, list } = parseSuggestionDocument(value);
  const next = list.filter(entry => entry?.ts !== timestamp);
  return {
    changed: next.length !== list.length,
    value: bare ? next : { ...(value && typeof value === 'object' ? value : {}), suggestions: next },
  };
}

module.exports = { appendSuggestionDocument, deleteSuggestionDocument, parseSuggestionDocument };
