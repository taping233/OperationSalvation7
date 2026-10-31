import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

const st = vi.hoisted(() => ({ game:{}, saves:vi.fn(), uid:0 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game:st.game, MAP:{ rules:{} }, bagCap:() => 20, usedSlots:() => st.game.ownedCards.length,
  newUid:() => `restored-${++st.uid}`, saveGame:st.saves, scaledEnemy:card => card, pick:items => items[0],
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen:vi.fn(), cardHTML:card => card.name }));
vi.mock('../game/src/run/game.run.data.js', () => ({
  IMMEDIATE_SCENES:new Set(), NODE_BG:{}, PICKUP_BG:{}, PRELOAD_SCENES:[], SCENES:{}, WINTER_BATTLE_LAYERS:[],
}));
vi.mock('../game/src/run/game.run.shop.js', () => ({ createShopController:() => ({ openShop:vi.fn() }) }));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(),
  startBattle:vi.fn(), captureBattleContext:() => { const token = st.game.discoveredPairs; return () => st.game.discoveredPairs === token; },
}));
vi.mock('../game/src/core/motion.js', () => ({ reduceMotion:() => true }));
vi.mock('../game/src/ui/motion-transitions.js', () => ({}));
vi.mock('../game/src/ui/expedition-feedback.js', () => ({ installExpeditionFeedback:vi.fn() }));

let UI, openPocketRestore, takeBagReturnHook;
const card = (id, type = '法术') => ({ id, name:`复原卡${id}`, type, desc:'完整规则：获得护甲，然后抽一张牌' });
const stack = (id, count = 1, type) => ({ card:card(id, type), count });
const button = name => [...document.querySelectorAll('button[data-act="restoreOne"]')].find(el => !name || el.dataset.name === name);
const content = () => document.querySelector('.pocket-restore-content');
const remaining = () => document.querySelector('.pocket-restore [role="status"]').textContent;
const doneButton = () => document.querySelector('[data-act="fireDone"]');
async function activate(target, detail = 1) {
  await vi.advanceTimersByTimeAsync(32); // Let the real overlay finish its initial focus frame before player input.
  target.focus({ preventScroll:true });
  // jsdom does not synthesize Enter/Space's browser-default click. detail=0 covers its resulting event.
  target.dispatchEvent(new MouseEvent('click', { bubbles:true, detail }));
  await vi.advanceTimersByTimeAsync(2000);
}

beforeAll(async () => {
  await connectSdtFixture({ Icons:{ rich:text => text }, Sound:{ sfx:vi.fn(), scene:vi.fn() }, Cards:{
    cardHTML:c => `<div class="hs-card sm"><span>${c.name}</span><div tabindex="0">长规则</div></div>`,
  } });
  ({ UI } = await import('../game/src/ui/ui.js'));
  ({ openPocketRestore } = await import('../game/src/run/game.run.scenes.js'));
  ({ takeBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><div id="overlay" hidden tabindex="-1"><div class="card"><button id="ovCloseX">×</button><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  Object.assign(st.game, { seed:7, discoveredPairs:new Set(), layerData:[], layerIdx:0, trackPos:0, state:'idle', runActive:true,
    ownedCards:[{ uid:'safe', card:card('protected'), safe:true }, { uid:'stored', card:card('stored'), stored:1 }],
    usedPocket:[stack('a', 3), stack('b'), stack('tool', 1, '道具'), stack('equip', 1, '装备')], canReceiveCard:() => true,
  });
  st.saves.mockClear(); st.uid = 0;
  UI._acts = {}; UI._baseActs = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null;
  UI.init(); UI.beginRoom(); UI.refresh = vi.fn(); UI.log = vi.fn();
});
afterEach(() => {
  UI.hideOverlay({ immediate:true }); UI.endRoom(); takeBagReturnHook();
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe('消耗卡复原公共选择界面', () => {
  it('战地整备的复原入口只提供场景句，次数范围与操作由公共界面说明一次', () => {
    const events = readFileSync('game/src/run/game.run.events.js', 'utf8');
    const sub = events.match(/title: '战地整备 · 修整行装',\s*sub: '([^']+)'/)[1];
    expect(sub).toBe('整备队在撤离前替你修整一件行装。');
    openPocketRestore(1, vi.fn(), { title:'战地整备 · 修整行装', sub });
    expect(remaining()).toContain('还可复原 1 张（最多 1 张）');
    expect(remaining()).not.toContain('点击卡牌');
    expect(document.querySelector('.battle-decision-head').textContent).toContain('消耗区');
    expect(document.querySelector('.battle-decision-summary').textContent).not.toContain('点击卡');
    expect(document.querySelector('.battle-decision-summary').textContent).toContain('道具/装备共 2 张不可复原');
  });

  it.each([
    [3, { title:'祭坛回赠 · 复原', tone:'altar', icon:'[[icon:crystal]]' }],
    [2, { title:'祭坛回赠 · 复原', tone:'altar' }],
    [1, { title:'战地整备 · 修整行装', tone:'event', sub:'整备队在撤离前替你修整一件行装。' }],
  ])('%s张入口沿用共同决策壳，标题/说明/次数与独立footer可见', (picks, opts) => {
    openPocketRestore(picks, vi.fn(), opts);
    expect(UI._lastMode).toBe('discover');
    expect(UI.el.ovBody.parentElement.classList.contains('room')).toBe(false);
    const root = document.querySelector('.battle-decision.pocket-restore');
    expect(root.querySelector('.battle-decision-head h3').textContent).toContain(opts.title);
    expect(remaining()).toContain(`还可复原 ${picks} 张（最多 ${picks} 张）`);
    expect(root.querySelector('.battle-decision-summary').textContent).toContain('道具/装备共 2 张不可复原');
    if (opts.sub) expect(root.textContent).toContain(opts.sub);
    expect(content().contains(doneButton())).toBe(false);
    expect(root.querySelector('footer.battle-decision-actions').contains(doneButton())).toBe(true);
    expect(root.querySelectorAll('[data-act="restoreOne"]')).toHaveLength(2);
    expect(st.saves).not.toHaveBeenCalled();
  });

  it('候选是带卡名/张数/一张动作的原生button，完整规则可读且没有嵌套Tab焦点', () => {
    openPocketRestore(3, vi.fn());
    const target = button();
    expect(target).toBeInstanceOf(HTMLButtonElement); expect(target.type).toBe('button'); expect(target.tabIndex).toBe(0);
    expect(target.getAttribute('aria-label')).toBe('复原卡a，消耗区剩余 3 张，复原 1 张回背包');
    expect(target.getAttribute('aria-description')).toBe(st.game.usedPocket[0].card.desc);
    expect(target.querySelector('.pocket-restore-art').getAttribute('aria-hidden')).toBe('true');
    expect(target.querySelector('[tabindex]')).toBeNull();
    expect(target.textContent).toContain('复原 1 张 · 剩余 3 张');
  });

  it.each([['鼠标', 1], ['原生键盘激活结果', 0]])('%s每次只复原一张，原UID/保护归属不改，重绘保留浮点滚动与焦点', async (_kind, detail) => {
    const done = vi.fn(), protectedCards = structuredClone(st.game.ownedCards);
    openPocketRestore(3, done);
    content().scrollTop = 1229.899;
    await activate(button('复原卡a'), detail);
    expect(st.game.usedPocket[0].count).toBe(2); expect(st.game.ownedCards).toHaveLength(3);
    expect(st.game.ownedCards.slice(0, 2)).toEqual(protectedCards);
    expect(st.game.ownedCards[2]).toEqual({ uid:'restored-1', card:card('a') });
    expect(remaining()).toContain('还可复原 2 张');
    expect(content().scrollTop).toBe(1229.899); expect(document.activeElement).toBe(button('复原卡a'));
    await vi.advanceTimersByTimeAsync(32);
    expect(content().scrollTop).toBe(1229.899); expect(document.activeElement).toBe(button('复原卡a'));
    await activate(button('复原卡a'), detail);
    expect(st.game.usedPocket[0].count).toBe(1); expect(st.game.ownedCards).toHaveLength(4);
    expect(remaining()).toContain('还可复原 1 张');
    expect(done).not.toHaveBeenCalled(); expect(st.saves).toHaveBeenCalled();
  });

  it('候选耗尽后焦点就近续接，全部候选用完仍可继续；完成回调只运行一次', async () => {
    const done = vi.fn(); st.game.usedPocket = [stack('a'), stack('b')];
    openPocketRestore(3, done);
    await activate(button('复原卡a'));
    expect(document.activeElement).toBe(button('复原卡b'));
    await activate(button('复原卡b'), 0);
    expect(document.activeElement).toBe(doneButton()); expect(content().textContent).toContain('没有可复原');
    expect(remaining()).toContain('还可复原 1 张'); expect(done).not.toHaveBeenCalled();
    const finish = UI._acts.fireDone; await activate(doneButton()); finish();
    expect(done).toHaveBeenCalledTimes(1); expect(takeBagReturnHook()).toBeNull();
  });

  it('满包拒收不重绘、不消耗口袋牌与次数，腾位后仍能恢复全部额度', async () => {
    const done = vi.fn(); st.game.canReceiveCard = () => false;
    openPocketRestore(2, done);
    expect(button().disabled).toBe(true); expect(button().title).toContain('背包放不下');
    st.game.canReceiveCard = () => true; openPocketRestore(2, done);
    const target = button(); st.game.canReceiveCard = () => false; const before = JSON.stringify(st.game);
    content().scrollTop = 777.25; await activate(target, 0);
    expect(JSON.stringify(st.game)).toBe(before); expect(document.activeElement).toBe(target);
    expect(content().scrollTop).toBe(777.25); expect(remaining()).toContain('还可复原 2 张');
    expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('背包放不下'), 'warn');
    st.game.canReceiveCard = () => true;
    await activate(target); await activate(button('复原卡a'));
    expect(st.game.ownedCards).toHaveLength(4); expect(st.game.usedPocket[0].count).toBe(1);
    expect(done).toHaveBeenCalledTimes(1); expect(st.saves).toHaveBeenCalled();
  });

  it('每次重绘与背包返回均废止旧动作，返回保留剩余次数，换局后旧hook不盖新页', async () => {
    const done = vi.fn(); openPocketRestore(2, done); const old = UI._acts.restoreOne;
    await activate(button('复原卡a')); old({ name:'复原卡a' });
    expect(st.game.ownedCards).toHaveLength(3);
    const oldAfterRender = UI._acts.restoreOne, back = takeBagReturnHook();
    UI.showOverlay('背包', '<main>背包</main>', 'bag'); back();
    expect(remaining()).toContain('还可复原 1 张'); oldAfterRender({ name:'复原卡a' });
    expect(st.game.ownedCards).toHaveLength(3);
    const newRunHook = takeBagReturnHook(), current = UI._acts.restoreOne;
    st.game.discoveredPairs = new Set(); UI.showOverlay('新局', '<main id="new-run">新局</main>', 'page');
    newRunHook(); current({ name:'复原卡a' });
    expect(document.getElementById('new-run')).not.toBeNull(); expect(st.game.ownedCards).toHaveLength(3); expect(done).not.toHaveBeenCalled();
  });

  it.each([['卡名', 'Escape'], ['规则', 'Escape'], ['卡名', '×'], ['规则', '×']])('%s含取消语义时%s只继续旅程，不复原或消费次数', async (source, action) => {
    const custom = source === '卡名' ? { ...card('custom'), name:'返回之术' } : { ...card('custom'), desc:'取消负面效果，然后将此牌返回牌库' };
    st.game.usedPocket = [{ card:custom, count:3 }];
    const done = vi.fn(); openPocketRestore(2, done);
    const before = JSON.stringify(st.game), restore = UI._acts.restoreOne;
    expect(button().dataset.cancel).toBe('false'); expect(UI._findCancelBtn()).toBe(doneButton());
    expect(document.getElementById('ovCloseX').hidden).toBe(false);
    if (action === 'Escape') {
      button().dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    } else document.getElementById('ovCloseX').click();
    await vi.advanceTimersByTimeAsync(1);
    restore({ name:custom.name });
    expect(JSON.stringify(st.game)).toBe(before); expect(done).toHaveBeenCalledTimes(1);
    expect(st.uid).toBe(0); expect(takeBagReturnHook()).toBeNull();
  });

  it('公共取消探测只有显式false才退出启发式，普通返回/取消按钮与遮罩关闭保留', () => {
    const optOut = vi.fn(), cancel = vi.fn();
    UI.showOverlay('普通选择', '<button data-act="execute" data-cancel="false" title="返回牌库">取消负面效果</button><button data-act="cancel">取消选择</button>', 'discover');
    UI.act('execute', optOut); UI.act('cancel', cancel);
    expect(UI._findCancelBtn().dataset.act).toBe('cancel'); UI.el.overlay.click();
    expect(optOut).not.toHaveBeenCalled(); expect(cancel).toHaveBeenCalledTimes(1);
    UI.showOverlay('普通返回', '<button data-act="back" data-cancel="true" aria-label="返回地图">图标</button>', 'discover');
    UI.act('back', cancel); expect(UI.closeTopOverlayByEsc()).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('额度用尽自动结束，旧复原/继续动作无法多发卡或重复推进', async () => {
    const done = vi.fn(); openPocketRestore(1, done); const restore = UI._acts.restoreOne, finish = UI._acts.fireDone;
    await activate(button(), 0); restore({ name:'复原卡a' }); finish();
    expect(st.game.ownedCards).toHaveLength(3); expect(st.game.usedPocket[0].count).toBe(2); expect(done).toHaveBeenCalledTimes(1);
    expect(takeBagReturnHook()).toBeNull();
  });

  it('公共CSS只限定复原域，完整卡宽/共用滚动区/固定动作栏和可读字号有明确契约', () => {
    const source = readCssSource('game/css/expedition-rewards.css', 'utf8');
    const added = source.slice(source.indexOf('/* Shared consumed-card restoration'), source.indexOf('/* In-reward organization'));
    const css = postcss.parse(added), values = selector => {
      const result = {}; css.walkRules(selector, rule => rule.walkDecls(d => { result[d.prop] = d.value; })); return result;
    };
    css.walkRules(rule => expect(rule.selector).toContain('.pocket-restore'));
    const scope = 'body #overlay .pocket-restore';
    expect(values(`${scope} .pocket-restore-content .fire-restore-hand`)['grid-template-columns']).toBe('repeat(auto-fit,minmax(240px,280px))');
    expect(values(`${scope} .pocket-restore-content`).flex).toBe('1 1 auto');
    expect(values(`${scope} .pocket-restore-content .pocket-restore-art .hs-card`)['font-size']).toBe('24px');
    expect(values(`${scope} .pocket-restore-content .fire-restore-hand`)['max-height']).toBe('none');
    expect(values(`${scope} .pocket-restore-content .fire-restore-hand`).overflow).toBe('visible');
    expect(values(`${scope} .battle-decision-summary .ov-note`)['font-size']).toBe('var(--card-copy-size,24px)');
    expect(parseFloat(values(`${scope} .battle-decision-actions .ov-btn`)['min-height']) * 1188 / 1920).toBeGreaterThanOrEqual(36);
    expect(values('body #overlay .card.discover:has(.pocket-restore)').width).toBe('min(1480px,94%)');
  });
});


describe('复原禁用数量的张数口径', () => {
  it.each([true, false])('有无可选卡=%s时，道具装备按张数求和而非堆数', hasChoice => {
    st.game.usedPocket = [...(hasChoice ? [stack('a', 4)] : []), stack('tool', 3, '道具'), stack('equip', 2, '装备')];
    openPocketRestore(2, vi.fn());
    expect(document.querySelector('.battle-decision-summary').textContent).toContain('道具/装备共 5 张不可复原');
    if (!hasChoice) expect(document.querySelector('.ov-empty').textContent).toContain('另有 5 张道具/装备');
    expect(document.querySelectorAll('[data-act="restoreOne"]')).toHaveLength(hasChoice ? 1 : 0);
  });
});
