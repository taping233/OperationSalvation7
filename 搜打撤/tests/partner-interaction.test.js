import { connectSdtFixture } from './helpers/environment-fixtures.js';
import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { partnerInteractionHTML, mountPartnerInteraction } from '../game/src/ui/partner-interaction.js';
import { partnerPortrait } from '../game/src/hub/hub.visuals.js';
import { Random, SeededRandomService, setRandomService } from '../game/src/core/random.js';
import { RULES } from '../game/src/core/rules.js';
import SDT from '../game/src/core/sdt-facade.js';
vi.mock('../game/src/run/game.session.js', () => ({ MAP: { rules: { safeStart: 2, safeMax: 6 } } }));
import { personnelHTML, bindPersonnel, setPersonnelGroup } from '../game/src/hub/hub.personnel.js';
import { readCssSource } from './helpers/css-source.js';
await import('../game/src/hub/base.js');

const Base = SDT.Base;
let dispose, media, randomService;
beforeEach(async () => {
  vi.useFakeTimers();
  media = { matches: false };
  vi.stubGlobal('matchMedia', () => media);
  await connectSdtFixture(SDT);
  SDT.MAP = { rules: RULES };
  localStorage.clear();
  Base.use(1);
  Base.data.pets = { dog: { lv: 2, ts: 123 } };
  Base.data.petSel = 'dog';
  Base.data.coins = 90;
  Base.data.rations = 12;
  expect((await Base.save())).toBe(true);
  randomService = setRandomService(new SeededRandomService('optional-partner'));
  for (const stream of ['gameplay', 'battle', 'loot', 'shop', 'map']) Random.random(stream);
  setPersonnelGroup('pets');
  // Drain jsdom storage-event tasks from fixture creation before measuring the UI timer.
  vi.runOnlyPendingTimers();
});
afterEach(() => {
  dispose?.(); dispose = null;
  document.body.replaceChildren();
  document.body.classList.remove('reduce-motion');
  vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

function mount(id = 'dog') {
  document.body.innerHTML = partnerInteractionHTML(partnerPortrait(id), { id, name: '旺财' });
  const root = document.querySelector('[data-partner-play]');
  dispose = mountPartnerInteraction(root);
  return { root, button: root.querySelector('button'), reply: root.querySelector('[role="status"]') };
}

describe('可选伙伴轻触展示', () => {
  it('uses a native named button on the portrait, a quiet hint and one empty live region', () => {
    const { root, button, reply } = mount();
    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-label')).toBe('逗一逗旺财');
    expect(button.querySelector('.companion-art')).not.toBeNull();
    expect(button.hasAttribute('data-act')).toBe(false);
    expect(reply.textContent).toBe('');
    expect(reply.getAttribute('aria-live')).toBe('polite');
    expect(root.querySelector('.partner-play-hint').getAttribute('aria-hidden')).toBe('true');
    const safe = partnerInteractionHTML('', { id: 'x" onfocus="bad', name: '名字" onclick="bad' });
    document.body.insertAdjacentHTML('beforeend', safe);
    expect(document.querySelector('[onfocus],[onclick]')).toBeNull();
  });

  it('cycles three fixed reactions, then clears feedback with no background work', () => {
    const { root, button, reply } = mount();
    for (const reaction of ['tilt', 'hop', 'nuzzle', 'tilt']) {
      button.click();
      expect(root.dataset.reaction).toBe(reaction);
      expect(reply.textContent).not.toBe('');
      expect(vi.getTimerCount()).toBe(1);
    }
    vi.advanceTimersByTime(1400);
    expect(root.hasAttribute('data-reaction')).toBe(false);
    expect(reply.textContent).toBe('');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rapid repeated taps replace a single timer and never accumulate nodes or actions', () => {
    const { root, button } = mount();
    const count = root.querySelectorAll('*').length;
    for (let i = 0; i < 200; i++) button.click();
    expect(vi.getTimerCount()).toBe(1);
    expect(root.querySelectorAll('*')).toHaveLength(count);
    expect(root.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(root.querySelectorAll('button')).toHaveLength(1);
    vi.advanceTimersByTime(1400);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['setting', 'system'])('keeps static feedback in %s reduced-motion mode', mode => {
    if (mode === 'setting') document.body.classList.add('reduce-motion');
    else media.matches = true;
    const { root, button, reply } = mount('cat');
    button.click();
    expect(root.hasAttribute('data-reaction')).toBe(false);
    expect(reply.textContent).toBe('嗯？');
    vi.advanceTimersByTime(1400);
    expect(reply.textContent).toBe('');
  });

  it('disposes synchronously and idempotently, leaving detached old buttons inert', () => {
    const { root, button, reply } = mount();
    const remove = vi.spyOn(document, 'removeEventListener');
    button.click();
    dispose(); dispose();
    expect(vi.getTimerCount()).toBe(0);
    expect(reply.textContent).toBe('');
    expect(root.hasAttribute('data-reaction')).toBe(false);
    button.click();
    expect(vi.getTimerCount()).toBe(0);
    expect(remove.mock.calls.filter(([event]) => event === 'visibilitychange')).toHaveLength(1);
    expect(remove.mock.calls.filter(([event]) => event === 'sdt-overlay-close')).toHaveLength(1);
  });

  it('the overlay closing event releases the interaction even outside the normal hub exit', () => {
    const { button, reply } = mount();
    button.click();
    document.dispatchEvent(new Event('sdt-overlay-close'));
    expect(vi.getTimerCount()).toBe(0);
    button.click();
    expect(reply.textContent).toBe('');
  });

  it('a hidden document drops current feedback without scheduling a replay', () => {
    const { button, reply } = mount();
    button.click();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
    expect(reply.textContent).toBe('');
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('another overlay replacing the portrait releases its pending work and listeners', () => {
    const { root, button, reply } = mount();
    button.click();
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'page' }));
    expect(vi.getTimerCount()).toBe(1);
    root.remove();
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'page' }));
    expect(vi.getTimerCount()).toBe(0);
    button.click();
    expect(reply.textContent).toBe('');
  });

  it('a detached portrait cannot start another reaction', () => {
    const { root, button, reply } = mount();
    button.click();
    root.remove(); button.click();
    expect(vi.getTimerCount()).toBe(0);
    expect(reply.textContent).toBe('');
  });

  it('missing display hosts are safe no-ops', () => {
    expect(() => mountPartnerInteraction(null)()).not.toThrow();
    expect(() => mountPartnerInteraction(document.body)()).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('伙伴页接线与数值隔离', () => {
  function render() {
    dispose?.();
    document.body.innerHTML = personnelHTML('wu');
    const actions = new Map();
    dispose = bindPersonnel({ ui: { act: (key, handler) => actions.set(key, handler) }, refresh: render, sound: { tick: vi.fn() } });
    return actions;
  }

  it('ten taps leave real Base data, all RNG streams, commands and all persisted keys unchanged', () => {
    render();
    const state = JSON.stringify(Base.data), random = Random.snapshot();
    const storage = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]));
    const calls = ['save', 'upgradePet', 'setPet', 'hatchPet'].map(name => vi.spyOn(Base, name));
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    const rng = vi.spyOn(randomService, 'random');
    const nativeRandom = vi.spyOn(Math, 'random');
    const button = document.querySelector('.partner-play-target');
    for (let i = 0; i < 10; i++) { button.click(); vi.advanceTimersByTime(1600); }
    expect(JSON.stringify(Base.data)).toBe(state);
    expect(Random.snapshot()).toEqual(random);
    expect(Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]))).toEqual(storage);
    for (const call of [...calls, write, remove, clear, rng, nativeRandom]) expect(call).not.toHaveBeenCalled();
    const streams = ['gameplay', 'battle', 'loot', 'shop', 'map'];
    const following = streams.map(stream => Random.random(stream));
    Random.restore(random);
    expect(streams.map(stream => Random.random(stream))).toEqual(following);
  });

  it('only owned partners are interactive, and switching or opening hatch clears pending feedback', () => {
    const actions = render();
    const oldButton = document.querySelector('.partner-play-target');
    oldButton.click();
    const unowned = Base.PETS.find(pet => pet.id !== 'dog');
    actions.get('personPet')({ id: unowned.id });
    expect(document.querySelector('.partner-display.unowned')).not.toBeNull();
    expect(document.querySelector('.partner-play-target')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    oldButton.click();
    expect(vi.getTimerCount()).toBe(0);
    actions.get('personPet')({ id: 'dog' });
    document.querySelector('.partner-play-target').click();
    actions.get('personHatchView')();
    expect(document.querySelector('.companion-hatch-scene')).not.toBeNull();
    expect(document.querySelector('.partner-play')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    actions.get('personHatchView')();
    expect(document.querySelector('.partner-play-reply').textContent).toBe('');
  });

  it('hub owns disposal before render/close and global shortcuts preserve native Space/Enter', () => {
    const runtime = readFileSync('game/src/hub/game.hub.runtime.js', 'utf8');
    expect(runtime).toContain('const releasePersonnel = bindPersonnel(');
    expect(runtime).toContain('partnerHost === personnelInteractionHost');
    expect(runtime).toContain('bindPartnerInteraction:!keepPartnerInteraction');
    expect(runtime).toContain('if (!keepPartnerInteraction) { disposePersonnel = releasePersonnel; personnelInteractionHost = partnerHost; }');
    expect(runtime.match(/disposePersonnel\(\); disposePersonnel = \(\) => \{\};/g)).toHaveLength(2);
    const rebind = runtime.indexOf('const releasePersonnel = bindPersonnel(');
    expect(runtime.lastIndexOf('disposePersonnel();', rebind)).toBeLessThan(rebind);
    expect(runtime.indexOf('disposePersonnel();', runtime.indexOf('function closeBase()'))).toBeLessThan(runtime.indexOf('UI.hideOverlay();', runtime.indexOf('function closeBase()')));
    expect(readFileSync('game/src/core/game-boot-input.js', 'utf8')).toContain("if ((e.key === ' ' || e.key === 'Enter') && e.target?.closest?.('button,summary,[role=\"button\"]')) return;");
  });

  it('scopes motion and focus styles to the portrait and disables it for both reduced-motion paths', () => {
    const css = postcss.parse(readCssSource('game/css/base-personnel-v12.css', 'utf8'));
    const animationRules = [], names = [];
    css.walkRules(rule => { if (rule.selector.includes('.partner-play')) animationRules.push(rule); });
    css.walkAtRules('keyframes', rule => { if (rule.params.startsWith('partner-play-')) names.push(rule.params); });
    expect(names).toEqual(['partner-play-tilt', 'partner-play-hop', 'partner-play-nuzzle']);
    expect(readCssSource('game/css/base-camp.css')).toMatch(/:is\(button, summary\):focus-visible[^}]*outline: 3px solid/s);
    expect(animationRules.some(rule => rule.selector.startsWith('body.reduce-motion') && rule.nodes.some(node => node.prop === 'animation' && node.value === 'none'))).toBe(true);
    expect(animationRules.some(rule => rule.parent.name === 'media' && rule.parent.params === '(prefers-reduced-motion:reduce)' && rule.selector.includes('.partner-play[data-reaction]') && rule.nodes.some(node => node.prop === 'animation' && node.value === 'none'))).toBe(true);
  });
});
