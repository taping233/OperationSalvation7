/* 局内流程薄装配壳：保持公共导出稳定，具体流程按依赖方向落在 scenes/altar/flow/dev。 */
import { game } from './game.session.js';
import { grantEventCard, openShop, showRunTransition, resumeChestsOnCell } from './game.run.scenes.js';
import { openClassChoice } from './game.run.altar.js';
import { moveTo, reenterCell, resumeEventCardChoice } from './game.run.flow.js';
import { devForceBattle, devJumpNode, openDevConsole } from './game.run.dev-loader.js';

// 循环导入下模块体可能早于 game.session 完成，延迟到 boot 统一绑定兼容挂载面。
function bindRunMixins() {
  game.grantCard = grantEventCard;
}

export { resumeEventCardChoice, bindRunMixins, moveTo, reenterCell, openClassChoice, openShop, showRunTransition, resumeChestsOnCell, devForceBattle, devJumpNode, openDevConsole };
