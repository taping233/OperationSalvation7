import { afterEach, describe, expect, it } from 'vitest';
import { readCssSource, readCompiledCssSource } from './helpers/css-source.js';
import { matchesCssSelector } from './helpers/css-match.js';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { compare, selectorSpecificity } from '@csstools/selector-specificity';

const legacy = ['base', 'winter', 'expedition', 'expedition-map', 'page-expedition-hud', 'ak-skin']
  .map(name => postcss.parse(readCompiledCssSource(`game/css/${name}.css`)));
const header = postcss.parse(readCssSource('game/src/ui/run-top-bar.css'));
const orders = [[...legacy, header], [header, ...legacy]];
afterEach(() => { document.body.replaceChildren(); document.body.className = ''; });

// Check authored cascade and shorthand resets: jsdom does not calculate the
// specificity of the existing :not/:has map skins correctly in computed styles.
function valueOf(declaration, property) {
  if (declaration.prop === property) return declaration.value;
  if (declaration.prop !== 'font') return null;
  if (declaration.value === 'inherit') return 'inherit';
  if (property === 'font-style') return /\b(?:italic|oblique)\b/.exec(declaration.value)?.[0] || 'normal';
  const size = /\b\d+(?:\.\d+)?(?:px|rem|em)(?:\s*\/\s*([^\s]+))?/.exec(declaration.value);
  if (property === 'font-size') return size?.[0].split('/')[0].trim() || null;
  if (property === 'line-height') return size?.[1] || 'normal';
  return null;
}

let conditionId = 0;
function matchesSelector(element, selector) {
  // nwsapi in jsdom 25 disagrees between matches/select for complex :has().
  // Resolve only that relational condition through its actual descendant query;
  // keep all remaining host matching and authored specificity unchanged.
  const clone = selector.clone(), marked = [];
  clone.walkPseudos(pseudo => {
    if (pseudo.value !== ':has') return;
    const attribute = `data-cascade-has-${conditionId++}`;
    const relative = pseudo.nodes.map(node => node.toString().trim());
    for (const host of element.ownerDocument.querySelectorAll('*')) {
      if (relative.some(query => host.querySelector(/^[>+~]/.test(query) ? `:scope ${query}` : query))) {
        host.setAttribute(attribute, ''); marked.push([host, attribute]);
      }
    }
    pseudo.replaceWith(selectorParser.attribute({ attribute }));
  });
  try { return matchesCssSelector(element, clone); }
  finally { for (const [host, attribute] of marked) host.removeAttribute(attribute); }
}

function winner(sheets, element, property, { systemReduce = false, pseudo = '' } = {}) {
  const candidates = [];
  for (const sheet of sheets) sheet.walkRules(rule => {
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type !== 'atrule') continue;
      if (parent.name !== 'media') return;
      if (/prefers-reduced-motion\s*:\s*reduce\b/.test(parent.params) && !systemReduce) return;
      if (/prefers-reduced-motion\s*:\s*no-preference\b/.test(parent.params) && systemReduce) return;
    }
    const declarations = rule.nodes.filter(node => node.type === 'decl')
      .map(declaration => ({ declaration, value: valueOf(declaration, property) }))
      .filter(({ value }) => value !== null);
    if (!declarations.length) return;
    for (const selector of selectorParser().astSync(rule.selector).nodes) {
      const authored = selector.toString().trim();
      const suffix = /::[a-z-]+$/.exec(authored)?.[0] || '';
      if (suffix !== pseudo) continue;
      const target = selector.clone();
      if (suffix) target.last.remove();
      const matches = matchesSelector(element, target);
      if (!matches) continue;
      for (const { declaration, value } of declarations) {
        candidates.push({ value, important: !!declaration.important,
          specificity: selectorSpecificity(selector), order: candidates.length });
      }
    }
  });
  const inline = !pseudo && element.style.getPropertyValue(property);
  if (inline) candidates.push({ value:inline, important:element.style.getPropertyPriority(property) === 'important',
    inline:true, specificity:{a:0,b:0,c:0}, order:candidates.length });
  return candidates.sort((a, b) => Number(a.important) - Number(b.important)
    || Number(!!a.inline) - Number(!!b.inline)
    || compare(a.specificity, b.specificity) || a.order - b.order).at(-1)?.value;
}

function mount({ classes = '', host = 'viewport', bag = false, surface = 'map' } = {}) {
  document.body.className = classes;
  document.body.innerHTML = `<main id="viewport"></main><div id="overlay" class="${bag ? 'bag-full' : ''}"></div>`;
  const bar = document.createElement('header'); bar.id = 'runTopBar'; bar.className = 'run-topbar'; bar.dataset.surface = surface;
  bar.innerHTML = '<div class="run-top-person"><div id="hpHud" data-health-hud><div class="hp-hud-body"><span class="map-health-heading"><span>生命</span><span class="map-health-state"></span></span><b id="hpText">8<span class="hp-rest">/30</span></b><div id="hpBarWrap"><div id="hpBar"></div></div><span class="map-health-delta" aria-hidden="true"></span></div><span class="map-resource-tip" id="mapHealthTip"></span></div></div>';
  document.getElementById(host).append(bar);
  return { bar, hud: bar.querySelector('#hpHud'), body: bar.querySelector('.hp-hud-body'),
    text: bar.querySelector('#hpText'), rest: bar.querySelector('.hp-rest'),
    label: bar.querySelector('.map-health-heading'), track: bar.querySelector('#hpBarWrap'), fill: bar.querySelector('#hpBar') };
}

describe('shared header health geometry', () => {
  it.each(['', 'page-opaque', 'scene-battle-3d'])('keeps one label/value/track presentation under body class %j', classes => {
    const { hud, body, text, rest, label, track, fill } = mount({ classes });
    for (const sheets of orders) {
      expect(winner(sheets, hud, 'width')).toBe('164px');
      expect(winner(sheets, hud, 'height')).toBe('var(--archive-back-height)');
      expect(winner(sheets, hud, 'background')).toBe('transparent');
      expect(winner(sheets, hud, 'clip-path')).toBe('none');
      expect(winner(sheets, hud, 'border')).toBe('0');
      expect(winner(sheets, hud, 'box-shadow')).toBe('none');
      expect(winner(sheets, body, 'width')).toBe('100%');
      expect(winner(sheets, body, 'padding')).toBe('0');
      expect(winner(sheets, text, 'font-size')).toBe('26px');
      expect(winner(sheets, text, 'line-height')).toBe('28px');
      expect(winner(sheets, text, 'font-style')).toBe('normal');
      expect(winner(sheets, rest, 'font')).toBe('inherit');
      expect(winner(sheets, label, 'font-size')).toBe('13px');
      expect(winner(sheets, label, 'line-height')).toBe('14px');
      expect(winner(sheets, track, 'display')).toBe('block');
      expect(winner(sheets, track, 'height')).toBe('4px');
      expect(winner(sheets, track, 'animation')).toBe('none');
      expect(winner(sheets, fill, 'content', { pseudo: '::after' })).toBe('none');
    }
  });

  it('preserves script-owned health colours without reviving the legacy pulsing track', () => {
    const { hud, track, fill } = mount(); hud.classList.add('health-low'); track.classList.add('low');
    for (const background of ['rgb(47, 111, 159)', 'rgb(217, 183, 110)', 'rgb(236, 75, 63)']) {
      fill.style.background = background;
      for (const sheets of orders) {
        expect(winner(sheets, fill, 'background')).toBe(background);
        expect(winner(sheets, track, 'animation')).toBe('none');
        expect(winner(sheets, track, 'transform')).toBe('none');
      }
    }
  });

  it.each(['setting', 'system'])('stops width interpolation for the %s reduced-motion preference', preference => {
    const { fill } = mount({ classes: preference === 'setting' ? 'reduce-motion' : '' });
    for (const sheets of orders) expect(winner(sheets, fill, 'transition', { systemReduce: preference === 'system' })).toBe('none');
  });
});

describe('bag header boundary', () => {
  it('hides the overlay-owned shared header only while bag-full supplies local navigation', () => {
    const { bar } = mount({ host: 'overlay', bag: true, surface: 'room' });
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('none');
    document.getElementById('overlay').classList.remove('bag-full');
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('flex');
  });

  it.each(['map', 'battle', 'room'])('retains the shared header on the ordinary %s surface', surface => {
    const { bar } = mount({ host: surface === 'map' ? 'viewport' : 'overlay', surface });
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('flex');
  });

  it('hides the full settings page with its own return and category navigation', () => {
    const { bar } = mount({ host: 'overlay', surface: 'room' });
    document.getElementById('overlay').insertAdjacentHTML('beforeend', '<section class="pg settings-page settings-tabbed"><button data-act="closeSettings">返回</button><div class="settings settings-layout"><nav class="settings-nav" role="tablist"></nav><div class="settings-content"></div></div></section>');
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('none');
  });

  it('retains resources beside the simple battle settings and reward summary', () => {
    const { bar } = mount({ host: 'overlay', surface: 'battle' });
    for (const markup of ['<section class="settings"><label>战斗简易设置</label></section>', '<section class="reward-replica"><button data-act="rewardDone">继续</button></section>']) {
      const panel = document.createElement('div'); panel.innerHTML = markup; document.getElementById('overlay').append(panel);
      for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('flex');
      panel.remove();
    }
  });

  it('hides the real battle discovery panel only when its own cancel navigation is present', () => {
    const { bar } = mount({ host: 'overlay', surface: 'battle' });
    const panel = document.createElement('div'); panel.className = 'battle-decision'; panel.dataset.decisionKind = 'discover';
    // battle.decision-shell moves .ov-btns out of the body into its footer.
    panel.innerHTML = '<div class="battle-decision-content"><section class="battle-discover-panel" data-battle-discover></section></div><footer class="battle-decision-actions"><div class="ov-btns discovery-selection-actions"><button data-act="btDiscoverCancel">取消</button><button data-act="btDiscoverConfirm">确认</button></div></footer>';
    document.getElementById('overlay').append(panel);
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('none');
    panel.querySelector('.discovery-selection-actions').remove();
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('flex');
  });

  it('does not hide a room just because its overlay mode or content is called discover', () => {
    const { bar } = mount({ host: 'overlay', surface: 'room' });
    document.getElementById('overlay').insertAdjacentHTML('beforeend', '<div class="card discover"><section class="room-reward" data-decision-kind="discover"><div class="discovery-selection-actions"><button data-act="roomDiscoverCancel">取消</button></div></section></div>');
    for (const sheets of orders) expect(winner(sheets, bar, 'display')).toBe('flex');
  });
});
