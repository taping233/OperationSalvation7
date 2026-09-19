/* ============================================================
 * boot-order.js —— 模块加载顺序表（2026-09-11 架构批次 5）
 *
 * main.js 的副作用导入按此顺序执行（ESM 只保证按书写顺序执行副作用导入），
 * 顺序错了会出现「SDT.X undefined」类启动故障。本表是顺序的唯一事实来源，
 * main.js 照抄，tests/contracts.test.js 逐项比对防止被无意调换。
 *
 * 依赖方向口诀：底座（随机/规则/数据/渲染原语）→ 玩法数据 → 战斗 → 局内流程 → 启动
 * ============================================================ */
const BOOT_ORDER = [
  'random', 'rules', 'mapData', 'art', 'icons-bitmap', 'sound', 'camera', 'motion', 'input',
  'event-bus', 'notes', 'cards', 'combat', 'base', 'meta', 'render-scheduler', 'renderer.fx',
  'renderer', 'ui', 'shared',
  'battle.effects', 'battle.core', 'battle.view', 'chests',
  'game.storage', 'game.store', 'game.session', 'game.nest', 'game.run', 'game.hub', 'game.bag',
  'game.notes', 'game.cardslib', 'game.boot',
];

export { BOOT_ORDER };
export default BOOT_ORDER;
