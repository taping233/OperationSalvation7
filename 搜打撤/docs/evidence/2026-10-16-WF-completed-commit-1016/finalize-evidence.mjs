import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const dir = 'docs/evidence/2026-10-16-WF-completed-commit-1016';
const readJson = file => { const b = fs.readFileSync(file); return JSON.parse(b.toString(b[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, '')); };
const files = ['gate-result-escalated.json', 'gate-result-repaired.json', 'gate-result-bounded.json', 'gate-result-final.json', 'gate-result-sealed.json'];
const attempts = files.map(name => {
  const result = readJson(`${dir}/${name}`), report = readJson(result.report), log = fs.readFileSync(report.log, 'utf8');
  return { result: `${dir}/${name}`, report: result.report, reportSha256: createHash('sha256').update(fs.readFileSync(result.report)).digest('hex'), reportBytes: fs.statSync(result.report).size,
    log: report.log, logSha256: createHash('sha256').update(fs.readFileSync(report.log)).digest('hex'), validation: result.validation,
    summary: log.split(/\r?\n/).filter(line => /Test Files |Tests |Errors |Duration |PASS：full|FAIL：/.test(line)) };
});
if (!attempts.at(-1).validation.passed || !attempts.at(-1).validation.reusableReceipt) throw Error('Final gate did not pass');
for (const name of files) fs.writeFileSync(`${dir}/${name}`, JSON.stringify(readJson(`${dir}/${name}`), null, 2) + '\n');
const source = readJson(`${dir}/source-commit-result.json`);
const summary = { observedAt: new Date().toISOString(), sourceCommit: source.commit, attempts,
  resourceDiagnosis: { logicalCpus: 20, defaultForks: 19, observedFreeMemoryGiB: 2.94, totalMemoryGiB: 15.67,
    change: 'Vitest forks capped at min(4, availableParallelism-1), at least 1; minWorkers=1',
    limits: 'Resource contention is inferred from default concurrency and repeat RPC timeouts; no per-worker peak memory trace. Test and RPC timeouts unchanged.' },
  reportsOver1MiB: 'Retained locally and excluded from Git by project policy; SHA256 above; regenerate with npm run --silent workflow -- staged --task WF-completed-commit-1016 --json against the reviewed source index and locked dependency bytes.',
  checks: { syntax: '428 project files passed', types: '8 configurations passed', eslint: 'passed', browser: 'Native IAB drag and chest resume; constructed no-slot fixtures explicitly declared', build: 'not run in mixed tree', push: 'not authorized; not run', remoteCI: 'not checked for these local commits' },
  teardownRepair: 'Hub wallpaper preheat uses window-owned idle/timer scheduling, so closing a DOM window cancels its pending timer instead of invoking Image after environment teardown.',
  snapshotRepair: 'The quartermaster transaction test no longer overwrites three historical audit JSON files on every run. All save-failure, retry, restore and duplicate-grant assertions remain; the next sealed run must have no tracked mutations.',
  exclusions: ['Later second-wallpaper, chest-v6 and general-transition deltas remain unstaged; see retained-in-flight.json', '91 unregistered dormant chest frames retained without staging', 'Active art, source art/candidates, unknown configuration and NAI/PV tools, intermediate files excluded'],
};
fs.writeFileSync(`${dir}/final-verification.json`, JSON.stringify(summary, null, 2) + '\n');
const readme = fs.readFileSync(`${dir}/README.md`, 'utf8');
fs.writeFileSync(`${dir}/README.md`, readme + `\n最终源码提交：\`${source.commit}\`。完整隔离门结果见 \`final-verification.json\`；大于1MB的冻结报告仅本地保存，路径、SHA256和重跑方式同列。完整测试4730项通过、16项既有跳过，未处理错误0项，快照中无被检查改写的跟踪文件。默认19个fork下两次各出现2个60秒RPC回报超时；限制并发至最多4个后RPC超时消失，另暴露一个壁纸预热在DOM销毁后触发Image的迟到回调，改用window所属的定时器。之后测试命令通过，但封存发现装备征用事务用例覆写历史证据；去掉该写盘副作用并保留全部事务断言后，最终封存门通过。未改测试或RPC超时、用例范围和跳过数。\n\n冻结后另有已登记的第二壁纸、宝箱v6及通用过场任务修改同文件；其后续增量保留，本次仅提交此前已完成并验证的快照，详见 \`retained-in-flight.json\`。\n`);
const registry = 'docs/PARALLEL-REGISTRY.md';
let text = fs.readFileSync(registry, 'utf8');
const row = text.split(/\r?\n/).find(line => line.startsWith('Friday（完成改动提交 WF-completed-commit-1016，'));
if (!row) throw Error('Own registry row missing');
text = text.replace(row, '');
const closed = `Friday（完成改动提交 WF-completed-commit-1016，聊天01a14487），2026-10-16：已按老板授权修复集成并正常提交源码 \`${source.commit}\`（170件，相关现行文档同组），证据 \`docs/evidence/2026-10-16-WF-completed-commit-1016/README.md\`；编辑占用释放。197项断言失败已修复，最终完整隔离门495套/4730项通过、16项既有跳过、0未处理错误；测试fork上限4，未调超时/阈值。原生内置浏览器验证拖牌和宝箱续领。既有完成证据按组随本轮提交；后续第二壁纸/宝箱v6/通用过场、在途生图、91旧宝箱帧、无主配置/工具/候选与中间文件保留。未build/推送，原5200服务未动，自建测试页已关。此前任务行中的完成未提交为当时历史，本轮实际源码范围见source-index-inventory.json。`;
text = text.replace('## 近期已释放', '## 近期已释放\n\n' + closed);
fs.writeFileSync(registry, text);
console.log(JSON.stringify({ commit: source.commit, final: attempts.at(-1).summary }));
