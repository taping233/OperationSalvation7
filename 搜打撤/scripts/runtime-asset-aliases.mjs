import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CHEST_RIGS = Object.freeze(['small', 'medium', 'large', 'class', 'boss']);
const IDENTICAL_FRAME_CANDIDATES = Object.freeze([['01', '00'], ['02', '00'], ['17', '16']]);

// These frames are statically referenced by new URL in chests.js. Preserve all
// timeline entries and source files; only their published URLs may share bytes.
// Re-check equality for each build so a newly redrawn frame retains its own URL.
export function collectVerifiedChestFrameAliases(assetsRoot) {
  const aliases = new Map();
  for (const rig of CHEST_RIGS) {
    for (const [frame, canonicalFrame] of IDENTICAL_FRAME_CANDIDATES) {
      const relative = `scenes/chests/${rig}-rig-640-v1/frame-${frame}.webp`;
      const canonical = `scenes/chests/${rig}-rig-640-v1/frame-${canonicalFrame}.webp`;
      const sourcePath = path.join(assetsRoot, ...relative.split('/'));
      const canonicalPath = path.join(assetsRoot, ...canonical.split('/'));
      if (existsSync(sourcePath) && existsSync(canonicalPath)
        && readFileSync(sourcePath).equals(readFileSync(canonicalPath))) {
        aliases.set(relative, canonical);
      }
    }
  }
  return aliases;
}

// Both sprite consumers call assetUrl(): the dynamic animation frame URL and
// the neutral fallback. Vite-static portrait references use the same target.
export function collectVerifiedRuntimeAssetAliases(assetsRoot) {
  const aliases = collectVerifiedChestFrameAliases(assetsRoot);
  const canonical = 'portraits/battle/changwuyu.webp';
  const canonicalPath = path.join(assetsRoot, ...canonical.split('/'));
  if (!existsSync(canonicalPath)) return aliases;
  const canonicalBytes = readFileSync(canonicalPath);
  for (const frame of ['f000', 'neutral']) {
    const relative = `portraits/frames/changwuyu/sprite-v1/${frame}.webp`;
    const sourcePath = path.join(assetsRoot, ...relative.split('/'));
    if (existsSync(sourcePath) && readFileSync(sourcePath).equals(canonicalBytes)) aliases.set(relative, canonical);
  }
  return aliases;
}
