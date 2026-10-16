// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_REDUNDANCY_REVIEW } from '../scripts/runtime-asset-redundancy-review.mjs';
import artMapping from '../game/data/art-mapping.json';

const gameRoot = path.dirname(fileURLToPath(new URL('../game/index.html', import.meta.url)));
const root = path.dirname(gameRoot);
afterEach(() => {
  for (const module of ['node:fs', 'node:child_process', '../scripts/runtime-asset-redundancy.mjs']) vi.doUnmock(module);
  vi.resetModules();
});

async function pluginFixture() {
  vi.resetModules();
  const files = new Map();
  const add = (relative, body) => files.set(path.join(root, relative), Buffer.from(body));
  add('game/data/art-mapping.json', JSON.stringify({ itemArt: {}, cardArtOverrides: artMapping.cardArtOverrides }));
  add('game/version.json', '{"version":"test"}');
  for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates) add(`game/assets/${asset}`, `retained source: ${asset}`);
  for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => candidate.category === 'shadowed-card-art')) {
    const id = path.posix.basename(asset, '.webp').replace(/^(spell|equip)-/, '');
    const replacement = `${asset.startsWith('thumbs/') ? 'thumbs/' : ''}${artMapping.cardArtOverrides[id]}`;
    add(`game/assets/${replacement}`, `current illustration: ${replacement}`);
  }
  for (const stem of ['hero-forbidden', 'spell-tt3-fireball', 'martial-tt3-skewer', 'equip-tt2-frostsword']) {
    for (const prefix of ['cards/', 'thumbs/cards/']) add(`game/assets/${prefix}${stem}.webp`, `retained referenced card: ${prefix}${stem}`);
  }
  for (const frame of ['00', '01', '02']) add(`game/assets/scenes/chests/small-rig-640-v1/frame-${frame}.webp`, 'same retired chest');
  for (const asset of ['portraits/frames/wu/sprite-v1/frame-001.webp', 'portraits/frames/wu/sprite-v1/neutral.webp',
    'scenes/map-nodes/battle-symbol-foreground-1012-v5.webp', 'scenes/map-nodes/map-atmosphere-is7-1012.webp',
    'scenes/map-nodes/city-ghost-props-a-1012.webp', 'scenes/transition-battle-v2.webp',
    'portraits/full/wu-beach.webp', 'sfx/battle/hit-1.ogg',
    'scenes/entry/modern-winter-entry-1011-v2.webp',
    'scenes/battle/stage-reset-1015/backdrop.webp', 'scenes/battle/stage-reset-1015/ground.webp',
    'scenes/battle/stage-reset-1015/foreground.webp', 'scenes/battle/winter-street-1011-v2.webp',
    'scenes/battle/frozen-ruins-1015.webp', 'scenes/battle/contaminated-core-1015.webp',
    ...['00', '01', '02', '03'].map(frame => `scenes/chests/safe-simple-v7/frame-${frame}.webp`),
    'scenes/chests/safe-simple-v7/burst.webp']) add(`game/assets/${asset}`, `active: ${asset}`);
  for (const prefix of ['cards', 'thumbs/cards']) {
    add(`game/assets/${prefix}/expedition-starters/rations.webp`, `same ${prefix} image`);
    add(`game/assets/${prefix}/resources/ration.webp`, `same ${prefix} image`);
  }
  const directories = () => {
    const dirs = new Set();
    for (const file of files.keys()) {
      let directory = path.dirname(file);
      while (directory !== path.dirname(directory)) { dirs.add(directory); directory = path.dirname(directory); }
    }
    return dirs;
  };
  const read = filename => {
    const body = files.get(filename);
    if (!body) throw new Error(`Unexpected virtual read: ${filename}`);
    return body;
  };
  vi.doMock('node:fs', () => ({
    existsSync: filename => files.has(filename) || directories().has(filename),
    readFileSync: (filename, encoding) => encoding ? read(filename).toString(encoding) : read(filename),
    writeFileSync: (filename, body) => files.set(filename, Buffer.from(body)),
    mkdirSync: vi.fn(), chmodSync: vi.fn(), rmSync: filename => files.delete(filename),
    readdirSync: directory => {
      const entries = new Map();
      for (const file of files.keys()) {
        const relative = path.relative(directory, file);
        if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
        const [name, ...rest] = relative.split(path.sep);
        if (name) entries.set(name, { name, isDirectory: () => rest.length > 0 });
      }
      return [...entries.values()];
    },
  }));
  vi.doMock('node:child_process', () => ({ execSync: vi.fn(() => { throw new Error('Real cleanup is forbidden'); }) }));
  let selection = new Set(RUNTIME_REDUNDANCY_REVIEW.candidates.map(candidate => candidate.path));
  vi.doMock('../scripts/runtime-asset-redundancy.mjs', async () => {
    const actual = await vi.importActual('../scripts/runtime-asset-redundancy.mjs');
    return { ...actual, collectReviewedRuntimeAssetExclusions: () => ({ excludedAssets: new Set(selection), warnings: [] }) };
  });
  const { default: config } = await import('../vite.config.js');
  const plugin = config.plugins.find(entry => entry.name === 'copy-static');
  const modules = [];
  const context = { getModuleIds: () => modules.map(module => module.id), getModuleInfo: id => modules.find(module => module.id === id) };
  return { files, config, plugin, read, add, context, modules,
    restore: asset => selection.delete(asset),
    generated: name => path.join(gameRoot, `src/generated/${name}-manifest.js`),
    published: asset => path.join(config.build.outDir, 'assets', asset),
    clearOutput: () => { for (const filename of [...files.keys()]) if (filename.startsWith(config.build.outDir + path.sep)) files.delete(filename); },
  };
}

describe('reviewed asset omissions through real Vite hooks without a build', () => {
  it('keeps original source files, filters the production art manifest and copy, and retains the rations thumbnail lookup key', async () => {
    const f = await pluginFixture();
    const aliases = JSON.parse(f.plugin.config({}, { command: 'build' }).define.__RUNTIME_ASSET_ALIASES__);
    expect(aliases['assets/cards/expedition-starters/rations.webp']).toBe('assets/cards/resources/ration.webp');
    expect(aliases['assets/thumbs/cards/expedition-starters/rations.webp']).toBe('assets/thumbs/cards/resources/ration.webp');
    expect(Object.entries(aliases).flat().some(asset => asset.includes('-rig-640-v1/'))).toBe(false);
    f.plugin.buildStart();
    const artManifest = f.read(f.generated('art')).toString();
    const thumbManifest = f.read(f.generated('thumb')).toString();
    for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates) expect(artManifest).not.toContain(asset);
    expect(artManifest).toContain('portraits/frames/wu/sprite-v1/frame-001.webp');
    expect(artManifest).toContain('scenes/transition-battle-v2.webp');
    const safeAssets = [...['00', '01', '02', '03'].map(frame => `scenes/chests/safe-simple-v7/frame-${frame}.webp`),
      'scenes/chests/safe-simple-v7/burst.webp'];
    for (const asset of safeAssets) expect(artManifest).toContain(asset);
    for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates.filter(item => item.path.startsWith('thumbs/'))) {
      expect(thumbManifest).not.toContain(asset.slice('thumbs/'.length));
    }
    expect(artManifest).not.toContain('cards/expedition-starters/rations.webp');
    expect(artManifest).toContain('cards/resources/ration.webp');
    expect(thumbManifest).toContain('cards/expedition-starters/rations.webp');
    expect(thumbManifest).toContain('cards/resources/ration.webp');
    // The actual injected alias dictionary and active frame literals are part
    // of the complete graph guard, and must not refer to omitted rig files.
    f.modules.push({ id: '/game/src/core/asset-url.js', code: `const aliases = ${JSON.stringify(aliases)};` });
    f.modules.push({ id: '/game/src/run/chest-opening-art.js', code: JSON.stringify(safeAssets) });
    f.plugin.closeBundle.call(f.context);
    for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates) {
      expect(f.files.has(f.published(asset))).toBe(false);
      expect(f.files.has(path.join(gameRoot, 'assets', asset))).toBe(true);
    }
    for (const prefix of ['cards', 'thumbs/cards']) {
      expect(f.files.has(f.published(`${prefix}/expedition-starters/rations.webp`))).toBe(false);
      expect(f.read(f.published(`${prefix}/resources/ration.webp`))).toEqual(Buffer.from(`same ${prefix} image`));
    }
    expect(f.files.has(f.published('portraits/full/wu-beach.webp'))).toBe(true);
    expect(f.files.has(f.published('scenes/map-nodes/map-atmosphere-is7-1012.webp'))).toBe(true);
    expect(f.files.has(f.published('scenes/map-nodes/city-ghost-props-a-1012.webp'))).toBe(true);
    for (const asset of [...safeAssets, 'scenes/entry/modern-winter-entry-1011-v2.webp',
      'scenes/battle/stage-reset-1015/backdrop.webp', 'scenes/battle/stage-reset-1015/ground.webp',
      'scenes/battle/stage-reset-1015/foreground.webp', 'scenes/battle/winter-street-1011-v2.webp',
      'scenes/battle/frozen-ruins-1015.webp', 'scenes/battle/contaminated-core-1015.webp']) {
      expect(f.files.has(f.published(asset))).toBe(true);
    }
  });

  it('filters both shadowed card manifests and output, preserves every replacement and source, and restores the whole category', async () => {
    const f = await pluginFixture();
    f.plugin.config({}, { command: 'build' }); f.plugin.buildStart(); f.plugin.closeBundle.call(f.context);
    const reviewed = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => candidate.category === 'shadowed-card-art');
    expect(reviewed).toHaveLength(30);
    for (const { path: asset } of reviewed) {
      const isThumbnail = asset.startsWith('thumbs/');
      const id = path.posix.basename(asset, '.webp').replace(/^(spell|equip)-/, '');
      const replacement = `${isThumbnail ? 'thumbs/' : ''}${artMapping.cardArtOverrides[id]}`;
      const manifest = f.read(f.generated(isThumbnail ? 'thumb' : 'art')).toString();
      expect(manifest).not.toContain(isThumbnail ? asset.slice('thumbs/'.length) : asset);
      expect(manifest).toContain(artMapping.cardArtOverrides[id]);
      expect(f.files.has(f.published(asset))).toBe(false);
      expect(f.read(path.join(gameRoot, 'assets', asset))).toEqual(Buffer.from(`retained source: ${asset}`));
      expect(f.read(f.published(replacement))).toEqual(Buffer.from(`current illustration: ${replacement}`));
    }
    for (const stem of ['hero-forbidden', 'spell-tt3-fireball', 'martial-tt3-skewer', 'equip-tt2-frostsword']) {
      for (const prefix of ['cards/', 'thumbs/cards/']) expect(f.files.has(f.published(`${prefix}${stem}.webp`))).toBe(true);
    }
    f.clearOutput();
    for (const { path: asset } of reviewed) f.restore(asset);
    f.plugin.config({}, { command: 'build' }); f.plugin.buildStart(); f.plugin.closeBundle.call(f.context);
    for (const { path: asset } of reviewed) {
      const manifest = f.read(f.generated(asset.startsWith('thumbs/') ? 'thumb' : 'art')).toString();
      expect(manifest).toContain(asset.startsWith('thumbs/') ? asset.slice('thumbs/'.length) : asset);
      expect(f.read(f.published(asset))).toEqual(Buffer.from(`retained source: ${asset}`));
    }
  });

  it('rejects selector changes between alias injection and manifest generation before touching output', async () => {
    const f = await pluginFixture();
    f.plugin.config({}, { command: 'build' });
    f.restore('scenes/chests/small-rig-640-v1/frame-00.webp');
    expect(() => f.plugin.buildStart()).toThrow(/changed during build/);
    expect(f.files.has(f.generated('art'))).toBe(false);
  });

  it('fails explicitly if a lazy reference or selector changes after early manifest selection', async () => {
    const f = await pluginFixture(); f.plugin.buildStart();
    const asset = RUNTIME_REDUNDANCY_REVIEW.candidates[0].path;
    f.modules.push({ id: '/game/src/lazy-restored.js', code: `assets/${asset}` });
    expect(() => f.plugin.closeBundle.call(f.context)).toThrow(/Excluded runtime asset/);
    f.modules.length = 0; f.restore(asset);
    expect(() => f.plugin.closeBundle.call(f.context)).toThrow(/changed during build/);
  });

  it('restores a selected legacy resource in the next manifests/copy and a redrawn rations image on a reused config', async () => {
    const f = await pluginFixture(); f.plugin.buildStart(); f.plugin.closeBundle.call(f.context);
    f.clearOutput();
    const asset = RUNTIME_REDUNDANCY_REVIEW.candidates[0].path;
    f.restore(asset);
    for (const prefix of ['cards', 'thumbs/cards']) f.add(`game/assets/${prefix}/expedition-starters/rations.webp`, `redrawn ${prefix}`);
    const aliases = JSON.parse(f.plugin.config({}, { command: 'build' }).define.__RUNTIME_ASSET_ALIASES__);
    expect(aliases['assets/cards/expedition-starters/rations.webp']).toBeUndefined();
    expect(aliases['assets/thumbs/cards/expedition-starters/rations.webp']).toBeUndefined();
    f.plugin.buildStart(); f.plugin.closeBundle.call(f.context);
    expect(f.read(f.generated('art')).toString()).toContain(asset);
    expect(f.files.has(f.published(asset))).toBe(true);
    expect(f.read(f.published('cards/expedition-starters/rations.webp'))).toEqual(Buffer.from('redrawn cards'));
    expect(f.read(f.published('thumbs/cards/expedition-starters/rations.webp'))).toEqual(Buffer.from('redrawn thumbs/cards'));
  });
});
