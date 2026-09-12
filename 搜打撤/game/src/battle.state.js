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
    energy: 0,
    maxEnergy: 0,
    interaction: { mode: 'idle', cardUid: null, targetIds: [], hoveredTargetId: null, invalidReason: '' },
    actionQueue: [],
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

function beginTargeting(state, cardUid, targetIds = []) {
  const next = transitionBattle(state, BATTLE_PHASES.TARGETING);
  return { ...next, interaction: { mode: 'targeting', cardUid, targetIds: [...targetIds], hoveredTargetId: null, invalidReason: '' } };
}

function cancelTargeting(state) {
  const next = state.phase === BATTLE_PHASES.TARGETING ? transitionBattle(state, BATTLE_PHASES.PLAYER) : state;
  return { ...next, interaction: { mode: 'idle', cardUid: null, targetIds: [], hoveredTargetId: null, invalidReason: '' } };
}

export { ALLOWED_TRANSITIONS, BATTLE_PHASES, beginTargeting, cancelTargeting, canTransition, createBattleState, transitionBattle };
