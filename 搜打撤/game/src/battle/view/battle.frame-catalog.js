import wu from '../../../assets/portraits/frames/wu/sprite-v1/animations.json';

export const WU_FRAME_SEQUENCES = wu.sequences;
export const WU_FRAME_SIZE = { width: wu.width, height: wu.height };

export function wuTimeline(action, pace = 1) {
  const names = wu.sequences[action];
  if (!names) return null;
  const speed = action === 'idle' ? 1 : pace;
  return { list: names, dur: wu.timings[action].map(ms => ms / speed),
    loop: action === 'idle', hold: action === 'death' };
}
