// 城市残影烘焙进背景；单处环境轮廓另存透明缓存，缩放时只合成现有图像。
import { mapImageReady } from './map-image-ready.js';
import { mapLayerAtmosphere } from './map-layer-atmosphere.js';
const environmentUrls = [
  new URL('../../assets/scenes/map-environment-1021/outskirts-simple.webp',import.meta.url).href,
  new URL('../../assets/scenes/map-environment-1021/watchline-simple.webp',import.meta.url).href,
  new URL('../../assets/scenes/map-environment-1021/ruins-simple.webp',import.meta.url).href,
  new URL('../../assets/scenes/map-environment-1021/core-simple.webp',import.meta.url).href,
];
export function createMapCityAtmosphere(onReady) {
  const props = new Image();
  props.decoding = 'async';
  props.onload = onReady;
  props.src = new URL('../../assets/scenes/map-nodes/city-ghost-props-a-1012.webp', import.meta.url).href;
  const environments = environmentUrls.map(url => {
    const image = new Image(); image.decoding = 'async'; image.onload = onReady; image.src = url;
    return image;
  });
  const environmentPaint = new Map();

  function drawEnvironment(ctx, w, h, layer = 0, zoom = 1) {
    const index = environmentUrls[layer] ? layer : 0;
    const image = environments[index];
    if (!image.complete || !image.naturalWidth) return;
    let paint = environmentPaint.get(index);
    if (!paint) {
      paint = document.createElement('canvas');
      paint.width = image.naturalWidth; paint.height = image.naturalHeight;
      const b = paint.getContext('2d');
      if (!b) return;
      b.filter = mapLayerAtmosphere(index).propsFilter;
      b.drawImage(image,0,0); b.filter = 'none';
      // 只柔化这一处装饰的下缘，不把整张地图或节点一起蒙暗。
      const fade = b.createLinearGradient(0,paint.height*.48,0,paint.height*.90);
      fade.addColorStop(0,'rgba(0,0,0,1)');
      fade.addColorStop(.50,'rgba(0,0,0,.65)');
      fade.addColorStop(1,'rgba(0,0,0,0)');
      b.globalCompositeOperation = 'destination-in';
      b.fillStyle = fade; b.fillRect(0,0,paint.width,paint.height);
      environmentPaint.set(index,paint);
    }
    const s = Math.min(w/1440,h/900);
    // 全景下随路线适度缩小，保留可辨识轮廓；原背景雾与城市远影不随镜头变化。
    const zoomScale = Math.max(.60,Math.min(1,Math.sqrt(Math.max(.01,zoom))));
    const width = 480*s*zoomScale, inset = (480*s-width)/2;
    ctx.save(); ctx.globalAlpha *= .34;
    ctx.drawImage(paint,w-475*s+inset,h*.15+inset*.5,width,width*paint.height/paint.width);
    ctx.restore();
  }

  function drawMapCityAtmosphere(ctx, w, h, layer = 0) {
    if (!props.complete || !props.naturalWidth) return;
    const s = Math.min(w / 1440, h / 900);
    const sw = Math.floor(props.naturalWidth / 2);
    const sh = Math.ceil(props.naturalHeight / 2);
    ctx.save();
    const profile = mapLayerAtmosphere(layer);
    ctx.filter = profile.propsFilter;
    const place = (col, row, x, y, width, alpha) => {
      ctx.globalAlpha = alpha;
      const cropW = col ? props.naturalWidth - sw : sw;
      const cropH = row ? props.naturalHeight - sh : sh;
      ctx.drawImage(props, col * sw, row * sh, cropW, cropH,
        x, y, width, width * cropH / cropW);
    };
    const environment = environments[layer] || environments[0];
    const ready = environment.complete && environment.naturalWidth > 0;
    // 每层只替换右上方一处残影；左下方恢复原有淡城市背景，不镜像复制新素材。
    profile.props.forEach(([col,row,x,y,width,alpha], index) => {
      if (ready && index === 1) return;
      place(col,row,w*x,h*y,width*s,ready ? alpha*(index === 2 ? .45 : .65) : alpha);
    });
    ctx.restore();
  };
  drawMapCityAtmosphere.ready = () => Promise.all([props,...environments].map(image => mapImageReady(image)));
  drawMapCityAtmosphere.drawEnvironment = drawEnvironment;
  return drawMapCityAtmosphere;
}
