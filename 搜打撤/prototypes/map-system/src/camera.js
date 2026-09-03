/* ============================================================
 * 搜打撤 v0.1 —— 摄像机
 * 世界坐标（像素）与屏幕坐标互转；拖拽平移、滚轮缩放（指向光标）、边界钳制。
 * ============================================================ */
(function () {
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

  SDT.Camera = Camera;
})();
