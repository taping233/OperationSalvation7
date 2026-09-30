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

export interface InventorySlot {
  name: string;
  value: number;
  tier: string;
  count: number;
  [field: string]: unknown;
}

export interface GameState {
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
  inventory: InventorySlot[];
  discoveredPairs: Set<string>;
  altarFrom: unknown;
  hover: unknown;
  moveTarget: unknown;
  time: number;
  elapsed: number;
  elapsedSynced: number;
}

export type SnapshotShopStock = {
  readonly [stockKey: string]: readonly DeepReadonly<ShopSlot>[];
};

export type DeepReadonly<T> = T extends (...args: never[]) => unknown ? T
  : T extends readonly (infer Element)[] ? readonly DeepReadonly<Element>[]
  : T extends object ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
  : T;

/**
 * Store-owned data is read-only; map, rings, hover and moveTarget preserve their
 * runtime reference semantics and therefore retain their explicitly shallow types.
 */
export type GameSnapshot = Omit<Readonly<GameState>,
  'toggles' | 'rings' | 'pos' | 'ownedCards' | 'cardOrder' | 'usedPocket' |
  'shopStock' | 'shopStocks' | 'inventory' | 'discoveredPairs'> & {
    readonly toggles: Readonly<Record<string, boolean>>;
    readonly rings: readonly Readonly<unknown>[];
    readonly pos: Readonly<{ x: number; y: number }>;
    readonly ownedCards: readonly DeepReadonly<OwnedCard>[];
    readonly cardOrder: readonly string[];
    readonly usedPocket: readonly DeepReadonly<UsedPocketEntry>[];
    readonly shopStock: readonly DeepReadonly<ShopSlot>[];
    readonly shopStocks?: SnapshotShopStock;
    readonly inventory: readonly Readonly<InventorySlot>[];
    readonly discoveredPairs: readonly string[];
  };
