/* ============================================================
 * shared.js —— 全局共享垫片（最先加载）
 *
 * 本文件现在是纯工具模块（零依赖、无顶层门面解引用）：任何模块可在
 * 任意求值时点安全导入。历史注释（普通 script 顶层作用域共享）对应
 * ESM 化之前的旧架构，SDT/UI 顶层快照已删（2026-09-28：全仓无消费方，
 * 且顶层解引用 window.SDT.UI 会让导入方背上求值顺序负担）。
 * ============================================================ */
// 口径统一（2026-09-28 代码线）：esc/escAttr 均转义 & < > " ' 五字符（此前 esc 只转
// 三个，与 art.js/icons-bitmap.js/expedition.view.js/preparation.view.js 的本地满配版
// 同名不同义，属已发生的口径漂移）。引号转义对文本节点渲染无差、对属性拼接更安全，
// 是纯收紧不是行为变化。5 处实现语义一致；本地实现收敛为 import 需动 shared 的
// 求值时点（本文件顶层解引用 window.SDT.UI），暂不动 import 图，由
// tests/esc-semantics.test.js 做漂移守卫。
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const escAttr = (s) => esc(s);

// 深拷贝唯一权威（2026-09-28 自 hub/commands.shared.js 下沉）：空值直返不动
// （battle.engine cloneData 语义，严格超集——undefined 入参原实现会抛错）。
// 放 core 层让 battle 域也能用（架构禁 battle→hub 反向依赖），
// hub/commands.shared.js 转发导出保持八个命令文件 import 面不变。
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export { clone, esc, escAttr };