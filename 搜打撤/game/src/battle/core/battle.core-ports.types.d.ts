import type { BattleCardInput, BattleCardRules, BattleSnapshot, BattleSnapshotInput, SnapshotAllyInput } from '../battle.snapshot.types.js';
import type { DiscoverQueueJob, DiscoveringState } from '../effects/battle.discover-state.js';
import type { HandSelectionState, HandSelectionEffect } from './battle.hand-selection.js';

export type CoreCard = BattleCardInput & {
  name: string;
  rules?: BattleCardRules & { battle?: BattleCardRules['battle'] & { hosted?: import('../../cards/card-rules.capability.types.js').HostedBattleRuleName[]; ignoresSilence?: true; target?: {side: 'enemy' | 'self' | null; area: boolean} }; equip?: { passive?: { cond?: { vsFreeze?: number } } } };
};
export type CardEntry = { uid: string; card: CoreCard };
export type Defense = { shield: number; armor: number; guard: boolean };
export type CombatUnit = { hp: number; atk?: number; spellPower?: number; dead?: boolean;
  status: Record<string, number>; defense?: Defense };
export type CombatCaster = { atk?: number; spellPower?: number; status?: Record<string, number> };
export type CoreFoe = CombatUnit & { dead: boolean; id?: string | number | null; name?: string };
export type DamageResult = { dealt: number; log: string[] };
export type DamageTypes = { ATTACK: string; SPELL: string; FIXED: string; TRUE: string };
export type DamageTypeMeta = { name: string; icon: string; fmt(amount: number): string; tip: string };
export interface CombatPort {
  TYPES: DamageTypes;
  ensureStatus<T extends {hp: number; status?: Record<string, number>}>(target: T): T & {status: Record<string, number>};
  tickPoison(target: CombatUnit): DamageResult | null;
  dealDamage(attacker: CombatCaster, target: CombatUnit, amount: number, type: string): DamageResult;
  addCurse(target: CombatUnit, key: string, amount: number): number;
  hasCurse(target: CombatUnit): boolean;
}
export interface RandomPort { random(stream?: string): number }
export interface BattleCardLibrary {
  SHA: CoreCard;
  all(): CoreCard[];
  isRandomObtainable(card: BattleCardInput): boolean;
  DMG_TYPES: string[];
  DMG_TYPE_META: Record<string, DamageTypeMeta>;
}
export type CoreGame = { hp: number; maxHp: number; atk: number; coins: number;
  spellPower?: number; myClass?: string | null; characterId?: string | null;
  battleActive: boolean; ownedCards: CardEntry[];
  log(message: string, kind?: string): void; heal(amount: number): void };
export type BattleFloat = { unit: number | 'self'; text: string; cls: string };
export type DelayedEffect = { text?: string; cardName?: string; repeat?: boolean; special?: string; restore?: boolean };
export type HandSelectJob = Pick<HandSelectionEffect, 'n'> & Partial<Omit<HandSelectionEffect, 'n'>>;
export type ChoiceJob = { cardName?: string; options: string[]; secondDoor?: boolean;
  plans?: { label: string; operations?: unknown[] }[]; srcCard?: CoreCard; otherAfterTurns?: number };
export type EffectYield = { kind: string; targets?: CoreFoe[]; segment?: number; cue?: unknown };
export type TextEffectResult = { did?: boolean; drawn?: boolean; healed?: boolean; armored?: boolean } | undefined;
export type TextEffectFlags = { triggered?: boolean; infused?: boolean; skillOnly?: boolean;
  structuredHit?: boolean; hpAtCast?: Map<CoreFoe, number>; fuelCost?: number; uid?: string };
export type ApplyTextEffects = {
  (card: CoreCard, text: string, target?: CoreFoe | null, flags?: TextEffectFlags): TextEffectResult;
  steps(card: CoreCard, text: string, target?: CoreFoe | null, flags?: TextEffectFlags): Generator<EffectYield, TextEffectResult>;
};
export type ResolveCard = {
  (card: CoreCard, target: CoreFoe | null, infused?: boolean, fuelCost?: number, uid?: string): void;
  steps(card: CoreCard, target: CoreFoe | null, infused?: boolean, fuelCost?: number, uid?: string): Generator<EffectYield, void>;
};

/** Live effect callbacks execute only after a game is bound to this runtime. */
export interface EffectRuntime {
  G: CoreGame;
  foes: CoreFoe[]; allies: SnapshotAllyInput[]; pstat: CombatUnit; pdef: Defense;
  mode: string; turn: number; energy: number; maxEnergy: number; armorMul: number;
  hand: string[]; drawPile: string[]; consumed: string[]; grave: string[]; lastDrawnUids: string[];
  equipped: { uid: string; card: CoreCard; used: boolean }[];
  floats: BattleFloat[]; cardAnims: { kind: string; uid: string; name: string }[];
  discoverQueue: DiscoverQueueJob[]; delayed: DelayedEffect[]; growthNames: Set<string>;
  growth: Record<string, number>; handInfuseCounts: Record<string, number>;
  infuseFuels: number; playedMovesThisTurn: number; allSpellsInfused: boolean;
  playerCurseImmune: boolean; holyRune: boolean; deathSave: number; extraTurn: boolean;
  set$noDrawNext(value: boolean): void; set$stealthStrike(value: boolean): void;
  set$nextSpellTwice(value: number): void; set$drawPile(value: string[]): void;
  set$energy(value: number): void; set$maxEnergy(value: number): void; set$hand(value: string[]): void;
  set$shaTransform(value: string | null): void; set$consumeFireballN(value: number): void;
  set$extraTurn(value: boolean): void; set$deathSave(value: number): void;
  set$allSpellsInfused(value: boolean): void; set$poisonLegacy(value: boolean): void;
  set$playerCurseImmune(value: boolean): void; set$surgeWaiter(value: Promise<unknown>): void;
  set$meleeCost1(value: boolean): void; set$spellCost1(value: boolean): void;
}
export interface SnapshotRuntime extends Omit<EffectRuntime, 'G'> {
  G: CoreGame | null;
  battleState: { token: number; phase: string }; busy: boolean; opts: BattleSnapshotInput['opts'];
  discard: string[]; played: string[]; granted: CardEntry[]; cardOverrides: Map<string, CoreCard>;
  infusing: BattleSnapshotInput['infusing']; discovering: DiscoveringState;
  handSelecting: HandSelectionState; choosing: BattleSnapshotInput['choosing'];
  pendingHint: string | null; viewingGrave: boolean; viewingDeck: boolean; viewingBag: boolean;
  dreadShown: boolean; selectingDeck: boolean; selDeckMax: number; selShaN: number;
  sel: Set<string>; selPool: CardEntry[]; timeRune: boolean; spellCost1: boolean; meleeCost1: boolean;
  nextSpellTwice: number; shaTransform: string | null; consumeFireballN: number;
  lastPlayedType: string | null; stealthStrike: boolean; freeCast: Set<string>;
  zeroFeeUntil: Map<string, number>; snapCache: BattleSnapshot | null; snapSig: string | null;
  storeBattleSnapshot(signature: string, snapshot: BattleSnapshot): void;
}
export type EffectSession = { handSelectQueue: HandSelectJob[]; choiceQueue: ChoiceJob[] };
export type SnapshotSession = EffectSession & { actionQueue: { readonly length: number }; stagedDeathFx: Set<CoreFoe> };
export type HitFoe = (foe: CoreFoe, card: BattleCardInput, amount: number, type: string,
  segment?: string, options?: { preserveBaseDamage?: boolean; deferDefeat?: boolean }) => number;
export type DealEffectDamage = (input: { caster: CombatCaster; target: CoreFoe; amount: number;
  type: string; card: CoreCard; source?: 'player' | 'enemy' }) => DamageResult;

export interface EffectCommands {
  recordRequestedDamage(foe: CoreFoe, amount: number, card: BattleCardInput,
    ports: { alive(): CoreFoe[]; hitFoe: HitFoe }): void;
  alive(): CoreFoe[];
  hitFoe: HitFoe;
  foeIdx(foe: CombatUnit): number;
  dealEffectDamage: DealEffectDamage;
  drawCards(n: number): number;
  grantSha(n: number): void;
  addTempCard(card: CoreCard, presentation?: { source: string }): string;
  // directRelease：「直接释放/直接施放」词条路径——注能卡视为已注能释放（反馈#5b 老板定版）。
  queueCardExecution(uid: string, card: CoreCard, fuelUids: string[], target: CoreFoe | null,
    freeCost: boolean, requirementsPaid?: boolean, paymentUids?: string[], onResolved?: (() => void) | null,
    submission?: unknown, directRelease?: boolean): false | void;
  findCard(uid: string): CardEntry | null;
  randomDiscoverCard(predicate?: ((card: CoreCard) => boolean) | null,
    rarity?: string | null, otherClass?: boolean | string | null): CoreCard | null;
  addDeckCard(card: CoreCard): string;
  processHandSelect(): void; restoreConsumed(n: number): number; processChoice(): void;
  shuffle<T>(values: T[]): T[];
  deckDraw(input: { n: number; type: string }): number;
  flee(): void; sweepDead(): void;
  releaseHandMatches(key: string, drawEach?: number, max?: number): number;
  autoPlayHandType(type: string): number;
  damagePlayer(n: number): void;
  fireConsumeTriggers(card: CoreCard, target: CoreFoe | null): void;
  replaceShaInDeck(n: number): number;
  summonAlly(name: string, atk: number, hp: number, n?: number, statless?: boolean): void;
  queuePouchCast(uid: string): void;
  tryUnlockSeal(name: string): void;
  checkElementSealProgress(): void; fireCatGift(card: CoreCard): void;
  handCurseSpecs(): { key: string; n: number }[]; queueSwapCostDiscover(): void;
  resolveRequestedCard(card: CoreCard, target: CoreFoe | null, ports: ResolutionPorts): Generator<EffectYield, boolean>;
  emitRecast(event: { card: CoreCard; uid?: string | null; source: string; repeatIndex: number;
    repeatTotal: number; scope?: string }): boolean;
  getConsumedPile(): string[]; onHandConsumed(card: CoreCard, uid?: string): Generator<EffectYield, void>;
  splitClauses(description: string): { immediate: string[]; turnStart: { text: string; each: boolean }[];
    battle: string[]; onInfused: string[]; onDraw: string[]; skill: string[] };
  registerTurnStart(card: CoreCard, clauses: { text: string; each?: boolean }[], target: CoreFoe | null): void;
  registerBattle(card: CoreCard, clause: string, target: CoreFoe | null): boolean;
  castRandomSpells(n: number, sourceId?: string, signal?: AbortSignal | null): Promise<void>;
  drawOf(card: CoreCard): number; isAOE(card: CoreCard): boolean;
  addPlayerCurse(key: string, n: number, source?: CoreFoe): number;
  resolveBagOperations(card: CoreCard, target: CoreFoe | null,
    options?: { settle?: boolean; aliveBefore?: number }): Generator<EffectYield, boolean>;
  restoreHeroSkill(): void;
}

export interface TextEffectPorts {
  combat: CombatPort; dealEffectDamage: DealEffectDamage;
  getAlive(): CoreFoe[]; getAllies(): SnapshotAllyInput[]; getFrozenTargetBonus(target: CoreFoe | null): number;
  getPlayerStatus(): CombatUnit; getPlayerDefense(): Defense; getMode(): string;
  log(message: string, kind?: string): void; escapeHtml(value: string): string; heal(amount: number): void;
  pushFloat(value: BattleFloat): void; drawCards: EffectCommands['drawCards']; grantStarterAttack: EffectCommands['grantSha'];
  castStarterAttack(target: CoreFoe | null): boolean; markNoDrawNext(): void;
  queueDiscover(value: DiscoverQueueJob): number; randomDiscoverCard: EffectCommands['randomDiscoverCard'];
  addTempCard: EffectCommands['addTempCard']; addDeckCard: EffectCommands['addDeckCard'];
  queueHandSelect(job: HandSelectJob): void;
  restoreConsumed(n: number): number; random01(): number; allCards(): CoreCard[]; queueChoice(job: ChoiceJob): void;
  registerTurnStartText(text: string, cardName: string): void;
  setStealthStrike(value: boolean): void; setNextSpellTwice(n: number): void;
  shuffleDeck(): number; addEnergy(n: number): number; refillEnergy(): number; addEnergyCap(n: number): number;
  isRandomObtainable(card: BattleCardInput): boolean; getPlayerHp(): number; getHandSize(): number;
  getHandCards(): (CardEntry | null)[]; burstPoison(target: CoreFoe): DamageResult | null;
  deckDraw: EffectCommands['deckDraw']; fleeBattle(): void; sweepDead(): void; armorMul(): number;
  getPlayerClass(): string | null;
  getPlayerCaster(): { atk: number; spellPower: number; status: Record<string, number> | undefined };
  foeIndexOf(foe: CoreFoe): number; releaseHandMatches: EffectCommands['releaseHandMatches'];
  autoPlayHandType: EffectCommands['autoPlayHandType']; setShaTransform(name: string | null): void;
  setConsumeFireball(n: number): void; damagePlayer(n: number): void; addPlayerMaxHp(n: number): void;
  dumpHand(): number; getInfuseFuels(): number; getPriceOfLastDrawn(): number;
  dealAoeFixed(n: number, card: CoreCard): void; replaceShaInDeck: EffectCommands['replaceShaInDeck'];
  summonAlly: EffectCommands['summonAlly']; setExtraTurn(value: boolean): void; setDeathSave(n: number): void;
  queuePouchCast: EffectCommands['queuePouchCast']; registerGrowthCard(card: CoreCard | null): void;
  setAllSpellsInfused(value: boolean): void; setPoisonLegacy(value: boolean): void; setPlayerCurseImmune(value: boolean): void;
  unlockSeal(name: string): void; checkElementSealProgress(): void; randomAcquired(card: CoreCard): void;
  handCurseSpecs: EffectCommands['handCurseSpecs']; queueSwapCostDiscover(): void;
}

export type ResolutionPorts = Pick<EffectCommands,
  'resolveBagOperations' | 'autoPlayHandType' | 'queuePouchCast' | 'releaseHandMatches' | 'queueSwapCostDiscover' |
  'resolveRequestedCard' | 'emitRecast' | 'findCard' | 'addTempCard' | 'sweepDead' | 'splitClauses' |
  'registerTurnStart' | 'registerBattle' | 'castRandomSpells' | 'drawCards' | 'grantSha' | 'hitFoe' |
  'addDeckCard' | 'randomDiscoverCard' | 'drawOf' | 'isAOE' | 'damagePlayer' | 'addPlayerCurse' | 'summonAlly' | 'deckDraw'> & {
  queueChoice(job: ChoiceJob): void; queueHandSelect(job: HandSelectJob): void;
  castStarterAttack(target: CoreFoe | null): boolean;
  readState(): { mode: string; playedMovesThisTurn: number; infuseFuels: number; grave: string[]; allSpellsInfused: boolean };
  restoreHeroSkill(): void; getHandSize(): number; getPlayerStatus(): CombatUnit;
  esc(value: string): string; log(message: string, kind?: string): void; heal(amount: number): void;
  addFloat(value: BattleFloat): number; addDelayed(value: DelayedEffect): number;
  takeDeckBottom(count: number): string[]; deckBottomCount(): number; startSurge(promise: Promise<unknown>): void;
  getAllCards(): CoreCard[]; isRandomObtainable(card: BattleCardInput): boolean; randomBattle(): number;
  getDamageTypes(): string[]; getDamageTypeMeta(): BattleCardLibrary['DMG_TYPE_META']; fixedDamageType: string;
  hasCurse(foe: CoreFoe): boolean; getAliveFoes(): CoreFoe[]; getGrowth(uid: string): number;
  getHandInfuseCount(uid: string): number; getFoeIndex(foe: CoreFoe): number;
  applyStatus(foe: CoreFoe, status: string, duration: number): number;
  onHandConsumed: EffectCommands['onHandConsumed']; queueDiscover(value: DiscoverQueueJob): number;
  applyTextEffects: ApplyTextEffects; shuffleDeck(): number; addCoins(n: number): void; getMyClass(): string | null;
  addEnergy(n: number): number; refillEnergy(): number; addEnergyCap(n: number): number; addPlayerMaxHp(n: number): void;
  combat: CombatPort; canApplyPlayerCurse(): boolean;
  foeDealDamage(caster: CombatCaster, target: CoreFoe, amount: number, card: CoreCard): DamageResult;
  getPlayerHp(): number; countDrawnSpells(): number; addArmor(amount: number, options?: { guard?: boolean }): void;
  markNoDrawNext(): void; setExtraTurn(value: boolean): void; setBleedAmp(value: boolean): void;
  setMeleeCost1(value: boolean): void; setSpellCost1(value: boolean): void; setConsumeFireball(n: number): void;
  setAllSpellsInfused(value: boolean): void; registerGrowthCard(card: CoreCard | null): void;
  setPoisonLegacy(value: boolean): void; setPlayerCurseImmune(value: boolean): void; setStealthStrike(value: boolean): void;
  getTurn(): number; getPlayerSpellPower(): number; setNextSpellTwice(n: number): void; getPriceOfLastDrawn(): number;
};
export type EffectAssemblyOptions = { runtime: EffectRuntime; cards: BattleCardLibrary; combat: CombatPort;
  random: RandomPort; executionSession: EffectSession; sound(name: string): void;
  commands: EffectCommands; createBattleResolution(ports: ResolutionPorts): ResolveCard };
export type SnapshotProjectionOptions = { runtime: SnapshotRuntime; executionSession: SnapshotSession;
  interactionOf(kind: 'card' | 'item' | 'slam' | 'dart'): { uid: string; card: CoreCard; hint: string;
    fuelUids?: string[]; battleToken?: number; selectionId?: number; foeFightFirst?: CoreFoe | null } | null;
  battleBagItems(): CardEntry[]; itemUsability(card: CoreCard): { usable: boolean; why: string };
  getConsumedPile(): string[]; R(): { bossDeckSize: number };
  isBattleStartEquip(card: CoreCard): boolean; equipCap(): number; equipSkillText(card: CoreCard): string };

export interface AudioPort {
  sfx(name: string): void; music(name?: string): void; setDucked(value: boolean): void;
  setBoss(value: boolean): void; setBattlePressure(value: number): void;
}
export interface PresentationPort {
  clearFeedback(): void;
  waitForFeedback(signal?: AbortSignal | null): Promise<void>;
  waitForRenderedFrame(signal?: AbortSignal | null): Promise<void>;
  waitMs(ms: number, signal?: AbortSignal | null): Promise<void>;
  demoMs(ms: number): number;
  actionImpactRemaining(): number | null;
}
export interface SummaryPort {
  resetBattleSummary(): void;
  recordBattleDamage(source: string, damage: number, round: number): void;
  readBattleSummary(round: number, foes: CoreFoe[]): {
    readonly round: number;
    readonly remainingFoes: readonly { readonly name?: string; readonly hp: number; readonly maxHp?: number }[];
    readonly damageTaken: readonly { readonly source: string; readonly damage: number; readonly round: number }[];
    readonly damageCoverage: string;
  };
}

/** Mutable instance ports used by the draw and selection rule executors. */
export type RuntimeState = ReturnType<typeof import('../runtime/battle.runtime.factory.js').createBattleRuntime>;
export type InspectionState = Pick<RuntimeState, 'granted' | 'hand' | 'consumed' | 'discoverQueue' | 'cardOverrides' | 'unlimitedRune' | 'zeroFeeUntil' | 'turn' | 'pstat' | 'spellCost1' | 'meleeCost1' | 'lastPlayedType' | 'playedMartialThisTurn' | 'playedMovesThisTurn' | 'pdef' | 'shaTransform' | 'allSpellsInfused'> & { game: CoreGame; getConsumedPile(): string[] };
export type InspectionCards = BattleCardLibrary & { TABLETOP10?: CoreCard[]; deriveDraw(card: CoreCard): number; deriveInfuse(card: CoreCard): number };
export type SelectionPorts = Partial<Pick<EffectCommands, 'findCard' | 'addTempCard' | 'addDeckCard' | 'queueCardExecution' | 'fireConsumeTriggers' | 'fireCatGift' | 'sweepDead'>> & {
 cards: { all(): CoreCard[]; isRandomObtainable(card: BattleCardInput): boolean; sellPrice(card: BattleCardInput): number };
 deny(): void; random01(): number; throwIfActionCancelled(signal?: AbortSignal): void;
 session: EffectSession & { resumeTurnEnd?(): boolean };
 requestBattleRender?(): void; shuffleDeck?(): void;
 queueBattleAction?(work: (signal: AbortSignal) => Promise<void>, label?: string, onError?: (error: unknown) => void): void;
 runStagedSteps?(steps: Generator<EffectYield, unknown>, signal: AbortSignal): Promise<unknown>;
 applyTextEffects?: ApplyTextEffects;
 stepsForOperations?(card: CoreCard, operations: object[], target: CoreFoe | null): Generator<EffectYield, unknown>;
 swapCardCosts?(first: string, second: string): void; finish?(victory: boolean): void;
};
export type DrawPorts = Pick<EffectCommands, 'alive' | 'findCard' | 'sweepDead' | 'queueCardExecution'> & {
 R(): { battleHandMax: number };
 findEffectiveCard(uid: string): CardEntry | null;
 applyTextEffects: (...args: Parameters<ApplyTextEffects>) => ReturnType<ApplyTextEffects>; resolveCard: (...args: Parameters<ResolveCard>) => void;
 fireDrawn(card: CoreCard, target?: CoreFoe | null): void;
 fireAcquire(card: CoreCard, target?: CoreFoe | null): void;
 checkSealTransformation(): void; requestBattleRender(): void;
};
export type FoeLifecyclePorts = Pick<EffectCommands, 'alive' | 'foeIdx' | 'hitFoe'> & {
 finish(victory: boolean): void; stagedDeathFx: Set<CoreFoe>;
 executionSession: { stagedResolutionDepth: number };
};
