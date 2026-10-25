import { subscribeStateBindings } from '../../core/live-bindings.js';
import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';

// Derived ESM bindings preserve existing readers; mutable data lives in runtime.
export let {
  stealthStrike, nextSpellTwice, spellCost1, meleeCost1,
  shaTransform, consumeFireballN, lastPlayedType, playedMartialThisTurn,
  playedMovesThisTurn, growthNames, growth, infuseFuels,
  handInfuseCounts, sealUnlocked, extraTurn, deathSave,
  killAtkUp, poisonOnSpell, poisonLegacy, nestRunes,
  nestSyn, timeRune, arrowRune, unyieldRune,
  ashRune, unlimitedRune, holyRune, fireballRuneOn,
  freezeRuneOn, swiftRune, timeSpaceRune, timeSpaceUsed,
  armorMul, sealDone, playerCurseImmune, allSpellsInfused
} = runtime;
subscribeStateBindings(runtime, {
  stealthStrike: value => { stealthStrike = value; },
  nextSpellTwice: value => { nextSpellTwice = value; },
  spellCost1: value => { spellCost1 = value; },
  meleeCost1: value => { meleeCost1 = value; },
  shaTransform: value => { shaTransform = value; },
  consumeFireballN: value => { consumeFireballN = value; },
  lastPlayedType: value => { lastPlayedType = value; },
  playedMartialThisTurn: value => { playedMartialThisTurn = value; },
  playedMovesThisTurn: value => { playedMovesThisTurn = value; },
  growthNames: value => { growthNames = value; },
  growth: value => { growth = value; },
  infuseFuels: value => { infuseFuels = value; },
  handInfuseCounts: value => { handInfuseCounts = value; },
  sealUnlocked: value => { sealUnlocked = value; },
  extraTurn: value => { extraTurn = value; },
  deathSave: value => { deathSave = value; },
  killAtkUp: value => { killAtkUp = value; },
  poisonOnSpell: value => { poisonOnSpell = value; },
  poisonLegacy: value => { poisonLegacy = value; },
  nestRunes: value => { nestRunes = value; },
  nestSyn: value => { nestSyn = value; },
  timeRune: value => { timeRune = value; },
  arrowRune: value => { arrowRune = value; },
  unyieldRune: value => { unyieldRune = value; },
  ashRune: value => { ashRune = value; },
  unlimitedRune: value => { unlimitedRune = value; },
  holyRune: value => { holyRune = value; },
  fireballRuneOn: value => { fireballRuneOn = value; },
  freezeRuneOn: value => { freezeRuneOn = value; },
  swiftRune: value => { swiftRune = value; },
  timeSpaceRune: value => { timeSpaceRune = value; },
  timeSpaceUsed: value => { timeSpaceUsed = value; },
  armorMul: value => { armorMul = value; },
  sealDone: value => { sealDone = value; },
  playerCurseImmune: value => { playerCurseImmune = value; },
  allSpellsInfused: value => { allSpellsInfused = value; },
});
export const {
  set$handInfuseCounts, recordHandInfusion, set$stealthStrike, set$nextSpellTwice,
  set$spellCost1, set$meleeCost1, set$shaTransform, set$consumeFireballN,
  set$lastPlayedType, set$playedMartialThisTurn, set$playedMovesThisTurn, set$infuseFuels,
  set$sealUnlocked, set$extraTurn, set$deathSave, set$killAtkUp,
  set$poisonOnSpell, set$poisonLegacy, set$nestRunes, set$nestSyn,
  set$timeSpaceUsed, set$sealDone, set$playerCurseImmune, set$allSpellsInfused,
  effectiveHandMax, restoreEffectState, restoreEffectRules, resetCostFlags,
  applyRuneFlag, resetBattleEffectFlags
} = runtime;
