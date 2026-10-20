import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, viewApi } = await import('../game/src/battle/core/battle.core.js');
const { cardRuleHint, previewAction } = await import('../game/src/battle/view/battle.preview.js');
const { showFoePreview } = await import('../game/src/battle/view/battle.hover.js');
const { Random } = await import('../game/src/core/random.js');
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
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
async function settle(max = 200) {
  for (let i = 0; i < max; i++) {
    await tick();
    const snapshot = BattleSession.getSnapshot();
    if (!snapshot.busy && snapshot.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return BattleSession.getSnapshot();
}
function preview(uid, targetIndex = 0) {
  const snapshot = BattleSession.getSnapshot();
  return previewAction({ snapshot, action: { kind: 'play-card', uid, targetIndex }, cardContext: viewApi.getPreviewContext(uid, targetIndex) });
}

describe('R3-a 可信伤害预览', () => {
  it('只对声明结构化多段规则的卡展示确定提示，并按规则预览逐段目标', () => {
    const card = {
      id: 'ui-structured-multi-hit', name: '结构化连击', type: '武术', dmgType: 'attack', dmg: 2,
      desc: '卡面描述不参与规则推断。',
      rules: {
        triggers: { onPlay: [{ op: 'damage', hitCount: 3, retarget: 'livingFoes' }] },
        battle: { requirements: [{ kind: 'handCards', count: 2, type: '初始攻击' }] },
      },
    };
    expect(cardRuleHint(card, 'normal')).toContain('先消耗 2 张初始攻击；3 段');
    expect(cardRuleHint({ ...card, rules: undefined }, 'normal')).toBe('');
    expect(cardRuleHint({ ...card, rules: undefined }, 'normal')).toBe('');
  });
  it('视图预览不再复用 aim.snap 或命中旧气泡早退，三敌气泡宽度受单位格约束', () => {
    const viewSource = fs.readFileSync('game/src/battle/view/battle.view.js', 'utf8');
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

  it('A3 迁移后结构化 rules 是预览权威：desc 改写不降级，预览仍与真实结算一致', async () => {
    // tt2-shoot 已随 A3 迁移为结构化 onPlay——预览读 rules 而非 desc 语义指纹，
    // desc 改写（旧文案/新文案）都不影响可信度；字段改写（dmg）则数字跟随且与结算一致。
    const original = Cards.all().find(entry => entry.id === 'tt2-shoot');
    const { game, uid } = gameWith({ ...original, desc: '造成 2 点伤害，抽 1 张牌。' });
    restore(game, uid, { hp: 2 });
    const result = preview(uid);
    expect(result.confidence, 'desc 与 rules 不符时预览仍按 rules 权威给出 exact').toBe('exact');
    expect(result.damage.total).toBe(2);
    BattleSession.commands.playCard(uid, 0);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
    BattleSession.commands.flee();

    const altered = gameWith({ ...original, dmg: 3 });
    restore(altered.game, altered.uid, { hp: 2 });
    const alteredResult = preview(altered.uid);
    expect(alteredResult.confidence).toBe('exact');
    expect(alteredResult.damage.total).toBe(3);
    BattleSession.commands.flee();
  });

  it.each(['cc-mana-surge'])(
    '%s 的文本路径效果为 unknown，预览不执行效果', id => {
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

  it('普通战奥术弹按定版 hosted 执行视图预览，直接伤害与真实结算一致', async () => {
    const original = Cards.all().find(entry => entry.id === 'tt7-arcanebolt');
    expect(original.rules.battle.hosted).toEqual(['damage-and-draw']);
    const { game, uid } = gameWith({ ...original, desc: '玩家展示文本已变化', dmg: 3 }, { spellPower: 2 });
    restore(game, uid, { hp: 20 }, { spellUp: 1 });
    const context = viewApi.getPreviewContext(uid, 0);
    expect(context).toMatchObject({ mode: 'normal', hostedExecutionVerified: true });
    const result = preview(uid);
    expect(result).toMatchObject({ confidence: 'exact', cost: 0, damage: { total: 6, hpAfter: 14 } });
    expect(result.unknownEffects.join('')).toContain('后续触发未计入');
    const bubbleHost = document.createElement('div');
    showFoePreview(bubbleHost, 0, uid, original, 'click');
    expect(bubbleHost.textContent).toContain('直接伤害：6');
    expect(bubbleHost.textContent).toContain('后续触发未计入');
    BattleSession.commands.playCard(uid, 0);
    const actual = await settle();
    expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
    expect(game.logs.some(line => line.includes('获得 1 张【初始攻击】'))).toBe(true);
    BattleSession.commands.flee();
  });

  it('BOSS 抽牌后续未完整预演时奥术弹仍降级，不影响普通直接伤害', () => {
    const card = Cards.all().find(entry => entry.id === 'tt7-arcanebolt');
    const { game, uid } = gameWith(card);
    restore(game, uid, { hp: 20, isBoss: true });
    expect(preview(uid)).toMatchObject({ confidence: 'unknown', damage: null });
    BattleSession.commands.flee();
  });

  it('core 将流血增伤旗标传给预览，避免裸 Combat 伪精确', async () => {
    const card = Cards.all().find(entry => entry.id === 'starter-attack');
    const { game, uid } = gameWith(card);
    restore(game, uid, { hp: 20, status: { bleed: 2 } }, { bleedAmp: 1 });
    expect(viewApi.getPreviewContext(uid, 0).modifiers.bleedAmp).toBe(true);
    expect(preview(uid)).toMatchObject({ confidence: 'unknown', damage: null });
    BattleSession.commands.playCard(uid, 0);
    expect((await settle()).foes[0].hp).toBe(12);
    BattleSession.commands.flee();
  });

  it('穿戴合法冰冻增伤装备后由 core 降级；实际 hitFoe 仍按原规则增伤', async () => {
    const attack = Cards.all().find(entry => entry.id === 'starter-attack');
    const equipment = { id: 'preview-frost-equipment', name: '冰冻增伤测试装备', type: '装备', cost: 0, dmg: 0,
      rules: { version: 1, equip: { onEquip: [], passive: { cond: { vsFreeze: 2 } } } } };
    const { game, uid } = gameWith(attack);
    game.ownedCards.push({ uid: 'preview-equipment', card: equipment });
    restore(game, uid, { hp: 20, status: { freeze: 1 } }, {}, { hand: [uid, 'preview-equipment'] });
    BattleSession.commands.playCard('preview-equipment', 'self');
    await settle();
    expect(viewApi.getPreviewContext(uid, 0).modifiers.vsFreezeBonus).toBe(true);
    expect(preview(uid)).toMatchObject({ confidence: 'unknown', damage: null });
    BattleSession.commands.playCard(uid, 0);
    expect((await settle()).foes[0].hp).toBe(14);
    BattleSession.commands.flee();
  });

  it('后续可转向目标带流血增伤时也降级，不只检查当前选中目标', () => {
    const card = Cards.all().find(entry => entry.id === 'tt7-meteorrain');
    const { game, uid } = gameWith(card);
    const foe = (hp, bleed = 0) => ({ id: 'target', name: '目标', hp, maxHp: hp, atk: 1,
      dead: false, status: { bleed }, defense: { shield: 0, armor: 0, guard: false } });
    restore(game, uid, { hp: 1 }, { bleedAmp: 1 }, { foes: [foe(1), foe(20, 2)] });
    expect(viewApi.getPreviewContext(uid, 0).modifiers.bleedAmp).toBe(true);
    expect(preview(uid)).toMatchObject({ confidence: 'unknown', damage: null });
    BattleSession.commands.flee();
  });

  it('奥术弹全灭后停止抽牌；预览说明不承诺一定获得后续卡牌', async () => {
    const card = Cards.all().find(entry => entry.id === 'tt7-arcanebolt');
    const { game, uid } = gameWith(card);
    restore(game, uid, { hp: 1 });
    const result = preview(uid);
    expect(result).toMatchObject({ confidence: 'exact', damage: { total: 1, lethal: true } });
    expect(result.unknownEffects.join('')).toContain('敌人全灭时停止余下效果');
    BattleSession.commands.playCard(uid, 0);
    await settle();
    expect(game.logs.some(line => line.includes('获得 1 张【初始攻击】'))).toBe(false);
  });

  it.each(['cc-double-boom', 'tt7-whirlwind', 'cc-cursed-blade'])(
    '%s 结构化伤害：预览 exact 且数字与真实结算一致', async id => {
      const card = Cards.all().find(entry => entry.id === id);
      expect(card).toBeTruthy();
      const { game, uid } = gameWith(card);
      restore(game, uid, { hp: 12 });
      const result = preview(uid);
      expect(result.confidence, '纯 amountField AOE 无条件分支 → exact').toBe('exact');
      expect(result.damage.total, 'attack 类按 atk+dmg、spell 类按 dmg——数字由结算对照兜底').toBeGreaterThan(0);
      BattleSession.commands.playCard(uid, 0);
      const actual = await settle();
      expect(actual.foes[0].hp).toBe(result.damage.hpAfter);
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

    const selfCard = { ...card, id: 'preview-self-card', desc: '获得 2 点护甲。', dmg: 0, dmgType: null,
      rules: { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onPlay: [{ op: 'armor', amount: 2 }] } } };
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
    expect(preview(uid)).toMatchObject({ confidence: 'unknown', damage: null, reasons: ['变形卡按当前效果结算，预览无法精算'] });
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

it('孢子城墙按有效卡的结构化声明展示中毒与护甲，不虚构直接伤害', () => {
  const card = Cards.all().find(entry => entry.id === 'tt12-sporewall');
  expect(card).toBeTruthy();
  const { game, uid } = gameWith(card);
  expect(restore(game, uid, { hp: 20 })).toBe(true);
  const before = BattleSession.getSnapshot();
  const result = preview(uid);
  expect(result).toMatchObject({ confidence: 'unknown', damage: null, reasons: [],
    knownEffects: ['目标附加 2 层中毒', '自己获得 6 点护甲'] });
  const el = document.createElement('div'); el.className = 'bt-foe'; document.body.append(el);
  showFoePreview(el, 0, uid, card, 'click');
  expect(el.textContent).toContain('卡牌效果');
  expect(el.textContent).not.toContain('无法精算');
  expect(BattleSession.getSnapshot().foes).toEqual(before.foes);
  el.remove();
});
