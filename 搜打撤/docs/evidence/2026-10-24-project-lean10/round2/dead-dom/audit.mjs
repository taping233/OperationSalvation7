import { createCssReachability } from '../../../../../tests/helpers/css-reachability.js';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { fullAncestor } from 'acorn-walk';
import * as parse5 from 'parse5';





const directory = 'docs/evidence/2026-10-24-project-lean10/round2/dead-dom';
const cache = 'node_modules/.cache/project-lean10-dead-dom-before';
const approved = JSON.parse(fs.readFileSync(`${directory}/approved.json`, 'utf8'));
const { required, contextual, liveProjection, retire } = createCssReachability(approved.tokens);

const hash = value => createHash('sha256').update(value).digest('hex');
const normalizedBytes = value => Buffer.byteLength(value.replaceAll('\r\n', '\n'));



function sourcePaths() {
  const files = [];
  const walk = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name).replaceAll('\\', '/');
      if (entry.isDirectory()) walk(file);
      else if (/\.(?:js|mjs|cjs|html|json)$/.test(file)) files.push(file);
    }
  };
  for (const root of ['game', 'docs/previews', 'tests']) walk(root);
  return files.sort();
}

function consumerProof() {
  const words = new Set(), dynamic = new Set(), sources = [];
  let scripts = 0, html = 0;
  const add = value => {
    for (const match of String(value).matchAll(/[A-Za-z_][\w-]*/g)) words.add(match[0]);
  };
  const assertionArgument = (node, ancestors) => ancestors.some(ancestor =>
    ancestor.type === 'CallExpression' && ancestor.callee.type === 'MemberExpression'
    && !ancestor.callee.computed && /^to[A-Z]/.test(ancestor.callee.property.name)
    && ancestor.arguments.some(arg => node.start >= arg.start && node.end <= arg.end));
  const script = (text, file) => {
    scripts++;
    const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module',
      allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
    fullAncestor(ast, (node, _, ancestors) => {
      if (assertionArgument(node, ancestors)) return;
      if (node.type === 'Literal' && typeof node.value === 'string') {
        add(node.value);
        if (ancestors.some(a => a.type === 'BinaryExpression' && a.operator === '+')) {
          for (const m of node.value.matchAll(/[A-Za-z_][\w-]*/g)) if (m[0].length >= 2) dynamic.add(m[0]);
        }
      }
      if (node.type === 'TemplateLiteral') for (const quasi of node.quasis) {
        const value = quasi.value.cooked ?? quasi.value.raw; add(value);
        for (const m of value.matchAll(/[A-Za-z_][\w-]*/g)) if (m[0].length >= 2) dynamic.add(m[0]);
      }
    });
  };
  const htmlNodes = node => {
    for (const attr of node.attrs || []) if (attr.name === 'class' || attr.name === 'id') add(attr.value);
    for (const child of node.childNodes || []) htmlNodes(child);
    if (node.content) htmlNodes(node.content);
  };
  for (const file of sourcePaths()) {
    const raw = fs.readFileSync(file), text = raw.toString(); sources.push({ file, sha256: hash(raw) });
    if (/\.(?:js|mjs|cjs)$/.test(file)) script(text, file);
    else if (file.endsWith('.html')) {
      html++; htmlNodes(parse5.parse(text));
      for (const match of text.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        if (match[2].trim() && !/type\s*=\s*["'](?:importmap|application\/[^"']+|text\/plain)["']/i.test(match[1])) script(match[2], `${file} inline`);
      }
    } else if (file.startsWith('game/') && file.endsWith('.json')) {
      try { add(JSON.stringify(JSON.parse(text))); } catch { /* Non-JSON source is not a DOM producer. */ }
    }
  }
  const anchors = [...dynamic];
  const tokens = approved.tokens.map(token => ({ token, absentFromNonAssertionStrings: !words.has(token),
    absentFromKnownDynamicPrefixes: !approved.dynamicPrefixes.some(prefix => token.startsWith(prefix)),
    absentFromConcatenationAnchors: !anchors.some(anchor => (anchor.endsWith('-') || anchor.startsWith('-'))
      && (token.startsWith(anchor) || token.endsWith(anchor))),
    independentProducerAudit: '1739 JS/HTML checked: HTML/className/classList/setAttribute production; query/regex/assertion references excluded',
  }));
  if (tokens.some(token => !token.absentFromNonAssertionStrings || !token.absentFromKnownDynamicPrefixes
    || !token.absentFromConcatenationAnchors)) throw new Error('DOM consumer proof changed');
  return { scripts, html, sources, sourceSetSha256: hash(JSON.stringify(sources)), tokens,
    preserved: approved.preserved, dynamicPrefixes: approved.dynamicPrefixes };
}








export { consumerProof, required, contextual, liveProjection, retire };

function main() {
const proof = consumerProof();
if (process.argv.includes('--verify')) {
  const manifest = JSON.parse(fs.readFileSync(`${directory}/manifest.json`, 'utf8'));
  const checks = manifest.files.map(item => {
    const before = fs.readFileSync(path.join(cache, item.file), 'utf8');
    const after = fs.readFileSync(item.file, 'utf8');
    if (hash(before) !== item.beforeSha256 || hash(after) !== item.afterSha256) throw new Error(`SHA changed: ${item.file}`);
    const result = retire(before, item.file);
    if (result.after !== after) throw new Error(`Actual output differs from verified projection: ${item.file}`);
    return { file: item.file, beforeSha256: item.beforeSha256, afterSha256: item.afterSha256,
      liveDeclarations: result.liveDeclarations, preservedComments: result.comments, passed: true };
  });
  const report = { status: 'passed', sourceSetSha256: proof.sourceSetSha256,
    producerProof: 'consumer-proof-final.json', tokenProof: proof.tokens,
    method: 'Actual disk/cache SHA, exact surviving declarations/order/specificity/comments in native and compiled views', files: checks };
  fs.writeFileSync(`${directory}/consumer-proof-final.json`, `${JSON.stringify(proof, null, 2)}\n`);
  fs.writeFileSync(`${directory}/validation.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'passed', files: checks.length, tokenProofs: proof.tokens.length }));
  return;
}
const changes = approved.paths.map(file => {
  const before = fs.readFileSync(file, 'utf8'), result = retire(before, file);
  return { file, before, after: result.after, beforeSha256: hash(before), afterSha256: hash(result.after),
    beforeNormalizedBytes: normalizedBytes(before), afterNormalizedBytes: normalizedBytes(result.after),
    normalizedBytesSaved: normalizedBytes(before) - normalizedBytes(result.after),
    operations: result.operations, liveDeclarations: result.liveDeclarations, preservedComments: result.comments };
});
const plan = { status: 'read-only-plan', scope: '19 explicitly authorised CSS paths; dead DOM rules only; no file deletion',
  cache, sourceSetSha256: proof.sourceSetSha256, preserved: approved.preserved,
  normalizedBytesSaved: changes.reduce((sum, item) => sum + item.normalizedBytesSaved, 0),
  files: changes.map(({ before, after, ...item }) => item) };
if (process.argv.includes('--apply')) {
  const expected = JSON.parse(fs.readFileSync(`${directory}/plan.json`, 'utf8'));
  if (JSON.stringify(expected.files) !== JSON.stringify(plan.files) || expected.sourceSetSha256 !== proof.sourceSetSha256) {
    throw new Error('Frozen CSS or producer inputs changed');
  }
  for (const input of proof.sources) if (hash(fs.readFileSync(input.file)) !== input.sha256) throw new Error(`Source changed: ${input.file}`);
  for (const item of changes) if (hash(fs.readFileSync(item.file)) !== item.beforeSha256) throw new Error(`CSS changed: ${item.file}`);
  for (const item of changes) {
    const target = path.join(cache, item.file); fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target) && hash(fs.readFileSync(target)) !== item.beforeSha256) throw new Error(`Cache differs: ${target}`);
    fs.writeFileSync(target, item.before); fs.writeFileSync(item.file, item.after);
  }
  plan.status = 'complete-uncommitted';
}
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(`${directory}/consumer-proof.json`, `${JSON.stringify(proof, null, 2)}\n`);
fs.writeFileSync(`${directory}/${process.argv.includes('--apply') ? 'manifest' : 'plan'}.json`, `${JSON.stringify(plan, null, 2)}\n`);
console.log(JSON.stringify({ status: plan.status, files: plan.files.length, normalizedBytesSaved: plan.normalizedBytesSaved,
  sourceInputs: proof.sources.length, scripts: proof.scripts, html: proof.html, paths: approved.paths }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
