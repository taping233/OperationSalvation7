// Explicit session-local diagnostic; normal and production URLs keep frame playback.
export function framesDiagnosticStatic(dev, search) {
  if (dev !== true) return false;
  const query = new URLSearchParams(search || '');
  return query.get('perfProbe') === '1' && query.get('flightRecord') === '1'
    && query.get('framesDiagnostic') === 'static';
}

// Logical retained texture pixels, not GPU allocation or process RSS. No loading.
export function summarizeFrameTextures(records) {
  const bases = new Set();
  let textureCount = 0, basePixels = 0;
  for (const record of records) {
    textureCount += record.set.size;
    for (const texture of record.set.values()) {
      const base = texture?.baseTexture;
      if (!base || bases.has(base)) continue;
      bases.add(base);
      const width = Number(base.realWidth), height = Number(base.realHeight);
      if (Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0
        && Number.isSafeInteger(width * height) && Number.isSafeInteger(basePixels + width * height)) basePixels += width * height;
    }
  }
  return { textureCount, baseTextures: bases.size, basePixels,
    rgbaEstimateBytes: Math.min(Number.MAX_SAFE_INTEGER, basePixels * 4) };
}
