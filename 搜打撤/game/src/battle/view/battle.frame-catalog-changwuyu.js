import changwuyu from '../../../assets/portraits/frames/changwuyu/sprite-v1/animations.json';

export const CHANGWUYU_FRAME_SEQUENCES = changwuyu.sequences;
export const CHANGWUYU_FRAME_SIZE = { width: changwuyu.width, height: changwuyu.height };

export function changwuyuTimeline(action, pace = 1) {
  const names = changwuyu.sequences[action];
  if (!names) return null;
  const speed = action === 'idle' ? 1 : pace;
  return { list: names, dur: changwuyu.timings[action].map(ms => ms / speed),
    loop: action === 'idle', hold: action === 'death' };
}
