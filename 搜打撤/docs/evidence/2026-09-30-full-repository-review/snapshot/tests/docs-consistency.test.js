import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// 文档一致性守卫（2026-09-29 体系降本批）：把「文档声称的结构事实」交给测试盯，
// 漂移当场红，不再依赖人或会话记得对账。范围只覆盖现行文档层（docs 根 +
// game/src/README.md）；archive/evidence 等历史层链接腐化不在此守卫内。
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const domainTableNames = () => {
  const readme = readFileSync(resolve(repoRoot, 'game/src/README.md'), 'utf8');
  const names = [];
  for (const line of readme.split('\n')) {
    const first = line.match(/^\|\s*`([^`]+)`\s*\|/);
    if (first && first[1].endsWith('/')) names.push(first[1].slice(0, -1));
  }
  return names;
};

const relativeLinkTargets = markdown => {
  const targets = [];
  for (const match of markdown.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
    if (!target || /^(https?:|mailto:|#)/i.test(target)) continue;
    // 只认「像路径」的目标：相对前缀、含斜杠，或带文件扩展名；
    // 排除行内代码文字（如表格里的 `(dataset)`、`(...args)`）。
    const looksLikePath = /^\.?\.?\//.test(target) || target.includes('/')
      || /\.(?:md|markdown|png|jpe?g|gif|svg|webp|html?|tsv|json|css|js|mjs)$/i.test(target);
    if (looksLikePath) targets.push(decodeURI(target));
  }
  return targets;
};

describe('文档一致性守卫', () => {
  it('流程工具现行入口与归档索引的链接可达，快照原文不追改', () => {
    const documents = ['README.md', 'docs/WORKFLOW-TOOLS.md', 'docs/SPEC-PROCESS.md',
      'docs/production/management/ITERATION-BOARD.md', 'docs/production/management/NEXT-CYCLE-TECH-PLAN.md',
      'docs/production/engineering/MAKER-HANDBOOK.md', 'docs/production/qa/ACCEPTANCE-MATRIX.md',
      'docs/archive/workflow-2026-09-30/README.md', 'docs/archive/workflow-routing-2026-09-30/README.md',
      'docs/archive/workflow-completion-2026-09-30/README.md'];
    for (const document of documents) {
      const file = resolve(repoRoot, document);
      for (const target of relativeLinkTargets(readFileSync(file, 'utf8'))) {
        expect(existsSync(resolve(file, '..', target)), `${document} -> ${target}`).toBe(true);
      }
    }
    const items = ['workflow-2026-09-30', 'workflow-routing-2026-09-30', 'workflow-completion-2026-09-30'].flatMap(batch =>
      JSON.parse(readFileSync(resolve(repoRoot, 'docs/archive', batch, 'manifest.json'), 'utf8')).items);
    items.push(...JSON.parse(readFileSync(resolve(repoRoot, 'docs/archive/workflow-completion-2026-09-30/source-manifest.json'), 'utf8')).items);
    expect(items).toHaveLength(12);
    for (const item of items) {
      expect(existsSync(resolve(repoRoot, item.source))).toBe(true);
      expect(existsSync(resolve(repoRoot, item.target))).toBe(true);
      expect(existsSync(resolve(repoRoot, item.replacedBy))).toBe(true);
      expect(createHash('sha256').update(readFileSync(resolve(repoRoot, item.target))).digest('hex')).toBe(item.sha256);
    }
  });
  it('src/README 域表与 game/src 顶层目录一一对应（generated 除外，正文单列）', () => {
    const srcDir = resolve(repoRoot, 'game/src');
    const actual = readdirSync(srcDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name !== 'generated')
      .map(entry => entry.name);
    const table = domainTableNames();
    expect(new Set(table).size).toBe(table.length); // 表内无重复
    expect(table.slice().sort()).toEqual(actual.sort());
  });

  it('现行文档（docs 根）的相对链接无死链', () => {
    const docsDir = resolve(repoRoot, 'docs');
    const broken = [];
    for (const entry of readdirSync(docsDir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const docDir = resolve(docsDir, entry.name, '..');
      for (const target of relativeLinkTargets(readFileSync(resolve(docsDir, entry.name), 'utf8'))) {
        if (!existsSync(resolve(docDir, target))) broken.push(`${entry.name} -> ${target}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
