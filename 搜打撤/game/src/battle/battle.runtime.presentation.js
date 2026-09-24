/* 渲染回调、飘字、卡牌演出和快照缓存。由 battle.runtime.js 转发活绑定。 */
export let renderBattle = () => {};
export let floats = [];
export let cardAnims = [];
export let presentationActionSeq = 0;
export let dreadShown = false;
export let snapCache = null, snapSig = null;

export function set$renderBattle(v) { renderBattle = v; }
export function set$floats(v) { floats = v; }
export function set$cardAnims(v) { cardAnims = v; }
export function set$presentationActionSeq(v) { presentationActionSeq = v; }
export function set$dreadShown(v) { dreadShown = v; }
export function set$snapCache(v) { snapCache = v; }
export function set$snapSig(v) { snapSig = v; }
