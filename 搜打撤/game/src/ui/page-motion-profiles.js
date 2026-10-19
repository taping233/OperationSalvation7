// 页面只声明展示顺序；时长、进退曲线与生命周期由 surface-motion 统一管理。
import { motionTiming } from './motion-presets.js';
import { navigationTiming } from './navigation-motion.js';
const profiles = [
  { key: 'backpack', root: '.bag-v2', duration: motionTiming.detailEnter, rise: 0, staggerMax: 44, groups: [
    ['.bag-rail', 'nav', 0], ['.bag-head2', 'heading', 0],
    ['.bag-tools', 'nav', 22], ['.bag-board', 'content', 44], ['.bag-side', 'content', 44],
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
    ['.ag-title-group > div', 'heading', 0],
    ['.ag-summary', 'content', 30],
  ] },
  { key: 'data', root: '.data-tuned, .pg.hub:not(#hubMain):has(.dt-grid)', groups: [
    ['.doom-stats', 'heading', 60], ['.dt-grid', 'content', 150], ['.devc-actions', 'actions', 230],
  ] },
  { key: 'character', root: '.cls2-page', groups: [
    ['.cls2-fullart', 'portrait', 60], ['.cls2-eyebrow, .cls2-nameline', 'heading', 90],
    ['.cls2-level, .cls2-perk, .cls2-palette, .cls2-stats, .cls2-story, .cls2-skins-wrap', 'content', 130],
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
  { key: 'expedition-event', root: '.event-scene', expedition: true, duration: 240, rise: 8, staggerMax: 48, groups: [
    ['.event-story', 'content', 0], ['.node-main', 'content', 24], ['.node-foot', 'actions', 48],
  ] },
  { key: 'expedition-shop', root: '.shop-market', expedition: true, duration: 240, rise: 8, staggerMax: 48, groups: [
    ['.pg-head', 'heading', 0], ['.shop-board', 'content', 24],
    ['.shop-detail', 'content', 36], ['.shop-services', 'actions', 48],
  ] },
  { key: 'expedition-reward', root: '.reward-v14, .entry-reward-scene', expedition: true, duration: 240, rise: 8, staggerMax: 48, groups: [
    ['.reward-head, .entry-reward-head', 'heading', 0], ['.reward-main, .entry-reward-cards', 'content', 24],
    ['.loot-actions, .entry-reward-actions', 'actions', 48],
  ] },
  { key: 'encounter', root: '.node-pg', expedition: true, duration: 240, rise: 8, staggerMax: 48, groups: [
    ['.node-kicker, .pg-head', 'heading', 40], ['.node-main', 'content', 130],
    ['.node-foot', 'actions', 230],
  ] },
  { key: 'archives', root: '.slot-page', groups: [
    ['.slot-page-head', 'heading', 40], ['.slot-card', 'content', 90],
  ] },
  { key: 'base-content', root: '#hubMain.base-camp', duration: navigationTiming.enter, staggerMax: navigationTiming.staggerMax, groups: [
    ['.camp-section-head, .trade-v5-heading, .av3-header, .pv12-page-head, .courtyard-v3-heading', 'heading', 0],
    ['.pv12-agent-strip, .companion-toolbar, .warehouse-controls-v12, .trade-v5-modes, .facility-map, .av12-workspace > nav, .courtyard-v3-modes', 'nav', 60],
    ['.pv12-agent-art, .pv12-pool-catalog, .partner-display, .companion-hatch-art, .facility-v12-stage, .courtyard-v3-scene', 'portrait', 100],
    ['.pv12-agent-data, .warehouse-inventory-v12, .trade-v5-rail, .av12-content', 'content', 160],
    ['.warehouse-reading-v12, .trade-v5-desk, .facility-details, .courtyard-v3-controls, .partner-details, .companion-hatch', 'content', 220],
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

export function pageMotionProfile(content) {
  for (const profile of profiles) {
    const page = content?.querySelector(profile.root);
    if (page) return { ...profile, page };
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
