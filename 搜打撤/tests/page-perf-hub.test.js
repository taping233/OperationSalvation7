import { isCardBrowserCurrent, cardBrowserItems, filterCardBrowserItems, selectCardBrowserItems } from '../game/src/ui/card-browser-state.js';
import { uiDisclosure } from '../game/src/ui/ui-disclosure.js';
// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const baseline = readFileSync(resolve('docs/evidence/2026-10-18-WF-page-perf-1018/hub/baseline/hub.warehouse.js.txt'), 'utf8');
const current = readFileSync(resolve('game/src/hub/hub.warehouse.js'), 'utf8');
const bagBaseline = readFileSync(resolve('docs/evidence/2026-10-18-WF-page-perf-1018/hub/baseline/game.bag.view2.js.txt'), 'utf8');
const bagCurrent = readFileSync(resolve('game/src/hub/game.bag.view2.js'), 'utf8');

// Run the same source bytes and DOM workload with controlled presentation ports.
// No persistent catalog or inventory cache is substituted by this fixture.
function mountWarehouse(source, size = 200, pocket = false) {
  const keyOf = vi.fn(stack => `card:${stack.card.id}${stack.card.variantKey ? `:${stack.card.variantKey}` : ''}`);
  const factory = new Function('esc', 'escAttr', 'stackKeyOf', 'characterFor', 'bindCardNavigation',
    'decorateInventoryZoom', 'warehouseCategoriesV7HTML', 'animateBaseRefresh', 'uiDisclosure', 'cardBrowserItems', 'filterCardBrowserItems', 'selectCardBrowserItems', 'isCardBrowserCurrent',
    source.replace(/^import .*;\r?$/gm, '').replace(/export /g, '') + '\nreturn { warehouseHTML, bindWarehouse };');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const feature = factory(escape, escape, keyOf, () => null, () => {}, () => {}, () => '', () => {}, uiDisclosure, cardBrowserItems, filterCardBrowserItems, selectCardBrowserItems, isCardBrowserCurrent);
  const stacks = Array.from({ length:size }, (_, index) => ({
    card:{ id:`test-${index}`, name:`卡牌${index}`, type:'法术', rarity:'古朴' }, count:2,
  }));
  const base = {
    slot:1, data:{ stash:pocket ? [] : stacks, pocket:pocket ? stacks : [], keys:1000 },
    stashUsed:() => size * 2, stashCap:() => 1000, stashRoom:() => 1000,
    materialInfo:card => card.type === '资源' ? { kind:'wood' } : null,
    useStashMaterial:vi.fn(() => ({ ok:true, msg:'使用一张' })),
    isCollected:() => false, pocketKeyCost:() => 1,
  };
  const ui = { acts:{}, act(name, callback) { this.acts[name] = callback; }, log:vi.fn(), showCardZoom:vi.fn() };
  const sound = { tick:vi.fn(), ding:vi.fn() }, openCard = vi.fn(), refresh = vi.fn();
  window.SDT = { Base:base, Cards:{ cardHTML:card => `<b>${escape(card.name)}</b>` } };
  document.body.innerHTML = feature.warehouseHTML(pocket ? 'pocket' : 'cards');
  feature.bindWarehouse({ ui, base, sound, openCard, refresh });
  const query = value => {
    const input = document.querySelector('[data-warehouse-filter="query"]');
    input.value = value; input.dispatchEvent(new Event('input'));
  };
  keyOf.mockClear();
  return { base, stacks, ui, sound, openCard, refresh, keyOf, query };
}

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('warehouse bounded work and live inventory', () => {
  it('replaces per-tile inventory scans with linear action work and opens a card once', () => {
    const measure = source => {
      const fixture = mountWarehouse(source);
      fixture.query('');
      const filterKeyReads = fixture.keyOf.mock.calls.length;
      fixture.keyOf.mockClear();
      document.querySelectorAll('.stash-cell')[199].click();
      expect(fixture.openCard).toHaveBeenCalledTimes(1);
      expect(fixture.openCard.mock.calls[0][0]).toBe(199);
      return { filterKeyReads, clickKeyReads:fixture.keyOf.mock.calls.length, clickSounds:fixture.sound.tick.mock.calls.length };
    };
    const before = measure(baseline), after = measure(current);
    expect(before.filterKeyReads).toBeGreaterThan(20000);
    expect(after.filterKeyReads).toBeLessThanOrEqual(410);
    expect(after.clickKeyReads).toBeLessThanOrEqual(1400);
    expect(after.clickKeyReads).toBeLessThan(before.clickKeyReads / 20);
    expect(after.clickSounds).toBe(1);
    console.log('hub warehouse controlled operation counts', JSON.stringify({ stacks:200, before, after }));
  });

  it('image completion with unchanged layout produces no DOM attribute writes', () => {
    const measure = source => {
      mountWarehouse(source);
      const browser = document.querySelector('[data-card-browser]');
      const frames = [];
      vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
      const observer = new MutationObserver(() => {});
      observer.observe(browser, { attributes:true, subtree:true });
      browser.querySelector('.stash-cell').dispatchEvent(new Event('load'));
      expect(frames).toHaveLength(1); frames[0]();
      const writes = observer.takeRecords().length;
      observer.disconnect();
      return writes;
    };
    const before = measure(baseline), after = measure(current);
    expect(before).toBeGreaterThan(0);
    expect(after).toBe(0);
    console.log('hub warehouse unchanged image-load DOM writes', JSON.stringify({ stacks:200, before, after }));
  });

  it('re-reads in-place card, count and stable-key changes before filtering', () => {
    const fixture = mountWarehouse(current, 2);
    fixture.stacks[0].card.name = '修改后的卡牌';
    fixture.stacks[0].count = 7;
    fixture.query('修改后');
    const tiles = document.querySelectorAll('.stash-cell');
    expect(tiles[0].hidden).toBe(false); expect(tiles[1].hidden).toBe(true);
    expect(tiles[0].getAttribute('aria-pressed')).toBe('true');
    fixture.stacks[0].card.id = 'new-stable-key';
    fixture.query('');
    expect(tiles[0].hidden).toBe(true);
    tiles[0].click();
    expect(fixture.openCard).not.toHaveBeenCalled();
  });

  it('rejects duplicate stack identities before opening or consuming a card', () => {
    const fixture = mountWarehouse(current, 2);
    fixture.stacks[1].card.id = fixture.stacks[0].card.id;
    fixture.query('');
    document.querySelector('.stash-cell').click();
    expect(fixture.openCard).not.toHaveBeenCalled();
    expect(fixture.base.useStashMaterial).not.toHaveBeenCalled();
  });

  it('keeps single-click resource consumption and refreshes only once', async () => {
    const fixture = mountWarehouse(current, 2);
    fixture.stacks[0].card.type = '资源';
    document.querySelector('.stash-cell').click();
    expect(fixture.base.useStashMaterial).toHaveBeenCalledExactlyOnceWith('卡牌0', false);
    expect(fixture.openCard).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(fixture.refresh).toHaveBeenCalledTimes(1));
    expect(fixture.sound.tick).toHaveBeenCalledTimes(1);
  });

  it('keeps pending-restoration zoom actions and cost checks', () => {
    const fixture = mountWarehouse(current, 2, true);
    fixture.base.data.keys = 0;
    document.querySelectorAll('.stash-cell')[1].click();
    expect(fixture.ui.showCardZoom).toHaveBeenCalledTimes(1);
    const [, options] = fixture.ui.showCardZoom.mock.calls[0];
    expect(options.footer).toContain('data-act="restoreCard"');
    expect(options.footer).toContain('disabled');
    expect(options.footer).toContain('还需 1 把钥匙');
    expect(fixture.sound.tick).toHaveBeenCalledTimes(1);
  });
});

function bagView(source, catalog) {
  const all = vi.fn(() => catalog);
  const sdt = { Cards:{ all, cardHTML:card => `<b data-card="${card.id}">${card.name}</b>` }, UI:{ helpBtn:() => '<button>帮助</button>' } };
  window.SDT = sdt;
  const factory = new Function('SDT', 'esc', 'escAttr', 'bagUseLocation', 'uiDisclosure', 'linkedBackHTML',
    source.replace(/^import .*;\r?$/gm, '').replace(/export /g, '') + '\nreturn { pageHTML, tileHTML };');
  return { ...factory(sdt, String, String, () => null, uiDisclosure, () => '<button>返回</button>'), all };
}
function tileProjection(html) {
  const template = document.createElement('template');
  template.innerHTML = html;
  return [...template.content.querySelectorAll('.bag-grid > *')].map(tile => ({
    tag:tile.tagName, classes:tile.className, data:{ ...tile.dataset },
    text:tile.textContent.replace(/\s+/g, ' ').trim(),
    cards:[...tile.querySelectorAll('[data-card]')].map(card => card.outerHTML),
  }));
}
const bagModel = tiles => ({ bagZone:'bag', bagFilter:'all', bagSortKey:'rarity', cap:30, baseCap:30,
  total:0, safeUsedN:0, sCap:4, pkN:0, used:tiles.length, coins:0, fragments:0, tiles });

describe('bag resource art work per render', () => {
  it('keeps the entire HTML while filtering a 300-card catalog once for 30 supply tiles', () => {
    const tiles = Array.from({ length:30 }, () => ({ name:'口粮', count:3, supply:1, zone:'bag' }));
    const measure = source => {
      let typeReads = 0;
      const catalog = Array.from({ length:300 }, (_, index) => ({ id:`catalog-${index}`, name:index ? `法术${index}` : '口粮',
        get type() { typeReads++; return index ? '法术' : '资源'; },
      }));
      const view = bagView(source, catalog), html = view.pageHTML(bagModel(tiles));
      return { html, catalogCalls:view.all.mock.calls.length, typeReads };
    };
    const before = measure(bagBaseline), after = measure(bagCurrent);
    expect(tileProjection(after.html)).toEqual(tileProjection(before.html));
    expect(after.catalogCalls).toBe(1); expect(after.typeReads).toBe(300 + tiles.length);
    expect(before.catalogCalls).toBe(30); expect(before.typeReads).toBe(9000);
    console.log('hub bag resource catalog operation counts', JSON.stringify({ catalog:300, supplyTiles:30,
      before:{ catalogCalls:before.catalogCalls, typeReads:before.typeReads }, after:{ catalogCalls:after.catalogCalls, typeReads:after.typeReads } }));
  });

  it.each(['bag', 'safe', 'pocket'])('does not read the catalog for card-only %s views', zone => {
    const tile = { card:{ id:'spell', name:'法术', type:'法术' }, name:'法术', type:'法术', count:2, zone };
    const before = bagView(bagBaseline, []), expected = before.pageHTML({ ...bagModel([tile]), bagZone:zone });
    const after = bagView(bagCurrent, []), html = after.pageHTML({ ...bagModel([tile]), bagZone:zone });
    expect(tileProjection(html)).toEqual(tileProjection(expected)); expect(after.all).not.toHaveBeenCalled();
  });

  it('re-reads in-place resource edits, additions and fuzzy matches on the next render', () => {
    const catalog = [{ id:'old', name:'口粮', type:'资源' }, { id:'key', name:'神秘钥匙', type:'资源' }];
    const tiles = [{ name:'口粮', count:2, supply:1, zone:'bag' }, { name:'神秘钥匙碎片', count:1, supply:1, zone:'bag' }];
    const before = bagView(bagBaseline, catalog), after = bagView(bagCurrent, catalog);
    expect(tileProjection(after.pageHTML(bagModel(tiles)))).toEqual(tileProjection(before.pageHTML(bagModel(tiles))));
    catalog[0].type = '法术';
    expect(tileProjection(after.pageHTML(bagModel(tiles)))).toEqual(tileProjection(before.pageHTML(bagModel(tiles))));
    catalog.push({ id:'new', name:'口粮', type:'资源' });
    const html = after.pageHTML(bagModel(tiles));
    expect(tileProjection(html)).toEqual(tileProjection(before.pageHTML(bagModel(tiles))));
    expect(html).toContain('data-card="new"'); expect(html).toContain('data-card="key"');
    expect(after.tileHTML(tiles[0])).toBe(before.tileHTML(tiles[0]));
  });
});
