const badGroup = (group, monsters) => !group || typeof group.id!=='string' || !group.id ||
  !Array.isArray(group.enemyIds) || group.enemyIds.length!==2 || group.enemyIds.some(id=>typeof id!=='string'||!monsters[id]) ||
  !Array.isArray(group.size) || group.size.length!==2 || group.size[0]!==2 || group.size[1]!==2;

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

export function resolveEncounterGroup(encounters, monsters, groupId) {
  const matches=(encounters||[]).flatMap(enc=>(enc.groups||[]).filter(group=>group?.id===groupId).map(group=>({enc,group})));
  if(matches.length!==1 || badGroup(matches[0]?.group,monsters)) return {ok:false,code:'INVALID_GROUP'};
  const {enc,group}=matches[0];
  return {ok:true,value:{kind:'group',encounterId:group.id,enemyIds:[...group.enemyIds],size:[2,2],risk:enc.risk||'中',strategy:group.strategy||enc.strategy||'',rewardKind:'normal',fallbackReason:null}};
}
