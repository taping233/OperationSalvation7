// Advisory impact checks; authoritative test selection remains in gate-plan.
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import { filesUnder } from './workflow-status.mjs';

const selected = (file, paths) => paths.some(item => file === item || file.startsWith(item + '/'));
const read = (root, file) => readFileSync(path.join(root, file), 'utf8');
const regular = (root, file) => existsSync(path.join(root, file)) && lstatSync(path.join(root, file)).isFile()
  && !lstatSync(path.join(root, file)).isSymbolicLink();

export function changeAdvice(root, paths) {
  const checks = [];
  const add = (id, reason, command = null) => checks.push({ id, reason, command, status: 'not-run' });
  if (paths.some(file => /\.(?:js|mjs|cjs)$/.test(file) || /^(?:game\/src|scripts)(?:\/|$)/.test(file))) {
    add('syntax', 'JavaScript source changed', 'npm run check:syntax');
    add('types', 'Check shared type boundaries', 'npm run typecheck');
    add('lint', 'Lint changed source with the project configuration', 'npm run lint');
  }
  if (paths.some(file => /^game\/css(?:\/|$)/.test(file))) {
    add('styles', 'Run Stylelint on changed CSS; shared token contracts remain separate', 'npm run quality:styles:test');
  }
  if (paths.some(file => /^game\/(?:src\/ui|css|dev)(?:\/|$)/.test(file))) {
    add('accessibility', 'DOM fixture scan, then real keyboard/focus verification', 'npm run quality:axe-dom');
  }
  if (paths.some(file => /^game\/data(?:\/|$)|^narrative(?:\/|$)/.test(file))) {
    add('data', 'Validate data contracts; examine save migration before changing identities', 'npm run validate:data');
  }
  const guard = 'scripts/runtime-asset-redundancy-review.mjs';
  const fingerprints = [];
  if (regular(root, guard)) {
    for (const [index, line] of read(root, guard).split(/\r?\n/).entries()) {
      for (const match of line.matchAll(/['"](game\/[^'"\n]+)['"]\s*:\s*['"]([a-f0-9]{64})['"]/g)) {
        const [, file, expected] = match;
        if (!selected(file, paths)) continue;
        const actual = regular(root, file) ? createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex') : null;
        fingerprints.push({ file, guard, line: index + 1, expected, actual,
          status: actual === expected ? 'matches' : actual === null ? 'missing' : 'changed-needs-review' });
      }
    }
  }
  if (fingerprints.length || paths.some(file => /^game\/assets(?:\/|$)|^scripts\/runtime-asset-/.test(file))) {
    add('resource-selection', 'Review dynamic asset selection before updating any fingerprint; compare build output',
      'npm run test:target -- tests/runtime-asset-redundancy.test.js tests/runtime-asset-redundancy-plugin.test.js');
  }
  return { checks, fingerprints, guardPresent: regular(root, guard),
    deletionReview: ['Check static and dynamic references, save identifiers/migrations and licenses before removal; Knip alone is insufficient.'],
    limits: ['Suggestions are not executed or new gates; existing full/skip test selection is unchanged.',
      'Matching hashes do not prove semantic equivalence. Missing paths may be incomplete recovery, not approved deletion.'] };
}

/** Literal matches suggest reusable semantic tokens, never automatically rewrite a theme. */
export function styleCandidates(root, paths) {
  const tokenFile = 'game/css/secondary-ui-tokens.css';
  const tokens = new Map(), candidates = [], errors = [];
  if (regular(root, tokenFile)) {
    try { postcss.parse(read(root, tokenFile), { from: tokenFile }).walkDecls(decl => {
      if (decl.prop.startsWith('--ui-') && !decl.value.includes('var(')) {
        const key = decl.value.trim().toLowerCase();
        tokens.set(key, [...(tokens.get(key) || []), decl.prop]);
      }
    }); } catch (error) { errors.push({ file: tokenFile, error: error.message }); }
  }
  const css = filesUnder(root, 'game/css').filter(file => file.endsWith('.css') && file !== tokenFile && selected(file, paths));
  for (const file of css) {
    try { postcss.parse(read(root, file), { from: file }).walkDecls(decl => {
      if (decl.prop.startsWith('--') || !/^(?:color|background(?:-color)?|border(?:-color|-radius)?|font-size|gap|padding|margin|min-height)$/.test(decl.prop)) return;
      const semantic = decl.prop === 'font-size' ? /^--ui-text-/ : decl.prop === 'border-radius' ? /^--ui-radius$/
        : decl.prop === 'min-height' ? /^--ui-control-/ : /^(?:gap|padding|margin)$/.test(decl.prop) ? /^--ui-space-/
        : /^--ui-(?:ink|muted|blue|gold|panel|line|risk|on-primary|hover|disabled|glass-surface|glass-line)$/;
      const alternatives = (tokens.get(decl.value.trim().toLowerCase()) || []).filter(token => semantic.test(token));
      if (alternatives.length) candidates.push({ file, line: decl.source.start.line, selector: decl.parent.selector || null,
        property: decl.prop, value: decl.value, tokens: alternatives, status: 'candidate-needs-context',
        reason: 'Exact literal matches shared vocabulary; verify semantic role, token scope and cascade before replacing.' });
    }); } catch (error) { errors.push({ file, error: error.message }); }
  }
  return { tokenFile, tokenFilePresent: regular(root, tokenFile), scanned: css, candidates, errors,
    limits: ['Static literal matches only; intentional themes may differ. No visual, contrast or computed-style claim.'] };
}
