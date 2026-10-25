import { battleRules } from './helpers/environment-fixtures.js';
// Canonical hosted card through the real battle session; no browser state is used.
import { makeRuntimeBattleGame as makeGame } from './helpers/battle-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 20, 15, 0, 20, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

beforeEach(() => { R.bindBattleRenderer(() => {}); vi.useFakeTimers(); R.set$lastDeckSel([]); window.SDT.MAP.rules.battleStartDraw = 20; });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
const canonical = id => { const card = C.all().find(c => c.id === id); expect(card, id).toBeTruthy(); return card; };

async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }


const recasts = () => R.cardAnims.filter(event => event.kind === 'recast');
const attack = (extra = {}) => ({ id: 'feedback-attack', name: '反馈法术', type: '法术', rarity: '古朴', cost: 1, dmg: 3, dmgType: 'spell', desc: '造成3点法术伤害。',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'chosenEnemy' }] } }, ...extra });
function begin(cards, hp = [100]) {
  const game = makeGame(cards);
  BattleSession.start(game, hp.map((value, i) => ({ id: `foe-${i}`, name: `靶${i}`, hp: value, atk: 0 })), { isBoss: false });
  R.takeBattleCardAnims();
  return game;
}
it('元素风暴只在实际追加施放时发一次事件，费用和伤害不变', async () => {
  begin([attack()]); R.set$nextSpellTwice(1);
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(94); expect(R.energy).toBe(98);
  expect(recasts()).toHaveLength(1);
  expect(recasts()[0]).toMatchObject({ name: '反馈法术', source: '元素风暴', repeatIndex: 1, repeatTotal: 1, scope: 'card', battleToken: R.battleState.token });
  expect(R.takeBattleCardAnims().filter(e => e.kind === 'recast')).toHaveLength(1);
  expect(R.takeBattleCardAnims()).toEqual([]);
});
it('箭矢符文复用同一协议，不多扣费', async () => {
  begin([attack({ id: 'token-arrow', name: '箭' })]); R.applyRuneFlag('arrow');
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(94); expect(R.energy).toBe(98);
  expect(recasts()).toMatchObject([{ source: '箭矢符文', scope: 'card', repeatIndex: 1, repeatTotal: 1 }]);
});
it('整卡末手重放保留次序且不合并重复次数', async () => {
  const card = attack(); card.rules.triggers.replay = { on: 'lastHand', times: 2 };
  begin([card]); BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(91); expect(R.energy).toBe(98);
  expect(recasts().map(e => [e.scope, e.repeatIndex, e.repeatTotal])).toEqual([['card',1,2],['card',2,2]]);
  expect(recasts()[0].eventId).toBeLessThan(recasts()[1].eventId);
});
it('结构化击杀只提示实际追加伤害，不冒称整卡施放', async () => {
  const card = attack(); card.rules.triggers.onPlay[0].recast = { on: 'kill', times: 2 };
  begin([card], [2,100]); BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[1].hp).toBe(94); expect(R.energy).toBe(98);
  expect(recasts().map(e => [e.scope,e.source,e.repeatIndex,e.repeatTotal])).toEqual([['damage','击杀追加',1,2],['damage','击杀追加',2,2]]);
});
it('文本击杀追加与结构化使用同一事件', async () => {
  begin([attack({ rules: undefined, desc: '造成3点法术伤害。若击杀敌人，再施放一次。' })], [2,100]);
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[1].hp).toBe(97);
  expect(recasts()).toMatchObject([{ scope: 'damage', source: '击杀追加', repeatIndex: 1, repeatTotal: 1 }]);
});
it('末敌死亡后不伪造追加事件，结束后也不重新发出', async () => {
  const events = []; const game = begin([attack()], [2]);
  R.bindBattleRenderer(() => { events.push(...R.takeBattleCardAnims()); });
  R.set$nextSpellTwice(1); BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(game.battleActive).toBe(false); expect(events.filter(e => e.kind === 'recast')).toEqual([]);
  const { emitRecast } = await import('../game/src/battle/core/battle.engine.js');
  expect(emitRecast({ card: attack(), uid: 'old', repeatIndex: 1, repeatTotal: 1 })).toBe(false);
  R.bindBattleRenderer(() => {});
});
it('钟表资格不提示，结束回合真实开始才发extra-turn-start', async () => {
  begin([canonical('tt3-fate-wheel')]);
  BattleSession.commands.playCard('runtime-0', 'self', true); await settle();
  BattleSession.commands.useEquipSkill('runtime-0'); await settle();
  expect(R.extraTurn).toBe(true); expect(R.cardAnims.some(e => e.kind === 'extra-turn-start')).toBe(false);
  BattleSession.commands.endTurn(); await settle();
  expect(R.turn).toBe(2); expect(R.energy).toBe(99); expect(R.busy).toBe(false);
  expect(R.cardAnims.filter(e => e.kind.endsWith('turn-start'))).toMatchObject([{ kind: 'extra-turn-start', turn: 2, battleToken: R.battleState.token }]);
});
it('普通回合与新战斗没有遗留额外回合提示', async () => {
  begin([attack()]); BattleSession.commands.endTurn(); await settle();
  expect(R.cardAnims.some(e => e.kind === 'extra-turn-start')).toBe(false);
  begin([attack()]); expect(recasts()).toEqual([]);
});

it('文本末手重放与结构化段重放保持各自scope', async () => {
  begin([attack({ rules: undefined, desc: '造成3点法术伤害。若本牌为最后一张手牌，效果触发2次。' })]);
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(94); expect(recasts()).toMatchObject([{ scope: 'card', source: '末手重放', repeatIndex: 1, repeatTotal: 1 }]);
  const card = attack(); card.rules.triggers.onPlay[0].recast = { on: 'lastHand', times: 1 };
  begin([card]); BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(94); expect(recasts()).toMatchObject([{ scope: 'damage', source: '末手追加' }]);
});
it('有诅咒的文本追加在每段真实命中前发出，普通多段不冒充追加', async () => {
  begin([attack({ rules: undefined, desc: '造成3点法术伤害。若对手处于诅咒状态，额外施放2次。' })]);
  R.foes[0].status.poison = 1;
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(91);
  expect(recasts().map(e => [e.scope,e.source,e.repeatIndex,e.repeatTotal])).toEqual([['damage','诅咒追加',1,2],['damage','诅咒追加',2,2]]);
  const card = attack(); card.rules.triggers.onPlay[0].hitCount = 2;
  begin([card]); BattleSession.commands.playCard('runtime-0', 0); await settle();
  expect(R.foes[0].hp).toBe(94); expect(recasts()).toEqual([]);
});
it('首脑钟表额外回合事件同样只发一次', async () => {
  const game = makeGame([canonical('tt3-fate-wheel')]);
  BattleSession.start(game, [{ id: 'boss', name: '首脑靶', hp: 100, atk: 0 }], { isBoss: true });
  for (const card of BattleSession.getSnapshot().deckSelection.cards) BattleSession.commands.selectDeckCard(card.uid);
  BattleSession.commands.confirmDeck(); await settle(); R.takeBattleCardAnims();
  BattleSession.commands.playCard('runtime-0', 'self', true); await settle();
  BattleSession.commands.useEquipSkill('runtime-0'); await settle();
  BattleSession.commands.endTurn(); await settle();
  expect(R.cardAnims.filter(e => e.kind === 'extra-turn-start')).toMatchObject([{ turn: 2 }]);
});
it('取消动作、死亡或无活敌均不产生新语义演出', async () => {
  const { emitRecast } = await import('../game/src/battle/core/battle.engine.js');
  const game = begin([attack()]); const controller = new AbortController(); controller.abort();
  R.set$activeActionSignal(controller.signal);
  const event = { card: attack(), uid: 'runtime-0', repeatIndex: 1, repeatTotal: 1 };
  expect(emitRecast(event)).toBe(false); R.set$activeActionSignal(null);
  game.hp = 0; expect(emitRecast(event)).toBe(false); game.hp = 100;
  R.foes[0].dead = true; expect(emitRecast(event)).toBe(false);
  expect(recasts()).toEqual([]);
});

it('真实追加事件驱动展示DOM，不改变结算后的手牌和费用', async () => {
  begin([attack()]); R.set$nextSpellTwice(1);
  BattleSession.commands.playCard('runtime-0', 0); await settle();
  const events = R.takeBattleCardAnims();
  const { showBattleEffectFeedback } = await import('../game/src/battle/view/battle.effect-feedback.js');
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage sts"><div class="sts-hand"></div></div></div>';
  const stage = document.querySelector('.battle-stage'); stage._battleToken = R.battleState.token;
  const energy = R.energy, hand = [...R.hand];
  showBattleEffectFeedback(stage, events);
  const notice = stage.querySelector('.bt-recast-feedback');
  expect(notice.textContent).toContain('1/1'); expect(notice.textContent).toContain('元素风暴');
  expect(notice.textContent).toContain('反馈法术');
  showBattleEffectFeedback(stage, events);
  expect(stage.querySelectorAll('.bt-recast-feedback')).toHaveLength(1);
  expect(R.energy).toBe(energy); expect(R.hand).toEqual(hand);
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  expect(stage.querySelector('.bt-recast-feedback')).toBeNull();
  document.body.innerHTML = '';
});

it('真实普通开局及结束回合分别发出一次真实阶段事件，刷新/读档不补播', async () => {
  const game = makeGame([attack()]);
  BattleSession.start(game, [{ id: 'turn-target', name: '回合靶', hp: 100, atk: 0 }], { isBoss: false });
  expect(R.takeBattleCardAnims().filter(e => e.kind.endsWith('turn-start'))).toMatchObject([{ kind: 'player-turn-start', turn: 1 }]);
  BattleSession.getSnapshot(); expect(R.takeBattleCardAnims()).toEqual([]);
  BattleSession.commands.endTurn(); await settle();
  expect(R.takeBattleCardAnims().filter(e => e.kind.endsWith('turn-start'))).toMatchObject([
    { kind: 'enemy-turn-start', turn: 1 }, { kind: 'player-turn-start', turn: 2 },
  ]);
  const saved = BattleSession.serialize();
  BattleSession.restore(game, saved);
  expect(R.takeBattleCardAnims().filter(e => e.kind.endsWith('turn-start'))).toEqual([]);
});

it('首脑编组确认后才开始首回合，真实回合抽牌与标题事件同批产生', async () => {
  window.SDT.MAP.rules.battleStartDraw = 1;
  const game = makeGame([attack(), attack({id:'second',name:'第二张'}), attack({id:'third',name:'第三张'})]);
  BattleSession.start(game, [{id:'boss-turn',name:'首脑靶',hp:100,atk:0}], {isBoss:true});
  expect(R.cardAnims.some(e => e.kind === 'player-turn-start')).toBe(false);
  for (const card of BattleSession.getSnapshot().deckSelection.cards) BattleSession.commands.selectDeckCard(card.uid);
  BattleSession.commands.confirmDeck(); await settle();
  expect(R.takeBattleCardAnims().filter(e => e.kind.endsWith('turn-start'))).toMatchObject([{kind:'player-turn-start',turn:1}]);
  BattleSession.commands.endTurn(); await settle();
  const events = R.takeBattleCardAnims();
  expect(events.filter(e => e.kind.endsWith('turn-start'))).toMatchObject([{kind:'enemy-turn-start',turn:1},{kind:'player-turn-start',turn:2}]);
  expect(events.some(e => e.kind === 'draw')).toBe(true);
  const checkpoint = BattleSession.serialize(); BattleSession.restore(game, checkpoint);
  expect(R.takeBattleCardAnims().some(e => e.kind.endsWith('turn-start'))).toBe(false);
});
