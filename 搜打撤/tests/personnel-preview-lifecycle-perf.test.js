// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/run/game.session.js', () => ({ MAP: { rules: { safeStart: 2, safeMax: 6 } } }));
vi.mock('../game/src/hub/collection.commands.js', () => ({
  getCharacter: () => ({ selectedSkinId: 'default', availableSkinIds: ['default'] }),
}));

import { CHARACTERS } from '../game/src/core/characters.js';
import { personnelHTML, setPersonnelGroup, setPersonnelSection } from '../game/src/hub/hub.personnel.js';
import { presentHub } from '../game/src/hub/hub.presentation.js';

let pending;
let ui;
let slot = 0;
const swaps = ['heixiang', 'baita', 'xingyue', 'changwuyu'];
const portrait = () => document.querySelector('.pv12-agent-image-stage img');
function html(id = 'wu') {
  return `<div id="hubMain" class="pg hub base-frame-v7" data-page="classes"><header><span class="hub-slot-label">01</span><span class="hub-res">资源</span></header><main class="hub-page" data-view="classes/${id}/profile">${personnelHTML(id)}</main><nav class="hub-tabs"><button class="hub-tab on" data-tab="classes" aria-pressed="true">配置</button></nav></div>`;
}
function show(id) { presentHub(ui, html(id), { rich: text => text }); }
async function load(image) { image.onload(); await Promise.resolve(); }

beforeEach(() => {
  pending = [];
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('Image', class {
    constructor() { this.decode = vi.fn(() => Promise.resolve()); pending.push(this); }
  });
  window.SDT = {
    Base: { slot: ++slot, data: {} },
    Meta: {
      classSummary: () => CHARACTERS.map(character => ({ cls: character.rulesetId, lv: 1, xp: 0, need: 50, maxed: false })),
      perkText: () => '生命 +1',
    },
    Art: {
      skinUrl: classId => `/portraits/${CHARACTERS.find(character => character.rulesetId === classId).id}.webp`,
      listSkins: () => [],
      classAvatarArt: id => `<img src="/avatar/${id}.webp" alt="">`,
    },
    Cards: { classPool: () => [], cardHTML: () => '' },
  };
  setPersonnelGroup('people');
  setPersonnelSection('profile');
  document.body.innerHTML = `<div id="overlay">${html()}</div>`;
  ui = { el: { overlay: document.querySelector('#overlay') }, showOverlay: vi.fn(), _acts: {} };
});

afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('personnel portrait request lifecycle', () => {
  it('decodes only the final selection when four pending portraits finish', async () => {
    const original = portrait().src;
    for (const id of swaps) show(id);
    expect(pending).toHaveLength(4);
    expect(portrait().src).toBe(original);
    for (const image of pending) await load(image);
    expect(pending.map(image => image.decode.mock.calls.length)).toEqual([0, 0, 0, 1]);
    expect(portrait().getAttribute('src')).toContain('/portraits/changwuyu.webp');
  });

  it('does not decode pending portraits after leaving the page', async () => {
    for (const id of swaps) show(id);
    document.querySelector('#hubMain').remove();
    for (const image of pending) await load(image);
    expect(pending.map(image => image.decode.mock.calls.length)).toEqual([0, 0, 0, 0]);
  });

  it('keeps the current portrait visible until the latest decode settles', async () => {
    const original = portrait().src;
    show('heixiang');
    let resolve;
    pending[0].decode.mockImplementation(() => new Promise(done => { resolve = done; }));
    await load(pending[0]);
    expect(portrait().src).toBe(original);
    resolve();
    await Promise.resolve();
    expect(portrait().getAttribute('src')).toContain('/portraits/heixiang.webp');
  });

  it('still reveals the current request when decode rejects', async () => {
    show('heixiang');
    pending[0].decode.mockRejectedValue(new Error('decode unavailable'));
    await load(pending[0]);
    expect(pending[0].decode).toHaveBeenCalledOnce();
    expect(portrait().getAttribute('src')).toContain('/portraits/heixiang.webp');
  });

  it('still reveals the current request when decode is not supported', async () => {
    show('heixiang');
    delete pending[0].decode;
    await load(pending[0]);
    expect(portrait().getAttribute('src')).toContain('/portraits/heixiang.webp');
  });

  it('does not commit an old decode that was already running before the next selection', async () => {
    const original = portrait().src;
    show('heixiang');
    let resolve;
    pending[0].decode.mockImplementation(() => new Promise(done => { resolve = done; }));
    await load(pending[0]);
    show('baita');
    resolve();
    await Promise.resolve();
    expect(pending[0].decode).toHaveBeenCalledOnce();
    expect(portrait().src).toBe(original);
    await load(pending[1]);
    expect(portrait().getAttribute('src')).toContain('/portraits/baita.webp');
  });
});
