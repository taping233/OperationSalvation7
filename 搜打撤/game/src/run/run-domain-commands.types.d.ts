import type { CardSnapshot, OwnedCard } from '../hub/game.store.types';

export type RunCard = CardSnapshot;
export type RunOwnedCard = OwnedCard & { stored?: boolean };
export type ShopSlot = { card?: RunCard; price:number; sold?:boolean; free?:boolean; empty?:boolean; shaReplenish?:number; commissionFree?:boolean; mystery?:boolean };
export type ShopQuote = { slot:ShopSlot; card?:RunCard; price:number; free?:boolean; replenish:boolean };
export type ShopState = { coins:number; ownedCards:RunOwnedCard[]; shopStock:ShopSlot[] };
export type TradeRejected = { ok:false; reason:string };
export type TradeAccepted = { ok:true; entry:RunOwnedCard; price:number; saved:boolean; bonusReward?:object };
export type TradeResult = TradeRejected | TradeAccepted;
export type ShopPorts = {
  state:ShopState;
  canReceive:(card:RunCard) => boolean;
  newUid:() => string;
  isSellable:(card:RunCard) => boolean;
  sellPrice:(card:RunCard) => number;
  save:() => unknown;
  prepareAcquiredReward?:(card:RunCard) => { snapshot:object; commit:() => void; current?:() => boolean } | null;
};
export type BuyInput = { index:number; quote:ShopQuote; replenish?:boolean; current?:() => boolean };
export type SellInput = { uid:string; quote:{ owned:RunOwnedCard; card:RunCard }; current?:() => boolean };
export type CommissionInput = {
  stock:ShopSlot[]; pending:{ status:string; slots:number[] }; starter?:RunCard;
  quotes:{ slot:ShopSlot; card?:RunCard }[]; current:() => boolean; save:() => unknown;
};
export type EventRecord = { version?:number; type?:string; eventId?:string; settled?:boolean; actionChoice?:number; taken?:number | null; cardIds?:string[] };
export type EventState = {
  coins:number; fragments?:number; hp:number; maxHp:number; ownedCards:RunOwnedCard[];
  seed?:number|string|null; layerIdx:number; trackPos:number; visited?:Record<string, unknown>;
  nodeRewards?:Record<string, EventRecord>;
};
export type EventPorts = {
  state:EventState;
  gainCoins?:(amount:number) => unknown;
  heal?:(amount:number) => unknown;
  damage?:(amount:number, reason:string) => unknown;
  grantCard?:(card:RunCard, options:{silent:boolean}) => unknown;
  canRecode?:(entries:RunOwnedCard[], cards:RunCard[]) => boolean;
};
export type SpendInput = { current?:() => boolean; receipt?:Record<string, unknown>; field?:string; value?:unknown };
export type ChoiceInput = { record:EventRecord & { taken:number | null; cardIds:string[] }; key:string; index:number; card:RunCard; current:() => boolean };
export type RecodeSource = { uid:string; id?:string; name?:string; type?:string; rarity?:string };
export type RewardSnapshot = { seed?:number|string|null; layerIdx:number; trackPos:number };
export type EventSettlementInput = {
  state:EventState; record:EventRecord | null | undefined; settling:WeakSet<EventRecord>;
  run:() => unknown; consume?:boolean; consumeCell:() => unknown;
  serializeReward?:(state:EventState) => RewardSnapshot | null | undefined;
};
