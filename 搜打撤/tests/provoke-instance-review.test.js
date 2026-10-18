import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
const html = readFileSync('game/dev/provoke-instance-review.html', 'utf8');
const source = readFileSync('game/dev/provoke-instance-review.js', 'utf8');
it('isolates storage before loading any game module and has no save integration', () => {
  expect(html.indexOf("Object.defineProperty(window,'localStorage'")).toBeLessThan(html.indexOf('type="module"'));
  expect(html).toContain('const memory=new Map()');
  expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|saveGame|game\.save|game\.restore/);
});
it('starts two or three identical real enemies only from visible controls', () => {
  expect(html).toContain('data-count="2"');
  expect(html).toContain('data-count="3"');
  expect(source).toContain("button.addEventListener('click', () => start(Number(button.dataset.count)))");
  expect(source).toContain("Array.from({ length:count }, () => ({ id:'grass_el', name:'滋生异变体', hp:12, atk:5, behavior:'curse' }))");
  expect(source).toContain('battleEnergy:2');
  expect(source).not.toMatch(/start\([23]\)|playCard\(|submitCardPlay\(|clickSelectedTarget\(|selectCardByClick\(/);
});
it('uses production cards, BattleSession and view with read-only visible evidence', () => {
  for (const path of ['/src/cards/cards.js', '/src/battle/core/battle.core.js', '/src/battle/view/battle.view.js']) expect(source).toContain(path);
  expect(source).toContain("card.id === 'tt7-provoke'");
  expect(source).toContain('event.isTrusted');
  expect(source).toContain('snapshot.pendingTarget?.excludedTargetIndex');
  expect(source).toContain('clearInterval(timer)');
});
it('reuses stylesheet nodes without executing the source review scripts', () => {
  expect(source).toContain("fetch('/dev/hand-draw-review.html')");
  expect(source).toContain(`querySelectorAll('link[rel="stylesheet"], style')`);
  expect(source).not.toMatch(/eval\(|new Function|document\.write|innerHTML\s*=/);
});

it('keeps fixture controls inside the overlay background-isolation boundary', () => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const controls = doc.querySelector('#fixtureControls');
  expect(controls.closest('#overlay')).not.toBeNull();
  expect(controls.closest('#ovBody')).toBeNull();
});
