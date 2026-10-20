#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HELP = `项目流程工具（默认只读；ship --apply 需单独提交授权；不推送/启服/build）
  doctor [--staged] [--input <报告>] [--json]        只读项目/工具/依赖/hooks/文档/台账轻预检
  status [--task <编号>] [--paths <逗号分隔路径>] [--details] [--json]
                                          按任务接手，默认短摘要
  task <start|update|close> --task <编号> --owner <负责人> --input <JSON>
       [--date YYYY-MM-DD] [--apply --expect absent|SHA256|auto]
                                          唯一执行记录；默认预览
                                          --expect auto（R4）：单会话一步落，写前自动
                                          复核预览基线，他人插手即拒绝，等效人工 SHA 确认
  task <read|summary> [--task <编号>]       从 task.json 只读生成状态
  task start/update 可直接 --goal <目标> --paths <CSV> --done-when <标准>（可重复）--stage <状态>
  task close 可直接 --stage <终态> --done-when-confirmed --check <kind:result:说明或报告>
       --unverified <未核项>（check/unverified可重复；显式空项用--checks-none/--unverified-none）
                                          直接字段与--input互斥，仍走同一任务模型与SHA锁
  memory [--query <关键词> --source <codex|zcode|both> --limit <1..10>] [--home <目录>] [--codex-home <目录>] [--zcode-home <目录>]
                                          只读发现当前项目记忆索引，不倾倒正文
  docs                                    检查现行流程链接/重复/明确冲突候选
  sweep [--max-age-days <天数>]           停滞/中断任务只读检测；处置走 task close + ledger close
  browser import --input <内置快照JSON> --task <编号>
  browser compare --before <快照JSON> --after <快照JSON> --task <编号>
                                          保存内置浏览器证据，不启动浏览器
  staged --task <编号> [--plan]             隔离验证真实 Git index，不混入未暂存内容
  find --query <关键词> [--history]        开工前查现有代码/工具/规范；历史单独检索
  ship [--message <总述>] [--paths <完成范围>] [--receipt <冻结报告>] [--json]
       [--apply --expect <planSha256>]   按授权打包完成改动；计划过滤编辑/待决/中间文件
                                         复核文件、HEAD/index 与属地基线，逐组过门；不自动授权
  ledger <registry|pending> list           唯一台账 + SHA256
  ledger <registry|pending> <add|update|close> --key <编号> --input <JSON文件>
         [--owner <负责人>] [--apply --expect <SHA256|auto>]
                                          默认预览；JSON 为 {"cells":[...]}
  verify --task <编号> <--tests <逗号分隔路径>|--paths <逗号分隔路径>|--full|--suite>
         [--date YYYY-MM-DD] [--plan]       复用现有验收门；运行时自动记录证据
  review --paths <逗号分隔路径> [--input <verify报告JSON>] [--json]
                                          只读关联现行文档、测试、UI用例与已有结果；无Git明确降级
  evidence --input <报告JSON>              校验证据指纹是否仍匹配，不自动免验
  archive plan                            重复正文/冲突措辞的只读复核候选
  archive snapshot --task <批次> --paths <逗号分隔现行Markdown路径>
         [--replaced-by <现行入口>]        留存原文与哈希，不移动/删除源文件
  --suite 仅全量 Vitest；--full 为现有完整本地门，两者均不含实页/build。
  所有命令支持 --json；写台账前仍需确认归属。`;

function list(value) {
  if (!value) return undefined;
  const result = value.split(',').map(item => item.trim());
  if (result.some(item => !item)) throw new Error('逗号分隔路径不得有空项');
  return result;
}

async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    json: { type: 'boolean' }, help: { type: 'boolean' }, history: { type: 'boolean' }, apply: { type: 'boolean' }, details: { type: 'boolean' },
    staged: { type: 'boolean' }, full: { type: 'boolean' }, suite: { type: 'boolean' }, plan: { type: 'boolean' }, query: { type: 'string' }, key: { type: 'string' },
    owner: { type: 'string' }, input: { type: 'string' }, expect: { type: 'string' }, task: { type: 'string' }, message: { type: 'string' },
    tests: { type: 'string' }, paths: { type: 'string' }, date: { type: 'string' }, 'replaced-by': { type: 'string' },
    home: { type: 'string' }, 'codex-home': { type: 'string' }, 'zcode-home': { type: 'string' }, limit: { type: 'string' }, source: { type: 'string' },
    before: { type: 'string' }, after: { type: 'string' }, 'max-age-days': { type: 'string' }, receipt: { type: 'string' },
    goal: { type: 'string' }, 'done-when': { type: 'string', multiple: true }, stage: { type: 'string' },
    'done-when-confirmed': { type: 'boolean' }, check: { type: 'string', multiple: true },
    unverified: { type: 'string', multiple: true }, 'checks-none': { type: 'boolean' }, 'unverified-none': { type: 'boolean' },
  } });
  if (values.help || !positionals.length) {
    process.stdout.write(values.json ? JSON.stringify({ ok: true, help: HELP }) + '\n' : HELP + '\n');
    return;
  }
  let result;
  const [command, kind, action] = positionals;
  const date = values.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (command === 'doctor') {
    const { doctor } = await import('./workflow-doctor.mjs');
    result = await doctor(root, { input: values.input, paths: list(values.paths), tests: list(values.tests), staged: values.staged });
    if (result.ok === false) process.exitCode = 1;
  } else if (command === 'status') {
    const { handoff, formatHandoff } = await import('./workflow-status.mjs');
    result = handoff(root, { task: values.task, paths: list(values.paths), details: values.details || values.json });
    if (!values.json) { process.stdout.write(formatHandoff(result, { details: values.details }) + '\n'); return; }
  } else if (command === 'task') {
    const { applyTask, planTask, readTask, summarizeTasks } = await import('./workflow-task.mjs');
    if (kind === 'summary') result = summarizeTasks(root, { id: values.task, owner: values.owner });
    else {
      if (!values.task) throw new Error('任务操作必须给 --task');
      let taskDate = date;
      if (!values.date && kind !== 'start') {
        const matches = summarizeTasks(root, { id: values.task }).tasks;
        if (matches.length !== 1) throw new Error('任务不存在或编号不唯一，提供明确 --date');
        taskDate = matches[0].task.date;
      }
      if (kind === 'read') result = readTask(root, { id: values.task, date: taskDate });
      else {
        if (!values.owner) throw new Error('任务写操作需要 --owner');
        const { taskInputFromValues } = await import('./workflow-task-input.mjs');
        const direct = taskInputFromValues(kind, values);
        const input = direct ?? JSON.parse(readFileSync(values.input, 'utf8').replace(/^\uFEFF/, ''));
        const plan = planTask(root, { action: kind, id: values.task, date: taskDate, owner: values.owner, input });
        if (values.apply) result = applyTask(root, plan, values.expect === 'auto' ? plan.expectedSha256 : values.expect);
        else { const { content, ...preview } = plan; result = { ...preview, dryRun: true, bytes: Buffer.byteLength(content) }; }
      }
    }
  }
  else if (command === 'memory') {
    const { discoverMemory, searchMemory } = await import('./workflow-memory.mjs');
    if (values.limit !== undefined && values.query === undefined) throw new Error('memory --limit 需要 --query');
    if (values.source !== undefined && values.query === undefined) throw new Error('memory --source 需要 --query');
    const options = { home: values.home, codexHome: values['codex-home'], zcodeHome: values['zcode-home'], query: values.query, limit: values.limit, source: values.source };
    result = values.query === undefined ? discoverMemory(root, options) : searchMemory(root, options);
  }
  else if (command === 'docs') {
    const { validateDocumentation } = await import('./index-validation.mjs');
    result = validateDocumentation(root);
    if (result.ok === false) process.exitCode = 1;
  } else if (command === 'browser' && ['import', 'compare'].includes(kind)) {
    const { importBrowserEvidence, writeBrowserComparison } = await import('./workflow-browser.mjs');
    result = kind === 'import' ? importBrowserEvidence(root, { input: values.input, task: values.task, date })
      : writeBrowserComparison(root, { before: values.before, after: values.after, task: values.task, date });
  }
  else if (command === 'staged') {
    const { stagedPlan, runStaged } = await import('./workflow-staged.mjs');
    result = values.plan ? stagedPlan(root) : await runStaged(root, { task: values.task, date, json: values.json });
    // Index entries remain in the on-disk receipt/internal plan; do not flood CLI consumers.
    const completePlan = values.plan ? result : result.plan;
    if (completePlan?.entries) {
      const { entries, ...summary } = completePlan;
      const bounded = { ...summary, indexEntryCount: entries.length };
      if (values.plan) result = bounded;
      else result.plan = bounded;
    }
    if (!values.plan) process.exitCode = result.exitCode === 0 ? 0 : 1;
  }
  else if (command === 'find') {
    const { findExisting } = await import('./workflow-status.mjs');
    result = findExisting(root, values.query, 20, values.history);
  }
  else if (command === 'ship') {
    const { planShip, applyShip } = await import('./workflow-ship.mjs');
    const plan = planShip(root, { message: values.message, paths: list(values.paths), receipt: values.receipt });
    if (values.apply) result = applyShip(root, plan, { expectedSha256: values.expect });
    else result = { ...plan, dryRun: true };
    if (result.status === 'blocked') process.exitCode = 1;
  }
  else if (command === 'ledger') {
    const { applyLedger, planLedger, readLedger } = await import('./workflow-ledger.mjs');
    if (action === 'list') result = readLedger(root, kind);
    else {
      if (!values.input) throw new Error('必须提供 --input JSON 文件');
      const { cells } = JSON.parse(readFileSync(values.input, 'utf8'));
      const plan = planLedger(root, { kind, action, key: values.key, owner: values.owner, cells });
      if (values.apply) result = applyLedger(root, plan, values.expect === 'auto' ? plan.expectedSha256 : values.expect);
      else { const { content, ...preview } = plan; result = { ...preview, dryRun: true, bytes: Buffer.byteLength(content) }; }
    }
  } else if (command === 'verify') {
    const { previewCheck, runCheck } = await import('./workflow-evidence.mjs');
    const options = { task: values.task, tests: list(values.tests), paths: list(values.paths), full: values.full, suite: values.suite,
      json: values.json, date };
    if (values.plan) result = await previewCheck(root, options);
    else {
      result = await runCheck(root, options);
      process.exitCode = result.exitCode === 0 ? 0 : 1;
    }
  } else if (command === 'review') {
    const { reviewChange } = await import('./workflow-change-review.mjs');
    result = reviewChange(root, { paths: list(values.paths), input: values.input });
  } else if (command === 'evidence') {
    if (!values.input) throw new Error('必须提供 --input 报告 JSON');
    const report = JSON.parse(readFileSync(values.input, 'utf8'));
    if (!report || typeof report !== 'object' || Array.isArray(report)) throw new Error('不是受支持的验收报告');
    if (report.kind === 'staged-snapshot-check') {
      const { inspectGateReceipt, verifyGateReceipt } = await import('./workflow-gate-receipt.mjs');
      const receiptValidity = { ...inspectGateReceipt(root, values.input) };
      delete receiptValidity.report;
      if (!receiptValidity.eligible) {
        result = { ok: false, kind: report.kind, eligibleForReview: false, reusableReceipt: false,
          receiptValidity, nextAction: 'inspect-report-and-regenerate-frozen-evidence' };
        process.exitCode = 1;
      } else {
        const { stagedPlan } = await import('./workflow-staged.mjs');
        result = { kind: report.kind, eligibleForReview: true, reusableReceipt: true,
          ...verifyGateReceipt(root, values.input, stagedPlan(root)) };
      }
    } else {
      if (report.kind !== 'automated-local-check' || report.schemaVersion !== 1
        || !report.before || !report.after || !report.validation) throw new Error('不是受支持的验收报告');
      const { fingerprint, freshness } = await import('./workflow-evidence.mjs');
      if (!report.log || path.isAbsolute(report.log) || report.log.split(/[\\/]/).includes('..')
        || !report.log.startsWith('docs/evidence/')) throw new Error('报告日志须位于项目 docs/evidence');
      const { hash } = await import('./workflow-ledger.mjs');
      if (hash(readFileSync(path.join(root, report.log))) !== report.logSha256) throw new Error('证据日志哈希不匹配');
      result = freshness(report, fingerprint(root, { documents: report.after?.documents ?? false,
        assets: report.after?.assets ?? false, roots: report.after?.selection?.roots }));
    }
  } else if (command === 'sweep') {
    const { findSweepCandidates } = await import('./workflow-status.mjs');
    const maxAgeDays = values['max-age-days'] === undefined ? 2 : Number(values['max-age-days']);
    result = findSweepCandidates(root, { maxAgeDays });
  } else if (command === 'archive' && ['plan', 'snapshot'].includes(kind)) {
    const { archivePlan, snapshot } = await import('./workflow-archive.mjs');
    result = kind === 'plan' ? archivePlan(root)
      : snapshot(root, values.task, list(values.paths) ?? [], values['replaced-by']);
  }
  else throw new Error('未知命令，使用 --help');
  process.stdout.write(JSON.stringify({ ok: true, ...result }, null, values.json ? 0 : 2) + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const message = JSON.stringify({ ok: false, error: error.message,
      ...(error.details ? { details: error.details } : {}) });
    (process.argv.includes('--json') ? process.stdout : process.stderr).write(message + '\n');
    process.exitCode = 1;
  });
}
