import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const dir='docs/evidence/2026-10-10-WF-base-iterate-1010';
const postcss=createRequire(path.join(process.cwd(),'package.json'))('postcss');
const task=JSON.parse(fs.readFileSync(`${dir}/task.json`,'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=task.paths.filter(p=>fs.existsSync(p)&&fs.statSync(p).isFile());
const checks=[];
for(const file of files){
  if(file.endsWith('.js')) { const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'}); if(r.status!==0)throw new Error(`${file}: ${r.stderr}`); checks.push({file,check:'syntax',passed:true}); }
  if(file.endsWith('.css')) {postcss.parse(fs.readFileSync(file,'utf8'));checks.push({file,check:'postcss',passed:true});}
}
const fragment=text=>{const a=text.indexOf('    const footerHTML = () => {'),b=text.indexOf('    const refreshZoom = () => {',a);if(a<0||b<0)throw new Error('protected footer boundary missing');return text.slice(a,b)};
const before=fragment(fs.readFileSync(`${dir}/before/game__src__hub__game.hub.pages.js`,'utf8'));
const now=fragment(fs.readFileSync('game/src/hub/game.hub.pages.js','utf8'));
const footer={sameBytes:before===now,sameContent:before.replaceAll('\r\n','\n')===now.replaceAll('\r\n','\n'),beforeSha256:hash(before),currentSha256:hash(now)};
if(!footer.sameContent)throw new Error('protected footer content changed');
const report={time:new Date().toISOString(),checks,protectedFooter:footer,files:files.map(file=>({file,sha256:hash(fs.readFileSync(file))})),notRun:['build','full project test suite','full project lint/typecheck'],sharedBoundary:'premium-ui-pages photo assertions unchanged; only base describe updated'};
fs.writeFileSync(`${dir}/source-validation.json`,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({checks:checks.length,protectedFooter:footer}));
