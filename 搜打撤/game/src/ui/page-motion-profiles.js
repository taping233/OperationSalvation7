// 页面声明展示顺序及切换语义；普通界面不借用场景遮幕，场景资源仍由原入口准备。
import { motionTiming } from './motion-presets.js';
import { navigationTiming } from './navigation-motion.js';
// P3 R03/R07: one short regional entrance, 22 ms spacing; no per-card queue.
const expeditionMotion = { expedition:true, duration:motionTiming.fastEnter, rise:6, staggerMax:motionTiming.navigationStagger * 2 };
const profiles = [
  { key: 'backpack', root: '.bag-v2', duration: motionTiming.detailEnter, rise: 0, staggerMax: 44, groups: [
    ['.bag-rail', 'nav', 0], ['.bag-head2', 'heading', 0],
    ['.bag-tools', 'nav', 22], ['.bag-board', 'content', 44],
  ] },
  { key: 'inbox', root: '.sugin-page', groups: [
    ['.pg-head', 'heading', 40], ['#sugBox', 'content', 140],
  ] },
  { key: 'settings', root: '.settings-page:not(.sugin-page)', duration: navigationTiming.enter, rise: 8, groups: [
    ['.pg-head', 'heading', 0], ['.settings-nav', 'nav', 80],
    ['.settings-content', 'content', 180],
    ['.settings-page:not(.settings-tabbed) .settings-group', 'content', 100],
  ] },
  { key: 'guide', root: '.beginner-guide', groups: [
    ['.bg-head', 'heading', 40], ['.bg-nav', 'nav', 80],
    ['.bg-illustration', 'portrait', 100], ['.bg-page-heading', 'heading', 120],
    ['.bg-copy', 'content', 160], ['.bg-pager', 'actions', 220],
  ] },
  { key: 'achievements', root: '.achievement-gallery', duration: motionTiming.regionEnter, rise: 6, groups: [
    ['.collection-page-identity', 'heading', 0],
    ['.ag-summary', 'content', 30],
  ] },
  { key: 'data', root: '.data-tuned, .pg.hub:not(#hubMain):has(.dt-grid)', groups: [
    ['.doom-stats', 'heading', 60], ['.dt-grid', 'content', 150], ['.devc-actions', 'actions', 230],
  ] },
  { key: 'character', root: '.cls2-page', groups: [
    ['.cls2-fullart', 'portrait', 60], ['.cls2-nameline', 'heading', 90],
    ['.cls2-level, .cls2-perk, .cls2-stats, .cls2-story, .cls2-skins-wrap', 'content', 130],
    ['.cls2-strip', 'nav', 160], ['.cls2-confirm', 'actions', 240],
  ] },
  { key: 'card-pool', root: '.cls-pool-page', groups: [
    ['.pg-head, .pool-catalog-head', 'heading', 40], ['.pool-filters', 'nav', 80],
    ['.pool-grid', 'content', 120], ['.pv-body', 'content', 170], ['.pool-pager', 'actions', 220],
  ] },
  { key: 'departure', root: '#depMain', groups: [
    ['.hub-head', 'heading', 40], ['.camp-depart-person', 'portrait', 80],
    ['.dep-body > section', 'content', 120], ['.dep-foot', 'actions', 220],
  ] },
  { key: 'preparation', root: '.preparation-shell', groups: [
    ['#preparationRoot', 'content', 100],
  ] },
  { key: 'expedition-event', root: '.event-scene', ...expeditionMotion, groups: [
    ['.event-story', 'content', 0], ['.node-main', 'content', motionTiming.navigationStagger], ['.node-foot', 'actions', motionTiming.navigationStagger * 2],
  ] },
  { key: 'expedition-shop', root: '.shop-market', ...expeditionMotion, groups: [
    ['.pg-head', 'heading', 0], ['.shop-board', 'content', motionTiming.navigationStagger],
    ['.shop-detail', 'content', 36], ['.shop-services', 'actions', motionTiming.navigationStagger * 2],
  ] },
  { key: 'expedition-reward', root: '.reward-v14, .entry-reward-scene', ...expeditionMotion, groups: [
    ['.reward-head', 'heading', 0], ['.reward-main', 'content', motionTiming.navigationStagger],
    ['.loot-actions', 'actions', motionTiming.navigationStagger * 2],
  ] },
  { key: 'encounter', root: '.node-pg', ...expeditionMotion, groups: [
    ['.node-kicker, .pg-head', 'heading', 40], ['.node-main', 'content', 130],
    ['.node-foot', 'actions', 230],
  ] },
  { key: 'archives', root: '.slot-page', groups: [
    ['.slot-page-head', 'heading', 40], ['.slot-card', 'content', 90],
  ] },
  { key: 'base-content', root: '#hubMain.base-camp', shell: 'content', duration: navigationTiming.enter, staggerMax: navigationTiming.staggerMax, groups: [
    ['.camp-section-head, .trade-v5-heading, .av3-header, .pv12-page-head, .courtyard-v3-heading', 'heading', 0],
    ['.pv12-agent-strip, .companion-toolbar, .warehouse-controls-v12, .trade-v5-modes, .facility-map, .av12-workspace > nav, .courtyard-v3-modes', 'nav', 60],
    ['.pv12-agent-art, .pv12-pool-catalog, .partner-display, .companion-hatch-art', 'portrait', 100],
    ['.pv12-agent-data, .warehouse-inventory-v12, .trade-v5-rail, .av12-content, .facility-v12-stage, .courtyard-v3-scene', 'content', 160],
    ['.trade-v5-desk, .facility-details, .courtyard-v3-controls, .partner-details, .companion-hatch', 'content', 220],
    ['.pv12-sections, .personnel-v12 .partner-stage > .person-roster', 'actions', 280],
  ] },
  { key: 'photo-studio', root: '.studio-unified, .card-library-page', groups: [
    ['.library-head', 'heading', 40], ['.studio-filterbar', 'nav', 90],
    ['.lib-grid', 'content', 140], ['.library-inspector', 'content', 190],
  ] },
  { key: 'other-page', root: '.pg:not(.flow-transition):not(.battle-stage)', groups: [
    [':scope > :not(button):not([aria-hidden="true"]):not([hidden])', 'content', 60],
  ] },
];

const pageRoots = profiles.map(profile => profile.root).join(', ');
// These surfaces browse or configure the current scene. Their own fixed layout
// and lazy image handling remain active; opening them is not a new scene load.
const navigationProfiles = new Set([
  'backpack', 'inbox', 'settings', 'guide', 'achievements', 'data',
  'card-pool', 'departure', 'preparation', 'archives',
]);

export function pageMotionProfile(content) {
  // Collect page roots once, then apply the declared priority (not DOM order).
  // No cache: in-place class changes and nested page replacement stay synchronous.
  const pages = content?.querySelectorAll(pageRoots);
  if (!pages?.length) return null;
  for (const profile of profiles) {
    for (const page of pages) {
      if (page.matches(profile.root)) return { expedition:false, ...profile, page, navigation: navigationProfiles.has(profile.key) };
    }
  }
  return null;
}

export function pageMotionBlocks(profile, contentOnly = false) {
  const result = [];
  for (const [selector, role, delay] of profile.groups) {
    if (contentOnly && (role === 'heading' || role === 'nav')) continue;
    const nodes = [...profile.page.querySelectorAll(selector)].filter(el => !el.closest('[hidden]'));
    nodes.slice(0, 8).forEach((el, index) => {
      if (result.some(region => region.el === el || region.el.contains(el) || el.contains(region.el))) return;
      result.push({ el, role, delay: Math.min(delay + index * 28, 260) });
    });
  }
  if (profile.key === 'base-content') {
    result.forEach((region, index) => { region.delay = Math.min(index * navigationTiming.stagger, navigationTiming.staggerMax); });
  }
  return result;
}
