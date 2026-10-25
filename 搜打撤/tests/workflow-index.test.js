import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { validateDocumentation } from '../scripts/index-validation.mjs';

const owned = [];
function fixture() {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'sdt-index-test-'));
  owned.push(repo);
  const root = path.join(repo, 'game');
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}
function put(root, file, text) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), text);
}
afterEach(() => {
  for (const repo of owned.splice(0)) {
    if (!repo.startsWith(path.join(os.tmpdir(), 'sdt-index-test-'))) throw new Error('拒绝清理非自有 fixture');
    rmSync(repo, { recursive: true, force: true });
  }
});

describe('现行文档机械复核', () => {
  it('相对链接按来源目录解析，忽略外部和锚点，保留行号', () => {
    const root = fixture();
    put(root, 'docs/target with space.md', '# Target');
    put(root, 'docs/ROOT.md', '# 入口\n[有效](<target%20with%20space.md>)\n[缺失](missing.md)\n[外部](https://example.com) [锚点](#target)');
    const result = validateDocumentation(root);
    expect(result.checkedRelativeLinks).toBe(2);
    expect(result.findings).toEqual([expect.objectContaining({ file: 'docs/ROOT.md', line: 3, kind: 'missing-relative-link' })]);
  });
  it('跳过历史存放目录和代码块，检查 production 与根规则', () => {
    const root = fixture();
    put(root, '../AGENTS.md', '仅使用 Codex 内置浏览器');
    put(root, 'docs/RULE.md', '文档状态：现行规范\n```md\n[缺失](gone.md)\n自动提交\n```\n使用当前平台内置浏览器');
    put(root, 'docs/production/qa/RULE.md', '文档状态：现行规范\n定向→全量→实页');
    for (const folder of ['archive', 'evidence', 'previews', 'modules']) put(root, `docs/production/${folder}/old.md`, '[缺失](gone.md)\n自动提交');
    const result = validateDocumentation(root);
    expect(result.scannedFiles).toEqual(['../AGENTS.md', 'docs/RULE.md', 'docs/production/qa/RULE.md']);
    expect(result.findings.map(item => item.kind)).toEqual(['codex-only-browser', 'fixed-full-acceptance']);
    expect(result.findings.every(item => item.authority === 'current-rule')).toBe(true);
  });
  it('日期历史段与禁止自动提交不产生现行规则噪声', () => {
    const root = fixture();
    put(root, 'docs/RULE.md', '文档状态：现行规范\n## 2026-09-28\n自动提交\n## 当前规则\n不自动提交\n完成后提交代码');
    const result = validateDocumentation(root);
    expect(result.findings).toEqual([
      expect.objectContaining({ line: 6, authority: 'current-rule', kind: 'implicit-commit' }),
    ]);
  });
  it('同正文只提示职责，未分类文档不会伪装成现行规则', () => {
    const root = fixture();
    put(root, 'docs/A.md', '# 工作笔记\n三级验收');
    put(root, 'docs/B.md', '# 工作笔记\n三级验收');
    const result = validateDocumentation(root);
    expect(result.findings.filter(item => item.kind === 'identical-document')).toHaveLength(2);
    expect(result.findings.every(item => item.authority === 'unclassified-reference' && item.review)).toBe(true);
    expect(result.limits).toContain('模式命中只作人工复核候选，不证明全项目语义一致');
  });
  it('新双端口径及否定旧提交规则不报旧规则疑点', () => {
    const root = fixture();
    put(root, '../AGENTS.md', '浏览器操作/游戏验收仅用当前平台内置浏览器（Codex 或 ZCode）');
    put(root, 'docs/quality-gates.md', '删除获批不代表自动提交获批。\n提交须老板明确授权，不要求固定“双提交”。');
    expect(validateDocumentation(root).findings).toHaveLength(0);
    expect(() => validateDocumentation(path.join(root, 'nonexistent'))).toThrow('docs 目录不可达');
  });
});

describe('口径真源检测 duplicated-rule', () => {
  it('真源外现行段的完整表述命中收敛候选，真源文件自身不报', () => {
    const root = fixture();
    put(root, 'AGENTS.md', '# 项目约束\n浏览器操作仅用当前平台内置浏览器，只验当前窗口。\n');
    put(root, 'docs/QUICKSTART.md', '# 上手\n浏览器操作仅用当前平台内置浏览器，多尺寸须明确要求；不可用记录阻塞。\n');
    const result = validateDocumentation(root);
    const dup = result.findings.filter(item => item.kind === 'duplicated-rule');
    expect(dup).toHaveLength(1);
    expect(dup[0].file).toBe('docs/QUICKSTART.md');
    expect(dup[0].topic).toBe('内置浏览器边界');
  });
  it('指针式引用与历史段不命中', () => {
    const root = fixture();
    put(root, 'AGENTS.md', '# 项目约束\nGodot/Unity/EXE 冻结，只开发 Vite。\n');
    put(root, 'docs/guide.md', '# 指南\n浏览器边界见 AGENTS.md；冻结口径见总纲。\n\n## 2026-09-01 历史记录\n当时决定 Godot/Unity 冻结。\n');
    const result = validateDocumentation(root);
    expect(result.findings.filter(item => item.kind === 'duplicated-rule')).toEqual([]);
  });
  it('包含完整短语的指针与分级导航不报重复规则', () => {
    const root = fixture();
    put(root, 'docs/guide.md', '仅用内置浏览器，完整口径见根 AGENTS.md。\n| B 档必须验收 | 见质量门 |\nA 档 / B 档入口见 quality-gates.md。\n每次交付说明最近全量覆盖版本；不要从落库推导固定全量。');
    expect(validateDocumentation(root).findings.filter(item => item.kind === 'duplicated-rule')).toEqual([]);
    expect(validateDocumentation(root).findings.filter(item => item.kind === 'fixed-full-acceptance')).toEqual([]);
  });
});

describe('文档结构硬契约', () => {
  function archive(root) {
    const original = '历史执行器原文字节';
    put(root, 'docs/archive/workflow-test/original.txt', original);
    put(root, 'docs/WORKFLOW-TOOLS.md', '# 现行替代入口');
    const item = { source: 'scripts/retired.mjs', target: 'docs/archive/workflow-test/original.txt', replacedBy: 'docs/WORKFLOW-TOOLS.md',
      sha256: createHash('sha256').update(original).digest('hex') };
    put(root, 'docs/archive/workflow-test/manifest.json', JSON.stringify({ items: [item] }));
    put(root, 'docs/archive/workflow-test/source-manifest.json', JSON.stringify({ items: [] }));
    return item;
  }
  it('允许来源退役；原文字节和替代入口必须仍可核对', () => {
    const root = fixture();
    archive(root);
    expect(validateDocumentation(root).ok).toBe(true);
    put(root, 'docs/archive/workflow-test/original.txt', '被改写');
    expect(validateDocumentation(root)).toMatchObject({ ok: false, findings: [expect.objectContaining({ kind: 'invalid-archive-contract', review: false })] });
  });
  it('缺失替代入口、越界归档路径都失败', () => {
    const root = fixture();
    const item = archive(root);
    item.replacedBy = 'docs/missing.md';
    put(root, 'docs/archive/workflow-test/manifest.json', JSON.stringify({ items: [item] }));
    expect(validateDocumentation(root).ok).toBe(false);
    item.replacedBy = 'docs/WORKFLOW-TOOLS.md';
    item.target = '../outside.txt';
    put(root, '../outside.txt', '历史执行器原文字节');
    put(root, 'docs/archive/workflow-test/manifest.json', JSON.stringify({ items: [item] }));
    expect(validateDocumentation(root).ok).toBe(false);
  });
  it('空的退役目录不算源码域，新增实际文件后必须登记域表', () => {
    const root = fixture();
    put(root, 'game/src/README.md', '| 目录 | 域 |\n| --- | --- |');
    mkdirSync(path.join(root, 'game/src/retired'), { recursive:true });
    const drift = () => validateDocumentation(root).findings.filter(item => item.kind === 'domain-table-drift');
    expect(drift()).toEqual([]);
    put(root, 'game/src/retired/current.js', 'export const value = 1;');
    expect(drift()).toHaveLength(1);
    put(root, 'game/src/README.md', '| '+String.fromCharCode(96)+'retired/'+String.fromCharCode(96)+' | 域 |');
    expect(drift()).toEqual([]);
  });
  it('预算以 UTF-8 字节计数，域表漂移阻断', () => {
    const root = fixture();
    put(root, '../AGENTS.md', '规'.repeat(2049));
    for (const file of ['README', 'QUICKSTART', 'WORKFLOW-TOOLS', 'quality-gates']) put(root, `docs/${file}.md`, '文'.repeat(3100));
    put(root, 'game/src/README.md', '| `missing/` | 域 |');
    mkdirSync(path.join(root, 'game/src/actual'), { recursive: true });
    const result = validateDocumentation(root);
    expect(result.ok).toBe(false);
    expect(result.findings.filter(item => !item.review).map(item => item.kind)).toEqual(['rule-budget', 'rule-budget', 'domain-table-drift']);
  });
});
