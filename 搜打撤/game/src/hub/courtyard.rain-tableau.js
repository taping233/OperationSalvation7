const PALETTES = Object.freeze({
  slate: { paper: '#eee8da', water: '#7f928b', wash: '#a4b1a1', rim: '#c6ccb9', left: '#99a58c', right: '#76856f', ink: '#52645b', rain: '#70877e', light: '#e0e6d8' },
  moss: { paper: '#eee8da', water: '#879475', wash: '#abb38c', rim: '#cbd0ab', left: '#9aa57f', right: '#788768', ink: '#58674b', rain: '#7b8d6d', light: '#e8e9d3' },
  clay: { paper: '#eee8da', water: '#b58b79', wash: '#d0ab94', rim: '#d9bda5', left: '#b39378', right: '#926e58', ink: '#795b48', rain: '#9e8575', light: '#f0dcc6' },
});
const LIMITS = Object.freeze({ drops: 80, ripples: 64 });
const WATER_EDGE = .965;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Canvas 像素坐标；调用方负责 RAF、音频、可见性与减少动效设置。
export function createRainTableau(canvas, { sceneBackdrop = false } = {}) {
  const ctx = canvas?.getContext('2d');
  let width = 1, height = 1, scale = 1, sx = 1, sy = 1, cx = 0, cy = 0;
  let time = 0, intensity = 40, palette = 'slate', disposed = false, seed = 1707;
  const drops = [], ripples = [];
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const project = (u, v) => ({ x: cx + (u - v) * sx, y: cy + (u + v) * sy });
  const unproject = (x, y) => {
    const horizontal = (x - cx) / sx, vertical = (y - cy) / sy;
    return { u: (horizontal + vertical) / 2, v: (vertical - horizontal) / 2 };
  };
  const corners = edge => [[-edge, -edge], [edge, -edge], [edge, edge], [-edge, edge]].map(([u, v]) => project(u, v));
  const resetDrop = drop => {
    drop.u = (random() * 2 - 1) * .87; drop.v = (random() * 2 - 1) * .87;
    drop.phase = 0; drop.speed = .65 + random() * .65;
    drop.travel = .7 + random() * .65; drop.length = .045 + random() * .045;
  };
  const addRipple = (u, v, source = 'rain', age = 0) => {
    if (ripples.length >= LIMITS.ripples) {
      const rainIndex = ripples.findIndex(ripple => ripple.source === 'rain');
      ripples.splice(rainIndex < 0 ? 0 : rainIndex, 1);
    }
    ripples.push({ u, v, source, age, life: source === 'tap' ? 2.2 : 1.1 + random() * .65 });
  };
  const replenish = () => {
    drops.length = Math.min(drops.length, intensity);
    while (drops.length < intensity) {
      const drop = {}; resetDrop(drop); drop.phase = random(); drops.push(drop);
    }
  };
  const path = points => {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
  };
  const polygon = (points, fill, alpha = 1) => {
    ctx.globalAlpha = alpha; path(points); ctx.fillStyle = fill; ctx.fill(); ctx.globalAlpha = 1;
  };
  const patch = (points, fill, alpha) => polygon(points.map(([u, v]) => project(u, v)), fill, alpha);
  const rippleStyle = ripple => {
    const progress = clamp(ripple.age / ripple.life, 0, 1);
    return {
      radius: .018 + progress * (ripple.source === 'tap' ? .43 : .20),
      opacity: (1 - progress) ** 1.3 * (ripple.source === 'tap' ? .8 : .48),
    };
  };
  const advance = dt => {
    time += dt;
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age >= ripples[i].life) ripples.splice(i, 1);
    }
    for (const drop of drops) {
      drop.phase += dt * drop.speed;
      if (drop.phase >= 1) {
        addRipple(drop.u, drop.v);
        const overflow = drop.phase - 1;
        resetDrop(drop); drop.phase = overflow;
      }
    }
  };
  const drawPaper = colors => {
    // Painted scenery is drawn once by the separate backdrop canvas.
    if (sceneBackdrop) {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(17,40,47,.46)';
      ctx.fillRect(0, 0, width, height);
      return;
    }
    ctx.fillStyle = colors.paper; ctx.fillRect(0, 0, width, height);
    polygon([{ x: 0, y: height * .06 }, { x: width * .62, y: 0 }, { x: width, y: height * .21 }, { x: width, y: height * .26 }, { x: 0, y: height * .13 }], '#f7f1e5', .45);
    polygon([{ x: 0, y: height * .8 }, { x: width * .23, y: height * .89 }, { x: width * .72, y: height }, { x: 0, y: height }], '#d9d1bc', .12);
    ctx.fillStyle = '#978e77'; ctx.globalAlpha = .09;
    for (let i = 0; i < 78; i++) {
      const x = ((i * 97 + 29) % 283) / 283 * width;
      const y = ((i * 61 + 17) % 251) / 251 * height;
      ctx.fillRect(x, y, Math.max(.6, scale * .004), Math.max(.6, scale * .002));
    }
    ctx.globalAlpha = 1;
  };
  const drawPlatform = colors => {
    const top = corners(1), thickness = Math.max(3, scale * .1);
    const lowered = point => ({ x: point.x, y: point.y + thickness });
    // 地面阴影只用一块扁色形，保留纸面与台体的距离。
    polygon(top.map(point => ({ x: point.x + scale * .13, y: point.y + thickness + scale * .075 })), '#7b7566', .10);
    polygon([top[1], top[2], lowered(top[2]), lowered(top[1])], colors.right);
    polygon([top[2], top[3], lowered(top[3]), lowered(top[2])], colors.left);
    polygon(top, colors.rim);
    const water = corners(WATER_EDGE);
    polygon(water, colors.water);
    ctx.save(); path(water); ctx.clip();
    patch([[-1, -.92], [-.2, -.98], [.8, -.53], [.54, -.17], [-.9, -.48]], colors.wash, .30);
    patch([[-.6, -.15], [.57, -.28], [.94, .31], [.74, .59], [-.88, .24]], colors.wash, .15);
    patch([[-.96, .57], [-.25, .42], [.53, .8], [.9, .95], [-.89, .93]], colors.ink, .07);
    patch([[.28, -.94], [.93, -.72], [.94, -.62], [.34, -.84]], colors.light, .16);
    drawRipples(colors);
    ctx.restore();
    ctx.strokeStyle = colors.ink; ctx.lineWidth = Math.max(.7, scale * .0045); ctx.globalAlpha = .53;
    path(top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(top[3].x + 1, top[3].y + thickness * .82);
    ctx.lineTo(top[2].x - scale * .025, top[2].y + thickness * .87);
    ctx.lineTo(top[1].x - 1, top[1].y + thickness * .88); ctx.stroke();
    ctx.globalAlpha = .38; ctx.strokeStyle = colors.light;
    ctx.beginPath();
    const start = project(-.94, -.94), middle = project(.08, -.94), end = project(.88, -.94);
    ctx.moveTo(start.x, start.y + 1); ctx.lineTo(middle.x, middle.y - .6); ctx.lineTo(end.x, end.y); ctx.stroke();
    ctx.globalAlpha = 1;
  };
  const drawRipples = colors => {
    ctx.lineWidth = Math.max(.75, scale * .0042);
    for (const ripple of ripples) {
      const center = project(ripple.u, ripple.v), { radius, opacity } = rippleStyle(ripple);
      const echoes = ripple.source === 'tap' ? 3 : 2;
      for (let i = 0; i < echoes; i++) {
        const ring = Math.max(.008, radius - i * (ripple.source === 'tap' ? .05 : .022));
        ctx.globalAlpha = opacity * (1 - i * .25);
        ctx.strokeStyle = i ? colors.ink : colors.light; ctx.beginPath();
        ctx.ellipse(center.x, center.y, ring * sx * Math.SQRT2, ring * sy * Math.SQRT2, 0, .10 + i * .27, Math.PI * 2 - .08 - i * .11);
        ctx.stroke();
      }
      if (ripple.age < .14) {
        ctx.globalAlpha = opacity * .75; ctx.strokeStyle = colors.light; ctx.beginPath();
        ctx.moveTo(center.x - scale * .008, center.y - scale * .014);
        ctx.lineTo(center.x, center.y - scale * .04); ctx.lineTo(center.x + scale * .008, center.y - scale * .018); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };
  const drawRain = colors => {
    ctx.lineCap = 'round'; ctx.strokeStyle = colors.rain; ctx.lineWidth = Math.max(.65, scale * .004);
    for (const drop of drops) {
      const landing = project(drop.u, drop.v), distance = (1 - drop.phase) * drop.travel * scale;
      const x = landing.x - distance * .055, y = landing.y - distance;
      const length = Math.min(distance, drop.length * scale);
      ctx.globalAlpha = .23 + drop.phase * .28; ctx.beginPath();
      ctx.moveTo(x - length * .055, y - length); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const resize = (nextWidth, nextHeight) => {
    if (disposed) return false;
    width = Number.isFinite(nextWidth) ? Math.max(1, Math.round(nextWidth)) : 1;
    height = Number.isFinite(nextHeight) ? Math.max(1, Math.round(nextHeight)) : 1;
    scale = Math.max(.25, Math.min(width * .24, height * .36));
    sx = scale * .91; sy = scale * .405; cx = width * .5; cy = height * .60;
    if (canvas) { if (canvas.width !== width) canvas.width = width; if (canvas.height !== height) canvas.height = height; }
    return true;
  };
  const render = (dt = 0, animate = true) => {
    if (disposed || !ctx) return false;
    if (animate && Number.isFinite(dt) && dt > 0) advance(Math.min(dt, .1));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const colors = PALETTES[palette];
    drawPaper(colors);
    if (sceneBackdrop) drawRipples(colors);
    else drawPlatform(colors);
    drawRain(colors);
    ctx.restore(); return true;
  };
  const tap = (x, y) => {
    if (disposed || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (sceneBackdrop && (x < 0 || x > width || y < 0 || y > height)) return false;
    const { u, v } = unproject(x, y);
    if (!sceneBackdrop && (Math.abs(u) > 1 + 1e-9 || Math.abs(v) > 1 + 1e-9)) return false;
    addRipple(sceneBackdrop ? u : clamp(u, -1, 1), sceneBackdrop ? v : clamp(v, -1, 1), 'tap'); return true;
  };
  const setIntensity = value => {
    if (disposed || (value !== 40 && value !== 80)) return false;
    intensity = value; replenish(); return true;
  };
  const setPalette = value => {
    if (disposed || !Object.hasOwn(PALETTES, value)) return false;
    palette = value; return true;
  };
  const getDiagnostics = () => Object.freeze({
    width, height, time, intensity, palette, disposed, dropsCount: drops.length, ripplesCount: ripples.length, limits: LIMITS,
    surface: Object.freeze(corners(1).map(point => Object.freeze(point))),
    water: Object.freeze(corners(WATER_EDGE).map(point => Object.freeze(point))),
    drops: Object.freeze(drops.map(drop => Object.freeze({ landing: Object.freeze(project(drop.u, drop.v)), phase: drop.phase }))),
    ripples: Object.freeze(ripples.map(ripple => Object.freeze({ ...project(ripple.u, ripple.v), source: ripple.source, age: ripple.age, life: ripple.life, ...rippleStyle(ripple) }))),
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true; drops.length = 0; ripples.length = 0; ctx?.clearRect(0, 0, width, height);
  };
  resize(canvas?.width || 1, canvas?.height || 1); replenish();
  // 初帧与减少动效状态仍能看见雨圈，不依赖偷偷推进模拟。
  for (let i = 0; i < 14; i++) addRipple((random() * 2 - 1) * .82, (random() * 2 - 1) * .82, 'rain', .2 + random() * .65);
  return { resize, render, tap, setIntensity, setPalette, getDiagnostics, dispose };
}
