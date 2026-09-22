/* 2026-09-17 留言落实批次回归（提取自桌面端留言墙未落实项）：
 * - 「神秘召唤卡池错误」：「发现一张传说或能力卡」的名词被后缀匹配截成「传说或」，
 *   复合池正则失配后回落通用池——现已兼容「传说或/传说或能力/传说或能力卡」收尾；
 * - 「血毒双镖应该能选择两次目标」：首段（攻+1 附加流血）随出牌目标结算，
 *   二段（攻+1 附加中毒）进入点选（resolveDart），可另选或重复选择同一目标；
 * - 「法力奔涌应当慢动作打出4张卡牌」：每发产出 surge 演出事件（vitest 下节拍为 0 不拖慢测试）；
 * - 卡牌定版：火球改衍生、自然法杖/灵符改稀有、灭魔之剑退役、装备「主动技能」措辞兼容。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession } = await import('../game/src/battle.core.js');
const { viewApi } = await import('../game/src/battle.core.js');
const { parsePoolNoun } = await import('../game/src/effect-steps.js');
const { splitEffectClauses } = await import('../game/src/battle.effects.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

let uidSeq = 0;
function makeGame(cards) {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
  };
  return g;
}
const foeDef = () => ({ id: 'infantry', name: '靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();
async function drain(maxLoops = 300, pickUid = null) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) {
      if (pickUid && s.hand.includes(pickUid)) BattleSession.commands.pickHandSelect(pickUid);
      else BattleSession.commands.skipHandSelect();
      continue;
    }
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return snap();
}

describe('神秘召唤卡池（2026-09-16 留言「神秘召唤卡池错误」）', () => {
  it('「传说或」收尾名词解析为复合池：传说稀有度或能力卡', () => {
    const pred = parsePoolNoun('传说或', '侠客');
    expect(pred, '此前返回 null 回落通用池，应返回复合池谓词').toBeTypeOf('function');
    expect(pred({ name: 'A', rarity: '传说', type: '武术' })).toBe(true);
    expect(pred({ name: 'B', rarity: '职业', type: '能力卡' })).toBe(true);
    expect(pred({ name: 'C', rarity: '古朴', type: '武术' })).toBe(false);
  });

  it('实打：发现面板的三张全部满足「传说或能力卡」', async () => {
    const mystic = C.all().find(c => c.name === '神秘召唤');
    expect(mystic).toBeTruthy();
    const g = makeGame([mystic]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '神秘召唤测试' });
    await drain();
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'any');
    for (let i = 0; i < 60 && !snap().discovering; i++) await tick();
    const d = snap().discovering;
    expect(d, '应弹出发现面板').toBeTruthy();
    expect(d.options.length).toBeGreaterThan(0);
    for (const o of d.options) {
      const c = o.card || o;
      expect(c.rarity === '传说' || c.type === '能力卡',
        `发现选项【${c.name}】(${c.rarity}/${c.type}) 不在传说或能力卡池`).toBe(true);
    }
    BattleSession.commands.pickDiscover(0);
    await drain(300);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('血毒双镖两次目标（2026-09-16 留言）', () => {
  it('首段打选牌目标并附流血，二段点选另一目标并附中毒', async () => {
    const bp = C.all().find(c => c.id === 'tt7-bloodpoison');
    expect(bp).toBeTruthy();
    const g = makeGame([bp]);
    BattleSession.start(g, [foeDef(), foeDef()], { isBoss: false, name: '双镖测试' });
    await drain();
    expect(snap().foes.length).toBe(2);
    BattleSession.commands.playCard(g.ownedCards[0].uid, '0');
    const s1 = await drain(300);
    expect(s1.dartPending, '结算后应进入二段点选').toBe(true);
    BattleSession.commands.resolveDart('1');
    const s2 = await drain(50);
    expect(s2.dartPending).toBe(false);
    expect((s2.foes[0].status.bleed || 0), '首段应给 0 号附流血').toBeGreaterThan(0);
    expect((s2.foes[1].status.poison || 0), '二段应给 1 号附中毒').toBeGreaterThan(0);
    expect(g.logs.some(l => l.includes('第二镖'))).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });

  it('二段可以重复选择同一目标', async () => {
    const bp = C.all().find(c => c.id === 'tt7-bloodpoison');
    const g = makeGame([bp]);
    BattleSession.start(g, [foeDef(), foeDef()], { isBoss: false, name: '双镖同目标' });
    await drain();
    BattleSession.commands.playCard(g.ownedCards[0].uid, '0');
    const s1 = await drain(300);
    expect(s1.dartPending).toBe(true);
    BattleSession.commands.resolveDart('0');
    const s2 = await drain(50);
    expect((s2.foes[0].status.bleed || 0)).toBeGreaterThan(0);
    expect((s2.foes[0].status.poison || 0), '同一目标应同时带流血与中毒').toBeGreaterThan(0);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('法力奔涌慢动作（2026-09-16 留言）', () => {
  it('4 发各产出一条 surge 演出事件，日志逐发播报', async () => {
    const sg = C.all().find(c => c.id === 'cc-mana-surge');
    expect(sg).toBeTruthy();
    const g = makeGame([sg]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '奔涌演出测试' });
    await drain();
    BattleSession.commands.playCard(g.ownedCards[0].uid, 'any');
    await drain(600);
    const anims = viewApi.takeCardAnims();
    const surges = anims.filter(a => a.kind === 'surge');
    expect(surges.length, `应有 4 条 surge 事件（got ${surges.length}）`).toBe(4);
    expect(surges.map(a => a.i)).toEqual([1, 2, 3, 4]);
    expect(surges.every(a => a.card && a.card.type === '法术')).toBe(true);
    expect(g.logs.filter(l => l.includes('/4 发')).length).toBe(4);
    BattleSession.commands.flee();
    await drain(20);
  });
});

describe('卡牌定版（2026-09-16 留言）', () => {
  it('火球为衍生牌，不进随机/发现池', () => {
    const fb = C.all().find(c => c.name === '火球');
    expect(fb).toBeTruthy();
    expect(fb.rarity).toBe('衍生');
    expect(C.isRandomObtainable(fb)).toBe(false);
  });
  it('自然法杖/灵符稀有度为稀有', () => {
    expect(C.all().find(c => c.name === '自然法杖')?.rarity).toBe('稀有');
    expect(C.all().find(c => c.name === '灵符')?.rarity).toBe('稀有');
  });
  it('灭魔之剑已整卡退役', () => {
    expect(C.all().some(c => c.name === '灭魔之剑')).toBe(false);
  });
  it('员工通行证A仍在注册表（合成材料），卡牌库展示层过滤', () => {
    expect(C.all().some(c => c.id === 'tt-token-color')).toBe(true);
  });
  it('装备技能句：主动技能与旧措辞限定技能都可解析', () => {
    expect(splitEffectClauses('主动技能：抽3张牌').skill).toEqual(['抽3张牌']);
    expect(splitEffectClauses('限定技能：抽3张牌').skill).toEqual(['抽3张牌']);
  });
});
