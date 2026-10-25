// @vitest-environment jsdom
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import {selectorSpecificity} from '@csstools/selector-specificity';
const css = name => postcss.parse(fs.readFileSync(`game/css/${name}.css`,'utf8'));
const workspace = css('collection-workspace');
// Exercise the actual cascade under both ESM stylesheet arrival orders. This
// intentionally derives winners instead of copying the implementation's rules.
function cascade(element,roots,{reduced=false}={}) {
  const result=new Map();let order=0;
  function visit(container,parents=[]) {
    for(const node of container.nodes||[]) {
      if(node.type==='atrule') { if(node.name==='media'&&reduced)visit(node,parents);continue; }
      if(node.type!=='rule')continue;
      const selectors=postcss.list.comma(node.selector).flatMap(selector=>parents.length
        ? parents.map(parent=>selector.includes('&')?selector.replaceAll('&',parent):`${parent} ${selector}`)
        : [selector]);
      for(const selector of selectors) {
        const matching=selector.replace(/:(hover|active|focus-visible)/g,'.state-$1');
        if(!element.matches(matching))continue;
        const {a,b,c}=selectorSpecificity(selectorParser().astSync(selector).nodes[0]);
        for(const declaration of node.nodes.filter(child=>child.type==='decl')) {
          const priority=[Number(!!declaration.important),a,b,c,order++],previous=result.get(declaration.prop);
          const higher=!previous||priority.some((value,index)=>value!==previous.priority[index]&&priority.slice(0,index).every((part,i)=>part===previous.priority[i])&&value>previous.priority[index]);
          if(higher)result.set(declaration.prop,{priority,value:declaration.value});
        }
      }
      visit(node,selectors);
    }
  }
  roots.forEach(root=>visit(root));
  return Object.fromEntries([...result].map(([prop,entry])=>[prop,entry.value]));
}
function fixture(name) {
  document.body.innerHTML=`<div id="overlay"><div id="hubMain"><section class="collection-workspace battle-decision battle-decision-unified" data-collection-variant="${name}"><header class="collection-toolbar"><input><select></select><span>数量</span></header><div class="collection-body"><div class="card-browser"><div class="collection-list"><button class="collection-item pearl-store-card"><span class="collection-art"><div class="hs-card"></div></span><span class="collection-caption"><b class="collection-label">卡牌</b></span></button></div><footer class="card-browser-footer"><button class="card-browser-page">下一页</button></footer></div></div><div class="collection-empty"><h3>空目录</h3></div></section></div></div>`;
  const entry=name==='owned'?css('base-collection-v4'):name==='container'?css('container-store'):null;
  return {root:document.querySelector('.collection-workspace'),item:document.querySelector('.collection-item'),entry};
}

describe('collection workspace final component variants', () => {
  it('keeps layout and state winners independent of shared/variant stylesheet arrival order', () => {
    for(const name of ['owned','container']) {
      const {root,item,entry}=fixture(name),common=css('card-browser');
      for(const state of ['', 'on','selected','state-hover','state-focus-visible']) {
        item.className=`collection-item pearl-store-card ${state}`;
        for(const element of root.querySelectorAll('*')) {
          expect(cascade(element,[common,workspace,entry])).toEqual(cascade(element,[common,entry,workspace]));
        }
      }
    }
  });
  it('keeps large art distinct from compact collected thumbnails, with container text independently scaled', () => {
    const scales={};
    for(const name of ['owned','personnel','warehouse','container']) {
      const {root,entry}=fixture(name),roots=entry?[workspace,entry]:[workspace];
      scales[name]={width:cascade(root.querySelector('.collection-art'),roots).width,font:parseFloat(cascade(root.querySelector('.hs-card'),roots)['font-size'])};
    }
    expect(parseFloat(scales.owned.width)).toBeLessThan(parseFloat(scales.warehouse.width));
    expect(scales.personnel.width).toContain('100cqh');
    expect(scales.container.font).toBeGreaterThan(scales.warehouse.font);
  });
  it('retains empty-state access, disabled transfer affordances and reduced-motion behavior', () => {
    let {item,entry}=fixture('container');item.disabled=true;
    expect(cascade(item,[workspace,entry]).outline).toBe('none');
    expect(Number(cascade(item,[workspace,entry]).opacity)).toBeLessThan(1);
    const owned=fixture('owned'),root=owned.root;item=owned.item;entry=owned.entry;root.dataset.empty='true';
    expect(cascade(root.querySelector('.collection-body'),[entry,workspace]).display).toBe('none');
    expect(cascade(root.querySelector('.collection-empty'),[entry,workspace]).display).toBe('flex');
    item.classList.add('state-hover');
    expect(cascade(item,[entry,workspace],{reduced:true}).transform).toBe('none');
    expect(cascade(item,[entry,workspace],{reduced:true}).transition).toBe('none');
  });
  it('keeps default pagination in its functional entry and fully parses the rebuilt selectors', () => {
    expect(css('card-browser').nodes.some(node=>node.type==='rule'&&node.selector==='.card-browser-page:disabled')).toBe(true);
    expect(workspace.nodes.some(node=>node.type==='rule'&&node.selector==='.card-browser-page')).toBe(false);
    for(const name of ['collection-workspace','base-collection-v4','container-store','base-camp-rework','base-rooms-v7','base-cohesion-v5','base-personnel-v12','base-logistics-trade-v12','base-archive-facilities-v12','expedition-inventory']) {
      css(name).walkRules(rule=>expect(()=>selectorParser().astSync(rule.selector)).not.toThrow());
    }
  });
});
