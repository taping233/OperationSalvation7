import { mapTravelPoint } from './map-travel-path.js';
import { ease } from '../core/motion-primitives.js';

// Arc-length samples give the whole route one speed profile, including curved edges.
export function createTravelMotion(route, zoom) {
  const samples = [{ distance: 0, segment: 1, progress: 0, point: route[0] }];
  const ends = [];
  let distance = 0, previous = route[0];
  for (let segment = 1; segment < route.length; segment++) {
    for (let index = 1; index <= 32; index++) {
      const progress = index / 32;
      const point = mapTravelPoint(route[segment - 1], route[segment], progress);
      distance += Math.hypot(point.x - previous.x, point.y - previous.y);
      samples.push({ distance, segment, progress, point });
      previous = point;
    }
    ends.push(distance);
  }
  const duration = route.length === 2
    ? Math.max(350, Math.min(450, 300 + distance * zoom * .18))
    : Math.max(500, Math.min(2400, 180 + distance * zoom * .8));
  const at = progress => {
    const target = distance * Math.max(0, Math.min(1, progress));
    let index = 1;
    while (index < samples.length - 1 && samples[index].distance < target) index++;
    const a = samples[index - 1], b = samples[index];
    const ratio = (target - a.distance) / Math.max(.0001, b.distance - a.distance);
    const local = (a.segment === b.segment ? a.progress : 0) +
      (b.progress - (a.segment === b.segment ? a.progress : 0)) * ratio;
    return { distance: target, segment: b.segment, progress: local,
      point: mapTravelPoint(route[b.segment - 1], route[b.segment], local) };
  };
  return { duration, ends, at, sample: time => at(ease.smooth(Math.max(0, Math.min(1, time)))) };
}

// A separate decoration avoids changing the shared map renderer or its hit targets.
export function createArrivalFeedback(game) {
  const canvas = document.getElementById('game');
  if (!canvas) return { update() {}, dispose() {} };
  const ring = document.createElement('div');
  ring.setAttribute('aria-hidden', 'true');
  ring.style.cssText = 'position:fixed;z-index:20;pointer-events:none;border:1px solid #b8eee2;border-radius:50%;box-shadow:0 0 14px #8ddaca66,inset 0 0 10px #8ddaca33;opacity:0;';
  document.body.appendChild(ring);
  return {
    update(progress) {
      const rect = canvas.getBoundingClientRect(), cam = game.cam;
      const point = cam.worldToScreen(game.pos.x, game.pos.y);
      const scaleX = rect.width / cam.viewW, scaleY = rect.height / cam.viewH;
      const radius = (28 + 12 * ease.cubicOut(progress)) * Math.min(1.25, cam.viewW / 1280);
      ring.style.width = `${radius * 2 * scaleX}px`;
      ring.style.height = `${radius * 2 * scaleY}px`;
      ring.style.left = `${rect.left + point.x * scaleX - radius * scaleX}px`;
      ring.style.top = `${rect.top + point.y * scaleY - radius * scaleY}px`;
      ring.style.opacity = String(.72 * (1 - progress));
    },
    dispose() { ring.remove(); },
  };
}
