// 保存结果统一为 boolean；业务所有者负责已完成结算或可恢复操作的后续处理。
// 同步端口同步完成，异步端口等待结果；undefined沿用旧端口约定，false或异常表示失败。
/**
 * @template T
 * @param {() => unknown} save
 * @param {(saved:boolean) => T} complete
 * @returns {T | Promise<T>}
 */
export function completeRunCheckpoint(save, complete) {
  let result, asynchronous;
  try {
    result = save();
    asynchronous = result && typeof /** @type {{then?:unknown}} */ (result).then === 'function';
  } catch { return complete(false); }
  return asynchronous
    ? Promise.resolve(result).then(saved => complete(saved !== false), () => complete(false))
    : complete(result !== false);
}

// 普通检查点保存失败时，由原结算所有者保留当前结果并提供重试。
/** @param {() => unknown} save */
export async function saveRunCheckpoint(save) {
  return completeRunCheckpoint(save, saved => saved);
}
