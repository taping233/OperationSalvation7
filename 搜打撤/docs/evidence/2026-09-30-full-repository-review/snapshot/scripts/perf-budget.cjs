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

  const entryFiles = files.filter(file => /[\\/]assets[\\/]js[\\/]index-[^\\/]+\.js$/.test(file));
  const entryGzip = entryFiles.reduce((max, file) => Math.max(max, gzipSync(readFileSync(file)).length), 0);
  if (entryGzip > PERFORMANCE_BUDGETS.entryGzipBytesMax) {
    failures.push(`入口 JS gzip ${kib(entryGzip)} > ${kib(PERFORMANCE_BUDGETS.entryGzipBytesMax)}`);
  }

  const html = existsSync(path.join(outDir, 'index.html')) ? readFileSync(path.join(outDir, 'index.html'), 'utf8') : '';
  const initialRefs = [...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="\.\/([^"]+\.js)"/g)].map(match => match[1]);
  const initialJsGzip = [...new Set(initialRefs)].reduce((sum, relative) => {
    const file = path.join(outDir, ...relative.split('/'));
    return sum + (existsSync(file) ? gzipSync(readFileSync(file)).length : 0);
  }, 0);
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

module.exports = { run, walk };
