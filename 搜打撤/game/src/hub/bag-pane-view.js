// Keep the backpack shell mounted while replacing its active pane.
export function patchBackpackPane(UI, SDT, markup, bagZone, refreshOnly) {
  const mountedBag = refreshOnly && UI.el.ovBody?.querySelector('.bag-v2');
  if (!mountedBag || UI.el.overlay.hidden || UI.el.overlay.classList?.contains('closing')) return false;
  const template = document.createElement('template');
  template.innerHTML = SDT.Icons.rich(markup);
  const next = template.content.querySelector('.bag-col');
  const previous = mountedBag.querySelector('.bag-col');
  const scroll = previous.querySelector('.bag-board')?.scrollTop || 0;
  const sameZone = previous.querySelector('.bag-grid')?.dataset.zone === bagZone;
  previous.replaceWith(next);
  if (sameZone) next.querySelector('.bag-board').scrollTop = scroll;
  for (const button of mountedBag.querySelectorAll('.bag-rz')) {
    const zone = button.dataset.zone;
    const source = template.content.querySelector('.bag-rz[data-zone="' + zone + '"]');
    button.classList.toggle('on', zone === bagZone);
    button.setAttribute('aria-pressed', String(zone === bagZone));
    button.setAttribute('aria-label', source.getAttribute('aria-label'));
    button.querySelector('.bag-bdg').textContent = source.querySelector('.bag-bdg').textContent;
  }
  return true;
}
