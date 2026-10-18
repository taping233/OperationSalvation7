import layersPlusSvg from './vendor/lucide-1.58.0/layers-plus.svg?raw';
import licenseUrl from './vendor/lucide-1.58.0/LICENSE.txt?url&no-inline';

let iconTemplate;
// Fixed, reviewed upstream SVG only. Text and acquisition counts stay separate.
export function createAcquisitionIcon() {
  if (!iconTemplate) {
    const template = document.createElement('template');
    template.innerHTML = layersPlusSvg.replace(/>\s+</g, '><').trim();
    iconTemplate = template.content.firstElementChild;
  }
  const icon = iconTemplate.cloneNode(true);
  icon.setAttribute('class', 'bt-acquisition-icon');
  icon.setAttribute('width', '16');
  icon.setAttribute('height', '16');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  // Keep the original upstream notice in the distributed asset graph.
  icon.setAttribute('data-license', licenseUrl);
  return icon;
}
