// @ts-check
import { clone } from '../core/shared.js';

/** 保留未改变分支的引用，兼容调用方持有的仓库卡堆；修改分支仍是独立草稿。
 * @param {unknown} current @param {unknown} draft @returns {unknown}
 */
function retainUnchanged(current, draft) {
  if (current === draft) return current;
  if (!current || !draft || typeof current !== 'object' || typeof draft !== 'object' ||
      Array.isArray(current) !== Array.isArray(draft)) return draft;
  const before = /** @type {Record<string, unknown>} */ (current);
  const after = /** @type {Record<string, unknown>} */ (draft);
  const keys = Object.keys(after);
  let unchanged = keys.length === Object.keys(before).length;
  for (const key of keys) {
    after[key] = retainUnchanged(before[key], after[key]);
    if (!Object.prototype.hasOwnProperty.call(before, key) || after[key] !== before[key]) unchanged = false;
  }
  return unchanged ? current : draft;
}

/**
 * 单键基地操作：只修改隔离草稿；持久化端口成功后才允许调用方报告成功。
 * 与带 requestId 的跨存档结算不同，本函数不重试、不发布事件、不拥有存档。
 * @template TState, TValue
 * @param {TState} current
 * @param {(draft: TState) => TValue} prepare
 * @param {(draft: TState) => boolean} persist
 * @returns {{ok: true, value: TValue} | {ok: false, code: 'SAVE_FAILED'}}
 */
export function commitBaseMutation(current, prepare, persist) {
  const draft = clone(current);
  const value = prepare(draft);
  // 草稿不能跨异步边界：异步生产者可能在返回后继续改状态。
  if (value && typeof value === 'object' && 'then' in value) {
    throw new TypeError('Base mutations must be synchronous');
  }
  const prepared = /** @type {TState} */ (retainUnchanged(current, draft));
  if (!persist(prepared)) return { ok: false, code: 'SAVE_FAILED' };
  return { ok: true, value };
}
