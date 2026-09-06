/**
 * 游戏会话兼容门面。
 *
 * 旧模块继续从 game.core.js 导入；实际状态与流程实现在 game.store.js、
 * game.storage.js 和 game.session.js。此文件不访问 DOM，也不反向依赖功能视图。
 */
export * from './game.session.js';
