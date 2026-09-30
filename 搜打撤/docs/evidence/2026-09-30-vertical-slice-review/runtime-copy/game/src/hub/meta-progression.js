// @ts-check
// Pure class-progression rules shared by immediate Meta writes and recoverable battle settlement.

export const LEVEL_MAX = 10;

/** @param {number} level @returns {number} */
export const xpForNext = level => 50 + (Math.max(1, level) - 1) * 40;

/**
 * Apply one experience gain without persistence or presentation effects.
 * @param {{lv:number,xp:number}} progress
 * @param {number} amount
 * @returns {{before:{lv:number,xp:number},after:{lv:number,xp:number},levelsGained:number,levels:number[],checkpoints:{lv:number,xp:number}[]}}
 */
export function applyXpGain(progress, amount) {
  const before = { lv: progress.lv, xp: progress.xp };
  const after = { ...before };
  const gain = amount;
  if (after.lv < LEVEL_MAX && !(gain <= 0)) {
    after.xp += gain;
    const levels = [];
    const checkpoints = [];
    while (after.lv < LEVEL_MAX && after.xp >= xpForNext(after.lv)) {
      after.xp -= xpForNext(after.lv);
      after.lv++;
      levels.push(after.lv);
      checkpoints.push({ ...after });
    }
    return { before, after, levelsGained: levels.length, levels, checkpoints };
  }
  return { before, after, levelsGained: 0, levels: [], checkpoints: [] };
}

/**
 * Pure snapshot helper retained by Meta's existing public API.
 * @param {{lv?:unknown,xp?:unknown}|null|undefined} progress
 * @param {number} amount
 * @returns {{before:{lv:number,xp:number},after:{lv:number,xp:number},levelsGained:number}}
 */
export function addXpToProgress(progress, amount) {
  const before = { lv: Math.max(1, Number(progress && progress.lv) || 1), xp: Math.max(0, Number(progress && progress.xp) || 0) };
  const gain = Math.max(0, Number(amount) || 0);
  const result = applyXpGain(before, gain);
  return Object.freeze({
    before: Object.freeze(before),
    after: Object.freeze(result.after),
    levelsGained: result.levelsGained,
  });
}
