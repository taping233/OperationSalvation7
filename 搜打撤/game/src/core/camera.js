import { renderScheduler } from './render-scheduler.js';
import { ease } from './motion-primitives.js';

  const SDT = window.SDT;

  function Camera(map, viewW, viewH) {
    this.map = map;
    this.viewW = viewW;
    this.viewH = viewH;
    this.cx = map.cols * map.tile / 2; // 视野中心（世界坐标）
    this.cy = map.rows * map.tile / 2;
    this.zoom = 1;
    this.frameMode = 'routes';
    this.detailInset = 0;
  }

  Camera.prototype.resize = function (w, h) {
    this.viewW = w; this.viewH = h;
  };

  Camera.prototype.screenToWorld = function (sx, sy) {
    return {
      x: (sx - this.viewW / 2) / this.zoom + this.cx,
      y: (sy - this.viewH / 2) / this.zoom + this.cy,
    };
  };

  Camera.prototype.worldToScreen = function (wx, wy) {
    return {
      x: (wx - this.cx) * this.zoom + this.viewW / 2,
      y: (wy - this.cy) * this.zoom + this.viewH / 2,
    };
  };

  Camera.prototype.panBy = function (dx, dy) { // 屏幕像素位移
    this._stopGlide();
    this.frameMode = 'manual';
    this.cx -= dx / this.zoom;
    this.cy -= dy / this.zoom;
    this.clamp();
  };

  Camera.prototype.zoomAt = function (sx, sy, factor) { // 以屏幕点 (sx,sy) 为锚缩放
    this._stopGlide();
    this.frameMode = 'manual';
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.min(2.45, Math.max(0.08, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
    this.clamp();
  };

  Camera.prototype.clamp = function () {
    const m = 160; // 允许超出地图边缘的空白余量（世界像素，按 zoom 换算到屏幕）
    const mapW = this.map.cols * this.map.tile;
    const mapH = this.map.rows * this.map.tile;
    // Edge routes must be able to sit at the centre of the screen as well.
    this.cx = Math.min(mapW + m, Math.max(-m, this.cx));
    this.cy = Math.min(mapH + m, Math.max(-m, this.cy));
  };

  Camera.prototype.focus = function (x, y) {
    this._stopGlide();
    this.cx = Number.isFinite(x) ? x : this.cx;
    this.cy = Number.isFinite(y) ? y : this.cy;
    this.clamp();
  };

  /* ---- 镜头补间（2026-09-27 动效补全）：取景切换不再硬切 ----
   * glideTo 在 rAF 里对 cx/cy/zoom 做对称 S 缓动（起停都在静止，onetake「一镜到底」形制），
   * 每帧 invalidate 保持重绘；任何手动操作（panBy/zoomAt/focus）立即挂断补间。
   * 无 rAF（测试/node）或减动效时退化为直接贴合。 */
  Camera.prototype._stopGlide = function () {
    if (this._glide) { this._glide.dead = true; this._glide = null; }
  };

  Camera.prototype.glideTo = function (tx, ty, { zoom, dur = 460 } = {}) {
    this._stopGlide();
    const from = { cx: this.cx, cy: this.cy, zoom: this.zoom };
    const to = {
      cx: Number.isFinite(tx) ? tx : from.cx,
      cy: Number.isFinite(ty) ? ty : from.cy,
      zoom: Number.isFinite(zoom) ? Math.min(3.4, Math.max(0.08, zoom)) : from.zoom,
    };
    if (!(dur > 0) || typeof requestAnimationFrame !== 'function' || SDT.Motion?.reduceMotion?.()) {
      this.zoom = to.zoom; this.focus(to.cx, to.cy);
      return;
    }
    const token = {};
    this._glide = token;
    const t0 = performance.now();
    const tick = (now) => {
      if (token.dead || this._glide !== token) return;
      const k = ease.cubicInOut(Math.min(1, (now - t0) / dur));
      this.cx = from.cx + (to.cx - from.cx) * k;
      this.cy = from.cy + (to.cy - from.cy) * k;
      this.zoom = from.zoom + (to.zoom - from.zoom) * k;
      this.clamp();
      if (now - t0 < dur) renderScheduler.invalidateAnimation();
      else renderScheduler.invalidate();
      if (now - t0 < dur) requestAnimationFrame(tick);
      else if (this._glide === token) this._glide = null;
    };
    requestAnimationFrame(tick);
  };

  Camera.prototype.fitBounds = function (bounds, padding = 96) {
    if (!bounds || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) ||
        !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) return false;
    const pad = Math.max(0, padding);
    const w = Math.max(1, bounds.maxX - bounds.minX + pad * 2);
    const h = Math.max(1, bounds.maxY - bounds.minY + pad * 2);
    this.zoom = Math.min(2.45, Math.max(0.4, Math.min(this.viewW / w, this.viewH / h)));
    this.focus((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
    return true;
  };

  Camera.prototype.fitLayer = function (game, padding = 96) {
    const points = game && game.nodePos && game.nodePos[game.layerIdx];
    if (!points || !points.length) return false;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (!p) continue;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    return this.fitBounds({ minX, minY, maxX, maxY }, padding);
  };

  // Reserve a side panel without changing world coordinates, hit testing or legal nodes.
  Camera.prototype.setDetailInset = function (width) {
    const next = Math.min(this.viewW * .38, Math.max(0, Number(width) || 0));
    const old = this.detailInset || 0;
    if (next === old) return;
    this._stopGlide();
    this.cx += (next - old) / (2 * this.zoom);
    this.detailInset = next;
    this.clamp();
    renderScheduler.invalidate();
  };

  Camera.prototype.frameExploration = function (game, overview = false, opts = null) {
    const li = game?.layerIdx;
    const points = game?.nodePos?.[li];
    const current = game?.layerData?.[li]?.logical?.[game.trackPos];
    if (!points?.length || !current) return false;
    const indices = new Set([game.trackPos]);
    for (const [nl, idx] of current.next || []) if (nl === li) indices.add(idx);
    // Full-layer framing changes only the camera: the renderer retains fog silhouettes
    // and the input path still rejects unknown nodes. Never mutate seen/visited here.
    if (overview) points.forEach((p, idx) => { if (p) indices.add(idx); });
    const visible = [...indices].map(idx => points[idx]).filter(Boolean);
    if (!visible.length) return false;
    const minX = Math.min(...visible.map(p => p.x)), maxX = Math.max(...visible.map(p => p.x));
    const minY = Math.min(...visible.map(p => p.y)), maxY = Math.max(...visible.map(p => p.y));
    // Badges and HUD use screen-space size, so world-space padding alone clips
    // names/statuses at the bottom. Reserve their envelope before fitting centres.
    const availableW = this.viewW - (this.detailInset || 0);
    const unit = this.viewW / 1280;
    const side = Math.min(availableW * .16, 120 * unit);
    const top = Math.min(this.viewH * .23, 105 * unit);
    const bottom = Math.min(this.viewH * .30, 190 * unit);
    const safeW = Math.max(1, availableW - side * 2);
    const safeH = Math.max(1, this.viewH - top - bottom);
    const zoom = Math.min(overview ? 2.45 : 3.4, Math.max(.08, Math.min(
      safeW / Math.max(1, maxX - minX), safeH / Math.max(1, maxY - minY))));
    const cx = (minX + maxX) / 2 + (this.detailInset || 0) / (2 * zoom);
    const cy = (minY + maxY) / 2 + (bottom - top) / (2 * zoom);
    // 显式定位默认同步落定；需要过渡的入口传入 glide。
    if (opts?.glide) this.glideTo(cx, cy, { zoom, dur: opts.dur });
    else { this._stopGlide(); this.zoom = zoom; this.cx = cx; this.cy = cy; }
    this.frameMode = overview ? 'overview' : 'routes';
    return true;
  };

  // Travel owns the camera until arrival; manual input cancels that ownership.
  Camera.prototype.beginTravel = function () {
    this._stopGlide();
    const motion = { mode: this.frameMode, cx: this.cx, cy: this.cy, zoom: this.zoom };
    this.frameMode = 'travel';
    return motion;
  };

  Camera.prototype.updateTravel = function (motion, point, ahead, deltaMs) {
    if (!motion || this.frameMode !== 'travel') return;
    const inset = this.detailInset || 0, w = this.viewW - inset;
    const screen = this.worldToScreen(ahead.x, ahead.y);
    // Keep the player and a short look-ahead in a comfortable area, at fixed zoom.
    const dx = screen.x < w * .22 ? screen.x - w * .22 : screen.x > w * .78 ? screen.x - w * .78 : 0;
    const dy = screen.y < this.viewH * .24 ? screen.y - this.viewH * .24 : screen.y > this.viewH * .74 ? screen.y - this.viewH * .74 : 0;
    const k = 1 - Math.exp(-Math.min(64, Math.max(0, deltaMs)) / 85);
    this.cx += dx / this.zoom * k;
    this.cy += dy / this.zoom * k;
    // Large routes must not let the real position fall beyond the visible margins.
    const actual = this.worldToScreen(point.x, point.y);
    this.cx += (actual.x - Math.max(w * .12, Math.min(w * .88, actual.x))) / this.zoom;
    this.cy += (actual.y - Math.max(this.viewH * .14, Math.min(this.viewH * .86, actual.y))) / this.zoom;
    this.clamp();
  };

  Camera.prototype.endTravel = function (motion, game, animate = true) {
    if (!motion || this.frameMode !== 'travel') return;
    this.frameMode = motion.mode;
    if (motion.mode !== 'routes') return;
    const current = game.layerData?.[game.layerIdx]?.logical?.[game.trackPos];
    const points = [game.trackPos, ...(current?.next || []).filter(([li]) => li === game.layerIdx).map(([, idx]) => idx)]
      .map(idx => game.nodePos?.[game.layerIdx]?.[idx]).filter(Boolean);
    const availableW = this.viewW - (this.detailInset || 0);
    const outside = points.some(p => {
      const screen = this.worldToScreen(p.x, p.y);
      return screen.x < availableW * .1 || screen.x > availableW * .9 ||
        screen.y < this.viewH * .12 || screen.y > this.viewH * .88;
    });
    if (!outside) return;
    // Only an off-screen next decision changes framing; never zoom in at every stop.
    const from = { cx: this.cx, cy: this.cy, zoom: this.zoom };
    this.frameExploration(game);
    const zoom = Math.min(from.zoom, this.zoom);
    const cx = this.cx, cy = this.cy;
    Object.assign(this, from);
    if (animate) this.glideTo(cx, cy, { zoom, dur: 180 });
    else { this.zoom = zoom; this.focus(cx, cy); }
  };

  // 世界空间命中半径：覆盖节点圆盘，同时保证低缩放下至少有稳定的屏幕目标尺寸。
  const nodeHitRadius = (zoom, minScreenPx = 28, minWorldPx = 34) =>
    Math.max(minWorldPx, minScreenPx / Math.max(0.4, Number(zoom) || 1));

  SDT.Camera = Camera;

export { nodeHitRadius };
