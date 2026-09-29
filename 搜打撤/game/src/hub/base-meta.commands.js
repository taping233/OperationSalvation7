// @ts-check
// Meta 进度命令（2026-09-29 直写收敛）：战斗统计、职业熟练度、收藏经验回填。
// 规则只操作传入的基地草稿；持久化由 Base 的 persistProgress 端口提供——
// 该端口保留局内进度的旧 checkpoint 语义（保存失败仅内存推进，persisted:false），
// 与 elapsed / pet-egg 同族：战斗中/局内调用频繁，一次写失败不得吞掉本局进度。
// 槽位对局的击杀与经验走结算事务（battle-settlement.commands），不经过本文件。
import { characterFor, migrateCharacterProgress } from '../core/characters.js';
import { LEVEL_MAX, applyXpGain } from './meta-progression.js';

/** @typedef {{lv:number,xp:number}} ClassProgress */
/** @typedef {{kills?:number,bossKills?:string[],actions?:number,stashTotal?:number,reviveKills?:number,turnMovesMax?:number,battleEquipsMax?:number,[key:string]:unknown}} MetaStats */
/** @typedef {{characters?:Record<string,ClassProgress>,classes?:Record<string,ClassProgress>,stats?:MetaStats,collXp?:Record<string,boolean>,[key:string]:unknown}} MetaBaseState */
/** @typedef {{read: () => MetaBaseState, persistProgress: <T>(prepare: (draft: MetaBaseState) => T) => { value: T, persisted: boolean }}} MetaPorts */
/** @typedef {{before:{lv:number,xp:number},after:{lv:number,xp:number},levelsGained:number,levels:number[],checkpoints:{lv:number,xp:number}[]}} XpGainResult */
/** @typedef {{changed: boolean, xp: {cls: string|undefined, amount: number}|null, gained: XpGainResult|null, persisted: boolean}} MetaEventResult */

/**
 * 在草稿上解析职业进度条目并叠加经验（cls=人物 id/旧职业名均可，与 clsData 同口径）。
 * @param {MetaBaseState} draft
 * @param {string|undefined} cls
 * @param {number} amount
 * @returns {XpGainResult}
 */
function applyClassXp(draft, cls, amount) {
  const empty = /** @type {XpGainResult} */ ({ before: { lv: 1, xp: 0 }, after: { lv: 1, xp: 0 }, levelsGained: 0, levels: [], checkpoints: [] });
  if (!cls || !(amount > 0)) return empty;
  migrateCharacterProgress(draft);   // 与旧 clsData 同口径：惰性迁移并入一次，旧条目保留
  const character = characterFor(cls);
  /** @type {ClassProgress} */
  let progress;
  if (character) {
    draft.characters ||= {};
    progress = draft.characters[character.id];
    if (!progress || typeof progress !== 'object') progress = draft.characters[character.id] = { lv: 1, xp: 0 };
  } else {
    draft.classes ||= {};
    progress = draft.classes[cls] || (draft.classes[cls] = { lv: 1, xp: 0 });
  }
  if (!Number.isFinite(progress.lv)) progress.lv = 1;
  if (!Number.isFinite(progress.xp)) progress.xp = 0;
  if (progress.lv >= LEVEL_MAX) return { ...empty, before: { lv: progress.lv, xp: progress.xp }, after: { lv: progress.lv, xp: progress.xp } };
  const gained = applyXpGain(progress, amount);
  progress.lv = gained.after.lv;
  progress.xp = gained.after.xp;
  return gained;
}

/**
 * @param {MetaPorts} ports
 */
export function createBaseMetaCommands({ persistProgress }) {
  // 与旧 meta.js track 的 default 分支同口径：未知事件不改状态、不落盘。
  const KNOWN_EVENTS = new Set(['turnMoves', 'battleEquips', 'reviveKill', 'kill', 'action', 'stash']);
  /**
   * 单条战斗统计事件 + 熟练度经验，一次草稿内完成、一次落盘
   * （原 meta.js track：stats 直改 + addXP 多次 save，收敛后状态终值不变）。
   * @param {string} type
   * @param {{n?: number, name?: string, boss?: boolean, cls?: string, count?: number}} [payload]
   * @param {() => number} [xpMultiplier]
   * @returns {MetaEventResult}
   */
  function recordEvent(type, payload, xpMultiplier = () => 1) {
    if (!KNOWN_EVENTS.has(type)) return { changed: false, xp: null, gained: null, persisted: false };
    const result = persistProgress(draft => {
      const s = draft.stats || (draft.stats = {});
      const d = payload || {};
      /** @type {{cls: string|undefined, amount: number}|null} */
      let xp = null;
      let changed = true;
      switch (type) {
        case 'turnMoves':
          if ((d.n || 0) > (s.turnMovesMax || 0)) s.turnMovesMax = d.n;
          break;
        case 'battleEquips':
          if ((d.n || 0) > (s.battleEquipsMax || 0)) s.battleEquipsMax = d.n;
          break;
        case 'reviveKill':
          s.reviveKills = (s.reviveKills || 0) + 1;
          break;
        case 'kill':
          if (d.boss) {
            if (!s.bossKills.includes(d.name)) s.bossKills.push(d.name);
            s.kills++;
            xp = { cls: d.cls, amount: Math.round(40 * (xpMultiplier() || 1)) };
          } else {
            s.kills++;
            xp = { cls: d.cls, amount: Math.round(6 * (xpMultiplier() || 1)) };
          }
          break;
        case 'action':
          s.actions++;
          break;
        case 'stash':
          s.stashTotal += d.count || 0;
          break;
        default:
          changed = false;
      }
      const gained = changed && xp ? applyClassXp(draft, xp.cls, xp.amount) : null;
      return { changed, xp, gained };
    });
    return { changed: result.value.changed, xp: result.value.xp, gained: result.value.gained, persisted: result.persisted };
  }

  /**
   * 独立熟练度经验入口（原 Meta.addXP 的持久化内核）。
   * @param {string|undefined} cls
   * @param {number} amount
   * @returns {XpGainResult & {persisted: boolean}}
   */
  function addClassXp(cls, amount) {
    // 与旧 Meta.addXP 同口径：无效入参不进入草稿、不落盘。
    if (!cls || !(Number(amount) > 0)) {
      return /** @type {XpGainResult & {persisted: boolean}} */ ({ before: { lv: 1, xp: 0 }, after: { lv: 1, xp: 0 }, levelsGained: 0, levels: [], checkpoints: [], persisted: false });
    }
    const result = persistProgress(draft => applyClassXp(draft, cls, amount));
    return { ...result.value, persisted: result.persisted };
  }

  /**
   * 收藏经验回填：把给定卡 id 标记为已结算经验（原 meta.js syncCollXp 的直写内核；
   * 「哪些 id 该标记」的职业卡判定留在 Meta，卡库知识不进本文件）。
   * @param {string[]} ids
   * @returns {{changed: boolean, persisted: boolean}}
   */
  function markCollXpSettled(ids) {
    if (!Array.isArray(ids) || !ids.length) return { changed: false, persisted: false };
    const result = persistProgress(draft => {
      draft.collXp ||= {};
      let changed = false;
      ids.forEach(id => {
        if (!draft.collXp[id]) { draft.collXp[id] = true; changed = true; }
      });
      return changed;
    });
    return { changed: result.value === true, persisted: result.persisted };
  }

  return Object.freeze({ recordMetaEvent: recordEvent, addClassXp, markCollXpSettled });
}
