import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
import { overlayMethods } from '../game/src/ui/overlay.js';
it.each(['card-feedback-review.html','infusion-review.html'])('%s keeps controls inside the modal boundary and outside replaceable content',file=>{
 const html=readFileSync(`game/dev/${file}`,'utf8');
 const parsed=new DOMParser().parseFromString(html,'text/html');
 document.body.innerHTML=parsed.body.innerHTML;
 const overlay=document.querySelector('#overlay'), controls=document.querySelector('#fixtureControls');
 const ui={...overlayMethods,el:{overlay},_overlayInerted:[]};
 overlayMethods._isolateOverlayBackground.call(ui);
 expect(overlay.contains(controls)).toBe(true);
 expect(controls.closest('[inert]')).toBeNull();
 expect(document.querySelector('#ovBody').contains(controls)).toBe(false);
 document.querySelector('#ovBody').innerHTML='<div class="battle-stage">repaint</div>';
 expect(document.querySelector('#fixtureReset')).not.toBeNull();
 expect(document.querySelector('#fixtureReset').closest('[inert]')).toBeNull();
 overlayMethods._restoreOverlayBackground.call(ui);
});

it('mounts runtime-created restore controls in the same modal boundary',()=>{
 const html=readFileSync('game/dev/restore-capacity-review.html','utf8');
 expect(html).toContain('UI.el.overlay.append(controls)');
 expect(html).not.toContain('document.body.append(controls)');
});
