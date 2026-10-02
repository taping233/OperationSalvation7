import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {sourceCardLibrary} from '../../../../../scripts/sync-cards-from-live.mjs';
import {applyXpGain,xpForNext} from '../../../../../game/src/hub/meta-progression.js';
const out=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(out,'../../../../..');
const read=p=>fs.readFileSync(path.join(root,p));
const json=p=>JSON.parse(read(p));
const sha=p=>createHash('sha256').update(read(p)).digest('hex');
const tally=xs=>xs.reduce((r,k)=>(r[k]=(r[k]||0)+1,r),{});
const cards=sourceCardLibrary();
const old=json('docs/evidence/2026-10-02-seven-departments-review/v2/quant-map.json');
const inputs=['docs/production/project/CHARTER.md','docs/production/design/GDD.md','docs/rules.md','docs/roadmap.md','game/src/run/map-generator.js','game/src/run/game.run.flow.js','game/src/run/game.run.altar.js','game/src/run/game.run.scenes.js','game/src/run/game.session.death.js','game/src/run/game.session.modes.js','game/src/run/game.nest.js','game/src/run/lab.ending.js','game/src/hub/extraction.commands.js','game/src/hub/game.bag.settle.js','game/src/hub/meta.js','game/src/hub/base.js','game/src/home/narrative.js','game/src/home/story.last-lamp.js','game/src/battle/core/battle.lifecycle.js','game/src/battle/core/battle.enemy-intent.js','game/src/battle/bag/battle.bag.js','game/src/cards/cards.js','game/src/cards/cards.data.js','game/src/cards/cards.rules.js','game/data/map.json','game/data/scenes.json','game/data/achievements.json','game/data/pets.json','game/data/cards-sync.json','scripts/sync-cards-from-live.mjs'];
const result={at:new Date().toISOString(),method:'Existing sourceCardLibrary() sandbox executes fresh card seed/migration chain in memory; no browser, disk save, live profile or source mutation. Cards count is fresh source-effective catalog, not raw dataSlice and not live user custom library.',
cards:{total:cards.length,byType:tally(cards.map(c=>c.type)),byCost:tally(cards.map(c=>c.cost??'missing')),classCards:tally(cards.filter(c=>c.rarity==='职业').map(c=>c.cls||'unassigned')),abilityCards:tally(cards.filter(c=>c.type==='能力卡').map(c=>c.cls||'unassigned')),eventIds:cards.filter(c=>c.type==='事件').map(c=>({id:c.id,name:c.name})),withRules:cards.filter(c=>c.rules).length},
map:{monsters:Object.keys(json('game/data/map.json').monsters).length,monsterBehaviors:tally(Object.values(json('game/data/map.json').monsters).map(m=>m.behavior||m.affix||'strike-default')),bosses:json('game/data/map.json').altar.bosses.map(b=>({name:b.name,atk:b.atk,hp:b.hp,behavior:b.behavior,affix:b.affix})),historicalReuse:{path:'docs/evidence/2026-10-02-seven-departments-review/v2/quant-map.json',sources:old.sources.map(s=>({...s,currentSha256:sha(s.path),matches:sha(s.path)===s.sha256})),summary:old.summary,layers:old.layers}},
meta:{pets:json('game/data/pets.json').list.length,petLevelMax:json('game/data/pets.json').levelMax,achievements:json('game/data/achievements.json').achievements.length,collectionMilestones:json('game/data/achievements.json').collectionMilestones.length},
cheapNonDestructiveProbe:{kind:'pure-growth-calculation-only',assumption:'Standard mode extraction XP formula 20 + 2 * (turn-1), movement increments turn even on consumed nodes; full route/UI exploit not executed.',totalXpToLv10:Array.from({length:9},(_,i)=>xpForNext(i+1)).reduce((a,b)=>a+b,0),at935Actions:applyXpGain({lv:1,xp:0},20+2*935).after},
inputs:inputs.map(p=>({path:p,sha256:sha(p),bytes:read(p).length}))};
fs.writeFileSync(path.join(out,'inventory.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,map:{...result.map,historicalReuse:{sources:result.map.historicalReuse.sources,summary:old.summary}},inputs:result.inputs.length},null,2));
