// Card descriptions, detail pages and battle controls share delegated help.
export function allowsTermTip(element) {
  return element instanceof Element
    && !element.ownerDocument.querySelector('.battle-stage[data-card-dragging="true"]');
}
