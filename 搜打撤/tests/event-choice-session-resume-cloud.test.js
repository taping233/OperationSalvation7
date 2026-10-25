import { battleRules, quietUiMocks } from './helpers/environment-fixtures.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, ...battleRules(2, 10, 10, 0, 5, 1) }, items: { rations: { name: '口粮' }, wood: { name: '木材' } } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const Base = window.SDT.Base;

const resumeHook = vi.fn(() => true);
const uiLogs = [];
Object.assign(window.SDT.UI, {
  log: message => uiLogs.push(String(message)), refresh: vi.fn(), ...quietUiMocks(),
});
window.SDT.Meta = { setXpMul() {}, track() {} };
window.SDT.Nest = { renderNestMap: vi.fn() };
window.SDT.Battle = { restore: vi.fn() };

const pending = () => ({ version:1, type:'event-choice', eventId:'ev19-quartermaster', cardIds:['tt-wood','tt-rations'], paidCoins:3, taken:null });
async function seedRun(record = pending()) {
  Base.use(1); session._set_active_slot(1);
  session.buildDerived('event-choice-session-cloud');
  Object.assign(session.game, { runActive:true, nestActive:false, state:'idle', layerIdx:0,
    trackPos:session.game.layerData[0].entrances[0], myClass:'warrior', coins:12,
    ownedCards:[], usedPocket:[], inventory:[], nodeRewards:{}, discoveredPairs:new Set(),
    visited:{}, entrySupply:null, pendingExtraction:null, extractionPending:null, terminalPending:null,
  });
  const key = `0,${session.game.trackPos}`;
  session.game.nodeRewards[key] = record;
  expect(await session.saveGame()).toBe(true);
  return { key, record };
}

beforeEach(async () => {
  installImmediateWebLocks();
  localStorage.clear();
  for (let slot = 1; slot <= 5; slot++) await RunStorage.remove(slot);
  resumeHook.mockReset().mockImplementation(() => { session.game.state = 'modal'; return true; });
  window.SDT.Battle.restore.mockClear();
  session.game.battleActive = false;
  session.configureGameRuntime({ resumeEventCardChoice:resumeHook, openClassChoice:vi.fn() });
});

describe('真实存档装载恢复事件候选', () => {
  it('读档直接打开未领选择；恢复不扣币，不调用战斗恢复，保存仍保留候选', async () => {
    const { key, record } = await seedRun();
    session.game.nodeRewards = {}; session.game.coins = 99; session.game.state = 'title';
    const result = session.loadGame(1);
    expect(result).toMatchObject({ ok:true });
    expect(resumeHook).toHaveBeenCalledTimes(1);
    expect(session.game.nodeRewards[key]).toEqual(record);
    expect(session.game.coins).toBe(12);
    expect(session.game.state).toBe('modal');
    expect(window.SDT.Battle.restore).not.toHaveBeenCalled();
    expect(RunStorage.read(1).nodeRewards[key]).toEqual(record);
  });

  it('已领完成记录读档不再打开选择，正常地图恢复保持原余额', async () => {
    const { key, record } = await seedRun({ ...pending(), taken:1 });
    session.game.nodeRewards = {};
    expect(session.loadGame(1).ok).toBe(true);
    expect(resumeHook).not.toHaveBeenCalled();
    expect(session.game.nodeRewards[key]).toEqual(record);
    expect(session.game.coins).toBe(12);
  });

  it('恢复钩子不可用时报告保留原奖励，不伪称已恢复或改成已消费', async () => {
    const { key, record } = await seedRun();
    resumeHook.mockReturnValue(false);
    expect(session.loadGame(1)).toMatchObject({ ok:false, code:'EVENT_CHOICE_RESTORE_FAILED', preserveRun:true });
    expect(RunStorage.read(1).nodeRewards[key]).toEqual(record);
    expect(session.game.visited[key]).toBeUndefined();
  });

  it('其他位置的待领奖励不会强弹，回到原节点才能恢复', async () => {
    const { key, record } = await seedRun();
    const raw = RunStorage.read(1);
    raw.nodeRewards = { ['1,0']:record };
    expect(await RunStorage.write(1, raw)).toBe(true);
    expect(session.loadGame(1).ok).toBe(true);
    expect(resumeHook).not.toHaveBeenCalled();
    expect(session.game.nodeRewards[key]).toBeUndefined();
    expect(session.game.nodeRewards['1,0']).toEqual(record);
  });
});
