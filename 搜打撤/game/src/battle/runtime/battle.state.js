/* 战斗状态机基础层：把逻辑阶段从 UI 临时标记中分离出来。 */

const BATTLE_PHASES = Object.freeze({
  START: 'start',
  PLAYER: 'player',
  TARGETING: 'targeting',
  RESOLVING: 'resolving',
  ENEMY: 'enemy',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [BATTLE_PHASES.START]: new Set([BATTLE_PHASES.PLAYER, BATTLE_PHASES.DEFEAT]),
  [BATTLE_PHASES.PLAYER]: new Set([BATTLE_PHASES.TARGETING, BATTLE_PHASES.RESOLVING, BATTLE_PHASES.ENEMY, BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT]),
  [BATTLE_PHASES.TARGETING]: new Set([BATTLE_PHASES.PLAYER, BATTLE_PHASES.RESOLVING, BATTLE_PHASES.DEFEAT]),
  [BATTLE_PHASES.RESOLVING]: new Set([BATTLE_PHASES.PLAYER, BATTLE_PHASES.ENEMY, BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT]),
  [BATTLE_PHASES.ENEMY]: new Set([BATTLE_PHASES.PLAYER, BATTLE_PHASES.VICTORY, BATTLE_PHASES.DEFEAT]),
  [BATTLE_PHASES.VICTORY]: new Set(),
  [BATTLE_PHASES.DEFEAT]: new Set(),
});

let battleSeq = 0;
function createBattleState(seed = {}) {
  return {
    token: ++battleSeq,   // 战斗实例令牌：视图层常驻节点（手牌/单位区）跨渲染复用与换场重置的依据
    phase: BATTLE_PHASES.START,
    round: 1,
    // energy/maxEnergy/interaction/actionQueue 曾在此占位但全仓无读者（真实 energy 与
    // interaction 均为 runtime 独立全局）——治理批次 1 移除，勿再回填。
    ...seed,
  };
}

function canTransition(from, to) {
  return from === to || Boolean(ALLOWED_TRANSITIONS[from]?.has(to));
}

function transitionBattle(state, phase) {
  if (!canTransition(state.phase, phase)) {
    throw new Error(`Invalid battle phase transition: ${state.phase} -> ${phase}`);
  }
  return { ...state, phase };
}

// eslint-disable-next-line no-unused-vars -- 签名保留 cardUid/targetIds：engine.beginCardTargeting 与架构测试仍传实参，指向态实际由 runtime interaction 承载
function beginTargeting(state, cardUid, targetIds = []) {
  return transitionBattle(state, BATTLE_PHASES.TARGETING);   // 09-29 报批删除：state.interaction 死字段（全仓零读者，指向态走 runtime interaction）
}

function cancelTargeting(state) {
  return state.phase === BATTLE_PHASES.TARGETING ? transitionBattle(state, BATTLE_PHASES.PLAYER) : state;
}

export { BATTLE_PHASES, beginTargeting, cancelTargeting, createBattleState, transitionBattle };
