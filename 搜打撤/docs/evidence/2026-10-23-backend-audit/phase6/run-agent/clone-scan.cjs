// Read-only token inspection; never imports or runs the inspected modules.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('../../../../../node_modules/acorn');
const root = path.resolve(__dirname, '../../../../..');
const files = [];
function collect(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const file = relative + '/' + entry.name;
    if (entry.isDirectory()) collect(file);
    else if (/\.[cm]?js$/.test(entry.name) && entry.name !== 'perf-ledger-capture.mjs'
      && (!file.startsWith('game/tools/') || entry.name.startsWith('agent-'))) files.push(file);
  }
}
for (const directory of ['game/src/run', 'game/src/agent', 'scripts', 'game/tools']) collect(directory);
const inventory = files.sort().map(file => {
  const bytes = fs.readFileSync(path.join(root, file));
  const source = bytes.toString('utf8');
  const tokens = [...acorn.tokenizer(source, { ecmaVersion: 'latest', sourceType: file.endsWith('.cjs') ? 'script' : 'module', locations: true })];
  const normalized = tokens.map((token, index) => token.type.label === 'name'
    && !['.', '?.'].includes(tokens[index - 1]?.type.label) && tokens[index + 1]?.type.label !== ':'
    ? 'identifier' : token.type.label + ':' + String(token.value ?? ''));
  return { file, bytes: bytes.length, lines: source.split('\n').length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), tokens, normalized };
});
const windows = new Map(), matches = [];
const width = 50;
for (let file = 0; file < inventory.length; file++) {
  const record = inventory[file];
  for (let offset = 0; offset <= record.normalized.length - width; offset++) {
    const key = record.normalized.slice(offset, offset + width).join('\u0000');
    const existing = windows.get(key) || [];
    for (const old of existing) {
      if (old.file === file && offset - old.offset < width) continue;
      const other = inventory[old.file];
      if (offset > 0 && old.offset > 0 && record.normalized[offset - 1] === other.normalized[old.offset - 1]) continue;
      let length = width;
      while (offset + length < record.normalized.length && old.offset + length < other.normalized.length
        && record.normalized[offset + length] === other.normalized[old.offset + length]) length++;
      matches.push({ tokens: length,
        a: { file: other.file, start: other.tokens[old.offset].loc.start.line, end: other.tokens[old.offset + length - 1].loc.end.line },
        b: { file: record.file, start: record.tokens[offset].loc.start.line, end: record.tokens[offset + length - 1].loc.end.line } });
    }
    existing.push({ file, offset });
    windows.set(key, existing);
  }
}
const report = { method: '50-token windows; local identifiers normalized, property names/literals retained; includes same-file nonoverlapping candidates; target source never executed',
  inventory: inventory.map(({ tokens, normalized, ...record }) => record), matches: matches.sort((a, b) => b.tokens - a.tokens) };
fs.writeFileSync(path.join(__dirname, 'clone-scan.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ scanned: report.inventory.length, candidates: matches.length, top: report.matches.slice(0, 20) }, null, 2));
