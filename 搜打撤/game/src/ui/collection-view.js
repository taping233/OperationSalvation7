import { bindCardBrowser, refreshCardBrowser } from './card-browser.js';
import { cardBrowserItems, filterCardBrowserItems, isCardBrowserCurrent, selectCardBrowserItems } from './card-browser-state.js';
import '../../css/collection-workspace.css';
import { esc, escAttr } from '../core/shared.js';
import { cancelRegionTransition, transitionRegion } from './region-transition.js';
import { waitPageVisual } from './page-visual-ready.js';
import { compileCollectionSearch, normalizeCollectionSearch } from './collection-search.js';

const attributes = values => Object.entries(values).map(([name,value]) => ` ${name}="${escAttr(value)}"`).join('');
export function collectionItemHTML(key, label, {className,artClass,captionClass = '',attrs = {},selected = false,selectedClass = 'on',art = '',caption = '',status = '',ariaLabel = label}) {
  return `<button type="button" class="collection-item ${className}${selected ? ` ${selectedClass}` : ''}" data-browser-key="${escAttr(key)}" aria-label="${escAttr(ariaLabel)}" aria-pressed="${selected}"${attributes(attrs)}><span class="collection-art ${artClass}" data-browser-art>${art}</span><span class="collection-caption ${captionClass}"><b class="collection-label">${esc(label)}</b>${caption}</span>${status}</button>`;
}
export function collectionWorkspaceHTML(variant, {className,attrs = {},head = '',tools = '',detail = '',list,empty = ''}) {
  return `<div class="collection-workspace ${className}" data-collection-variant="${variant}"${attributes(attrs)}>${head}${tools}<div class="collection-body">${detail}${list}</div>${empty}</div>`;
}

/** One mounted collection owns filtering, selection and detail; domain identities stay adapter-owned.
 * @param {{root:Element, browser?:Element, state:Record<string,any>, selection:string,
 * current?:()=>boolean, key?:string, selectedClass?:string, matches?:(item:HTMLElement)=>boolean,
 * resolve?:(key:string,operation:any)=>any, keyOf?:(row:any)=>string,
 * detail?:{selector:string,html:(row:any)=>string,enterGroups?:string[]}, layout?:(items:HTMLElement[],reset:boolean)=>void,
 * results?:(projection:{items:HTMLElement[],visible:HTMLElement[]},reset:boolean)=>void,
 * motion?:(root:Element)=>void, beforeRefresh?:()=>any, renderArt?:(item:HTMLElement)=>string,
 * prepareArt?:(items:HTMLElement[],operation:any)=>(item:HTMLElement)=>string,
 * onPage?:()=>void, onOpen?:(key:string,item:HTMLElement,view:any)=>void, paged?:boolean,
 * controls?:[string,string,{composition?:boolean,skipEqual?:boolean}?][],
 * reconcile?:(visible:HTMLElement[],selected:string)=>string}} options
 */
export function mountCollectionView({ root, browser = root?.querySelector('[data-card-browser]'), state, selection,
  current: adapterCurrent = () => true, key = 'browserKey', selectedClass = 'on', matches = () => true,
  resolve = id => id, keyOf = row => row, detail, layout = (items, reset) => refreshCardBrowser(browser, {items,reset}),
  results = () => {}, motion = () => {}, beforeRefresh = () => {}, renderArt, prepareArt, onPage, onOpen, paged = true, controls = [],
  reconcile = (visible, selected) => visible.some(item => item.dataset[key] === selected) ? selected : visible[0]?.dataset[key] }) {
  if (!root || !browser) return null;
  const current = () => isCardBrowserCurrent(root) && adapterCurrent();
  let lastDetail, operation, detailRevision = 0;
  const select = (id, animate = true, items = cardBrowserItems(browser)) => {
    if (!current()) return;
    const row = resolve(id,operation);
    state[selection] = row == null ? '' : keyOf(row);
    if (detail) {
      const html = detail.html(row), target = root.querySelector(detail.selector);
      if (target && html !== lastDetail) {
        const revision = ++detailRevision, selected = state[selection];
        cancelRegionTransition(target);
        lastDetail = html;
        if (target.innerHTML !== html) {
          if (!animate) target.innerHTML = html;
          else void transitionRegion(/** @type {HTMLElement} */ (target), () => { target.innerHTML = html; }, {
            direction:0, isCurrent:() => current() && detailRevision === revision && state[selection] === selected,
            enterGroups:detail.enterGroups,
            prepare:signal => waitPageVisual(/** @type {HTMLElement} */ (target), { signal, timeout:600 }),
          }).then(changed => { if (!changed && detailRevision === revision) lastDetail = undefined; });
        }
      }
    }
    selectCardBrowserItems(items, state[selection], {key,className:selectedClass});
    return row;
  };
  const refresh = (reset = false) => {
    if (!current()) return;
    operation = beforeRefresh();
    try {
    const projection = filterCardBrowserItems(browser, matches), {items,visible} = projection;
    layout(items,reset);
    results(projection,reset);
    const selected = reconcile(visible,state[selection]);
    if (selected !== state[selection]) select(selected,reset,items);
    else selectCardBrowserItems(items,state[selection],{key,className:selectedClass});
    if (reset) motion(browser.querySelector('.card-browser-track'));
    return projection;
    } finally {operation = null;}
  };
  const inputs = controls.map(([selector,field,options = {}]) => {
    const input = /** @type {HTMLInputElement | HTMLSelectElement} */ (root.querySelector(selector));
    if (!input) return null;
    const composing = options.composition ?? input.tagName !== 'SELECT';
    const apply = event => {
      if (!current() || (composing && event.isComposing) || (options.skipEqual !== false && state[field] === input.value)) return;
      state[field] = input.value; refresh(true);
    };
    input.addEventListener(input.tagName === 'SELECT' ? 'change' : 'input',apply);
    if (composing) input.addEventListener('compositionend',apply);
    return {input,field};
  }).filter(Boolean);
  const reset = () => {
    if (!current()) return;
    for (const {input,field} of inputs) { state[field] = ''; input.value = ''; }
    refresh(true);
  };
  const view = {current,select,refresh,reset,source:id => cardBrowserItems(browser).find(item => item.dataset[key] === id)};
  refresh();
  if (paged) bindCardBrowser(/** @type {HTMLElement} */ (browser),{renderArt,prepareArt:prepareArt ? items => prepareArt(items,operation) : undefined,onPage,onOpen:(id,item) => onOpen ? onOpen(id,item,view) : select(id)});
  return view;
}

/** Catalog projection shared by scrolled and paged collections. First/last identity policy is explicit.
 * @param {{keyOf:(item:any)=>string, searchOf?:(item:any)=>string,
 * matches?:(item:any,filters:any,skip:string)=>boolean, compare?:(a:any,b:any,filters:any)=>number,
 * duplicate?:string, exclude?:(item:any)=>boolean}} options
 */
export function createCollectionModel({ keyOf, searchOf = () => '', matches = () => true, compare, duplicate = 'first', exclude = () => false }) {
  let items = [], byKey = new Map(), search = new WeakMap(), cache = new Map();
  const searchText = item => {
    if (!search.has(item)) search.set(item,normalizeCollectionSearch(searchOf(item)));
    return search.get(item);
  };
  return {
    replace(source) {
      byKey = new Map();
      for (const item of source) if (!exclude(item) && (duplicate === 'last' || !byKey.has(keyOf(item)))) byKey.set(keyOf(item),item);
      // Browsing without a query needs no description expansion for the full
      // catalogue. Search text belongs to this replacement and is built on use.
      items = [...byKey.values()]; search = new WeakMap(); cache = new Map();
      return items;
    },
    get:key => byKey.get(key),
    project(filters, skip = '') {
      const key = JSON.stringify([skip ? {...filters,[skip]:null,sort:null} : filters,skip]);
      if (!cache.has(key)) {
        const query = compileCollectionSearch(filters.q);
        const visible = items.filter(item => matches(item,filters,skip) && (!query || query(searchText(item))));
        if (compare && !skip) visible.sort((a,b) => compare(a,b,filters));
        const positions = new Map();
        visible.forEach((item,index) => { if (!positions.has(keyOf(item))) positions.set(keyOf(item),index); });
        cache.set(key,{items:visible,positions});
        while (cache.size > 8) cache.delete(cache.keys().next().value);
      }
      return cache.get(key);
    },
  };
}
