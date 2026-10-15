import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { auditCss } from '../../../scripts/css-redundancy-audit.mjs';

// Exact task scope: no file deletion, no changes to the active battle stylesheet.
const files = ['entry-events', 'expedition', 'expedition-rewards', 'expedition-roster',
  'expedition-shop', 'map-cover', 'page-expedition-hud', 'home-polish'];
const sha = source => createHash('sha256').update(source).digest('hex');
const report = [];
if (existsSync(new URL('css-cleanup.json', import.meta.url))) throw new Error('Task cleanup already recorded; refusing to rewrite its evidence.');
for (const name of files) {
  const file = `game/css/${name}.css`;
  const before = readFileSync(file, 'utf8'), root = postcss.parse(before);
  const removed = [];
  root.walkRules(rule => {
    // #bagBtn still exists in dev.html. Only #bagBtnFloat is retired.
    if (!rule.selector.includes('#bagBtnFloat')) return;
    const old = rule.toString();
    // The focus ring uses an :is list; retain both live controls.
    if (rule.selector.includes(':is(#topBtns button, #bagBtnFloat, #routePanel button)')) {
      rule.selector = rule.selector.replace(':is(#topBtns button, #bagBtnFloat, #routePanel button)', ':is(#topBtns button, #routePanel button)');
    } else {
      const kept = rule.selectors.filter(selector => !selector.includes('#bagBtnFloat'));
      if (kept.length) rule.selectors = kept;
      else rule.remove();
    }
    removed.push({ kind: 'retired-button', line: rule.source.start.line, before: old });
  });
  root.walkAtRules('keyframes', rule => {
    if (rule.params === 'bagFullBreath') {
      removed.push({ kind: 'retired-animation', line: rule.source.start.line, before: rule.toString() });
      rule.remove();
    }
  });
  root.walkAtRules(rule => { if (rule.nodes && !rule.nodes.length) rule.remove(); });
  let after = root.toString();
  const candidates = auditCss(after, file).filter(candidate =>
    candidate.survivor.line !== candidate.line && !/\b(?:var|env)\(/.test(candidate.survivor.value));
  // Only separate rules in the same file: preserve same-rule browser fallbacks.
  for (const candidate of candidates.sort((a, b) => b.start - a.start)) {
    removed.push({ kind: 'overwritten-declaration', ...candidate, before: after.slice(candidate.start, candidate.end) });
    after = after.slice(0, candidate.start) + after.slice(candidate.end);
  }
  // Remove comments belonging solely to the retired control.
  const cleaned = postcss.parse(after);
  cleaned.walkComments(comment => {
    if (/W8 全局背包浮键|满载警示移到全局浮动背包键|满载呼吸（2026-09-27/.test(comment.text)) comment.remove();
  });
  after = cleaned.toString();
  if (after === before) continue;
  writeFileSync(file, after);
  report.push({ file, beforeSha256: sha(before), afterSha256: sha(after),
    beforeBytes: Buffer.byteLength(before), afterBytes: Buffer.byteLength(after), removed });
}
writeFileSync(new URL('css-cleanup.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.map(({ file, beforeBytes, afterBytes, removed }) =>
  ({ file, saved: beforeBytes - afterBytes, removals: removed.length })), null, 2));
