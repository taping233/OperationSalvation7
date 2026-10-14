// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';
const require = createRequire(import.meta.url);
const { inspectInitialJs } = require('../scripts/perf-budget.cjs');

const outDir = '/fixture/desktop-app/game';
function inspect(html, relativeFiles = []) {
  const files = new Set(relativeFiles.map(file => path.join(outDir, file)));
  return inspectInitialJs(outDir, html, { exists: file => files.has(file), stat: () => ({ isFile: () => true }) });
}
function clearFixture({ remains = false, initiallyPresent = true, directory = outDir } = {}) {
  const source = readFileSync(path.resolve('vite.config.js'), 'utf8');
  const node = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body
    .find(node => node.type === 'FunctionDeclaration' && node.id.name === 'clearGeneratedDir');
  let present = initiallyPresent;
  const execSync = vi.fn(() => { if (remains) throw new Error('fixture cleanup failed'); present = false; });
  const context = { ROOT: '/fixture', path, process: { platform: 'linux' }, execSync,
    existsSync: () => present, console: { log: vi.fn(), warn: vi.fn() }, directory };
  let error = null;
  try { vm.runInNewContext(`${source.slice(node.start, node.end)}\nclearGeneratedDir(directory);`, context); }
  catch (caught) { error = caught; }
  return { error, execSync, present };
}

describe('Build output contracts', () => {
  it('accepts the normal Vite entry and counts deduplicated module preloads', () => {
    const result = inspect('<script type="module" src="./assets/js/index-abcd.js"></script>'
      + '<link rel="modulepreload" href="./assets/js/catalog-123.js">'
      + '<link rel="modulepreload" href="./assets/js/catalog-123.js">'
      + '<link rel="stylesheet" href="./assets/style.css">',
    ['assets/js/index-abcd.js', 'assets/js/catalog-123.js']);
    expect(result.failures).toEqual([]);
    expect(result.entryFiles).toEqual([path.join(outDir, 'assets/js/index-abcd.js')]);
    expect(result.initialFiles).toHaveLength(2);
  });

  it('accepts different legal entry names, quote styles, query strings and root-relative preloads', () => {
    const result = inspect("<SCRIPT TYPE='module' SRC='assets/main-entry.mjs?v=1#ready'></SCRIPT>"
      + '<link REL=modulepreload HREF=/assets/vendor.js?v=2>', ['assets/main-entry.mjs', 'assets/vendor.js']);
    expect(result.failures).toEqual([]);
    expect(result.entryFiles).toEqual([path.join(outDir, 'assets/main-entry.mjs')]);
    expect(result.initialFiles).toHaveLength(2);
  });

  it('ignores non-JS links, image preloads and external URLs without treating them as missing local files', () => {
    const result = inspect('<script type="module" src="./assets/main.js"></script>'
      + '<link rel="stylesheet" href="./assets/app.css">'
      + '<link rel="preload" as="image" href="./assets/example.js">'
      + '<link rel="preload" as="font" href="./assets/font.woff2">'
      + '<!-- <script src="./assets/commented.js"></script> -->'
      + '<script type="application/json" src="./assets/example.js"></script>'
      + '<link rel="modulepreload" href="https://cdn.example.com/vendor.js">', ['assets/main.js']);
    expect(result.failures).toEqual([]);
    expect(result.initialFiles).toHaveLength(1);
  });

  it('rejects a build with no local script entry even when a module preload exists', () => {
    const result = inspect('<link rel="modulepreload" href="./assets/vendor.js">', ['assets/vendor.js']);
    expect(result.failures).toContain('index.html 未引用本地 JS 入口');
  });

  it.each([
    ['<script type="module" src="./assets/missing.js"></script>', [], './assets/missing.js'],
    ['<script type="module" src="./assets/main.js"></script><link rel="modulepreload" href="./assets/missing.js">',
      ['assets/main.js'], './assets/missing.js'],
  ])('rejects missing referenced JS: %s', (html, files, missing) => {
    expect(inspect(html, files).failures).toContain(`首屏 JS 引用文件缺失：${missing}`);
  });

  it('rejects output escapes and malformed path encoding', () => {
    const result = inspect('<script src="../outside.js"></script><link rel="modulepreload" href="./%invalid.js">');
    expect(result.failures).toContain('首屏 JS 引用越出构建目录：../outside.js');
    expect(result.failures).toContain('首屏 JS 路径编码无效：./%invalid.js');
  });

  it('fails closed if the old output directory remains after cleanup', () => {
    const result = clearFixture({ remains: true });
    expect(result.execSync).toHaveBeenCalledTimes(1);
    expect(result.error?.message).toContain(`旧产物目录清理失败，构建已停止：${outDir}`);
    expect(result.present).toBe(true);
  });

  it('accepts successfully cleaned or absent self-owned output without touching real directories', () => {
    const cleaned = clearFixture();
    expect(cleaned.error).toBeNull();
    expect(cleaned.execSync).toHaveBeenCalledTimes(1);
    const absent = clearFixture({ initiallyPresent: false });
    expect(absent.error).toBeNull();
    expect(absent.execSync).not.toHaveBeenCalled();
  });

  it('refuses unexpected directories before attempting cleanup', () => {
    const result = clearFixture({ directory: '/fixture/game' });
    expect(result.error?.message).toContain('Refusing to clear unexpected build directory');
    expect(result.execSync).not.toHaveBeenCalled();
  });
});
