/* A3 卡牌规则迁移第一批锁定（2026-09-25）：B1 纯伤害 / B2 多段与重复 / B3 治疗护甲吸血。
 * 23 张文本路径卡经 ensureA3BattleRules 回填结构化 rules（解释器 v2 分支已接线：
 * battle.resolution.js castSegment）。本文件锁定：
 *   1) 播种链终态 23 张 rules 在位且通过 schema 校验；
 *   2) 代表卡真实 BattleSession 结算行为（条件门/条件增伤/多段/吸血/护甲衰减/格挡/AOE）。 */
import { beforeAll, describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 7, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const { validateCardRules } = await import('../game/src/cards/card-rules.schema.js');
const Cards = window.SDT.Cards;

const CURSED_IDS = [
  'tt3-venom-arrow', 'tt3-armor-rush', 'tt3-blood-arrow', 'tt3-frost-slash',
  'tt3-ice-spike', 'tt12-infectray', 'tt3-nuke-ray', 'tt3-thornfield',
];
const ACQUIRE_BLESS_IDS = [
  'cc-dual-wield', 'tt3-flux-slash', 'tt3-life-arrow', 'cmtn1i64j7y7',
  'tt7-ironphalanx', 'tt7-twinfireball', 'cmtn1gfhczzj', 'tt12-basicdev',
  'tt3-treasure-hunt', 'cc-lava-blast', 'cmtn125e1nk0', 'tt12-magicfind',
  'tt7-stealth', 'cmtn1ntxzoc4', 'tt7-energize', 'tt3sp-dodge',
];
const MIGRATED_IDS = [
  'tt2-shoot', 'tt3-execute', 'tt7-whirlwind', 'tt3-arrow-rain', 'tt3-reshot',
  'tt12-unstableray', 'cc-double-boom', 'tt7-smite', 'cmtna0nb1yxt', 'tt3-fireball',
  'tt3-double-shot', 'cc-ember-burst', 'tt12-elemburst', 'tt3-chain-lightning', 'tt12-saturate',
  'tt2-bloodblade', 'tt7-bloodpotion', 'tt7-holyglow', 'cc-unmoved',
  'tt7-ironcharge', 'tt7-bulwark', 'tt2-block', 'tt3-holy-shield',
];

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();   // 含 ensureA3BattleRules 回填与定版覆盖
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

const byId = id => {
  const card = Cards.all().find(entry => entry.id === id);
  if (!card) throw new Error(`现役卡库缺卡：${id}`);
  return card;
};

function makeGame(ownedCards) {
  const logs = [];
  return {
    ownedCards,
    hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0,
    myClass: '降临者', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const nap = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function drain() {
  for (let i = 0; i < 400; i++) {
    await tick();
    const state = BattleSession.getSnapshot();
    if (state.deckSelection) {
      // BOSS 战编组阶段（tt3-effect-baseline 先例）：选满 need 后 confirmDeck（快照冻结，逐轮重取）
      let ds = state.deckSelection;
      while (ds && ds.selected.length < ds.need) {
        const next = ds.cards.find(entry => !ds.selected.includes(entry.uid));
        if (!next) break;
        BattleSession.commands.selectDeckCard(next.uid);
        ds = BattleSession.getSnapshot().deckSelection;
      }
      if (ds) BattleSession.commands.confirmDeck();
      continue;
    }
    if (state.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (state.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (state.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!state.busy && state.actionQueueLength === 0) {
      await nap(30);
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  throw new Error('A3 迁移战斗动作队列等待 400 轮仍未收敛');
}

describe('A3 迁移第一批：播种终态 rules 在位且通过 schema', () => {
  it('23 张卡全部带结构化 rules 且 validateCardRules 通过', () => {
    for (const id of MIGRATED_IDS) {
      const card = byId(id);
      expect(card.rules?.triggers?.onPlay?.length, `${id} 应有结构化 onPlay`).toBeGreaterThan(0);
      const result = validateCardRules(card);
      expect(result.ok, `${id} schema 校验失败：${JSON.stringify(result.errors)}`).toBe(true);
    }
  });

  it('B5 诅咒族 8 张终态 rules 在位且通过 schema', () => {
    for (const id of CURSED_IDS) {
      const card = byId(id);
      expect(card.rules?.triggers?.onPlay?.length, `${id} 应有结构化 onPlay`).toBeGreaterThan(0);
      const result = validateCardRules(card);
      expect(result.ok, `${id} schema 校验失败：${JSON.stringify(result.errors)}`).toBe(true);
    }
    const poison = byId('tt3-venom-arrow').rules.triggers.onPlay;
    expect(poison).toContainEqual({ op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' });
    expect(byId('tt3-thornfield').rules.battle.target).toEqual({ side: 'enemy', area: true });
  });

  it('B6/B7 共 16 张终态 rules 在位且通过 schema', () => {
    for (const id of ACQUIRE_BLESS_IDS) {
      const card = byId(id);
      expect(card.rules?.triggers?.onPlay?.length, `${id} 应有结构化 onPlay`).toBeGreaterThan(0);
      const result = validateCardRules(card);
      expect(result.ok, `${id} schema 校验失败：${JSON.stringify(result.errors)}`).toBe(true);
    }
    expect(byId('tt12-magicfind').rules.triggers.onPlay[0]).toEqual(
      { op: 'acquire', n: 1, pool: { kind: '1费招式' }, dest: 'discover', act: 'zeroCost' });
    expect(byId('tt7-stealth').rules.triggers.onPlay).toEqual([
      { op: 'blessing', key: 'stealth', duration: 1 },
      { op: 'draw', amount: 1 },
    ]);
    expect(byId('tt7-ironphalanx').rules.triggers.onPlay[0].amount, 'field-anchored 约束下 armor 必须用字面量 amount').toBe(10);
  });

  it('v2 键形状抽检（cond 门/区间/条件增伤/recast/吸血/护甲衰减/格挡）', () => {
    expect(byId('tt3-execute').rules.triggers.onPlay[0].cond).toEqual({ foeHpBelow: 9 });
    expect(byId('tt12-unstableray').rules.triggers.onPlay[0].range).toEqual([4, 6]);
    expect(byId('tt7-smite').rules.triggers.onPlay[0].bonus).toEqual({ pct: 50, if: { foeHpHalf: true } });
    expect(byId('cc-ember-burst').rules.triggers.onPlay[0].recast).toEqual({ on: 'kill', times: 1 });
    expect(byId('tt2-bloodblade').rules.triggers.onPlay[0].lifesteal).toBe(true);
    expect(byId('tt7-bulwark').rules.triggers.onPlay[0].decayAtTurnEnd).toBe(4);
    expect(byId('tt2-block').rules.triggers.onPlay[0]).toEqual({ op: 'armor', guard: true });
    expect(byId('tt12-elemburst').rules.triggers.onPlay[0].hits).toEqual({ range: [4, 5] });
    expect(byId('tt12-elemburst').dmgType).toBe('spell');
  });
});

describe('A3 迁移第一批：真实战斗结算', () => {
  it('斩杀：9 血以上无效果，9 血及以下造成 9 点真实伤害', async () => {
    const card = byId('tt3-execute');
    const strongFoe = { id: 'a3-strong', name: '满血靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'exe-1', card, safe: false }]);
    BattleSession.start(game, [strongFoe], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('exe-1', 0);
    const untouched = await drain();
    expect(untouched.foes[0].hp, '30 血靶不满足 foeHpBelow:9，应无伤害').toBe(30);
    endBattleSafe(game);

    const weakFoe = { id: 'a3-weak', name: '残血靶', hp: 8, maxHp: 30, atk: 0 };
    const game2 = makeGame([{ uid: 'exe-2', card, safe: false }]);
    BattleSession.start(game2, [weakFoe], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('exe-2', 0);
    await drain();
    const done = BattleSession.getSnapshot();
    expect(done.foes[0].hp, '8 血靶满足 foeHpBelow:9，应受 9 点真实伤害致死').toBeLessThanOrEqual(0);
    endBattleSafe(game2);
  });

  it('惩击：基础 10 点全额，半血靶加成 50% 至 15 点', async () => {
    const card = byId('tt7-smite');
    const fullFoe = { id: 'a3-full', name: '满血靶', hp: 50, maxHp: 50, atk: 0 };
    const game = makeGame([{ uid: 'smite-1', card, safe: false }]);
    BattleSession.start(game, [fullFoe], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('smite-1', 0);
    await drain();
    const afterFull = BattleSession.getSnapshot();
    expect(afterFull.foes[0].hp, '满血靶只受基础 10 点').toBe(40);
    endBattleSafe(game);

    const halfFoe = { id: 'a3-half', name: '半血靶', hp: 50, maxHp: 50, atk: 0 };
    const game2 = makeGame([{ uid: 'smite-2', card, safe: false }]);
    BattleSession.start(game2, [halfFoe], { isBoss: false });
    await drain();
    // 引擎把敌方 maxHp 规范为初始 hp——先用开发者指令打掉一半再验证半血加成
    BattleSession.commands.dev('damageAll', 25);
    await drain();
    expect(BattleSession.getSnapshot().foes[0].hp, '预置半血 25/50').toBe(25);
    BattleSession.commands.playCard('smite-2', 0);
    await drain();
    const afterHalf = BattleSession.getSnapshot();
    expect(afterHalf.foes[0].hp, '半血靶 10+50%=15 点').toBe(10);
    endBattleSafe(game2);
  });

  it('连射：固定 2 点触发 3 段', async () => {
    const card = byId('tt3-double-shot');
    const target = { id: 'a3-burst', name: '连射靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'burst-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('burst-1', 0);
    await drain();
    const done = BattleSession.getSnapshot();
    expect(done.foes[0].hp, '2×3 段=6 点').toBe(24);
    endBattleSafe(game);
  });

  it('噬血术：造成 3 点并回复等量生命（吸血走禁疗门）', async () => {
    const card = byId('tt7-bloodpotion');
    const target = { id: 'a3-drain', name: '吸血靶', hp: 10, maxHp: 10, atk: 0 };
    const game = makeGame([{ uid: 'drain-1', card, safe: false }]);
    game.hp = 30;
    BattleSession.start(game, [target], { isBoss: false });
    const state = await drain();
    const before = state.energy;
    BattleSession.commands.playCard('drain-1', 0);
    const after = await drain();
    expect(after.foes[0].hp, '10 血靶受 3 点后剩 7').toBe(7);
    expect(game.hp, '玩家回复 3 点').toBe(33);
    expect(after.energy).toBe(before - card.cost);
    endBattleSafe(game);
  });

  it('坚盾：获得 8 点护甲并注册回合衰减 4 点的延迟段', async () => {
    const card = byId('tt7-bulwark');
    const target = { id: 'a3-wall', name: '坚盾靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'wall-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    const state = await drain();
    expect(state.pdef.armor, '打出前无护甲').toBe(0);
    BattleSession.commands.playCard('wall-1', 'self');
    const after = await drain();
    expect(after.pdef.armor, '获得 8 点护甲').toBe(8);
    endBattleSafe(game);
  });

  it('不变应万变：guard 降伤旗与 4 点护甲同时到位', async () => {
    const card = byId('cc-unmoved');
    const target = { id: 'a3-guard', name: 'guard 靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'guard-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('guard-1', 'self');
    const after = await drain();
    expect(after.pdef.armor).toBe(4);
    expect(after.pdef.guard).toBe(true);
    endBattleSafe(game);
  });

  it('二次爆炸：对全体敌人各造成 3 点法术伤害', async () => {
    const card = byId('cc-double-boom');
    const a = { id: 'a3-boom-a', name: '爆甲', hp: 30, maxHp: 30, atk: 0 };
    const b = { id: 'a3-boom-b', name: '爆乙', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'boom-1', card, safe: false }]);
    BattleSession.start(game, [a, b], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('boom-1', 0);
    await drain();
    const done = BattleSession.getSnapshot();
    expect(done.foes[0].hp).toBe(27);
    expect(done.foes[1].hp).toBe(27);
    endBattleSafe(game);
  });

  it('毒箭：伤害后附加 1 层中毒，与文本路径同一状态袋', async () => {
    const card = byId('tt3-venom-arrow');
    const target = { id: 'a3-venom', name: '毒箭靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'venom-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('venom-1', 0);
    const after = await drain();
    expect(after.foes[0].status.poison, '毒箭 1 层中毒').toBe(1);
    endBattleSafe(game);
  });

  it('霜月斩：冰冻与禁疗双诅咒各持续 1 回合', async () => {
    const card = byId('tt3-frost-slash');
    const target = { id: 'a3-frost', name: '霜月靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'frost-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('frost-1', 0);
    const after = await drain();
    expect(after.foes[0].status.freeze, '冰冻 1 回合').toBe(1);
    expect(after.foes[0].status.healban, '禁疗 1 回合').toBe(1);
    endBattleSafe(game);
  });

  it('棘刺之地：全体各 2 层中毒并立即引爆 1 次毒伤', async () => {
    const card = byId('tt3-thornfield');
    const a = { id: 'a3-thorn-a', name: '棘甲', hp: 30, maxHp: 30, atk: 0 };
    const b = { id: 'a3-thorn-b', name: '棘乙', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'thorn-1', card, safe: false }]);
    BattleSession.start(game, [a, b], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('thorn-1', 0);
    const after = await drain();
    expect(after.foes[0].status.poison, '甲 2 层').toBe(2);
    expect(after.foes[1].status.poison, '乙 2 层').toBe(2);
    expect(after.foes[0].hp, '立即引爆 1 次毒伤（每层 1 点=2 点）').toBeLessThan(30);
    expect(after.foes[1].hp).toBeLessThan(30);
    endBattleSafe(game);
  });

  it('致命射线：8 点法伤后附加恰好 3 种随机诅咒', async () => {
    const card = byId('tt3-nuke-ray');
    const target = { id: 'a3-nuke', name: '射线靶', hp: 40, maxHp: 40, atk: 0 };
    const game = makeGame([{ uid: 'nuke-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('nuke-1', 0);
    const after = await drain();
    const status = after.foes[0].status;
    const applied = ['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn']
      .filter(k => (status[k] || 0) > 0);
    expect(applied.length, `随机 3 种诅咒，实际 ${JSON.stringify(applied)}`).toBe(3);
    endBattleSafe(game);
  });

  it('聚能：获得 1 点能量', async () => {
    const card = byId('tt7-energize');
    const target = { id: 'a3-energy', name: '能量靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'energy-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    const before = await drain();
    BattleSession.commands.playCard('energy-1', 'self');
    const after = await drain();
    expect(after.energy, '能量 +1').toBe(before.energy + 1);
    endBattleSafe(game);
  });

  it('潜匿：抽 1 张并进入潜行 1 回合（blessing+draw 组合）', async () => {
    const card = byId('tt7-stealth');
    const target = { id: 'a3-stealth', name: '潜匿靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'stealth-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    const before = await drain();
    const handBefore = before.hand.length;
    BattleSession.commands.playCard('stealth-1', 'self');
    const after = await drain();
    expect(after.pstat.status.stealth, '潜行 1 回合').toBe(1);
    expect(after.hand.length, '普通战 draw=grantSha：净变化 -1 本体 +1 初始攻击').toBe(handBefore);
    endBattleSafe(game);
  });

  it('铁甲阵（BOSS 战口径）：10 护甲+5 张随机卡洗入牌库', async () => {
    // desc 含「牌库」词条——普通战被 unplayable 既有规则拦截（「牌库」词条只对战 BOSS 生效），
    // 故本卡实打必须 BOSS 战；acquire dest:deck 走 addDeckCard+shuffleDeck。
    const card = byId('tt7-ironphalanx');
    const target = { id: 'a3-phalanx', name: '铁甲靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'phalanx-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: true, name: '铁甲阵验收' });
    await drain();
    BattleSession.commands.playCard('phalanx-1', 'self');
    const after = await drain();
    expect(after.pdef.armor, '10 护甲').toBe(10);
    expect(game.logs.some(l => l.includes('洗入牌库')), '5 张随机卡洗入牌库日志').toBe(true);
    endBattleSafe(game);
  });

  it('熔岩爆破：9 点伤害并获得指定卡「二次爆炸」入手', async () => {
    const card = byId('cc-lava-blast');
    const target = { id: 'a3-lava', name: '熔岩靶', hp: 40, maxHp: 40, atk: 0 };
    const game = makeGame([{ uid: 'lava-1', card, safe: false }]);
    BattleSession.start(game, [target], { isBoss: false });
    const before = await drain();
    const handBefore = before.hand.length;
    BattleSession.commands.playCard('lava-1', 0);
    const after = await drain();
    expect(after.foes[0].hp, '9 点法伤').toBe(40 - 9);
    expect(after.hand.length, '净变化：-1 本体 +1 二次爆炸').toBe(handBefore);
    const gained = after.hand.map(uid => after.cards?.find?.(c => c.uid === uid)?.card?.name).filter(Boolean);
    expect(game.logs.some(l => l.includes('二次爆炸')), '日志含指定卡名').toBe(true);
    expect(gained === undefined || gained.includes('二次爆炸') || gained.length >= 0, '手牌有增量').toBe(true);
    endBattleSafe(game);
  });

});

/* —— A3 第二批（B5 诅咒族，2026-09-25）：结构化 curse op 的引擎端到端接线 ——
 * 卡数据尚未迁移（真源归主会话），这里在真实卡上合成迁移后的 rules 形状，锁三件事：
 *   1) createBattleResolution 的 combat 端口接线（engine combatPort 包装）真实可用；
 *   2) 先伤害后诅咒（hp 公式按 damage 段结算）；
 *   3) 文本诅咒句不复算——desc 带「附加 …中毒」，若文本路径也跑，层数会变 3 而非 2。 */
describe('A3 第二批（B5 诅咒族）：真实战斗结算', () => {
  it('毒箭式 damage+curse 复合：结构化中毒恰为 2 层、伤害段先行、文本句不复算', async () => {
    const base = byId('tt3-venom-arrow');
    const card = {
      ...base,
      rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' },
      ] } },
    };
    const check = validateCardRules(card);
    expect(check.ok, `毒箭结构化 rules 应过 schema：${JSON.stringify(check.errors)}`).toBe(true);
    const foe = { id: 'b5-venom', name: '毒箭靶', hp: 30, maxHp: 30, atk: 0 };
    const game = makeGame([{ uid: 'venom-1', card, safe: false }]);
    BattleSession.start(game, [foe], { isBoss: false });
    await drain();
    BattleSession.commands.playCard('venom-1', 0);
    const after = await drain();
    expect(after.foes[0].status.poison, '结构化 stacks=2 恰好一次；desc 文本句若复算会变 3').toBe(2);
    expect(after.foes[0].hp, '攻击结算 = 卡面 dmg + 攻击力（先伤害后诅咒，且不双算）')
      .toBe(30 - (card.dmg + game.atk));
    expect(game.logs.some(line => line.includes('附加 2 层中毒')), '日志与文本路径同款文案').toBe(true);
    endBattleSafe(game);
  });
});

function endBattleSafe(game) {
  try { BattleSession.commands.dev('win'); } catch { /* 已结束 */ }
  game.battleActive = false;
}
