// Build once per query/catalogue entry; matching uses no per-card regular expression.
export function normalizeCollectionSearch(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, '').replace(/\s+/gu, ' ').trim();
}

export function compileCollectionSearch(query) {
  const normalized = normalizeCollectionSearch(query);
  if (!normalized) return null;
  const terms = [...new Set(normalized.split(' '))]
    .map(text => ({ text, characters:[...text] }));
  return text => terms.every(term => {
    if (text.includes(term.text)) return true;
    let offset = 0;
    for (const character of term.characters) {
      const found = text.indexOf(character, offset);
      if (found < 0) return false;
      offset = found + character.length;
    }
    return true;
  });
}
