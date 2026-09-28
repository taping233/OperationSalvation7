import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_WEIGHTS } from '../src/agent/agent.weights.js';

const CODE_PATHS = [
  'game/src', 'game/data', 'game/tools', 'game/index.html', 'scripts', 'narrative', 'tests',
  'package.json', 'package-lock.json', 'vite.config.js',
];
const HASHABLE_UNTRACKED = /^(?:game\/(?:src|data|tools)|scripts|tests)\/.*\.(?:[cm]?js|json|d\.ts|ts)$|^game\/index\.html$|^narrative\/.*\.(?:ink|json)$|^(?:package(?:-lock)?\.json|vite\.config\.js)$/i;

const sha256 = value => createHash('sha256').update(value).digest('hex');

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashWeightOverride(value) {
  return sha256(stableJson(value));
}

export function fingerprintCode({ head, trackedDiff, untracked = [] }) {
  const hash = createHash('sha256');
  hash.update(`head\0${head}\0tracked\0`);
  hash.update(trackedDiff);
  for (const entry of [...untracked].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(`\0untracked\0${entry.path}\0${entry.sha256}`);
  }
  return hash.digest('hex');
}

function gitBuffer(args, cwd, gitExec) {
  return gitExec('git', ['-c', 'core.quotepath=false', ...args], {
    cwd,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
}

function hashUntrackedFile(filename, root, readBytes, getStat, readLink) {
  const absolute = path.join(root, filename);
  const stat = getStat(absolute);
  const bytes = stat.isSymbolicLink()
    ? Buffer.from(`symlink:${readLink(absolute)}`, 'utf8')
    : stat.isFile() ? readBytes(absolute) : Buffer.from(`non-file:${stat.mode}`, 'utf8');
  return { path: filename.replaceAll('\\', '/'), sha256: sha256(bytes) };
}

export function captureCodeState(projectRoot, deps = {}) {
  const gitExec = deps.gitExec || execFileSync;
  const readBytes = deps.readBytes || readFileSync;
  const getStat = deps.getStat || lstatSync;
  const readLink = deps.readLink || readlinkSync;
  try {
    const head = gitBuffer(['rev-parse', 'HEAD'], projectRoot, gitExec).toString('utf8').trim();
    const branch = gitBuffer(['branch', '--show-current'], projectRoot, gitExec).toString('utf8').trim() || null;
    const trackedDiff = gitBuffer(['diff', '--binary', 'HEAD', '--', ...CODE_PATHS], projectRoot, gitExec);
    const status = gitBuffer(['status', '--porcelain=v1', '--untracked-files=all', '-z', '--', '.'], projectRoot, gitExec);
    const untrackedPaths = gitBuffer([
      'ls-files', '--others', '--exclude-standard', '-z', '--', ...CODE_PATHS,
    ], projectRoot, gitExec).toString('utf8').split('\0').filter(Boolean);
    const ignoredPaths = gitBuffer([
      'ls-files', '--others', '--ignored', '--exclude-standard', '-z', '--', ...CODE_PATHS,
    ], projectRoot, gitExec).toString('utf8').split('\0').filter(Boolean);
    const allUntrackedPaths = [...new Set([...untrackedPaths, ...ignoredPaths])]
      .filter(filename => HASHABLE_UNTRACKED.test(filename.replaceAll('\\', '/')));
    const untracked = allUntrackedPaths.map(filename => hashUntrackedFile(filename, projectRoot, readBytes, getStat, readLink));
    return {
      head,
      branch,
      dirty: status.length > 0 || trackedDiff.length > 0 || untracked.length > 0,
      fingerprint: fingerprintCode({ head, trackedDiff, untracked }),
    };
  } catch {
    // Provenance collection is best effort; inability to query Git must not abort a run.
    return null;
  }
}

export function createRunProvenance({ startCode, endCode, projectRoot, config, weights }) {
  let lockSha256 = '';
  try { lockSha256 = sha256(readFileSync(path.join(projectRoot, 'package-lock.json'))); }
  catch { /* Empty value is explicit and compare promotion checks will reject it. */ }

  const code = startCode ? {
    head: startCode.head,
    branch: startCode.branch,
    dirty: startCode.dirty,
    fingerprint: startCode.fingerprint,
    changedDuringRun: endCode
      ? startCode.head !== endCode.head || startCode.branch !== endCode.branch || startCode.fingerprint !== endCode.fingerprint
      : null,
  } : {
    head: null, branch: null, dirty: null, fingerprint: null, changedDuringRun: null,
  };

  return {
    schemaVersion: 1,
    code,
    runtime: { node: process.version, platform: process.platform, arch: process.arch, lockSha256 },
    config: { ...config },
    weights: {
      source: weights.source,
      sha256: weights.source === 'default' ? hashWeightOverride(DEFAULT_WEIGHTS) : weights.sha256,
    },
  };
}

export function attachRunProvenance(summary, provenance) {
  if (!summary.meta || typeof summary.meta !== 'object' || Array.isArray(summary.meta)) summary.meta = {};
  summary.meta.provenance = provenance;
  return summary;
}
