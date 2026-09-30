import { expect, it } from 'vitest';
import { esc } from '../snapshot/game/src/core/shared.js';
it('parent verifies actual Icons.hydrate reinterprets escaped user text as HTML', async () => {
  document.body.replaceChildren();
  window.SDT = {};
  await import('../snapshot/game/src/core/icons-bitmap.js');
  const userText = '<img id="audit-injected" src="missing" onerror="window.auditMarker=true"> 🎒';
  const root = document.createElement('div');
  root.innerHTML = `<p>${esc(userText)}</p>`;
  expect(root.querySelector('#audit-injected')).toBeNull();
  window.SDT.Icons.hydrate(root);
  const injected = root.querySelector('#audit-injected');
  console.log('INFRA-hydrate-parent', JSON.stringify({ injectedTag: injected?.tagName, onerror: injected?.getAttribute('onerror') }));
  expect(injected?.tagName).toBe('IMG');
  expect(injected?.getAttribute('onerror')).toBe('window.auditMarker=true');
});
