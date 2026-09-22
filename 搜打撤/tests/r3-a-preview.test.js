import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle.core.js');
const { previewAction } = await import('../game/src/battle.preview.js');
const { Random } = await import('../game/src/random.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

let seq = 0;
function gameWith(card, stats = {}) {
  const uid = `r3a-${seq++}`;
  const logs = [];
  return {
    uid,
    game: {
      ownedCards: [{ uid, card: { ...card }, safe: false }],
      hp: 99, maxHp: 99, atk: stats.atk ?? 4, spellPower: stats.spellPower ?? 0, coins: 0,
      myClass: '战士', characterId: null, state: 'idle', battleActive: false,
      logs, log(message) { logs.push(String(message)); }, heal() {}, addItem() {}, onBattleEnd() {},
    },
  };
}
function restore(game, uid, foe, playerStatus = {}, overrides = {}) {
  return BattleSession.restore(game, {
    opts: { isBoss: !!foe.isBoss, name: 'R3-a 对照' }, mode: foe.isBoss ? 'boss' : 'normal', turn: foe.turn || 1, maxEnergy: 99, energy: 99,
    hand: [uid], drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
    pdef: { shield: 0, armor: 0, guard: false }, pstat: { status: playerStatus },
    foes: [{ id: foe.id || 'infantry', name: '预览靶', hp: foe.hp, maxHp: foe.maxHp ?? foe.hp, atk: 1,
      affix: foe.affix || null, behavior: foe.behavior || null, dead: false, status: foe.status || {},
      defense: foe.defense || { shield: 0, armor: 0, guard: false } }],
    delayed: [], growth: {}, growthNames: [], zeroFeeUntil: [], cardOverrides: [],
    ...overrides,
  });
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
async function settle(max = 200) {
  for (let i = 0; i < max; i++) {
    await tick();
    const snapshot = BattleSession.getSnapshot();
    if (!snapshot.busy && snapshot.actionQueueLength === 0) return snapshot;
  }
  return BattleSession.getSnapshot();
}
function preview(uid, targetIndex = 0) {
  const snapshot = BattleSession.getSnapshot();
  return previewAction({ snapshot, action: { kind: 'play-card', uid, targetIndex }, cardContext: viewApi.getPreviewContext(uid, targetIndex) });
}

describe('R3-a 可信伤害预览', () => {
  it('视图预览不再复用 aim.snap 或命中旧气泡早退，三敌气泡宽度受单位格约束', () => {
    const viewSource = fs.readFileSync('game/src/battle.view.js', 'utf8');
    const cssSource = fs.readFileSync('game/css/battle.css', 'utf8');
    expect(viewSource).not.toMatch(/showFoePreview\([^\n]*aim\.snap/);
    expect(viewSource).not.toContain("if (el.querySelector('.bt-fpreview')) return");
    expect(cssSource).toMatch(/\.bt-fpreview[^}]*width:\s*calc\(100% - 8px\)[^}]*min-width:\s*0/s);
    expect(cssSource).toMatch(/\.bt-fpreview[^}]*top:\s*auto[^}]*bottom:\s*calc\(100% \+ 44px\)/s);
    expect(cssSource).not.toContain('.bt-fpreview { top:-108px; }');
    expect(cssSource).toContain('.bt-fpreview > b b { display: inline;');
  });
  it.each([
    ['starter-attack', 5, 0],
    ['tt7-sneak', 4, 0],
    ['tt3-reshot', 7, 0],
    ['tt2-shoot', 2, 0],
    ['tt3-fireball', 6, 2],
    ['cmtna0nb1yxt', 7, 2],
  ])('%s 的 exact 伤害/HP 与真实 BattleSession 结算一致', async (id, expected, spellPower) => {
    const card = Cards.all().find(entry => entry.id === id);
    const { game, uid } = gameWith(card, { atk: 5, spellPower });
    expect(restore(game, uid, { hp: 20 })).toBe(true);
    const result = preview(uid);
    expect(result.confidence).toBe('exact');
    expect(result.damage.total).toBe(expected);
    BattleSession.commands.playCard(uid, 0);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
    BattleSession.commands.flee();
  });

  it('多段逐段消耗闪避/护盾，不做首段乘次数', async () => {
    const card = Cards.all().find(entry => entry.id === 'tt7-meteorrain');
    const { game, uid } = gameWith(card, { atk: 4 });
    restore(game, uid, { hp: 10, status: { dodge: 1 }, defense: { shield: 1, armor: 0, guard: false } });
    const result = preview(uid);
    expect(result.confidence).toBe('exact');
    expect(result.damage.hits).toEqual([0, 2]);
    expect(result.damage.dodgeAfter).toBe(0);
    expect(result.damage.shieldAfter).toBe(0);
    BattleSession.commands.playCard(uid, 0);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
    expect(actual.foes[0].status.dodge).toBe(result.damage.dodgeAfter);
    expect(actual.foes[0].defense.shield).toBe(result.damage.shieldAfter);
    BattleSession.commands.flee();
  });

  it('首段击杀后停止后续段，预览与真实结算一致', async () => {
    const card = Cards.all().find(entry => entry.id === 'tt3-double-shot');
    const { game, uid } = gameWith(card);
    restore(game, uid, { hp: 1 });
    const result = preview(uid);
    expect(result.damage.hits).toEqual([2]);
    expect(result.damage.lethal).toBe(true);
    BattleSession.commands.playCard(uid, 0);
    await settle();
    expect(game.logs.filter(line => line.includes('点固定伤害')).length).toBe(1);
  });

  it('首脑庇幕上下文由 core 读取，exact 0 伤害与真实结算一致', async () => {
    const card = Cards.all().find(entry => entry.id === 'starter-attack');
    const { game, uid } = gameWith(card, { atk: 5 });
    restore(game, uid, { id: 'boss_elem', hp: 30, isBoss: true, turn: 2, affix: 'aegis', behavior: 'element_boss' });
    const result = preview(uid);
    expect(result.confidence).toBe('exact');
    expect(result.damage.total).toBe(0);
    expect(result.damage.blockedBy).toBe('aegis');
    BattleSession.commands.playCard(uid, 0);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
    BattleSession.commands.flee();
  });

  it('语义指纹任一改写后降为 unknown，不显示数字或击倒', () => {
    const original = Cards.all().find(entry => entry.id === 'tt2-shoot');
    for (const changed of [
      { ...original, desc: '造成 2 点伤害，抽 1 张牌。' },
      { ...original, dmg: 3 },
      { ...original, dmgType: 'attack' },
      { ...original, type: '法术' },
    ]) {
      const { game, uid } = gameWith(changed);
      restore(game, uid, { hp: 2 });
      const result = preview(uid);
      expect(result.confidence).toBe('unknown');
      expect(result.damage).toBeNull();
      expect(result.reasons[0]).toMatch(/暂不支持/);
      BattleSession.commands.flee();
    }
  });

  it.each(['cc-double-boom', 'tt7-whirlwind', 'cc-mana-surge', 'cc-cursed-blade'])(
    '%s 的 AOE/状态前置流程为 unknown，预览不执行效果', id => {
      const card = Cards.all().find(entry => entry.id === id);
      expect(card).toBeTruthy();
      const { game, uid } = gameWith(card);
      restore(game, uid, { hp: 12 });
      const before = BattleSession.getSnapshot();
      const result = preview(uid);
      expect(result.confidence).toBe('unknown');
      expect(result.damage).toBeNull();
      expect(BattleSession.getSnapshot()).toEqual(before);
      BattleSession.commands.flee();
    },
  );

  it('无能量、非当前手牌和错误目标均由 core 规则窄口拒绝', () => {
    const card = Cards.all().find(entry => entry.id === 'starter-attack');
    let setup = gameWith(card);
    restore(setup.game, setup.uid, { hp: 12 }, {}, { energy: 0, maxEnergy: 2 });
    expect(preview(setup.uid)).toMatchObject({ legal: false, damage: null, reasons: [expect.stringMatching(/能量不足/)] });
    BattleSession.commands.flee();

    setup = gameWith(card);
    restore(setup.game, setup.uid, { hp: 12 }, {}, { hand: [], discard: [setup.uid] });
    expect(preview(setup.uid)).toMatchObject({ legal: false, damage: null, reasons: ['这张牌已不在当前手牌中'] });
    BattleSession.commands.flee();

    const selfCard = { ...card, id: 'preview-self-card', desc: '获得 2 点护甲。', dmg: 0, dmgType: null };
    setup = gameWith(selfCard);
    restore(setup.game, setup.uid, { hp: 12 });
    expect(preview(setup.uid)).toMatchObject({ legal: false, damage: null, reasons: ['这张牌不能指定敌人'] });
    BattleSession.commands.flee();
  });

  it('同 UID 卡进入真实 TARGETING 后仍可预览并选目标结算', async () => {
    const card = Cards.all().find(entry => entry.id === 'starter-attack');
    const { game, uid } = gameWith(card, { atk: 5 });
    const foe = index => ({ id: `target-${index}`, name: `目标${index}`, hp: 12, maxHp: 12, atk: 1,
      dead: false, status: {}, defense: { shield: 0, armor: 0, guard: false } });
    restore(game, uid, foe(0), {}, { foes: [foe(0), foe(1)] });

    BattleSession.commands.playCard(uid);
    const targeting = BattleSession.getSnapshot();
    expect(targeting.phase).toBe('targeting');
    expect(targeting.pendingTarget?.uid).toBe(uid);
    const result = preview(uid, 1);
    expect(result).toMatchObject({ legal: true, confidence: 'exact' });

    BattleSession.commands.playCard(uid, 1);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(12);
    expect(actual.foes[1].hp).toBe(result.damage.hpAfter);
    BattleSession.commands.flee();
  });

  it('暗1即使初始未过半也降级，避免多段中途跨阈值伪精确', () => {
    const card = Cards.all().find(entry => entry.id === 'tt3-double-shot');
    const { game, uid } = gameWith(card);
    restore(game, uid, { hp: 7, maxHp: 10 });
    const snapshot = BattleSession.getSnapshot();
    const context = { ...viewApi.getPreviewContext(uid, 0), modifiers: { nestDark1: true } };
    const result = previewAction({ snapshot, action: { kind: 'play-card', uid, targetIndex: 0 }, cardContext: context });
    expect(result).toMatchObject({ confidence: 'unknown', damage: null, reasons: ['黑暗羁绊会逐段改变伤害'] });
    BattleSession.commands.flee();
  });

  it('初始攻击存在杀变身时降级，不按原卡宣称 exact', () => {
    const card = Cards.all().find(entry => entry.id === 'starter-attack');
    const { game, uid } = gameWith(card);
    restore(game, uid, { hp: 12 }, {}, { shaTransform: '火球术' });
    expect(preview(uid)).toMatchObject({ confidence: 'unknown', damage: null, reasons: ['这张初始攻击将变为另一张牌结算'] });
    BattleSession.commands.flee();
  });

  it.each([
    ['护甲', {}, { shield: 0, armor: 2, guard: false }],
    ['护盾', {}, { shield: 2, armor: 0, guard: false }],
    ['格挡', {}, { shield: 0, armor: 0, guard: true }],
    ['减伤', { reduce: 2 }, { shield: 0, armor: 0, guard: false }],
    ['破甲', { abreak: 1 }, { shield: 9, armor: 9, guard: true }],
    ['免疫', { immune: 1 }, { shield: 0, armor: 0, guard: false }],
    ['潜行', { stealth: 1 }, { shield: 0, armor: 0, guard: false }],
    ['闪避', { dodge: 1 }, { shield: 0, armor: 0, guard: false }],
  ])('防御矩阵：%s 的 exact 结果与真实结算一致', async (_label, status, defense) => {
    const card = Cards.all().find(entry => entry.id === 'starter-attack');
    const { game, uid } = gameWith(card, { atk: 5 });
    restore(game, uid, { hp: 20, status, defense });
    const result = preview(uid);
    expect(result.confidence).toBe('exact');
    BattleSession.commands.playCard(uid, 0);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
    expect(actual.foes[0].defense.shield).toBe(result.damage.shieldAfter);
    expect(actual.foes[0].defense.armor).toBe(result.damage.armorAfter);
    expect(actual.foes[0].status.dodge).toBe(result.damage.dodgeAfter);
    BattleSession.commands.flee();
  });

  it('连续 100 次调用不改输入、战斗快照或 RNG', () => {
    const card = Cards.all().find(entry => entry.id === 'tt3-chain-lightning');
    const { game, uid } = gameWith(card, { spellPower: 1 });
    restore(game, uid, { hp: 30, defense: { shield: 2, armor: 1, guard: false } });
    const snapshotBefore = BattleSession.getSnapshot();
    const context = viewApi.getPreviewContext(uid, 0);
    const rngBefore = Random.snapshot();
    const first = previewAction({ snapshot: snapshotBefore, action: { kind: 'play-card', uid, targetIndex: 0 }, cardContext: context });
    for (let i = 0; i < 100; i++) {
      expect(previewAction({ snapshot: snapshotBefore, action: { kind: 'play-card', uid, targetIndex: 0 }, cardContext: context })).toEqual(first);
    }
    expect(BattleSession.getSnapshot()).toEqual(snapshotBefore);
    expect(Random.snapshot()).toEqual(rngBefore);
    BattleSession.commands.playCard(uid, 0);
    return settle().then(actual => {
      expect(actual.foes[0].hp).toBe(first.damage.hpAfter);
      expect(actual.foes[0].defense.shield).toBe(first.damage.shieldAfter);
      expect(actual.foes[0].defense.armor).toBe(first.damage.armorAfter);
      BattleSession.commands.flee();
    });
  });
});
