// 局内普通保存是检查点：失败不回滚已经完成的内存结算，由调用方保留页面并提示重试。
// 等待保存端口实际完成；undefined 兼容未绑定档位和旧端口，false 或异常表示失败。
/** @param {() => unknown} save */
export async function saveRunCheckpoint(save) {
  try { return await save() !== false; }
  catch { return false; }
}
