/* 受缚之残影（tt8-hero-sealer）定版重做（2026-09-16 老板定版，v21/v22）真实战斗实打：
 * 深海封印——BOSS 编组带着时，开局把本牌与封印肢体1-4洗入牌库；5 张封印单卡无效果且
 * 无法打出（普通战无法使用能力卡 → 封印只在 BOSS 战发动）；手牌集齐 5 张 → 化为
 * 「深渊主宰·妲莉薇特」（2 费可打出）：旧日再临——抽到 6 张 / 免疫诅咒 / 能量上限+1 /
 * 法伤+1 / 可注能与必须注能的招式均视为已注能；打出时 5 张封印单卡早已消耗，
 * 并召唤 4 名无攻血封印肢体（同天国之门口径，不自动攻击、不替主人承伤）。 */
import { describe, it, expect, beforeAll } from 'vitest';
import { unplayableReasonFor } from '../game/src/battle/battle.rules.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 2, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands, viewApi } = await import('../game/src/battle/battle.core.js');

const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 含 ensureCardsSyncLive（v21/v22）
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

let uidSeq = 0;
function makeGame(cards) {
  const logs = [];
  const g = {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 99999, maxHp: 99999, atk: 5, spellPower: 2, coins: 0,
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
const foeDef = (name) => ({ id: 'infantry', name: name || '靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const nap = (ms) => new Promise(r => setTimeout(r, ms));   // 空闲确认用真实延时（根治负载 flake）
const snap = () => BattleSession.getSnapshot();

async function drain(maxLoops = 400) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) {
      await nap(30);   // 根治负载 flake：首闲≠终闲——用新鲜快照跨调度间隙再确认
      const fresh = snap();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
      continue;
    }
  }
  return snap();
}

const sealer = () => C.all().find(c => c.id === 'tt8-hero-sealer');
const sovereign = () => C.all().find(c => c.id === 'tt8-abyss-sovereign');
const LIMB_IDS = ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'];
const handNames = (s = snap()) => s.hand.map(u => { const o = viewApi.findCard(u); return o && o.card.name; });

// BOSS 编组：只带指定卡；随后推进回合直到手牌集齐 5 张封印之牌（化形）
const filler = () => C.all().find(c => c.id === 'tt2-shoot');
async function startSealBoss(cards) {
  // 真实 BOSS 牌库 ≥15 张：掺入填充直伤武术，避免「抽到 6 张」因牌库过小无法结算
  const fill = Array.from({ length: 20 }, () => C.all().find(c => c.id === 'tt2-shoot') || C.all().find(c => c.name === '射击'));
  const g = makeGame([...cards, ...fill]);
  BattleSession.start(g, [foeDef('深渊靶')], { isBoss: true, name: '破封测试' });
  await drain();
  expect(snap().deckSelection, '应进入 BOSS 编组').toBeTruthy();
  const want = cards.filter(c => c.id === 'tt8-hero-sealer' || c.id === 'tt3sp-bloodstorm').map(c => c.id);
  for (const o of g.ownedCards) {
    if (want.includes(o.card.id)) commands.selectDeckCard(o.uid);
  }

  // 补满编组空位（剩余用填充牌）
  while (snap().deckSelection && snap().deckSelection.selected.length < Math.min(snap().deckSelection.need, snap().deckSelection.cards.length)) {
    const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
    if (!next) break;
    commands.selectDeckCard(next.uid);
  }
  commands.confirmDeck();
  await drain();
  for (let turns = 0; turns < 8; turns++) {
    if (handNames().includes('深渊主宰·妲莉薇特')) return g;
    if (!g.battleActive) break;
    BattleSession.commands.endTurn();
    await drain();
  }
  return g;
}

describe('受缚之残影 → 深渊主宰·妲莉薇特', () => {
  it('入库：受缚之残影（深海封印）+ 深渊主宰·妲莉薇特（2费可打出）+ 4 张封印肢体', () => {
    const a = sealer();
    expect(a.name).toBe('受缚之残影');
    expect(a.desc).toContain('深海封印');
    expect(a.desc).toContain('无法打出');
    expect(a.hero).toBe(true);
    expect(a.cls).toBe('降临者');
    const b = sovereign();
    expect(b.name).toBe('深渊主宰·妲莉薇特');
    expect(b.cost).toBe(2);
    expect(b.desc).toContain('旧日再临');
    expect(b.desc).not.toContain('无法打出');
    LIMB_IDS.forEach((id, i) => {
      const limb = C.all().find(c => c.id === id);
      expect(limb, id).toBeTruthy();
      expect(limb.name).toBe(`封印肢体${[1, 2, 3, 4][i]}`);
      expect(limb.desc).toContain('入手时无效果');
    });
  });

  it('封印之牌全部命中「无法打出」判定；深渊主宰可打出', () => {
    expect(unplayableReasonFor(sealer(), 'boss', {})).toBeTruthy();
    LIMB_IDS.forEach(id => {
      expect(unplayableReasonFor(C.all().find(c => c.id === id), 'boss', {})).toBeTruthy();
    });
    expect(unplayableReasonFor(sovereign(), 'boss', {})).toBeFalsy();
  });

  it('普通战无法使用能力卡：受缚之残影不进手牌、封印不发动', async () => {
    const g = makeGame([sealer()]);
    BattleSession.start(g, [foeDef()], { isBoss: false, name: '普通战对照' });
    await drain();
    expect(handNames()).not.toContain('受缚之残影');
    expect(handNames()).not.toContain('深渊主宰·妲莉薇特');
    expect(g.logs.some(l => l.includes('深海封印'))).toBe(false);
    BattleSession.commands.flee();
    await drain(50);
  });

  it('BOSS 战实打：肢体洗入 → 集齐化形 → 打出深渊主宰触发旧日再临（无攻血肢体/抽到6张/能量上限+1/法伤+1）', async () => {
    const g = await startSealBoss([sealer()]);
    console.log('DEBUG 轮后手牌:', JSON.stringify(handNames()), 'battleActive:', g.battleActive, 'turn:', snap().turn);
    expect(g.logs.some(l => l.includes('沉入牌库'))).toBe(true);
    expect(g.logs.some(l => l.includes('5 张封印之牌在深海的辉光中燃尽'))).toBe(true);
    expect(handNames()).toContain('深渊主宰·妲莉薇特');
    expect(handNames()).not.toContain('受缚之残影');
    LIMB_IDS.forEach(id => {
      const limb = C.all().find(c => c.id === id);
      expect(handNames()).not.toContain(limb.name);
    });

    // 打出深渊主宰（2 费）：旧日再临
    const uid = snap().hand.find(u => { const o = viewApi.findCard(u); return o && o.card.id === 'tt8-abyss-sovereign'; });
    expect(uid, '手牌中应有深渊主宰·妲莉薇特').toBeTruthy();
    BattleSession.commands.playCard(uid, 'self');
    await drain();


    expect(g.logs.some(l => l.includes('抽了') && l.includes('张牌（手牌'))).toBe(true); // 旧日再临抽牌段已结算（测试牌库小，抽到牌库空为止）
    expect(snap().hand.length).toBeLessThanOrEqual(6);                       // 抽牌直到手牌 6 张
    expect(snap().allies.length).toBe(4);                     // 4 名封印肢体
    snap().allies.forEach(a => { expect(a.statless).toBe(true); expect(a.hp).toBeNull(); });
    expect(snap().maxEnergy).toBe(100);                       // 能量上限 +1
    expect(snap().pstat.status.spellUp || 0).toBe(1);         // 法伤 +1
    expect(g.logs.some(l => l.includes('诅咒无法侵染深渊主宰'))).toBe(true);
    expect(g.logs.some(l => l.includes('均视为已注能'))).toBe(true);
    BattleSession.commands.flee();
    await drain(50);
  });

  it('实打：破封后「招式均已注能」——血蝠风暴免注能按注能形态结算（触发 2 次）', { timeout: 60_000 }, async () => {
    const storm = C.all().find(c => c.id === 'tt3sp-bloodstorm');
    const g = await startSealBoss([sealer(), storm]);
    expect(handNames()).toContain('深渊主宰·妲莉薇特');
    const hp0 = snap().foes[0].hp;

    const sovereignUid = snap().hand.find(u => { const o = viewApi.findCard(u); return o && o.card.id === 'tt8-abyss-sovereign'; });
    expect(sovereignUid, '化形后手牌中应有深渊主宰').toBeTruthy();
    BattleSession.commands.playCard(sovereignUid, 'self');
    await drain();

    let stormUid = snap().hand.find(u => { const o = viewApi.findCard(u); return o && o.card.name === '血蝠风暴'; });
    for (let turns = 0; !stormUid && turns < 10; turns++) {
      BattleSession.commands.endTurn();
      await drain();
      stormUid = snap().hand.find(u => { const o = viewApi.findCard(u); return o && o.card.name === '血蝠风暴'; });
    }
    expect(stormUid, '手牌中应有血蝠风暴').toBeTruthy();
    const energyBefore = snap().energy;
    BattleSession.commands.playCard(stormUid, 0);   // 不选任何注能燃料直接打出
    await drain();
    expect(snap().foes[0].hp).toBe(hp0 - 12);       // (3′+法伤2+法伤1)=6 × 注能触发2次
    expect(snap().foes[0].status.poison || 0).toBe(0);
    expect(energyBefore).toBeGreaterThan(snap().energy);
  });
});
