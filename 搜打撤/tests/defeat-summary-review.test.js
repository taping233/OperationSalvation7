import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const html=readFileSync('game/dev/defeat-summary-review.html','utf8');
const source=readFileSync('game/dev/defeat-summary-review.js','utf8');
it('isolates storage before modules and excludes real save backends', () => {
  expect(html.indexOf("Object.defineProperty(window,'localStorage'")).toBeLessThan(html.indexOf('type="module"'));
  expect(html).toContain('const memory=new Map()');
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|game\.session\.js|hub\/base\.js|saveGame|game\.save|game\.restore/);
  expect(source).toContain('attempt:{testData:true}');
});
it('keeps visible scene controls inside overlay and outside replaced content', () => {
  const doc=new DOMParser().parseFromString(html,'text/html');
  const controls=doc.querySelector('#fixtureControls');
  expect(controls.closest('#overlay')).not.toBeNull();
  expect(controls.closest('#ovBody')).toBeNull();
  expect([...controls.querySelectorAll('button')].map(button => button.dataset.scene)).toEqual(['zero','long','saved']);
  expect(source).toContain("button.addEventListener('click', () => start(button.dataset.scene))");
  expect(source).not.toMatch(/start\(['"](?:zero|long|saved)['"]\)|\.click\(/);
});
it('renders the real death settlement and imports only existing stylesheet nodes', () => {
  expect(source).toContain("import('/src/run/game.session.death.js')");
  expect(source).toContain('createDeathSettlement({');
  expect(source).toContain("fetch('/dev/hand-draw-review.html')");
  expect(source).toContain(`querySelectorAll('link[rel="stylesheet"], style')`);
  expect(source).not.toMatch(/innerHTML\s*=|eval\(|new Function/);
  expect(source).toContain('仅记录，不跳转、不存档');
});
