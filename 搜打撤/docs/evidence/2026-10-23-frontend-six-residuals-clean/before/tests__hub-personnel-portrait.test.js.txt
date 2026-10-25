// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';

const owned = vi.hoisted(() => new Map());
vi.mock('../game/src/run/game.session.js', () => ({ MAP: { rules: { safeStart: 2, safeMax: 6 } } }));
vi.mock('../game/src/hub/collection.commands.js', () => ({ getCharacter: (_data, id) => owned.get(id) }));

import { CHARACTERS } from '../game/src/core/characters.js';
import { personnelHTML, bindPersonnel, setPersonnelGroup, setPersonnelSection } from '../game/src/hub/hub.personnel.js';
import { presentHub } from '../game/src/hub/hub.presentation.js';

let slot = 0;
let skinUrl;
const defaultUrl = '/original/侠客/default.webp';
beforeEach(() => {
  owned.clear();
  for (const character of CHARACTERS) owned.set(character.id, { selectedSkinId: 'default', availableSkinIds: character.id === 'wu' ? ['default', 'casual', 'spring', 'beach'] : ['default'] });
  skinUrl = vi.fn((classId, skin) => `/original/${classId}/${skin}.webp`);
  window.SDT = {
    Base: { slot: ++slot, data: {} },
    Meta: { classSummary: () => CHARACTERS.map(character => ({ cls: character.rulesetId, lv: 1, xp: 0, need: 50, maxed: false })), perkText: () => '生命 +1', isCollectible: () => true },
    Art: { skinUrl, listSkins: () => [{ id: 'casual', name: '春日·机车' }, { id: 'spring', name: '新春·旗袍' }, { id: 'beach', name: '盛夏·水枪' }], classAvatarArt: id => `<img src="/avatar/${id}.webp" alt="">` },
    Cards: { classPool: () => [], cardHTML: () => '' },
  };
  setPersonnelGroup('people');
  setPersonnelSection('profile');
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

function render(id = 'wu') {
  document.body.innerHTML = personnelHTML(id);
  return document.querySelector('.pv12-agent-image-stage img');
}

describe('shared default portraits in personnel', () => {
  it('uses the same default Wu source as the roster without legacy crop bounds', () => {
    const image = render();
    expect(image.getAttribute('src')).toBe(defaultUrl);
    expect(image.dataset.portraitFit).toBe('canvas');
    expect(image.closest('.pv12-agent-art').dataset.portraitAlpha).toBe('false');
    expect(image.style.getPropertyValue('--portrait-center')).toBe('');
    expect(image.style.getPropertyValue('--portrait-height')).toBe('');
    expect(document.querySelector('.pv12-agent-avatar img').getAttribute('src')).toBe('/avatar/wu.webp');
    expect(skinUrl).toHaveBeenCalledWith('侠客', 'default');
  });

  it('keeps all four companion default portraits on their existing art URLs', () => {
    for (const character of CHARACTERS.filter(item => item.id !== 'wu')) {
      const image = render(character.id);
      expect(image.getAttribute('src')).toBe(`/original/${character.rulesetId}/default.webp`);
      expect(image.closest('.pv12-agent-art').dataset.portraitAlpha).toBe('false');
    }
  });

  it.each(['casual', 'spring', 'beach'])('keeps equipped Wu %s skin on its original scene image', skin => {
    owned.get('wu').selectedSkinId = skin;
    const image = render();
    expect(image.getAttribute('src')).toBe(`/original/侠客/${skin}.webp`);
    expect(image.dataset.portraitFit).toBe('canvas');
    expect(image.closest('.pv12-agent-art').dataset.portraitAlpha).toBe('false');
  });

  it('keeps appearance thumbnails original and switches preview away and back without save changes', () => {
    setPersonnelSection('appearance');
    const before = JSON.stringify(owned.get('wu'));
    render();
    expect(document.querySelector('.person-skin[data-skin="default"] img').getAttribute('src')).toBe('/original/侠客/default.webp');
    const actions = new Map();
    bindPersonnel({ ui: { act: (key, handler) => actions.set(key, handler) }, refresh: () => render(), sound: { tick: vi.fn() } });
    actions.get('personPreviewSkin')({ character: 'wu', skin: 'casual' });
    expect(document.querySelector('.pv12-agent-image-stage img').getAttribute('src')).toBe('/original/侠客/casual.webp');
    expect(document.querySelector('.pv12-agent-art').dataset.portraitAlpha).toBe('false');
    actions.get('personPreviewSkin')({ character: 'wu', skin: 'default' });
    expect(document.querySelector('.pv12-agent-image-stage img').getAttribute('src')).toBe(defaultUrl);
    expect(document.querySelector('.pv12-agent-art').dataset.portraitAlpha).toBe('false');
    expect(JSON.stringify(owned.get('wu'))).toBe(before);
  });

  it('uses white backing and normal blending only for default portraits', () => {
    const rules = [];
    postcss.parse(readFileSync('game/css/base-personnel-v12.css', 'utf8')).walkRules(rule => {
      if (rule.selector.includes('[data-skin="default"]')) rules.push(rule);
    });
    const values = rule => Object.fromEntries(rule.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
    expect(rules.some(rule => values(rule).background === '#fff')).toBe(true);
    expect(rules.some(rule => values(rule)['mix-blend-mode'] === 'normal')).toBe(true);
    const stageRule = rules.find(rule => values(rule).background === '#fff');
    document.body.innerHTML = `<div id="overlay"><div id="hubMain" class="base-frame-v7">${personnelHTML('wu')}</div></div>`;
    expect(document.querySelector('.pv12-agent-image-stage').matches(stageRule.selector)).toBe(true);
    owned.get('wu').selectedSkinId = 'casual';
    document.querySelector('#hubMain').innerHTML = personnelHTML('wu');
    expect(document.querySelector('.pv12-agent-image-stage').matches(stageRule.selector)).toBe(false);
  });

  it('updates the retained hero alpha marker together with its decoded image through presentHub', async () => {
    const pending = [];
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('Image', class {
      constructor() { pending.push(this); }
      decode() { return Promise.resolve(); }
    });
    const html = (id = 'wu') => `<div id="hubMain" class="pg hub base-frame-v7" data-page="classes"><header><span class="hub-slot-label">01</span><span class="hub-res">资源</span></header><main class="hub-page" data-view="classes/${id}/profile">${personnelHTML(id)}</main><nav class="hub-tabs"><button class="hub-tab on" data-tab="classes" aria-pressed="true">配置</button></nav></div>`;
    document.body.innerHTML = `<div id="overlay">${html()}</div>`;
    const ui = { el: { overlay: document.querySelector('#overlay') }, showOverlay: vi.fn(), _acts: {} };
    const hero = document.querySelector('.pv12-agent-art');
    const image = hero.querySelector('img');
    const show = id => presentHub(ui, html(id), { rich: text => text });
    const reveal = async () => { pending.at(-1).onload(); await Promise.resolve(); };

    owned.get('wu').selectedSkinId = 'casual';
    show('wu');
    expect(hero.dataset.portraitAlpha).toBe('false');
    expect(image.getAttribute('src')).toBe(defaultUrl);
    await reveal();
    expect(hero.dataset.portraitAlpha).toBe('false');
    expect(decodeURI(image.getAttribute('src'))).toContain('/original/侠客/casual.webp');

    owned.get('wu').selectedSkinId = 'default';
    show('wu');
    expect(hero.dataset.portraitAlpha).toBe('false');
    await reveal();
    expect(hero.dataset.portraitAlpha).toBe('false');
    expect(decodeURI(image.getAttribute('src'))).toContain(defaultUrl);

    show('heixiang');
    await reveal();
    expect(hero.dataset.portraitAlpha).toBe('false');
    expect(document.querySelector('.pv12-agent-art')).toBe(hero);
    // Same-source updates synchronize the marker without waiting on another image.
    hero.dataset.portraitAlpha = 'true';
    const requests = pending.length;
    show('heixiang');
    expect(pending).toHaveLength(requests);
    expect(hero.dataset.portraitAlpha).toBe('false');
  });
});
