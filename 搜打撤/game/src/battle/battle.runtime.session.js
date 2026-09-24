/* 一场战斗的核心状态与执行生命周期。由 battle.runtime.js 转发活绑定。 */
import { createBattleState, transitionBattle } from './battle.state.js';
import * as Combat from './combat.js';

export let battleState = createBattleState();
export let G = null;
export let foes = [];
export let opts = null;
export let mode = 'normal';
export let energy = 0, maxEnergy = 0, turn = 1;
export let pdef = null, pstat = null;
export let busy = false;
export let allies = [];
export let battleRestartCheckpoint = null;
export let restoringRestartCheckpoint = false;
export let tmpSeq = 0;
export let activeActionSignal = null;
export let surgeWaiter = null;
export let lastPersistAt = 0;

export function set$G(v) { G = v; }
export function set$opts(v) { opts = v; }
export function set$mode(v) { mode = v; }
export function set$battleState(v) { battleState = v; }
export function set$foes(v) { foes = v; }
export function set$energy(v) { energy = v; }
export function set$maxEnergy(v) { maxEnergy = v; }
export function set$turn(v) { turn = v; }
export function set$busy(v) { busy = v; }
export function set$pdef(v) { pdef = v; }
export function set$pstat(v) { pstat = v; }
export function set$allies(v) { allies = v; }
export function set$battleRestartCheckpoint(v) { battleRestartCheckpoint = v; }
export function set$restoringRestartCheckpoint(v) { restoringRestartCheckpoint = v; }
export function set$tmpSeq(v) { tmpSeq = v; }
export function set$activeActionSignal(v) { activeActionSignal = v; }
export function set$surgeWaiter(v) { surgeWaiter = v; }
export function set$lastPersistAt(v) { lastPersistAt = v; }

// —— 第 4 批 session 打薄（2026-09-25）：域内语义化聚合接口 ——
// 只收「整组重置/还原」与「模板完全一致」的成组点；battleState 阶段机仅聚
// transitionBattle 同模板迁移，createBattleState 初始化与 beginTargeting 进入不聚。

// 阶段迁移（路线图第 4 批步骤 3）：lifecycle 终局/开局 ×4、enemy-phase 回合迁移 ×4 同模板点。
export function transitionTo(phase) { battleState = transitionBattle(battleState, phase); }

// （重）进场与终局的「abort/reset 后清信号」既有次序（lifecycle restore/finish/start 四处同模板）。
export function clearActionSignals() { activeActionSignal = null; surgeWaiter = null; }

// 读档·会话核心字段回填（restore 前段逐字搬迁；defaultMaxEnergy 由调用点以 R().battleEnergy 解析）。
export function restoreBattleSession(nextGame, data, defaultMaxEnergy) {
  G = nextGame;
  opts = JSON.parse(JSON.stringify(data.opts));
  mode = data.mode === 'boss' ? 'boss' : 'normal';
  turn = +data.turn || 1;
  maxEnergy = +data.maxEnergy || defaultMaxEnergy;
  energy = Number.isFinite(+data.energy) ? +data.energy : maxEnergy;
}

// 读档·参战者回填（restore 中段逐字搬迁；intentFor 由 engine 注入经 lifecycle 传入，session 不 import 引擎，拒环）。
export function restoreBattleCombatants(data, intentFor) {
  pdef = { shield: 0, armor: 0, guard: false, ...(data.pdef || {}) };
  pstat = Combat.ensureStatus({ hp: G.hp, status: { ...(data.pstat?.status || {}) } });
  foes = data.foes.map(f => {
    const foe = {
      id: f.id || null, name: f.name, hp: f.hp, maxHp: f.maxHp, atk: f.atk || 2,
      affix: f.affix || null, affixName: f.affixName || null, behavior: f.behavior || null, dead: !!f.dead,
      status: { ...(f.status || {}) },
      defense: { shield: 0, armor: 0, guard: false, ...(f.defense || {}) },
      intent: f.intent ? JSON.parse(JSON.stringify(f.intent)) : null,
    };
    Combat.ensureStatus(foe);
    if (!foe.intent) foe.intent = intentFor(foe, turn);
    return foe;
  });
}

// 开局运行态重置（resetBattleEntryState 前段逐字搬迁；defaultMaxEnergy = R().battleEnergy）。
export function resetBattlePlayerState(defaultMaxEnergy) {
  maxEnergy = defaultMaxEnergy;
  energy = maxEnergy;
  turn = 1; busy = false;
  pdef = { shield: 0, armor: 0, guard: false };
  pstat = Combat.ensureStatus({ hp: G.hp });
}
