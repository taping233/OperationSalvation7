// @vitest-environment node
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

const stylesheets = ['ak-skin', 'base', 'base-camp', 'base-camp-rework', 'base-cohesion-v5', 'base-controls-v4', 'base-rooms-v7', 'camp-entry', 'expedition-hub', 'expedition-inventory', 'expedition-rewards', 'expedition', 'hub', 'page-ach', 'page-expedition-hud', 'page-rewards-bag-help', 'scenes', 'winter'];
const legacyScopes = [
  /(?:#routePanel|\.route-(?:heading|title|objective|options|option|help|arrow|icon|name|hint|sub|tag|meta|badge|step|copy))\b/,
  /\.expedition-manual\b/,
  /\.class-dossier(?:-[\w-]+)?\b/,
  /\.(?:coll-(?:room|ms(?:-list)?|slot|group(?:-[\w-]+)?)|collection-(?:command(?:-[\w-]+)?|panel)|back-(?:card|grid|thumb|sm))\b/,
  /\.(?:deploy-(?:brief|mission(?:-[\w-]+)?|mode-dock|readiness-panel|primary)|camp-depart-(?:mission|art|figure|filehead|dossier))\b/,
  /\.(?:chest-(?:ops|reveal)|loot-(?:manifest|capacity))\b/,
  /\.(?:shelf-(?:item|visual|info|ico)|shop-price(?:-tag)?)\b/,
  /\.warehouse-use-tabs\b/,
];
const source = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const stylesheet = name => postcss.parse(readCssSource(new URL(`../game/css/${name}.css`, import.meta.url)));

// A legacy name inside an exclusion or an alternative does not make its whole
// selector dead. Ignore those functions, including nested functions and strings.
function mandatorySelector(selector) {
  let output = '';
  for (let i = 0; i < selector.length;) {
    const match = selector.slice(i).match(/^:(?:not|is|where)\(/i);
    if (!match) { output += selector[i++]; continue; }
    let depth = 1, quote = '';
    i += match[0].length;
    while (i < selector.length && depth) {
      const character = selector[i++];
      if (character === '\\') { i++; continue; }
      if (quote) { if (character === quote) quote = ''; continue; }
      if (character === '"' || character === "'") { quote = character; continue; }
      if (character === '(') depth++;
      else if (character === ')') depth--;
    }
  }
  return output;
}
const requiresLegacyDOM = selector => legacyScopes.some(pattern => pattern.test(mandatorySelector(selector)));

describe('只清退已有替代界面的死 DOM 样式', () => {
  it.each(stylesheets)('%s 不再携带只匹配旧 DOM 的必需选择器', name => {
    const deadSelectors = [];
    stylesheet(name).walkRules(rule => {
      deadSelectors.push(...rule.selectors.filter(requiresLegacyDOM));
    });
    expect(deadSelectors).toEqual([]);
  });

  it('保留否定、混合替代与嵌套函数中的旧名字，仍识别正向 has 条件', () => {
    expect(requiresLegacyDOM('.hub-card:not(.collection-panel):not(.coll-room)')).toBe(false);
    expect(requiresLegacyDOM('#overlay :is(.hub-card, .class-dossier)')).toBe(false);
    expect(requiresLegacyDOM(':where(:is(.hub-card, .coll-room), [data-label="a)b"]) .mini-btn')).toBe(false);
    expect(requiresLegacyDOM('.card:has(.expedition-manual) > h2')).toBe(true);
    expect(requiresLegacyDOM('.coll-room:not(:is(.selected, .empty))')).toBe(true);
  });

  it('没有把共享 is/where/not 规则整条移除', () => {
    const skin = [];
    stylesheet('ak-skin').walkRules(rule => skin.push(rule.selector));
    expect(skin.some(selector => selector.includes(':is(.hub-card, .dep-card, .slot-card,'))).toBe(true);
    const rooms = [];
    stylesheet('base-rooms-v7').walkRules(rule => rooms.push(rule.selector));
    expect(rooms.some(selector => selector.includes(':is(.archive-status,.trade-v5-modes)'))).toBe(true);
    expect(readCssSource(new URL('../game/css/page-ach.css', import.meta.url))).toContain('.hub-card:not(.collection-panel):not(.coll-room)');
  });

  it('仍保留活着的仓库、成就和出征人物声明', () => {
    const inventory = stylesheet('expedition-inventory');
    let row;
    inventory.walkRules(rule => {
      if (rule.selectors.map(selector => selector.trim()).includes('#overlay .ach-row')) row = rule;
    });
    expect(row).toBeDefined();
    expect(row.nodes.find(decl => decl.prop === 'background').value).toBe('#1c1e20');
    let warehouse;
    stylesheet('collection-workspace').walkRules('&[data-collection-variant="warehouse"]', rule => { warehouse = rule; });
    expect(Object.fromEntries(warehouse.nodes.flatMap(node => node.type === 'decl' ? [node] : node.type === 'rule' && node.selector === '&' ? node.nodes.filter(n => n.type === 'decl') : []).map(decl => [decl.prop, decl.value])))
      .toMatchObject({ display:'flex', 'min-height':'0', width:'100%', overflow:'hidden' });
    let art;
    stylesheet('base-camp').walkRules(rule => {
      if (rule.selectors.includes('#overlay #depMain.pg.hub.camp-detail .camp-depart-person-art .art-figure-wrap')) art = rule;
    });
    expect(art).toBeDefined();
    expect(Object.fromEntries(art.nodes.filter(node => node.type === 'decl').map(decl => [decl.prop, decl.value]))).toMatchObject({ width:'100%', height:'100%', position:'absolute', inset:'0', transform:'none' });
  });

  it.each([
    ['game/src/ui/beginner-guide.js', 'beginner-guide', /expedition-manual/],
    ['game/src/hub/hub.home-v3.js', 'base-home-v7', /deploy-(?:brief|mode-dock|readiness-panel|primary)|camp-depart-mission/],
    ['game/src/hub/hub.personnel.js', 'person-stage', /class-dossier/],
    ['game/src/hub/hub.collection-v4.js', 'collection-v12', /coll-(?:room|ms|slot|group)|collection-(?:command|panel)/],
    ['game/src/hub/hub.archive-v3.js', 'archive-v12', /coll-(?:room|ms|slot|group)|back-(?:card|grid|thumb|sm)/],
    ['game/src/hub/hub.trade-shop-v5.js', 'trade-v5-item', /shelf-(?:item|visual|info|ico)|shop-price/],
    ['game/src/run/chests.js', 'reward-v14', /chest-(?:ops|reveal)|loot-(?:manifest|capacity)/],
    ['game/src/hub/hub.warehouse.js', 'collectionWorkspaceHTML', /warehouse-use-tabs/],
    ['game/src/run/expedition.view.js', 'expedition-map-preview', /route-option|route-heading|route-help/],
  ])('%s 使用当前界面且不再生成旧作用域', (file, current, legacy) => {
    const producer = source(file);
    expect(producer).toContain(current);
    expect(producer).not.toMatch(legacy);
  });
});
