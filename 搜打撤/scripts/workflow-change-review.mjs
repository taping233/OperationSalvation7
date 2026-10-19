// Read-only change checklist. Selection stays in impact/gate-plan; results stay in workflow evidence.
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { impactQuery } from './impact-query.mjs';
import { fingerprint, freshness, repositoryContext } from './workflow-evidence.mjs';
import { filesUnder } from './workflow-status.mjs';
import { hash } from './workflow-ledger.mjs';
import { changeAdvice, styleCandidates } from './workflow-change-advice.mjs';
import { toProjectPath } from './gate-plan.mjs';

// Navigation hints, not a second gate or a claim of complete UI coverage.
const ROUTES = [
  [/^scripts\//, ['docs/WORKFLOW-TOOLS.md']],
  [/^game\/src\/battle\//, ['docs/rules.md', 'docs/architecture.md']],
  [/^game\/(?:src\/cards|data)\//, ['docs/cards/README.md', 'docs/rules.md', 'docs/terminology.md']],
  [/(?:storage|store|session|settlement|extraction|base-)/, ['docs/save-format.md']],
  [/(?:sound|audio|music|sfx)/, ['docs/audio-system.md']],
  [/(?:perf|render|preload|warmup|scheduler)/, ['docs/performance.md']],
  [/^game\/src\/agent\//, ['docs/agent-protocol.md']],
  [/^game\/(?:css|assets)\/|^game\/src\/ui\/|(?:view|overlay|layers)/,
    ['docs/production/art/VISUAL-BIBLE.md', 'docs/production/art/UI-PAGE-COVERAGE.md']],
  [/^narrative\//, ['docs/design.md', 'docs/game-compendium.md']],
];
const CURRENT_DOCS = [...new Set(['docs/development.md', 'docs/quality-gates.md', ...ROUTES.flatMap(([, docs]) => docs)])];
const matches = (file, selected) => selected.some(item => file === item || file.startsWith(item + '/'));

/** References expose their source line. HTML titles are labels, never evidence of a passed case. */
export function relatedUiCases(root, impactedPaths) {
  const cases = [];
  for (const file of filesUnder(root, 'game/dev').filter(item => item.endsWith('.html'))) {
    const source = readFileSync(path.join(root, file), 'utf8');
    const references = [];
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      // Relative module/CSS references only: do not interpret arbitrary executable expressions.
      for (const match of line.matchAll(/["']((?:\.\.?\/|\/(?:src|css|data|assets)\/)[^"'\s]+)["']/g)) {
        const specifier = match[1].split(/[?#]/)[0];
        const target = specifier.startsWith('/') ? 'game' + specifier
          : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
        if (matches(target, impactedPaths)) references.push({ file: target, line: index + 1 });
      }
    }
    if (references.length || matches(file, impactedPaths)) cases.push({ file,
      title: source.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || path.posix.basename(file),
      status: 'not-verified', references });
  }
  return cases;
}

function documentsFor(root, paths) {
  const routed = new Set(['docs/quality-gates.md']);
  if (paths.some(file => file.startsWith('game/'))) routed.add('docs/development.md');
  for (const [pattern, documents] of ROUTES) if (paths.some(file => pattern.test(file))) {
    for (const file of documents) routed.add(file);
  }
  const result = [];
  for (const file of CURRENT_DOCS) {
    const present = existsSync(path.join(root, file));
    const references = present ? readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).flatMap((line, index) => {
      const matched = paths.filter(target => line.includes(target) || target.startsWith('game/src/') && line.includes(target.slice('game/src/'.length)));
      return matched.length ? [{ line: index + 1, paths: matched }] : [];
    }) : [];
    if (routed.has(file) || references.length) result.push({ file, present, reason: references.length ? 'source-reference' : 'navigation-hint', references });
  }
  return result;
}

function evidenceFile(root, value) {
  const relative = toProjectPath(value, root);
  if (!relative.startsWith('docs/evidence/')) throw new Error('报告与日志必须位于项目 docs/evidence/');
  const resolvedRoot = realpathSync(root), absolute = path.join(resolvedRoot, relative);
  for (let current = absolute; current !== resolvedRoot; current = path.dirname(current)) {
    if (lstatSync(current).isSymbolicLink()) throw new Error('报告与日志路径不得经过符号链接');
  }
  if (!lstatSync(absolute).isFile()) throw new Error('报告与日志必须是文件');
  return { relative, absolute };
}

function inspectResult(root, input, plan, paths) {
  if (!input) return { status: 'not-provided', tests: [], reusableReceipt: false };
  try {
    const file = evidenceFile(root, input);
    const report = JSON.parse(readFileSync(file.absolute, 'utf8'));
    if (report.kind !== 'automated-local-check' || report.schemaVersion !== 1 || !report.before || !report.after
      || !report.validation || !Array.isArray(report.validation.tests)) throw new Error('只接受 workflow verify 的工作区报告');
    const log = evidenceFile(root, report.log);
    if (hash(readFileSync(log.absolute)) !== report.logSha256) throw new Error('报告日志哈希不匹配');
    const current = fingerprint(root, { documents: report.after.documents ?? false,
      assets: report.after.assets ?? false, roots: report.after.selection?.roots });
    const reviewed = freshness(report, current);
    const recordedTests = report.validation.tests;
    const missingTests = plan.tests.filter(test => !recordedTests.includes(test));
    const coveredFiles = new Set((report.after.manifest ?? []).filter(entry => !entry.kind).map(entry => entry.file));
    const untrackedPaths = paths.filter(file => !coveredFiles.has(file)
      && ![...coveredFiles].some(candidate => candidate.startsWith(file + '/')));
    const scope = plan.mode === 'skip' ? 'no-test-plan' : untrackedPaths.length ? 'partial' : report.validation.mode === 'full' ? 'full-local-check'
      : plan.mode === 'full' ? 'partial' : missingTests.length || untrackedPaths.length ? 'partial' : 'selected-tests';
    return { report: file.relative, status: reviewed.result, outcome: report.outcome,
      tests: recordedTests, missingTests, untrackedPaths, scope, freshness: reviewed, reusableReceipt: false };
  } catch (error) {
    return { status: 'invalid', error: error.message, tests: [], reusableReceipt: false };
  }
}

export function reviewChange(root, { paths, input } = {}) {
  if (!Array.isArray(paths) || !paths.length || paths.some(file => typeof file !== 'string' || !file.trim())) {
    throw new Error('review 必须显式提供非空 --paths；不猜测恢复副本的改动清单');
  }
  if (paths.some(file => !toProjectPath(file, root))) throw new Error('review 请指定项目内具体目录或文件，不能用项目根目录');
  const repository = repositoryContext(root);
  const impact = impactQuery(paths, { root });
  const impacted = [...new Set([...impact.paths, ...impact.reverse.direct, ...impact.reverse.transitive.map(item => item.file)])];
  const uiRequired = impact.paths.some(file => /^game\/(?:src|css|assets|data|dev)(?:\/|$)/.test(file) || /^narrative(?:\/|$)/.test(file));
  const uiCases = relatedUiCases(root, impacted);
  const docs = documentsFor(root, impact.paths);
  const verification = inspectResult(root, input, impact.plan, impact.paths);
  return { schemaVersion: 1, kind: 'change-review', readOnly: true, repository,
    paths: impact.paths, missingPaths: impact.missingPaths,
    registry: { editingRowCount: impact.registry.editingRowCount, hits: impact.registry.hits },
    plan: impact.plan, documents: docs,
    advice: changeAdvice(root, impact.paths), styles: styleCandidates(root, impact.paths),
    ui: { status: uiRequired ? 'needs-manual-review' : 'not-required-for-tool-only-change', candidates: uiCases,
      limits: ['只按静态引用寻找用例候选，不是完整覆盖清单；实页与真实输入按质量门单独验证。'] },
    verification, commands: impact.commands,
    gaps: [...impact.missingPaths.map(file => '路径缺失，确认删除或拼写：' + file),
      ...docs.filter(item => !item.present).map(item => '现行文档缺失：' + item.file),
      ...(uiRequired && !uiCases.length ? ['未找到静态关联的UI用例，需要人工选择真实入口。'] : []),
      ...(verification.status === 'not-provided' ? ['未提供验证报告，测试尚未核验。'] : [])],
    limits: [repository.reason, '路径由调用者显式声明，不代表完整工作区 diff。',
      '不运行测试或浏览器，不改资产守卫，不产生通过/提交授权；full/skip 保留原门选择。'] };
}
