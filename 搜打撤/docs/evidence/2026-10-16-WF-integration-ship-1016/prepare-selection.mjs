import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { planShip } from '../../../scripts/workflow-ship.mjs';

// Explicit reviewed delivery roots; unknown artwork and local NAI state stay local.
const directory = 'docs/evidence/2026-10-16-WF-integration-ship-1016/';
const plan = planShip(process.cwd());
const audit = JSON.parse(fs.readFileSync('docs/evidence/2026-10-16-WF-local-cloud-handoff-1016/asset-audit.json'));
const candidates = new Set(audit.errors.map(issue => '搜打撤/game/assets/' + issue.path));
const preserved = [];
const commits = plan.commits.map(group => ({ ...group, paths: group.paths.filter(file => {
  let reason;
  if (candidates.has(file)) reason = '未登记且无正式入口引用的候选图';
  else if (file.startsWith('搜打撤/game/art-source/')) reason = '未逐件核实完成归属的来源或候选，保留本机';
  else if (/^搜打撤\/game\/(?:base-design-options|card-design-options(?:-v2)?|event-template)\.html$/.test(file)
    || file.startsWith('搜打撤/game/card-design-references/')) reason = '未核实采用状态的独立候选或研究页';
  else if (/^搜打撤\/docs\/previews\/card-/.test(file)) reason = '未确认采用的卡面参考候选';
  if (reason) preserved.push({ path: file, reason });
  return !reason;
}) }));
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const fingerprints = commits.flatMap(group => group.paths).map(file => {
  const full = '../' + file;
  const stat = fs.statSync(full);
  return { path: file, bytes: stat.size, mtimeMs: stat.mtimeMs,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex') };
});
fs.writeFileSync(directory + 'selection.json', JSON.stringify({ generatedAt: new Date().toISOString(), baseline: head,
  commits, fingerprints, preserved, inProgress: plan.inProgressPaths, unknown: plan.unknownPaths,
  toolExcluded: plan.excludedPaths }, null, 2));
console.log(JSON.stringify({ head, commits: commits.map(group => ({ scope: group.scope, count: group.paths.length })),
  preserved: preserved.length, inProgress: plan.inProgressPaths.length, unknown: plan.unknownPaths.length }));
