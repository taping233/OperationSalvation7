/* BOSS 编组：开战装备勾选制 + 编组门槛（2026-09-10 留言 #34/#35）。
 * 覆盖：开战装备单列且默认不勾选（混沌之眼不再"没选也生效"）；
 * 勾选混沌之眼后牌库上限 +5、开战被动生效；可编卡不足时按实际可编数放行。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 3, starterSha: 0, battleStartDraw: 2, battleTurnDraw: 2, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const { BattleSession } = await import('../game/src/battle.core.js');

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
const foeDef = () => ({ id: 'infantry', name: '编组靶子', hp: 99999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();
async function drain(maxLoops = 200) {
  for (let i = 0; i < maxLoops; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) return s;
  }
  return snap();
}
function fillDeck(pool, selected) {
  const need = Math.min(snap().deckSelection.need, snap().deckSelection.cards.length);
  while (snap().deckSelection && snap().deckSelection.selected.length < need) {
    const next = snap().deckSelection.cards.find(c => !snap().deckSelection.selected.includes(c.uid));
    if (!next) break;
    BattleSession.commands.selectDeckCard(next.uid);
    selected.push(next.uid);
  }
}
const eye = () => C.all().find(c => c.id === 'tt3-chaos-eye' && /对战开始时/.test(String(c.desc || '')));
const filler = () => C.all().find(c => c.name === '初始化斩击' && c.type === '武术')
  || C.all().find(c => c.type === '武术' && !c.unrandom && c.rarity !== '初始' && c.rarity !== '职业');

describe('BOSS 编组 · 开战装备勾选（2026-09-10 #35）', () => {
  it('开战装备单列且默认不勾选：混沌之眼未勾选时不生效、牌库上限不加成', async () => {
    const e = eye();
    expect(e, '卡库里应存在带「对战开始时」的混沌之眼').toBeTruthy();
    const f = filler();
    const g = makeGame([e, f, f].filter(Boolean));
    BattleSession.start(g, [foeDef()], { isBoss: true, name: '勾选测试' });
    const ds = snap().deckSelection;
    expect(ds).toBeTruthy();
    expect(ds.equips.map(x => x.card.id)).toContain('tt3-chaos-eye');
    expect(ds.equipsSelected).toHaveLength(0);            // 默认全不勾——玩家自己决定
    expect(ds.max).toBe(3);                                // 未勾混沌之眼：无 +5 加成
    fillDeck(ds.cards, []);
    BattleSession.commands.confirmDeck();
    await drain();
    expect(snap().deckSelection).toBeFalsy();              // 已开战
    expect(g.logs.some(l => l.includes('开战被动'))).toBe(false);   // 未勾选 → 不装配
    expect(g.logs.some(l => l.includes('混沌之眼'))).toBe(false);
    BattleSession.commands.flee();
    await drain(20);
  });

  it('勾选混沌之眼：牌库上限 +5、开战被动在战斗开始时生效', async () => {
    const e = eye();
    const f = filler();
    const g = makeGame([e, f, f].filter(Boolean));
    BattleSession.start(g, [foeDef()], { isBoss: true, name: '勾选测试2' });
    const eyeUid = snap().deckSelection.equips.find(x => x.card.id === 'tt3-chaos-eye').uid;
    BattleSession.commands.selectDeckEquip(eyeUid);
    expect(snap().deckSelection.max).toBe(8);              // 3 + 牌库上限+5
    expect(snap().deckSelection.equipsSelected).toEqual([eyeUid]);
    fillDeck(snap().deckSelection.cards, []);
    BattleSession.commands.confirmDeck();
    await drain();
    expect(g.logs.some(l => l.includes('开战被动') && l.includes('混沌之眼'))).toBe(true);
    BattleSession.commands.flee();
    await drain(20);
  });

  it('可编卡牌不足 15 张时按实际可编数放行（2026-09-10 #34）', async () => {
    const g = makeGame([filler(), filler()]);
    BattleSession.start(g, [foeDef()], { isBoss: true, name: '不足15测试' });
    const ds = snap().deckSelection;
    expect(ds).toBeTruthy();
    fillDeck(ds.cards, []);
    expect(snap().deckSelection.selected.length).toBe(Math.min(3, ds.cards.length));
    BattleSession.commands.confirmDeck();
    await drain();
    expect(snap().deckSelection).toBeFalsy();              // 不再永久卡在编组界面
    BattleSession.commands.flee();
    await drain(20);
  });
});
