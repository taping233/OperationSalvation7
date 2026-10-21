// 局内普通保存是检查点：失败不回滚已经完成的内存结算，由调用方保留页面并提示重试。
// undefined 兼容未绑定档位和旧保存端口；只有明确 false 或同步异常表示保存失败。
/** @param {() => unknown} save */
export function saveRunCheckpoint(save) {
  try { return save() !== false; }
  catch { return false; }
}
