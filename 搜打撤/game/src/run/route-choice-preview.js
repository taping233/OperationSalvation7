/* 路线预览只读取已落盘的计划与当前内容状态，不揭具体奖励、不变更seen/RNG。 */
import { GUARDED_ROUTE_VERSION } from './map-route-v2.js';

export function previousRoutePlan(game) {
  if (game.routeVersion !== GUARDED_ROUTE_VERSION) return game.routePlan;
  return game.routePlan?.status === 'fallback' ? game.routePlan.baseRoutePlan : null;
}
export function routeChoicePreview(game, node, contentState) {
  const plan = game.routePlan, layer = game.layerData?.[game.layerIdx];
  if (game.routeVersion !== GUARDED_ROUTE_VERSION || plan?.status !== 'applied' || game.layerIdx !== 1 || node?.li !== 1
    || layer?.logical?.[game.trackPos]?.id !== plan.forkNodeId || !['incomplete', 'shop-open'].includes(contentState)) return null;
  const id = layer.logical[node.idx]?.id;
  if (id === plan.recoveryNodeId) return layer.logical[node.idx]?.def?.type === 'shop'
    ? { name:'补给支路 · 可往返', hint:'前往商店补给；也可先探索，稍后返回。' }
    : { name:'休整支路 · 可往返', hint:'火堆休整一次；也可先探索，稍后返回。' };
  if (id === plan.guardNodeId) return { name:'先战斗，再搜刮', hint:'这条支路需先完成1场战斗，再到物资点；可跳过，也可原路返回。' };
  return null;
}
