import { connectSdtFixture, overlayElements, eventMapActions, eventUiMocks, eventSaveActions } from './helpers/environment-fixtures.js';
import { rollEventDice } from './helpers/event-dice-async.js';
// 09-30 全仓深审 WORLD 组（世界/UI 流程）修复回归。发现来源：
// docs/evidence/2026-09-30-full-repository-review/world_ui/findings.json，
// 复现手法沿用其 repro.test.js（mock 装配同款），断言反转成修复后行为。
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const H = globalThis.__worldRegress = { game: {}, saves: [], cards: [], uid: 0 };
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal: 10, fireClassCardChance: 1 }, monsters: {}, altar: { bosses: [] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, ...eventSaveActions(H), getActiveSlot: () => null, ...eventMapActions(H),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(), startBattle() {}, ensureBattleReady: async () => {}, captureBattleContext: () => () => true }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: {} }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: async () => null }));

let scenes, altar, flow, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  await connectSdtFixture({ Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: { bagCap:() => 9 },
    Cards: { all: () => H.cards, isRandomObtainable: () => true, randomClassCard: () => H.cards[0], cardHTML: c => `<span>${c.name}</span>` } });
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, ...eventUiMocks(() => UI),
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  scenes = await import('../game/src/run/game.run.scenes.js');
  altar = await import('../game/src/run/game.run.altar.js');
  flow = await import('../game/src/run/game.run.flow.js');
});
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { ...overlayElements() };
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; setBagReturnHook(null);
  H.cards = [{ id: 'reward', name: '奖励牌', rarity: '职业', type: '武术' }]; H.saves = []; H.uid = 0;
  Object.assign(H.game, { state: 'idle', layerIdx: 0, trackPos: 1, hp: 1, maxHp: 35, visited: {}, nodeRewards: {}, ownedCards: [], usedPocket: [], myClass: '武', runActive: true, coins: 9,
    layerData: [{ logical: [{ def: { type: 'entrance' } }, { def: { type: 'fire' } }] }],
    bagCap:() => 9, usedSlots:() => H.game.ownedCards.length,
    canReceiveCard: () => true, heal: n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
  });
});
// 镜像 game.bag.js closeBackpack 的非搜刮点分支：真实 hideOverlay + 真实返回钩子
function closeCoveredBag() {
  UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) hook(); else H.game.state = 'idle';
}

describe('09-30 深审 WORLD 组修复回归', () => {
  it('WORLD-005 启动失败条：收起后不再重现，启动成功后轮询真正停止', async () => {
    vi.useFakeTimers();
    const html = fs.readFileSync('game/index.html', 'utf8');
    const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
    dom.window.setInterval = (cb, ms) => setInterval(() => cb.call(dom.window), ms);
    dom.window.clearInterval = id => clearInterval(id);
    dom.window.Date = Date;
    dom.window.eval(source);
    vi.advanceTimersByTime(12000);
    const close = dom.window.document.body.querySelector('button');
    expect(close).not.toBeNull();
    close.click();
    expect(dom.window.document.body.children).toHaveLength(0);
    vi.advanceTimersByTime(4000);
    expect(dom.window.document.body.querySelector('button')).toBeNull();   // 此后每 400ms 重建失败条
    // SDT 就绪自愈分支：interval 被 clearInterval 真正清除（此前 clearInterval(this) 传 Window）
    dom.window.eval('window.SDT = window.SDT || {}');
    vi.advanceTimersByTime(400);
    expect(vi.getTimerCount()).toBe(0);
    vi.clearAllTimers(); vi.useRealTimers(); dom.window.close();
  });

  it('WORLD-004 设置页留言库：返回键回设置页（dataset 不再被当成标题页来源）', async () => {
    const { createGameMenuController } = await import('./helpers/menu-controller.js');
    H.game.toggles = { index: false }; H.game.state = 'title';
    Object.assign(window.SDT.Sound, { musicVolume: 1, sfxVolume: 1 });
    const controller = createGameMenuController({ SDT: window.SDT, UI, game: H.game, runtime: { syncDevVisibility() {} }, esc: String });
    controller.openSettings();
    const open = UI.el.ovBody.querySelector('[data-act="openInbox"]');
    UI._acts.openInbox(open.dataset);   // UI 点击委托会把 dataset 传进来
    expect(UI.el.ovBody.querySelector('[data-act="sugBack"]').title).toBe('返回设置（Esc）');
    UI._acts.sugBack();
    expect(H.game.state).toBe('modal');   // 回到设置页（此前误回 title）
    expect(UI.el.ovBody.querySelector('[data-act="closeSettings"]')).not.toBeNull();
  });

  it('WORLD-001 拾取页：背包返回后领取按钮已注册且可领一次', async () => {
    let claimed = 0;
    const onDone = () => { claimed++; };
    scenes.openPickupPage('coin', '+1', {claim:onDone}, true);
    expect(UI.el.ovBody.querySelector('[data-act="pickupGo"]')).not.toBeNull();
    expect(UI._acts.pickupGo).toBeTypeOf('function');   // 此后重入分支未注册
    const firstClaim = UI._acts.pickupGo; await firstClaim(); await firstClaim();
    expect(claimed).toBe(1);
    // 正常首开（搜索动画后揭晓）：揭晓时同样注册
    vi.useFakeTimers();
    scenes.openPickupPage('wood', '+2 木材', {claim:onDone});
    expect(UI._acts.pickupGo).toBeUndefined();
    vi.advanceTimersByTime(1200);
    expect(UI._acts.pickupGo).toBeTypeOf('function');
    vi.useRealTimers();
    // 开背包再关：返回钩子重放本页，领取动作存活、奖励只领一次
    UI.showOverlay('背包', '<button data-act="closeBag">关闭</button>', 'bagpage');
    closeCoveredBag();
    expect(UI.el.ovBody.querySelector('[data-act="pickupGo"]')).not.toBeNull();
    expect(UI._acts.pickupGo).toBeTypeOf('function');
    const finalClaim = UI._acts.pickupGo; await finalClaim(); await finalClaim();
    expect(claimed).toBe(2);
  });

  it('WORLD-002 火堆：从消耗区自动发现两张复原（道具不入池），节点一次性结算', async () => {
    H.game.usedPocket = [
      { uid: 'p1', card: { id: 'x1', name: '烬卡一', type: '武术' }, count: 1 },
      { uid: 'p2', card: { id: 'x2', name: '烬卡二', type: '武术' }, count: 1 },
      { uid: 'p3', card: { id: 'x3', name: '行军膏', type: '道具' }, count: 1 },
    ];
    altar.openFireRest();
    expect(H.game.hp).toBe(1); // 确认前不结算
    await UI._acts.fireHeal(); await UI._acts.fireRestore();
    expect(H.game.hp).toBe(11);   // 回血一次（重入不得重复）
    // 职业卡 + 自动发现两张复原入包；道具卡留在消耗区不可复原（发现顺序随机，排序后比对）
    expect(H.game.ownedCards.map(c => c.card.name).sort()).toEqual(['奖励牌', '烬卡一', '烬卡二'].sort());
    expect(H.game.usedPocket.map(p => p.card.name)).toEqual(['行军膏']);
    expect(H.game.state).toBe('modal'); // 结果页待继续
    expect(H.game.visited['0,1']).toBe(1);
    expect(H.saves.at(-1).ownedCards).toHaveLength(3);
    await UI._acts.fireDone();
    // 已结算节点重进：resolveCell 按 visited 拦截，不再回血/再复原
    flow.reenterCell();
    expect(H.game.hp).toBe(11);
    expect(H.game.ownedCards).toHaveLength(3);
  });

  it('WORLD-002b 火堆空池：只回血掷职业卡并给提示，不再打开复原选牌页', async () => {
    altar.openFireRest();
    expect(UI.el.ovBody.querySelector('[data-act="fireHeal"]')).not.toBeNull();
    await UI._acts.fireHeal(); await UI._acts.fireRestore();
    expect(H.game.hp).toBe(11);
    expect(H.game.ownedCards).toHaveLength(1);   // 仅职业卡
    expect(H.game.visited['0,1']).toBeUndefined();
    expect(H.game.nodeRewards['0,1']).toMatchObject({healUsed:true,restoreUsed:false});
    expect(H.saves.at(-1).ownedCards).toHaveLength(1);
    expect(UI.el.ovBody.querySelector('[data-act="fireDone"]')).not.toBeNull(); // 结果页，无复原选牌
    expect(UI.el.ovBody.querySelector('[data-act="fireResultCard"]')).not.toBeNull(); // 职业奖励可查看
  });

  it('火堆结果页按实际生命差和复原卡显示，满血不报名义回复', async () => {
    H.game.hp = H.game.maxHp;
    const restored = { id:'restored', name:'复原样本', type:'武术' };
    H.cards.push(restored);
    H.game.usedPocket = [{ card:restored, count:1 }];
    altar.openFireRest();
    await UI._acts.fireHeal(); await UI._acts.fireRestore();
    expect(H.game.nodeRewards['0,1']).toMatchObject({ type:'fire', hpGain:0, hpAfter:H.game.maxHp, restoredIds:['restored'] });
    expect(UI.el.ovBody.textContent).toContain('生命已满');
    expect(UI.el.ovBody.textContent).toContain('已复原 1 张');
    expect(UI.el.ovBody.querySelector('[data-act="fireResultCard"]')).not.toBeNull();
    expect(H.saves.at(-1)).not.toHaveProperty('nodeFeedback');
    await UI._acts.fireDone();
    flow.reenterCell();
    expect(H.game.nodeRewards['0,1'].restoredIds).toEqual(['restored']);
  });

  it('营火说明可展开且无副作用，结果区分复原与额外奖励并保留查看入口', async () => {
    const card = { id:'restored-ui', name:'复原牌', type:'武术' };
    H.cards.push(card);
    H.game.usedPocket = [{ card, count:1 }];
    altar.openFireRest();
    const before = JSON.stringify(H.game);
    const help = UI.el.ovBody.querySelector('.ui-disclosure');
    expect(help.open).toBe(false);
    help.open = true;
    expect(JSON.stringify(H.game)).toBe(before);
    expect(UI.el.ovBody.querySelector('[data-act="fireHeal"]').closest('details')).toBeNull();
    await UI._acts.fireHeal(); await UI._acts.fireRestore();
    expect([...UI.el.ovBody.querySelectorAll('.fire-result-label')].map(el => el.textContent)).toEqual(['已复原', '额外获得']);
    expect(UI.el.ovBody.querySelectorAll('[data-act="fireResultCard"]')).toHaveLength(2);
    expect(UI.el.ovBody.querySelector('[data-act="fireDone"]').textContent).toContain('继续探索');
    const after = JSON.stringify(H.game.nodeRewards);
    altar.openFireRest();
    expect(JSON.stringify(H.game.nodeRewards)).toBe(after);
    expect(UI.el.ovBody.querySelectorAll('[data-act="fireResultCard"]')).toHaveLength(2);
  });

  it('WORLD-002c 火堆池仅 1 张可复原：发现该张即止（池不足两张全复原）', async () => {
    H.game.usedPocket = [{ uid: 'p1', card: { id: 'x1', name: '孤卡', type: '武术' }, count: 1 }];
    altar.openFireRest();
    await UI._acts.fireHeal(); await UI._acts.fireRestore();
    expect(H.game.ownedCards.map(c => c.card.name)).toEqual(['奖励牌', '孤卡']);
    expect(H.game.usedPocket).toHaveLength(0);
    expect(H.game.visited['0,1']).toBe(1);
    expect(H.saves.at(-1).ownedCards).toHaveLength(2);
  });

  it('WORLD-003 事件二级选卡页：开关背包不丢已付奖励（付款一次、节点消耗一次）', async () => {
    H.cards = [{ id: 'ev19-quartermaster', type: '事件', name: '装备征用令' }, ...Array.from({ length: 3 }, (_, i) => ({ id: `equip${i}`, name: `装备${i}`, type: '装备', rarity: '古朴' }))];
    H.game.layerData[0].logical[1].def.type = 'event';
    await flow.runEventDeck(); await UI._acts.evtChoice({ i: 0 }); await rollEventDice(UI);
    expect(H.game.coins).toBe(6); expect(H.game.visited['0,1']).toBe(1);
    const pending = H.game.nodeRewards['0,1'];
    expect(pending).toMatchObject({ type:'event-choice', eventId:'ev19-quartermaster', paidCoins:3, taken:null });
    const candidateIds = [...pending.cardIds];
    expect(UI.el.ovBody.querySelector('[data-act="eventCardPick"]')).not.toBeNull();
    UI.showOverlay('背包', '<button data-act="closeBag">关闭</button>', 'bagpage'); closeCoveredBag();
    expect(H.game.state).toBe('modal');   // 返回钩子重开选卡页（此前回 idle 且奖励永久丢失）
    expect(UI.el.ovBody.querySelector('[data-act="eventCardPick"]')).not.toBeNull();
    await UI._acts.eventCardPick({ i: 1 });
    expect(H.game.ownedCards).toHaveLength(1);   // 已付的奖励最终到手
    expect(H.saves.at(-1).coins).toBe(6);        // 只扣一次款
    expect(H.game.nodeRewards['0,1']).toMatchObject({ cardIds:candidateIds, paidCoins:3, taken:1 });
    expect(H.game.visited['0,1']).toBe(1);       // 成功收卡后才消费节点
  });
});
