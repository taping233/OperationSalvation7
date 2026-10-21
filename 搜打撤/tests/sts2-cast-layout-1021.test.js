import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { infusionHandCards } from '../game/src/battle/view/battle.infusion-material-state.js';
import { battleDiscoverBodyHTML } from '../game/src/battle/view/battle.discover-view.js';

describe('in-place infusion UID projection', () => {
  const card = Object.freeze({ id:'same', name:'同名牌', type:'法术', cost:1, desc:'规则' });
  it('separates the source from same-name physical copies without changing hand or selection', () => {
    const entries = Object.freeze(['source','owned','temporary'].map(uid => Object.freeze({ uid, card })));
    const infusion = Object.freeze({ uid:'source', picked:Object.freeze(['temporary']) });
    const result = infusionHandCards(entries, infusion);
    expect(result.map(entry => entry.uids)).toEqual([['owned'],['temporary']]);
    expect(result.map(entry => [entry.copyIndex,entry.totalCopies,entry.selectedCopies])).toEqual([[1,2,1],[2,2,1]]);
    expect(new Set(result.map(entry => entry.key)).size).toBe(2);
    expect(entries.map(entry => entry.uid)).toEqual(['source','owned','temporary']);
    expect(infusion.picked).toEqual(['temporary']);
  });
  it('keeps copy identity and shortcut assignment stable as a selected UID leaves the candidate hand', () => {
    const entries = ['source','first','second'].map(uid => ({ uid, card }));
    const before = infusionHandCards(entries, { uid:'source', picked:[] });
    const after = infusionHandCards(entries, { uid:'source', picked:['second'] });
    expect(after.map(entry => [entry.key,entry.shortcut,entry.copyIndex])).toEqual(before.map(entry => [entry.key,entry.shortcut,entry.copyIndex]));
    expect(after.find(entry => entry.uids[0] === 'second').selectedCopies).toBe(1);
  });
  it('exposes every candidate beyond one normal hand page without inventing more number shortcuts', () => {
    const entries = Array.from({length:15}, (_,index) => ({ uid:String(index), card }));
    const result = infusionHandCards(entries, { uid:'0', picked:[] });
    expect(result).toHaveLength(14);
    expect(result.slice(0,9).map(entry => entry.shortcut)).toEqual([1,2,3,4,5,6,7,8,9]);
    expect(result.slice(9).every(entry => entry.shortcut === null)).toBe(true);
    expect(result.at(-1).uids).toEqual(['14']);
  });
  it('retains the ordinary category order while preserving actual UID and effective card values', () => {
    const entries = [{uid:'equip',card:{id:'equip',type:'装备',name:'甲'}}, {uid:'source',card},
      {uid:'starter',card:{id:'starter-attack',type:'武术',name:'初始攻击'}}, {uid:'changed',card:{...card,cost:0,desc:'本回合强化'}}];
    const result = infusionHandCards(entries, {uid:'source',picked:[]});
    expect(result.map(entry => entry.uids[0])).toEqual(['starter','changed','equip']);
    expect(result[1].card).toBe(entries[3].card);
    expect(result[1].card.cost).toBe(0);
  });
});

describe('single-action discovery composition', () => {
  function present() {
    const root=document.createElement('div');
    root.innerHTML=battleDiscoverBodyHTML({ candidates:[{card:{name:'候选 <甲>'},sourceNote:'来自牌库底',infusionNote:'未注能，直释视为已注能',equipmentNote:'对战开始时生效'}],
      cardHTML:() => '<div class="hs-card">完整卡面</div>', action:'选择 1 张免费施放', remaining:1, source:'来源牌', note:'临时牌', modifiers:['费用变为 0'], pageToken:'page-1' });
    return root;
  }
  it('keeps one card action and only the essential infusion exception outside the card', () => {
    const root=present(), choice=root.querySelector('[data-act="btDiscover"]');
    expect(choice.querySelector('.hs-card')).not.toBeNull();
    expect(choice.querySelector('.battle-discover-equipment-note')).toBeNull();
    expect(root.querySelector('.battle-discover-card-notes')).toBeNull();
    expect(root.querySelector('.battle-discover-critical').textContent).toBe('未注能');
    expect(choice.getAttribute('aria-label')).toContain('直释视为已注能');
    expect([...root.querySelectorAll('[data-act]')].map(node=>node.dataset.act)).toEqual(['btDiscover','btDecisionInspect']);
    expect(choice.dataset.discoverPage).toBe('page-1');
  });
  it('keeps contextual rules accessible without repeating them beside the cards', () => {
    const root=present();
    expect(root.querySelector('.battle-discover-rules,.battle-discover-meta,.battle-discover-card-caption')).toBeNull();
    expect(root.querySelector('[data-battle-discover]').getAttribute('aria-label')).toContain('临时牌，费用变为 0');
    expect(root.querySelector('[data-act="btDiscover"]').getAttribute('aria-label')).toContain('候选 <甲>');
    expect(root.querySelector('甲')).toBeNull();
    expect(root.querySelector('[data-battle-discover]').getAttribute('aria-label')).toContain('来源牌');
  });
});

describe('combat secondary background isolation', () => {
  it.each([
    ['battle-discover.css', '.battle-discover-panel', 'body #overlay:has(.battle-discover-panel) #ovBody > .battle-stage.sts'],
    ['battle-pile-view.css', '[data-battle-pile-view]', 'body #overlay:has([data-battle-pile-view]) #ovBody > .battle-stage.sts'],
  ])('composites the softened %s battlefield against an opaque combat base', (file, marker, stageSelector) => {
    const css=postcss.parse(readFileSync(`game/css/${file}`,'utf8'));
    const values=selector=>{
      const found={}; css.walkRules(rule=>{ if(rule.selector===selector)rule.walkDecls(decl=>{found[decl.prop]=decl.value;}); }); return found;
    };
    expect(values(`body #overlay:has(.battle-secondary-layer ${marker}) #ovBody`)).toMatchObject({ background:'#10161b', isolation:'isolate', overflow:'hidden' });
    expect(values(stageSelector)).toMatchObject({ filter:'blur(7px)', opacity:'.72' });
  });
});
