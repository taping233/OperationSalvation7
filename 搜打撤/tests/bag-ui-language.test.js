import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import SDT, { sdtDefine } from '../game/src/core/sdt-facade.js';
import { pageHTML } from '../game/src/hub/game.bag.view2.js';
const model = { bagZone:'bag', bagFilter:'all', bagSortKey:'rarity', cap:16, baseCap:16, total:0, safeUsedN:2, sCap:6, pkN:0, used:3, coins:2, fragments:0, tiles:[], bagCardN:8, safeCardN:5, supplyN:2 };
const show = overrides => { document.body.innerHTML = pageHTML({...model,...overrides}); };
const visibleText = () => {
  const copy = document.body.cloneNode(true);
  copy.querySelectorAll('details').forEach(el => el.remove());
  return copy.textContent;
};
beforeEach(() => { sdtDefine('UI',{helpBtn:()=>''}); sdtDefine('Cards',{cardHTML:card=>`<div class="hs-card">${card.name}</div>`}); window.SDT = SDT; });

describe('backpack winter UI facts', () => {
  it('separates occupied slots, actual unfiltered cards and loose supplies', () => {
    show({bagFilter:'道具'});
    const header = document.querySelector('.bag-capchip').textContent;
    expect(header).toMatch(/3\s*\/16 格/);
    expect(header).toContain('卡牌 8 张');
    expect(header).toContain('散装物资 2 件');
    expect(document.querySelector('.bag-pill[data-f="道具"]').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.bag-rz[data-zone="bag"]').getAttribute('aria-label')).toContain('3/16 格');
  });
  it('safe slots retain actual card counts without explanatory paragraphs', () => {
    show({bagZone:'safe',petName:'旺财'});
    expect(document.querySelector('.bag-capchip').textContent).toMatch(/2\s*\/6 格/);
    expect(document.querySelector('.bag-capchip').textContent).toContain('卡牌 5 张');
    expect(visibleText()).not.toContain('旺财押运中');
    expect(visibleText()).not.toContain('移回背包失去安全格保护');
    expect(visibleText()).not.toContain('丢弃无法取回');
    expect(document.querySelector('.bag-tools')).toBeNull();
  });
  it('pocket uses actual quantities and never hides non-restorable types or extraction losses', () => {
    show({bagZone:'pocket',pkN:6,tiles:[{name:'法术',card:{name:'法术'},type:'法术',count:4,zone:'pocket'},{name:'盔甲',card:{name:'盔甲'},type:'装备',count:2,zone:'pocket'}]});
    expect(document.querySelector('.bag-capchip').textContent).toContain('6 张');
    expect(document.querySelector('.bag-capchip').textContent).toContain('不限容量');
    expect(visibleText()).not.toContain('火堆可复原 4 张／不可复原 2 张');
    expect(visibleText()).not.toContain('1/3 概率');
    expect(visibleText()).not.toContain('其余散失');
    expect(visibleText()).not.toContain('初始攻击/职业卡不可带回');
    expect(document.querySelector('[data-stack="盔甲"] .bag-tstate').textContent).toBe('火堆不可复原');
  });
  it('removes creature/supply filter tabs and explanations in all three zones', () => {
    for (const bagZone of ['bag', 'safe', 'pocket']) {
      show({bagZone});
      expect(document.querySelector('.bag-context')).toBeNull();
      expect(document.querySelector('.bag-disclosure')).toBeNull();
      expect(document.querySelector('.bag-znote')).toBeNull();
      expect(document.querySelector('[data-f="生物"],[data-f="supply"]')).toBeNull();
    }
  });
  it('keeps resource-only expansion and stored-container count in the header', () => {
    show({cap:25,capacityText:'通用格 16/16 · 资源扩展格 1/9',pearlStoredN:3});
    expect(document.querySelector('.bag-capchip').textContent).toContain('资源扩展格 1/9');
    expect(document.querySelector('.bag-capchip').textContent).toContain('盒内 3/9 张（不占格）');
  });
  it('preserves action IDs and contains no inventory mutation', () => {
    const data = {...model,tiles:[]}, before=JSON.stringify(data);
    show(data);
    for (const action of ['closeBag','bagZone','bagFilter','bagSortCycle','bagTidy']) expect(document.querySelector(`[data-act="${action}"]`)).not.toBeNull();
    expect(JSON.stringify(data)).toBe(before);
  });
  it('limits v3 artwork to opted-in backpack surfaces and decorative tile properties', () => {
    const css = readFileSync('game/css/bag-design-system.css','utf8');
    postcss.parse(css).walkRules(rule => {
      expect(rule.selector).toContain('.bag-v2.ui-design-system.bag-art-v3');
      expect(rule.selector).not.toMatch(/\.bag-grid|\.bag-ghost/);
      if (rule.selector.includes('.hs-card')) {
        expect(rule.selector).toContain('.bag-tile.card-face:focus-visible .hs-card');
        expect(rule.nodes.map(n => n.prop)).toEqual(['filter']);
      }
      if (rule.selector.includes('.bag-tile')) {
        rule.walkDecls(decl => expect(['background','border-radius','border-bottom-color','border-color','box-shadow','outline','outline-offset','filter'], `${rule.selector}: ${decl.prop}`).toContain(decl.prop));
      }
    });
    expect(css).not.toMatch(/z-index|pointer-events|transform:|grid-template/);
    expect(css).toContain('outline:none !important');
    expect(css).toContain('padding:var(--ui-space-6) 20px');
  });
});
