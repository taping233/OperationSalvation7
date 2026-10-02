const { createHash } = require('node:crypto');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');
const { auditAssets, inspectAssets } = require('./asset-audit-lib.cjs');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'game', 'assets');
const buildArgument = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
const buildRoot = buildArgument
  ? path.resolve(root, buildArgument)
  : path.join(root, 'desktop-app', 'game');

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [{ file, bytes: statSync(file).size }];
  });
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function summarize(label, dir) {
  const files = walk(dir);
  const bytes = files.reduce((sum, item) => sum + item.bytes, 0);
  console.log(`${label}: ${files.length} files, ${formatBytes(bytes)}`);
  files.sort((a, b) => b.bytes - a.bytes).slice(0, 8).forEach(item => {
    console.log(`  ${formatBytes(item.bytes).padStart(10)}  ${path.relative(dir, item.file)}`);
  });
  return { files, bytes };
}

function duplicateSummary(files, rootDir) {
  const bySize = new Map();
  for (const item of files) {
    if (item.bytes < 64 * 1024) continue;
    const group = bySize.get(item.bytes) || [];
    group.push(item);
    bySize.set(item.bytes, group);
  }
  const byHash = new Map();
  for (const group of bySize.values()) {
    if (group.length < 2) continue;
    for (const item of group) {
      const hash = createHash('sha256').update(readFileSync(item.file)).digest('hex');
      const matches = byHash.get(hash) || [];
      matches.push(item);
      byHash.set(hash, matches);
    }
  }
  const duplicates = [...byHash.values()].filter(group => group.length > 1);
  const reclaimable = duplicates.reduce((sum, group) => sum + group[0].bytes * (group.length - 1), 0);
  console.log(`Source duplicates: ${duplicates.length} groups, up to ${formatBytes(reclaimable)} reclaimable`);
  duplicates.sort((a, b) => b[0].bytes - a[0].bytes).slice(0, 5).forEach(group => {
    console.log(`  ${formatBytes(group[0].bytes)} x${group.length}: ${group.map(item => path.relative(rootDir, item.file)).join(', ')}`);
  });
}

function main() {
  const check = process.argv.includes('--check');
  const pathsIndex = process.argv.indexOf('--paths-json');
  if (pathsIndex >= 0 && !process.argv[pathsIndex + 1]) throw new Error('--paths-json requires a JSON array');
  const paths = pathsIndex >= 0 ? JSON.parse(process.argv[pathsIndex + 1]) : [];
  if (!check) {
    const source = summarize('Source assets', sourceRoot);
    if (existsSync(buildRoot)) {
      const build = summarize('Packaged game', buildRoot);
      console.log(`Package/source ratio: ${(build.bytes / source.bytes * 100).toFixed(1)}%`);
    } else {
      console.log('Packaged game: not built (run npm run build first)');
    }
    duplicateSummary(source.files, sourceRoot);
  }
  const result = check ? auditAssets({ root, paths }) : inspectAssets(root);
  const counts = result.issues.reduce((map, issue) => { map[issue.code] = (map[issue.code] || 0) + 1; return map; }, {});
  console.log(`Manifest drift: ${JSON.stringify(counts)}`);
  if (check) {
    console.log(`Asset check: ${result.errors.length} errors, ${result.warnings.length} unchanged historical warnings (docs/asset-audit-debt.json)`);
    result.errors.slice(0, 30).forEach(issue => console.error(`  ERROR ${issue.code}: ${issue.path} (${issue.detail})`));
    if (!result.ok) process.exitCode = 1;
  } else {
    result.issues.slice(0, 12).forEach(issue => console.log(`  ${issue.code}: ${issue.path} (${issue.detail})`));
    console.log('Run --check [--paths-json "[project paths]"] to block new debt and changed assets with unresolved registration.');
  }
}

try { main(); } catch (error) { console.error(`Asset audit failed: ${error.message}`); process.exitCode = 1; }
