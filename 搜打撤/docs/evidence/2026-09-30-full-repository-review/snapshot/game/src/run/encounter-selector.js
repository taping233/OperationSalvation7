// @ts-check
/**
 * 遭遇选拔结果（判别联合）：失败只带错误码；成功携带完整遭遇规格。
 * @typedef {{ok:false, code:string}} EncounterSelectFailure
 * @typedef {{kind:'entry'|'group'|'elite', encounterId:string, enemyIds:string[], size:number[],
 *   risk:string, strategy:string, rewardKind:string, fallbackReason:string|null}} EncounterSpec
 */

/**
 * 校验遭遇组结构（恰好 2×2、enemyIds 全部在 monsters 表中）。
 * @param {any} group
 * @param {Record<string, any>} monsters
 * @returns {boolean}
 */
const badGroup = (group, monsters) => !group || typeof group.id!=='string' || !group.id ||
  !Array.isArray(group.enemyIds) || group.enemyIds.length!==2 || group.enemyIds.some(id=>typeof id!=='string'||!monsters[id]) ||
  !Array.isArray(group.size) || group.size.length!==2 || group.size[0]!==2 || group.size[1]!==2;

/**
 * 从遭遇表（entries 直选 + groups 结构校验 + 精英骰）随机选出一个遭遇规格，组结构非法时回退 entry。
 * @param {any} enc
 * @param {Record<string, any>} monsters
 * @param {() => number} random
 * @returns {EncounterSelectFailure|{ok:true, value:EncounterSpec}}
 */
export function selectEncounterSpec(enc, monsters, random) {
  const entries=Array.isArray(enc?.entries)?enc.entries:[];
  if(!entries.length) return {ok:false,code:'NO_ENCOUNTER_ENTRY'};
  if(enc.elite && random()<enc.elite.chance) return {ok:true,value:{kind:'elite',encounterId:'elite',enemyIds:[...enc.elite.pool],size:[...enc.elite.size],risk:'精英',strategy:enc.elite.strategy||enc.strategy||'',rewardKind:'elite',fallbackReason:null}};
  const groups=Array.isArray(enc.groups)?enc.groups:[], choices=[...entries.map(entry=>({kind:'entry',entry})),...groups.map(group=>({kind:'group',group}))];
  const choiceIndex=Math.min(choices.length-1,Math.floor(random()*choices.length)), choice=choices[choiceIndex];
  const duplicateGroupId=choice?.kind==='group' && groups.filter(group=>group?.id===choice.group?.id).length!==1;
  if(choice?.kind==='group' && !duplicateGroupId && !badGroup(choice.group,monsters)) return {ok:true,value:{kind:'group',encounterId:choice.group.id,enemyIds:[...choice.group.enemyIds],size:[2,2],risk:enc.risk||'中',strategy:choice.group.strategy||enc.strategy||'',rewardKind:'normal',fallbackReason:null}};
  const fallback=choice?.kind==='entry'?choice.entry:entries[choiceIndex%entries.length];
  if(!fallback || !monsters[fallback.id]) return {ok:false,code:'INVALID_ENCOUNTER_ENTRY'};
  return {ok:true,value:{kind:'entry',encounterId:`entry:${fallback.id}`,enemyIds:[fallback.id],size:[...fallback.size],risk:enc.risk||'中',strategy:enc.strategy||'',rewardKind:'normal',fallbackReason:choice?.kind==='group'?'INVALID_GROUP':null}};
}

/**
 * 按 groupId 在全部遭遇表中精确定位唯一遭遇组（命中 0 或多于 1 个、或结构非法都判失败）。
 * @param {any[]} encounters
 * @param {Record<string, any>} monsters
 * @param {string} groupId
 * @returns {EncounterSelectFailure|{ok:true, value:EncounterSpec}}
 */
export function resolveEncounterGroup(encounters, monsters, groupId) {
  const matches=(encounters||[]).flatMap(enc=>(enc.groups||[]).filter(group=>group?.id===groupId).map(group=>({enc,group})));
  if(matches.length!==1 || badGroup(matches[0]?.group,monsters)) return {ok:false,code:'INVALID_GROUP'};
  const {enc,group}=matches[0];
  return {ok:true,value:{kind:'group',encounterId:group.id,enemyIds:[...group.enemyIds],size:[2,2],risk:enc.risk||'中',strategy:group.strategy||enc.strategy||'',rewardKind:'normal',fallbackReason:null}};
}
