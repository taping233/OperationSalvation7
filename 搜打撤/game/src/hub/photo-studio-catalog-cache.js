// Reuse derived catalogue work across visits, while detecting in-place edits.
export function createPhotoCatalogCache() {
  let signature = null, artwork = null;
  return {
    update(cards, artRenderer, prepare) {
      const nextSignature = JSON.stringify(cards);
      if (signature === nextSignature && artwork === artRenderer) return false;
      prepare(cards);
      signature = nextSignature;
      artwork = artRenderer;
      return true;
    },
  };
}
