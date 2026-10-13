import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const dir='docs/evidence/2026-10-10-WF-base-iterate-1010';
const inputs=['accepted-targeted-tests.json','premium-base-tests.json','zoom-placement-tests.json'];
const cases=new Map();
for(const file of inputs){const r=JSON.parse(fs.readFileSync(`${dir}/${file}`,'utf8'));if(!r.success)throw new Error(file+' failed');for(const f of r.testResults){for(const t of f.assertionResults){if(t.status==='passed')cases.set(`${path.basename(f.name)}/${t.fullName}`,{file:path.basename(f.name),name:t.fullName,status:'passed'});}}}
const screenshots=fs.readdirSync(dir).filter(file=>file.endsWith('-final.jpg')).map(file=>({file,bytes:fs.statSync(`${dir}/${file}`).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(`${dir}/${file}`)).digest('hex')}));
const summary={time:new Date().toISOString(),tests:{uniquePassed:cases.size,reports:inputs,scope:'related target tests; not full repository suite'},browser:{provider:'Codex In-app Browser',url:'http://127.0.0.1:5200/',viewport:{width:1280,height:720},slot:1,realInput:['navigation','card open/read/close/focus','skill page 2/open/return','achievement choice/back objective','appearance preview/restored','difficulty/restored normal','rain intensity','pond feed','departure temporary add card/reset reload'],notPerformed:['real purchase/sale/restore/growth/reward/skin application','start new run','other viewports'],finalErrors:[],finalResources:{wood:0,rations:0,keys:0,coins:0,stashCards:5}},screenshots,sourceValidation:'source-validation.json',boundary:'Two unrelated photo structure assertions remain failed in earlier expanded check; not edited.'};
fs.writeFileSync(`${dir}/validation-summary.json`,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({uniquePassed:cases.size,finalScreenshots:screenshots.length}));
