// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { collectVerifiedChestFrameAliases, collectVerifiedRuntimeAssetAliases } from '../scripts/runtime-asset-aliases.mjs';

const gameRoot = path.dirname(fileURLToPath(new URL('../game/index.html', import.meta.url)));
const assetsRoot = path.join(gameRoot, 'assets');
const fixtures = [];
const manifestArray = source => Array.from(runInNewContext(source.toString().replace('export default ', 'globalThis.result = ')));
afterEach(() => {
  for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.doUnmock('node:fs');
  vi.doUnmock('node:child_process');
  vi.doUnmock('../scripts/runtime-asset-aliases.mjs');
  vi.doUnmock('../scripts/runtime-asset-redundancy.mjs');
  vi.restoreAllMocks();
  vi.resetModules();
});


// All Vite hook mutations, including native cleanup, are simulated in memory.
// No real build, subprocess, generated manifest or asset write is performed.
async function pluginFixture(format = 'rig-v1', { aliasCollector, exclusions = new Set() } = {}) {
  vi.resetModules();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const files = new Map();
  const root = path.dirname(gameRoot);
  const add = (relative, body) => files.set(path.join(root, relative), Buffer.from(body));
  const alias = `scenes/chests/small-${format}/frame-01.webp`;
  const canonical = `scenes/chests/small-${format}/frame-00.webp`;
  const asset = (relative, body) => add(`game/assets/${relative}`, body);
  add('game/data/art-mapping.json', '{"itemArt":{"tt-token-color":"cmtmvq6ss84l"}}');
  add('game/version.json', '{"version":"test"}');
  asset(canonical, 'same');
  asset(alias, 'same');
  asset(`scenes/chests/small-${format}/frame-02.webp`, 'different');
  asset('portraits/battle/changwuyu.webp', 'portrait');
  asset('portraits/frames/changwuyu/sprite-v1/f000.webp', 'portrait');
  asset('portraits/frames/changwuyu/sprite-v1/neutral.webp', 'portrait');
  for (const prefix of ['cards', 'thumbs/cards']) {
    asset(`${prefix}/expedition-starters/rations.webp`, prefix);
    asset(`${prefix}/resources/ration.webp`, prefix);
    asset(`${prefix}/items/tt-token-color.webp`, prefix);
    asset(`${prefix}/items/cmtmvq6ss84l.webp`, prefix);
  }
  const directories = () => {
    const dirs = new Set();
    for (const file of files.keys()) {
      let dir = path.dirname(file);
      while (dir !== path.dirname(dir)) { dirs.add(dir); dir = path.dirname(dir); }
    }
    return dirs;
  };
  const read = file => {
    const body = files.get(file);
    if (!body) throw new Error(`Unexpected virtual read: ${file}`);
    return body;
  };
  const outDir = path.join(root, 'desktop-app/game');
  const execSync = vi.fn(command => {
    const expected = process.platform === 'win32' ? `rd /s /q "${outDir}"` : `rm -rf "${outDir}"`;
    if (command !== expected) throw new Error(`Unexpected virtual cleanup: ${command}`);
    for (const file of files.keys()) if (file.startsWith(outDir + path.sep)) files.delete(file);
  });
  const write = vi.fn((file, body) => files.set(file, Buffer.from(body)));
  const mkdir = vi.fn(), chmod = vi.fn(), remove = vi.fn(file => files.delete(file));
  vi.doMock('node:child_process', () => ({ execSync }));
  vi.doMock('node:fs', () => ({
    existsSync: file => files.has(file) || directories().has(file),
    readFileSync: (file, encoding) => encoding ? read(file).toString(encoding) : read(file),
    writeFileSync: write, mkdirSync: mkdir, chmodSync: chmod, rmSync: remove,
    readdirSync: (dir, options) => {
      const entries = new Map();
      for (const file of files.keys()) {
        const relative = path.relative(dir, file);
        if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
        const [name, ...rest] = relative.split(path.sep);
        if (name) entries.set(name, { name, isDirectory: () => rest.length > 0 });
      }
      return options?.withFileTypes ? [...entries.values()] : [...entries.keys()];
    },
  }));
  // A restored family has a stable exclusion plan, so its separate guard cannot
  // mask alias drift. Keep the real exclusion assertions and publication code.
  vi.doMock('../scripts/runtime-asset-redundancy.mjs', async () => ({
    ...await vi.importActual('../scripts/runtime-asset-redundancy.mjs'),
    collectReviewedRuntimeAssetExclusions: () => ({ excludedAssets: new Set(exclusions), warnings: [] }),
  }));
  if (aliasCollector) vi.doMock('../scripts/runtime-asset-aliases.mjs', () => ({ collectVerifiedRuntimeAssetAliases: aliasCollector }));
  const { default: config } = await import('../vite.config.js');
  const plugin = config.plugins.find(entry => entry.name === 'copy-static');
  return { config, plugin, files, add, asset, alias, canonical, read, execSync,
    mutations: [write, mkdir, chmod, remove, execSync],
    configure: (command = 'build') => JSON.parse(plugin.config({}, { command }).define.__RUNTIME_ASSET_ALIASES__),
    output: relative => files.get(path.join(config.build.outDir, 'assets', relative))?.toString(),
  };
}

describe('byte-identical chest output aliases', () => {
  it.each(['rig-640-v1', 'rig-v1'])('%s aliases only equal existing candidate pairs and preserves changed/missing frames', format => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-chest-alias-'));
    fixtures.push(root);
    const rig = path.join(root, `scenes/chests/small-${format}`);
    mkdirSync(rig, { recursive: true });
    for (const [frame, body] of [['00', 'same'], ['01', 'same'], ['02', 'redrawn'], ['16', 'last']]) {
      writeFileSync(path.join(rig, `frame-${frame}.webp`), body);
    }
    const alias = `scenes/chests/small-${format}/frame-01.webp`;
    expect([...collectVerifiedChestFrameAliases(root)]).toEqual([[alias, `scenes/chests/small-${format}/frame-00.webp`]]);
    writeFileSync(path.join(rig, 'frame-01.webp'), 'changed after first check');
    expect(collectVerifiedChestFrameAliases(root).has(alias)).toBe(false);
    const portraits = path.join(root, 'portraits');
    mkdirSync(path.join(portraits, 'battle'), { recursive: true });
    mkdirSync(path.join(portraits, 'frames/changwuyu/sprite-v1'), { recursive: true });
    writeFileSync(path.join(portraits, 'battle/changwuyu.webp'), 'portrait');
    writeFileSync(path.join(portraits, 'frames/changwuyu/sprite-v1/f000.webp'), 'portrait');
    writeFileSync(path.join(portraits, 'frames/changwuyu/sprite-v1/neutral.webp'), 'redrawn');
    const spriteAlias = 'portraits/frames/changwuyu/sprite-v1/f000.webp';
    expect([...collectVerifiedRuntimeAssetAliases(root)]).toEqual([[spriteAlias, 'portraits/battle/changwuyu.webp']]);
    writeFileSync(path.join(portraits, 'battle/changwuyu.webp'), 'new battle portrait');
    expect(collectVerifiedRuntimeAssetAliases(root).has(spriteAlias)).toBe(false);
  });

  it('never merges across resolutions or the non-identical large closing frame', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-chest-resolution-'));
    fixtures.push(root);
    for (const format of ['rig-640-v1', 'rig-v1']) {
      const rig = path.join(root, `scenes/chests/large-${format}`);
      mkdirSync(rig, { recursive: true });
      for (const [frame, body] of [['00', 'shared'], ['01', 'shared'], ['16', 'close'], ['17', 'different close']]) {
        writeFileSync(path.join(rig, `frame-${frame}.webp`), body);
      }
    }
    const aliases = collectVerifiedChestFrameAliases(root);
    expect([...aliases]).toEqual(['rig-640-v1', 'rig-v1'].map(format => [
      `scenes/chests/large-${format}/frame-01.webp`, `scenes/chests/large-${format}/frame-00.webp`,
    ]));
    expect(aliases.size).toBe(2);
  });

  it('verifies rations original and thumbnail pairs independently, retaining missing or redrawn canonical/source files', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-rations-alias-'));
    fixtures.push(root);
    for (const prefix of ['cards', 'thumbs/cards']) {
      mkdirSync(path.join(root, prefix, 'expedition-starters'), { recursive: true });
      mkdirSync(path.join(root, prefix, 'resources'), { recursive: true });
      writeFileSync(path.join(root, prefix, 'expedition-starters/rations.webp'), prefix);
      writeFileSync(path.join(root, prefix, 'resources/ration.webp'), prefix);
    }
    const original = 'cards/expedition-starters/rations.webp';
    const thumbnail = 'thumbs/cards/expedition-starters/rations.webp';
    expect(collectVerifiedRuntimeAssetAliases(root).get(original)).toBe('cards/resources/ration.webp');
    expect(collectVerifiedRuntimeAssetAliases(root).get(thumbnail)).toBe('thumbs/cards/resources/ration.webp');
    writeFileSync(path.join(root, original), 'redrawn original');
    expect(collectVerifiedRuntimeAssetAliases(root).has(original)).toBe(false);
    expect(collectVerifiedRuntimeAssetAliases(root).has(thumbnail)).toBe(true);
    // 本机 Node v24.13.0 的 fs.rmSync 对单文件静默不删除（unlinkSync 正常），
    // 用 unlinkSync 保证「canonical 缺失则别名不成立」的删除前提真实生效。
    unlinkSync(path.join(root, 'thumbs/cards/resources/ration.webp'));
    expect(collectVerifiedRuntimeAssetAliases(root).has(thumbnail)).toBe(false);
  });

  it('aliases only byte-identical legacy rig output and preserves the active safe timeline URLs', () => {
    const source = readFileSync(path.join(gameRoot, 'src/run/chests.js'), 'utf8');
    const openingArt = readFileSync(path.join(gameRoot, 'src/run/chest-opening-art.js'), 'utf8');
    const aliases = collectVerifiedChestFrameAliases(assetsRoot);
    expect(aliases.size).toBeLessThanOrEqual(30);
    for (const [alias, canonical] of aliases) {
      expect(readFileSync(path.join(assetsRoot, alias)).equals(readFileSync(path.join(assetsRoot, canonical)))).toBe(true);
      for (const asset of [alias, canonical]) {
        expect(asset).toMatch(/^scenes\/chests\/(?:small|medium|large|class|boss)-rig(?:-640)?-v1\/frame-\d{2}\.webp$/);
        expect(openingArt).not.toContain(asset);
      }
    }
    expect(source).toContain("from './chest-opening-art.js'");
    expect(source).toContain('const CHEST_FRAME_SETS = createChestFrameSets();');
    for (const frame of ['frame-00', 'frame-01', 'frame-02', 'frame-03', 'burst']) {
      const asset = `scenes/chests/safe-simple-v7/${frame}.webp`;
      expect(openingArt).toContain(`new URL('../../assets/${asset}', import.meta.url)`);
      expect(readFileSync(path.join(assetsRoot, asset)).byteLength).toBeGreaterThan(0);
      expect(aliases.has(asset)).toBe(false);
      expect([...aliases.values()]).not.toContain(asset);
    }
  });

  it.each(['rig-640-v1', 'rig-v1'])('%s uses the same canonical URLs in Vite assets, preload manifests, and copied output; rechecks reused hooks', async format => {
    const { config, plugin, files, read, execSync } = await pluginFixture(format);
    const filename = config.build.rollupOptions.output.assetFileNames;
    const alias = `scenes/chests/small-${format}/frame-01.webp`;
    const canonical = `scenes/chests/small-${format}/frame-00.webp`;
    expect(filename({ originalFileNames: [`assets/${alias}`] })).toBe(`assets/${canonical}`);
    expect(JSON.parse(plugin.config({}, { command: 'serve' }).define.__RUNTIME_ASSET_ALIASES__)).toEqual({});
    const buildAliases = JSON.parse(plugin.config({}, { command: 'build' }).define.__RUNTIME_ASSET_ALIASES__);
    expect(buildAliases[`assets/${alias}`]).toBe(`assets/${canonical}`);
    expect(buildAliases['assets/portraits/frames/changwuyu/sprite-v1/f000.webp']).toBe('assets/portraits/battle/changwuyu.webp');
    expect(buildAliases['assets/portraits/frames/changwuyu/sprite-v1/neutral.webp']).toBe('assets/portraits/battle/changwuyu.webp');
    plugin.buildStart();
    const manifestPath = path.join(gameRoot, 'src/generated/art-manifest.js');
    expect(manifestArray(read(manifestPath))).toContain(canonical);
    expect(manifestArray(read(manifestPath))).not.toContain(alias);
    expect(manifestArray(read(manifestPath)).some(file => file.endsWith('/frame-02.webp'))).toBe(true);
    expect(manifestArray(read(manifestPath))).toContain('portraits/battle/changwuyu.webp');
    expect(manifestArray(read(manifestPath)).some(file => file.endsWith('/sprite-v1/f000.webp'))).toBe(false);
    expect(manifestArray(read(manifestPath)).some(file => file.endsWith('/sprite-v1/neutral.webp'))).toBe(false);
    plugin.closeBundle();
    expect(files.has(path.join(config.build.outDir, 'assets', canonical))).toBe(true);
    expect(files.has(path.join(config.build.outDir, 'assets', alias))).toBe(false);
    expect(files.has(path.join(config.build.outDir, 'assets/portraits/battle/changwuyu.webp'))).toBe(true);
    expect(files.has(path.join(config.build.outDir, 'assets/portraits/frames/changwuyu/sprite-v1/f000.webp'))).toBe(false);
    expect(files.has(path.join(config.build.outDir, 'assets/portraits/frames/changwuyu/sprite-v1/neutral.webp'))).toBe(false);
    expect(execSync).not.toHaveBeenCalled();

    // The next build gets a fresh equality decision even with the same config.
    files.set(path.join(assetsRoot, alias), Buffer.from('redrawn'));
    files.set(path.join(assetsRoot, 'portraits/frames/changwuyu/sprite-v1/neutral.webp'), Buffer.from('new neutral'));
    for (const file of [...files.keys()]) if (file.startsWith(config.build.outDir + path.sep)) files.delete(file);
    const nextAliases = JSON.parse(plugin.config({}, { command: 'build' }).define.__RUNTIME_ASSET_ALIASES__);
    expect(nextAliases[`assets/${alias}`]).toBeUndefined();
    expect(nextAliases['assets/portraits/frames/changwuyu/sprite-v1/neutral.webp']).toBeUndefined();
    plugin.buildStart();
    expect(filename({ originalFileNames: [`assets/${alias}`] })).toBe(`assets/${alias}`);
    expect(manifestArray(read(manifestPath))).toContain(alias);
    plugin.closeBundle();
    expect(read(path.join(config.build.outDir, 'assets', alias)).toString()).toBe('redrawn');
    expect(execSync).not.toHaveBeenCalled();
  });
});


const phases = ['config-to-buildStart', 'buildStart-to-closeBundle'];
const itemSource = 'cards/items/tt-token-color.webp';
const itemTarget = 'cards/items/cmtmvq6ss84l.webp';
const withoutItemMapping = fixture => fixture.add('game/data/art-mapping.json', '{"itemArt":{}}');
const removeAsset = (fixture, asset) => fixture.files.delete(path.join(assetsRoot, asset));
const driftCases = [
  { name: 'alias bytes change', mutate: f => f.asset(f.alias, 'redrawn') },
  { name: 'canonical bytes change', mutate: f => f.asset(f.canonical, 'redrawn') },
  { name: 'alias disappears', mutate: f => removeAsset(f, f.alias) },
  { name: 'canonical disappears', mutate: f => removeAsset(f, f.canonical) },
  { name: 'unequal pair becomes alias', prepare: f => f.asset(f.alias, 'different'), mutate: f => f.asset(f.alias, 'same') },
  { name: 'new alias file appears', prepare: f => removeAsset(f, f.alias), mutate: f => f.asset(f.alias, 'same') },
  { name: 'itemArt mapping removed', mutate: withoutItemMapping, itemOnly: true },
  { name: 'itemArt mapping added', prepare: withoutItemMapping,
    mutate: f => f.add('game/data/art-mapping.json', '{"itemArt":{"tt-token-color":"cmtmvq6ss84l"}}'), itemOnly: true },
  ...['', 'thumbs/'].flatMap(prefix => [
    { name: `${prefix || 'original '}itemArt source diverges`, mutate: f => f.asset(prefix + itemSource, 'redrawn'), itemOnly: true },
    { name: `${prefix || 'original '}itemArt target disappears`, mutate: f => removeAsset(f, prefix + itemTarget), itemOnly: true },
    { name: `${prefix || 'original '}itemArt omission added`, prepare: f => f.asset(prefix + itemSource, 'different'),
      mutate: f => f.asset(prefix + itemSource, prefix ? 'thumbs/cards' : 'cards'), itemOnly: true },
  ]),
];

function reachBoundary(fixture, phase) {
  const injected = fixture.configure();
  if (phase === 'buildStart-to-closeBundle') fixture.plugin.buildStart();
  // closeBundle runs after Rollup may have emitted files. Its rejection must
  // preserve those files, not pretend that the whole build wrote nothing.
  const sentinel = path.join(fixture.config.build.outDir, phase === 'config-to-buildStart' ? 'old-output.txt' : 'assets/js/rollup-output.js');
  fixture.files.set(sentinel, Buffer.from('existing output'));
  for (const mutation of fixture.mutations) mutation.mockClear();
  return injected;
}

function rejectBoundary(fixture, phase) {
  const before = new Map(fixture.files);
  const hook = phase === 'config-to-buildStart' ? 'buildStart' : 'closeBundle';
  expect(() => fixture.plugin[hook]()).toThrow(new RegExp(`${hook}.*alias.*omission.*changed.*fresh build configuration`, 'i'));
  expect(fixture.files).toEqual(before);
  for (const mutation of fixture.mutations) expect(mutation).not.toHaveBeenCalled();
}

describe.each(phases)('runtime alias plan lifecycle: %s', phase => {
  it.each(driftCases)('rejects $name before cleanup/manifests or copy/version writes', async ({ prepare, mutate, itemOnly }) => {
    const fixture = await pluginFixture();
    prepare?.(fixture);
    const scanner = await import('../scripts/runtime-asset-aliases.mjs');
    const originalAliases = scanner.collectVerifiedRuntimeAssetAliases(assetsRoot);
    reachBoundary(fixture, phase);
    mutate(fixture);
    if (itemOnly) expect(scanner.collectVerifiedRuntimeAssetAliases(assetsRoot)).toEqual(originalAliases);
    rejectBoundary(fixture, phase);
  });

  it('rejects a canonical target change even when alias keys and omitted keys are identical', async () => {
    const alias = 'scenes/chests/small-rig-v1/frame-01.webp';
    // The production candidates currently have fixed targets. A shared mutable
    // collector result isolates value comparison and independent snapshot copies.
    const aliases = new Map([[alias, 'scenes/chests/small-rig-v1/frame-00.webp']]);
    const fixture = await pluginFixture('rig-v1', { aliasCollector: () => aliases });
    reachBoundary(fixture, phase);
    aliases.set(alias, 'scenes/chests/small-rig-v1/frame-02.webp');
    rejectBoundary(fixture, phase);
  });

  it('ignores Map/Set insertion order when all alias pairs and omissions stay equal', async () => {
    const entries = [
      ['scenes/chests/small-rig-v1/frame-01.webp', 'scenes/chests/small-rig-v1/frame-00.webp'],
      ['portraits/frames/changwuyu/sprite-v1/f000.webp', 'portraits/battle/changwuyu.webp'],
    ];
    const aliases = new Map(entries);
    const fixture = await pluginFixture('rig-v1', { aliasCollector: () => aliases });
    reachBoundary(fixture, phase);
    aliases.clear();
    for (const [alias, target] of entries.toReversed()) aliases.set(alias, target);
    if (phase === 'config-to-buildStart') fixture.plugin.buildStart();
    fixture.plugin.closeBundle();
    expect(fixture.output(fixture.canonical)).toBe('same');
    expect(fixture.output(fixture.alias)).toBeUndefined();
  });

  it('allows both equal files to change together without pretending to freeze asset bytes', async () => {
    const fixture = await pluginFixture();
    reachBoundary(fixture, phase);
    fixture.asset(fixture.alias, 'new equal bytes');
    fixture.asset(fixture.canonical, 'new equal bytes');
    if (phase === 'config-to-buildStart') fixture.plugin.buildStart();
    fixture.plugin.closeBundle();
    expect(fixture.output(fixture.canonical)).toBe('new equal bytes');
    expect(fixture.output(fixture.alias)).toBeUndefined();
  });

  it('recovers after rejection through a fresh config on the same plugin instance', async () => {
    const fixture = await pluginFixture();
    reachBoundary(fixture, phase);
    fixture.asset(fixture.alias, 'redrawn');
    rejectBoundary(fixture, phase);
    expect(fixture.configure('serve')).toEqual({});
    const aliases = fixture.configure();
    expect(aliases[`assets/${fixture.alias}`]).toBeUndefined();
    fixture.plugin.buildStart();
    expect(fixture.config.build.rollupOptions.output.assetFileNames({ originalFileNames: [`assets/${fixture.alias}`] })).toBe(`assets/${fixture.alias}`);
    fixture.plugin.closeBundle();
    expect(fixture.output(fixture.alias)).toBe('redrawn');
    expect(fixture.output(fixture.canonical)).toBe('same');
  });
});

describe('runtime alias plan stable boundaries', () => {
  it('keeps rations logical thumbnail keys but omits independently verified itemArt copies', async () => {
    const f = await pluginFixture();
    f.asset('thumbs/' + itemSource, 'different thumbnail');
    const aliases = f.configure();
    expect(aliases['assets/cards/expedition-starters/rations.webp']).toBe('assets/cards/resources/ration.webp');
    expect(aliases['assets/thumbs/cards/expedition-starters/rations.webp']).toBe('assets/thumbs/cards/resources/ration.webp');
    f.plugin.buildStart();
    const manifest = manifestArray(f.read(path.join(gameRoot, 'src/generated/thumb-manifest.js')));
    expect(manifest).toContain('cards/expedition-starters/rations.webp');
    expect(manifest).toContain('cards/items/tt-token-color.webp');
    f.plugin.closeBundle();
    expect(f.output('cards/expedition-starters/rations.webp')).toBeUndefined();
    expect(f.output('thumbs/cards/expedition-starters/rations.webp')).toBeUndefined();
    expect(f.output('cards/resources/ration.webp')).toBe('cards');
    expect(f.output('thumbs/cards/resources/ration.webp')).toBe('thumbs/cards');
    expect(f.output(itemSource)).toBeUndefined();
    expect(f.output('thumbs/' + itemSource)).toBe('different thumbnail');
  });

  it('does not inject aliases excluded at either endpoint', async () => {
    const alias = 'scenes/chests/small-rig-v1/frame-01.webp';
    const portraitTarget = 'portraits/battle/changwuyu.webp';
    const f = await pluginFixture('rig-v1', { exclusions: new Set([alias, portraitTarget]) });
    const aliases = f.configure();
    expect(aliases[`assets/${alias}`]).toBeUndefined();
    expect(aliases['assets/portraits/frames/changwuyu/sprite-v1/f000.webp']).toBeUndefined();
    expect(aliases['assets/cards/expedition-starters/rations.webp']).toBe('assets/cards/resources/ration.webp');
  });

  it('supports direct hooks without config and clears the old plan on serve config', async () => {
    const f = await pluginFixture();
    f.plugin.buildStart();
    f.plugin.closeBundle();
    f.asset(f.alias, 'redrawn');
    expect(f.configure('serve')).toEqual({});
    f.plugin.buildStart();
    f.plugin.closeBundle();
    expect(f.output(f.alias)).toBe('redrawn');
    expect(f.output(f.canonical)).toBe('same');
  });
});
