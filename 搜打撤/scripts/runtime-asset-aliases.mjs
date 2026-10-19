import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const CHEST_RIG_FORMATS = Object.freeze(['rig-640-v1', 'rig-v1']);
const CHEST_RIGS = Object.freeze(['small', 'medium', 'large', 'class', 'boss']);
const IDENTICAL_FRAME_CANDIDATES = Object.freeze([['01', '00'], ['02', '00'], ['17', '16']]);

// Legacy rig frames still enter the copied asset/preload output. The active
// chest timeline uses safe-simple-v7 in chest-opening-art.js instead. Preserve
// all source files; both legacy resolutions share only verified equal pairs'
// published bytes. Frames from different resolutions never alias each other.
// Re-check equality for each build so a newly redrawn frame retains its own URL.
export function collectVerifiedChestFrameAliases(assetsRoot) {
  const aliases = new Map();
  for (const rig of CHEST_RIGS) for (const format of CHEST_RIG_FORMATS) {
    for (const [frame, canonicalFrame] of IDENTICAL_FRAME_CANDIDATES) {
      const relative = `scenes/chests/${rig}-${format}/frame-${frame}.webp`;
      const canonical = `scenes/chests/${rig}-${format}/frame-${canonicalFrame}.webp`;
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

// Both sprite consumers call assetUrl(). Rations also have separate original
// and thumbnail byte pairs; neither pair aliases when redrawn or missing.
export function collectVerifiedRuntimeAssetAliases(assetsRoot) {
  const aliases = collectVerifiedChestFrameAliases(assetsRoot);
  const candidates = [
    ['portraits/frames/changwuyu/sprite-v1/f000.webp', 'portraits/battle/changwuyu.webp'],
    ['portraits/frames/changwuyu/sprite-v1/neutral.webp', 'portraits/battle/changwuyu.webp'],
    ['cards/expedition-starters/rations.webp', 'cards/resources/ration.webp'],
    ['thumbs/cards/expedition-starters/rations.webp', 'thumbs/cards/resources/ration.webp'],
  ];
  for (const [relative, canonical] of candidates) {
    const sourcePath = path.join(assetsRoot, ...relative.split('/'));
    const canonicalPath = path.join(assetsRoot, ...canonical.split('/'));
    if (existsSync(sourcePath) && existsSync(canonicalPath)
      && readFileSync(sourcePath).equals(readFileSync(canonicalPath))) aliases.set(relative, canonical);
  }
  return aliases;
}
