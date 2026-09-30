#!/usr/bin/env node
// 沉淀物退役候选清单（2026-09-29 体系降本批）：把「逐个想起来再问」的周期性
// 清理合并成低频批量报批。只列候选、不删不移任何文件；删除仍走报批铁律。
// 用法：node scripts/doc-retirement-candidates.mjs [--days=30]（或 npm run docs:retire）
import { readdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = resolve(repoDir, 'docs');
const days = Number(process.argv.find(arg => arg.startsWith('--days='))?.split('=')[1] ?? 30);
const cutoff = Date.now() - days * 86400000;

const candidates = [];
const ageOf = full => (Date.now() - statSync(full).mtimeMs) / 86400000;
for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
  const full = resolve(docsDir, entry.name);
  if (entry.isDirectory() && entry.name === 'evidence') {
    for (const sub of readdirSync(full, { withFileTypes: true })) {
      const subPath = resolve(full, sub.name);
      if (sub.isDirectory() && statSync(subPath).mtimeMs < cutoff) {
        candidates.push({ path: `docs/evidence/${sub.name}/`, age: ageOf(subPath) });
      }
    }
  } else if (entry.isFile() && /\d{4}-\d{2}-\d{2}/.test(entry.name) && statSync(full).mtimeMs < cutoff) {
    candidates.push({ path: `docs/${entry.name}`, age: ageOf(full) });
  }
}

candidates.sort((a, b) => b.age - a.age);
if (!candidates.length) {
  console.log(`沉淀物体检：${days} 天内无退役候选（范围：docs/evidence 子目录 + docs 根带日期文档）。`);
} else {
  console.log(`退役候选（mtime 距今超 ${days} 天，仅列清单；处置方式归档/删除均须老板拍板）：`);
  for (const { path, age } of candidates) console.log(`- ${path}（${Math.floor(age)} 天前）`);
}
