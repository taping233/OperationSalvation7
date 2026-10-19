// Read-only count audit. Existing jsdom dependency; no browser or timing claims.
import fs from 'node:fs';
import { JSDOM } from 'jsdom';
const root = new URL('../../../', import.meta.url);
const { createTargetSession } = await import(new URL('game/src/battle/core/battle.target-session.js', root));
const dom = new JSDOM('<div class="battle-stage"><div class="field"><span id="fieldChild"></span></div><div class="sts-hand"><div class="bt-card"></div></div><div class="sts-hud"></div><div class="sts-topbar"></div><div class="bt-potions"></div><div class="bt-foe" data-eidx="0"></div><button data-act="test"></button><span data-ui-tip="test"></span></div><div class="cover"></div>');
globalThis.document = dom.window.document;
const source = fs.readFileSync(new URL('game/src/battle/view/battle.aim.js', root), 'utf8');
const match = source.match(/function aimHoverAt\(x, y, session\) \{([\s\S]*?)\n  \}\n  function makeAimTargetSession/);
if (!match) throw new Error('aimHoverAt source shape changed; review extraction before rerunning');
const aimHoverAt = new Function('x', 'y', 'session', match[1]);
for (const [side, selector] of [
  ['any', '#fieldChild'], ['any', '.bt-card'], ['any', '.sts-hud'],
  ['any', '.sts-topbar'], ['any', '.bt-potions'], ['any', 'button'],
  ['any', '[data-ui-tip]'], ['any', '.cover'], ['enemy', '.bt-foe'],
]) {
  let calls = 0, accepted = 0;
  const element = document.querySelector(selector);
  document.elementFromPoint = () => { calls++; return element; };
  const session = createTargetSession({ side, snapshot: { foes: [{ dead: false }] }, isBattleCurrent: () => true });
  for (let i = 0; i < 1000; i++) if (aimHoverAt(800, 600, session)) accepted++;
  console.log(JSON.stringify({ side, selector, iterations: 1000, elementFromPointCalls: calls, accepted }));
}
dom.window.close();
