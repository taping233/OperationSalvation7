// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { mountCombatOverlay } from '../game/src/battle/view/battle.secondary-overlay.js';
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


it('never disconnects the retained scene or its descendants across repeated secondary transitions',()=>{
  const marker=document.createElement('i');scene.append(marker);
  const observer=new MutationObserver(()=>{});observer.observe(UI.el.ovBody,{childList:true,subtree:true});
  const atMode=[];const onMode=()=>atMode.push([scene.isConnected,marker.isConnected,scene.hasAttribute('inert')]);
  document.addEventListener('sdt-overlay-mode',onMode);
  for(let i=0;i<3;i++){
    show('规则','<button data-act="back" data-cancel="true">返回</button>','discover');
    expect(restoreCombatScene(UI,7)).toBe(true);
  }
  document.removeEventListener('sdt-overlay-mode',onMode);
  const removed=observer.takeRecords().flatMap(record=>[...record.removedNodes]);observer.disconnect();
  expect(removed.some(node=>node===scene || node.contains?.(scene) || node===marker)).toBe(false);
  expect(atMode).toEqual(Array.from({length:6},()=>[true,true,true]));
});
it('moves focus out of the shielded scene and restores the exact trigger after return',()=>{
  const trigger=document.querySelector('#battleAction');trigger.focus();
  show('规则','<button data-act="back" data-cancel="true">返回</button>','discover');
  vi.runOnlyPendingTimers();
  expect(document.activeElement.dataset.act).toBe('back');
  expect(UI._overlayFocusable()).not.toContain(trigger);
  expect(restoreCombatScene(UI,7)).toBe(true);
  vi.runOnlyPendingTimers();expect(document.activeElement).toBe(trigger);
});
it('does not leak retained background assets or sound selectors into secondary lifecycle',()=>{
  scene.insertAdjacentHTML('beforeend','<div class="node-pg sc-forbidden" data-asset-key="forbidden" data-music-scene="forbidden"></div>');
  const bg=vi.spyOn(UI,'_checkPageBg');SDT.Sound.scene=vi.fn();
  show('规则','<button data-act="back">返回</button>','discover');
  expect(bg.mock.calls.at(-1)[0]).toBe(document.querySelector('.battle-secondary-layer'));
  expect(SDT.Sound.scene).toHaveBeenLastCalledWith(null,'',{mode:'discover'});
  expect(restoreCombatScene(UI,7)).toBe(true);
  expect(bg.mock.calls.at(-1)[0].querySelector('[data-asset-key]')).toBeNull();
  expect(SDT.Sound.scene).toHaveBeenLastCalledWith(null,'',{mode:'battle'});bg.mockRestore();
});
it('does not clobber a newer ordinary overlay opened synchronously by the mode hook',()=>{
  const onMode=()=>{document.removeEventListener('sdt-overlay-mode',onMode);UI.showOverlay('新页面','<button id="newPage">继续</button>','page');};
  document.addEventListener('sdt-overlay-mode',onMode);
  expect(mountCombatOverlay(UI,'规则','<button>返回</button>','discover',scene)).toBe(false);
  expect(UI._lastMode).toBe('page');expect(UI.el.ovTitle.textContent).toBe('新页面');
  expect(document.querySelector('#newPage')).not.toBeNull();expect(scene.isConnected).toBe(false);
  expect(UI.el.ovBody.parentElement.classList.contains('battle')).toBe(false);
});
it('abandons a stale restore when the mode hook changes token or currentness',()=>{
  show('规则','<button>返回</button>','discover');
  let current=true;
  const onMode=()=>{current=false;scene._battleToken=8;};
  document.addEventListener('sdt-overlay-mode',onMode,{once:true});
  expect(restoreCombatScene(UI,7,{isCurrent:()=>current})).toBe(false);
  expect(scene.hasAttribute('inert')).toBe(true);
  expect(UI._lastMode).toBe('discover');
});
it('ordinary overlays still replace old content and focus their own initial target',()=>{
  document.querySelector('#battleAction').focus();
  UI.showOverlay('普通','<button id="ordinary" data-initial-focus>继续</button>','page');
  vi.runOnlyPendingTimers();expect(scene.isConnected).toBe(false);
  expect(document.activeElement.id).toBe('ordinary');expect(UI._hasBattleStage).toBe(false);
});

it('honors a non-first modal initial focus even when the retained scene has an explicit marker',()=>{
  document.querySelector('#battleAction').setAttribute('data-initial-focus','');
  document.querySelector('#battleAction').focus();
  show('规则','<button data-act="back">返回</button><button id="modalExplicit" data-initial-focus>指定操作</button>','discover');
  vi.runOnlyPendingTimers();expect(document.activeElement.id).toBe('modalExplicit');
});
it('a hook that queues replacement invalidates only the departed retained scene',()=>{
  let current=true;scene._battleRenderCurrent=()=>current;
  const onMode=()=>{current=false;};document.addEventListener('sdt-overlay-mode',onMode,{once:true});
  expect(mountCombatOverlay(UI,'规则','<button>返回</button>','discover',scene)).toBe(false);
  expect(scene.isConnected).toBe(false);expect(UI._hasBattleStage).toBe(false);
});
it('a newer renderer claiming the same scene is not removed by the departed callback',()=>{
  let current=true;scene._battleRenderCurrent=()=>current;
  const onMode=()=>{current=false;scene._battleRenderCurrent=()=>true;};document.addEventListener('sdt-overlay-mode',onMode,{once:true});
  expect(mountCombatOverlay(UI,'规则','<button>返回</button>','discover',scene)).toBe(false);
  expect(scene.isConnected).toBe(true);
});

it('abandons old title and body writes after a pre-mount hook opens another overlay',()=>{
  const tooltip=vi.spyOn(UI,'hideTooltip').mockImplementationOnce(()=>UI.showOverlay('较新页面','<button id="newBefore">继续</button>','page'));
  expect(mountCombatOverlay(UI,'旧规则','<button>返回</button>','discover',scene)).toBe(false);
  expect(UI.el.ovTitle.textContent).toBe('较新页面');expect(document.querySelector('#newBefore')).not.toBeNull();
  expect(UI._lastMode).toBe('page');tooltip.mockRestore();
});
it.each(['revision','body'])('does not discard a scene after a newer %s owner takes over',kind=>{
  let current=true;scene._battleRenderCurrent=()=>current;
  document.addEventListener('sdt-overlay-mode',()=>{
    current=false;
    if(kind==='revision') UI._overlayRevision++;
    else {const next=document.createElement('div');UI.el.ovBody.after(next);UI.el.ovBody=next;}
  },{once:true});
  expect(mountCombatOverlay(UI,'规则','<button>返回</button>','discover',scene)).toBe(false);
  expect(scene.isConnected).toBe(true);
});

it.each(['settings','discover','chest','wide'])('retained %s keeps coverage without borrowing room-view or changing its public mode',mode=>{
  expect(document.body.classList.contains('page-covered')).toBe(true);
  expect(mountCombatOverlay(UI,'面板','<button data-act="back">返回</button>',mode,scene)).toBe(true);
  expect(UI._lastMode).toBe(mode);
  expect(UI.el.overlay.classList.contains('room-view')).toBe(false);
  expect(UI.el.overlay.classList.contains('pick-veil')).toBe(['discover','chest'].includes(mode));
  expect(document.body.classList.contains('page-covered')).toBe(true);
  expect(restoreCombatScene(UI,7)).toBe(true);
  expect(document.body.classList.contains('page-covered')).toBe(true);
  UI.showOverlay('普通','<button>继续</button>','settings');
  expect(document.body.classList.contains('page-covered')).toBe(false);
  expect(UI.el.overlay.matches('body #overlay:has(> .card > #ovBody > .battle-secondary-layer)')).toBe(false);
});
it.each(['settings','discover','chest','formation'])('ordinary %s retains its preexisting veil and coverage policy',mode=>{
  UI.showOverlay('普通','<button>继续</button>',mode);
  expect(UI.el.overlay.classList.contains('room-view')).toBe(false);
  expect(UI.el.overlay.classList.contains('pick-veil')).toBe(['discover','chest'].includes(mode));
  expect(document.body.classList.contains('page-covered')).toBe(mode==='chest');
  expect(UI.el.ovBody.parentElement.classList.contains('battle')).toBe(false);
});
it('a newer ordinary hook owns coverage rather than the abandoned retained callback',()=>{
  document.addEventListener('sdt-overlay-mode',()=>UI.showOverlay('普通','<button>继续</button>','settings'),{once:true});
  expect(mountCombatOverlay(UI,'规则','<button>返回</button>','settings',scene)).toBe(false);
  expect(document.body.classList.contains('page-covered')).toBe(false);
  expect(UI.el.overlay.matches('body #overlay:has(> .card > #ovBody > .battle-secondary-layer)')).toBe(false);
});
it.each(['rules','settings','discover'])('native DOM styles keep %s shield in viewport with block battle geometry',kind=>{
  // jsdom checks CSS declarations/selector lifecycle, not layout, pixels or timings.
  const style=document.createElement('style');
  style.textContent=['overlays','battle-stage','expedition-battle','battle-decision','battle-secondary-overlay'].map(name=>
    readFileSync(`game/css/${name}.css`,'utf8').replace(/@import[^;]+;/g,'')).join('\n');
  document.head.append(style);
  try {
    show('面板',`<section data-decision-content="${kind}"><button>返回</button></section>`,kind==='discover'?'discover':'settings');
    const overlay=getComputedStyle(UI.el.overlay),card=getComputedStyle(UI.el.ovBody.parentElement),body=getComputedStyle(UI.el.ovBody);
    expect(overlay.position).toBe('fixed');expect(overlay.inset).toBe('0');expect(overlay.padding).toBe('0px');
    expect(card.position).toBe('relative');expect(card.display).toBe('block');expect(card.overflow).toBe('clip');
    expect(card.width).toBe('100%');expect(card.height).toBe('100%');expect(card.flexDirection).toBe('row');
    expect(body.display).toBe('block');expect(body.height).toBe('100%');expect(body.overflow).toBe('clip');
    expect(restoreCombatScene(UI,7)).toBe(true);
    expect(UI.el.overlay.classList.contains('room-view')).toBe(true);
    expect(getComputedStyle(UI.el.ovBody.parentElement).display).toBe('block');
  } finally {style.remove();}
});
it('formation presenter does not borrow retained viewport ownership',()=>{
  show('编队','<section data-decision-content="formation"><button data-act="bossGo">开战</button></section>','wide');
  expect(scene.isConnected).toBe(false);
  expect(document.querySelector('.battle-secondary-layer')).toBeNull();
  expect(document.body.classList.contains('page-covered')).toBe(false);
  expect(UI.el.ovBody.parentElement.classList.contains('battle')).toBe(false);
});
it('immediate exit releases retained coverage and layer before a new battle starts',()=>{
  show('规则','<section data-decision-content="rules"><button>返回</button></section>','settings');
  UI.hideOverlay({immediate:true});
  expect(document.body.classList.contains('page-covered')).toBe(false);
  expect(UI.el.overlay.hidden).toBe(true);expect(scene.isConnected).toBe(false);
  expect(document.querySelector('.battle-secondary-layer')).toBeNull();
  UI.showOverlay('','<div class="battle-stage sts" id="newBattle"></div>','battle');
  expect(UI.el.overlay.classList.contains('room-view')).toBe(true);
  expect(document.body.classList.contains('page-covered')).toBe(true);
  expect(document.querySelector('#newBattle')).not.toBeNull();
  expect(restoreCombatScene(UI,7)).toBe(false);
});
