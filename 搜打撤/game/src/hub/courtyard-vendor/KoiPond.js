/* MIT Copyright (c) 2026 Rezaye Rabbi (RzX).
 * Adapted from rzrabbi/interactive-koi-pond @ d8e2b1527630dfb4cccf646c0d8266cd95e2bb4f.
 * Global wallpaper bridges, event listeners and animation loop removed; engine state is per canvas.
 * See koi-LICENSE.txt and SOURCE.md. */
import { Random } from '../../core/random.js';

export function createKoiPond(canvas, { onProgress = () => {}, random = () => Random.random('visual') } = {}) {
  const ctx = canvas.getContext('2d');
  const kois = [], foods = [], ripples = [];
  const LIMIT = 24, TAU = Math.PI * 2;
  const palettes = [
    ['#e6dfce', '#c46548', '#334746'],
    ['#dddcd0', '#b95643', '#43524d'],
    ['#ceb578', '#a97745', '#576157'],
    ['#c46c51', '#e5d9bc', '#3e4c47'],
  ];
  let width = Math.max(1, canvas.width), height = Math.max(1, canvas.height);
  let time = 0, disposed = false, cursor = null, lastRipple = -1, eaten = 0;
  const found = new Set();
  const progress = () => onProgress({ found: found.size, total: 9, eaten });
  const clamp = (value, lo, hi) => Math.min(Math.max(value, lo), hi);
  const angleDelta = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const addBounded = (list, value) => { if (list.length >= LIMIT) list.shift(); list.push(value); };
  const maxLength = () => Math.min(width * 0.055, height * 0.15);
  const waterBounds = () => {
    const inset = maxLength() * 1.05;
    return { left: width * 0.1 + inset, right: width * 0.9 - inset,
      top: height * 0.1 + inset, bottom: height * 0.9 - inset };
  };
  const keepInWater = point => {
    const b = waterBounds();
    point.x = clamp(point.x, b.left, b.right); point.y = clamp(point.y, b.top, b.bottom);
  };
  const rippleAt = (x, y, power = 1) => addBounded(ripples, { x, y, power, age: 0 });

  class Koi {
    constructor(index) {
      this.id = index;
      const b = waterBounds();
      this.x = b.left + random() * (b.right - b.left);
      this.y = b.top + random() * (b.bottom - b.top);
      this.angle = random() * TAU;
      this.phase = random() * TAU;
      this.wanderPhase = random() * TAU;
      this.ratio = 0.036 + random() * 0.018;
      this.pace = 0.011 + random() * 0.007;
      this.palette = palettes[index % palettes.length];
      this.bend = 0;
    }
    get length() { return Math.min(width * this.ratio, height * 0.15); }
    update(dt) {
      let target = null, nearest = Infinity;
      for (const food of foods) {
        const distance = Math.hypot(this.x - food.x, this.y - food.y);
        if (distance < nearest) { target = food; nearest = distance; }
      }
      const feeding = target && nearest < Math.max(width, height) * 0.7;
      const wander = this.angle + Math.sin(time * 0.32 + this.wanderPhase) * 0.65;
      let dx = feeding ? (target.x - this.x) / Math.max(nearest, 1) : Math.cos(wander);
      let dy = feeding ? (target.y - this.y) / Math.max(nearest, 1) : Math.sin(wander);
      const b = waterBounds(), lookahead = this.length * 1.4;
      // Turn before the shore; feeding shares the same safe swimming area.
      dx += clamp((b.left + lookahead - this.x) / lookahead, 0, 1) * 3;
      dx -= clamp((this.x - b.right + lookahead) / lookahead, 0, 1) * 3;
      dy += clamp((b.top + lookahead - this.y) / lookahead, 0, 1) * 3;
      dy -= clamp((this.y - b.bottom + lookahead) / lookahead, 0, 1) * 3;
      for (const other of kois) {
        if (other === this) continue;
        const ox = this.x - other.x, oy = this.y - other.y, distance = Math.hypot(ox, oy);
        if (distance > 0 && distance < this.length * 0.6) {
          const weight = (1 - distance / (this.length * 0.6)) * 0.5;
          dx += ox / distance * weight; dy += oy / distance * weight;
        }
      }
      if (cursor && !feeding) {
        const ox = this.x - cursor.x, oy = this.y - cursor.y, distance = Math.hypot(ox, oy);
        const reach = this.length * 2.5;
        if (distance > 0 && distance < reach) {
          const weight = (1 - distance / reach) * 2;
          dx += ox / distance * weight; dy += oy / distance * weight;
        }
      }
      const turn = clamp(angleDelta(Math.atan2(dy, dx), this.angle), -dt * 0.85, dt * 0.85);
      this.angle += turn;
      this.bend += (clamp(turn / Math.max(dt, 0.001), -0.8, 0.8) - this.bend) * Math.min(1, dt * 3);
      const speed = width * this.pace * (feeding ? 1.65 : 1);
      this.x += Math.cos(this.angle) * speed * dt;
      this.y += Math.sin(this.angle) * speed * dt;
      keepInWater(this);
      this.phase += dt * (feeding ? 2.5 : 1.65);
      if (feeding && nearest < Math.max(4, this.length * 0.16)) {
        foods.splice(foods.indexOf(target), 1); rippleAt(this.x, this.y, 0.55);
        eaten++; progress();
      }
    }
    spine(t) {
      return { x: -t * 0.82,
        y: (Math.sin(this.phase - t * 2.8) * 0.032 + this.bend * 0.13) * t * t };
    }
    bodyPoints() {
      const widths = [0.035, 0.087, 0.105, 0.086, 0.052, 0.023, 0.009];
      const spine = widths.map((_, i) => this.spine(i / (widths.length - 1)));
      const side = sign => widths.map((w, i) => ({ x: spine[i].x, y: spine[i].y + w * sign }));
      return [...side(-1), ...side(1).reverse()];
    }
    bodyPath(points) {
      ctx.beginPath(); ctx.moveTo((points.at(-1).x + points[0].x) / 2, 0);
      for (let i = 0; i < points.length; i++) {
        const p = points[i], next = points[(i + 1) % points.length];
        ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
      }
      ctx.closePath();
    }
    patch(t, size, color, offset = 0) {
      const p = this.spine(t);
      ctx.beginPath(); ctx.moveTo(p.x + size * 0.55, p.y + offset);
      ctx.bezierCurveTo(p.x + size * 0.4, p.y - size * 0.65 + offset,
        p.x - size * 0.25, p.y - size * 0.8 + offset, p.x - size * 0.6, p.y - size * 0.22 + offset);
      ctx.bezierCurveTo(p.x - size * 0.75, p.y + size * 0.38 + offset,
        p.x + size * 0.2, p.y + size * 0.7 + offset, p.x + size * 0.55, p.y + offset);
      ctx.fillStyle = color; ctx.fill();
    }
    draw() {
      const length = this.length, fin = this.spine(0.25), tail = this.spine(1);
      // Shadow and body use the same pose; keep this projection local to this draw.
      const body = this.bodyPoints();
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); ctx.scale(length, length);
      // A shallow blue-grey shadow separates the fish from the painted stone bed.
      ctx.save(); ctx.translate(0.025, 0.038); this.bodyPath(body);
      ctx.fillStyle = 'rgba(40,66,65,0.16)'; ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(220,218,189,0.48)';
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(fin.x + 0.04, fin.y + side * 0.065);
        ctx.quadraticCurveTo(fin.x - 0.035, fin.y + side * 0.19, fin.x - 0.15, fin.y + side * 0.15);
        ctx.quadraticCurveTo(fin.x - 0.11, fin.y + side * 0.08, fin.x + 0.04, fin.y + side * 0.065);
        ctx.fill();
      }
      const tailSwing = Math.sin(this.phase - 2.8) * 0.055;
      ctx.beginPath(); ctx.moveTo(tail.x + 0.025, tail.y);
      ctx.quadraticCurveTo(tail.x - 0.06, tail.y - 0.07, -1, tail.y - 0.1 + tailSwing);
      ctx.quadraticCurveTo(-0.97, tail.y - 0.025 + tailSwing, -0.94, tail.y + tailSwing);
      ctx.quadraticCurveTo(-0.98, tail.y + 0.055 + tailSwing, -1, tail.y + 0.11 + tailSwing);
      ctx.quadraticCurveTo(tail.x - 0.035, tail.y + 0.07, tail.x + 0.025, tail.y);
      ctx.fillStyle = 'rgba(219,216,185,0.63)'; ctx.fill();
      this.bodyPath(body); ctx.fillStyle = this.palette[0]; ctx.fill();
      ctx.save(); ctx.clip();
      this.patch(0.19, 0.12, this.palette[1], -0.015);
      this.patch(0.54, 0.11, this.palette[1], 0.025);
      this.patch(0.73, 0.055, this.palette[2], -0.012);
      ctx.beginPath(); ctx.moveTo(-0.03, -0.023);
      ctx.quadraticCurveTo(-0.22, -0.048, -0.44, this.spine(0.54).y - 0.027);
      ctx.lineWidth = 0.012; ctx.strokeStyle = 'rgba(250,241,206,0.32)'; ctx.stroke();
      ctx.restore();
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.arc(-0.043, side * 0.036, 0.009, 0, TAU);
        ctx.fillStyle = '#293c3c'; ctx.fill();
      }
      ctx.restore();
    }
  }

  const populate = () => { for (let i = 0; i < 9; i++) kois.push(new Koi(i)); };
  populate();
  progress();
  return {
    resize(w, h) {
      if (disposed || !Number.isFinite(w) || !Number.isFinite(h)) return;
      const nextW = Math.max(1, w), nextH = Math.max(1, h), sx = nextW / width, sy = nextH / height;
      width = nextW; height = nextH;
      for (const point of [...kois, ...foods, ...ripples]) {
        point.x *= sx; point.y *= sy; keepInWater(point);
      }
      cursor = null;
    },
    pointer(x, y) {
      if (disposed) return;
      if (!Number.isFinite(x) || !Number.isFinite(y)) { cursor = null; return; }
      const b = waterBounds();
      if (x < b.left || x > b.right || y < b.top || y > b.bottom) { cursor = null; return; }
      cursor = { x, y };
      if (time - lastRipple >= 0.18) { rippleAt(x, y, 0.45); lastRipple = time; }
      let changed = false;
      for (const fish of kois) {
        if (!found.has(fish.id) && Math.hypot(fish.x - x, fish.y - y) < fish.length) {
          found.add(fish.id); changed = true;
        }
      }
      if (changed) progress();
    },
    tap(x, y) {
      if (disposed || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const food = { x, y, age: 0 }; keepInWater(food);
      addBounded(foods, food); rippleAt(food.x, food.y);
    },
    reset() { if (disposed) return; kois.length = foods.length = ripples.length = 0; time = eaten = 0; cursor = null; lastRipple = -1; found.clear(); populate(); progress(); },
    render(dt = 0, animate = true) {
      if (disposed) return;
      const step = animate && Number.isFinite(dt) ? clamp(dt, 0, 0.05) : 0;
      time += step;
      ctx.clearRect(0, 0, width, height);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      // Soft moving reflections remain inside the water; static mode freezes them.
      for (let i = 0; i < 6; i++) {
        const x = width * (0.22 + i * 0.1), y = height * (0.3 + Math.sin(time * 0.2 + i * 1.7) * 0.15);
        ctx.beginPath(); ctx.moveTo(x - width * 0.025, y);
        ctx.quadraticCurveTo(x, y - height * 0.012, x + width * 0.025, y);
        ctx.lineWidth = Math.max(0.5, width * 0.0006);
        ctx.strokeStyle = 'rgba(235,244,215,0.12)'; ctx.stroke();
      }
      for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i]; food.age += step;
        if (food.age >= 16) { foods.splice(i, 1); continue; }
        ctx.beginPath(); ctx.arc(food.x, food.y, Math.max(1.2, width * 0.0014), 0, TAU);
        ctx.globalAlpha = Math.min(1, (16 - food.age) / 4);
        ctx.fillStyle = '#d7aa66'; ctx.fill(); ctx.globalAlpha = 1;
      }
      for (const fish of kois) { if (step) fish.update(step); fish.draw(); }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i]; ripple.age += step;
        if (ripple.age >= 2.4) { ripples.splice(i, 1); continue; }
        const progress = ripple.age / 2.4;
        ctx.beginPath(); ctx.arc(ripple.x, ripple.y, 2 + progress * width * 0.055 * ripple.power, 0, TAU);
        ctx.lineWidth = Math.max(0.6, width * 0.0008);
        ctx.strokeStyle = `rgba(225,237,218,${(1 - progress) * 0.26})`; ctx.stroke();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true; cursor = null; found.clear(); kois.length = foods.length = ripples.length = 0;
      ctx.clearRect(0, 0, width, height);
    },
  };
}
