import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEY, TT10_KEY } from '../game/src/cards/cards.consts.js';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: {
    rules: { battleEnergy: 3, battleHandMax: 20, bossDeckSize: 15, starterSha: 0,
      battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
    items: { rations: { name: '口粮' }, wood: { name: '木材' } },
  },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
const LAMP_ID = 'tt3-magic-lamp';
const CHOICE_MARKER = 'sdt-mig-choice';
let activeGame;

function bootCatalog() {
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
}
const catalog = id => Cards.all().find(card => card.id === id);
const lamp = () => catalog(LAMP_ID);

beforeEach(() => {
  localStorage.clear(); Cards.clearAll();
  bootCatalog();
  vi.useFakeTimers();
});
afterEach(async () => {
  if (activeGame?.battleActive) BattleSession.commands.flee();
  await vi.runOnlyPendingTimersAsync();
  activeGame = null;
  vi.restoreAllMocks(); vi.useRealTimers();
});

function start() {
  const cards = [catalog('starter-attack'), lamp()];
  activeGame = {
    ownedCards: cards.map((card, index) => ({ uid: `choice-${index}`, card, safe: false })),
    inventory: [], usedPocket: [], cardOrder: ['choice-0', 'choice-1'],
    hp: 35, maxHp: 35, atk: 5, spellPower: 0, coins: 0,
    myClass: '法师', characterId: null, state: 'idle', battleActive: false,
    logs: [], log(message) { this.logs.push(String(message)); },
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd() {},
  };
  const foes = [0, 1].map(index => ({ id: `choice-foe-${index}`, name: `抉择靶子${index}`, hp: 100, atk: 1, behavior: 'strike' }));
  BattleSession.start(activeGame, foes, { isBoss: false, name: '神灯护甲回归' });
}
async function settle() {
  await vi.advanceTimersByTimeAsync(1000);
  return BattleSession.getSnapshot();
}

describe('神灯条件护甲：真实目录与战斗管线', () => {
  it('全新启动不会把分支护甲回填为无条件卡面词条', () => {
    expect(lamp()).toMatchObject({ name: '神灯', cost: 1 });
    expect(lamp().armor || 0).toBe(0);
    expect(Cards.deriveArmor(lamp())).toBe(0);
    expect(Cards.cardHTML(lamp())).not.toContain('甲 5');
  });

  it.each([[0, 0], [1, 0], [2, 5]])('选项 %i 的实际护甲增量为 %i', async (option, armor) => {
    // 发现候选仍取现行目录，只收窄随机池，避免选项一的随机牌自带护甲干扰断言。
    vi.spyOn(Cards, 'isRandomObtainable').mockImplementation(card => card.id === 'tt2-shoot');
    start();
    expect(BattleSession.getSnapshot().pdef.armor).toBe(0);
    BattleSession.commands.playCard('choice-0', 0);
    await settle();
    BattleSession.commands.playCard('choice-1', 0);
    const choosing = await settle();
    expect(choosing.choosing?.options).toHaveLength(3);
    BattleSession.commands.pickChoice(option);
    let state = await settle();
    if (option === 0) {
      expect(state.discovering?.options.map(card => card.id)).toEqual(['tt2-shoot']);
      BattleSession.commands.pickDiscover(0);
      state = await settle();
    }
    expect(state).toMatchObject({ busy: false, actionQueueLength: 0, choosing: null, discovering: null });
    expect(state.pdef.armor).toBe(armor);
    expect(choosing.pdef.armor).toBe(0);
    if (option === 1) expect(state.foes.filter(foe => foe.dead)).toHaveLength(1);
    if (option === 2) expect(state.foes.map(foe => foe.status.freeze)).toEqual([1, 1]);
    expect((await settle()).pdef.armor).toBe(armor);
  });
});

describe('神灯旧档修正与制作坊字段边界', () => {
  it('旧 marker 不跳过错误字段修正，重复启动保持正确', () => {
    Cards.upsert({ ...lamp(), armor: 5 });
    expect(localStorage.getItem(CHOICE_MARKER)).toBe('1');
    Cards.ensureChoiceFixes(); Cards.ensureEffectFields();
    expect(lamp().armor || 0).toBe(0);
    const stored = localStorage.getItem(KEY);
    Cards.ensureChoiceFixes(); Cards.ensureEffectFields();
    expect(localStorage.getItem(KEY)).toBe(stored);
  });

  it('带旧 marker 的实际启动链清掉已保存的误回填字段', () => {
    Cards.upsert({ ...lamp(), armor: 5 });
    bootCatalog();
    expect(lamp().armor || 0).toBe(0);
    expect(JSON.parse(localStorage.getItem(KEY)).find(card => card.id === LAMP_ID).armor || 0).toBe(0);
  });

  it('历史批次重播及其后的词条回填不会恢复无条件护甲', () => {
    localStorage.removeItem(TT10_KEY);
    Cards.ensureTabletop(); Cards.ensureEffectFields();
    expect(lamp().armor || 0).toBe(0);
  });

  it('历史第三批神灯的 +5 甲描述同样只属于选项', () => {
    Cards.upsert({ ...Cards.TABLETOP3.find(card => card.id === LAMP_ID), armor: 5 });
    Cards.ensureChoiceFixes(); Cards.ensureEffectFields();
    expect(lamp().armor || 0).toBe(0);
  });

  it('不覆盖自定义卡或改为非抉择的神灯显式护甲', () => {
    const authored = { ...lamp(), desc: '获得 5 点护甲。', armor: 5 };
    delete authored.rules;
    Cards.upsert(authored);
    Cards.upsert({ id: 'custom-choice', name: '自制抉择', type: '法术', armor: 8, desc: '抉择：+3 甲或者造成 2 点伤害。' });
    Cards.ensureChoiceFixes(); Cards.ensureEffectFields();
    expect(lamp().armor).toBe(5);
    expect(catalog('custom-choice').armor).toBe(8);
    expect(Cards.deriveArmor({ desc: '抉择：+3 甲或者造成 2 点伤害。' })).toBe(0);
    expect(Cards.deriveArmor({ armor: 8, desc: '获得 2 点护甲。' })).toBe(8);
  });

  it('不删除神灯另行声明的结构化护甲操作或不同的显式数值', () => {
    const original = { ...lamp() };
    Cards.upsert({ ...original, armor: 5, rules: {
      version: 1, battle: { target: { side: 'self', area: false } },
      triggers: { onPlay: [{ op: 'armor', amountField: 'armor' }] },
    } });
    Cards.ensureChoiceFixes();
    expect(lamp().armor).toBe(5);
    Cards.upsert({ ...original, armor: 7 });
    Cards.ensureChoiceFixes();
    expect(lamp().armor).toBe(7);
  });

  it.each(['false', 'throw'])('保存 %s 不标记成功，也不原地修改现有卡', mode => {
    Cards.upsert({ ...lamp(), armor: 5 });
    localStorage.removeItem(CHOICE_MARKER);
    const stored = localStorage.getItem(KEY);
    const save = vi.spyOn(Cards, 'saveAll').mockImplementation(() => {
      if (mode === 'throw') throw new Error('storage unavailable');
      return false;
    });
    Cards.ensureChoiceFixes();
    expect(localStorage.getItem(CHOICE_MARKER)).toBeNull();
    expect(localStorage.getItem(KEY)).toBe(stored);
    expect(lamp().armor).toBe(5);
    save.mockRestore();
    Cards.ensureChoiceFixes();
    expect(lamp().armor || 0).toBe(0);
  });
});
