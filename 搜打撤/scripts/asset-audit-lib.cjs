const { createHash } = require('node:crypto');
const { existsSync, readFileSync, readdirSync, lstatSync } = require('node:fs');
const path = require('node:path');

const hash = value => createHash('sha256').update(value).digest('hex');
const isDocument = value => /\.(md|txt)$/i.test(value) || value.endsWith('.gitkeep') || path.posix.basename(value) === '.gitignore' || value === 'asset-manifest.json';

// #35 行尾归一（2026-10-03 老板拍板方案 1）：文本类资产（svg/json）按 LF 归一后计 bytes/sha256，
// Windows 检出（CRLF）、Linux 检出与 git 对象（LF）三方一致；登记与审计同走本口径。
// latin1 逐字节往返无损，CRLF(0D 0A) 序列替换安全；二进制扩展不归一。
const TEXT_NORMALIZED_EXTENSIONS = new Set(['.svg', '.json']);
function canonicalAssetBytes(buffer, relativePath) {
  if (!TEXT_NORMALIZED_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase())) return buffer;
  return Buffer.from(buffer.toString('latin1').replaceAll('\r\n', '\n'), 'latin1');
}

function canonicalPath(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('asset path must be a nonempty string');
  const slash = value.replace(/\\/g, '/');
  if (slash.startsWith('/') || /^[a-z]:/i.test(slash) || slash.split('/').includes('..')) throw new Error(`unsafe asset path: ${value}`);
  const normalized = path.posix.normalize(slash).normalize('NFC');
  if (normalized === '.' || normalized.startsWith('../')) throw new Error(`unsafe asset path: ${value}`);
  return normalized;
}

function walkAssets(dir, prefix = '') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    const relative = prefix + entry.name;
    if (isDocument(relative)) return [];
    const file = path.join(dir, entry.name);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) return [{ path: relative, symlink: true }];
    if (stat.isDirectory()) return walkAssets(file, relative + '/');
    if (!stat.isFile()) return [{ path: relative, unsupported: true }];
    const canonical = canonicalAssetBytes(readFileSync(file), relative);
    return [{ path: relative, bytes: canonical.length, sha256: hash(canonical) }];
  });
}

function inspectAssets(root) {
  const sourceRoot = path.join(root, 'game', 'assets');
  const manifest = JSON.parse(readFileSync(path.join(sourceRoot, 'asset-manifest.json'), 'utf8'));
  if (!manifest || !Array.isArray(manifest.assets)) throw new Error('manifest.assets must be an array');
  const actual = walkAssets(sourceRoot);
  const entries = new Map();
  const files = new Map(actual.map(item => [item.path, item]));
  const issues = [];
  function issue(code, assetPath, detail) {
    const item = files.get(assetPath) || null;
    const registration = entries.get(assetPath) || null;
    const fingerprint = hash(JSON.stringify({ code, path: assetPath, detail, item, registration }));
    issues.push({ code, path: assetPath, detail, fingerprint });
  }
  const casePaths = new Map();
  for (const entry of manifest.assets) {
    if (!entry || typeof entry !== 'object') throw new Error('manifest entry must be an object');
    const normalized = canonicalPath(entry.path);
    const group = entries.get(normalized) || [];
    group.push(entry);
    entries.set(normalized, group);
    const key = normalized.toLowerCase();
    const aliases = casePaths.get(key) || new Set();
    aliases.add(normalized);
    casePaths.set(key, aliases);
  }
  for (const [assetPath, group] of entries) {
    if (group.length > 1) issue('duplicate-entry', assetPath, `${group.length} registrations normalize to this path`);
    for (const entry of group) {
      if (entry.path !== assetPath) issue('noncanonical-path', assetPath, entry.path);
    }
  }
  for (const item of actual) {
    const key = item.path.normalize('NFC').toLowerCase();
    const aliases = casePaths.get(key) || new Set();
    aliases.add(item.path);
    casePaths.set(key, aliases);
  }
  for (const aliases of casePaths.values()) {
    if (aliases.size > 1) for (const assetPath of aliases) issue('path-collision', assetPath, [...aliases].sort().join(', '));
  }
  for (const item of actual) {
    if (item.symlink || item.unsupported) issue('unsupported-file', item.path, 'asset must be a regular file');
    if (!entries.has(item.path)) issue('unlisted', item.path, 'no manifest registration');
  }
  for (const [assetPath, group] of entries) {
    const item = files.get(assetPath);
    if (!item) issue('ghost', assetPath, 'registered asset is missing');
    for (const entry of group) {
      if (typeof entry.license !== 'string' || !entry.license.trim() || /^(未登记|待确认|unknown|pending)/i.test(entry.license.trim())) {
        issue('license-pending', assetPath, 'license is absent or explicitly pending');
      }
      if (item && !item.symlink && !item.unsupported) {
        if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || entry.bytes !== item.bytes) issue('bytes-mismatch', assetPath, `registered=${entry.bytes}; actual=${item.bytes}`);
        if (entry.ext !== path.posix.extname(assetPath).slice(1).toLowerCase()) issue('extension-mismatch', assetPath, `registered=${entry.ext}`);
        if (entry.sha256 !== undefined && (!/^[a-f0-9]{64}$/.test(entry.sha256) || entry.sha256 !== item.sha256)) issue('sha256-mismatch', assetPath, 'registered hash differs from file');
      }
    }
  }
  if (manifest.count !== manifest.assets.length) issue('count-mismatch', 'asset-manifest.json', `registered=${manifest.count}; actual=${manifest.assets.length}`);
  return { actual, issues: issues.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code)) };
}

function selectedAssetPaths(paths) {
  if (!Array.isArray(paths) || paths.some(value => typeof value !== 'string')) throw new Error('paths must be an array of strings');
  return paths.map(value => value.replace(/\\/g, '/').replace(/^搜打撤\//, '')).filter(value => value.startsWith('game/assets/')).map(value => canonicalPath(value.slice('game/assets/'.length))).filter(value => !isDocument(value));
}

function auditAssets({ root, paths = [], debtPath = path.join(root, 'docs', 'asset-audit-debt.json') }) {
  const inspected = inspectAssets(root);
  const debt = JSON.parse(readFileSync(debtPath, 'utf8'));
  if (!debt || debt.version !== 1 || !Array.isArray(debt.issues) || debt.issues.some(item => !item || typeof item.code !== 'string' || typeof item.path !== 'string' || !/^[a-f0-9]{64}$/.test(item.fingerprint))) {
    throw new Error('invalid historical asset debt snapshot; refuse to accept new debt');
  }
  const historical = new Set(debt.issues.map(item => item.fingerprint));
  const selected = selectedAssetPaths(paths);
  const errors = [];
  const warnings = [];
  for (const issue of inspected.issues) {
    const touched = selected.some(value => issue.path === value || issue.path.startsWith(value + '/'));
    (historical.has(issue.fingerprint) && !touched ? warnings : errors).push(issue);
  }
  return { ...inspected, errors, warnings, ok: errors.length === 0 };
}

module.exports = { auditAssets, canonicalAssetBytes, canonicalPath, inspectAssets, selectedAssetPaths };
