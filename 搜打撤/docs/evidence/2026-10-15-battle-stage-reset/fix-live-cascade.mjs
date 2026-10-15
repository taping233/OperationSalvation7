import fs from 'node:fs';
import crypto from 'node:crypto';
import postcss from 'postcss';
const folder='docs/evidence/2026-10-15-battle-stage-reset';
const files=['winter.css','expedition-battle.css','page-battle-ui.css','feedback-oct12.css'];
const changes=[];
for(const name of files){
  const file='game/css/'+name;
  const before=fs.readFileSync(file);
  const root=postcss.parse(before.toString('utf8'));
  const removed=[];
  root.walkRules(rule=>{
    const selectors=rule.selectors.filter(selector=>{
      const liveLegacy=selector.includes(':not(.dead)') && /\.(?:battle-stage|sts-foe|sts-unit)\b/.test(selector) && !/\.fx-/.test(selector);
      const oldSkill=/\[data-act=["']btSlam["']\]/.test(selector);
      if(liveLegacy||oldSkill){removed.push(selector);return false;}
      return true;
    });
    if(!selectors.length)rule.remove();else if(selectors.length!==rule.selectors.length)rule.selectors=selectors;
  });
  if(removed.length){
    fs.writeFileSync(folder+'/runtime-before/live-fix__'+name+'.txt',before);
    const after=root.toString();fs.writeFileSync(file,after);
    changes.push({path:file,beforeSha256:crypto.createHash('sha256').update(before).digest('hex'),afterSha256:crypto.createHash('sha256').update(after).digest('hex'),removed});
  }
}
fs.writeFileSync(folder+'/live-cascade-source-changes.json',JSON.stringify(changes,null,2));
console.log('Removed conflicting live-unit and legacy skill rules from their original sources');
