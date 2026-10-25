import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse, tokenizer } from 'acorn';

// Default is measurement only. --apply requires the current sources to match
// the frozen round-two inputs before it writes the six authorized files.
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../../..');
const beforeRoot = path.join(root, 'node_modules/.cache/project-lean10-round2-before');
const apply = process.argv.includes('--apply');
const slices = ['session', 'piles', 'interaction', 'effects', 'presentation'];
const helperPath = 'game/src/core/live-bindings.js';
const helperBefore = readFileSync(path.join(beforeRoot, helperPath), 'utf8');
const helperAddition = `
/** Keep one synchronous subscriber per compatibility module. Only the changed
 * own field is read, so unrelated or inherited names stay unobserved.
 * @template {object} S
 * @param {S & {subscribe(listener: (state: S, key: PropertyKey) => void): unknown}} runtime
 * @param {{[K in keyof S]?: (value: S[K]) => void}} bindings
 */
export function subscribeStateBindings(runtime, bindings) {
  return runtime.subscribe((state, key) => {
    if (Object.prototype.hasOwnProperty.call(bindings, key)) {
      const field = /** @type {keyof S} */ (key);
      bindings[field]?.(state[field]);
    }
  });
}
`;
const bytes = text => Buffer.byteLength(text);
const normalized = text => text.replaceAll('\r\n', '\n');
const sha = text => createHash('sha256').update(text).digest('hex');
function tokenCount(source) {
  let count = 0;
  for (const token of tokenizer(source, { ecmaVersion: 'latest', sourceType: 'module' })) {
    if (token.type.label !== 'eof') count++;
  }
  return count;
}
function metrics(source) {
  return { bytes: bytes(source), normalizedBytes: bytes(normalized(source)), tokens: tokenCount(source) };
}
function wrapNames(names) {
  const groups = [];
  for (let i = 0; i < names.length; i += 4) groups.push(`  ${names.slice(i, i + 4).join(', ')}`);
  return groups.join(',\n');
}
const rows = [];
const drafts = new Map();
for (const slice of slices) {
  const file = `game/src/battle/runtime/battle.runtime.${slice}.js`;
  const source = readFileSync(path.join(beforeRoot, file), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const declarations = kind => ast.body.filter(node => node.type === 'ExportNamedDeclaration'
    && node.declaration?.type === 'VariableDeclaration' && node.declaration.kind === kind);
  const mutable = declarations('let');
  const methods = declarations('const');
  const names = mutable.map(node => node.declaration.declarations[0].id.name);
  const methodNames = methods.map(node => node.declaration.declarations[0].id.name);
  if (!mutable.length || !methods.length) throw new Error(`Unexpected slice shape: ${file}`);
  for (const node of [...mutable, ...methods]) {
    const [item] = node.declaration.declarations;
    if (node.declaration.declarations.length !== 1 || item.id.type !== 'Identifier'
      || item.init?.type !== 'MemberExpression' || item.init.object.name !== 'runtime'
      || item.init.property.name !== item.id.name || item.init.computed) throw new Error(`Unexpected alias: ${file}`);
  }
  const subscriber = ast.body.find(node => node.type === 'ExpressionStatement'
    && node.expression.type === 'CallExpression' && node.expression.callee.type === 'MemberExpression'
    && node.expression.callee.object.name === 'runtime' && node.expression.callee.property.name === 'subscribe');
  if (!subscriber) throw new Error(`Missing subscription: ${file}`);
  const replacements = [
    { start: 0, end: 0, text: "import { subscribeStateBindings } from '../../core/live-bindings.js';\n" },
    { start: mutable[0].start, end: mutable.at(-1).end, text: `export let {\n${wrapNames(names)}\n} = runtime;` },
    { start: subscriber.start, end: subscriber.end,
      text: `subscribeStateBindings(runtime, {\n${names.map(name => `  ${name}: value => { ${name} = value; },`).join('\n')}\n});` },
    { start: methods[0].start, end: methods.at(-1).end, text: `export const {\n${wrapNames(methodNames)}\n} = runtime;` },
  ];
  let draft = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    draft = draft.slice(0, replacement.start) + replacement.text + draft.slice(replacement.end);
  }
  if (source.includes('\r\n')) draft = normalized(draft).replaceAll('\n', '\r\n');
  parse(draft, { ecmaVersion: 'latest', sourceType: 'module' });
  drafts.set(file, draft);
  rows.push({ file, sha256: sha(source), mutableFields: names.length, methodAliases: methodNames.length,
    afterSha256: sha(draft), before: metrics(source), draft: metrics(draft) });
}
drafts.set(helperPath, helperBefore + helperAddition);
rows.push({ file: helperPath, sha256: sha(helperBefore), before: metrics(helperBefore),
  afterSha256: sha(helperBefore + helperAddition), draft: metrics(helperBefore + helperAddition) });
if (apply) {
  for (const row of rows) {
    if (sha(readFileSync(path.join(root, row.file), 'utf8')) !== row.sha256) {
      throw new Error(`Current file no longer matches frozen source: ${row.file}`);
    }
  }
  for (const [file, draft] of drafts) writeFileSync(path.join(root, file), draft);
}
const totals = { before: { bytes: 0, normalizedBytes: 0, tokens: 0 }, draft: { bytes: 0, normalizedBytes: 0, tokens: 0 } };
for (const row of rows) for (const phase of ['before', 'draft']) {
  for (const field of ['bytes', 'normalizedBytes', 'tokens']) totals[phase][field] += row[phase][field];
}
const saved = Object.fromEntries(Object.keys(totals.before).map(key => [key, totals.before[key] - totals.draft[key]]));
const currentMatchesDraft = rows.every(row => sha(readFileSync(path.join(root, row.file), 'utf8')) === row.afterSha256);
const output = {
  status: currentMatchesDraft ? 'Authorized six-file replacement matches current source bytes'
    : 'Measurement from frozen round-two sources; no source files written',
  currentMatchesDraft, generatedAt: new Date().toISOString(), rows, totals, saved,
  observedUpperBounds: {
    remainingPureRestForwarderBodiesAcrossGame: { functions: 140, bytes: 7799 },
    enginePureRestForwarderBodies: { functions: 60, bytes: 2254 },
    fourPureRuntimeProjectionBodies: { functions: 4, bytes: 1851 },
    warning: 'Upper bounds overlap the candidate chain and exclude helper costs; never add these as proven savings.',
  },
};
writeFileSync(path.join(directory, 'measurement.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ saved, rows: rows.map(row => ({ file: row.file,
  savedBytes: row.before.bytes - row.draft.bytes, savedTokens: row.before.tokens - row.draft.tokens })) }, null, 2));
