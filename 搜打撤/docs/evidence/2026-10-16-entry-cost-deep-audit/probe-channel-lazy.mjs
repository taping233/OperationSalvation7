// Isolated VM contract probe of only the runner's scheduling declarations.
// Does not import/evaluate the game, Vite configuration, services, or browser.
import fs from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const file='game/src/agent/agent.runner.js';
const baselineFile='docs/evidence/2026-10-16-entry-cost-deep-audit/agent.runner.before.js';
const source=fs.readFileSync(baselineFile,'utf8');
const start=source.indexOf("const channelPump = (typeof MessageChannel");
const end=source.indexOf('\n\nasync function awaitCommand',start);
assert(start>=0&&end>start);
const before=source.slice(start,end);
const after=`const channelPump = (typeof MessageChannel === 'function') ? (() => {
  let ch = null;
  const queue = [];
  return (resolve) => {
    if (!ch) {
      ch = new MessageChannel();   // eslint-disable-line no-undef
      ch.port1.onmessage = () => { const job = queue.shift(); if (job) job(); };
      ch.port1.start?.();
    }
    queue.push(resolve);
    ch.port2.postMessage(null);
  };
})() : null;
const defer = () => (typeof globalThis.setImmediate === 'function')
  ? new Promise(resolve => globalThis.setImmediate(resolve))
  : (channelPump ? new Promise(channelPump) : new Promise(resolve => setTimeout(resolve, 0)));
`;
async function probe(code,{channel=true,immediate=false}={}){
 const counts={created:0,started:0,posted:0,immediate:0,timer:0};const order=[];
 class MockChannel{constructor(){counts.created++;this.port1={onmessage:null,start(){counts.started++}};this.port2={postMessage:()=>{counts.posted++;queueMicrotask(()=>this.port1.onmessage?.({data:null}))}}}}
 const sandbox={Promise,setTimeout:(fn)=>{counts.timer++;queueMicrotask(fn);return 1},MessageChannel:channel?MockChannel:undefined};
 if(immediate)sandbox.setImmediate=(fn)=>{counts.immediate++;queueMicrotask(fn)};
 const context=vm.createContext(sandbox);
 const defer=vm.runInContext(`${code}\n;defer;`,context);
 const beforeFirst={...counts};
 await Promise.all([defer().then(()=>order.push('first')),defer().then(()=>order.push('second'))]);
 const afterConcurrent={...counts};await defer().then(()=>order.push('third'));
 assert.deepEqual(order,['first','second','third']);
 return{beforeFirst,afterConcurrent,afterThird:{...counts},order};
}
const result={method:'Isolated VM scheduling contract/call-count probe, not browser timing or full Agent behavior verification',source:file,baselineFile,sourceSha256:createHash('sha256').update(source).digest('hex'),cases:{}};
for(const [name,options]of Object.entries({browserChannel:{channel:true},nodeSetImmediate:{channel:true,immediate:true},timerFallback:{channel:false}})){
 result.cases[name]={before:await probe(before,options),candidate:await probe(after,options)};
}
assert.equal(result.cases.browserChannel.before.beforeFirst.created,1);
assert.equal(result.cases.browserChannel.candidate.beforeFirst.created,0);
assert.equal(result.cases.browserChannel.candidate.afterThird.created,1);
assert.equal(result.cases.nodeSetImmediate.candidate.afterThird.created,0);
assert.equal(result.cases.timerFallback.candidate.afterThird.timer,3);
fs.writeFileSync('docs/evidence/2026-10-16-entry-cost-deep-audit/channel-pump-candidate.txt',after+'\n');
console.log(JSON.stringify(result,null,2));
