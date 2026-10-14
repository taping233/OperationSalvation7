#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { gzipSync } = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function mib(bytes) { return `${(bytes / 1024 / 1024).toFixed(2)} MiB`; }
function kib(bytes) { return `${(bytes / 1024).toFixed(1)} KiB`; }

// Read actual local script/module-preload inputs, independent of their chunk names.
// Stylesheets, image preloads, inline scripts, and external URLs are not JS files in this output.
function inspectInitialJs(outDir, html, { exists = existsSync, stat = statSync } = {}) {
  const entryFiles = new Set(), initialFiles = new Set(), failures = [];
  for (const tag of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(script|link)\b([^>]*)>/gi)) {
    const attributes = {};
    for (const match of tag[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
    }
    const isScript = tag[1].toLowerCase() === 'script';
    const scriptType = String(attributes.type || '').toLowerCase().split(';')[0].trim();
    if (isScript && scriptType && !['module', 'text/javascript', 'application/javascript'].includes(scriptType)) continue;
    if (!isScript && !String(attributes.rel || '').toLowerCase().split(/\s+/).includes('modulepreload')) continue;
    const reference = attributes[isScript ? 'src' : 'href'];
    if (!reference || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
    let relative;
    try { relative = decodeURIComponent(reference.split(/[?#]/)[0]); }
    catch { failures.push(`首屏 JS 路径编码无效：${reference}`); continue; }
    if (!/\.(?:js|mjs)$/i.test(relative)) continue;
    const file = path.resolve(outDir, relative.replace(/^\/+/, ''));
    const within = path.relative(outDir, file);
    if (within === '..' || within.startsWith('..' + path.sep) || path.isAbsolute(within)) {
      failures.push(`首屏 JS 引用越出构建目录：${reference}`); continue;
    }
    if (isScript) entryFiles.add(file);
    initialFiles.add(file);
    if (!exists(file) || !stat(file).isFile()) failures.push(`首屏 JS 引用文件缺失：${reference}`);
  }
  if (!entryFiles.size) failures.push('index.html 未引用本地 JS 入口');
  return { entryFiles: [...entryFiles], initialFiles: [...initialFiles], failures };
}

async function run() {
  const { PERFORMANCE_BUDGETS, STARTUP_SCENE_KEYS } = await import(pathToFileURL(path.join(ROOT, 'game/src/core/performance-budgets.js')).href);
  const outDir = process.env.SDT_BUILD_OUT_DIR
    ? path.resolve(ROOT, process.env.SDT_BUILD_OUT_DIR)
    : path.join(ROOT, 'desktop-app', 'game');
  const failures = [];

  if (STARTUP_SCENE_KEYS.length > PERFORMANCE_BUDGETS.startupPreloadMax) {
    failures.push(`启动预热 ${STARTUP_SCENE_KEYS.length} > ${PERFORMANCE_BUDGETS.startupPreloadMax}`);
  }
  if (!existsSync(path.join(outDir, 'index.html'))) failures.push(`构建目录不存在或不完整：${outDir}`);

  const files = walk(outDir);
  const packageBytes = files.reduce((sum, file) => sum + statSync(file).size, 0);
  if (packageBytes > PERFORMANCE_BUDGETS.packageBytesMax) {
    failures.push(`构建体积 ${mib(packageBytes)} > ${mib(PERFORMANCE_BUDGETS.packageBytesMax)}`);
  }

  const groups = new Map();
  for (const file of files) {
    const body = readFileSync(file);
    const hash = createHash('sha256').update(body).digest('hex');
    const group = groups.get(hash) || { bytes: body.length, files: [] };
    group.files.push(file);
    groups.set(hash, group);
  }
  const duplicateBytes = [...groups.values()].reduce((sum, group) => sum + (group.files.length - 1) * group.bytes, 0);
  if (duplicateBytes > PERFORMANCE_BUDGETS.packagedDuplicateBytesMax) {
    failures.push(`重复资源 ${mib(duplicateBytes)} > ${mib(PERFORMANCE_BUDGETS.packagedDuplicateBytesMax)}`);
  }

  const html = existsSync(path.join(outDir, 'index.html')) ? readFileSync(path.join(outDir, 'index.html'), 'utf8') : '';
  const initial = inspectInitialJs(outDir, html);
  failures.push(...initial.failures);
  const entryFiles = [...new Set([...files.filter(file => /[\\/]assets[\\/]js[\\/]index-[^\\/]+\.js$/.test(file)), ...initial.entryFiles])];
  const entryGzip = entryFiles.filter(file => existsSync(file) && statSync(file).isFile())
    .reduce((max, file) => Math.max(max, gzipSync(readFileSync(file)).length), 0);
  if (entryGzip > PERFORMANCE_BUDGETS.entryGzipBytesMax) {
    failures.push(`入口 JS gzip ${kib(entryGzip)} > ${kib(PERFORMANCE_BUDGETS.entryGzipBytesMax)}`);
  }

  const initialJsGzip = initial.initialFiles.filter(file => existsSync(file) && statSync(file).isFile())
    .reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
  if (initialJsGzip > PERFORMANCE_BUDGETS.initialJsGzipBytesMax) {
    failures.push(`首屏 JS gzip ${kib(initialJsGzip)} > ${kib(PERFORMANCE_BUDGETS.initialJsGzipBytesMax)}`);
  }

  const featureFiles = files.filter(file => /[\\/]assets[\\/]js[\\/]battle\.view-[^\\/]+\.js$/.test(file));
  const featureGzip = featureFiles.reduce((max, file) => Math.max(max, gzipSync(readFileSync(file)).length), 0);
  if (!featureFiles.length) failures.push('未生成独立 battle.view feature chunk');
  else if (featureGzip > PERFORMANCE_BUDGETS.featureChunkGzipBytesMax) {
    failures.push(`战斗 feature gzip ${kib(featureGzip)} > ${kib(PERFORMANCE_BUDGETS.featureChunkGzipBytesMax)}`);
  }

  const narrativeFiles = files.filter(file => /[\\/]assets[\\/]js[\\/]vendor-narrative-[^\\/]+\.js$/.test(file));
  const narrativeGzip = narrativeFiles.reduce((max, file) => Math.max(max, gzipSync(readFileSync(file)).length), 0);
  if (!narrativeFiles.length) failures.push('未生成独立 vendor-narrative feature chunk');
  else if (narrativeGzip > PERFORMANCE_BUDGETS.narrativeChunkGzipBytesMax) {
    failures.push(`叙事 feature gzip ${kib(narrativeGzip)} > ${kib(PERFORMANCE_BUDGETS.narrativeChunkGzipBytesMax)}`);
  }

  const cssFiles = files.filter(file => file.endsWith('.css'));
  const cssGzip = cssFiles.reduce((sum, file) => sum + gzipSync(readFileSync(file)).length, 0);
  if (cssGzip > PERFORMANCE_BUDGETS.cssGzipBytesMax) {
    failures.push(`CSS gzip ${kib(cssGzip)} > ${kib(PERFORMANCE_BUDGETS.cssGzipBytesMax)}`);
  }

  console.log(`[perf-budget] startup=${STARTUP_SCENE_KEYS.length}/${PERFORMANCE_BUDGETS.startupPreloadMax}`);
  console.log(`[perf-budget] package=${mib(packageBytes)}, duplicates=${mib(duplicateBytes)}`);
  console.log(`[perf-budget] entry-gzip=${kib(entryGzip)}, initial-js-gzip=${kib(initialJsGzip)}, battle-gzip=${kib(featureGzip)}, narrative-gzip=${kib(narrativeGzip)}, css-gzip=${kib(cssGzip)}`);
  if (failures.length) {
    for (const failure of failures) console.error(`[perf-budget] FAIL: ${failure}`);
    process.exitCode = 1;
  } else {
    console.log('[perf-budget] PASS');
  }
}

if (require.main === module) run().catch(error => {
  console.error('[perf-budget] ERROR', error);
  process.exitCode = 1;
});

module.exports = { run, walk, inspectInitialJs };
