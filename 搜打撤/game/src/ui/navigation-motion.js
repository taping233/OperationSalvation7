// Navigation has one spatial language: rooms move horizontally; details unfold nearby.
export const navigationTiming = Object.freeze({ enter: 260, detail: 220, refresh: 160, stagger: 22, staggerMax: 66 });
const rooms = ['deploy', 'classes', 'stash', 'shop', 'ach', 'upgrade', 'courtyard'];
const sections = ['cards', 'pocket', 'profile', 'pool', 'appearance', 'collection', 'pets', 'rewards', 'achievements', 'backs', 'stories'];
export function navigationState(root) {
  const page = root?.querySelector('.hub-page');
  return {
    room: root?.querySelector('.hub-tab.on')?.dataset.tab || root?.dataset.page || '',
    view: page?.dataset.motionView || page?.dataset.view || '',
  };
}
export function navigationChange(before, after) {
  const detail = before?.room === after?.room;
  const rank = state => detail
    ? sections.findIndex(section => state?.view?.split('/').includes(section))
    : rooms.indexOf(state?.room);
  const direction = rank(after) >= rank(before) ? 1 : -1;
  return {
    changed: before?.room !== after?.room || before?.view !== after?.view,
    detail, direction, x: direction * (detail ? 14 : 28),
    duration: detail ? navigationTiming.detail : navigationTiming.enter,
  };
}
