import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocumentation } from '../scripts/index-validation.mjs';
import { applyTask, planTask, readTask } from '../scripts/workflow-task.mjs';
import { taskInputFromValues } from '../scripts/workflow-task-input.mjs';

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
  it('可复制 task 直接字段示例通过适配及真实任务模型，关闭仍为完成未提交', () => {
    const guide = readFileSync(resolve(repoRoot, 'docs/WORKFLOW-TOOLS.md'), 'utf8');
    const readExample = action => {
      const found = guide.match(new RegExp(`# task-${action}-example\\r?\\n([^\\r\\n]+)`));
      expect(found, `${action} 示例必须保留可复制 CLI`).not.toBeNull();
      const cli = found[1].split(`workflow -- task ${action} `)[1].split(' | ')[0];
      const args = [...cli.matchAll(/"([^"]*)"|(\S+)/g)].map(match => match[1] ?? match[2]);
      const { values } = parseArgs({ args, options: {
        task: { type: 'string' }, owner: { type: 'string' }, goal: { type: 'string' }, paths: { type: 'string' },
        'done-when': { type: 'string', multiple: true }, stage: { type: 'string' }, 'done-when-confirmed': { type: 'boolean' },
        check: { type: 'string', multiple: true }, unverified: { type: 'string', multiple: true }, json: { type: 'boolean' },
        apply: { type: 'boolean' }, expect: { type: 'string' },
      } });
      expect(values.task).toBe('WF-example');
      expect(values.owner).toBe('Friday');
      if (action === 'start') {
        expect(values.apply, '示例必须创建任务，不能只预览后直接关闭').toBe(true);
        expect(values.expect, '新建仍须拒绝覆盖既有任务').toBe('absent');
      }
      return taskInputFromValues(action, values);
    };
    const fixture = mkdtempSync(resolve(os.tmpdir(), 'sdt-doc-task-example-'));
    const identity = { id: 'WF-example', date: '2026-10-02', owner: 'Friday' };
    const cleanup = () => {
      const prefix = resolve(os.tmpdir(), 'sdt-doc-task-example-');
      if (!fixture.startsWith(prefix) || fixture.slice(prefix.length).includes('\\') || fixture.slice(prefix.length).includes('/')) throw new Error('拒绝清理非自有示例 fixture');
      rmSync(fixture, { recursive: true, force: true });
    };
    try {
      mkdirSync(resolve(fixture, 'docs'), { recursive: true });
      const start = planTask(fixture, { ...identity, action: 'start', input: readExample('start') });
      applyTask(fixture, start, 'absent');
      expect(readTask(fixture, identity).task.stage).toBe('doing');
      const close = planTask(fixture, { ...identity, action: 'close', input: readExample('close') });
      applyTask(fixture, close, close.expectedSha256);
      expect(readTask(fixture, identity).task).toMatchObject({ stage: 'complete-uncommitted', closure: { doneWhenConfirmed: true } });
      expect(guide).toContain('--apply --expect $closePlan.expectedSha256');
    } finally {
      cleanup();
    }
  });

  it('混树示例先审查范围，再暂存、冻结、核验类型化 receipt 状态和相同计划执行', () => {
    const guide = readFileSync(resolve(repoRoot, 'docs/WORKFLOW-TOOLS.md'), 'utf8');
    const example = guide.slice(guide.indexOf('### 混树：'), guide.indexOf('### 仅需跨会话跟踪时：'));
    const steps = ['workflow -- ship --paths $completePaths --json', 'git add -- $files', 'workflow -- staged --task WF-example --plan --json',
      'workflow -- staged --task WF-example --json', '$frozen.validation.reusableReceipt',
      'workflow -- ship --paths $completePaths --receipt $receipt --json',
      'workflow -- ship --paths $completePaths --receipt $receipt --apply --expect $ship.planSha256 --json'];
    let previous = -1;
    for (const step of steps) {
      const position = example.indexOf(step);
      expect(position, step).toBeGreaterThan(previous);
      previous = position;
    }
    expect(example).toContain('passed receipt 来自实际执行通过的检查，空 index 和纯文档 skip 单列状态');
    expect(example).toContain('按明确提交授权和已核对计划执行');
    expect(example).toContain('$ship.receiptValidity.eligible');
    expect(example).toContain('失败保留现场');
  });

  // 隔离快照只含已暂存文件且按 index 字节落盘，档案原文/链接可达在快照内不成立；staged 门内跳过，工作树门与 CI 覆盖。
  it.skipIf(Boolean(process.env.SDT_STAGED_SNAPSHOT))('流程工具现行入口与归档索引的链接可达，快照原文不追改', () => {
    const documents = ['README.md', 'docs/WORKFLOW-TOOLS.md',
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
    // 与 docs:check 共用契约：历史 source 可退役，归档原文及现行替代入口不可丢失。
    expect(validateDocumentation(repoRoot).findings.filter(item => !item.review)).toEqual([]);
  });
  it('src/README 域表与 game/src 非空顶层目录一一对应（generated 除外，正文单列）', () => {
    const srcDir = resolve(repoRoot, 'game/src');
    const actual = readdirSync(srcDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name !== 'generated'
        && readdirSync(resolve(srcDir, entry.name), { recursive:true, withFileTypes:true }).some(child => child.isFile()))
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
