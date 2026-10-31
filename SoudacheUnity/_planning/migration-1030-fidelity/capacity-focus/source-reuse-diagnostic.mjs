// Executes the actual source module. Does not edit the source tree or its tests.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,nextLoad){return url.endsWith('.css')?{format:'module',source:'export default {};',shortCircuit:true}:nextLoad(url,context);}});
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(here,'../../../../搜打撤');
const {JSDOM}=await import(pathToFileURL(path.join(source,'node_modules/jsdom/lib/api.js')));
const dom=new JSDOM('<div id="overlay"><div id="body"></div></div>',{url:'http://localhost'});
for(const key of ['window','document','Element','HTMLElement','Node','CustomEvent','MouseEvent','KeyboardEvent','MutationObserver'])globalThis[key]=key==='window'?dom.window:dom.window[key];
const {openRewardCapacityOrganizer}=await import(pathToFileURL(path.join(source,'game/src/ui/reward-capacity-organizer.js')));
const UI={el:{overlay:document.querySelector('#overlay'),ovBody:document.querySelector('#body')},showOverlay:(_,html)=>UI.el.ovBody.innerHTML=html};
const stacks=[{card:{name:'长剑'},uids:['a','b','c'],count:3}];let moved=0,discarded=0;
const root=openRewardCapacityOrganizer({UI,card:{name:'待领法术'},readStacks:()=>stacks,canReceive:()=>false,capacity:()=>'',current:()=>true,
  moveToSafe:()=>{moved++;return true;},discardOne:()=>{discarded++;return true;},onReturn:()=>{},onClaim:()=>{},onFullBag:()=>{}});
const old=root.querySelector('[data-organize="safe"]');
root.querySelector('[data-organize="discard"]').click();
const afterRender={oldStillInRoot:root.contains(old),oldCurrentAction:old.dataset.organize,oldIsCurrentKeep:old===root.querySelector('[data-organize="keep"]'),confirmPresent:!!root.querySelector('[data-organize="confirm"]')};
old.click();
const afterOldClick={confirmPresent:!!root.querySelector('[data-organize="confirm"]'),discardPresent:!!root.querySelector('[data-organize="discard"]'),moved,discarded,count:stacks[0].count};
UI.el.ovBody.innerHTML='<p>其他页</p>';
const result={afterRender,afterOldClick,afterPageReplacement:{confirmPresentInDetachedRoot:!!root.querySelector('[data-organize="confirm"]')},conclusion:'syncViewChildren reused the former safe BUTTON as the active keep BUTTON. old.click() legitimately cancelled the confirmation. The old test then dereferences a missing confirm button; no move or discard occurred.'};
if(!afterRender.oldStillInRoot||afterRender.oldCurrentAction!=='keep'||!afterRender.oldIsCurrentKeep||afterOldClick.confirmPresent||moved||discarded||stacks[0].count!==3)throw new Error('source reuse diagnosis did not reproduce');
fs.writeFileSync(path.join(here,'source-reuse-diagnostic.json'),JSON.stringify(result,null,2));
console.log('actual source reuse diagnostic passed');
