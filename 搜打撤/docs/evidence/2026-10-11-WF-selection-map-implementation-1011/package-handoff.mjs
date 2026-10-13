import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const evidence=path.join(root,'docs/evidence/2026-10-11-WF-selection-map-implementation-1011');
const targets=[
 'game/src/run/game.run.altar.js','game/src/hub/game.hub.depart.js',
 'game/src/hub/departure.view-updates.js','game/src/hub/departure.summary.js',
 'game/src/ui/node-scene-view.js','game/src/run/game.run.scenes.js',
 'game/src/ui/game.menu.js','game/src/ui/expedition-feedback.js',
 'game/src/core/renderer.js','game/src/run/expedition.view.js',
 'game/src/ui/hud.js','game/src/game.boot.js','game/src/hub/game.bag.js',
 'game/src/run/chests.js','game/src/run/game.run.shop.js','game/src/hub/game.bag.settle.js',
 'game/src/battle/view/battle.view.js','game/src/battle/view/battle.overlays.js',
 'game/src/battle/view/battle.piles.view.js','game/src/ui/cinematics.js',
 'game/css/base-camp-rework.css','game/css/departure-cover.css','game/css/entry-events.css',
 'game/css/expedition-map.css','game/css/page-expedition-hud.css',
 'game/css/expedition-inventory.css','game/css/expedition-shop.css',
 'game/css/expedition-rewards.css','game/css/expedition-battle.css',
 'docs/production/art/ART-DIRECTION-BRIEF.md',
 'game/assets/scenes/shop/shop-cardstyle-approved-1011.webp'
];
const hashFile=(file)=>{
 const full=path.resolve(root,file);
 if(!fs.existsSync(full)) return {file,exists:false,reason:'Locate exact path from domain record; no source recreated'};
 const data=fs.readFileSync(full); const stat=fs.statSync(full);
 return {file,exists:true,bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),mtime:stat.mtime.toISOString()};
};
const state={
 schema:1,createdAt:new Date().toISOString(),purpose:'Transfer unfinished authorized task to fresh chat; not final acceptance',
 task:'WF-selection-map-implementation-1011',stage:'doing',owner:'Friday',
 sourceThread:{id:'01a12a56-fff8-7393-a312-6f8f01036d55',title:'评估选人到地图节点体验'},
 project:{id:'625b317a-ae85-4433-a37a-bc4e9091ec22',workspace:'D:\\素材\\代号柒',implementation:root,environment:'local'},
 head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
 oldEditingReleased:true,children:[
 {name:'roster_departure',model:'gpt-6.1-sol',frozen:true,inFlightTools:false,services:[],latest:'Modern winter entry art not started; old threshold image remains unapproved'},
 {name:'map_battle_art',model:'gpt-6.1-sol',frozen:true,inFlightTools:false,services:[],latest:'Modern chest 00-04 candidate; hinge drift 60-92 sourcepx; body/lid scheme not begun; map/bag new layout not visually accepted'},
 {name:'selection_map_implementation',model:'gpt-6.1-sol',frozen:true,inFlightTools:false,services:[],latest:'Four BATTLE_SCENERY URLs and five CHEST_FRAME_SETS empty; latest guards still need focused review'}
 ],
 userConstraints:{art:'Actual project card art',world:'Future science-fiction city, restrained technology, not ancient/cyberpunk',weather:'Winter',mechanics:'Preserve existing mechanics',approvedFrozen:'shop-card-style-approved.png only',finalAcceptance:'User will inspect whole package after research-driven iteration',delegation:'Fresh three GPT-6.1-sol subagents',noCommit:true,noBuild:true},
 services:{ownStopped:{port:5337,pid:29048,session:52204,method:'identity confirmed then Ctrl+C',snapshot:'.tmp/selection-map-observe-1011'},lastSharedListener:{port:5200,pid:21616,action:'untouched'},warning:'Live state may change; never inherit old PTY or kill historical/unowned PIDs'},
 interfaces:{battleSceneryUrls:'empty',chestFrameGroups:'five empty',chestRig:'not started',winterSceneArt:'not started, five summer-like candidates preserved'},
 sourceSnapshot:targets.map(hashFile),
 stageAssets:JSON.parse(fs.readFileSync(path.join(evidence,'handoff-art/assets.json'),'utf8')),
 chestFrames:Array.from({length:5},(_,i)=>hashFile(`docs/evidence/2026-10-11-WF-selection-map-implementation-1011/art-calibration/modern-chest/source/modern-supply-frame-0${i}.png`)),
 handoffFile:'docs/evidence/2026-10-11-WF-selection-map-implementation-1011/HANDOFF-NEXT-CHAT.md',
 readOrder:['HANDOFF-NEXT-CHAT.md','HANDOFF-STATE.json','task.json','Domain implementation notes as needed'],
 warning:'Hash is a handoff observation, not exclusive ownership of entire file. Protect other owners existing hunks; preserve rejected assets; no tests, generation, source cleanup or commit performed while packaging.'
};
fs.writeFileSync(path.join(evidence,'HANDOFF-STATE.json'),JSON.stringify(state,null,2)+'\n','utf8');
console.log(JSON.stringify({written:'HANDOFF-STATE.json',sourceCount:state.sourceSnapshot.length,missingPaths:state.sourceSnapshot.filter(x=>!x.exists).map(x=>x.file),artCount:state.stageAssets.length,chestFrames:state.chestFrames.length,head:state.head}));
