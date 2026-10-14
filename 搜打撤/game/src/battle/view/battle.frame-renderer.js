// pixi.js 7 只带 WebGL renderer；无 WebGL 时才加载同版本的官方 Canvas 实现。
// 不缓存失败 Promise：初始化失败仍由 frame host 的原清理/重试路径接管。
export async function loadFrameRenderer() {
  const pixi = await import('pixi.js');
  if (pixi.utils.isWebGLSupported()) return pixi;
  return import('pixi.js-legacy');
}
