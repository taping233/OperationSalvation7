import { mapImageReady } from '/src/core/map-image-ready.js';

const trailUrls = [
  new URL('/assets/scenes/map-brush-1015/trail-a.webp', import.meta.url).href,
  new URL('/assets/scenes/map-brush-1015/trail-b.webp', import.meta.url).href,
  new URL('/assets/scenes/map-brush-1015/trail-c.webp', import.meta.url).href,
];
const images = new Map();
const roadPaint = new WeakMap();
function imageFor(url) {
  if (!images.has(url)) {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => window.SDT?.RenderScheduler?.invalidate();
    image.src = url;
    images.set(url, image);
  }
  return images.get(url);
}
export function prepareMapBrushArt() {
  return Promise.all(trailUrls.map(url => mapImageReady(imageFor(url))));
}
// A canonical edge key gives both directions the same painted trail.
export function mapBrushVariant(key) {
  const canonical = key.split('|').sort().join('|');
  let hash = 2166136261;
  for (const char of canonical) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % trailUrls.length;
}
function point(c, t) {
  const u = 1 - t;
  return {x:u*u*u*c.from.x+3*u*u*t*c.c1.x+3*u*t*t*c.c2.x+t*t*t*c.to.x,
    y:u*u*u*c.from.y+3*u*u*t*c.c1.y+3*u*t*t*c.c2.y+t*t*t*c.to.y};
}

// Warp the painted ribbon onto the movement curve once, then reuse one image per road.
export function drawMapBrushRoad(ctx, road, scale, {alpha = .65} = {}) {
  const variant = mapBrushVariant(road.edgeKey);
  const image = imageFor(trailUrls[variant]);
  if (!image.complete || !image.naturalWidth) return false;
  let stamp = roadPaint.get(road);
  if (!stamp || stamp.scale !== scale) {
    const c = road.section;
    // Normalize to the visible pigment band; retain the original soft alpha outside it.
    const pigmentRatio = [193/1024,237/1024,216/1024][variant];
    const ribbonHeight = 24 * scale / pigmentRatio;
    const pad = ribbonHeight / 2 + 2 * scale;
    const xs = [c.from.x,c.c1.x,c.c2.x,c.to.x], ys = [c.from.y,c.c1.y,c.c2.y,c.to.y];
    const x = Math.min(...xs)-pad, y = Math.min(...ys)-pad;
    const width = Math.max(...xs)-x+pad, height = Math.max(...ys)-y+pad;
    const canvas = document.createElement('canvas');
    // Keep the stamp at screen resolution, including while zoomed out.
    const density = 1 / scale;
    canvas.width = Math.max(1,Math.ceil(width*density));
    canvas.height = Math.max(1,Math.ceil(height*density));
    const paint = canvas.getContext('2d');
    if (!paint) return false;
    paint.scale(density,density); paint.translate(-x,-y);
    const steps = 40, sourceWidth = image.naturalWidth/steps;
    for (let i=0; i<steps; i++) {
      const a=point(c,i/steps), b=point(c,(i+1)/steps);
      paint.save(); paint.translate(a.x,a.y); paint.rotate(Math.atan2(b.y-a.y,b.x-a.x));
      paint.drawImage(image,i*sourceWidth,0,sourceWidth,image.naturalHeight,
        0,-ribbonHeight/2,Math.hypot(b.x-a.x,b.y-a.y)+.5*scale,ribbonHeight);
      paint.restore();
    }
    stamp={canvas,x,y,width,height,scale}; roadPaint.set(road,stamp);
  }
  ctx.save(); ctx.globalAlpha*=alpha;
  ctx.drawImage(stamp.canvas,stamp.x,stamp.y,stamp.width,stamp.height);
  ctx.restore();
  return true;
}