// Navigation has one spatial language: rooms move horizontally; details unfold nearby.
import { motionTiming } from './motion-presets.js';
export const navigationTiming = Object.freeze({ enter: motionTiming.navigation, detail: motionTiming.navigationDetail,
  refresh: motionTiming.change, stagger: motionTiming.navigationStagger, staggerMax: motionTiming.navigationStaggerMax });
export const baseNavigationTiming = Object.freeze({ enter:440, detail:380, refresh:320, stagger:26, staggerMax:78 });
export const baseNavigationEasing = 'cubic-bezier(.2,.65,.25,1)';
const rooms = ['deploy', 'classes', 'stash', 'shop', 'ach', 'upgrade', 'courtyard'];
const sections = ['cards', 'pocket', 'profile', 'pool', 'appearance', 'collection', 'pets', 'rewards', 'achievements', 'backs', 'stories'];
const roomSections = {
  stash: ['cards', 'pocket'],
  shop: ['buy', 'sell'],
  ach: ['cards', 'rewards', 'achievements', 'classes', 'backs', 'stories'],
  upgrade: ['bag', 'stash'],
};
function sectionRank(state) {
  const path = state?.view?.split('/') || [];
  if (state?.room === 'classes') {
    if (path.includes('pets')) return path.includes('hatch') ? 4 : 3;
    return ['profile', 'pool', 'appearance'].findIndex(section => path.includes(section));
  }
  return (roomSections[state?.room] || sections).findIndex(section => path.includes(section));
}
export function navigationState(root) {
  const page = /** @type {HTMLElement} */ (root?.querySelector('.hub-page'));
  return {
    room: /** @type {HTMLElement} */ (root?.querySelector('.hub-tab.on'))?.dataset.tab || root?.dataset.page || '',
    view: page?.dataset.motionView || page?.dataset.view || '',
  };
}
export function navigationChange(before, after) {
  const detail = before?.room === after?.room;
  const rank = state => detail
    ? sectionRank(state)
    : rooms.indexOf(state?.room);
  const direction = rank(after) >= rank(before) ? 1 : -1;
  return {
    changed: before?.room !== after?.room || before?.view !== after?.view,
    detail, direction, x: direction * (detail ? 14 : 28),
    duration: detail ? navigationTiming.detail : navigationTiming.enter,
  };
}

// 基地使用完整横向行程；其他界面保留原有导航参数。
export function baseNavigationChange(before, after) {
  const transition = navigationChange(before, after);
  return { ...transition, x:transition.direction * (transition.detail ? 64 : 112),
    duration:transition.detail ? baseNavigationTiming.detail : baseNavigationTiming.enter };
}
