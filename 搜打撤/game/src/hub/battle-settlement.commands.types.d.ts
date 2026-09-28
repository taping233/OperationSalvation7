export type BattleSettlementNode = {
  readonly layerIdx: number;
  readonly trackPos: number;
  readonly isBoss: boolean;
  readonly encounterId?: string | null;
};

export type BattleSettlementContext = {
  readonly slotId: number;
  readonly requestId: string;
  readonly expectedBaseRevision: number;
  readonly expectedRunRevision: number;
};

export type BattleSettlementPayload = {
  readonly layerIdx: number;
  readonly trackPos: number;
  readonly isBoss: boolean;
  readonly encounterId: string | null;
};

export type BattleVictoryProgressInput = {
  readonly foeNames: readonly string[];
  readonly isBoss: boolean;
  readonly classId: string;
  readonly xpMultiplier: number;
};

export type BattleVictoryProgressOutput = {
  readonly levelUps: readonly { readonly classId: string; readonly levels: readonly number[] }[];
};

export type BattleSettlementOutput = {
  readonly eggBattles: number;
  readonly progression?: BattleVictoryProgressOutput;
};

export type BattleSettlementReceipt = {
  readonly requestId: string;
  readonly command: 'battle.win';
  readonly baseRevision: number;
  readonly runRevision: number;
  readonly runId: string;
  readonly output: BattleSettlementOutput;
};

export type BattleSettlementRunSnapshot = {
  readonly layerIdx: number;
  readonly trackPos: number;
  readonly visited: Readonly<Record<string, number | boolean>>;
  readonly elapsed?: number;
  readonly [key: string]: unknown;
};

export type BattleSettlementBaseSnapshot = {
  readonly eggBattles?: number;
  readonly stats?: Readonly<Record<string, unknown>>;
  readonly _m01?: { readonly revision?: number; readonly [key: string]: unknown };
  readonly [key: string]: unknown;
};

export type BattleSettlementAttempt = {
  readonly context: BattleSettlementContext;
  readonly command: 'battle.win';
  readonly runId: string;
  readonly payload: BattleSettlementPayload;
  readonly afterBase: BattleSettlementBaseSnapshot;
  readonly afterRun: BattleSettlementRunSnapshot;
  readonly output: BattleSettlementOutput;
};

export type BattleSettlementFailure = {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
  readonly retryable?: boolean;
  readonly details?: unknown;
};
export type BattleSettlementBaseRead =
  | { readonly ok: true; readonly value: BattleSettlementBaseSnapshot; readonly revision: number }
  | BattleSettlementFailure;

export type BattleSettlementSuccess<T> = { readonly ok: true; readonly value: T };
export type BattleSettlementResult<T> = BattleSettlementSuccess<T> | BattleSettlementFailure;
export type BattleSettlementRevisionResult<T> =
  | { readonly ok: true; readonly value: T; readonly revision: number }
  | BattleSettlementFailure;

export type BattleSettlementReceiptLookup =
  | { readonly ok: true; readonly value: null; readonly replay: false }
  | { readonly ok: true; readonly value: BattleSettlementReceipt; readonly replay: true }
  | BattleSettlementFailure;

export type BattleSettlementAttemptResult =
  | { readonly ok: true; readonly replay: false; readonly attempt: BattleSettlementAttempt }
  | { readonly ok: true; readonly replay: true; readonly receipt: BattleSettlementReceipt }
  | BattleSettlementFailure;

export type BattleSettlementCommitResult =
  | { readonly ok: true; readonly replay: boolean; readonly receipt: BattleSettlementReceipt }
  | BattleSettlementFailure;

export type BattleSettlementBasePort = {
  readonly slot: number | null;
  _readForCommit(slotId: number): BattleSettlementBaseSnapshot | null;
  issue(slotId: number): string | null;
};

export type BattleSettlementRunIdentity = { readonly runId: string; readonly revision: number };
export type BattleSettlementRunPort = {
  readIdentity(slotId: number): BattleSettlementResult<BattleSettlementRunIdentity>;
  read(slotId: number): BattleSettlementRunSnapshot | null;
};

export type BattleSettlementRecoveryPort = {
  recoverSlot(slotId: number): Promise<BattleSettlementResult<unknown>>;
  readSettlementReceipt(
    context: BattleSettlementContext,
    identity: { readonly command: string; readonly payload: BattleSettlementPayload; readonly runId: string },
  ): Promise<BattleSettlementRevisionResult<BattleSettlementReceipt | null>>;
  commitBaseAndRun(
    context: BattleSettlementContext,
    prepared: {
      readonly command: 'battle.win';
      readonly runId: string;
      readonly payload: BattleSettlementPayload;
      readonly afterBase: BattleSettlementBaseSnapshot;
      readonly afterRun: BattleSettlementRunSnapshot;
      readonly output: BattleSettlementOutput;
    },
  ): Promise<BattleSettlementResult<BattleSettlementReceipt>>;
};

export type BattleSettlementCommands = {
  readReceipt(input: { readonly slotId: number; readonly node: BattleSettlementNode }): Promise<BattleSettlementReceiptLookup>;
  createAttempt(input: {
    readonly slotId: number;
    readonly node: BattleSettlementNode;
    readonly afterRun: BattleSettlementRunSnapshot;
    readonly elapsedDelta: number;
    readonly victoryProgress?: BattleVictoryProgressInput;
  }): Promise<BattleSettlementAttemptResult>;
  commitAttempt(attempt: BattleSettlementAttempt): Promise<BattleSettlementCommitResult>;
};

export type CreateBattleSettlementCommandsOptions = {
  getBase(): BattleSettlementBasePort;
  getRunStorage(): BattleSettlementRunPort;
  getRecovery(): BattleSettlementRecoveryPort;
  getActiveSlot(): number | null;
};
