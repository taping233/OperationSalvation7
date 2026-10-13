import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const postcss=createRequire(path.join(process.cwd(),'package.json'))('postcss');
const file='game/css/base-camp-rework.css', prefix='#overlay #hubMain.pg.hub.base-camp';
const old=postcss.parse(fs.readFileSync(file,'utf8'));
const retained=[];
old.walkRules(rule=>{ if(!rule.selector.startsWith(prefix) || rule.selector.includes('.camp-steps')) { retained.push(rule.clone()); } });
const next=postcss.parse(fs.readFileSync(new URL('./style-round-three.css',import.meta.url),'utf8'));
next.walkRules(rule=>{rule.selectors=rule.selectors.map(s=>s==='&'?prefix:`${prefix} ${s}`)});
const selectors=new Set();const out=postcss.root();
for(const rule of retained){if(!selectors.has(rule.selector)){selectors.add(rule.selector);out.append(rule)}}
out.prepend(postcss.comment({text:'基地现行样式：单一配色与浏览组件；独立页分别维护于对应 v3 CSS。出征流程既有规则保留。'}));
out.append(next.nodes);
fs.writeFileSync(file,out.toString()+'\n');
console.log(JSON.stringify({retained:retained.length,bytes:Buffer.byteLength(out.toString())}));
