/* 一场战斗的核心状态与执行生命周期。由 battle.runtime.js 转发活绑定。 */
import { createBattleState } from './battle.state.js';

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
