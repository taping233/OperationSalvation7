// 本局战斗统计的有界快照；只保存既有战斗事实，不从地图或日志猜历史胜场。
export const BATTLE_LOG_CAP = 40;
const count = value => Number.isSafeInteger(value) && value >= 0;
const record = value => value && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const identity = value => value === null || (typeof value === 'string' && value.trim().length > 0 && value.length <= 160);
const numeric = ['li', 'node', 'hp', 'turn', 'round', 'nPlayed', 'nUsed', 'hits', 'dmg', 'waste', 'potions', 'fleeT', 'startHp', 'startCards'];
const text = value => typeof value === 'string' && value.length <= 256;
const copyLog = log => log.map(row => ({
  w: row.w, foe: row.foe.slice(0, 256), mode: row.mode,
  ...Object.fromEntries(numeric.map(key => [key, row[key] ?? null])),
  deck: row.deck ? row.deck.slice(0, 40).map(name => String(name).slice(0, 256)) : null,
}));

function validSnapshot(data, runId) {
  if (!record(data) || data.version !== 1 || !identity(data.runId) || !identity(runId)) return false;
  if (data.runId !== runId && !(data.runId === null && data.fought === 0)) return false;
  if (!count(data.fought) || !count(data.won) || data.won > data.fought) return false;
  if (data.runId === null && data.fought !== 0) return false;
  if (!Array.isArray(data.log) || data.log.length > Math.min(BATTLE_LOG_CAP, data.fought)) return false;
  let wins = 0;
  for (const row of data.log) {
    if (!record(row) || ![0, 1].includes(row.w) || !text(row.foe) || ![null, 'win', 'lose', 'flee'].includes(row.mode)) return false;
    if (row.mode !== null && (row.mode === 'win') !== !!row.w) return false;
    if (numeric.some(key => row[key] != null && (typeof row[key] !== 'number' || !Number.isFinite(row[key])))) return false;
    if (row.deck !== null && (!Array.isArray(row.deck) || row.deck.length > 40 || !row.deck.every(text))) return false;
    wins += row.w;
  }
  return wins <= data.won && data.log.length - wins <= data.fought - data.won;
}

export function createRunBattleStats() {
  const battles = { fought: 0, won: 0 }, battleLog = [];
  let runId = null;
  const reset = () => { battles.fought = 0; battles.won = 0; battleLog.length = 0; runId = null; };
  const snapshot = (nextId = runId) => {
    if (!identity(nextId)) throw new TypeError('无效的对局统计身份');
    // 调用方必须先装载新档；身份不符时不能把上一局计数盖章给另一个档。
    if (runId !== null && nextId !== null && runId !== nextId) {
      console.warn('[recorder] 对局身份变化，未沿用其他对局的战斗统计');
      reset();
    }
    if (nextId !== null) runId = nextId;
    return { version: 1, runId, ...battles, log: copyLog(battleLog.slice(-BATTLE_LOG_CAP)) };
  };
  const restore = (data, nextId = null) => {
    reset();
    runId = identity(nextId) ? nextId : null;
    if (!validSnapshot(data, runId)) return false;
    battles.fought = data.fought; battles.won = data.won;
    battleLog.push(...copyLog(data.log));
    return true;
  };
  return { battles, battleLog, reset, snapshot, restore };
}
