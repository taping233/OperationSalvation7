/* Build the first-source-wins canonical card index used by hosted execution. */
export function buildFirstSourceCardIndex(catalogs) {
  const index = new Map();
  for (const catalog of catalogs || []) {
    if (!Array.isArray(catalog)) continue;
    for (const card of catalog) {
      if (!card || card.id == null || index.has(card.id)) continue;
      index.set(card.id, card);
    }
  }
  return index;
}
