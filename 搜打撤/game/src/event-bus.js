/* ============================================================
 * event-bus.js —— 模块间事件总线（2026-09-11 架构批次 5）
 *
 * 用途：生产方只负责「广播发生了什么」，不再直接持有消费方的函数引用；
 * 消费方按需订阅。首批接入点：battle:end（战斗结束广播，战斗核心不再直接
 * 依赖 game.onBattleEnd 的实现，见 battle.core.js / game.bag.js）。
 *
 * 约定：
 *   - 同步派发，按订阅顺序执行；单个订阅者抛错只打日志，不影响其它订阅者（也不会被摘除）。
 *   - emit 返回成功执行的订阅者数量，调用方可据此决定是否走旧回退路径。
 *   - 只做通知，不做状态查询——需要同步取值的场景（如开箱挂起/恢复）不要用总线。
 * ============================================================ */
import { sdtDefine } from './sdt-facade.js';

const listeners = new Map();   // event -> Set<fn>

function on(event, fn) {
  if (typeof fn !== 'function') throw new TypeError('[Bus] on(event, fn) 需要函数');
  let set = listeners.get(event);
  if (!set) { set = new Set(); listeners.set(event, set); }
  set.add(fn);
  return () => off(event, fn);   // 返回退订句柄
}

function off(event, fn) {
  const set = listeners.get(event);
  if (!set) return;
  set.delete(fn);
  if (!set.size) listeners.delete(event);
}

function emit(event, ...args) {
  const set = listeners.get(event);
  if (!set || !set.size) return 0;
  let served = 0;
  for (const fn of [...set]) {
    if (!set.has(fn)) continue;   // 派发过程中被退订的跳过
    try { fn(...args); served++; }
    catch (e) { console.error(`[Bus] ${event} 订阅者异常:`, e); }
  }
  return served;
}

// 测试用：清空全部订阅（生产代码不要调用）
function reset() { listeners.clear(); }

const Bus = { on, off, emit, reset, listeners: () => new Map(listeners) };
sdtDefine('Bus', Bus);
export { on, off, emit, reset };
export default Bus;
