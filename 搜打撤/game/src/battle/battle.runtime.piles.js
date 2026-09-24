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
