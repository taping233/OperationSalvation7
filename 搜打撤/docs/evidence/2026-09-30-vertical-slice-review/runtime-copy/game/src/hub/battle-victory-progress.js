// @ts-check
import { clone } from '../core/shared.js';
import { characterFor, migrateCharacterProgress } from '../core/characters.js';
import { applyXpGain } from './meta-progression.js';

/** @typedef {{lv:number,xp:number}} ClassProgress */
/** @typedef {{kills:number,bossKills:string[],[key:string]:unknown}} VictoryStats */
/** @typedef {{eggBattles?:number,stats?:Readonly<Record<string,unknown>>,characters?:Record<string,ClassProgress>,classes?:Record<string,ClassProgress>,[key:string]:unknown}} VictoryBaseSnapshot */
/** @typedef {{classId:string,levels:number[]}} VictoryLevelUps */
/** @typedef {{foeNames:readonly string[],isBoss:boolean,classId:string,xpMultiplier:number}} VictoryProgressInput */

/**
 * Calculate victory kill statistics and class experience on an isolated Base snapshot.
 * No persistence, UI, sound, RNG, or caller snapshot mutation occurs here.
 * Boss identity remains first-foe-only while kill/XP counts remain per foe.
 * @template {VictoryBaseSnapshot} TBase
 * @param {TBase} baseSnapshot
 * @param {VictoryProgressInput} input
 * @returns {{afterBase:TBase & VictoryBaseSnapshot,levelUps:VictoryLevelUps[]}}
 */
export function prepareBattleVictoryProgress(baseSnapshot, input) {
  const afterBase = /** @type {VictoryBaseSnapshot} */ (/** @type {unknown} */ (clone(baseSnapshot)));
  const stats = /** @type {VictoryStats} */ (afterBase.stats || (afterBase.stats = { kills: 0, bossKills: [] }));
  const levelUps = /** @type {VictoryLevelUps[]} */ ([]);

  for (let index = 0; index < input.foeNames.length; index++) {
    const name = input.foeNames[index];
    const isNamedBoss = input.isBoss && index === 0;
    if (isNamedBoss && !stats.bossKills.includes(name)) stats.bossKills.push(name);
    stats.kills++;

    const amount = Math.round((isNamedBoss ? 40 : 6) * input.xpMultiplier);
    if (!input.classId || amount <= 0) continue;

    const migrated = /** @type {VictoryBaseSnapshot & {characters:Record<string,ClassProgress>,classes:Record<string,ClassProgress>}} */ (
      /** @type {unknown} */ (migrateCharacterProgress(afterBase))
    );
    const character = /** @type {{id:string}|null} */ (/** @type {unknown} */ (characterFor(input.classId)));
    let progress;
    if (character) {
      progress = migrated.characters[character.id];
    } else {
      migrated.classes ||= {};
      progress = migrated.classes[input.classId] || (migrated.classes[input.classId] = { lv: 1, xp: 0 });
    }
    const gained = applyXpGain(progress, amount);
    progress.lv = gained.after.lv;
    progress.xp = gained.after.xp;
    if (gained.levels.length) {
      const existing = levelUps[levelUps.length - 1];
      if (existing?.classId === input.classId) existing.levels.push(...gained.levels);
      else levelUps.push({ classId: input.classId, levels: [...gained.levels] });
    }
  }

  return { afterBase: /** @type {TBase & VictoryBaseSnapshot} */ (/** @type {unknown} */ (afterBase)), levelUps };
}
