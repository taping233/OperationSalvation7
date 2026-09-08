  const SDT = window.SDT;

  function Camera(map, viewW, viewH) {
    this.map = map;
    this.viewW = viewW;
    this.viewH = viewH;
    this.cx = map.cols * map.tile / 2; // 视野中心（世界坐标）
    this.cy = map.rows * map.tile / 2;
    this.zoom = 1;
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
    this.cx -= dx / this.zoom;
    this.cy -= dy / this.zoom;
    this.clamp();
  };

  Camera.prototype.zoomAt = function (sx, sy, factor) { // 以屏幕点 (sx,sy) 为锚缩放
    const before = this.screenToWorld(sx, sy);
    this.zoom = Math.min(2.5, Math.max(0.4, this.zoom * factor));
    const after = this.screenToWorld(sx, sy);
    this.cx += before.x - after.x;
    this.cy += before.y - after.y;
    this.clamp();
  };

  Camera.prototype.clamp = function () {
    const m = 160; // 允许超出地图边缘的空白余量（世界像素，按 zoom 换算到屏幕）
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom;
    const mapW = this.map.cols * this.map.tile;
    const mapH = this.map.rows * this.map.tile;
    this.cx = halfW * 2 >= mapW + m * 2 ? mapW / 2 : Math.min(mapW + m - halfW, Math.max(-m + halfW, this.cx));
    this.cy = halfH * 2 >= mapH + m * 2 ? mapH / 2 : Math.min(mapH + m - halfH, Math.max(-m + halfH, this.cy));
  };

  Camera.prototype.focus = function (x, y) {
    this.cx = Number.isFinite(x) ? x : this.cx;
    this.cy = Number.isFinite(y) ? y : this.cy;
    this.clamp();
  };

  Camera.prototype.fitBounds = function (bounds, padding = 96) {
    if (!bounds || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.maxX) ||
        !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxY)) return false;
    const pad = Math.max(0, padding);
    const w = Math.max(1, bounds.maxX - bounds.minX + pad * 2);
    const h = Math.max(1, bounds.maxY - bounds.minY + pad * 2);
    this.zoom = Math.min(2.5, Math.max(0.4, Math.min(this.viewW / w, this.viewH / h)));
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

  // 世界空间命中半径：覆盖节点圆盘，同时保证低缩放下至少有稳定的屏幕目标尺寸。
  const nodeHitRadius = (zoom, minScreenPx = 28, minWorldPx = 34) =>
    Math.max(minWorldPx, minScreenPx / Math.max(0.4, Number(zoom) || 1));

  SDT.Camera = Camera;

export { SDT, nodeHitRadius };
