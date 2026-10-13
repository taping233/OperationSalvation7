// 老板选定的透明城市残影只烘焙进背景，不参与节点或每帧调度。
export function createMapCityAtmosphere(onReady) {
  const props = new Image();
  props.decoding = 'async';
  props.onload = onReady;
  props.src = new URL('../../assets/scenes/map-nodes/city-ghost-props-a-1012.webp', import.meta.url).href;

  return function drawMapCityAtmosphere(ctx, w, h) {
    if (!props.complete || !props.naturalWidth) return;
    const s = Math.min(w / 1440, h / 900);
    const sw = Math.floor(props.naturalWidth / 2);
    const sh = Math.ceil(props.naturalHeight / 2);
    ctx.save();
    ctx.globalAlpha = .26;
    const place = (col, row, x, y, width) => {
      const cropW = col ? props.naturalWidth - sw : sw;
      const cropH = row ? props.naturalHeight - sh : sh;
      ctx.drawImage(props, col * sw, row * sh, cropW, cropH,
        x, y, width, width * cropH / cropW);
    };
    // 四个独立道具留在外围，光雾与暗形都沿原画透明度淡入背景。
    place(0, 0, w * .015, h * .22, 330 * s);
    place(1, 0, w - 360 * s, h * .13, 360 * s);
    place(0, 1, w * .11, h * .65, 320 * s);
    place(1, 1, w - 375 * s, h * .60, 360 * s);
    ctx.restore();
  };
}
