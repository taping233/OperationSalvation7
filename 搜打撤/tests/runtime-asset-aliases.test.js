// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { collectVerifiedChestFrameAliases, collectVerifiedRuntimeAssetAliases } from '../scripts/runtime-asset-aliases.mjs';

const gameRoot = path.dirname(fileURLToPath(new URL('../game/index.html', import.meta.url)));
const assetsRoot = path.join(gameRoot, 'assets');
const fixtures = [];
afterEach(() => {
  for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.doUnmock('node:fs');
  vi.doUnmock('node:child_process');
  vi.resetModules();
});

describe('byte-identical chest output aliases', () => {
  it('aliases only equal existing candidate pairs and preserves changed/missing frames', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-chest-alias-'));
    fixtures.push(root);
    const rig = path.join(root, 'scenes/chests/small-rig-640-v1');
    mkdirSync(rig, { recursive: true });
    for (const [frame, body] of [['00', 'same'], ['01', 'same'], ['02', 'redrawn'], ['16', 'last']]) {
      writeFileSync(path.join(rig, `frame-${frame}.webp`), body);
    }
    const alias = 'scenes/chests/small-rig-640-v1/frame-01.webp';
    expect([...collectVerifiedChestFrameAliases(root)]).toEqual([[alias, 'scenes/chests/small-rig-640-v1/frame-00.webp']]);
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
    expect(aliases.size).toBeLessThanOrEqual(15);
    for (const [alias, canonical] of aliases) {
      expect(readFileSync(path.join(assetsRoot, alias)).equals(readFileSync(path.join(assetsRoot, canonical)))).toBe(true);
      for (const asset of [alias, canonical]) {
        expect(asset).toMatch(/^scenes\/chests\/(?:small|medium|large|class|boss)-rig-640-v1\/frame-\d{2}\.webp$/);
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

  it('uses the same canonical URLs in Vite assets, preload manifests, and copied output; rechecks reused hooks', async () => {
    vi.resetModules();
    // Exercise plugin hooks against an entirely virtual filesystem. No build,
    // generated directory cleanup, or real asset write is performed.
    const files = new Map();
    const root = path.dirname(gameRoot);
    const add = (relative, body) => files.set(path.join(root, relative), Buffer.from(body));
    add('game/data/art-mapping.json', '{"itemArt":{}}');
    add('game/version.json', '{"version":"test"}');
    add('game/assets/scenes/chests/small-rig-640-v1/frame-00.webp', 'same');
    add('game/assets/scenes/chests/small-rig-640-v1/frame-01.webp', 'same');
    add('game/assets/scenes/chests/small-rig-640-v1/frame-02.webp', 'different');
    add('game/assets/portraits/battle/changwuyu.webp', 'portrait');
    add('game/assets/portraits/frames/changwuyu/sprite-v1/f000.webp', 'portrait');
    add('game/assets/portraits/frames/changwuyu/sprite-v1/neutral.webp', 'portrait');
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
    const execSync = vi.fn(() => { throw new Error('Real cleanup is forbidden in this test'); });
    vi.doMock('node:child_process', () => ({ execSync }));
    vi.doMock('node:fs', () => ({
      existsSync: file => files.has(file) || directories().has(file),
      readFileSync: (file, encoding) => encoding ? read(file).toString(encoding) : read(file),
      writeFileSync: (file, body) => files.set(file, Buffer.from(body)),
      mkdirSync: vi.fn(), chmodSync: vi.fn(), rmSync: file => files.delete(file),
      readdirSync: dir => {
        const entries = new Map();
        for (const file of files.keys()) {
          const relative = path.relative(dir, file);
          if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
          const [name, ...rest] = relative.split(path.sep);
          if (name) entries.set(name, { name, isDirectory: () => rest.length > 0 });
        }
        return [...entries.values()];
      },
    }));
    const { default: config } = await import('../vite.config.js');
    const plugin = config.plugins.find(entry => entry.name === 'copy-static');
    const filename = config.build.rollupOptions.output.assetFileNames;
    const alias = 'scenes/chests/small-rig-640-v1/frame-01.webp';
    const canonical = 'scenes/chests/small-rig-640-v1/frame-00.webp';
    expect(filename({ originalFileNames: [`assets/${alias}`] })).toBe(`assets/${canonical}`);
    expect(JSON.parse(plugin.config({}, { command: 'serve' }).define.__RUNTIME_ASSET_ALIASES__)).toEqual({});
    const buildAliases = JSON.parse(plugin.config({}, { command: 'build' }).define.__RUNTIME_ASSET_ALIASES__);
    expect(buildAliases[`assets/${alias}`]).toBe(`assets/${canonical}`);
    expect(buildAliases['assets/portraits/frames/changwuyu/sprite-v1/f000.webp']).toBe('assets/portraits/battle/changwuyu.webp');
    expect(buildAliases['assets/portraits/frames/changwuyu/sprite-v1/neutral.webp']).toBe('assets/portraits/battle/changwuyu.webp');
    plugin.buildStart();
    const manifestPath = path.join(gameRoot, 'src/generated/art-manifest.js');
    expect(read(manifestPath).toString()).toContain(canonical);
    expect(read(manifestPath).toString()).not.toContain(alias);
    expect(read(manifestPath).toString()).toContain('frame-02.webp');
    expect(read(manifestPath).toString()).toContain('portraits/battle/changwuyu.webp');
    expect(read(manifestPath).toString()).not.toContain('sprite-v1/f000.webp');
    expect(read(manifestPath).toString()).not.toContain('sprite-v1/neutral.webp');
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
    expect(read(manifestPath).toString()).toContain(alias);
    plugin.closeBundle();
    expect(read(path.join(config.build.outDir, 'assets', alias)).toString()).toBe('redrawn');
    expect(execSync).not.toHaveBeenCalled();
  });
});
