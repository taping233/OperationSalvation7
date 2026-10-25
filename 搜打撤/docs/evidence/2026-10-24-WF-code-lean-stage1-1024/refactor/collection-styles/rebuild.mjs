import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {selectorSpecificity} from '@csstools/selector-specificity';
const evidence = 'docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/collection-styles';
const baseline = 'node_modules/.cache/lean-refactor-1024/before/';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const changes = [], retired = [];
const sharedFile = 'game/css/collection-workspace.css';
const shared = postcss.parse(fs.readFileSync(sharedFile,'utf8'));
const scope = shared.nodes.find(node=>node.type==='rule'&&node.selector.includes('.collection-workspace'));

// The independent entries retain complete, active variants. No entry is cleared:
// default pagination stays in card-browser.css; owned/container keep their own
// final layout, state and accessibility styles in their existing entry files.
for(const [variant,name] of [['owned','base-collection-v4.css'],['container','container-store.css']]) {
  const file = `game/css/${name}`, before = fs.readFileSync(file,'utf8');
  assert.equal(before,fs.readFileSync(baseline+file,'utf8'));
  const rule = scope.nodes.find(node=>node.type==='rule'&&node.selector===`&[data-collection-variant="${variant}"]`);
  assert.ok(rule,variant);
  const replacement = postcss.root();
  replacement.append(postcss.comment({text:`Final ${variant} workspace variant. Shared browser geometry is owned by collection-workspace.css.`}));
  if(variant==='container') replacement.append(postcss.atRule({name:'import',params:"url('./secondary-ui-tokens.css')"}));
  replacement.append(rule.clone({selector:scope.selector+rule.selector.slice(1)}));
  if(variant==='owned') {
    const ancestor = shared.nodes.find(node=>node.type==='rule'&&node.selector.includes('.hub-archive-v3'));
    assert.ok(ancestor);replacement.append(ancestor.clone());ancestor.remove();
  }
  const after = replacement.toString();
  fs.writeFileSync(file,after);rule.remove();
  changes.push({file,beforeSHA256:hash(before),afterSHA256:hash(after),kind:'rebuilt-active-variant',before,after});
}
for(const node of [...shared.nodes]) {
  if(node.type==='rule'&&/^\.card-browser/.test(node.selector)) node.remove();
}
fs.writeFileSync(sharedFile,shared.toString());

const owned = /^(collection-cards-v4|collection-v12(?:-[\w-]+)?|collection-browse-tools|collection-card(?:-art)?|collection-legacy|collection-empty)$/;
const pool = /^(person-pool(?:-[\w-]+)?|pool-card-art|pool-type-tabs|pool-controls|pv12-pool-catalog)$/;
const warehouse = /^(warehouse-toolbar|warehouse-card-art|stash-cell|stash-card-caption|stack-count)$/;
const specs = selector => selectorParser().astSync(selector).nodes.map(selectorSpecificity);
function subtract(selector,match) {
  const root = selectorParser().astSync(selector);
  function visit(list) {
    for(const branch of [...list.nodes]) {
      if(branch.nodes?.some(node=>node.type==='class'&&match(node.value))) {branch.remove();continue;}
      for(const node of [...(branch.nodes||[])]) if(node.type==='pseudo'&&node.nodes) {
        visit(node);if(!node.nodes.length){branch.remove();break;}
      }
    }
  }
  visit(root);return root.nodes.length?root.toString():'';
}
for(const name of ['base-camp-rework.css','base-rooms-v7.css','base-cohesion-v5.css','base-personnel-v12.css','base-logistics-trade-v12.css','base-archive-facilities-v12.css','expedition-inventory.css']) {
  const file=`game/css/${name}`,before=fs.readFileSync(file,'utf8');
  assert.equal(before,fs.readFileSync(baseline+file,'utf8'),`Frozen input changed: ${file}`);
  const root=postcss.parse(before,{from:file}),operations=[];
  root.walkRules(rule=>{
    const withinPool=rule.parent?.type==='rule'&&/\.personnel-v12\[data-section="pool"\]/.test(rule.parent.selector);
    const match=className=>{
      if(name==='expedition-inventory.css')return className==='pearl-store'||className==='container-store';
      if(name==='base-personnel-v12.css')return pool.test(className)||(withinPool&&/^card-browser/.test(className));
      if(name==='base-logistics-trade-v12.css')return ['warehouse-v3','warehouse-v2'].includes(className);
      if(name==='base-camp-rework.css')return pool.test(className);
      return owned.test(className)||pool.test(className)||warehouse.test(className)||(className==='warehouse-v3'&&/\.card-browser/.test(rule.selector));
    };
    let remaining=subtract(rule.selector,match);
    if(name==='base-personnel-v12.css'&&withinPool&&/\[data-(?:person-pool-count|card-browser)\]/.test(rule.selector))remaining='';
    if(remaining===rule.selector)return;
    retired.push({file,selector:rule.selector,source:rule.toString(),replacement:['game/css/collection-workspace.css','game/css/base-collection-v4.css','game/css/container-store.css']});
    if(!remaining){operations.push({selector:rule.selector,kind:'retired-covered-rule'});rule.remove();}
    else {
      assert.deepEqual(specs(remaining),specs(rule.selector),`Unowned specificity changed: ${file} ${rule.selector}`);
      operations.push({selector:rule.selector,remaining,kind:'retired-owned-branches',specificity:specs(remaining)});rule.selector=remaining;
    }
  });
  if(!operations.length)continue;
  const after=root.toString();fs.writeFileSync(file,after);
  changes.push({file,beforeSHA256:hash(before),afterSHA256:hash(after),kind:'retired-covered-blocks',operations,before,after});
}
fs.writeFileSync(evidence+'/retirement.json',JSON.stringify({baseline,changes,retired,review:{rejected:'Clearing three complete CSS entries into placeholders',executed:false,alternative:'Keep pagination entry and rebuild two functional variants in their existing files; retire only specifically covered rule blocks.'}},null,2)+'\n');
const normalized=text=>Buffer.byteLength(text.replace(/\r\n/g,'\n'));
const retiredBytes=changes.reduce((n,file)=>n+normalized(file.before)-normalized(file.after),0),newBytes=normalized(fs.readFileSync(sharedFile,'utf8'));
console.log(JSON.stringify({files:changes.length,retiredBytes,newBytes,netBytes:retiredBytes-newBytes,projectPercent:100*(retiredBytes-newBytes)/6601166}));
