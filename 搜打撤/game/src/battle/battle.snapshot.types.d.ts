export type BattleCardValue = string | number | boolean | null | undefined | BattleCardValue[] | { [key: string]: BattleCardValue };

export type SnapshotCardValue = string | number | boolean | null | undefined | readonly SnapshotCardValue[] | { readonly [key: string]: SnapshotCardValue };

export type BattleDamageOperation = {
  op?: string;
  amount?: BattleCardValue;
  amountField?: string;
  hitCount?: BattleCardValue;
  hits?: { count?: BattleCardValue; range?: BattleCardValue; perFoe?: BattleCardValue; [key: string]: BattleCardValue };
  range?: BattleCardValue;
  cond?: BattleCardValue;
  bonus?: BattleCardValue;
  lifesteal?: boolean;
  graveyard?: BattleCardValue;
  recast?: BattleCardValue;
  schedule?: BattleCardValue;
  target?: string;
  retarget?: string;
  [key: string]: BattleCardValue;
};

export type BattleCardRules = {
  triggers?: { onPlay?: BattleDamageOperation[]; [key: string]: BattleCardValue };
  battle?: { requirements?: { kind?: string; count?: BattleCardValue; type?: string; [key: string]: BattleCardValue }[]; [key: string]: BattleCardValue };
  [key: string]: BattleCardValue;
};

export type SnapshotDamageOperation = {
  readonly op?: string;
  readonly amount?: SnapshotCardValue;
  readonly amountField?: string;
  readonly hitCount?: SnapshotCardValue;
  readonly hits?: { readonly count?: SnapshotCardValue; readonly range?: SnapshotCardValue; readonly perFoe?: SnapshotCardValue; readonly [key: string]: SnapshotCardValue };
  readonly range?: SnapshotCardValue;
  readonly cond?: SnapshotCardValue;
  readonly bonus?: SnapshotCardValue;
  readonly lifesteal?: boolean;
  readonly graveyard?: SnapshotCardValue;
  readonly recast?: SnapshotCardValue;
  readonly schedule?: SnapshotCardValue;
  readonly target?: string;
  readonly retarget?: string;
  readonly [key: string]: SnapshotCardValue;
};

export type SnapshotCardRules = {
  readonly triggers?: { readonly onPlay?: readonly SnapshotDamageOperation[]; readonly [key: string]: SnapshotCardValue };
  readonly battle?: { readonly requirements?: readonly { readonly kind?: string; readonly count?: SnapshotCardValue; readonly type?: string; readonly [key: string]: SnapshotCardValue }[]; readonly [key: string]: SnapshotCardValue };
  readonly [key: string]: SnapshotCardValue;
};

export type BattleCardInput = {
  id?: string;
  name?: string;
  type?: string;
  cost?: number;
  dmg?: number | null;
  dmgType?: string;
  desc?: string;
  rules?: BattleCardRules;
  [key: string]: BattleCardValue;
};

export type SnapshotBattleCard = {
  readonly id?: string;
  readonly name?: string;
  readonly type?: string;
  readonly cost?: number;
  readonly dmg?: number | null;
  readonly dmgType?: string;
  readonly desc?: string;
  readonly rules?: SnapshotCardRules;
  readonly [key: string]: SnapshotCardValue;
};

export type SnapshotFoeInput = {
  hp: number;
  dead: boolean;
  heartsMode?: boolean;
  protected?: boolean;
  affix?: string;
  status?: (Record<string, unknown> & { dodge?: number }) | null;
  defense?: (Record<string, unknown> & { shield?: number; armor?: number; guard?: boolean }) | null;
  intent?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type PlayerEffectView = { key: string; name: string; icon: string; duration: string; description: string };

export type BattleSnapshotInput = {
  battleToken: number;
  mode: string;
  turn: number;
  energy: number;
  maxEnergy: number;
  busy: boolean;
  phase: string;
  actionQueueLength: number;
  playedMovesThisTurn?: number;
  playerEffects?: PlayerEffectView[];
  endTurnContext?: { deathSave: number; timeRune: boolean; extraTurn: boolean };
  opts: Record<string, unknown> | null;
  player: { hp: number; maxHp: number; atk: number; spellPower: number; [key: string]: unknown } | null;
  pdef: ({ [key: string]: unknown } & { shield?: number; armor?: number; guard?: boolean }) | null;
  pstat: ({ [key: string]: unknown } & { status?: Record<string, unknown> }) | null;
  foes: SnapshotFoeInput[];
  deathFxPending?: boolean[];
  allies: SnapshotAllyInput[];
  hand: string[];
  drawPile: string[];
  discard: string[];
  grave: string[];
  consumed?: string[];
  infusing: ({ uid: string; card?: BattleCardInput | null; picked: Set<string>; [key: string]: unknown }) | null;
  discovering: ({ options: BattleCardInput[]; [key: string]: unknown }) | null;
  handSelecting: ({ srcCard?: BattleCardInput | null; payment?: ({ card?: BattleCardInput | null; [key: string]: unknown }) | null; [key: string]: unknown }) | null;
  choosing: ({ options: unknown[]; [key: string]: unknown }) | null;
  pendingTarget: ({ uid: string; card?: BattleCardInput | null; [key: string]: unknown }) | null;
  pendingHint: string | null;
  viewingGrave: boolean;
  viewingDeck: boolean;
  viewingBag: boolean;
  dreadShown: boolean;
  selectingDeck: boolean;
  deckNeed: number;
  selDeckMax: number;
  selShaN: number;
  sel: Set<string>;
  selPool: { uid: string; card?: BattleCardInput | null; [key: string]: unknown }[];
  potionBar: { uid: string; name: string; count: number; desc: string; aim: string | null; usable: boolean; why: string; [key: string]: unknown }[] | null;
  pendingItem: ({ uid: string; card?: BattleCardInput | null; [key: string]: unknown }) | null;
  slamPending: boolean;
  dartPending: boolean;
  equipped: { uid: string; card?: BattleCardInput | null; name: string; desc: string; skill: string; used: boolean; [key: string]: unknown }[];
};

export type SnapshotDefense = Readonly<Record<string, unknown>> & { readonly shield?: number; readonly armor?: number; readonly guard?: boolean };
export type SnapshotStatus = Readonly<Record<string, unknown>> & { readonly dodge?: number };
export type SnapshotAllyInput = {
  hp: number | null;
  maxHp: number | null;
  status?: Record<string, unknown> | null;
  defense?: ({ [key: string]: unknown } & { shield?: number; armor?: number; guard?: boolean }) | null;
  [key: string]: unknown;
};
export type SnapshotAlly = {
  readonly hp: number | null;
  readonly maxHp: number | null;
  readonly status: SnapshotStatus;
  readonly defense: SnapshotDefense | null | undefined;
  readonly [key: string]: unknown;
};
export type SnapshotHandSelecting = {
  readonly srcCard?: SnapshotBattleCard | null;
  /** The payment wrapper is shallow-cloned but mutable; other nested values keep their references. Its card projection is recursively readonly. */
  readonly payment?: ({ card?: SnapshotBattleCard | null; [key: string]: unknown }) | null;
  readonly [key: string]: unknown;
};

export type SnapshotFoe = {
  readonly hp: number;
  readonly dead: boolean;
  readonly heartsMode?: boolean;
  readonly protected?: boolean;
  readonly affix?: string;
  readonly status: SnapshotStatus | null;
  readonly defense: SnapshotDefense | null | undefined;
  readonly intent: Readonly<Record<string, unknown>> | null | undefined;
  readonly [key: string]: unknown;
};

export type BattleSnapshot = {
  readonly battleToken: number;
  readonly mode: string;
  readonly turn: number;
  readonly energy: number;
  readonly maxEnergy: number;
  readonly busy: boolean;
  readonly phase: string;
  readonly actionQueueLength: number;
  readonly playedMovesThisTurn?: number;
  readonly playerEffects?: readonly Readonly<PlayerEffectView>[];
  readonly endTurnContext?: Readonly<{ deathSave: number; timeRune: boolean; extraTurn: boolean }>;
  readonly opts: Readonly<Record<string, unknown>> | null;
  readonly player: ({ readonly atk: number; readonly spellPower: number; readonly [key: string]: unknown }) | null;
  readonly pdef: Readonly<Record<string, unknown>> | null;
  readonly pstat: ({ readonly status?: Readonly<Record<string, unknown>> } & { readonly [key: string]: unknown }) | null;
  readonly foes: readonly SnapshotFoe[];
  readonly allies: readonly SnapshotAlly[];
  readonly hand: readonly string[];
  readonly drawPile: readonly string[];
  readonly discard: readonly string[];
  readonly grave: readonly string[];
  readonly consumed?: readonly string[];
  readonly infusing: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly picked: readonly string[]; readonly [key: string]: unknown }) | null;
  readonly discovering: ({ readonly options: readonly SnapshotBattleCard[]; readonly [key: string]: unknown }) | null;
  readonly handSelecting: SnapshotHandSelecting | null;
  readonly choosing: ({ readonly options: readonly unknown[]; readonly [key: string]: unknown }) | null;
  readonly pendingTarget: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly [key: string]: unknown }) | null;
  readonly pendingHint: string | null;
  readonly viewingGrave: boolean;
  readonly viewingDeck: boolean;
  readonly viewingBag: boolean;
  readonly dreadShown: boolean;
  readonly deckSelection: ({ readonly need: number; readonly max: number; readonly starterCount: number; readonly selected: readonly string[]; readonly cards: readonly { readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; }[]; readonly boss: SnapshotFoe | null }) | null;
  readonly potionBar: readonly { readonly uid: string; readonly name: string; readonly count: number; readonly desc: string; readonly aim: string | null; readonly usable: boolean; readonly why: string; readonly [key: string]: unknown }[] | null;
  readonly pendingItem: ({ readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly [key: string]: unknown }) | null;
  readonly slamPending: boolean;
  readonly dartPending: boolean;
  readonly equipped: readonly { readonly uid: string; readonly card: SnapshotBattleCard | null | undefined; readonly name: string; readonly desc: string; readonly skill: string; readonly used: boolean; readonly [key: string]: unknown }[];
};

export type PreviewActionInput = {
  snapshot: Pick<BattleSnapshot, 'foes' | 'player' | 'pstat'>;
  action: { kind: 'play-card'; uid?: string; targetIndex: number };
  cardContext: {
    card: SnapshotBattleCard | null;
    targetIndexes: readonly number[];
    effectiveCost?: number;
    legal?: boolean;
    illegalReason?: string;
    mode?: string;
    hostedExecutionVerified?: boolean;
    heartsMode?: boolean;
    shaTransformed?: boolean;
    modifiers?: { stealthStrike?: boolean; nestDark1?: boolean; nestDark3?: boolean; allSpellsInfused?: boolean;
      bleedAmp?: boolean; vsFreezeBonus?: boolean; specialLifecycle?: boolean };
    selectedFuelUids?: readonly string[];
    wholeCardRepeats?: number;
    arrowRuneRepeat?: boolean;
    damageGrowth?: number;
    targetProtected?: boolean;
    aegisBlocked?: boolean;
  };
};

export type PreviewResult = {
  legal: boolean;
  cost: number;
  targetIndexes: readonly number[];
  confidence: 'exact' | 'unknown';
  damage: null | {
    type: string;
    hits: readonly number[];
    targetIndexesByHit: readonly number[];
    defeatedTargetIndexes: readonly number[];
    total: number;
    hpBefore: number;
    hpAfter: number;
    lethal: boolean;
    shieldBefore: number;
    shieldAfter: number;
    armorBefore: number;
    armorAfter: number;
    dodgeBefore: number;
    dodgeAfter: number;
    blockedBy: 'protected' | 'aegis' | null;
    notes: readonly string[];
  };
  knownEffects: readonly string[];
  unknownEffects: readonly string[];
  reasons: readonly string[];
};

export type PreviewDamageSpec = { unknown: true; reason?: string } | {
  unknown?: false; hits: number; retarget?: boolean; amount?: number; unknownEffects?: readonly string[];
};
