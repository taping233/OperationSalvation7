export type JsonData =
  | null
  | string
  | number
  | boolean
  | readonly JsonData[]
  | { readonly [key: string]: JsonData };

export interface CardAuxData {
  [field: string]: JsonData;
}

export interface MapRules {
  playerMaxHp: number;
  playerAtk: number;
  bagSize?: number;
  [rule: string]: unknown;
}

/** The store keeps this caller-owned map by reference. */
export interface GameMap {
  rules: MapRules;
  [field: string]: unknown;
}

export interface RuleOperation {
  op: string;
  amount?: number;
  [field: string]: unknown;
}

export interface CardRules {
  version?: number;
  battle?: { [field: string]: JsonData };
  bag?: { [field: string]: JsonData };
  base?: { [field: string]: JsonData };
  triggers?: {
    onPlay?: RuleOperation[];
    [trigger: string]: unknown;
  };
  [domain: string]: unknown;
}

export interface CardSnapshot {
  id?: string;
  name?: string;
  cost?: number;
  type?: string;
  rarity?: string;
  desc?: string;
  value?: number;
  dmg?: number;
  rules?: CardRules;
  meta?: CardAuxData;
  mechanics?: CardAuxData;
  [field: string]: unknown;
}

export interface OwnedCard {
  uid: string;
  card: CardSnapshot;
  safe?: boolean | number;
  brought?: boolean | number;
  [field: string]: unknown;
}

export interface UsedPocketEntry {
  card: CardSnapshot;
  count: number;
  [field: string]: unknown;
}

export interface ShopSlot {
  card?: CardSnapshot;
  price?: number;
  sold?: boolean;
  free?: boolean;
  empty?: boolean;
  label?: string;
  mystery?: boolean;
  shaReplenish?: number;
  [field: string]: unknown;
}

export interface NestShopStock {
  cardSlots: { card: CardSnapshot | null; price: number; sold: boolean }[];
  classSlots: { card: CardSnapshot | null; price: number; sold: boolean }[];
  runeSlots: { rune: Rune; price: number; sold: boolean }[];
}

export interface InventorySlot {
  name: string;
  value: number;
  tier: string;
  count: number;
  [field: string]: unknown;
}

export interface EntrySupply {
  version: 1;
  layerIdx: 0;
  trackPos: number;
  cardIds: string[];
  taken: number[];
  entered?: boolean;
}

export type NodeReward = { version: 1; settled?: boolean; actionChoice?: number;
  altarFragmentChoice?: { characterId: string; cardIds: [string]; taken: null | 0 } } & (
  | { type: 'closed' }
  | { type: 'altar' }
  | { type: 'resource'; cardIds: string[]; taken: number | null }
  | { type: 'event'; eventId: string }
  | { type: 'event-choice'; eventId: 'ev19-potions' | 'ev19-quartermaster';
      cardIds: string[]; paidCoins: number; taken: number | null }
  | { type: 'fire'; hpBefore: number; hpAfter: number; hpGain: number;
      restoredIds: string[]; classCardId: string | null; bonusReceived: boolean; continued?: boolean;
      healUsed?: boolean; restoreUsed?: boolean; bonusRolled?: boolean }
  | { type: 'restore'; source: 'altar-reward' | 'altar-offering'; total: number;
      left: number; restoredIds: string[]; hpBefore: number; hpAfter: number;
      hpGain: number; finished: boolean }
);

/** Mutable session data for pending records whose schemas are owned by their feature. */
export type SessionData = null | undefined | string | number | boolean
  | SessionData[] | { [key: string]: SessionData };

export interface Point { x: number; y: number }
export interface CellDefinition { type: string; name: string; extraction?: boolean; n?: number }
export interface RuntimeLayer {
 id: string; name: string; nameEn: string; color: string; generatorVersion: number; layoutVersion: number;
 gridBounds: {minX: number; maxX: number; minRow: number; maxRow: number};
 nodes: {id: string; li: number; idx: number; x: number; row: number; type: string; name: string; next: [number,number][]; extraction: boolean}[];
 logical: {grid: Point[]; fire: boolean; oldIdx: number; def: CellDefinition; id: string; row: number; x: number; next: [number,number][]}[];
 entrances: number[]; entranceNames: string[]; exit: number;
 doors: {pair: string; at: number; toLayer: number; arriveAt: number; exit: boolean; reverse?: boolean}[];
 altarEntrances: number[]; toLogical?: Map<number,number>;
}
export interface LayerBounds { minX: number; maxX: number; minY: number; maxY: number; gridBounds: Partial<RuntimeLayer['gridBounds']> }
export interface RuntimeNode extends Point { li: number; idx: number; def: CellDefinition }
export interface Rune { kind: string; name: string; rarity: string; attrs: string[]; desc: string }
export interface CameraMotion {mode: string; cx:number; cy:number; zoom:number}
export interface CameraPort {
 cx: number; cy: number; zoom: number; viewW: number; viewH: number; frameMode: string; angle?: number;
 resize(w:number,h:number):void;
 beginPan():void; endPan(allowed?: ()=>boolean):void; cancelPan(clamp?:boolean):void;
 panBy(dx:number,dy:number):void; zoomAt(x:number,y:number,factor:number):void;
 clamp():void;
 frameExploration(game:GameState, overview?:boolean, options?:{glide?:boolean,dur?:number}):boolean;
 updateTravel(motion:CameraMotion, point:Point, ahead:Point, deltaMs:number):void;
 endTravel(motion:CameraMotion, game:GameState, animate?:boolean):void;
 worldToScreen(x: number,y: number): Point;
 screenToWorld(x: number,y: number): Point;
 beginTravel(): CameraMotion;
 focus(x: number,y: number): void;
 glideTo(x: number,y: number,options?: {zoom?: number; dur?: number}): unknown;
}
export interface ExtractionPending {
 version: 1; runId: string; phase: 'organizing'; requestSeq: number;
 sourceIdentityVersion?: 1;
 remainingCards: {card: CardSnapshot; count: number; variantKey?: string}[];
 keptPocket: {card: CardSnapshot; count: number; variantKey?: string}[];
 totalPocketCount: number; lostPocketCount: number;
 resources: {wood: number; rations: number};
}
export interface RoutePlan {layerIndex: number; status: string; fallbackReason?: string; startNodeId?: string; rejoinNodeId?: string; supplyNodeId?: string; riskNodeId?: string}

export interface NestEnemy {
  id: string; name: string; atk: number; hp?: number; hearts?: number;
  heartsMode?: boolean; noFirstAttack?: boolean; phases?: boolean; boss?: boolean;
  revive?: { hearts: number; atk: number }; affix?: string;
  adds?: NestEnemy[];
}
export interface GameState {
  /** Fields installed by the session, map adapter and feature modules after store creation. */
  mapSeed?: string | number;
  generatorVersion?: number;
  layoutVersion?: number;
  routeVersion?: string;
  routePlan?: RoutePlan;
  layerData?: RuntimeLayer[];
  nodePos?: Point[][];
  centerPos?: Point[];
  layerBounds?: LayerBounds[];
  activeLayerBounds?: LayerBounds;
  geometryVersion?: string;
  doorKeys?: Set<string>;
  nodes?: RuntimeNode[];
  cellDefs?: Map<string, RuntimeNode>;
  visited?: Record<string, boolean | number>;
  seen?: Record<string, number>;
  explored?: Record<string, number>;
  eventLog?: { name: string; text?: string; time?: number }[];
  fragments?: number;
  altarActivated?: boolean;
  altarRewardPending?: boolean;
  altarItemSacrificed?: boolean;
  bossKilled?: boolean;
  bossPlan?: number;
  surrenderedRun?: boolean;
  chainMove?: number;
  encounterRotationVersion?: number;
  myClass?: string;
  classCard?: CardSnapshot;
  cardBox?: CardSnapshot[];
  nestActive?: boolean;
  nestPos?: number;
  nestRunes?: Rune[];
  nestEquipped?: Rune[];
  nestBoss?: NestEnemy;
  nestBossName?: string;
  nestTargetedBox?: number;
  nestAltarChoice?: {position:9; remaining:number} | null;
  nestShopStocks?: Record<string, NestShopStock>;
  nestKills?: number;
  nestBossDown?: boolean;
  nodeChestRewards?: Record<string, object>;
  extractionPending?: {slotId: number; runId: string} | false;
  terminalPending?: unknown;
  cam?: CameraPort;
  camDragging?: boolean;
  devMode?: boolean;
  debug?: object;
  noteMap?: Map<string, { type?: string; name?: string; note?: string }>;
  TYPE_NAME?: Record<string, string>;
  getSnapshot?: () => GameSnapshot;
  curLayer?: () => RuntimeLayer;
  log?: (text: string, kind?: string) => void;
  bagCap?: () => number;
  safeCap?: () => number;
  usedSlots?: () => number;
  safeUsed?: () => number;
  bagCapacityText?: () => string;
  stackCapOf?: (card: CardSnapshot) => number;
  canAcceptCard?: (card: CardSnapshot) => boolean;
  canReceiveCard?: (card: CardSnapshot) => boolean;
  gainCoins?: (amount: number) => void;
  addItem?: (item: { name: string; value?: number; tier?: string }, count?: number,
    options?: { deferFeedback?: (feedback: () => void) => void }) => InventorySlot;
  heal?: (amount: number, options?: { deferFeedback?: (feedback: () => void) => void }) => void;
  damage?: (amount: number, reason?: string) => void;
  grantCard?: (card: CardSnapshot, options?: {silent?: boolean; reason?: string; deferAcquiredCard?: (card: CardSnapshot) => void}) => boolean;
  discardCard?: (name: string, fromSafe?: boolean, uid?: string) => boolean | Promise<boolean>;
  onBattleEnd?: (options: object, playedUids: string[], win: boolean, consumedUids?: string[]) => Promise<boolean | void>;
  onNestBattleEnd?: (options: object, playedUids: string[], win: boolean, consumedUids?: string[]) => boolean | void | Promise<boolean | void>;
  persistSave?: () => boolean | void | Promise<boolean | void>;
  saveGame?: () => boolean;

  map: GameMap;
  toggles: Record<string, boolean>;
  rings: unknown[];
  layerIdx: number;
  trackPos: number;
  pos: { x: number; y: number };
  hop: number;
  state: string;
  turn: number;
  coins: number;
  hp: number;
  maxHp: number;
  atk: number;
  mode: string;
  characterId: string | null;
  runActive: boolean;
  seed: string | number | null;
  battleActive: boolean;
  ownedCards: OwnedCard[];
  cardOrder: string[];
  usedPocket: UsedPocketEntry[];
  shopStock: ShopSlot[];
  shopStocks?: Record<string, ShopSlot[]>;
  nodeRewards?: Record<string, NodeReward>;
  entrySupply?: EntrySupply | null;
  pendingEventLoot?: { text: string; chests: string[]; items?: {name: string; value?: number; tier?: string; count?: number}[] } | null;
  pendingExtraction?: ExtractionPending | null;
  pendingRunePick?: Rune[] | null;
  inventory: InventorySlot[];
  discoveredPairs: Set<string>;
  altarFrom: { li: number; idx: number };
  hover: { li: number; idx: number };
  moveTarget: { li: number; idx: number; seq?: number; progress?: number; moving?: boolean; cameraOwned?: boolean };
  time: number;
  elapsed: number;
  elapsedSynced: number;
  elapsedTimeBaseline?: number;
}

export type SnapshotShopStock = {
  readonly [stockKey: string]: readonly DeepReadonly<ShopSlot>[];
};

export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T
  : T extends readonly (infer Element)[] ? readonly DeepReadonly<Element>[]
  : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

/**
 * Plain session data (including future runtime-added plain fields) is copied and
 * frozen recursively. Unknown fields have no typed API until declared here.
 * map, altarFrom, hover and moveTarget retain references; rings copies rows only.
 * Functions, accessors and non-plain objects are opaque runtime ports: their
 * internals are neither traversed nor frozen, including inside plain extensions.
 */
export type GameSnapshot = Omit<DeepReadonly<GameState>,
  'map' | 'altarFrom' | 'hover' | 'moveTarget' | 'cam' |
  'toggles' | 'rings' | 'pos' | 'ownedCards' | 'cardOrder' | 'usedPocket' |
  'shopStock' | 'shopStocks' | 'inventory' | 'discoveredPairs' | 'nodeRewards' |
  'entrySupply' | 'pendingEventLoot' | 'pendingExtraction' | 'pendingRunePick'>
  & Pick<Readonly<GameState>, 'map' | 'altarFrom' | 'hover' | 'moveTarget' | 'cam'> & {
    readonly toggles: Readonly<Record<string, boolean>>;
    readonly rings: readonly Readonly<unknown>[];
    readonly pos: Readonly<{ x: number; y: number }>;
    readonly ownedCards: readonly DeepReadonly<OwnedCard>[];
    readonly cardOrder: readonly string[];
    readonly usedPocket: readonly DeepReadonly<UsedPocketEntry>[];
    readonly shopStock: readonly DeepReadonly<ShopSlot>[];
    readonly shopStocks?: SnapshotShopStock;
    readonly inventory: readonly DeepReadonly<InventorySlot>[];
    readonly nodeRewards?: DeepReadonly<Record<string, NodeReward>>;
    readonly entrySupply?: DeepReadonly<EntrySupply> | null;
    readonly pendingEventLoot?: DeepReadonly<GameState['pendingEventLoot']>;
    readonly pendingExtraction?: DeepReadonly<GameState['pendingExtraction']>;
    readonly pendingRunePick?: DeepReadonly<GameState['pendingRunePick']>;
    readonly discoveredPairs: readonly string[];
  };
