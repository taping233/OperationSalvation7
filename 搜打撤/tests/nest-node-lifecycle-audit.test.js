import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, UI: {}, cards: [], saves: [], slot: null, battleStarts: [] }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { playerMaxHp: 35, battleEnergy: 3, battleStartDraw: 4, battleTurnDraw: 2 } },
  getActiveSlot: () => H.slot, saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  clearSave() {}, syncPlayTime() {}, exitToTitle: () => { H.game.state = 'title'; },
}));
vi.mock('../game/src/ui/ui.js', () => ({ UI: H.UI }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/run/lab.ending.js', () => ({ playLabEnding: done => done() }));
let Nest, Bus;
const actions = {};
beforeAll(async () => {
  Object.assign(H.UI, { el: {}, showOverlay(title, body) {
    for (const key of Object.keys(actions)) delete actions[key];
    this.el.ovBody.innerHTML = body; this.el.overlay.hidden = false;
  }, hideOverlay() { this.el.overlay.hidden = true; }, act: (name, fn) => actions[name] = fn, log() {}, refresh() {} });
  window.SDT = { game: H.game, UI: H.UI, Icons: { rich: text => text }, Sound: { sfx() {} },
    Cards: { all: () => H.cards, isRandomObtainable: card => card.rarity !== '初始', SHA: { id: 'sha' } },
    Meta: { classLv: () => 1, track() {}, checkUnlocks() {} },
    Base: { data: {}, isSha: card => card.id === 'sha', save: vi.fn(() => true), carriedPet: () => null },
  };
  await import('../game/src/run/game.nest.js'); Nest = window.SDT.Nest;
  ({ default: Bus } = await import('../game/src/core/event-bus.js'));
});
function bindBattle() { Nest.bindBattleStart((game, foes, opts) => {
  H.battleStarts.push({ foes, opts }); game.battleActive = true; game.state = 'modal'; return true;
}); }
beforeEach(async () => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  H.UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') };
  H.slot = null; H.saves = []; H.battleStarts = [];
  const { MAP } = await import('../game/src/run/game.session.js');
  Object.assign(MAP.rules, { battleEnergy: 3, battleStartDraw: 4, battleTurnDraw: 2 });
  H.cards = [{ id: 'sha', name: '初始攻击', rarity: '初始', type: '武术' },
    { id: 'loot', name: '奖励卡', rarity: '古朴', type: '武术' },
    { id: 'hero', name: '英雄', rarity: '职业', type: '武术', hero: true },
    { id: 'class', name: '职业卡', rarity: '职业', type: '武术' }];
  window.SDT.Base.data = { runes: [], stash: [], stats: {}, nestBagUp: 0 };
  Object.assign(H.game, { seed: 7, discoveredPairs: new Set(), state: 'modal', runActive: true, nestActive: true,
    nestPos: 0, nestEquipped: [], nestRunes: [], pendingRunePick: null, nestTargetedBox: 0, battleActive: false,
    ownedCards: [], cardBox: [], nestKills: 0, nestBossDown: false, coins: 0, hp: 20, maxHp: 35,
    nestBoss: { id: 'fixture-boss', name: '测试所主', hp: 35, atk: 1 }, nestBossName: '测试所主',
  });
  bindBattle(); Nest.renderNestMap();
});
afterEach(() => vi.restoreAllMocks());
function endBattle(win, opts = H.battleStarts.at(-1).opts) {
  H.game.battleActive = false; H.game.state = 'idle';
  opts.foeNames = [opts.name]; Bus.emit('battle:end', opts, [], win, []); return opts;
}

describe('研究所自然节点与奖励生命周期审计', () => {
  it('从入口点击下一格首战，按真正战场给奖励；重复结束只推进一次', () => {
    actions.nestCell1(); expect(H.battleStarts[0].opts.name).toBe('黑暗元素');
    const opts = endBattle(true);
    expect(H.game.nestPos).toBe(1); expect(H.game.coins).toBeGreaterThanOrEqual(5);
    expect(H.game.cardBox).toHaveLength(1); expect(H.game.nestRunes).toHaveLength(1);
    const snapshot = JSON.parse(JSON.stringify(H.game)); Bus.emit('battle:end', opts, [], true, []);
    expect(JSON.parse(JSON.stringify(H.game))).toEqual(snapshot);
  });
  it('首战失败保留原进度，重试成功仍按首战奖励', () => {
    actions.nestCell1(); endBattle(false);
    expect(H.game.nestPos).toBe(0); expect(H.game.coins).toBe(0); expect(H.game.hp).toBe(35);
    actions.nestCell1(); endBattle(true);
    expect(H.game.nestPos).toBe(1); expect(H.game.cardBox).toHaveLength(1);
  });
  it.each(['false', 'rejection'])('战斗入口%s失败后还原原随身牌/规则并可重试，不覆盖另一局', async failure => {
    const original = [{ uid: 'original', card: H.cards[1] }]; H.game.ownedCards = original;
    H.game.cardBox = [H.cards[2]];
    Nest.bindBattleStart(() => failure === 'false' ? false : Promise.reject(new Error('模拟加载失败')));
    await actions.nestCell1();
    expect(H.game.ownedCards).toEqual(original); expect(H.game.nestPos).toBe(0);
    const { MAP } = await import('../game/src/run/game.session.js');
    expect(MAP.rules).toMatchObject({ battleEnergy: 3, battleStartDraw: 4, battleTurnDraw: 2 });
    bindBattle(); actions.nestCell1(); expect(H.battleStarts).toHaveLength(1);
  });
  it('旧开战等待失败时，不能把牌盒或规则还原到同槽新局', async () => {
    let release; Nest.bindBattleStart(() => new Promise(resolve => release = resolve));
    const pending = actions.nestCell1(); H.game.discoveredPairs = new Set(); H.game.nestRunes = [];
    const currentOwned = [{ uid: 'current', card: H.cards[1] }]; H.game.ownedCards = currentOwned;
    const { MAP } = await import('../game/src/run/game.session.js'); MAP.rules.battleEnergy = 9;
    H.UI.showOverlay('', '<main id="new-run">新研究所</main>'); release(false); await pending;
    expect(H.game.ownedCards).toBe(currentOwned); expect(MAP.rules.battleEnergy).toBe(9);
    expect(document.getElementById('new-run')?.textContent).toBe('新研究所');
  });
  it('自然从祭坛前往所主，完成后标记所主击破与专属奖励', () => {
    H.game.nestPos = 9; Nest.renderNestMap(); actions.nestCell10(); endBattle(true);
    expect(H.game.nestPos).toBe(10); expect(H.game.nestBossDown).toBe(true);
    expect(H.game.nestTargetedBox).toBe(1); expect(H.game.nestRunes).toHaveLength(6);
    expect(window.SDT.Base.data.stats.nestBossKills).toEqual(['测试所主']);
  });
  it('真实战斗opts读档恢复后，仍能从旧已完成位置定位下一格战场', async () => {
    actions.nestCell1(); const opts = JSON.parse(JSON.stringify(H.battleStarts[0].opts));
    Bus.reset(); vi.resetModules();
    await import('../game/src/run/game.nest.js'); Nest = window.SDT.Nest;
    ({ default: Bus } = await import('../game/src/core/event-bus.js')); bindBattle();
    endBattle(true, opts);
    expect(H.game.nestPos).toBe(1); expect(H.game.coins).toBeGreaterThanOrEqual(5);
    expect(H.game.cardBox).toHaveLength(1);
  });
  it('地图旧的下一格动作不能重开同战斗、跳关或跨新局使用', () => {
    const old = actions.nestCell1;
    old(); old(); expect(H.battleStarts).toHaveLength(1);
    endBattle(false); H.game.nestRunes = []; old(); expect(H.battleStarts).toHaveLength(1);
    Nest.renderNestMap(); actions.nestCell10(); expect(H.battleStarts).toHaveLength(1);
  });
  it('中箱符文选择立即保存并防重；旧领取不能跨新局发奖', () => {
    const rune = { name: '候选', attrs: ['水'], rarity: '古朴' };
    H.game.pendingRunePick = [rune]; Nest.renderNestMap();
    const claim = actions.nestPickRune0; claim(); claim();
    expect(H.game.nestRunes).toEqual([rune]); expect(H.saves).toHaveLength(1);
    expect(H.saves[0].pendingRunePick).toBeNull();
    H.game.nestRunes = []; claim(); expect(H.game.nestRunes).toHaveLength(0);
  });
  it('定向箱按既有符文容量收下可容纳的块数并立即保存，不能二领成负数', () => {
    H.game.nestRunes = Array.from({ length: 9 }, () => ({ name: '已有', attrs: ['火'], rarity: '古朴' }));
    H.game.nestTargetedBox = 1; Nest.renderNestMap(); const claim = actions.nestBox水;
    claim();
    const confirm=actions.nestCostConfirm; confirm(); confirm(); claim();
    expect(H.game.nestRunes).toHaveLength(10); expect(H.game.nestTargetedBox).toBe(0);
    expect(H.saves).toHaveLength(1); expect(H.saves[0].nestTargetedBox).toBe(0);
  });
  it('定向箱满包/空包仍沿同样三块符文掷骰序列，不改变随机流', async () => {
    const { Random } = await import('../game/src/core/random.js');
    const roll = count => {
      Random.reseed(77); H.game.nestRunes = Array.from({ length: count }, () => ({ name: '已有', attrs: ['火'] }));
      H.game.nestTargetedBox = 1; Nest.renderNestMap(); actions.nestBox水(); if (count>7) actions.nestCostConfirm(); return Random.snapshot();
    };
    expect(roll(10)).toEqual(roll(0));
  });
  it.each([0, 3])('符文法阵遵守升级%s的既有上限：满包不扣献祭，腾位后原选项可领取一次', async upgrade => {
    const { Random } = await import('../game/src/core/random.js');
    window.SDT.Base.data.nestBagUp = upgrade;
    H.game.nestRunes = Array.from({ length: 10 + upgrade }, () => ({ name: '已有', attrs: ['火'], rarity: '古朴' }));
    H.game.cardBox = [H.cards[1], H.cards[2], H.cards[3]];
    const cards = H.game.cardBox.slice(); H.game.nestPos = 5;
    Nest.renderNestMap(); actions.nestCell6(); const claim = actions.rc0;
    const beforeRandom = Random.snapshot(); claim();
    expect(H.game.cardBox).toEqual(cards); expect(H.game.nestRunes).toHaveLength(10 + upgrade);
    expect(H.game.nestPos).toBe(5); expect(H.saves).toHaveLength(0); expect(Random.snapshot()).toEqual(beforeRandom);
    H.game.nestRunes.pop(); claim();
    const confirm=actions.nestCostConfirm; confirm(); confirm(); claim();
    expect(H.game.cardBox).toHaveLength(0); expect(H.game.nestRunes).toHaveLength(10 + upgrade);
    expect(H.game.nestPos).toBe(6); expect(H.saves).toHaveLength(1);
  });
  it('法阵确认前列出同名数量，取消不扣牌不重掷，旧确认失效', async () => {
    const { Random } = await import('../game/src/core/random.js');
    H.game.cardBox=[H.cards[0], {...H.cards[1]}, {...H.cards[1]}, {...H.cards[2]}, {...H.cards[3]}];
    H.game.nestPos=5; Nest.renderNestMap(); actions.nestCell6();
    const before=Random.snapshot(), cards=H.game.cardBox.slice();
    const choices=H.UI.el.ovBody.textContent;
    actions.rc0(); const old=actions.nestCostConfirm;
    expect(H.UI.el.ovBody.textContent).toContain('奖励卡 ×2');
    expect(H.UI.el.ovBody.textContent).toContain('英雄 ×1');
    expect(H.UI.el.ovBody.textContent).not.toContain('职业卡 ×1');
    expect(H.game.cardBox).toEqual(cards); expect(H.game.nestRunes).toHaveLength(0);
    actions.nestCostCancel(); old();
    expect(H.UI.el.ovBody.textContent).toBe(choices); expect(Random.snapshot()).toEqual(before);
    expect(H.game.cardBox).toEqual(cards); expect(H.saves).toHaveLength(0);
    actions.rc0(); actions.nestCostConfirm();
    expect(H.game.cardBox).toEqual([H.cards[0],H.cards[3]]);
    expect(H.game.nestRunes).toHaveLength(1); expect(H.game.nestPos).toBe(6);
  });
  it('整盒撤离先列全部非初攻，返回无变化，确认一次才献祭并结算', async () => {
    H.game.cardBox=[H.cards[0],{...H.cards[1]},{...H.cards[1]},H.cards[2]];
    H.game.nestPos=5; Nest.renderNestMap(); actions.nestCell6();
    const cards=H.game.cardBox.slice(); actions.rcBox();
    expect(H.UI.el.ovBody.textContent).toContain('3 张卡牌');
    expect(H.UI.el.ovBody.textContent).toContain('奖励卡 ×2');
    actions.nestCostCancel(); expect(H.game.cardBox).toEqual(cards); expect(H.game.nestActive).toBe(true);
    actions.rcBox(); const confirm=actions.nestCostConfirm; confirm(); confirm();
    await vi.waitFor(()=>expect(H.game.nestActive).toBe(false));
    expect(H.game.cardBox).toEqual([H.cards[0]]);
    expect(window.SDT.Base.data.stats.labRuns).toBe(1);
  });
  it.each([8,9,10])('定向箱已有%i块时先预告收取/散失，取消无RNG无扣箱', async count => {
    const { Random } = await import('../game/src/core/random.js');
    H.game.nestRunes=Array.from({length:count},()=>({name:'已有',attrs:['火']}));
    H.game.nestTargetedBox=1; Nest.renderNestMap();
    const before=Random.snapshot(); actions.nestBox水(); const old=actions.nestCostConfirm;
    expect(H.UI.el.ovBody.textContent).toContain(`收下 ${10-count} 块，散失 ${count-7} 块`);
    expect(H.game.nestRunes).toHaveLength(count); expect(H.game.nestTargetedBox).toBe(1);
    actions.nestCostCancel(); old();
    expect(Random.snapshot()).toEqual(before); expect(H.game.nestTargetedBox).toBe(1);
    expect(H.game.nestRunes).toHaveLength(count); expect(H.saves).toHaveLength(0);
  });
  it('定向箱确认时容量变化需重新展示损失，法阵名单变化也不扣牌', () => {
    H.game.nestRunes=Array.from({length:9},()=>({name:'已有',attrs:['火']}));
    H.game.nestTargetedBox=1; Nest.renderNestMap(); actions.nestBox水();
    H.game.nestRunes.push({name:'后来',attrs:['火']}); actions.nestCostConfirm();
    expect(H.UI.el.ovBody.textContent).toContain('收下 0 块，散失 3 块');
    expect(H.game.nestTargetedBox).toBe(1); actions.nestCostCancel();
    H.game.nestRunes=[]; H.game.cardBox=H.cards.slice(1); H.game.nestPos=5;
    Nest.renderNestMap(); actions.nestCell6(); actions.rc0();
    H.game.cardBox.pop(); actions.nestCostConfirm();
    expect(H.game.cardBox).toHaveLength(2); expect(H.game.nestRunes).toHaveLength(0);
    expect(H.UI.el.ovBody.textContent).toContain('牌盒或符文容量已变化');
  });
  it.each(['rune','box','target'])('%s确认页跨新局旧回调不能扣牌扣箱或发奖', kind => {
    H.game.cardBox=H.cards.slice(1); H.game.nestPos=5;
    H.game.nestRunes=kind==='target'?Array.from({length:9},()=>({name:'已有',attrs:['火']})):[];
    H.game.nestTargetedBox=1; Nest.renderNestMap();
    if(kind==='target') actions.nestBox水();
    else { actions.nestCell6(); actions[kind==='box'?'rcBox':'rc0'](); }
    const old=actions.nestCostConfirm, before=JSON.stringify({box:H.game.cardBox,runes:H.game.nestRunes});
    H.game.discoveredPairs=new Set(); old();
    expect(JSON.stringify({box:H.game.cardBox,runes:H.game.nestRunes})).toBe(before);
    expect(H.game.nestTargetedBox).toBe(1); expect(H.game.nestActive).toBe(true);
    expect(H.saves).toHaveLength(0);
  });
  it.each([0, 3])('研究所商店遵守升级%s的既有上限：满包不扣币或售出，腾位后原商品可购买一次', async upgrade => {
    const { Random } = await import('../game/src/core/random.js');
    window.SDT.Base.data.nestBagUp = upgrade;
    H.game.nestRunes = Array.from({ length: 10 + upgrade }, () => ({ name: '已有', attrs: ['火'], rarity: '古朴' }));
    H.game.coins = 20; H.game.nestPos = 2;
    Nest.renderNestMap(); actions.nestCell3(); const buy = actions.nsR0;
    const price = Number(H.UI.el.ovBody.querySelector('[data-act="nsR0"]').textContent.match(/）(\d+) 币$/)[1]);
    const beforeRandom = Random.snapshot(); buy();
    expect(H.game.coins).toBe(20); expect(H.game.nestRunes).toHaveLength(10 + upgrade);
    expect(H.UI.el.ovBody.querySelector('[data-act="nsR0"]')).not.toBeNull();
    expect(H.game.nestPos).toBe(2); expect(Random.snapshot()).toEqual(beforeRandom);
    H.game.nestRunes.pop(); buy(); buy();
    expect(H.game.coins).toBe(20 - price); expect(H.game.nestRunes).toHaveLength(10 + upgrade);
    expect(H.UI.el.ovBody.querySelector('[data-act="nsR0"]')).toBeNull();
  });
  it.each([[2, 3, 'nsBack'], [5, 6, 'rcBack'], [8, 9, 'naBack']])('位置%s的节点离开只能推进到%s一次', (before, after, action) => {
    H.game.nestPos = before; Nest.renderNestMap(); actions[`nestCell${after}`]();
    const leave = actions[action]; leave(); leave(); expect(H.game.nestPos).toBe(after);
  });
  it('祭坛英雄奖领取一次，离页旧属性重掷不能继续消耗随机流', () => {
    H.game.nestPos = 8; H.game.nestRunes = [{ name: '初文', attrs: ['火'], rarity: '古朴' }];
    Nest.renderNestMap(); actions.nestCell9(); const claim = actions.naHero; const reroll = actions.naReroll;
    claim(); claim(); const attrs = [...H.game.nestRunes[0].attrs]; reroll();
    expect(H.game.cardBox).toHaveLength(2); expect(H.game.nestPos).toBe(9); expect(H.game.nestRunes[0].attrs).toEqual(attrs);
  });
});
