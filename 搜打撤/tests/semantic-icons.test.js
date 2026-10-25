import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Icons } from '../game/src/core/icons-bitmap.js';
import { SEMANTIC_ICON_KEYS } from '../game/src/core/semantic-icons.js';

vi.mock('../game/src/core/icon-hydration.js', () => ({ observeIconHydration: vi.fn() }));

const identicalLegacyGroups = [
  ['archive', 'folder', 'trash'], ['arrow', 'exit', 'upload'],
  ['bag', 'pocket', 'pouch'], ['book', 'cards', 'notes', 'save', 'scroll'],
  ['broom', 'pen', 'tools'], ['crystal', 'gem'], ['door', 'home'],
  ['helmet', 'plate', 'shield'], ['hourglass', 'mouse'],
  ['lantern', 'sparkles'], ['play', 'skip'],
];
const source = key => readFileSync(resolve('game/assets/ui/semantic-icons', `${key}.svg`), 'utf8');
afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren(); });

describe('不同业务含义使用独立透明图形', () => {
  it('原先 11 组重复占位不再指向或携带相同图形', () => {
    for (const group of identicalLegacyGroups) {
      expect(new Set(group.map(key => Icons.url(key))).size).toBe(group.length);
      const shapes = group.map(key => createHash('sha256').update(source(key)).digest('hex'));
      expect(new Set(shapes).size).toBe(group.length);
    }
    expect(Icons.url('chart')).not.toBe(Icons.url('archive'));
    expect(Icons.url('info')).not.toBe(Icons.url('scroll'));
  });

  it('牌堆、容器和完整状态集合均能解析到实际 SVG', () => {
    const required = [
      'draw-pile', 'consumed-pile', 'hand-pages', 'draw-card', 'safe-slot',
      'spell-pouch', 'card-library', 'card-back', 'card-craft', 'sell-cards',
      'pet-egg', 'pass-fragment', 'pearl-box', 'infuse', 'spell-power',
      'status-atk-up', 'status-spell-up', 'status-stealth', 'status-immune',
      'status-reduce', 'status-dodge', 'status-sword-form', 'status-moon-form',
      'status-cosmos-form', 'status-bleed', 'status-poison', 'status-freeze',
      'status-silence', 'status-armor-break', 'status-heal-ban', 'status-atk-down',
    ];
    for (const key of required) {
      expect(Icons.NAMES.has(key), key).toBe(true);
      expect(Icons.url(key), key).toContain(`semantic-icons/${key}.svg?v=`);
    }
    for (const key of SEMANTIC_ICON_KEYS) {
      const svg = source(key);
      expect(svg, key).toContain('viewBox="0 0 32 32"');
      expect(svg, key).not.toMatch(/<(?:script|foreignObject|image|filter|animate|rect)\b/);
      expect(svg, key).not.toContain('data:');
    }
  });

  it('保留金币与祭坛的现有原画来源，以及调用者的 alt 和 class', () => {
    expect(Icons.url('coin')).toContain('map-hud-1015/gold-is7-v2.webp');
    expect(Icons.url('altar')).toContain('map-nodes/altar-symbol-1017-v2.webp');
    document.body.innerHTML = Icons.img('draw-pile', 'pile-title', '剩余牌库');
    const image = document.querySelector('img');
    expect(image.alt).toBe('剩余牌库');
    expect(image.classList.contains('pile-title')).toBe(true);
    expect(image.draggable).toBe(false);
  });
});

describe('图标语义与安全转换', () => {
  it('警告、搜索、无穷、固定、雪花分别保留独立含义', () => {
    for (const [symbol, key] of [
      ['⚠', 'warning'], ['⚠️', 'warning'], ['🔍', 'search'],
      ['∞', 'infinity'], ['♾️', 'infinity'], ['📌', 'pin'], ['❄️', 'status-freeze'],
    ]) {
      expect(Icons.rich(symbol), symbol).toContain(`data-asset-key="icon-${key}"`);
      expect(Icons.rich(symbol), symbol).not.toContain('icon-question');
    }
    expect(Icons.rich('❓')).toContain('icon-question');
    expect(Icons.rich('✓ 已收下 · ✦ 擦亮 · ⌕ 查看 · ◇ 未领取'))
      .toBe('✓ 已收下 · ✦ 擦亮 · ⌕ 查看 · ◇ 未领取');
  });

  it('未知键回退问号并且同一错误只报告一次', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const key = 'semantic-test-unknown';
    expect(Icons.url(key)).toBe(Icons.url('question'));
    expect(Icons.rich(`[[icon:${key}]]`)).toContain('icon-question');
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining(`icon:${key}`));
  });

  it('新图标仍沿安全文本水合，不解释备注 HTML，也不改写属性内字符', () => {
    expect(Icons.rich('<b title="⚠️">提示</b>')).toBe('<b title="⚠️">提示</b>');
    const text = document.createElement('p');
    text.setAttribute('aria-label', '[[icon:safe-slot]] 安全格');
    text.textContent = '<img onerror=alert(1)> [[icon:safe-slot]] ⚠️';
    document.body.append(text);
    Icons.hydrate(document.body);
    expect(text.getAttribute('aria-label')).toBe('安全格');
    expect(text.querySelector('[onerror]')).toBeNull();
    expect(text.textContent).toContain('<img onerror=alert(1)>');
    expect([...text.querySelectorAll('img')].map(image => image.dataset.assetKey))
      .toEqual(['icon-safe-slot', 'icon-warning']);
    const icons = [...text.querySelectorAll('img')];
    Icons.hydrate(document.body);
    expect([...text.querySelectorAll('img')]).toEqual(icons);
  });
});
