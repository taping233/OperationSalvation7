const { createHash } = require('node:crypto');
const { existsSync, readFileSync, readdirSync, statSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'game', 'assets');
const buildRoot = process.argv[2]
  ? path.resolve(root, process.argv[2])
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

const source = summarize('Source assets', sourceRoot);
if (existsSync(buildRoot)) {
  const build = summarize('Packaged game', buildRoot);
  console.log(`Package/source ratio: ${(build.bytes / source.bytes * 100).toFixed(1)}%`);
} else {
  console.log('Packaged game: not built (run npm run build first)');
}
duplicateSummary(source.files, sourceRoot);

// 资产清单校验（create-game-assets）：新增未登记 / 已删仍登记 / 授权待确认的资产都报出来
const manifestPath = path.join(sourceRoot, 'asset-manifest.json');
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const listed = new Map(manifest.assets.map(a => [a.path.replace(/\\/g, '/'), a]));
  // 文档类（md/txt/gitkeep）不算资产，不参与清单比对
  const isDoc = f => /\.(md|txt)$/i.test(f) || f.endsWith('.gitkeep') || f === 'asset-manifest.json';
  const actual = new Set(source.files.map(item => path.relative(sourceRoot, item.file).replace(/\\/g, '/')).filter(p => !isDoc(p)));
  const unlisted = [...actual].filter(p => !listed.has(p));
  const ghost = [...listed.keys()].filter(p => !actual.has(p));
  const noLicense = [...listed.values()].filter(a => actual.has(a.path) && String(a.license || '').startsWith('未登记'));
  if (unlisted.length || ghost.length || noLicense.length) {
    console.log(`Manifest drift: ${unlisted.length} unlisted, ${ghost.length} ghost, ${noLicense.length} license-pending`);
    unlisted.slice(0, 8).forEach(p => console.log(`  + unlisted: ${p}`));
    ghost.slice(0, 8).forEach(p => console.log(`  - ghost:    ${p}`));
    noLicense.slice(0, 8).forEach(a => console.log(`  ? license:  ${a.path}`));
  } else {
    console.log(`Manifest: all ${actual.size} assets registered with license`);
  }
} else {
  console.log('Manifest: asset-manifest.json missing');
}
