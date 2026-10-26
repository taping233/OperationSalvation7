import { esc } from '../core/shared.js';
import { completeSurfaceMotion } from './motion-completion.js';
import { motionReduced, motionTiming } from './motion-presets.js';
import '../../css/fire-rest-feedback.css';

const active = new WeakMap();
const outcomeArt = {
  heal:new URL('../../assets/ui/outcome/recovery-v2.webp',import.meta.url).href,
  restore:new URL('../../assets/ui/outcome/restoration-v2.webp',import.meta.url).href,
  sacrifice:new URL('../../assets/ui/outcome/offering-v2.webp',import.meta.url).href,
  activate:new URL('../../assets/ui/outcome/offering-v2.webp',import.meta.url).href,
};
const idle = () => Object.assign(Promise.resolve(false), { started:false });
const sceneFor = (root, surface) => surface || root?.firstElementChild;
const ownsScene = (root, scene) => !!scene?.isConnected && (!root || root.contains(scene))
  && !scene.closest('[hidden], .closing, [data-ui-closing]');

/** @typedef {{kind:'heal'|'restore'|'sacrifice'|'activate', hpBefore?:number, hpAfter?:number, maxHp?:number,
 * cards?:any[], cardHTML?:(card:any)=>string, isCurrent?:()=>boolean, compact?:boolean, blocking?:boolean,
 * surface?:HTMLElement|null, duration?:number, destination?:string, cost?:string, source?:string,
 * activate?:boolean, extra?:string, sourceCard?:any}} OutcomeOptions */

// Only presents effects already accepted by the owning command. Never pays, heals or saves.
/** @param {HTMLElement|null|undefined} root @param {OutcomeOptions} options @returns {Promise<boolean> & {started:boolean}} */
export function playOutcomeFeedback(root, { kind, hpBefore = 0, hpAfter = 0, maxHp = 1,
  cards = [], cardHTML = card => esc(card.name), isCurrent = () => true,
  blocking = false, surface = null, duration,
  destination = '背包', cost = '', source = '', activate = false, extra = '', sourceCard = null }) {
  const scene = /** @type {HTMLElement} */ (sceneFor(root, surface));
  if (!ownsScene(root, scene) || !isCurrent()) return idle();
  active.get(scene)?.();
  if (kind === 'restore' && cards.length) window.SDT?.Sound?.sfx?.('cardRestore');
  if (motionReduced() || typeof scene.animate !== 'function') return idle();
  const healing = kind === 'heal', sacrificing = kind === 'sacrifice';
  const timing = duration ?? Math.min(motionTiming.outcomeShort, 900);
  const doc = scene.ownerDocument, stage = doc.createElement('div');
  stage.className = `outcome-feedback fire-rest-feedback is-${kind} is-compact${activate ? ' is-activating' : ''}`;
  stage.style.setProperty('--fire-rest-duration', `${timing}ms`);
  stage.setAttribute('role', 'status'); stage.setAttribute('aria-live', 'polite');
  const ratio = hp => Math.max(0, Math.min(1, hp / Math.max(1, maxHp)));
  stage.style.setProperty('--fire-hp-before', String(ratio(hpBefore)));
  stage.style.setProperty('--fire-hp-after', String(ratio(hpAfter)));
  const renderCard = card => { try { return cardHTML(card); } catch { return `<span>${esc(card.name)}</span>`; } };
  const cardList = cards.slice(0, 3).map((card, i) => `<div class="fire-rest-reveal-card" style="--i:${i}"><div aria-hidden="true">${renderCard(card)}</div><span>${esc(card.name)}</span></div>`).join('');
  const heading = healing ? '生命恢复' : sacrificing ? '献祭充能' : kind === 'activate' ? '祭坛苏醒' : '卡牌复原';
  const summary = healing ? `+${Math.max(0, hpAfter - hpBefore)}` : kind === 'activate' ? '已激活' : `${cards.length} 张`;
  const detail = healing ? `${hpBefore} → ${hpAfter} / ${maxHp}` : sacrificing
    ? (activate ? `${destination}已激活` : `${destination}充能完成`) : kind === 'activate' ? '献礼已收下' : `已回到${destination}`;
  stage.innerHTML = `<div class="outcome-art" aria-hidden="true"><img src="${outcomeArt[kind]}" alt="" decoding="async" draggable="false"></div>${cost ? `<div class="outcome-cost">${esc(cost)}</div>` : ''}`
    + (sourceCard ? `<div class="outcome-source-payment" aria-hidden="true">${renderCard(sourceCard)}</div>` : '')
    + (healing || kind === 'activate' ? '' : `<div class="fire-rest-reveal">${cardList}</div>`)
    + `<div class="fire-feedback-copy">${source ? `<small class="outcome-source">${esc(source)}</small>` : ''}<p>${heading}</p><strong>${summary}</strong>`
    + (healing ? '<div class="fire-heal-meter" aria-hidden="true"><span></span></div>' : '')
    + `<small>${esc(detail)}</small>${extra ? `<small>${esc(extra)}</small>` : ''}</div>`;
  stage.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
  const controls = blocking ? [...scene.querySelectorAll('button')].map(button => ({ button, disabled:button.disabled })) : [];
  const oldBusy = scene.getAttribute('aria-busy');
  controls.forEach(({button}) => { button.disabled = true; });
  if (blocking) scene.setAttribute('aria-busy','true');
  const oldPosition = scene.style.position;
  if (getComputedStyle(scene).position === 'static' || !getComputedStyle(scene).position) scene.style.position = 'relative';
  scene.append(stage);
  /** @type {Promise<boolean>} */
  const promise = new Promise(resolve => {
    let cancelMotion = () => {}, settled = false;
    const current = () => ownsScene(root, scene) && stage.isConnected && isCurrent();
    const observer = new MutationObserver(() => {
      if (!current()) finish(false);
    });
    const finish = current => {
      if (settled) return;
      settled = true; cancelMotion(); observer.disconnect(); stage.remove();
      controls.forEach(({button,disabled}) => { button.disabled = disabled; });
      if (blocking) {
        if (oldBusy === null) scene.removeAttribute('aria-busy'); else scene.setAttribute('aria-busy',oldBusy);
      }
      scene.style.position = oldPosition;
      if (active.get(scene) === cancel) active.delete(scene);
      resolve(current);
    };
    const cancel = () => finish(false);
    active.set(scene,cancel);
    observer.observe(doc.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','class','data-ui-closing']});
    cancelMotion = completeSurfaceMotion(stage,()=>finish(current()),{duration:timing,name:'fire-rest-feedback'});
  });
  return Object.assign(promise,{started:true});
}

// Keep existing synchronous commands synchronous when motion cannot run.
export function afterOutcomeFeedback(root, options, next) {
  const scene = sceneFor(root, options.surface);
  const playback = playOutcomeFeedback(root,options);
  const proceed = () => {
    if (ownsScene(root, scene) && (!options.isCurrent || options.isCurrent())) return next();
    return false;
  };
  return playback.started ? playback.then(current => current ? proceed() : false) : proceed();
}
