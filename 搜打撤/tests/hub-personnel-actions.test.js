// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { presentHub } from '../game/src/hub/hub.presentation.js';

const sections = ['profile', 'appearance', 'pool'];
function hubHTML(section, action = '') {
  return `<div id="hubMain" class="pg hub" data-page="classes">
    <header><span class="hub-slot-label">档案 / 01</span><span class="hub-res">资源</span></header>
    <main class="hub-page" data-view="classes/wu/${section}">
      <div class="personnel-v12" data-section="${section}">
        <figure class="pv12-agent-art"><img src="/wu.webp" alt="无"><figcaption>无</figcaption></figure>
        <nav class="pv12-agent-strip"><button data-character="wu" aria-pressed="true">无</button></nav>
        <section class="pv12-pool-catalog" hidden></section>
        <article class="pv12-agent-data"><header class="pv12-identity"><span>${section}</span></header>
          <div class="pv12-data-content"><p>${section}正文</p></div>
          ${action ? `<footer class="pv12-data-actions">${action}</footer>` : ''}
        </article>
        <nav class="pv12-sections">${sections.map(key => `<button data-section="${key}" aria-pressed="${key === section}">${key}</button>`).join('')}</nav>
      </div>
    </main>
    <nav class="hub-tabs"><button class="hub-tab on" data-tab="classes" aria-pressed="true">配置</button></nav>
  </div>`;
}
let ui;
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  document.body.innerHTML = `<div id="overlay">${hubHTML('profile', '<button data-act="hubTab" data-tab="stash">选择培养卡牌</button>')}</div>`;
  ui = { el: { overlay: document.querySelector('#overlay') }, showOverlay: vi.fn(), _acts: {} };
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });
const present = (section, action) => presentHub(ui, hubHTML(section, action), { rich: text => text });

it('same-person section changes replace the current action while keeping the reading container', () => {
  const data = document.querySelector('.pv12-agent-data');
  const reading = document.querySelector('.pv12-data-content');
  present('appearance', '');
  expect(document.querySelector('.pv12-data-actions')).toBeNull();
  expect(document.querySelector('.pv12-data-actions [data-act="hubTab"]')).toBeNull();
  present('appearance', '<button data-act="selectCharacterSkin" data-skin="bike">应用春日外观</button>');
  expect(document.querySelector('[data-act="selectCharacterSkin"]').dataset.skin).toBe('bike');
  present('profile', '<button data-act="hubTab" data-tab="stash">选择培养卡牌</button>');
  expect(document.querySelector('[data-act="selectCharacterSkin"]')).toBeNull();
  expect(document.querySelector('.pv12-data-actions [data-act="hubTab"]').dataset.tab).toBe('stash');
  expect(document.querySelector('.pv12-agent-data')).toBe(data);
  expect(document.querySelector('.pv12-data-content')).toBe(reading);
});

it('an action-state refresh updates availability without replacing the whole person view', () => {
  present('appearance', '<button data-act="selectCharacterSkin" data-skin="bike">应用外观</button>');
  const data = document.querySelector('.pv12-agent-data');
  present('appearance', '<button data-act="selectCharacterSkin" data-skin="bike" disabled>当前使用</button>');
  expect(document.querySelector('[data-act="selectCharacterSkin"]').disabled).toBe(true);
  expect(document.querySelector('[data-act="selectCharacterSkin"]').textContent).toBe('当前使用');
  expect(document.querySelector('.pv12-agent-data')).toBe(data);
});
