import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';

window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (_target, key) => key === 'canvas' ? {} : () => {} });
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = window.SDT || {};
Object.assign(window.SDT, {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {} },
  FX: { feedback() {} },
  MAP: { rules: RULES, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
});
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
Object.assign(window.SDT.UI, {
  log: vi.fn(), refresh() {}, clearLog() {}, hideOverlay() {}, hideScreen() {},
  showScreen() {}, showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; },
});
window.SDT.Meta = { setXpMul() {}, track() {} };
window.SDT.Nest = { renderNestMap() {} };
const session = await import('../game/src/run/game.session.js');
const Base = window.SDT.Base;

beforeEach(async () => {
  localStorage.clear();
  Base.use(1);
  Base.data.stats.playSeconds = 100;
  expect((await Base.save())).toBe(true);
  session._set_active_slot(1);
  session.game.runActive = true;
  session.game.nestActive = false;
  session.game.state = 'idle';
  session.game.elapsed = 30;
  session.game.elapsedSynced = 20;
});

afterEach(() => vi.restoreAllMocks());

describe('session play-time checkpoint', () => {
  it('Base写失败后保持旧的内存checkpoint策略，并阻止同一elapsed重复累加', async () => {
    const slotKey = Base.SLOT_KEY(1);
    const original = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === slotKey) throw new Error('quota');
      return original.call(this, key, value);
    });

    (await session.syncPlayTime());
    expect(Base.data.stats.playSeconds).toBe(110);
    expect(session.game.elapsedSynced).toBe(30);
    expect(JSON.parse(localStorage.getItem(slotKey)).stats.playSeconds).toBe(100);
    (await session.syncPlayTime());
    expect(Base.data.stats.playSeconds).toBe(110);
    expect(setItem.mock.calls.filter(([key]) => key === slotKey)).toHaveLength(1);
  });

  it('没有活动档位时不调用Base命令、不推进checkpoint', async () => {
    Base.use(null);
    session._set_active_slot(null);
    const save = vi.spyOn(Base, 'save');

    (await session.syncPlayTime());

    expect(Base.data.stats.playSeconds).toBe(0);
    expect(session.game.elapsedSynced).toBe(20);
    expect(save).not.toHaveBeenCalled();
  });

  it('计时回退时不减少累计值或checkpoint', async () => {
    session.game.elapsed = 15;
    (await session.syncPlayTime());

    expect(Base.data.stats.playSeconds).toBe(100);
    expect(session.game.elapsedSynced).toBe(20);
  });
});
