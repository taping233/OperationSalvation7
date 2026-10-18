/* battle.engine 导出面守卫（治理批次 3）。
 *
 * battle.engine.js 是战斗域唯一公共门面：run/ui 经 battle-loader 间接消费，
 * 域内模块与测试直接按名导入。本守卫把「具名导出集合」钉死——瘦身/重构过程中
 * 增删任何一个导出名都会红灯，逼着改动者显式更新基线并核对消费方。
 * 基线取自治理批次 3 开工前（HEAD 工作区）的导出面快照；回合结束续接增加
 * deferEndTurn / hasPendingEndTurn，供 battle.enemy-phase 按名消费。
 * 当前选择续接、统一表现事件与手牌装备上限新增四个明确入口。
 */
import { describe, expect, it } from 'vitest';
import * as Engine from '../game/src/battle/core/battle.engine.js';

const BASELINE_EXPORTS = [
  'requestBattleRender', 'interactionOf', 'cloneData', 'cardIdentity', 'R', 'alive',
  'intentFor', 'drawCards', 'resolveFoeDefeat', 'sweepDead', 'nestPhase', 'grantSha',
  'findCard', 'findEffectiveCard', 'infusionFuelReason', 'infuseOf', 'effCostOf', 'swapCardCosts', 'restore', 'finish',
  'cancelInteraction', 'flee', 'handCurseSpecs', 'getSnapshot', 'snapshotSignature',
  'getBattleLiveness', 'getCardPlayAvailability', 'submitCardPlay',
  'processDelayed', 'accrueGrowth', 'resolveCard', 'resolveCardWithFeedback',
  'syncCurseCondEquips', 'useEquipSkill', 'applyKillRewards', 'start',
  'fireTurnEndTriggers', 'addTempCard', 'fireConsumeTriggers', 'toggleDeckCard',
  'cancelDeckSelection', 'beginBoss', 'targetSide', 'unplayableReason', 'play',
  'toggleInfusePick', 'cancelInfuse', 'beginInfuse', 'confirmInfuse',
  'queueCardExecution', 'aegisBlocked', 'foeIdx', 'hitFoe', 'matchHandSelectKey',
  'skipHandSelect', 'pickHandSelect', 'useItem', 'bagSlam', 'resolveDart',
  'resolveSlam', 'slamSkill', 'addPlayerCurse', 'usePotion', 'openBag', 'closeBag', 'pickChoice',
  'pickDiscover', 'playerTakeHit', 'frenzyCurse', 'elCurse',
  'deferEndTurn', 'hasPendingEndTurn',
  'settlePendingSelections', 'emitBattlePresentation', 'emitRecast', 'handUnplayableReason',
];

describe('battle.engine 导出面守卫', () => {
  it('具名导出集合与基线逐字一致（增删须显式更新本清单）', () => {
    expect(Object.keys(Engine).sort()).toEqual([...BASELINE_EXPORTS].sort());
  });

  it('基线数量 = 76', () => {
    expect(BASELINE_EXPORTS.length).toBe(76);
  });
});
