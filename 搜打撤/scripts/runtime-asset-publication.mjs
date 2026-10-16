import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// These libraries belong to the development audition page, not sound.js.
// Keep their source files and retain a whole library if a production module
// starts referencing it, including an asynchronously loaded module.
export const DEVELOPMENT_SFX_PREFIXES = Object.freeze([
  'sfx/alternatives/',
  'sfx/winter-v5/',
  'sfx/winter-v6-ten/',
]);

const posix = value => String(value || '').replace(/\\/g, '/');

// Runtime strings and JSON paths bypass Vite's static URL rewriting.
// Keep the whole UI family: card frames, guide illustrations, mail and HUD art.
export const RUNTIME_ASSET_DIRS = Object.freeze([
  'cards', 'portraits', 'icons', 'scenes', 'thumbs', 'ui', 'battle', 'sfx',
]);

export function collectUnreferencedDevelopmentSfxPrefixes(modules, assetsRoot) {
  // A missing Rollup graph is inconclusive, so preserve every asset.
  if (!modules) return new Set();
  const root = posix(assetsRoot).replace(/\/$/, '');
  const records = Array.from(modules);
  return new Set(DEVELOPMENT_SFX_PREFIXES.filter(prefix => {
    const directory = prefix.slice('sfx/'.length, -1);
    const quotedDirectory = new RegExp(`(["'\x60])${directory}(?:/|\\1)`);
    return !records.some(module => {
      const id = posix(module?.id);
      const code = module?.code || '';
      return id.startsWith(`${root}/${prefix}`)
        || code.includes(prefix)
        // Also retain concatenated or parameterized URL roots such as
        // const pack = 'winter-v5'; assetUrl(`assets/sfx/${pack}/...`).
        || quotedDirectory.test(code);
    });
  }));
}

export function shouldPublishRuntimeAsset(relativeAsset, excludedPrefixes, excludedAssets = new Set()) {
  const relative = posix(relativeAsset);
  return !excludedAssets.has(relative) && !Array.from(excludedPrefixes || []).some(prefix =>
    relative === prefix.slice(0, -1) || relative.startsWith(prefix));
}

// The thumbnail manifest is also a logical presence index consulted before
// assetUrl() canonicalization. Keep an omitted alias's key when a verified
// runtime alias redirects its request to published canonical thumbnail bytes.
export function includeRuntimeThumbnailMetadata(relativeThumbnail, omittedAssets, runtimeAliases) {
  const asset = `thumbs/${posix(relativeThumbnail)}`;
  return !omittedAssets.has(asset) || runtimeAliases.has(asset);
}

// Preserve the supplied notices verbatim. Font binaries remain on Vite's
// existing asset pipeline; copying the whole fonts directory would duplicate
// the two unmodified HarmonyOS font files.
export function fontLicenseFileNames(assetsRoot) {
  const root = path.join(assetsRoot, 'fonts');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter(entry => !entry.isDirectory() && /^LICENSE(?:[-_].+)?\.(?:txt|md)$/i.test(entry.name))
    .map(entry => entry.name).sort();
}
