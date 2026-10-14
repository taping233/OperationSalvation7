/* 局内流程薄装配壳：保持公共导出稳定，具体流程按依赖方向落在 scenes/altar/flow/dev。 */
import { game } from './game.session.js';
import { grantEventCard, openShop, showRunTransition, resumeChestsOnCell } from './game.run.scenes.js';
import { openClassChoice } from './game.run.altar.js';
import { moveTo, reenterCell } from './game.run.flow.js';
import {
  devForceBattle as devForceBattleImpl,
  devJumpNode as devJumpNodeImpl,
  openDevConsole as openDevConsoleImpl,
} from './game.run.dev-loader.js';

// 循环导入下模块体可能早于 game.session 完成，延迟到 boot 统一绑定兼容挂载面。
function bindRunMixins() {
  game.grantCard = grantEventCard;
}

// 保留历史公共函数名；首次请求才装载开发实现，Agent 同步门面不受影响。
function devForceBattle(...args) { return devForceBattleImpl(...args); }
function devJumpNode(...args) { return devJumpNodeImpl(...args); }
function openDevConsole(...args) { return openDevConsoleImpl(...args); }

export { bindRunMixins, moveTo, reenterCell, openClassChoice, openShop, showRunTransition, resumeChestsOnCell, devForceBattle, devJumpNode, openDevConsole };
