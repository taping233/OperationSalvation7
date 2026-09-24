/* 当场战斗的增益、符文与规则触发器。由 battle.runtime.js 转发活绑定。 */
export let stealthStrike = false;
export let nextSpellTwice = 0;
export let spellCost1 = false;
export let meleeCost1 = false;
export let shaTransform = null;
export let consumeFireballN = 0;
export let lastPlayedType = null;
export let playedMartialThisTurn = 0;
export let playedMovesThisTurn = 0;
export let growthNames = new Set();
export let growth = {};
export let infuseFuels = 0;
export let sealUnlocked = false;
export let extraTurn = false;
export let deathSave = 0;
export let killAtkUp = 0;
export let poisonOnSpell = false;
export let poisonLegacy = false;
export let nestRunes = [];
export let nestSyn = {};
export let timeRune = false;
export let arrowRune = false;
export let unyieldRune = false;
export let ashRune = false;
export let unlimitedRune = false;
export let holyRune = false;
export let fireballRuneOn = false;
export let freezeRuneOn = false;
export let swiftRune = false;
export let timeSpaceRune = false;
export let timeSpaceUsed = false;
export let armorMul = 1;
export let sealDone = false;
export let playerCurseImmune = false;
export let allSpellsInfused = false;

export function set$stealthStrike(v) { stealthStrike = v; }
export function set$nextSpellTwice(v) { nextSpellTwice = v; }
export function set$spellCost1(v) { spellCost1 = v; }
export function set$meleeCost1(v) { meleeCost1 = v; }
export function set$shaTransform(v) { shaTransform = v; }
export function set$consumeFireballN(v) { consumeFireballN = v; }
export function set$lastPlayedType(v) { lastPlayedType = v; }
export function set$playedMartialThisTurn(v) { playedMartialThisTurn = v; }
export function set$playedMovesThisTurn(v) { playedMovesThisTurn = v; }
export function set$growthNames(v) { growthNames = v; }
export function set$growth(v) { growth = v; }
export function set$infuseFuels(v) { infuseFuels = v; }
export function set$sealUnlocked(v) { sealUnlocked = v; }
export function set$extraTurn(v) { extraTurn = v; }
export function set$deathSave(v) { deathSave = v; }
export function set$killAtkUp(v) { killAtkUp = v; }
export function set$poisonOnSpell(v) { poisonOnSpell = v; }
export function set$poisonLegacy(v) { poisonLegacy = v; }
export function set$nestRunes(v) { nestRunes = v; }
export function set$nestSyn(v) { nestSyn = v; }
export function set$timeRune(v) { timeRune = v; }
export function set$arrowRune(v) { arrowRune = v; }
export function set$unyieldRune(v) { unyieldRune = v; }
export function set$ashRune(v) { ashRune = v; }
export function set$unlimitedRune(v) { unlimitedRune = v; }
export function set$holyRune(v) { holyRune = v; }
export function set$fireballRuneOn(v) { fireballRuneOn = v; }
export function set$freezeRuneOn(v) { freezeRuneOn = v; }
export function set$swiftRune(v) { swiftRune = v; }
export function set$timeSpaceRune(v) { timeSpaceRune = v; }
export function set$timeSpaceUsed(v) { timeSpaceUsed = v; }
export function set$armorMul(v) { armorMul = v; }
export function set$sealDone(v) { sealDone = v; }
export function set$playerCurseImmune(v) { playerCurseImmune = v; }
export function set$allSpellsInfused(v) { allSpellsInfused = v; }

/* —— 域内聚合接口（2026-09-25 状态袋打薄第 3 批）：散 set$Xxx 调用收敛到本域 ——
 * 只聚「整组重置/整段回填/按 kind 写旗」点；规则中途回写（打出侧登记、消耗触发等）
 * 条件与日志交织，保持散调，不做伪聚合。 */
export function restoreEffectState(data) {
  spellCost1 = !!data.spellCost1; meleeCost1 = !!data.meleeCost1;
  shaTransform = data.shaTransform || null; consumeFireballN = +data.consumeFireballN || 0;
  lastPlayedType = data.lastPlayedType || null;
  stealthStrike = !!data.stealthStrike; nextSpellTwice = +data.nextSpellTwice || 0;
}
export function restoreEffectRules(data) {
  growth = { ...(data.growth || {}) }; growthNames = new Set(data.growthNames || []);
  infuseFuels = +data.infuseFuels || 0; sealUnlocked = !!data.sealUnlocked;
  extraTurn = !!data.extraTurn; deathSave = +data.deathSave || 0;
  killAtkUp = +data.killAtkUp || 0; poisonOnSpell = !!data.poisonOnSpell;
}
export function resetCostFlags() {
  stealthStrike = false; nextSpellTwice = 0;
  spellCost1 = false; meleeCost1 = false;
  shaTransform = null; consumeFireballN = 0; lastPlayedType = null;
}
export function resetRuneFlags() {
  nestRunes = []; nestSyn = {};
  timeRune = false; arrowRune = false; unyieldRune = false;
  ashRune = false; unlimitedRune = false; holyRune = false; fireballRuneOn = false; freezeRuneOn = false;
  swiftRune = false; timeSpaceRune = false; timeSpaceUsed = false; armorMul = 1;
}
/* 龙巢符文规则旗：按 kind 写对应旗（engine applyNestRunes 逐条 if 的域内收敛；未知 kind 不动） */
export function applyRuneFlag(kind) {
  if (kind === 'time') timeRune = true;
  if (kind === 'arrow') arrowRune = true;
  if (kind === 'unyield') unyieldRune = true;
  if (kind === 'ash') ashRune = true;
  if (kind === 'infinite') unlimitedRune = true;
  if (kind === 'holy') holyRune = true;
  if (kind === 'shield') armorMul = 2;
  if (kind === 'swift') swiftRune = true;
  if (kind === 'fireball') fireballRuneOn = true;
  if (kind === 'spacetime') timeSpaceRune = true;
}
