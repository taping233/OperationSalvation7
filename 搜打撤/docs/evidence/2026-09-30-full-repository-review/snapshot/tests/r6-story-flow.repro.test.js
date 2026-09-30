import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = globalThis.__r6Flow = {
  activeSlot: 1, game: { layerIdx: 0, trackPos: 1, visited: {}, state: 'idle' },
  acts: {}, pages: [], consumed: 0, finish: 0, saveResult: true,
  narrative: async () => ({ intro: '灯', choices: [{ label: '继续', detail: '继续调查', effect: 'continue', choose: () => '记录' }] }),
};

vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { randomEvents: [{ w: 1, text: '普通事件' }], chestTable: [], monsters: {}, encounters: [], items: {}, rules: {} },
  game: harness.game,
  getActiveSlot: () => harness.activeSlot,
  saveGame: () => harness.saveResult,
  weighted: xs => xs[0], pick: xs => xs[0], gainCoins: () => {}, scaledEnemy: x => x,
  cellCenter: () => ({ x: 0, y: 0 }), curLayer: () => ({ logical: [] }), markSeen: () => {}, modeCfg: () => ({ coinMul: 1 }),
}));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  nodeShell: page => harness.pages.push(page), consumeCurrentCell: () => {
    harness.consumed++; harness.game.visited[`${harness.game.layerIdx},${harness.game.trackPos}`] = 1;
  }, finishInstant: () => { harness.finish++; },
  buildEncounter: () => [], cancelLegacyChainMove: () => {}, consumeCell: () => {}, enterNode: (_, fn) => fn(), grantEventCard: () => true,
  openBattleCell: () => {}, openBlankSafePage: () => {}, openChestsOnCell: () => {}, openPickupPage: () => {}, openPocketRestore: () => {},
  openShop: () => {}, preloadCellScene: () => {},
}));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openDoorModal() {}, openFireRest() {}, openAltarRitual() {}, openBossGate() {}, openEmergencyModal() {} }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: {}, _set_cardPageOpen() {}, cardHTML: () => '' }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ startBattle: async () => {} }));
vi.mock('../game/src/core/render-scheduler.js', () => ({ renderScheduler: { invalidate() {} } }));
vi.mock('../game/src/audio/sound.js', () => ({ tone: () => '' }));
vi.mock('../game/src/core/random.js', () => ({ Random: { random: () => 0 } }));
vi.mock('../game/src/run/game.run.data.js', () => ({ EVENT_SCENE_META: {} }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: (...args) => harness.narrative(...args) }));

let runEventDeck, RunStorage, Base, takeBagReturnHook;
beforeAll(async () => {
  window.SDT = {
    Icons: { img: () => '' }, Cards: { all: () => [] }, Sound: { sfx() {} }, Meta: { track() {} },
    UI: { act: (name, fn) => { harness.acts[name] = fn; }, refresh() {}, log() {}, hideOverlay() {} },
  };
  await import('../game/src/hub/base.js');
  Base = window.SDT.Base;
  ({ RunStorage } = await import('../game/src/hub/game.storage.js'));
  ({ takeBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  ({ runEventDeck } = await import('../game/src/run/game.run.flow.js'));
});

function seedRun(slot, runId) {
  harness.activeSlot = slot;
  Base.use(slot); Base.save();
  localStorage.setItem(RunStorage.key(slot), JSON.stringify({ version: 2, _r2: { runId, revision: 0 } }));
}

describe('R6-a 真实 flow 迟到动作复现', () => {
  beforeEach(() => {
    localStorage.clear(); Object.assign(harness, { activeSlot: 1, acts: {}, pages: [], consumed: 0, finish: 0, saveResult: true,
      narrative: async () => ({ intro: '灯', choices: [{ label: '继续', detail: '继续调查', effect: 'continue', choose: () => '记录' }] }) });
    Object.assign(harness.game, { layerIdx: 0, trackPos: 1, visited: {}, state: 'idle' });
  });

  it('结果页打开后换局换节点，旧完成按钮不得消费新节点', async () => {
    seedRun(1, 'run-old');
    await runEventDeck();
    expect(harness.acts.lastLampChoice).toBeTypeOf('function');
    await harness.acts.lastLampChoice({ i: 0 });
    expect(harness.acts.lastLampFinish).toBeTypeOf('function');

    seedRun(2, 'run-new');
    harness.game.layerIdx = 3; harness.game.trackPos = 8;
    const pageCount = harness.pages.length;
    takeBagReturnHook()?.();
    expect(harness.pages).toHaveLength(pageCount);
    harness.acts.lastLampFinish();
    expect(harness.consumed).toBe(0);
  });

  it('Ink拒绝时回退普通事件并正常结算，不写故事', async () => {
    seedRun(1, 'run-ink-fail');
    harness.narrative = async () => null;
    await runEventDeck();
    expect(harness.consumed).toBe(1);
    expect(Base.data.story.outcomes['last-lamp']).toBeUndefined();
  });

  it('同run换坐标后旧选择与选择页背包返回均不覆盖或提交', async () => {
    seedRun(1, 'run-same');
    await runEventDeck();
    const oldChoice = harness.acts.lastLampChoice;
    const oldBag = takeBagReturnHook();
    const pageCount = harness.pages.length;
    harness.game.trackPos = 2;
    oldBag?.();
    await oldChoice({ i: 0 });
    expect(harness.pages).toHaveLength(pageCount);
    expect(Base.data.story.outcomes['last-lamp']).toBeUndefined();
    expect(harness.consumed).toBe(0);
  });

  it('Base写失败留在可见重试页且不消费节点', async () => {
    seedRun(1, 'run-base-fail');
    await runEventDeck();
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (String(key).includes('sdt-base-v2-slot1')) throw new Error('disk full');
      return original.call(this, key, value);
    };
    try { await harness.acts.lastLampChoice({ i: 0 }); }
    finally { Storage.prototype.setItem = original; }
    expect(harness.consumed).toBe(0);
    expect(harness.pages.at(-1).sub).toMatch(/存档写入失败/);
    expect(harness.acts.lastLampChoiceRetry).toBeTypeOf('function');
    expect(Base.data.story.outcomes['last-lamp']).toBeUndefined();
    const staleRetry = harness.acts.lastLampChoiceRetry;
    const staleBag = takeBagReturnHook();
    const pageCount = harness.pages.length;
    harness.game.trackPos = 9;
    staleBag?.(); staleRetry();
    expect(harness.pages).toHaveLength(pageCount);
  });

  it('Base成功但run保存失败显示同结果重试，重试后才完成离开', async () => {
    seedRun(1, 'run-save-retry');
    await runEventDeck();
    await harness.acts.lastLampChoice({ i: 0 });
    harness.saveResult = false;
    harness.acts.lastLampFinish();
    expect(harness.finish).toBe(0);
    expect(harness.game.visited['0,1']).toBeUndefined();
    expect(harness.pages.at(-1).body).toMatch(/本次节点保存失败/);
    harness.saveResult = true;
    harness.acts.lastLampFinish();
    expect(harness.finish).toBe(1);
    expect(harness.game.visited['0,1']).toBe(1);
    expect(Base.data.story.outcomes['last-lamp'].stage).toBe(1);
  });

  it('等待Ink期间切换探索，不得为旧实例登记选择按钮', async () => {
    seedRun(1, 'run-wait');
    let release;
    harness.narrative = () => new Promise(resolve => { release = resolve; });
    const pending = runEventDeck();
    await Promise.resolve();
    seedRun(2, 'run-after-wait');
    harness.game.layerIdx = 2; harness.game.trackPos = 7;
    release({ intro: '迟到', choices: [{ label: '继续', detail: '', effect: 'continue', choose: () => '' }] });
    await pending;
    expect(harness.acts.lastLampChoice).toBeUndefined();
    expect(harness.consumed).toBe(0);
    expect(harness.pages).toHaveLength(0);
  });
});
