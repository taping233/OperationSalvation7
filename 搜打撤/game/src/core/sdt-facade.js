/* ============================================================
 * sdt-facade.js —— window.SDT 全局门面的唯一初始化点
 *
 * 全项目只允许这里出现 `window.SDT = ...`（contracts.test.js 强制）。
 * 模块挂载：调用本文件导出的 sdtDefine；只读消费：默认导入本文件
 * （拿到的是同一对象引用，运行时可读后续模块挂载的属性）。
 * 门面定位：桌面调试、devTools 与既有测试的兼容层；模块内部新代码
 * 优先使用 ESM 显式 import。
 * ============================================================ */
const SDT = (typeof window !== 'undefined') ? (window.SDT = window.SDT || {}) : {};

export function sdtDefine(name, value) {
  SDT[name] = value;
  return value;
}

export default SDT;
