import { inertia } from 'motion';

export function cameraPanBounds(map, camera = {}) {
  const points = camera.layerGame?.nodePos?.[camera.layerGame.layerIdx];
  let minX = 0, minY = 0, maxX = map.cols * map.tile, maxY = map.rows * map.tile;
  if (points?.length) {
    minX = minY = Infinity; maxX = maxY = -Infinity;
    for (const point of points) {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    if (!Number.isFinite(minX)) return { minX:camera.cx, maxX:camera.cx, minY:camera.cy, maxY:camera.cy };
  }
  const zoom = camera.zoom || 1, width = camera.viewW || 0, height = camera.viewH || 0;
  const inset = camera.detailInset || 0, available = Math.max(0, width - inset);
  const unit = width / 1280;
  const side = Math.min(available * .16, 120 * unit);
  const top = Math.min(height * .23, 105 * unit), bottom = Math.min(height * .30, 190 * unit);
  // Keep the padded node envelope inside the usable viewport. If it fits on an
  // axis, allow only a small margin around its centre for comfortable dragging.
  const axis = (min, max, size, before, after, offset = 0) => {
    const low = min + (size / 2 - before + offset) / zoom;
    const high = max - (size / 2 - after - offset) / zoom;
    const slack = Math.min(size * .12, 80 * unit) / zoom;
    return low <= high ? [low - slack, high + slack] : [(low + high) / 2 - slack, (low + high) / 2 + slack];
  };
  const x = axis(minX, maxX, available, side, side, inset / 2);
  const y = axis(minY, maxY, height, top, bottom);
  return { minX:x[0], maxX:x[1], minY:y[0], maxY:y[1] };
}

const rubber = (value, min, max, limit) => {
  const edge = value < min ? min : value > max ? max : value;
  const distance = value - edge;
  return edge + distance * .35 / (1 + Math.abs(distance) / limit);
};

// Pointer movement stays direct. Only release uses the existing Motion inertia
// generator; the camera owns its rAF and can cancel it with any new input.
export function createMapDragMotion(camera, {
  invalidate = () => {}, now = () => performance.now(),
  requestFrame = callback => requestAnimationFrame(callback),
  cancelFrame = frame => cancelAnimationFrame(frame), reduced = () => false,
} = {}) {
  let dragging = false, frame = null, version = 0, rawX = 0, rawY = 0, samples = [];
  const sample = () => {
    const time = now();
    samples.push({ time, x:camera.cx, y:camera.cy });
    while (samples.length > 2 && samples[1].time < time - 100) samples.shift();
  };
  function cancel(clamp = false) {
    version++; dragging = false; samples = [];
    if (frame != null) cancelFrame(frame);
    frame = null;
    if (clamp) { camera.clamp(); invalidate(false); }
  }
  return {
    get dragging() { return dragging; },
    cancel,
    begin() {
      cancel(); dragging = true; rawX = camera.cx; rawY = camera.cy; sample();
    },
    move(dx, dy) {
      if (!dragging) return;
      const bounds = cameraPanBounds(camera.map, camera);
      rawX -= dx / camera.zoom; rawY -= dy / camera.zoom;
      const limit = 80 / camera.zoom;
      camera.cx = rubber(rawX, bounds.minX, bounds.maxX, limit);
      camera.cy = rubber(rawY, bounds.minY, bounds.maxY, limit);
      sample(); invalidate(false);
    },
    release(allowed = () => true) {
      if (!dragging) return;
      dragging = false;
      if (reduced() || !allowed()) { cancel(true); return; }
      const start = samples[0], last = samples.at(-1), releasedAt = now();
      const held = !last || releasedAt - last.time > 90;
      const dt = Math.max(8, (last?.time || 0) - (start?.time || 0));
      const cap = 2400 / camera.zoom;
      const speed = axis => held ? 0 : Math.max(-cap, Math.min(cap, ((last?.[axis] || 0) - (start?.[axis] || 0)) / dt * 1000));
      const bounds = cameraPanBounds(camera.map, camera);
      const options = { power:.24, timeConstant:240, bounceStiffness:480, bounceDamping:42,
        restDelta:.25 / camera.zoom, restSpeed:5 / camera.zoom };
      const x = inertia({ ...options, keyframes:[camera.cx], velocity:speed('x'), min:bounds.minX, max:bounds.maxX });
      const y = inertia({ ...options, keyframes:[camera.cy], velocity:speed('y'), min:bounds.minY, max:bounds.maxY });
      const token = ++version;
      const tick = time => {
        if (token !== version) return;
        frame = null;
        if (!allowed()) { cancel(true); return; }
        const elapsed = Math.max(0, time - releasedAt), sx = x.next(elapsed), sy = y.next(elapsed);
        camera.cx = sx.value; camera.cy = sy.value;
        const active = !(sx.done && sy.done);
        invalidate(active);
        if (active) frame = requestFrame(tick);
        else { camera.clamp(); samples = []; }
      };
      frame = requestFrame(tick);
    },
  };
}
