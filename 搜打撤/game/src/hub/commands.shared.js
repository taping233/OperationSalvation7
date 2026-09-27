/* commands.shared.js —— 终端命令家族共享管件（2026-09-25 F02 收敛）。
 * base / collection / extraction / preparation / recovery / terminal / home / story
 * 八个命令文件此前各自手抄 clone / fail / stable / validSlot / freezeDeep，
 * 且已漂移（structuredClone vs JSON 深拷贝、fail 有无 details 位）——
 * 现收进本模块作单一真源；新增命令文件只从这里导入，不再手抄管件。
 * 本模块保持零依赖：命令家族谁先加载都能用，不参与任何加载顺序。 */

/** 深拷贝：调用方保证输入为 JSON 安全数据；返回类型沿用该输入类型。 */
/** @template T @param {T} value @returns {T} */
export const clone = value => JSON.parse(JSON.stringify(value));

/** 命令失败结果；details 仅在传入时附带，省略时结果对象不含该键。 */
/** @param {string} code @param {string} message @param {boolean} [retryable=false] @param {unknown} [details] @returns {{ ok: false, code: string, message: string, retryable: boolean, details?: unknown }} */
export const fail = (code, message, retryable = false, details) => ({
  ok: false, code, message, retryable, ...(details ? { details } : {}),
});

/** @template TOutput @typedef {{ requestId: string, command: string, baseRevision: number, runRevision: number, runId: string, output: TOutput }} TransactionReceiptValue */

/** @template TOutput @param {TransactionReceiptValue<TOutput>} value @param {number} revision @returns {{ ok: true, value: TransactionReceiptValue<TOutput>, revision: number }} */
export const successReceipt = (value, revision) => ({ ok: true, value, revision });

/** 幂等指纹：键排序后的稳定字符串（基地事务与恢复日志共用同一口径）。 */
/** @param {unknown} value @returns {string | undefined} */
export const stable = value => Array.isArray(value) ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(/** @type {Record<string, unknown>} */ (value)[key])}`).join(',')}}`
    : JSON.stringify(value);

/** 档位校验：1～5 号存档槽。 */
/** @param {number} slotId @returns {boolean} */
export const validSlot = slotId => Number.isInteger(slotId) && slotId >= 1 && slotId <= 5;

/** 就地深冻结（已冻结值原样返回；类型沿用输入，不声明静态深只读契约）。 */
/** @template T @param {T} value @returns {T} */
export function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return /** @type {T} */ (Object.freeze(value));
}
