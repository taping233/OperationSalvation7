import { linkedAnimate } from '../ui/home-linked-interactions.js';
import { motionTiming, motionEasing } from '../ui/motion-presets.js';
import { pageMotionProfile, pageMotionBlocks } from '../ui/page-motion-profiles.js';
import { animateBaseRefresh } from './base-motion-v4.js';
import { refreshCardBrowser } from '../ui/card-browser.js';
import { navigationState, navigationChange, navigationTiming } from '../ui/navigation-motion.js';
// 基地壳只挂载一次；浏览状态留在界面，交易继续使用原命令入口。
let portraitRequest = 0;
const portraitSizing = new WeakSet();
function sizePortrait(hero) {
  const image = hero?.querySelector('img');
  if (!image) return;
  const apply = () => { if (image.naturalWidth && image.naturalHeight) hero.classList.toggle('is-wide', image.naturalWidth > image.naturalHeight * 1.15); };
  apply();
  if (!portraitSizing.has(image)) { portraitSizing.add(image); image.addEventListener('load', apply); }
}
const readingPositions = new Map();
function readingKey(root, pane) {
  const identity = pane.classList.contains('warehouse-reading') ? pane.querySelector('header h3')?.textContent || '' : '';
  return `${root.querySelector('.hub-slot-label')?.textContent}/${root.querySelector('.hub-page')?.dataset.view}/${pane.classList.contains('warehouse-reading') ? 'card/' + identity : 'person'}`;
}
function rememberReading(root) {
  if (!root) return;
  for (const pane of root.querySelectorAll('.warehouse-reading, .person-stage .person-details')) {
    const key = readingKey(root, pane);
    readingPositions.delete(key); readingPositions.set(key, pane.scrollTop);
  }
  while (readingPositions.size > 64) readingPositions.delete(readingPositions.keys().next().value);
}
function restoreReading(root) {
  if (!root) return;
  for (const pane of root.querySelectorAll('.warehouse-reading, .person-stage .person-details')) pane.scrollTop = readingPositions.get(readingKey(root, pane)) || 0;
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
  if (current.dataset.page !== next.dataset.page) {
    ui.showOverlay('', html, 'page');
    positionNavigation(document.getElementById('hubMain'));
    restoreReading(document.getElementById('hubMain'));
    return;
  }
  const page = current.querySelector('.hub-page');
  const nextPage = next.querySelector('.hub-page');
  const changed = (page.dataset.motionView || page.dataset.view) !== (nextPage.dataset.motionView || nextPage.dataset.view);
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
    const replacement = next.querySelector(`.hub-tab[data-tab="${button.dataset.tab}"]`);
    button.className = replacement.className;
    button.setAttribute('aria-pressed', replacement.getAttribute('aria-pressed'));
    if (replacement.hasAttribute('aria-current')) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
    if (button.innerHTML !== replacement.innerHTML) button.innerHTML = replacement.innerHTML;
  }
  const visibleHero = page.querySelector('.person-hero');
  const originalImage = visibleHero?.querySelector('img');
  const oldEcho = visibleHero?.querySelector('[data-portrait-echo]');
  const visibleImage = oldEcho && Number(getComputedStyle(originalImage).opacity) < .5 ? oldEcho : originalImage;
  const before = { view: page.dataset.view, portrait: visibleHero?.getBoundingClientRect(), source: visibleImage?.currentSrc || visibleImage?.src };
  page.getAnimations?.({ subtree: true }).forEach(animation => animation.cancel());
  page.className = nextPage.className.replace(' page-in', '');
  page.dataset.view = nextPage.dataset.view;
  page.dataset.motionView = nextPage.dataset.motionView || nextPage.dataset.view;
  const previousRegions = regionContents(page);
  const keptPortrait = updatePersonnel(page, nextPage, reducedMotion(), before);
  if (!keptPortrait) {
    page.innerHTML = nextPage.innerHTML;
    if (!changed && !page.querySelector('.trade-v5')) animateChangedRegions(page, previousRegions);
  }
  positionNavigation(current);
  restoreReading(current);
  current.querySelector('.camp-notice')?.remove();
  const notice = next.querySelector('.camp-notice');
  if (notice) current.append(notice);
  ui._acts = { ...(document.getElementById('cardZoom')?._inventoryActions || {}) };
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
  linkedAnimate(target, [{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: motionTiming.feedback, easing: motionEasing.enter });
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
  const nav = root?.querySelector('.hub-tabs'), target = nav?.querySelector('.hub-tab.on');
  if (target) {
  let marker = nav.querySelector('.camp-navigation-indicator');
  if (!marker) { marker = document.createElement('span'); marker.className = 'camp-navigation-indicator'; marker.setAttribute('aria-hidden', 'true'); nav.append(marker); }
  marker.style.height = `${target.offsetHeight}px`;
  marker.style.transform = `translateY(${target.offsetTop}px)`;
  }
  const page = root.querySelector('.hub-page'), inspector = root.querySelector('.warehouse-inspector'), layout = root.querySelector('.warehouse-layout');
  if (page && inspector && layout && page.clientHeight) inspector.style.height = `${Math.max(320, page.clientHeight - layout.offsetTop - 20)}px`;
  sizePortrait(page?.querySelector('.person-hero'));
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
function regionContents(page) {
  const profile = pageMotionProfile(page.closest('#hubMain')?.parentElement);
  return new Map((profile ? pageMotionBlocks(profile) : []).map(({ el }) => [el.className, el.innerHTML]));
}
function animateChangedRegions(page, before) {
  const profile = pageMotionProfile(page.closest('#hubMain')?.parentElement);
  let index = 0;
  for (const { el } of profile ? pageMotionBlocks(profile) : []) {
    if (before.get(el.className) !== el.innerHTML) animateBaseRefresh(el, Math.min(index++ * navigationTiming.stagger, navigationTiming.staggerMax));
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
  ], { duration: transition.duration, delay: Math.min(delay, navigationTiming.staggerMax), easing:motionEasing.enter, fill:'backwards' });
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
  const request = String(++portraitRequest);
  image.dataset.portraitRequest = request;
  // Keep the decoded illustration visible until the requested replacement is ready.
  if (image.src !== source) {
    const loading = new Image();
    const reveal = () => {
      if (!image.isConnected || image.dataset.portraitRequest !== request) return;
      image.style.cssText = nextImage.style.cssText;
      image.dataset.portraitFit = nextImage.dataset.portraitFit;
      image.src = source; image.alt = nextImage.alt;
      if (changedPerson && !reduced) {
        if (!hero.hidden) linkedAnimate(image, [{ opacity: .7 }, { opacity: 1 }], { duration: 120, easing: motionEasing.enter });
      }
    };
    loading.onload = () => {
      if (loading.decode) loading.decode().then(reveal, reveal);
      else reveal();
    };
    loading.src = source;
  } else {
    image.style.cssText = nextImage.style.cssText;
    image.dataset.portraitFit = nextImage.dataset.portraitFit;
    image.alt = nextImage.alt;
  }
  hero.dataset.skin = nextHero.dataset.skin;
  hero.querySelector('figcaption').innerHTML = nextHero.querySelector('figcaption').innerHTML;
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
    if (content.innerHTML !== nextContent.innerHTML) content.innerHTML = nextContent.innerHTML;
    data.querySelector('.pv12-identity > span').textContent = nextData.querySelector('.pv12-identity > span').textContent;
    // Fixed actions belong to the current section, outside its scrollable reading body.
    const actions = data.querySelector('.pv12-data-actions');
    const nextActions = nextData.querySelector('.pv12-data-actions');
    if (!nextActions) actions?.remove();
    else if (!actions) data.append(nextActions.cloneNode(true));
    else if (actions.innerHTML !== nextActions.innerHTML) actions.innerHTML = nextActions.innerHTML;
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
  if (!reduced && !changedPerson && !catalog.hidden && (catalogChanged || sectionChanged)) animateBaseRefresh(catalog, 0, transition);
  if (!reduced && !changedPerson && (contentChanged || sectionChanged)) animateBaseRefresh(content, !catalog.hidden ? navigationTiming.stagger : 0, transition);
  return true;
}
function updatePersonnel(page, next, reduced, before) {
  if (updatePersonnelV12(page, next, reduced, before)) return true;
  const hero = page.querySelector('.person-hero'), nextHero = next.querySelector('.person-hero');
  const details = page.querySelector('.person-stage .person-details'), nextDetails = next.querySelector('.person-stage .person-details');
  if (!hero || !nextHero || !details || !nextDetails) return false;
  const previousSection = page.querySelector('.personnel-v2').dataset.section;
  const nextSection = next.querySelector('.personnel-v2').dataset.section;
  page.querySelector('.personnel-v2').dataset.section = nextSection;
  const image = hero.querySelector('img'), nextImage = nextHero.querySelector('img');
  const request = String(++portraitRequest);
  image.dataset.portraitRequest = request;
  const changedPerson = image.alt !== nextImage.alt;
  // template 中的图片属于惰性文档；先按运行页面解析地址，避免加载完成后相对/绝对地址比较失败。
  const expectedSource = new URL(nextImage.getAttribute('src'), document.baseURI).href;
  const changedImage = image.src !== expectedSource;
  hero.querySelectorAll('[data-portrait-echo]').forEach(echo => echo.remove());
  image.style.opacity = '';
  if ((changedImage || before.source !== expectedSource) && !reduced && before.source) {
    const echo = image.cloneNode(false);
    echo.src = before.source; echo.alt = ''; echo.className = 'portrait-echo'; echo.style.opacity = '';
    echo.setAttribute('data-portrait-echo', ''); echo.setAttribute('aria-hidden', 'true'); hero.append(echo);
    image.style.opacity = '0'; image.src = expectedSource;
    const reveal = () => {
      image.removeEventListener('load', reveal); image.removeEventListener('error', reveal);
      if (!image.isConnected || image.src !== expectedSource || image.dataset.portraitRequest !== request) { echo.remove(); return; }
      image.style.opacity = '';
      linkedAnimate(image, [{ opacity: 0 }, { opacity: 1 }], { duration: motionTiming.feedback, easing: motionEasing.enter });
      const fade = linkedAnimate(echo, [{ opacity: 1 }, { opacity: 0 }], { duration: motionTiming.feedback, easing: motionEasing.exit });
      if (fade) fade.finished.then(() => echo.remove(), () => echo.remove()); else echo.remove();
    };
    if (image.complete) reveal(); else { image.addEventListener('load', reveal, { once: true }); image.addEventListener('error', reveal, { once: true }); }
  } else if (changedImage) image.src = expectedSource;
  image.alt = nextImage.alt;
  sizePortrait(hero);
  hero.dataset.skin = nextHero.dataset.skin;
  hero.querySelector('figcaption').innerHTML = nextHero.querySelector('figcaption').innerHTML;
  const heading = page.querySelector('.camp-section-head'), nextHeading = next.querySelector('.camp-section-head');
  if (heading && nextHeading) heading.innerHTML = nextHeading.innerHTML;
  for (const button of page.querySelectorAll('.person-face')) {
    const replacement = next.querySelector(`.person-face[data-character="${button.dataset.character}"]`);
    button.className = replacement.className; button.setAttribute('aria-pressed', replacement.getAttribute('aria-pressed'));
  }
  details.getAnimations?.().forEach(animation => animation.cancel());
  hero.getAnimations?.().forEach(animation => animation.cancel());
  details.innerHTML = nextDetails.innerHTML;
  const direction = navigationChange({ room: 'classes', view: before.view }, { room: 'classes', view: next.dataset.view }).direction;
  if (!reduced && details.animate) linkedAnimate(details, [{ opacity: 0, transform: `translateX(${direction * 14}px)` }, { opacity: 1, transform: 'none' }], { duration: motionTiming.change, easing: motionEasing.enter });
  if (!reduced && hero.animate && previousSection !== nextSection && hero.offsetWidth && hero.offsetHeight) {
    const after = hero.getBoundingClientRect(), visible = before.portrait || after;
    const scaleX = after.width / hero.offsetWidth, scaleY = after.height / hero.offsetHeight;
    linkedAnimate(hero, [{ transform: `translate(${(visible.left - after.left) / scaleX}px, ${(visible.top - after.top) / scaleY}px) scale(${visible.width / after.width}, ${visible.height / after.height})` }, { transform: 'none' }], { duration: motionTiming.change, easing: motionEasing.enter });
  } else if (changedPerson && !reduced && hero.animate) linkedAnimate(hero, [{ opacity: .2, transform: 'translateX(-16px)' }, { opacity: 1, transform: 'none' }], { duration: motionTiming.change, easing: motionEasing.enter });
  return true;
}

export function bindHubBrowse(root, scroll, focus) {
  const page = root.querySelector('.hub-page');
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
    if (document.querySelector('#hubMain .hub-page')?.dataset.view !== viewKey) return;
    const data = focus.get(viewKey);
    if (!data) return;
    const target = [...document.querySelectorAll('#hubMain [data-act], #hubMain [data-browser-key]')].find(element =>
      data.browserKey ? element.dataset.browserKey === data.browserKey : Object.entries(data).every(([key, value]) => key === 'initialFocus' || element.dataset[key] === value));
    target?.setAttribute('data-initial-focus', '');
    target?.focus({ preventScroll: true });
  };
  if (!document.getElementById('cardZoom')) { restore(); return null; }
  const observer = new MutationObserver(() => {
    if (document.getElementById('cardZoom')) return;
    observer.disconnect(); restore();
  });
  observer.observe(document.body, { childList: true });
  return observer;
}
