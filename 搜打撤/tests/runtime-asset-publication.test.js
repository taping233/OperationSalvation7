// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  DEVELOPMENT_SFX_PREFIXES, collectUnreferencedDevelopmentSfxPrefixes,
  fontLicenseFileNames, shouldPublishRuntimeAsset, RUNTIME_ASSET_DIRS,
} from '../scripts/runtime-asset-publication.mjs';

const assetsRoot = fileURLToPath(new URL('../game/assets/', import.meta.url));
const fixtures = [];
afterEach(() => {
  for (const dir of fixtures.splice(0)) rmSync(dir, { recursive: true, force: true });
  vi.doUnmock('node:fs');
  vi.resetModules();
});

describe('production runtime asset publication', () => {
  it('publishes JSON-referenced frames and guide art plus dynamically named battle stickers at stable paths', () => {
    const frames = JSON.parse(readFileSync(new URL('../game/data/card-frame-layout.json', import.meta.url), 'utf8'));
    const guide = readFileSync(new URL('../game/data/beginner-guide.json', import.meta.url), 'utf8');
    const assets = [...Object.values(frames).map(frame => frame.path),
      ...guide.matchAll(/ui\/beginner-guide\/[\w-]+\.svg/g)].map(value => typeof value === 'string' ? value : value[0]);
    assets.push('ui/map-hud-1015/gold-is7-v2.webp', 'ui/sugin-mail-empty.webp',
      'battle/fx-sticker-boom.svg', 'battle/fx-sticker-heal.svg', 'battle/fx-sticker-hurt.svg');
    expect(assets.length).toBeGreaterThan(20);
    for (const asset of assets) {
      expect(RUNTIME_ASSET_DIRS.some(directory => asset.startsWith(`${directory}/`)), asset).toBe(true);
      expect(readFileSync(path.join(assetsRoot, asset)).byteLength, asset).toBeGreaterThan(0);
    }
    const config = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
    expect(config).toContain('for (const relativeDir of RUNTIME_ASSET_DIRS)');
  });
  it('loads fallback Noto fonts on demand without changing the primary font or removing bundled fallbacks', () => {
    const html = readFileSync(new URL('../game/index.html', import.meta.url), 'utf8');
    const css = readFileSync(new URL('../game/css/base.css', import.meta.url), 'utf8');
    const preloads = [...html.matchAll(/<link\b[^>]*rel="preload"[^>]*>/g)].map(match => match[0]);
    expect(preloads.some(tag => tag.includes('HarmonyOS_Sans_SC_Regular.ttf'))).toBe(true);
    for (const weight of [400, 700]) {
      const font = `notosans-sc-${weight}.woff2`;
      expect(preloads.some(tag => tag.includes(font))).toBe(false);
      expect(css).toContain(`url('../assets/fonts/${font}')`);
      expect(readFileSync(path.join(assetsRoot, 'fonts', font)).byteLength).toBeGreaterThan(0);
    }
  });

  it('omits only the three unused audition libraries and keeps active samples and artwork', () => {
    const excluded = collectUnreferencedDevelopmentSfxPrefixes([
      { id: '/game/src/audio/sound.js', code: readFileSync(new URL('../game/src/audio/sound.js', import.meta.url), 'utf8') },
    ], assetsRoot);
    expect([...excluded]).toEqual(DEVELOPMENT_SFX_PREFIXES);
    for (const prefix of DEVELOPMENT_SFX_PREFIXES) {
      expect(shouldPublishRuntimeAsset(prefix.slice(0, -1), excluded)).toBe(false);
      expect(shouldPublishRuntimeAsset(`${prefix}ui/click.ogg`, excluded)).toBe(false);
      expect(shouldPublishRuntimeAsset(`${prefix.replace(/\//g, '\\')}library.json`, excluded)).toBe(false);
    }
    for (const file of ['sfx/battle/hit-1.ogg', 'sfx/jsfxr/confirm.wav', 'sfx/click1.wav',
      'sfx/rollover1.wav', 'sfx/switch1.wav', 'sfx/winter-v50/library.json',
      'portraits/frames/wu/sprite-v1/neutral.webp', 'cards/hero.webp', 'scenes/battle.webp']) {
      expect(shouldPublishRuntimeAsset(file, excluded)).toBe(true);
    }
  });

  it('retains a library referenced by a loaded module or asynchronous feature catalog', () => {
    const excluded = collectUnreferencedDevelopmentSfxPrefixes([
      { id: path.join(assetsRoot, 'sfx/alternatives/catalog.json'), code: '' },
      { id: '/game/src/feature.js', code: 'assetUrl("assets/sfx/winter-v5/ui/click.ogg")' },
    ], assetsRoot);
    expect([...excluded]).toEqual(['sfx/winter-v6-ten/']);
    expect(shouldPublishRuntimeAsset('sfx/alternatives/catalog.json', excluded)).toBe(true);
    expect(shouldPublishRuntimeAsset('sfx/winter-v5/ui/click.ogg', excluded)).toBe(true);
  });

  it('preserves concatenated roots and Windows module paths and fails open without a graph', () => {
    const excluded = collectUnreferencedDevelopmentSfxPrefixes([
      { id: 'C:\\game\\assets\\sfx\\alternatives\\catalog.json?json', code: '' },
      { id: '/feature.js', code: "const set = 'winter-v5'; assetUrl('assets/sfx/' + set + '/click.ogg')" },
      { id: '/other.js', code: 'const set = `winter-v6-ten`; fetch(`assets/sfx/${set}/library.json`)' },
    ], 'C:\\game\\assets');
    expect([...excluded]).toEqual([]);
    expect([...collectUnreferencedDevelopmentSfxPrefixes(null, assetsRoot)]).toEqual([]);
    expect(shouldPublishRuntimeAsset('sfx/alternatives/catalog.json', null)).toBe(true);
  });

  it('does not confuse similar directory names or ordinary variable names with references', () => {
    const excluded = collectUnreferencedDevelopmentSfxPrefixes([
      { id: '/game/src/policy.js', code: 'const alternatives = []; const key = "winter-v50";' },
    ], assetsRoot);
    expect([...excluded]).toEqual(DEVELOPMENT_SFX_PREFIXES);
  });

  it('lists only existing license documents, never font binaries, and preserves their bytes', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-font-notices-'));
    fixtures.push(root);
    expect(fontLicenseFileNames(root)).toEqual([]);
    mkdirSync(path.join(root, 'fonts'));
    const bytes = Buffer.from([0xef, 0xbb, 0xbf, 65, 13, 10, 0]);
    for (const name of ['LICENSE-HarmonyOS-Sans.txt', 'LICENSE-Example.md', 'HarmonyOS_Sans.ttf', 'README.md']) {
      writeFileSync(path.join(root, 'fonts', name), bytes);
    }
    mkdirSync(path.join(root, 'fonts', 'LICENSE-directory.txt'));
    expect(fontLicenseFileNames(root)).toEqual(['LICENSE-Example.md', 'LICENSE-HarmonyOS-Sans.txt']);
    expect(readFileSync(path.join(root, 'fonts/LICENSE-HarmonyOS-Sans.txt'))).toEqual(bytes);
    expect(fontLicenseFileNames(assetsRoot)).toEqual(expect.arrayContaining([
      'LICENSE-HarmonyOS-Sans.txt', 'LICENSE-Oxanium-OFL.txt', 'LICENSE-Rajdhani-OFL.txt',
    ]));
  });

  it('publishes active samples and verbatim notices through the real Vite copy plugin', async () => {
    vi.resetModules();
    const gameRoot = path.dirname(fileURLToPath(new URL('../game/index.html', import.meta.url)));
    const root = path.dirname(gameRoot);
    const files = new Map();
    const add = (relative, bytes) => files.set(path.join(root, relative), Buffer.from(bytes));
    add('game/data/art-mapping.json', '{"itemArt":{}}');
    add('game/version.json', '{"version":"test"}');
    add('game/assets/sfx/battle/hit-1.ogg', 'active battle');
    add('game/assets/sfx/click1.wav', 'active click');
    add('game/assets/sfx/jsfxr/confirm.wav', 'active confirm');
    add('game/assets/sfx/alternatives/library.json', 'audition only');
    add('game/assets/sfx/winter-v5/click.ogg', 'audition v5');
    add('game/assets/sfx/winter-v6-ten/click.ogg', 'audition v6');
    const notice = Buffer.from([0xef, 0xbb, 0xbf, 65, 13, 10, 0]);
    add('game/assets/fonts/LICENSE-HarmonyOS-Sans.txt', notice);
    add('game/assets/fonts/HarmonyOS_Sans_SC_Regular.ttf', 'font bytes');
    const directories = () => {
      const dirs = new Set();
      for (const file of files.keys()) {
        let dir = path.dirname(file);
        while (dir !== path.dirname(dir)) { dirs.add(dir); dir = path.dirname(dir); }
      }
      return dirs;
    };
    const read = file => {
      const bytes = files.get(file);
      if (!bytes) throw new Error(`Unexpected virtual read: ${file}`);
      return bytes;
    };
    vi.doMock('node:fs', () => ({
      existsSync: file => files.has(file) || directories().has(file),
      readFileSync: (file, encoding) => encoding ? read(file).toString(encoding) : read(file),
      writeFileSync: (file, bytes) => files.set(file, Buffer.from(bytes)),
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
    const modules = [{ id: path.join(gameRoot, 'src/audio/sound.js'), code: 'assets/sfx/battle/hit-1.ogg' }];
    const context = {
      getModuleIds: () => modules.map(module => module.id),
      getModuleInfo: id => modules.find(module => module.id === id),
    };
    plugin.closeBundle.call(context);
    for (const relative of ['sfx/battle/hit-1.ogg', 'sfx/click1.wav', 'sfx/jsfxr/confirm.wav']) {
      expect(read(path.join(config.build.outDir, 'assets', relative))).toEqual(read(path.join(gameRoot, 'assets', relative)));
    }
    for (const relative of ['sfx/alternatives/library.json', 'sfx/winter-v5/click.ogg', 'sfx/winter-v6-ten/click.ogg']) {
      expect(files.has(path.join(config.build.outDir, 'assets', relative))).toBe(false);
      expect(files.has(path.join(gameRoot, 'assets', relative))).toBe(true);
    }
    expect(read(path.join(config.build.outDir, 'assets/fonts/LICENSE-HarmonyOS-Sans.txt'))).toEqual(notice);
    expect(files.has(path.join(config.build.outDir, 'assets/fonts/HarmonyOS_Sans_SC_Regular.ttf'))).toBe(false);

    // A later build that actually imports an audition catalog must retain it.
    modules.push({ id: path.join(gameRoot, 'assets/sfx/alternatives/library.json'), code: '' });
    plugin.closeBundle.call(context);
    expect(read(path.join(config.build.outDir, 'assets/sfx/alternatives/library.json'))).toEqual(Buffer.from('audition only'));
  });
});
