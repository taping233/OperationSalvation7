// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RUNTIME_REDUNDANCY_REVIEW } from '../scripts/runtime-asset-redundancy-review.mjs';

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
  add('game/data/art-mapping.json', '{"itemArt":{}}');
  add('game/version.json', '{"version":"test"}');
  for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates) add(`game/assets/${asset}`, `retained source: ${asset}`);
  for (const asset of ['portraits/frames/wu/sprite-v1/frame-001.webp', 'portraits/frames/wu/sprite-v1/neutral.webp',
    'scenes/map-nodes/battle-symbol-foreground-1012-v5.webp', 'scenes/map-nodes/map-atmosphere-is7-1012.webp',
    'scenes/map-nodes/city-ghost-props-a-1012.webp', 'scenes/transition-battle-v2.webp',
    'portraits/full/wu-beach.webp', 'sfx/battle/hit-1.ogg']) add(`game/assets/${asset}`, `active: ${asset}`);
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
    f.plugin.buildStart();
    const artManifest = f.read(f.generated('art')).toString();
    const thumbManifest = f.read(f.generated('thumb')).toString();
    for (const { path: asset } of RUNTIME_REDUNDANCY_REVIEW.candidates) expect(artManifest).not.toContain(asset);
    expect(artManifest).toContain('portraits/frames/wu/sprite-v1/frame-001.webp');
    expect(artManifest).toContain('scenes/transition-battle-v2.webp');
    expect(artManifest).not.toContain('cards/expedition-starters/rations.webp');
    expect(artManifest).toContain('cards/resources/ration.webp');
    expect(thumbManifest).toContain('cards/expedition-starters/rations.webp');
    expect(thumbManifest).toContain('cards/resources/ration.webp');
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
