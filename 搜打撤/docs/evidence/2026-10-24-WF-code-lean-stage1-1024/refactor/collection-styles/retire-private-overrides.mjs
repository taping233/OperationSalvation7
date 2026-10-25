import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {selectorSpecificity} from '@csstools/selector-specificity';
const evidence='docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/collection-styles';
const hash=text=>crypto.createHash('sha256').update(text).digest('hex');
const output=[];
for(const name of ['feedback-oct12.css','home-linked-interactions.css','base-camp-rework.css','base-camp.css','base-rooms-v7.css']) {
  const file=`game/css/${name}`,before=fs.readFileSync(file,'utf8'),root=postcss.parse(before),operations=[];
  root.walkRules(rule=>{
    let owned=false;
    if(name==='feedback-oct12.css')owned=rule.parent?.type==='rule'&&/\.personnel-v12\[data-section="pool"\]/.test(rule.parent.selector)&&/pv12-pool-catalog|card-browser|person-pool-card|pool-card-art/.test(rule.selector);
    if(name==='home-linked-interactions.css')owned=/warehouse-card-art|warehouse-v2 \.stash-card-caption|warehouse-v2 \.stack-count/.test(rule.selector);
    if(name==='base-camp.css')owned=/\.stash-cell/.test(rule.selector);
    if(name==='base-camp-rework.css') {
      owned=/warehouse-toolbar|warehouse-card-art|stash-cell|stash-card-caption/.test(rule.selector)||/\.warehouse-v3 \.card-browser$/.test(rule.selector);
      if(/\.card-browser-footer \.card-browser-page/.test(rule.selector)) {
        const old=rule.selector,parser=selectorParser();
        const ast=parser.astSync(old);ast.nodes.forEach(selector=>{
          const exclusions=parser.astSync(':not(:where(.collection-workspace .card-browser-page))').first.nodes;
          selector.append(...exclusions.map(node=>node.clone()));
        });
        const after=ast.toString();
        const specificity=value=>parser.astSync(value).nodes.map(selectorSpecificity);
        assert.deepEqual(specificity(after),specificity(old));
        operations.push({kind:'shared-consumer-exclusion',selector:old,remaining:after,specificity:specificity(after),owner:'Unmarked legacy hub pagers retain this rule; marked collection workspaces use the new component pager.'});
        rule.selector=after;
      }
    }
    if(name==='base-rooms-v7.css'&&/camp-section-head|warehouse-header-actions|warehouse-capacity|camp-page-stat/.test(rule.selector)) {
      if(/\.warehouse-v3/.test(rule.selector)) {
        const old=rule.selector,ast=selectorParser().astSync(old);
        ast.walkPseudos(pseudo=>{
          if(pseudo.value!==':is')return;
          for(const branch of [...pseudo.nodes])if(branch.nodes.some(node=>node.type==='class'&&node.value==='warehouse-v3'))branch.remove();
        });
        const direct=ast.nodes.filter(branch=>branch.nodes.some(node=>node.type==='class'&&node.value==='warehouse-v3'));
        if(direct.length===ast.nodes.length)owned=true;
        else if(ast.toString()!==old) {
          assert.deepEqual(ast.nodes.map(selectorSpecificity),selectorParser().astSync(old).nodes.map(selectorSpecificity));
          operations.push({kind:'warehouse-header-branch',selector:old,remaining:ast.toString()});rule.selector=ast.toString();
        }
      } else if(rule.selector.includes(':is(.person-utilities,.warehouse-header-actions)')) {
        const old=rule.selector;rule.selector=old.replace(':is(.person-utilities,.warehouse-header-actions)',':is(.person-utilities)');
        operations.push({kind:'warehouse-header-branch',selector:old,remaining:rule.selector});
      } else if(/\.warehouse-capacity/.test(rule.selector))owned=true;
    }
    if(owned){operations.push({kind:'retired-covered-private-rule',selector:rule.selector,source:rule.toString(),replacement:'collection-workspace.css variant'});rule.remove();}
  });
  const after=root.toString();fs.writeFileSync(file,after);output.push({file,beforeSHA256:hash(before),afterSHA256:hash(after),before,after,operations});
}
fs.writeFileSync(evidence+'/private-overrides.json',JSON.stringify({changes:output},null,2)+'\n');
console.log(JSON.stringify(output.map(file=>({file:file.file,operations:file.operations.length,saved:Buffer.byteLength(file.before.replace(/\r\n/g,'\n'))-Buffer.byteLength(file.after.replace(/\r\n/g,'\n'))}))));
