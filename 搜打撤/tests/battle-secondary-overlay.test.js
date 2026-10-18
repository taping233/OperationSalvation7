// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { createBattleDecisionPresenter, restoreCombatScene } from '../game/src/battle/view/battle.decision-shell.js';
const SDT=(await import('../game/src/core/sdt-facade.js')).default;
const {UI}=await import('../game/src/ui/ui.js');
let show,scene,snapshot;
beforeEach(()=>{
  vi.useFakeTimers();
  document.body.innerHTML='<main id="viewport"><div id="heroAva"></div><button id="outside">地图</button><div id="overlay" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  SDT.Icons={rich:x=>x,img:()=>''};SDT.Sound={sfx(){}};SDT.Motion={overlayIn(){},reduceMotion:()=>true};
  SDT.game={battleActive:true};
  UI._acts={};UI._overlayInerted=[];UI._roomActive=false;UI.init();
  snapshot={battleToken:7,turn:2,energy:3,maxEnergy:3,opts:{}};
  UI.showOverlay('', '<div class="battle-stage sts"><button id="battleAction" data-act="btEnd">结束回合</button><div class="sts-hand">真实手牌</div></div>', 'battle');
  scene=UI.el.ovBody.firstElementChild;scene._battleToken=7;
  show=createBattleDecisionPresenter({UI,getSnapshot:()=>snapshot,R:()=>({battleEnergy:3})});
});
afterEach(()=>{UI._cancelPageBg?.();vi.clearAllTimers();vi.useRealTimers();document.body.replaceChildren();});
it.each(['choice','discover','hand-select','infusion','pile','settings','rules','other','bag'])('%s keeps the exact live scene and isolates only background controls',kind=>{
  show('选择',`<section data-decision-content="${kind}"><button data-act="pick" data-cancel="false">选择</button></section>`,'discover');
  expect(UI.el.ovBody.querySelector('.battle-stage')).toBe(scene);
  expect(scene.hasAttribute('inert')).toBe(true);expect(scene.getAttribute('aria-hidden')).toBe('true');
  expect(UI._hasBattleStage).toBe(true);
  expect(UI._overlayFocusable().map(el=>el.textContent)).toEqual(['选择']);
  expect(UI.closeTopOverlayByEsc()).toBe(false);
  expect(UI.el.ovBody.querySelector('.battle-stage')).toBe(scene);
});
it('refresh preserves scene, scroll and focused selection; returning reuses same scene',()=>{
  const html='<section data-decision-content="hand-select"><button data-act="pick" data-uid="one">选择</button></section>';
  show('手选',html,'discover');
  document.querySelector('.battle-decision-content').scrollTop=67;
  document.querySelector('[data-act="pick"]').focus();
  show('手选',html,'discover');
  expect(UI.el.ovBody.querySelector('.battle-stage')).toBe(scene);
  expect(document.querySelector('.battle-decision-content').scrollTop).toBe(67);
  expect(document.activeElement.dataset.uid).toBe('one');
  expect(restoreCombatScene(UI,7)).toBe(true);
  expect(UI.el.ovBody.firstElementChild).toBe(scene);
  expect(scene.hasAttribute('inert')).toBe(false);expect(scene.hasAttribute('aria-hidden')).toBe(false);
  expect(UI._lastMode).toBe('battle');expect(document.querySelector('.battle-secondary-layer')).toBeNull();
});
it('optional cancellation uses existing return action; blank shield does not choose or cancel',()=>{
  const cancel=vi.fn();
  show('选牌','<section data-decision-content="hand-select"><button data-act="pick" data-cancel="false">选择</button></section><div class="ov-btns"><button data-act="skip">跳过该效果</button></div>','discover');
  UI.act('skip',cancel);
  document.querySelector('.battle-secondary-layer').click();expect(cancel).not.toHaveBeenCalled();
  expect(UI.closeTopOverlayByEsc()).toBe(true);expect(cancel).toHaveBeenCalledOnce();
});
it('new battle and noncombat navigation never recover a stale retained scene',()=>{
  show('选择','<section data-decision-content="choice"><button>选择</button></section>','discover');
  expect(restoreCombatScene(UI,8)).toBe(false);
  UI.showOverlay('奖励','<button>领取</button>','chest');
  expect(scene.isConnected).toBe(false);expect(restoreCombatScene(UI,7)).toBe(false);
});
it('shared CSS has transparent shield and content-sized panel without full-height surface',()=>{
  const css=postcss.parse(readFileSync('game/css/battle-secondary-overlay.css','utf8'));
  const rules=[];css.walkRules(r=>{const d={};r.walkDecls(x=>d[x.prop]=x.value);rules.push({selector:r.selector,d});});
  expect(rules.find(r=>r.selector==='body #overlay .battle-secondary-layer').d.background).toBe('transparent');
  const panel=rules.find(r=>r.selector==='body #overlay .battle-decision.battle-decision-unified.battle-secondary-panel');
  expect(panel.d.height).toBe('auto');expect(panel.d.background).toBe('var(--feedback-panel)');
});

it('full-screen secondary card clears legacy discover filters without changing small panels',()=>{
  const selector='body #overlay .card.card:has(> #ovBody > .battle-secondary-layer)';
  const css=postcss.parse(readFileSync('game/css/battle-secondary-overlay.css','utf8'));
  const rules=[];css.walkRules(rule=>{if(rule.selector===selector)rules.push(rule);});
  expect(rules).toHaveLength(1);
  for(const prop of ['backdrop-filter','-webkit-backdrop-filter']){
    const declarations=[];rules[0].walkDecls(prop,decl=>declarations.push(decl));
    expect(declarations).toHaveLength(1);
    expect(declarations[0].value).toBe('none');
    expect(declarations[0].important).toBe(true);
  }
  // Two IDs in this exact selector outrank the legacy discover rule's one ID,
  // even when both declarations are important and discover CSS loads later.
  const legacy=postcss.parse(readFileSync('game/css/battle-discover.css','utf8'));
  const glass=[];legacy.walkRules(rule=>{
    rule.walkDecls('backdrop-filter',decl=>{if(decl.value.includes('blur('))glass.push(rule.selector);});
  });
  expect(glass).toEqual(['body #overlay .card.discover:has(.battle-decision[data-decision-kind="discover"])']);
  document.body.innerHTML='<div id="overlay"><div class="card wide discover battle"><div id="ovBody"><section class="battle-secondary-layer"><section class="battle-secondary-panel battle-decision" data-decision-kind="discover"></section></section></div></div></div>';
  const card=document.querySelector('.card');
  expect(card.matches(selector)).toBe(true);
  expect(document.querySelector('.battle-secondary-panel').matches(selector)).toBe(false);
  document.querySelector('.battle-secondary-layer').replaceWith(document.createElement('section'));
  expect(card.matches(selector)).toBe(false);
});
