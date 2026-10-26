import { linkedAnimate } from '../ui/home-linked-interactions.js';
import { motionTiming, motionEasing } from '../ui/motion-presets.js';
import { pageMotionProfile, pageMotionBlocks } from '../ui/page-motion-profiles.js';
import { animateBaseRefresh } from './base-motion-v4.js';
import { refreshCardBrowser } from '../ui/card-browser.js';
import { navigationState, baseNavigationChange as navigationChange, baseNavigationTiming as navigationTiming, baseNavigationEasing } from '../ui/navigation-motion.js';

/** @param {Iterable<Element>} controls */
export function holdHubOperationControls(controls) {
  const previous = [...controls].map(element => {
    const control = /** @type {HTMLButtonElement} */ (element);
    return { control, disabled:control.disabled, busy:control.getAttribute('aria-busy') };
  });
  for (const { control } of previous) {
    control.disabled = true;
    control.setAttribute('aria-busy', 'true');
  }
  return () => {
    for (const { control, disabled, busy } of previous) {
      control.disabled = disabled;
      if (busy === null) control.removeAttribute('aria-busy');
      else control.setAttribute('aria-busy', busy);
    }
  };
}

// 命令决定保存结果；提示、声音及页面刷新分别完成自己的呈现。
/**
 * @template T
 * @param {{run: () => T | PromiseLike<T>, isCurrent?: () => boolean,
 * isSuccess?: (result:T) => boolean, notice?: (message:string, tone?:string) => void,
 * pending?:string, success?:string | ((result:T) => string),
 * failure?:string | ((result:T | undefined, error:unknown) => string),
 * onSuccess?: (result:T) => void, refresh?: () => unknown, refreshOnFailure?:boolean}} options
 * @returns {Promise<boolean>}
 */
export async function runHubOperation({ run, isCurrent = () => true,
  isSuccess = result => result === true || /** @type {{ok?:boolean} | null | undefined} */ (result)?.ok === true,
  notice = () => {}, pending = '正在保存…', success = '', failure = '操作未保存，请重试。',
  onSuccess = () => {}, refresh = () => {}, refreshOnFailure = false }) {
  const present = action => {
    if (!isCurrent()) return;
    try { action(); }
    catch (error) { console.warn('基地操作呈现未完成', error); }
  };
  present(() => notice(pending));
  let result, error, saved = false;
  try { result = await run(); saved = isSuccess(result); }
  catch (reason) { error = reason; }
  if (!saved) {
    present(() => notice(typeof failure === 'function' ? failure(result, error) : failure, 'warn'));
    if (refreshOnFailure) present(refresh);
    return false;
  }
  present(() => notice(typeof success === 'function' ? success(result) : success));
  present(() => onSuccess(result));
  present(refresh);
  return true;
}

// 基地壳只挂载一次；浏览状态留在界面，交易继续使用原命令入口。
let portraitRequest = 0;
const readingPositions = new Map();
function readingKey(root) {
  return `${root.querySelector('.hub-slot-label')?.textContent}/${root.querySelector('.hub-page')?.dataset.view}/person`;
}
function rememberReading(root) {
  if (!root) return;
  for (const pane of root.querySelectorAll('.person-stage .person-details')) {
    const key = readingKey(root);
    readingPositions.delete(key); readingPositions.set(key, pane.scrollTop);
  }
  while (readingPositions.size > 64) readingPositions.delete(readingPositions.keys().next().value);
}
function restoreReading(root) {
  if (!root) return;
  for (const pane of root.querySelectorAll('.person-stage .person-details')) pane.scrollTop = readingPositions.get(readingKey(root)) || 0;
}
export function presentHub(ui, html, icons) {
  const current = document.getElementById('hubMain');
  const previousNavigation = navigationState(current);
  rememberReading(current);
  if (!current || ui.el?.overlay?.hidden || ui.el?.overlay?.classList.contains('closing')) {
    ui.showOverlay('', html, 'page');
    positionNavigation(document.getElementById('hubMain'));
    restoreReading(document.getElementById('hubMain'));
    return;
  }
  const template = document.createElement('template');
  template.innerHTML = icons.rich ? icons.rich(html) : html;
  const next = template.content.querySelector('#hubMain');
  if (current.dataset.page !== /** @type {HTMLElement} */ (next).dataset.page) {
    ui.showOverlay('', html, 'page');
    positionNavigation(document.getElementById('hubMain'));
    restoreReading(document.getElementById('hubMain'));
    return;
  }
  const page = current.querySelector('.hub-page');
  const nextPage = /** @type {HTMLElement} */ (next.querySelector('.hub-page'));
  const changed = (/** @type {HTMLElement} */ (page).dataset.motionView || /** @type {HTMLElement} */ (page).dataset.view) !== (nextPage.dataset.motionView || nextPage.dataset.view);
  current.className = next.className;
  const back = current.querySelector('.hub-back'), nextBack = next.querySelector('.hub-back');
  if (back && nextBack) for (const name of ['data-act', 'aria-label', 'title']) back.setAttribute(name, nextBack.getAttribute(name));
  const resources = current.querySelector('.hub-res');
  const nextResources = next.querySelector('.hub-res');
  if (resources.innerHTML !== nextResources.innerHTML) resources.innerHTML = nextResources.innerHTML;
  current.querySelector('.hub-slot-label').textContent = next.querySelector('.hub-slot-label').textContent;
  const currentNav = current.querySelector('.hub-tabs'), nextNav = next.querySelector('.hub-tabs');
  const navKey = nav => [...(nav?.querySelectorAll('.hub-tab') || [])].map(button => button.dataset.tab).join('/');
  if (navKey(currentNav) !== navKey(nextNav)) currentNav.innerHTML = nextNav.innerHTML;
  for (const button of current.querySelectorAll('.hub-tab')) {
    const replacement = next.querySelector(`.hub-tab[data-tab="${/** @type {HTMLElement} */ (button).dataset.tab}"]`);
    button.className = replacement.className;
    button.setAttribute('aria-pressed', replacement.getAttribute('aria-pressed'));
    if (replacement.hasAttribute('aria-current')) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    if (button.innerHTML !== replacement.innerHTML) button.innerHTML = replacement.innerHTML;
  }
  const localDirection = browseDirection(page, nextPage);
  const before = { view: /** @type {HTMLElement} */ (page).dataset.view, direction: localDirection || 1 };
  page.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
  page.className = nextPage.className.replace(' page-in', '');
  /** @type {HTMLElement} */ (page).dataset.view = nextPage.dataset.view;
  /** @type {HTMLElement} */ (page).dataset.motionView = nextPage.dataset.motionView || nextPage.dataset.view;
  const previousRegions = regionContents(page);
  const keptPortrait = updatePersonnelV12(page, nextPage, reducedMotion(), before);
  if (!keptPortrait) {
    page.innerHTML = nextPage.innerHTML;
    if (!changed && localDirection) {
      // 建设沿左侧纵向目录切换，横向货架/人物名册沿左右方向；只平移完整区域。
      const vertical = !!page.querySelector('.facilities-v12');
      animateChangedRegions(page, previousRegions, {
        x: vertical ? 0 : localDirection * 64,
        y: vertical ? localDirection * 28 : 0,
        duration: navigationTiming.detail,
      });
    }
  }
  positionNavigation(current);
  restoreReading(current);
  current.querySelector('.camp-notice')?.remove();
  const notice = next.querySelector('.camp-notice');
  if (notice) current.append(notice);
  ui._acts = { ...(/** @type {HTMLElement & {_inventoryActions?: Record<string, (...args: unknown[]) => unknown>}} */ (document.getElementById('cardZoom'))?._inventoryActions || {}) };
  if (changed && !keptPortrait && !reducedMotion() && page.animate) {
    enterRegions(page, navigationChange(previousNavigation, navigationState(current)));
  }
}

function reducedMotion() {
  return document.body.classList.contains('reduce-motion') || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
export function pulseNumber(target) {
  if (!target || reducedMotion() || !target.animate) return;
  target.getAnimations?.().forEach(animation => animation.cancel());
  linkedAnimate(target, [{ opacity: .35 }, { opacity: 1 }], { duration: motionTiming.feedback, easing: motionEasing.enter });
}
export function bindCardNavigation(root, selector, { activate = true } = {}) {
  if (!root || root.dataset.cardNavigationBound) return;
  root.dataset.cardNavigationBound = 'true';
  root.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    const target = event.target.closest?.(selector);
    if (!target || !root.contains(target)) return;
    const items = [...root.querySelectorAll(selector)].filter(item => !item.hidden && !item.disabled && item.getClientRects().length);
    const at = items.indexOf(target);
    if (at < 0) return;
    const columns = Math.max(1, getComputedStyle(root).gridTemplateColumns.trim().split(/\s+/).length);
    const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' ? -columns : columns;
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : Math.max(0, Math.min(items.length - 1, at + delta));
    event.preventDefault(); event.stopPropagation();
    const next = items[index];
    next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    if (activate && next !== target) next.click();
  });
}
function positionNavigation(root) {
  if (!root) return;
  const page = root.querySelector('.hub-page');
  const stage = page?.querySelector('.person-stage');
  if (stage && page.clientHeight) {
    const pageBounds = page.getBoundingClientRect(), stageBounds = stage.getBoundingClientRect();
    const scale = pageBounds.height / page.clientHeight || 1;
    const bottomPadding = parseFloat(getComputedStyle(page).paddingBottom) || 0;
    const available = (pageBounds.bottom - stageBounds.top) / scale - bottomPadding;
    stage.style.height = `${Math.max(320, Math.floor(available))}px`;
    stage.style.minHeight = '0';
  }
  root?.querySelectorAll('[data-card-browser]').forEach(browser => refreshCardBrowser(browser));
}
window.addEventListener('resize', () => positionNavigation(document.getElementById('hubMain')));
function browseDirection(page, next) {
  const identity = button => ['data-skin', 'data-character', 'data-key', 'data-id', 'data-mode', 'data-category']
    .filter(attribute => button.hasAttribute(attribute)).map(attribute => `${attribute}:${button.getAttribute(attribute)}`).join('/');
  const selected = buttons => buttons.find(button => button.getAttribute('aria-pressed') === 'true' || ['on', 'sel', 'is-selected'].some(name => button.classList.contains(name)));
  for (const selector of ['[data-act="tradeShopMode"]', '[data-act="tradeShopCategory"]', '[data-act="tradeShopSelectGood"], [data-act="tradeShopSelectStack"]', '[data-act="campFacility"]', '[data-act="personPet"]', '.pv12-agent-choice', '.person-skin']) {
    const before = [...page.querySelectorAll(selector)], after = [...next.querySelectorAll(selector)];
    const previous = selected(before), following = selected(after);
    if (!previous || !following || identity(previous) === identity(following)) continue;
    const from = before.indexOf(previous), to = before.findIndex(button => identity(button) === identity(following));
    return to < 0 ? 1 : Math.sign(to - from) || 1;
  }
  return 0;
}
function localRegions(page) {
  const profile = pageMotionProfile(page.closest('#hubMain')?.parentElement);
  return (profile ? pageMotionBlocks(profile) : []).filter(({ role }) => role === 'content' || role === 'portrait')
    .map(region => ({ ...region, el: region.el.matches('.trade-v5-rail') ? region.el.querySelector('.trade-v5-list') || region.el : region.el }));
}
function regionContents(page) {
  return new Map(localRegions(page).map(({ el }) => [el.className, el.innerHTML]));
}
function animateChangedRegions(page, before, transition) {
  let index = 0;
  for (const { el } of localRegions(page)) {
    if (before.get(el.className) !== el.innerHTML) animateBaseRefresh(el, Math.min(index++ * navigationTiming.stagger, navigationTiming.staggerMax), transition);
  }
}
function enterRegions(page, transition) {
  const profile = pageMotionProfile(page.closest('#hubMain')?.parentElement);
  const regions = profile ? pageMotionBlocks(profile) : [];
  const targets = regions.length ? regions : [{ el: page.firstElementChild || page, delay: 0 }];
  for (const { el, delay } of targets) linkedAnimate(el, [
    // 玻璃父层只做位移，不创建 opacity 动画合成层。
    { transform:`translateX(${transition.x}px)` },
    { transform:'none' },
  ], { duration: transition.duration, delay: Math.min(delay, navigationTiming.staggerMax), easing:baseNavigationEasing, fill:'backwards' });
}
function syncAppearanceContent(content, nextContent) {
  /** @param {HTMLElement} button */
  const key = button => `${button.dataset.character}/${button.dataset.skin}`;
  const buttons = [.../** @type {NodeListOf<HTMLButtonElement>} */ (content.querySelectorAll('[data-act="personPreviewSkin"]'))];
  const nextButtons = new Map([.../** @type {NodeListOf<HTMLButtonElement>} */ (nextContent.querySelectorAll('[data-act="personPreviewSkin"]'))].map(button => [key(button), button]));
  const heading = content.querySelector('h4'), nextHeading = nextContent.querySelector('h4');
  if (!heading || !nextHeading || !buttons.length || buttons.length !== nextButtons.size || buttons.some(button => !nextButtons.has(key(button)))) return false;
  // Preserve the list, loaded thumbnails, keyboard focus and reading position.
  heading.textContent = nextHeading.textContent;
  const current = content.querySelector('.appearance-current');
  const nextCurrent = nextContent.querySelector('.appearance-current');
  if (!nextCurrent) current?.remove();
  else if (current) current.textContent = nextCurrent.textContent;
  else heading.after(nextCurrent.cloneNode(true));
  for (const button of buttons) {
    const replacement = nextButtons.get(key(button));
    button.className = replacement.className;
    button.setAttribute('aria-pressed', replacement.getAttribute('aria-pressed'));
    const status = button.querySelector('small'), nextStatus = replacement.querySelector('small');
    if (status && nextStatus) status.textContent = nextStatus.textContent;
  }
  return true;
}
function updatePersonnelV12(page, next, reduced, before) {
  const current = page.querySelector('.personnel-v12');
  const replacement = next.querySelector('.personnel-v12');
  const hero = current?.querySelector('.pv12-agent-art');
  const nextHero = replacement?.querySelector('.pv12-agent-art');
  const data = current?.querySelector('.pv12-agent-data');
  const nextData = replacement?.querySelector('.pv12-agent-data');
  if (!hero || !nextHero || !data || !nextData) return false;
  const previousSection = current.dataset.section;
  current.dataset.section = replacement.dataset.section;
  const image = hero.querySelector('img'), nextImage = nextHero.querySelector('img');
  const source = new URL(nextImage.getAttribute('src'), document.baseURI).href;
  const changedPerson = image.alt !== nextImage.alt;
  const changedSkin = hero.dataset.skin !== nextHero.dataset.skin;
  const appearanceRefresh = !changedPerson && previousSection === 'appearance' && replacement.dataset.section === 'appearance';
  const syncPortrait = () => {
    image.style.cssText = nextImage.style.cssText;
    image.dataset.portraitFit = nextImage.dataset.portraitFit;
    hero.dataset.portraitAlpha = nextHero.dataset.portraitAlpha || 'false';
    hero.dataset.skin = nextHero.dataset.skin;
    hero.querySelector('figcaption').innerHTML = nextHero.querySelector('figcaption').innerHTML;
    image.alt = nextImage.alt;
  };
  const request = String(++portraitRequest);
  image.dataset.portraitRequest = request;
  // Keep the decoded illustration visible until the requested replacement is ready.
  if (image.src !== source) {
    const loading = new Image();
    const reveal = () => {
      if (!image.isConnected || image.dataset.portraitRequest !== request) return;
      syncPortrait();
      image.src = source;
      if (changedSkin && !changedPerson && !reduced && !hero.hidden) {
        linkedAnimate(image, [{ opacity: .7, transform: `translateX(${before.direction * 24}px)` }, { opacity: 1, transform: 'none' }], { duration: motionTiming.regionEnter, easing: motionEasing.enter });
      } else if (changedPerson && !reduced) {
        if (!hero.hidden) linkedAnimate(image, [{ opacity: .7, transform: `translateX(${before.direction * 48}px)` }, { opacity: 1, transform: 'none' }], { duration: motionTiming.regionEnter, easing: motionEasing.enter });
      }
    };
    loading.onload = () => {
      if (!image.isConnected || image.dataset.portraitRequest !== request) return;
      if (loading.decode) loading.decode().then(reveal, reveal);
      else reveal();
    };
    loading.src = source;
  } else {
    syncPortrait();
  }
  const strip = current.querySelector('.pv12-agent-strip');
  const nextStrip = replacement.querySelector('.pv12-agent-strip');
  for (const button of strip.querySelectorAll('[data-character]')) {
    const match = [...nextStrip.querySelectorAll('[data-character]')].find(item => item.dataset.character === button.dataset.character);
    if (!match) continue;
    button.className = match.className;
    button.setAttribute('aria-pressed', match.getAttribute('aria-pressed'));
  }
  const sectionChanged = previousSection !== replacement.dataset.section;
  const catalog = current.querySelector('.pv12-pool-catalog');
  const nextCatalog = replacement.querySelector('.pv12-pool-catalog');
  hero.hidden = nextHero.hidden;
  catalog.hidden = nextCatalog.hidden;
  const catalogChanged = catalog.innerHTML !== nextCatalog.innerHTML;
  const contentChanged = changedPerson || data.querySelector('.pv12-data-content').innerHTML !== nextData.querySelector('.pv12-data-content').innerHTML;
  if (catalogChanged) catalog.innerHTML = nextCatalog.innerHTML;
  if (changedPerson) data.innerHTML = nextData.innerHTML;
  else {
    const content = data.querySelector('.pv12-data-content');
    const nextContent = nextData.querySelector('.pv12-data-content');
    if (content.innerHTML !== nextContent.innerHTML && !(appearanceRefresh && syncAppearanceContent(content, nextContent))) content.innerHTML = nextContent.innerHTML;
    data.querySelector('.pv12-identity > span').textContent = nextData.querySelector('.pv12-identity > span').textContent;
    // Fixed actions belong to the current section, outside its scrollable reading body.
    const actions = data.querySelector('.pv12-data-actions');
    const nextActions = nextData.querySelector('.pv12-data-actions');
    if (!nextActions) actions?.remove();
    else if (!actions) data.append(nextActions.cloneNode(true));
    else if (actions.innerHTML !== nextActions.innerHTML) {
      const button = /** @type {HTMLButtonElement} */ (actions.querySelector('[data-act="selectCharacterSkin"]'));
      const nextButton = /** @type {HTMLButtonElement} */ (nextActions.querySelector('[data-act="selectCharacterSkin"]'));
      if (appearanceRefresh && button && nextButton) {
        button.textContent = nextButton.textContent;
        button.disabled = nextButton.disabled;
        button.dataset.character = nextButton.dataset.character;
        button.dataset.skin = nextButton.dataset.skin;
      } else actions.innerHTML = nextActions.innerHTML;
    }
  }
  const nextSections = replacement.querySelector('.pv12-sections');
  for (const button of current.querySelectorAll('.pv12-sections [data-section]')) {
    const match = [...nextSections.querySelectorAll('[data-section]')].find(item => item.dataset.section === button.dataset.section);
    if (!match) continue;
    button.className = match.className;
    button.setAttribute('aria-pressed', match.getAttribute('aria-pressed'));
  }
  const content = data.querySelector('.pv12-data-content');
  if (sectionChanged || changedPerson) content.scrollTop = 0;
  const transition = sectionChanged ? navigationChange({ room: 'classes', view: before.view }, { room: 'classes', view: next.dataset.view }) : null;
  if (!reduced && changedPerson && !sectionChanged && replacement.dataset.section !== 'appearance') animateBaseRefresh(content, 0, { x: before.direction * 64, duration: navigationTiming.detail });
  if (!reduced && !changedPerson && !catalog.hidden && (catalogChanged || sectionChanged)) animateBaseRefresh(catalog, 0, transition);
  if (!reduced && !changedPerson && !appearanceRefresh && (contentChanged || sectionChanged)) animateBaseRefresh(content, !catalog.hidden ? navigationTiming.stagger : 0, transition);
  return true;
}


export function bindHubBrowse(root, scroll, focus) {
  const page = /** @type {HTMLElement} */ (/** @type {HTMLElement} */ (/** @type {HTMLElement} */ (/** @type {HTMLElement} */ (root.querySelector('.hub-page')))));
  page.onscroll = () => scroll.set(page.dataset.view, page.scrollTop);
  if (root.dataset.browseBound) return;
  root.dataset.browseBound = 'true';
  const remember = event => {
    const control = event.target.closest?.('[data-act], [data-browser-key]');
    if (control) focus.set(page.dataset.view, { ...control.dataset });
  };
  root.addEventListener('focusin', remember);
  root.addEventListener('click', remember, true);
}

export function restoreHubFocus(viewKey, focus) {
  const restore = () => {
    if (/** @type {HTMLElement} */ (document.querySelector('#hubMain .hub-page'))?.dataset.view !== viewKey) return;
    const data = focus.get(viewKey);
    if (!data) return;
    const available = element => !element.matches(':disabled') && !element.closest('[hidden], [inert], [aria-hidden="true"]');
    const controls = [...document.querySelectorAll('#hubMain [data-act], #hubMain [data-browser-key]')].filter(available);
    // A completed trade can disable or remove its action. Keep keyboard browsing
    // on the page's declared safe target, without activating another transaction.
    const target = controls.find(element =>
      data.browserKey ? /** @type {HTMLElement} */ (element).dataset.browserKey === data.browserKey : Object.entries(data).every(([key, value]) => key === 'initialFocus' || /** @type {HTMLElement} */ (element).dataset[key] === value))
      || controls.find(element => element.hasAttribute('data-focus-fallback'));
    target?.setAttribute('data-initial-focus', '');
    /** @type {HTMLElement} */ (target)?.focus({ preventScroll: true });
  };
  if (!document.getElementById('cardZoom')) { restore(); return null; }
  const observer = new MutationObserver(() => {
    if (document.getElementById('cardZoom')) return;
    observer.disconnect(); restore();
  });
  observer.observe(document.body, { childList: true });
  return observer;
}
