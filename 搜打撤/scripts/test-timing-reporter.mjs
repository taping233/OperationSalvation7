import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const milliseconds = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;

// Summarize the run received from Vitest itself. Cached runs and old project
// names never participate; skips, pending cases and unhandled errors stay separate.
export function timingSummary(root, modules, errors, reason, startedAt, endedAt) {
  const counts = { passed: 0, failed: 0, skipped: 0, pending: 0 };
  const fileOutcomes = { passed: 0, failed: 0, skipped: 0, pending: 0 };
  const skipped = [], files = [];
  for (const module of modules) {
    const file = path.relative(root, module.moduleId).replaceAll('\\', '/');
    const fileCounts = { passed: 0, failed: 0, skipped: 0, pending: 0 };
    for (const test of module.children.allTests()) {
      const result = test.result();
      const state = Object.hasOwn(counts, result.state) ? result.state : 'pending';
      counts[state]++; fileCounts[state]++;
      if (state === 'skipped') skipped.push({ file, test: test.fullName,
        reason: result.note || (test.options.mode === 'todo' ? '待实现（todo）' : '条件或声明跳过；测试未提供具体原因'),
        reasonProvided: Boolean(result.note), line: test.location?.line ?? null });
    }
    const diagnostic = module.diagnostic();
    const moduleState = module.state();
    fileOutcomes[Object.hasOwn(fileOutcomes, moduleState) ? moduleState : 'pending']++;
    files.push({ file, project: module.project.name, state: module.state(), ...fileCounts,
      milliseconds: milliseconds(diagnostic.duration),
      collectionMilliseconds: milliseconds(diagnostic.collectDuration),
      environmentMilliseconds: milliseconds(diagnostic.environmentSetupDuration),
      preparationMilliseconds: milliseconds(diagnostic.prepareDuration) });
  }
  files.sort((a, b) => b.milliseconds - a.milliseconds || a.file.localeCompare(b.file));
  return { schemaVersion: 1, kind: 'test-timing-summary', startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString(), wallMilliseconds: endedAt - startedAt, reason,
    unhandledErrors: errors.length, totalFiles: files.length, counts, fileCounts: fileOutcomes,
    completed: reason === 'passed' && errors.length === 0 && fileOutcomes.failed === 0 && fileOutcomes.pending === 0
      && counts.failed === 0 && counts.pending === 0,
    slowestFiles: files.slice(0, 10), files, skipped,
    limits: ['每个文件耗时可并发重叠，不能相加作为整轮时间', '跳过和未完成用例未计入通过；缺少说明的跳过明确标记'] };
}

export default class TestTimingReporter {
  onInit(context) { this.root = context.config.root; }
  onTestRunStart() { this.startedAt = Date.now(); }
  onTestRunEnd(modules, errors, reason) {
    const endedAt = Date.now();
    const report = timingSummary(this.root, modules, errors, reason, this.startedAt ?? endedAt, endedAt);
    const directory = path.join(this.root, 'node_modules/.cache/test-reports');
    mkdirSync(directory, { recursive: true });
    const file = path.join(directory, new Date(endedAt).toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8) + '.json');
    writeFileSync(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
    process.stdout.write('\n[tests] 耗时报告：' + path.relative(this.root, file).replaceAll('\\', '/') + '\n');
    for (const entry of report.slowestFiles.slice(0, 5)) {
      process.stdout.write(`[tests] 慢文件 ${(entry.milliseconds / 1000).toFixed(2)}s ${entry.file}\n`);
    }
    process.stdout.write(`[tests] 运行${reason}，异常 ${report.unhandledErrors}；通过 ${report.counts.passed}，失败 ${report.counts.failed}，跳过 ${report.counts.skipped}，未完成 ${report.counts.pending}\n`);
  }
}
