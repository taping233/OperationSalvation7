/* battle.runtime.js —— 战斗运行态兼容入口。
 * 每组状态在对应 runtime.* 模块中声明和重绑；这里的 ESM 重导出保留原具名导入的活绑定。
 * 新代码可按属地导入，现有消费者继续从本入口读状态并调用 set$Xxx(v)。 */
export * from './battle.runtime.session.js';
export * from './battle.runtime.piles.js';
export * from './battle.runtime.interaction.js';
export * from './battle.runtime.effects.js';
export * from './battle.runtime.presentation.js';