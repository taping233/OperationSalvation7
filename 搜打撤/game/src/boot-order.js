/* ============================================================
 * boot-order.js —— 模块加载顺序表（2026-09-11 架构批次 5）
 *
 * main.js 的入口装配清单独立合同；tests/contracts.test.js 逐项比对以发现漏载或调序。
 * ESM 依赖先于消费者求值，MAP/FX 等已直接导入的依赖不依靠本表先行发布。
 * 仍有页面在模块求值时读取 SDT.UI 等兼容入口，因此保留整体装配顺序合同。
 *
 * 依赖方向口诀：底座（随机/规则/数据/渲染原语）→ 玩法数据 → 战斗 → 局内流程 → 启动
 * ============================================================ */
const BOOT_ORDER = [
  'ui/title-credits', 'ui/title-wallpaper', // 保持原 HTML 的首页展示装配先于游戏入口
  'ui/ui-scale',   // 全局 UI 缩放须在游戏首帧渲染前挂 zoom
  'core/random', 'core/rules', 'core/mapData', 'core/art', 'core/icons-bitmap', 'audio/sound',
  'core/camera', 'core/motion', 'core/input',
  'core/event-bus', 'core/notes', 'cards/cards', 'battle/core/combat', 'hub/base', 'hub/meta',
  'core/render-scheduler', 'core/renderer.fx',
  'core/renderer', 'ui/ui', 'ui/term-tips', 'ui/character-idle', 'core/shared', 'battle/battle-loader', 'run/chests',   // term-tips=词条讲解浮框（09-20 上线时漏登记，2026-09-22 补）；character-idle=选人页待机演出（自挂载监听 sdt-overlay-mode）
  'hub/game.storage', 'hub/game.store', 'run/game.session', 'run/game.nest', 'run/game.run',
  'hub/game.hub', 'hub/game.bag',
  'hub/game.notes', 'hub/game.cardslib', 'game.boot',
  'ui/startup-transition', 'ui/cover-context',
];

export { BOOT_ORDER };
