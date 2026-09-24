/* 牌区、卡牌临时覆盖和装备的战斗内状态。由 battle.runtime.js 转发活绑定。 */
export let drawPile = [], hand = [], discard = [], granted = [];
export let played = [], consumed = [];
export let grave = [];
export let delayed = [];
export let noDrawNext = false;
export let lastDrawnUids = [];
export let zeroFeeUntil = new Map();
export let cardOverrides = new Map();
export let equipped = [];
export let freeCast = new Set();

export function set$drawPile(v) { drawPile = v; }
export function set$hand(v) { hand = v; }
export function set$discard(v) { discard = v; }
export function set$granted(v) { granted = v; }
export function set$played(v) { played = v; }
export function set$consumed(v) { consumed = v; }
export function set$grave(v) { grave = v; }
export function set$delayed(v) { delayed = v; }
export function set$noDrawNext(v) { noDrawNext = v; }
export function set$lastDrawnUids(v) { lastDrawnUids = v; }
export function set$zeroFeeUntil(v) { zeroFeeUntil = v; }
export function set$cardOverrides(v) { cardOverrides = v; }
export function set$equipped(v) { equipped = v; }
export function set$freeCast(v) { freeCast = v; }

/* —— 域内聚合接口（2026-09-24 状态袋打薄试点）：散 set$Xxx 调用收敛到本域。
 * 同一域内多变量的整组重置/还原合并为一次调用；赋值顺序在域内保持原调用点的相对次序。 */
export function clearBattlePiles() {
  drawPile = []; discard = []; granted = []; played = []; consumed = []; grave = [];
}
export function restoreBattlePiles(data) {
  hand = [...(data.hand || [])];
  drawPile = [...(data.drawPile || [])];
  discard = [...(data.discard || [])];
  grave = [...(data.grave || [])];
  played = [...(data.played || [])];
  consumed = [...(data.consumed || [])];
  granted = (data.granted || []).map(g => ({ uid: g.uid, card: { ...g.card } }));
}
export function restorePilesBookkeeping(data) {
  delayed = (data.delayed || []).map(d => ({ ...d }));
  noDrawNext = !!data.noDrawNext;
  lastDrawnUids = [...(data.lastDrawnUids || [])];
  zeroFeeUntil = new Map(data.zeroFeeUntil || []);
  cardOverrides = new Map(data.cardOverrides || []);
}
export function resetPilesCarryover() {
  delayed = []; noDrawNext = false; lastDrawnUids = [];
}
export function resetCastOverrides() {
  zeroFeeUntil = new Map(); cardOverrides = new Map();
}
