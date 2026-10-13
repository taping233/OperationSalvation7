import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root=process.cwd(),workspace=path.join(root,'.tmp/WF-four-player-fixes-1013'),runtime=path.join(workspace,'runtime');
const evidence=path.join(root,'docs/evidence/2026-10-13-WF-four-player-fixes-1013');
const files=[
  'game/src/ui/interface-motion.js','game/src/ui/overlay.js','game/src/run/game.run.flow.js','game/src/run/game.run.scenes.js',
  'game/src/battle/core/battle.enemy-phase.js','game/src/battle/core/battle.resolution.js','game/src/battle/effects/effect-steps.js','game/src/battle/effects/effect-steps.curse.js',
  'game/src/battle/core/battle.lifecycle.js','game/src/battle/view/battle.overlays.js','game/src/cards/card-description-text.js',
  'game/src/run/chests.js','game/src/run/chest-reward-save.js','game/src/hub/run-save-validation.js','game/src/run/game.session.js','game/src/run/game.session.kernel.js','game/src/run/game.run.js','game/src/game.boot.js',
  'game/src/battle/view/battle.aim.js','game/src/battle/view/battle.view.js',
  'game/src/run/game.session.bag.js','game/src/hub/game.bag.js','game/src/audio/sound.music.player.js','game/src/audio/sound.js','game/css/battle-hand-overhaul.css',
  'tests/four-player-event-regressions.test.js','tests/four-player-battle-regressions.test.js','tests/four-player-semantics-regressions.test.js',
  'tests/four-player-chest-reload.test.js','tests/four-player-capacity-text.test.js','tests/four-player-music-fallback.test.js','tests/sound-music.test.js',
  'docs/rules.md','docs/audio-system.md',
];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const text=file=>fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').replace(/^\uFEFF/,'');
const patches={core:'',ui:''},changes=[];
for(const file of files){
  const dest=path.join(root,file),candidate=path.join(runtime,file),exists=fs.existsSync(dest);
  const next=text(candidate),before=exists?text(dest):null;
  if(before===next)continue;
  const group=['game/src/battle/view/battle.overlays.js','game/src/battle/view/battle.aim.js','game/src/battle/view/battle.view.js','game/css/battle-hand-overhaul.css'].includes(file)?'ui':'core';
  let patch;
  if(exists){
    for(const [folder,content] of [['patch-base',before],['patch-next',next]]){
      const target=path.join(workspace,folder,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,content);
    }
    const result=spawnSync('git',['-c','core.quotePath=false','diff','--no-index','--no-ext-diff','--','patch-base/'+file,'patch-next/'+file],{cwd:workspace,encoding:'utf8'});
    if(result.status!==1)throw new Error(`diff failed ${file}: ${result.stderr}`);
    patch=result.stdout.replaceAll('a/patch-base/','a/').replaceAll('b/patch-next/','b/');
  }else{
    const lines=next.replace(/\n$/,'').split('\n');
    patch=`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n@@ -0,0 +1,${lines.length} @@\n${lines.map(line=>'+'+line).join('\n')}\n`;
  }
  patches[group]+=patch;
  changes.push({file,group,sourceSha256:exists?sha(fs.readFileSync(dest)):null,candidateSha256:sha(Buffer.from(next)),added:patch.split('\n').filter(l=>l.startsWith('+')&&!l.startsWith('+++')).length,removed:patch.split('\n').filter(l=>l.startsWith('-')&&!l.startsWith('---')).length});
}
for(const [group,patch] of Object.entries(patches))fs.writeFileSync(path.join(evidence,`${group}-fixes.patch`),patch);
fs.writeFileSync(path.join(evidence,'patch-manifest.json'),JSON.stringify({at:new Date().toISOString(),status:'prepared-not-applied',requires:['确认5361–5364安全集成窗口','ui补丁须与WF-battle-ui-overhaul活跃属地协调','应用前重核源码SHA及相关未提交diff，变化则逐块重基不覆盖'],changes,patches:Object.fromEntries(Object.entries(patches).map(([k,v])=>[k,{file:`${k}-fixes.patch`,sha256:sha(Buffer.from(v))}]))},null,2));
console.log(JSON.stringify({status:'prepared-not-applied',files:changes.length,changes:changes.map(({file,group,added,removed})=>({file,group,added,removed}))}));
