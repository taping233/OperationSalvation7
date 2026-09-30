import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
  it('日期历史段只报告历史候选，禁止自动提交不误报', () => {
    const root = fixture();
    put(root, 'docs/RULE.md', '文档状态：现行规范\n## 2026-09-28\n自动提交\n## 当前规则\n不自动提交\n完成后提交代码');
    const result = validateDocumentation(root);
    expect(result.findings).toEqual([
      expect.objectContaining({ line: 3, authority: 'historical-section', reason: '历史日期段命中，仅提示来源核对，不判定现行冲突' }),
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
