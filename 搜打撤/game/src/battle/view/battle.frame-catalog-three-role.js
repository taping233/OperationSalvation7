import baita from '../../../assets/portraits/frames/baita/sprite-v1/animations.json';
import heixiang from '../../../assets/portraits/frames/heixiang/sprite-v1/animations.json';
import xingyue from '../../../assets/portraits/frames/xingyue/sprite-v1/animations.json';

const catalogs = { baita, heixiang, xingyue };
export const THREE_ROLE_FRAME_SEQUENCES = Object.fromEntries(
  Object.entries(catalogs).map(([role, catalog]) => [role, catalog.sequences]),
);
export const THREE_ROLE_FRAME_SIZE = { width: 512, height: 342 };

export function threeRoleTimeline(role, action, pace = 1) {
  const catalog = catalogs[role];
  const list = catalog?.sequences[action];
  if (!list) return null;
  const speed = action === 'idle' ? 1 : pace;
  return { list, dur: catalog.timings[action].map(ms => ms / speed),
    loop: action === 'idle', hold: action === 'death' };
}
