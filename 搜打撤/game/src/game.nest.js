/* ============================================================
 * 龙巢 —— 第二地图 / 第二玩法（2026-09-16 Item 定版初稿实装）
 *
 *   解锁：首次击败一图 BOSS 并成功撤离。
 *   备战：仓库选 10 张招式/装备进牌盒（同名不可重复）+ 附赠初始攻击×5 + 职业卡×2；
 *         牌盒上限 30（混沌之眼在盒 → 35），不叠放、不进消耗口袋、不可主动弃掉，
 *         满员时 1 换 1 更换；符文背包上限 10（基地可升到 25），符文槽 3。
 *   地图：直线 12 格（出发 → 敌×6 → 商店×2 → 符文法阵 → 祭坛 → 撤离）。
 *   战斗：与一图 BOSS 同制式（牌库=牌盒，开局 5 张、每回合 2 费抽 1 张），
 *         每场战斗后回满血。心：1-7 点伤害 -1 心、8+ 点 -2 心、破甲时心视作血量、
 *         真实伤害 N 点直接 -N 心。
 *   撤离：打 BOSS 时用掉的符文与卡牌消耗（卡牌进消耗口袋），其余物资全部带走。
 * ============================================================ */
import { Random } from './random.js';
import { esc, escAttr } from './shared.js';
import { MAP, game, clearSave, saveGame, syncPlayTime, exitToTitle } from './game.session.js';
import { UI } from './ui.js';
import SDT, { sdtDefine } from './sdt-facade.js';
import { BattleSession } from './battle.core.js';
import { rollRune, rollRuneKind, rollAttribute, RUNE_KINDS } from './runes.js';
import { on as busOn } from './event-bus.js';

const B = () => SDT.Base;

/* —— 直线 12 格（Item 17 同款定版思路：格子序列即地图）—— */
const NEST_MAP = [
  { type: 'start', name: '龙巢入口' },
  { type: 'battle', name: '第一轮 · 黑暗元素', battle: 'darkElem' },
  { type: 'battle', name: '第二轮 · 沙暴元素', battle: 'sandElem' },
  { type: 'shop', name: '神秘商店' },
  { type: 'battle', name: '第四轮 · 巨龙', battle: 'dragon' },
  { type: 'battle', name: '第五轮 · 恶龙', battle: 'evilDragon' },
  { type: 'runeCircle', name: '符文法阵' },
  { type: 'battle', name: '第七轮 · 黑暗使者', battle: 'envoy' },
  { type: 'shop', name: '神秘商店' },
  { type: 'altar', name: '龙巢祭坛' },
  { type: 'boss', name: '最终轮 · 巢穴之主' },
  { type: 'extract', name: '撤离点' },
];

const NEST_BATTLES = {
  darkElem: { id: 'nest-dark-elem', name: '黑暗元素', hp: 30, atk: 9, rotateImmune: true,
    reward: { coins: 3, chests: ['medium'], runes: ['small'] } },
  sandElem: { id: 'nest-sand-elem', name: '沙暴元素', hearts: 8, atk: 8, heartsMode: true,
    reward: { coins: 3, chests: ['large'], runes: ['small'] } },
  dragon: { id: 'nest-dragon', name: '巨龙', hp: 40, atk: 7, noFirstAttack: true,
    reward: { coins: 4, chests: ['large'], runes: ['medium'] } },
  evilDragon: { id: 'nest-evil-dragon', name: '恶龙', hp: 60, atk: 18, evenAttack: true,
    reward: { coins: 5, chests: ['large'], runes: ['small', 'small'] } },
  envoy: { id: 'nest-envoy', name: '黑暗使者', hearts: 12, atk: 10, heartsMode: true, handConsume: true,
    reward: { coins: 5, chests: ['large'], runes: ['large'] } },
};

const NEST_BOSSES = [
  { id: 'nest-ancient-dragon', name: '远古龙尊', hp: 99, atk: 9, noFirstAttack: true, phases: true, boss: true },
  { id: 'nest-elem-lord', name: '完全形态·元素领主', hearts: 32, atk: 8, heartsMode: true, revive: { hearts: 8, atk: 8 }, affix: 'aegis', boss: true,
    adds: [
      { id: 'nest-storm-hand', name: '风暴之手', hearts: 16, atk: 4, heartsMode: true, protects: true, affix: 'aegis' },
      { id: 'nest-storm-hand', name: '风暴之手', hearts: 16, atk: 4, heartsMode: true, protects: true, affix: 'aegis' },
    ] },
];

const RUNE_CHEST = {
  small: { name: '小符文箱', coins: [2, 3], runes: 1 },
  medium: { name: '中符文箱', coins: [3, 4], pick: 1, runes: 3 },
  large: { name: '大符文箱', coins: [4, 5], runes: 3 },
};

let uidSeq = 0;
const nuid = () => 'nst' + Date.now().toString(36) + (uidSeq++);
const ri = (n) => Math.floor(Random.random('nest') * n);

/* —— 解锁（一图击败 BOSS 后成功撤离时由 doExtract 调用）—— */
export function unlockNest() {
  const Bn = B();
  if (!Bn.data.nestUnlocked) {
    Bn.data.nestUnlocked = true;
    Bn.save();
    UI.log('[[icon:door]] 污染核心的震动平息了……远方的<b>龙巢</b>苏醒——基地解锁了新的远征目标', 'loot');
  }
}

/* —— 备战：牌盒 10 张 + 符文槽 3 —— */
export function openNestPrep() {
  const Bn = B();
  if (!Bn.data.nestUnlocked) { UI.log('[[icon:lock]] 龙巢尚未解锁：先在一图击败首脑并成功撤离', 'warn'); return; }
  game.state = 'modal';
  const picks = new Set();
  const eligible = () => Bn.data.stash.filter(s2 =>
    (s2.card.type === '武术' || s2.card.type === '法术' || s2.card.type === '装备') && !s2.card.cls);
  const render = () => {
    const list = eligible().map((s2, i) => {
      const on = picks.has(i);
      return `<button class="ov-btn ${on ? 'ok' : 'ghost'}" data-act="nestPick${i}" style="width:100%;text-align:left">
        ${on ? '[[icon:check]]' : '[[icon:cards]]'} ${esc(s2.card.name)} ×${s2.count}${on ? '（已选）' : ''}</button>`;
    }).join('');
    const equipped = game.nestEquipped || [];
    UI.showOverlay('[[icon:skull]] 龙巢 · 备战', `
      <p class="ov-stats">巢穴之主：<b>${esc(game.nestBossName || '？？？')}</b>（早在出发时就已注定）</p>
      <p class="ov-note">选择 <b>10</b> 张招式或装备进牌盒（同名不可重复）——附赠初始攻击 ×5 与职业卡 ×2。<br>
      牌盒上限 30、不叠放、不进消耗口袋；符文槽 3（从仓库符文中装备，最多 3 块）。</p>
      <div class="ov-btns">${list || '<p class="ov-empty">仓库里没有可携带的招式/装备</p>'}</div>
      <p class="ov-stats">符文槽（${equipped.length}/3）：${equipped.map(r => esc(r.name)).join('、') || '（空）'}</p>
      <div class="ov-btns">
        ${(Bn.data.runes || []).slice(0, 9).map((r2, i) => `<button class="mini-btn" data-act="nestRune${i}">${esc(r2.name)}（${r2.attrs.join('')}）</button>`).join('')}
      </div>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="nestGo" ${picks.size !== 10 ? 'disabled' : ''}>深入龙巢（${picks.size}/10）</button>
        <button class="ov-btn" data-act="nestBack">返回基地</button>
      </div>`, true);
    eligible().forEach((s2, i) => UI.act('nestPick' + i, () => {
      if (picks.has(i)) picks.delete(i);
      else if (picks.size < 10) picks.add(i);
      render();
    }));
    (Bn.data.runes || []).slice(0, 9).forEach((r2, i) => UI.act('nestRune' + i, () => {
      game.nestEquipped = game.nestEquipped || [];
      const at = game.nestEquipped.indexOf(r2);
      if (at >= 0) game.nestEquipped.splice(at, 1);
      else if (game.nestEquipped.length < 3) game.nestEquipped.push(r2);
      render();
    }));
    UI.act('nestBack', () => { UI.hideOverlay(); game.state = 'idle'; exitToTitle(); });
    UI.act('nestGo', () => startNestRun(eligible().filter((s2, i) => picks.has(i)).map(s2 => s2.card)));
  };
  game.nestEquipped = [];
  render();
}

function pickNestBoss() {
  game.nestBoss = NEST_BOSSES[ri(NEST_BOSSES.length)];
  game.nestBossName = game.nestBoss.name;
}

function startNestRun(boxCards) {
  game.nestActive = true;
  // 龙巢是独立对局：生命与随身币重新起算——game 是会话单例，不重置会继承上一局
  // 的残值（死亡退出后 hp 可能 ≤0，首场战斗即濒死；残留币让商店购买力飘忽，2026-09-19 审计 P1-5）
  // 加成口径与 newRun 一致：熟练度每级 +1 生命上限（Lv.1 起）+ 携带宠物生命加成
  game.maxHp = MAP.rules.playerMaxHp;
  if (game.myClass) {
    const lv = SDT.Meta.classLv(game.myClass);
    if (lv > 1) game.maxHp += lv - 1;
  }
  const pet = SDT.Base.carriedPet ? SDT.Base.carriedPet() : null;
  if (pet && pet.effect && pet.effect.maxHp) game.maxHp += pet.effect.maxHp;
  game.hp = game.maxHp;
  game.coins = 0;
  game.nestPos = 0;
  game.nestEquipped = game.nestEquipped || [];
  game.nestRunes = [];
  pickNestBoss();
  game.cardBox = boxCards.map(c => ({ ...c }));
  // 附赠：初始攻击 ×5 + 职业卡 ×2（随机）
  const shas = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id);
  for (let i = 0; i < 5; i++) game.cardBox.push({ ...shas });
  const classPool = SDT.Cards.all().filter(c => c.rarity === '职业' && !c.hero);
  for (let i = 0; i < 2 && classPool.length; i++) game.cardBox.push({ ...classPool[ri(classPool.length)] });
  UI.hideOverlay();
  saveGame();   // 开局即落盘（刷新/关窗后可续）
  renderNestMap();
}

/* —— 直线地图推进 —— */
export function renderNestMap() {
  game.state = 'modal';
  const rows = NEST_MAP.map((cell, i) => {
    const here = i === game.nestPos;
    const done = i < game.nestPos;
    const next = i === game.nestPos + 1;   // 2026-09-18 留言「无法点击格子移动」：直线图改为点击下一格推进
    return `<button class="ov-btn ${here ? 'ok' : done ? 'ghost' : next ? '' : ''}" data-act="nestCell${i}" ${next ? '' : 'disabled'}>
      ${here ? '[[icon:flag]] ' : done ? '[[icon:check]] ' : next ? '[[icon:arrow]] ' : ''}${i + 1}. ${esc(cell.name)}</button>`;
  }).join('');
  UI.showOverlay('[[icon:skull]] 龙巢 · 巢穴之主：<b>' + esc(game.nestBossName) + '</b>', `
    <p class="ov-stats">推进到第 <b>${game.nestPos + 1}</b>/12 格 · 符文背包 ${game.nestRunes.length} 块 · 槽位：${(game.nestEquipped || []).map(r => esc(r.name)).join('、') || '（空）'}</p>
    <div class="ov-btns">${rows}</div>
    ${(game.pendingRunePick || []).length ? `<div class="ov-btns"><span class="dim">中符文箱显形了 3 块符文——选择 1 块带走：</span>
      ${(game.pendingRunePick || []).map((r2, i) => `<button class="mini-btn ok" data-act="nestPickRune${i}">${esc(r2.name)}（${r2.attrs.join('')}·${r2.rarity}）</button>`).join('')}</div>` : ''}
    ${(game.nestTargetedBox || 0) > 0 ? `<div class="ov-btns"><span class="dim">定向大符文箱 ×${game.nestTargetedBox}——选择属性，立得 3 块该属性随机符文：</span>
      ${['水','火','草','光','暗'].map(at => `<button class="mini-btn ok" data-act="nestBox${at}">${at}</button>`).join('')}</div>` : ''}
    <p class="ov-note">点击高亮的<b>下一格</b>推进 · 每次对战后回满血 · 牌盒即牌库（开局 5 张，每回合 2 费抽 1 张）</p>`, true);
  NEST_MAP.forEach((cell, i) => UI.act('nestCell' + i, () => enterNestCell(cell)));
  (game.pendingRunePick || []).forEach((r2, i) => UI.act('nestPickRune' + i, () => {
    const cap = 10 + (SDT.Base.data.nestBagUp || 0);
    if (game.nestRunes.length >= cap) { UI.log('[[icon:gem]] 符文背包已满（' + cap + ' 块）', 'warn'); return; }
    game.nestRunes.push(r2);
    game.pendingRunePick = null;
    UI.log(`[[icon:gem]] 带走了【${esc(r2.name)}】（${r2.attrs.join('')}·${r2.rarity}）`, 'loot');
    renderNestMap();
  }));
  ['水','火','草','光','暗'].forEach(at => UI.act('nestBox' + at, () => {
    for (let k = 0; k < 3; k++) {
      const dual = Random.random('nest') < 0.007;
      const r = rollRune(() => Random.random('nest'), { forceAttrs: dual ? [at, rollAttribute(() => Random.random('nest'), [at])] : [at] });
      game.nestRunes.push(r);
    }
    game.nestTargetedBox--;
    UI.log(`[[icon:gem]] 定向大符文箱：获得 3 块【${at}】属性符文`, 'loot');
    renderNestMap();
  }));
}

function enterNestCell(cell) {
  if (cell.type === 'start') { renderNestMap(); return; }
  if (cell.type === 'battle') return startNestBattle(NEST_BATTLES[cell.battle]);
  if (cell.type === 'shop') return openNestShop(() => advance());
  if (cell.type === 'runeCircle') return openRuneCircle(() => advance());
  if (cell.type === 'altar') return openNestAltar(() => advance());
  if (cell.type === 'boss') return startNestBattle(game.nestBoss);
  if (cell.type === 'extract') return doNestExtract();
  advance();
}
function advance() {
  if (game.nestPos < NEST_MAP.length - 1) game.nestPos++;
  saveGame();   // 龙巢断点续战（2026-09-18）
  renderNestMap();
}

/* —— 龙巢战斗：牌盒即牌库（BOSS 制式：开局 5 张、每回合 2 费抽 1 张）—— */
let battleStartFn = (g, foes, opts) => BattleSession.start(g, foes, opts);   // BOOT_ORDER 保证 battle.core 先于本模块加载
export function bindBattleStart(fn) { battleStartFn = fn; }

const cell = () => NEST_MAP[game.nestPos] || NEST_MAP[0];   // 当前格（此前调用未定义的 cell() 会让每场龙巢战斗静默崩溃——2026-09-18 第1局实测）

function startNestBattle(def) {
  if (!game.nestBoss) pickNestBoss();
  const isBossCell = cell().type === 'boss';
  const savedOwned = game.ownedCards.slice();
  const savedRules = { e: MAP.rules.battleEnergy, s: MAP.rules.battleStartDraw, t: MAP.rules.battleTurnDraw };
  MAP.rules.battleEnergy = 2; MAP.rules.battleStartDraw = 5; MAP.rules.battleTurnDraw = 1;
  game.ownedCards = game.cardBox.map(c => ({ uid: nuid(), card: { ...c }, safe: false }));
  const bossDef = isBossCell ? game.nestBoss : def;
  const foeDefs = [bossDef, ...(bossDef.adds || [])].map(d => ({
    ...d, hp: d.hearts ? d.hearts : d.hp, maxHp: d.hearts ? d.hearts : d.hp,
  }));
  UI.hideOverlay();
  nestBattleCtx = { savedOwned, savedRules, def, isBossCell };
  if (!battleStartFn) { UI.log('[[icon:cross]] 战斗模块未就绪', 'warn'); return; }
  battleStartFn(game, foeDefs, { isBoss: true, name: bossDef.name, nest: { runes: (game.nestEquipped || []).slice() } });
}

// 龙巢战斗结算（总线订阅；一图战后流程在 bag 侧对龙巢战斗让位）。
// 胜利：回满血 → 发奖励 → 推进并回龙巢地图；失败/撤退：回满血留在原格可再次挑战。
function nestBattleEnd(opts, played, win, consumed) {
  if (!game.nestActive) return;
  const ctx = nestBattleCtx;
  nestBattleCtx = null;
  if (ctx) {
    game.ownedCards = ctx.savedOwned;
    MAP.rules.battleEnergy = ctx.savedRules.e;
    MAP.rules.battleStartDraw = ctx.savedRules.s;
    MAP.rules.battleTurnDraw = ctx.savedRules.t;
  } else {
    // 读档续战（2026-09-19 审计 P2-11）：开战时的内存上下文已随刷新丢失——此前这里直接
    // return，打赢读档续上的战斗不发奖、不推进（进度回退）。随身牌按牌盒重建（开战时
    // 本就是牌盒克隆），规则回龙巢制式，结算照常执行。
    game.ownedCards = (game.cardBox || []).map(c => ({ uid: nuid(), card: { ...c }, safe: false }));
    MAP.rules.battleEnergy = 2; MAP.rules.battleStartDraw = 5; MAP.rules.battleTurnDraw = 1;
  }
  game.hp = game.maxHp;   // 每次对战后回满血（胜利与重试同口径）
  if (win === true) {
    // 战场格 = 当前停留格（advance 才会前移），ctx 缺失时同样成立
    const battleCell = cell();
    if (battleCell.type === 'boss') nestBossRewards();
    else if (battleCell.type === 'battle') grantNestRewards((NEST_BATTLES[battleCell.battle] || {}).reward);
    advance();
  } else {
    UI.log('[[icon:heart]] 巢穴的疗息雾气让队伍恢复力气——整队再战', 'sys');
    renderNestMap();
  }
}
busOn('battle:end', nestBattleEnd);
let nestBattleCtx = null;

function nestBossRewards() {
  game.coins += 5;
  addRuneChest('large');
  addRuneChest('large');
  // 定向大符文箱：使用时选 1 个属性，获得 3 张该属性的随机符文（0.7% 出含该属性的双属性符文）
  game.nestTargetedBox = (game.nestTargetedBox || 0) + 1;
  UI.log('[[icon:gem]] 战胜巢穴之主：BOSS 宝箱 ×2 · 定向大符文箱 ×1', 'loot');
  if (game.nestBoss) {
    const s = SDT.Base.data.stats;
    if (!s.nestBossKills) s.nestBossKills = [];
    if (!s.nestBossKills.includes(game.nestBoss.name)) s.nestBossKills.push(game.nestBoss.name);
    SDT.Base.save();
    SDT.Meta.track('nestBoss', { name: game.nestBoss.name });
  }
}

/* —— 奖励：宝箱与符文箱 —— */
function grantNestRewards(reward) {
  if (!reward) return;
  (reward.chests || []).forEach(() => {
    const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c));
    if (pool.length) { const c = pool[ri(pool.length)]; game.cardBox.push({ ...c }); UI.log(`[[icon:cards]] 宝箱开出【${esc(c.name)}】入牌盒`, 'loot'); }
  });
  (reward.runes || []).forEach(kind => addRuneChest(kind));
  if (reward.coins) game.coins += reward.coins;
}

function addRuneChest(kind) {
  const spec = RUNE_CHEST[kind] || RUNE_CHEST.small;
  const coins = spec.coins[0] + ri(spec.coins[1] - spec.coins[0] + 1);
  game.coins += coins;
  const cap = 10 + (SDT.Base.data.nestBagUp || 0);
  const got = [];
  const n = spec.runes || 1;
  if (spec.pick) {
    // 中符文箱（2026-09-16 老板澄清）：从 3 个随机符文中选择 1 个——
    // 3 块先滚好挂到推进页，玩家点选后才真正入背包
    const picks = Array.from({ length: 3 }, () => rollRune(() => Random.random('nest')));
    game.pendingRunePick = picks;
    UI.log(`[[icon:gem]] ${spec.name}：+${coins} 币 · 3 块符文已显形，回推进页选择 1 块`, 'loot');
    return;
  }
  for (let k = 0; k < n; k++) {
    if (game.nestRunes.length >= cap) { got.push('（符文背包已满，散失）'); continue; }
    const r = rollRune(() => Random.random('nest'));
    game.nestRunes.push(r);
    got.push(`${r.name}（${r.attrs.join('')}·${r.rarity}）`);
  }
  UI.log(`[[icon:gem]] ${spec.name}：+${coins} 币 · ${got.join('、') || '空'}`, 'loot');
}

/* —— 符文法阵：献祭 3 张牌选 1 符文；或献祭整个牌盒紧急撤离 —— */
function openRuneCircle(done) {
  const runes = Array.from({ length: 5 }, () => rollRune(() => Random.random('nest')));
  UI.showOverlay('[[icon:sparkles]] 符文法阵', `
    <p class="ov-note">献祭 3 张牌盒中的卡牌（初始攻击不行），从 5 块随机符文中选 1 块；<br>或者献祭<b>整个牌盒</b>，从龙巢紧急撤离。</p>
    <div class="ov-btns">${runes.map((r, i) => `<button class="ov-btn ${i === 0 ? 'ok' : ''}" data-act="rc${i}">${esc(r.name)}（${r.attrs.join('')}·${r.rarity}）</button>`).join('')}</div>
    <div class="ov-btns">
      <button class="ov-btn ghost" data-act="rcBox">献祭整个牌盒 · 紧急撤离</button>
      <button class="ov-btn" data-act="rcBack">离开法阵</button>
    </div>`, true);
  runes.forEach((r, i) => UI.act('rc' + i, () => {
    const sac = game.cardBox.filter(c => !SDT.Base.isSha(c)).slice(0, 3);
    if (sac.length < 3) { UI.log('[[icon:cross]] 牌盒中可献祭的卡牌不足 3 张（初始攻击不能献祭）', 'warn'); return; }
    game.cardBox = game.cardBox.filter(c => !sac.includes(c));
    game.nestRunes.push(r);
    UI.log(`[[icon:sparkles]] 献祭 3 张卡牌，符文法阵赐下【${esc(r.name)}】（${r.attrs.join('')}）`, 'loot');
    done();
  }));
  UI.act('rcBox', () => {
    game.cardBox = game.cardBox.filter(c => SDT.Base.isSha(c));
    UI.log('[[icon:exit]] 你献祭了整个牌盒——紧急撤离龙巢', 'sys');
    doNestExtract();
  });
  UI.act('rcBack', () => done());
}

/* —— 龙巢祭坛：1 英雄卡 + 1 职业卡；或 3 次改变符文属性 —— */
function openNestAltar(done) {
  let rerolls = 3;
  const render = () => {
    UI.showOverlay('[[icon:sparkles]] 龙巢祭坛', `
      <p class="ov-note">抉择：获得 1 张<b>英雄卡</b>与 1 张<b>职业卡</b>；或获得 <b>3</b> 次改变任一符文属性的机会（剩 ${rerolls} 次）。</p>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="naHero">获得英雄卡与职业卡</button>
        <button class="ov-btn" data-act="naReroll" ${rerolls <= 0 || !game.nestRunes.length ? 'disabled' : ''}>改变一块符文的属性（-1 次）</button>
        <button class="ov-btn" data-act="naBack">离开祭坛</button>
      </div>`, true);
    UI.act('naHero', () => {
      const hero = SDT.Cards.all().find(c => c.hero);
      const cls = SDT.Cards.all().filter(c => c.rarity === '职业' && !c.hero);
      if (hero) game.cardBox.push({ ...hero });
      if (cls.length) game.cardBox.push({ ...cls[ri(cls.length)] });
      UI.log('[[icon:helmet]] 祭坛赐下英雄卡与职业卡（入牌盒）', 'loot');
      done();
    });
    UI.act('naReroll', () => {
      const r = game.nestRunes[ri(game.nestRunes.length)];
      if (!r) return;
      const old = r.attrs.join('');
      r.attrs = [rollAttribute(() => Random.random('nest'))];
      if (Random.random('nest') < 0.007) r.attrs.push(rollAttribute(() => Random.random('nest'), r.attrs));
      rerolls--;
      UI.log(`[[icon:sparkles]] 【${esc(r.name)}】属性 ${old} → ${r.attrs.join('')}`, 'loot');
      render();
    });
    UI.act('naBack', () => done());
  };
  render();
}

/* —— 龙巢神秘商店：4 随机卡 + 3 职业卡 + 3 符文栏位 —— */
function openNestShop(done) {
  const lib = SDT.Cards.all().filter(c => c.rarity !== '衍生' && !c.unrandom && SDT.Cards.isRandomObtainable(c));
  const taken = new Set();
  const pickCard = () => { for (let k = 0; k < 50; k++) { const c = lib[ri(lib.length)]; if (c && !taken.has(c.name)) { taken.add(c.name); return c; } } return null; };
  const classPool = SDT.Cards.all().filter(c => c.rarity === '职业' && !c.hero);
  const cardSlots = Array.from({ length: 4 }, () => ({ card: pickCard(), price: 3, sold: false }));
  const classSlots = Array.from({ length: 3 }, () => ({ card: classPool.length ? classPool[ri(classPool.length)] : null, price: 4, sold: false }));
  const runePrice = r => (r.rarity === '古朴' ? 4 : r.rarity === '稀有' ? 5 : 6) * (r.attrs.length > 1 ? 2 : 1);
  const runeSlots = Array.from({ length: 3 }, () => { const r = rollRune(() => Random.random('nest')); return { rune: r, price: runePrice(r), sold: false }; });
  const render = () => {
    UI.showOverlay('[[icon:coin]] 龙巢 · 神秘商店', `
      <p class="ov-stats">随身币 <b>${game.coins}</b></p>
      <h3 class="set-h">随机卡牌（3 币）</h3>
      <div class="ov-btns">${cardSlots.map((s2, i) => !s2.sold && s2.card ? `<button class="ov-btn" data-act="nsC${i}">${esc(s2.card.name)}（${s2.card.rarity}）3 币</button>` : '<span class="dim">已售</span>').join(' ')}</div>
      <h3 class="set-h">职业卡（4 币）</h3>
      <div class="ov-btns">${classSlots.map((s2, i) => !s2.sold && s2.card ? `<button class="ov-btn" data-act="nsK${i}">${esc(s2.card.name)} 4 币</button>` : '<span class="dim">已售</span>').join(' ')}</div>
      <h3 class="set-h">符文（古朴 4 / 稀有 5 / 史诗 6 · 双属性翻倍）</h3>
      <div class="ov-btns">${runeSlots.map((s2, i) => !s2.sold && s2.rune ? `<button class="ov-btn ${s2.rune.rarity === '史诗' ? 'ok' : ''}" data-act="nsR${i}">${esc(s2.rune.name)}（${s2.rune.attrs.join('')}）${s2.price} 币</button>` : '<span class="dim">已售</span>').join(' ')}</div>
      <div class="ov-btns"><button class="ov-btn ok" data-act="nsBack">离开商店</button></div>`, true);
    const buy = (slot, act) => {
      if (!slot || slot.sold) return;
      if (game.coins < slot.price) { UI.log('[[icon:coin]] 币不够', 'warn'); return; }
      game.coins -= slot.price;
      slot.sold = true;
      if (act === 'rune') { game.nestRunes.push(slot.rune); UI.log(`[[icon:gem]] 购入符文【${esc(slot.rune.name)}】`, 'coin'); }
      else { game.cardBox.push({ ...slot.card }); UI.log(`[[icon:coin]] 购入【${esc(slot.card.name)}】入牌盒`, 'coin'); }
      render();
    };
    cardSlots.forEach((s2, i) => UI.act('nsC' + i, () => buy(s2, 'card')));
    classSlots.forEach((s2, i) => UI.act('nsK' + i, () => buy(s2, 'class')));
    runeSlots.forEach((s2, i) => UI.act('nsR' + i, () => buy(s2, 'rune')));
    UI.act('nsBack', () => done());
  };
  render();
}

/* —— 撤离：BOSS 战用掉的符文与卡牌消耗（卡牌进消耗口袋），其余全部带走 —— */
function doNestExtract() {
  syncPlayTime();
  game.nestActive = false;
  game.nestEquipped = [];   // 最终 BOSS 战装备中的符文消耗
  const Bn = B();
  (game.nestRunes || []).forEach(r => Bn.data.runes.push(r));
  game.nestRunes = [];
  Bn.save();
  clearSave();   // 撤离完成：清除进行中对局档（下次从龙巢备战重新出发）
  SDT.Meta.checkUnlocks();
  UI.log('[[icon:exit]] <b>龙巢撤离成功！</b>符文与战利品已运回基地', 'ok');
  exitToTitle();
}

/* —— 彩虹符文合成（卡扎库斯式）：属性 5 选 1 + 类别 5 选 1 —— */
export function craftRainbow(baseRune, attr, kindId) {
  const kind = RUNE_KINDS.find(k => k.id === kindId);
  if (!kind || kind.id === 'rainbow') return null;
  return { kind: kind.id, name: kind.name, rarity: '史诗', attrs: [attr], desc: kind.desc, custom: true };
}

sdtDefine('Nest', { openNestPrep, bindBattleStart, startNestBattle, doNestExtract, renderNestMap });
