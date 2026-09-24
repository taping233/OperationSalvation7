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

/* —— 域内聚合接口（2026-09-24 状态袋打薄试点）：散 set$Xxx 调用收敛到本域 —— */
export function bindBattleRenderer(renderer) { renderBattle = renderer; }
export function showDread() { dreadShown = true; }
export function hideDread() { dreadShown = false; }
export function takeBattleFloats() { const list = floats; floats = []; return list; }
export function takeBattleCardAnims() { const list = cardAnims; cardAnims = []; return list; }
export function clearBattlePresentation() { floats = []; cardAnims = []; }
export function resetBattlePresentation() { floats = []; cardAnims = []; presentationActionSeq = 0; }
export function nextActionSeq() { presentationActionSeq += 1; return presentationActionSeq; }
export function storeBattleSnapshot(sig, snap) { snapSig = sig; snapCache = snap; }
