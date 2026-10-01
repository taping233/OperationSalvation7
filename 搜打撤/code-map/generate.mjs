#!/usr/bin/env node
/* code-map 数据生成器：扫描 game/src，产出 data.js（window.CODE_MAP_DATA）
 * 用法：node generate.mjs [srcRoot] （默认 ../game/src）
 * 口径：模块大小=真实行数；域=src 下一级目录（battle 取两级）；
 *       边=相对 import/动态 import/副作用导入；入口=无人引用的文件。
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, resolve, posix, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = resolve(here, process.argv[2] || '../game/src');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(js|d\.ts)$/.test(name)) acc.push(p);
  }
  return acc;
}

const files = walk(srcRoot);
const byPath = new Map(); // abs path -> id
for (const f of files) {
  const rel = f.slice(srcRoot.length + 1).split(sep).join('/');
  byPath.set(f, rel.replace(/\.(js|d\.ts)$/, ''));
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

const nodes = [];
const linkMap = new Map(); // 's|t|k' -> true
const extDeps = new Map();

for (const f of files) {
  const id = byPath.get(f);
  const raw = readFileSync(f, 'utf8');
  const lines = raw.split('\n').length;
  const src = stripComments(raw);

  const imports = [];
  const addImport = (spec, kind) => {
    if (!spec.startsWith('.')) {
      if (!extDeps.has(id)) extDeps.set(id, new Set());
      extDeps.get(id).add(spec);
      return;
    }
    const target = resolve(dirname(f), spec);
    const tid = byPath.get(target);
    if (tid && tid !== id) imports.push([tid, kind]);
  };
  for (const m of src.matchAll(/import\s*['"]([^'"]+)['"]\s*;?/g)) addImport(m[1], 'side');
  for (const m of src.matchAll(/import\s*\(?\s*[\s\S]*?from\s*['"]([^'"]+)['"]/g)) addImport(m[1], 'static');
  for (const m of src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) addImport(m[1], 'dyn');
  for (const m of src.matchAll(/export\s[\s\S]{0,200}?from\s*['"]([^'"]+)['"]/g)) addImport(m[1], 'static');

  const exports = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)/g)) exports.add(m[1]);
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z0-9_$]+)/g)) exports.add(m[1]);
  for (const m of src.matchAll(/export\s+class\s+([A-Za-z0-9_$]+)/g)) exports.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (let part of m[1].split(',')) {
      part = part.trim(); if (!part) continue;
      const name = part.split(/\s+as\s+/).pop().trim();
      if (/^[A-Za-z0-9_$]+$/.test(name)) exports.add(name);
    }
  }
  if (/export\s+default\b/.test(src)) exports.add('default');

  // 文件头描述：首个块注释第一行（去文件名前缀）
  let desc = '';
  const hm = raw.match(/\/\*+[\s\S]?\s*([^\n*]{4,80})/);
  if (hm) desc = hm[1].replace(/^[=\-—\s]+/, '').replace(/[=*\s]+$/, '').trim();

  const seg = id.split('/');
  const cluster = seg[0] === 'battle' && seg.length > 2 ? seg.slice(0, 2).join('/') : seg[0];
  nodes.push({
    id, file: id, cluster, lines,
    kind: /\.d\.ts$/.test(f) ? 'dts' : 'js',
    imports: imports.map(([t, k]) => ({ t, k })),
    exports: [...exports].sort(),
    desc,
  });
  for (const [t, k] of imports) {
    const key = `${id}|${t}|${k}`;
    linkMap.set(key, true);
  }
}

// 入口 = 没有任何人 static/side 引用它
const referenced = new Set();
for (const n of nodes) for (const i of n.imports) referenced.add(i.t);
for (const n of nodes) n.entry = !referenced.has(n.id) && n.kind === 'js';

// boot 顺序表（boot-order.js 的 BOOT_ORDER 数组）
let bootOrder = [];
try {
  const bo = readFileSync(join(srcRoot, 'boot-order.js'), 'utf8');
  const m = bo.match(/BOOT_ORDER\s*=\s*\[([\s\S]*?)\]/);
  if (m) bootOrder = [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1]);
} catch { /* boot-order 缺失时跳过 */ }

// 聚合
const clusters = new Map();
const clusterOf = (id) => {
  const seg = id.split('/');
  return seg[0] === 'battle' && seg.length > 2 ? seg.slice(0, 2).join('/') : seg[0];
};
for (const n of nodes) {
  const c = clusterOf(n.id);
  if (!clusters.has(c)) clusters.set(c, { id: c, files: 0, lines: 0 });
  const cl = clusters.get(c);
  cl.files++; cl.lines += n.lines;
}
// battle 的父容器（二级域折叠到 battle）
clusters.set('__battle', { id: 'battle', files: 0, lines: 0 });
for (const [c, cl] of [...clusters]) {
  if (c.startsWith('battle/')) {
    clusters.get('__battle').files += cl.files;
    clusters.get('__battle').lines += cl.lines;
  }
}
// boot 根文件组
clusters.set('boot-root', { id: 'boot-root', files: 0, lines: 0 });
for (const n of nodes) {
  if (!n.id.includes('/')) {
    const cl = clusters.get('boot-root');
    cl.files++; cl.lines += n.lines;
  }
}

// 边列表
const links = [...linkMap.keys()].map((k) => {
  const [s, t, kk] = k.split('|');
  return { s, t, k: kk };
});

const data = {
  generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  srcRoot: '搜打撤/game/src',
  totalFiles: nodes.length,
  totalLines: nodes.reduce((a, n) => a + n.lines, 0),
  clusters: [...clusters.values()].sort((a, b) => b.lines - a.lines),
  bootOrder,
  nodes,
  links,
};

const out = `/* 自动生成于 ${data.generatedAt}，来源 generate.mjs，请勿手改 */\nwindow.CODE_MAP_DATA = ${JSON.stringify(data)};\n`;
writeFileSync(join(here, 'data.js'), out, 'utf8');
console.log(`nodes=${nodes.length} links=${links.length} clusters=${data.clusters.length} lines=${data.totalLines}`);
console.log(`entry=${nodes.filter((n) => n.entry).map((n) => n.id).join(', ')}`);
