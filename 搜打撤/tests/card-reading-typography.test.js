import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { decorateInventoryZoom } from '../game/src/ui/inventory-zoom.js';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
import { readCssSource } from './helpers/css-source.js';

const stylesheet = name => readCssSource(path.resolve('game/css', name), 'utf8');
const common = stylesheet('card-layout-selected.css');
const block = selector => {
  const start = common.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThanOrEqual(0);
  return common.slice(start).match(/\{([^}]+)\}/)[1];
};

beforeEach(() => {
  document.body.innerHTML = '<div id="viewport"></div><div id="cardZoom"><button class="cz-close">关闭</button><div class="cz-card"></div><div class="cz-foot"><button data-act="stashCollectOne">收藏</button></div></div>';
  window.SDT.UI ||= {};
  window.SDT.UI._acts = { stashCollectOne: () => {} };
});

describe('独立卡牌规则阅读', () => {
  it('仓库保留全文、转义和动作，仅增加共同阅读标记', () => {
    const card = Object.freeze({ id: 'custom-rules', name: '安全阅读', type: '法术', rarity: '古朴', desc: "<img src='2'>造成 4-6 点法术伤害；获得 '火球'。" });
    const before = JSON.stringify(card);
    const footer = document.querySelector('.cz-foot');
    const action = document.querySelector('[data-act="stashCollectOne"]');
    decorateInventoryZoom(card);
    const rules = document.querySelector('.inventory-zoom-rules');
    expect(rules.classList.contains('card-rules-copy')).toBe(true);
    expect(rules.textContent).toBe(card.desc);
    expect(rules.querySelector('img, script, iframe')).toBeNull();
    expect(rules.querySelector('[data-term="spellDamage"]')?.textContent).toBe('法术伤害');
    expect(document.querySelector('.inventory-zoom-info .cz-foot')).toBe(footer);
    expect(document.querySelector('[data-act="stashCollectOne"]')).toBe(action);
    expect(document.getElementById('cardZoom')._inventoryActions.stashCollectOne).toBe(window.SDT.UI._acts.stashCollectOne);
    expect(JSON.stringify(card)).toBe(before);
  });

  it('长文不截字、重复装饰不复制资料栏，已审文案保持一致', () => {
    const card = Object.freeze({ id: 'tt3-bandage', name: '绷带', desc: '+3 血，+3 甲。' });
    decorateInventoryZoom(card);
    expect(document.querySelector('.card-rules-copy').textContent).toBe(displayCardDescription(card.desc, card.id));
    decorateInventoryZoom(card);
    expect(document.querySelectorAll('.inventory-zoom-info')).toHaveLength(1);
    document.body.innerHTML = '<div id="cardZoom"><div class="cz-card"></div></div>';
    const longText = "条件 'A'：" + '这是完整规则，不能因为句子较长就丢掉任何说明。'.repeat(12);
    decorateInventoryZoom({ id: 'custom-long-copy', name: '长规则' }, { description: longText });
    expect(document.querySelector('.card-rules-copy').textContent).toBe(longText);
  });

  it('独立全文采用24设计像素共同字级，卡内仍以cqw缩放', () => {
    expect(common).toMatch(/--card-copy-size:\s*24px/);
    expect(common).toMatch(/--card-copy-leading:\s*1\.55/);
    const copy = block('body:has(#viewport) .card-rules-copy');
    expect(copy).toMatch(/font:\s*400 var\(--card-copy-size\)\s*\/\s*var\(--card-copy-leading\) var\(--font-ui\)/);
    expect(copy).toMatch(/white-space:\s*pre-wrap/);
    expect(copy).toMatch(/user-select:\s*text/);
    const card = block('.hs-card[data-card-layout="split"] .hsc-desc');
    expect(card).toMatch(/font-size:\s*6\.03cqw/);
    expect(card).toMatch(/overflow:\s*auto/);
    expect(stylesheet('inventory-zoom.css')).toMatch(/\.inventory-zoom-rules\s*\{[^}]*var\(--card-copy-size\)\/var\(--card-copy-leading\)/);
  });

  it('数字与术语沿同字号直立阅读，tooltip关键词保留语义强调', () => {
    const copyTokens = block('body:has(#viewport) .card-rules-copy :is(.d-num, .d-term, .d-kw)');
    expect(copyTokens).toMatch(/font-size:\s*1em/);
    expect(copyTokens).toMatch(/font-style:\s*normal/);
    expect(block('body:has(#viewport) .card-rules-copy .d-num')).toMatch(/font-weight:\s*700/);
    expect(block('body:has(#viewport) .card-rules-copy .d-term[data-term]')).toMatch(/font-weight:\s*600/);
    const cardTokens = block('.hs-card[data-card-layout="split"] .hsc-desc :is(.d-num, .d-term, .d-kw)');
    expect(cardTokens).toMatch(/font-size:\s*1em/);
    expect(cardTokens).toMatch(/font-style:\s*normal/);
  });
});
