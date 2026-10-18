// Stage coordinates stay logical; only the output surface follows device pixels.
const positive = value => Number.isFinite(value) && value > 0;
export function frameResolutionFor(dpr, scale, cap) {
  const density = (positive(dpr) ? dpr : 1) * (positive(scale) ? scale : 1);
  return Math.min(positive(cap) ? cap : 1, positive(density) ? density : 1);
}

// Pixi 7's resolution setter does not resize. Never reuse renderer.screen here:
// Pixi derives it from rounded backing dimensions, which can accumulate drift.
export function resizeFrameSurface(renderer, resolution, width, height) {
  if (!renderer || typeof renderer.resize !== 'function'
      || !positive(resolution) || !positive(width) || !positive(height)) return false;
  const pixelWidth = Math.round(width * resolution);
  const pixelHeight = Math.round(height * resolution);
  if (!Number.isSafeInteger(pixelWidth) || !Number.isSafeInteger(pixelHeight) || pixelWidth < 1 || pixelHeight < 1) return false;
  if (renderer.resolution === resolution && renderer.width === pixelWidth && renderer.height === pixelHeight) return false;
  renderer.resolution = resolution;
  renderer.resize(width, height);
  return true;
}
