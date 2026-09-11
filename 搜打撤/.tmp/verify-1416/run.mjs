/* 临时校验脚本（老板 #14/#15/#16 复核）：真实 battle.core 里打飞刃偷袭 / 快意恩仇，看流血与手牌代价 */
global.localStorage = {
  _m: new Map(),
  getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
  setItem(k, v) { this._m.set(k, String(v)); },
  removeItem(k) { this._m.delete(k); },
};
global.window = global;
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {} },
  MAP: {
    rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 1, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 2, diceSides: 6 },
    items: { rations: { name: '口粮' }, wood: { name: '木材' } },
  },
};
await import('../../game/src/cards.js');
const { BattleSession, viewApi } = await import('../../game/src/battle.core.js');
const { unplayableReasonFor, targetSideFor } = await import('../../game/src/battle.rules.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();

console.log('--- 卡库里同名「飞刃偷袭」的条目 ---');
C.all().filter(c => c.name === '飞刃偷袭').forEach(c => console.log(JSON.stringify(c)));
console.log('--- 「快意恩仇」 ---');
C.all().filter(c => c.name === '快意恩仇').forEach(c => console.log(JSON.stringify(c)));

let uidSeq = 0;
function makeGame(cards) {
  const logs = [];
  return {
    ownedCards: cards.map(c => ({ uid: 'g' + (uidSeq++), card: c, safe: false })),
    hp: 60, maxHp: 60, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    log(m) { logs.push(String(m).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {},
    onBattleEnd() {},
  };
}
const foeDef = () => ({ id: 'infantry', name: '靶子', hp: 9999, atk: 1 });
const tick = () => new Promise(r => setTimeout(r, 0));
const snap = () => BattleSession.getSnapshot();
async function drain(max = 300) {
  for (let i = 0; i < max; i++) {
    await tick();
    const s = snap();
    if (s.discovering) { BattleSession.commands.pickDiscover(0); continue; }
    if (s.choosing) { BattleSession.commands.pickChoice(0); continue; }
    if (s.handSelecting) { BattleSession.commands.skipHandSelect(); continue; }
    if (!s.busy && s.actionQueueLength === 0) return s;
  }
  return snap();
}

// ---------- A：飞刃偷袭（带 2 张初始攻击在手） ----------
{
  const blade = C.all().find(c => c.name === '飞刃偷袭');
  const sha = C.all().find(c => c.name === '初始攻击');
  const game = makeGame([blade, { ...sha }, { ...sha }]);
  BattleSession.start(game, [foeDef()], { isBoss: false, name: '校验' });
  await drain();
  let s = snap();
  console.log('\n=== A 飞刃偷袭 ===');
  console.log('手牌:', s.hand.map(u => game.ownedCards.find(o => o.uid === u).card.name).join(' / '));
  const uid = s.hand.find(u => game.ownedCards.find(o => o.uid === u).card.name === '飞刃偷袭');
  BattleSession.commands.playCard(uid, 0);
  s = await drain();
  console.log('敌人 status:', JSON.stringify(s.foes[0].status));
  console.log('敌人 hp:', s.foes[0].hp, ' dead:', s.foes[0].dead);
  console.log('状态角标 HTML:', viewApi.curseChips(s.foes[0].status) || '（空）');
  console.log('战斗日志:\n  ' + game.logs.join('\n  '));
  if (game.battleActive) BattleSession.commands.flee();
}

// ---------- B：快意恩仇（手里没有初始攻击） ----------
{
  const card = C.all().find(c => c.name === '快意恩仇');
  console.log('\n=== B 快意恩仇（0 张初始攻击在手） ===');
  console.log('desc:', card.desc, '| targetSide:', targetSideFor(card, C.DMG_TYPES), '| unplayable:', unplayableReasonFor(card, 'normal'));
  const game = makeGame([{ ...card }]);
  BattleSession.start(game, [foeDef()], { isBoss: false, name: '校验' });
  await drain();
  let s = snap();
  const uid = s.hand[0];
  BattleSession.commands.playCard(uid, 0);
  s = await drain();
  console.log('打完后 hand:', s.hand.length, 'discard:', s.discard.length, '敌人 hp:', s.foes[0].hp);
  console.log('战斗日志:\n  ' + game.logs.join('\n  '));
  if (game.battleActive) BattleSession.commands.flee();
}

// ---------- C：装备限定技能（急速跑鞋：打出只穿戴，技能按钮才抽牌） ----------
{
  const shoe = C.all().find(c => c.name === '急速跑鞋');
  console.log('\n=== C 急速跑鞋 ===');
  console.log('desc:', shoe.desc, '| draw:', shoe.draw);
  const game = makeGame([{ ...shoe }]);
  BattleSession.start(game, [foeDef()], { isBoss: false, name: '校验' });
  await drain();
  let s = snap();
  const uid = s.hand[0];
  const handBefore = s.hand.length;
  BattleSession.commands.playCard(uid);
  s = await drain();
  console.log('打出后 equipped:', JSON.stringify(s.equipped), '| hand:', handBefore, '→', s.hand.length);
  BattleSession.commands.useEquipSkill(uid);
  s = await drain();
  console.log('技能后 hand:', s.hand.length, '| equipped.used:', s.equipped[0] && s.equipped[0].used);
  console.log('战斗日志:\n  ' + game.logs.join('\n  '));
  if (game.battleActive) BattleSession.commands.flee();
}

// ---------- D：全库扫描手牌代价句 + 快意恩仇 有/无杀 两态 ----------
{
  console.log('\n=== D 手牌代价扫描 ===');
  const HAND_COST_PATTERNS = [
    /消耗\s*(一张|两|二|三|\d+)\s*张?\s*(?:手牌中的)?(初始攻击|武术|法术|装备|牌|杀)牌?[,，]\s*(.+)$/,
    /选择(?:\s*手牌中)?\s*(\d+|[一两二三四五])\s*张(?:手牌中的?)?\s*(武术|法术|装备|牌)?\s*卡?[^，。；;]*?(?:施放|释放|打出)/,
  ];
  C.all().forEach(c => {
    const hit = HAND_COST_PATTERNS.map(re => re.exec(String(c.desc || ''))).find(Boolean);
    if (hit) console.log('  命中:', c.name, '|', c.desc, '→', JSON.stringify({ n: hit[1], type: hit[2] }));
  });
  const card = C.all().find(c => c.name === '快意恩仇');
  const sha = C.all().find(c => c.name === '初始攻击');
  const ctxEmpty = { handCards: [{ uid: 'a', card: { ...card } }], selfCard: card };
  const ctxFull = { handCards: [{ uid: 'a', card: { ...card } }, { uid: 'b', card: { ...sha } }, { uid: 'c', card: { ...sha } }], selfCard: card };
  console.log('  0 张杀 →', unplayableReasonFor(card, 'normal', ctxEmpty));
  console.log('  2 张杀 →', unplayableReasonFor(card, 'normal', ctxFull));
  const game = makeGame([{ ...card }, { ...sha }, { ...sha }]);
  BattleSession.start(game, [foeDef()], { isBoss: false, name: '校验' });
  await drain();
  let s = snap();
  const uid = s.hand.find(u => game.ownedCards.find(o => o.uid === u).card.name === '快意恩仇');
  BattleSession.commands.playCard(uid, 0);
  // 手选消耗：按 handSelecting.type 选「初始攻击」，不跳过
  for (let i = 0; i < 200; i++) {
    await tick();
    s = snap();
    if (s.handSelecting) {
      const want = s.handSelecting.type;
      const pickUid = s.hand.find(u => {
        const o = game.ownedCards.find(x => x.uid === u);
        return o && (!want || want === '牌' || (want === '杀' || want === '初始攻击' ? /^(杀|初始攻击)$/.test(o.card.name) : o.card.type === want));
      });
      console.log('    手选弹窗：需', s.handSelecting.n, '张', want || '任意', '→ 选', pickUid && game.ownedCards.find(o => o.uid === pickUid).card.name);
      BattleSession.commands.pickHandSelect(pickUid);
      continue;
    }
    if (!s.busy && s.actionQueueLength === 0) break;
  }
  s = snap();
  console.log('  实战（2 张杀在手）：hand', s.hand.length, 'discard', s.discard.length, '敌人 hp', s.foes[0].hp);
  console.log('  日志:\n    ' + game.logs.join('\n    '));
  if (game.battleActive) BattleSession.commands.flee();
}

