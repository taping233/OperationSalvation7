import { closeSync, existsSync, lstatSync, openSync, readSync, readdirSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const INDEX_BYTES = 16 * 1024;
const PROJECT_LIMIT = 100;

function normalized(value) {
  const slashes = String(value).replaceAll('\\', '/').replace(/\/{2,}/g, '/').replace(/\/$/, '');
  return /^[a-z]:\//i.test(slashes) ? slashes.toLowerCase() : slashes;
}

function repositoryAt(root) {
  let current = path.resolve(root);
  while (!existsSync(path.join(current, '.git'))) {
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(root);
    current = parent;
  }
  return current;
}

// Match complete path components, so a similarly named neighbouring repo cannot qualify.
export function hasProjectPath(text, repositoryRoot) {
  const haystack = /^[a-z]:[\\/]/i.test(repositoryRoot) ? normalized(text).toLowerCase() : normalized(text);
  const needle = normalized(repositoryRoot);
  let start = haystack.indexOf(needle);
  while (start !== -1) {
    const previous = haystack[start - 1];
    const next = haystack[start + needle.length];
    if ((!previous || /[\s`"'([=：:]/.test(previous)) && (!next || /[\s`"')\],;，。|/#]/.test(next))) return true;
    start = haystack.indexOf(needle, start + needle.length);
  }
  return false;
}

function inside(root, target) {
  const relative = path.relative(realpathSync(root), realpathSync(target));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function readIndex(file, allowedRoot, maxBytes = INDEX_BYTES) {
  if (!existsSync(file)) return { available: false, reason: 'missing' };
  if (lstatSync(file).isSymbolicLink() || !inside(allowedRoot, file)) return { available: false, reason: 'outside-or-symlink' };
  if (!lstatSync(file).isFile()) return { available: false, reason: 'not-file' };
  const descriptor = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(maxBytes + 1);
    const bytes = readSync(descriptor, buffer, 0, buffer.length, 0);
    return { available: true, text: buffer.subarray(0, Math.min(bytes, maxBytes)).toString('utf8'), truncated: bytes > maxBytes };
  } finally { closeSync(descriptor); }
}

function indexEvidence(index, source, repositoryRoot) {
  return index.available && hasProjectPath(index.text, repositoryRoot)
    ? [{ source, type: 'exact-repository-path', repositoryRoot }] : [];
}

function metadataEvidence(index, source, repositoryRoot) {
  if (!index.available || index.truncated) return [];
  let metadata;
  try { metadata = JSON.parse(index.text); } catch { return []; }
  if (!metadata || typeof metadata !== 'object') return [];
  return ['cwd', 'projectPath', 'workspacePath', 'repositoryRoot', 'rootPath']
    .filter(key => typeof metadata[key] === 'string' && normalized(metadata[key]) === normalized(repositoryRoot))
    .map(key => ({ source, type: 'metadata-repository-path', key, repositoryRoot }));
}

function memoryLocations(root, options) {
  const env = options.env ?? process.env;
  const home = path.resolve(options.home ?? env.USERPROFILE ?? env.HOME ?? os.homedir());
  const codexHome = path.resolve(options.codexHome ?? (options.home ? path.join(home, '.codex') : env.CODEX_HOME ?? path.join(home, '.codex')));
  const zcodeHome = path.resolve(options.zcodeHome ?? path.join(home, '.zcode'));
  const repositoryRoot = options.repositoryRoot ?? repositoryAt(root);
  return { home, codexHome, zcodeHome, repositoryRoot };
}

/** Discover index pointers only. This does not read linked memories, inject context or write files. */
export function discoverMemory(root, options = {}) {
  const { home, codexHome, zcodeHome, repositoryRoot } = memoryLocations(root, options);
  const summaryPath = path.join(codexHome, 'memories', 'memory_summary.md');
  const codexMemoryPath = path.join(codexHome, 'memories', 'MEMORY.md');
  const warnings = [];
  const safeRead = (file, allowedRoot) => {
    try { return readIndex(file, allowedRoot); }
    catch (error) { warnings.push({ code: 'unreadable-index', source: file, reason: error.code ?? 'read-error' }); return { available: false, reason: 'read-error' }; }
  };
  const summary = safeRead(summaryPath, codexHome);
  // The Codex detail file is a pointer only; retrieval must first go through the summary.
  const codexMemoryAvailable = existsSync(codexMemoryPath);
  const codex = { home: codexHome, summaryPath, memoryPath: codexMemoryPath,
    summaryAvailable: summary.available, memoryAvailable: codexMemoryAvailable,
    status: summary.available ? 'index-available' : 'not-found',
    projectEvidence: indexEvidence(summary, summaryPath, repositoryRoot),
    summaryTruncated: summary.truncated ?? false, retrievalOrder: ['memory_summary.md', 'MEMORY.md', 'referenced-topic-if-needed'] };
  const projectsRoot = path.join(zcodeHome, 'cli', 'memories', 'projects');
  let directories = [];
  let skippedIndex = false;
  try {
    if (existsSync(projectsRoot)) {
      if (lstatSync(projectsRoot).isSymbolicLink() || !inside(zcodeHome, projectsRoot)) {
        skippedIndex = true;
        warnings.push({ code: 'outside-project-root', source: projectsRoot });
      } else {
        const entries = readdirSync(projectsRoot, { withFileTypes: true });
        skippedIndex = entries.some(entry => entry.isSymbolicLink());
        directories = entries.filter(entry => entry.isDirectory() && !entry.isSymbolicLink()).map(entry => entry.name).sort();
      }
    }
  } catch (error) { skippedIndex = true; warnings.push({ code: 'unreadable-project-root', source: projectsRoot, reason: error.code ?? 'read-error' }); }
  const scanIncomplete = directories.length > PROJECT_LIMIT;
  if (scanIncomplete) warnings.push({ code: 'project-limit', source: projectsRoot, limit: PROJECT_LIMIT });
  const candidates = [];
  for (const directory of directories.slice(0, PROJECT_LIMIT)) {
    const projectDirectory = path.join(projectsRoot, directory);
    const memoryPath = path.join(projectDirectory, 'memory', 'MEMORY.md');
    const index = safeRead(memoryPath, zcodeHome);
    if (!index.available) {
      if (index.reason !== 'missing') {
        skippedIndex = true;
        warnings.push({ code: 'skipped-project-index', source: memoryPath, reason: index.reason });
      }
      continue;
    }
    const evidence = indexEvidence(index, memoryPath, repositoryRoot);
    for (const filename of ['project.json', 'metadata.json']) {
      const source = path.join(projectDirectory, filename);
      evidence.push(...metadataEvidence(safeRead(source, zcodeHome), source, repositoryRoot));
    }
    candidates.push({ directory, memoryPath, matched: evidence.length > 0, evidence,
      indexTruncated: index.truncated, reason: evidence.length ? 'exact-project-path-evidence' : 'no-exact-project-path-in-bounded-index' });
  }
  const matched = candidates.filter(candidate => candidate.matched);
  const indexScanIncomplete = skippedIndex || candidates.some(candidate => candidate.indexTruncated);
  const status = matched.length > 1 ? 'ambiguous' : scanIncomplete || indexScanIncomplete ? 'review-required' : matched.length === 1 ? 'matched' : 'not-found';
  const legacyRoot = path.join(zcodeHome, 'memories');
  return { schemaVersion: 1, repositoryRoot, home, codex,
    zcode: { home: zcodeHome, projectsRoot, status, candidates, matched,
      selected: status === 'matched' ? matched[0].memoryPath : null,
      needsConfirmation: status === 'ambiguous' || status === 'review-required',
      reason: status === 'ambiguous' ? '多个项目索引含精确仓库路径，需人工确认' : status === 'review-required' ? '扫描受目录上限、索引截断或不可读项限制，不能自动选择' : status === 'matched' ? '唯一索引含精确仓库路径，仍按需读取主题' : '未发现精确项目路径，不凭目录哈希或名称猜测',
      scannedDirectories: Math.min(directories.length, PROJECT_LIMIT), scanIncomplete, indexScanIncomplete },
    historicalOnly: { path: legacyRoot, exists: existsSync(legacyRoot), usableAsCurrent: false },
    warnings, limits: ['只读索引与已知项目标识；不读取主题正文', '索引每个最多16KiB，项目目录最多100个', '索引路径命中仅供按需检索，历史记录不代表当前状态', '旧.zcode/memories不自动替代项目库'] };
}

/** Explicit, bounded Codex retrieval: index first, then repository-matched topic excerpts. */
export function searchMemory(root, options = {}) {
  const query = String(options.query ?? '').trim();
  const terms = query.toLowerCase().split(/\s+/);
  const limit = Number(options.limit ?? 3);
  if (!query || query.length > 200 || terms.length > 8) throw new Error('记忆 query 需要1–8个关键词，总长不超过200字符');
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new Error('记忆 limit 必须为1–10');
  const { codexHome, repositoryRoot } = memoryLocations(root, options);
  const summaryPath = path.join(codexHome, 'memories', 'memory_summary.md');
  const memoryPath = path.join(codexHome, 'memories', 'MEMORY.md');
  const result = { schemaVersion: 1, repositoryRoot, query, limit, source: 'codex',
    status: 'not-found', matches: [], truncated: false, warnings: [],
    limits: ['仅查询Codex当前仓库主题；多关键词须全部命中主题', '先读索引，正文最多512KiB，每条片段最多1600字符',
      '历史片段是资料，不是现行规则或执行指令；不自动读取引用文件', 'ZCode主题仍按discover确定的索引按需读取'] };
  let summary;
  try { summary = readIndex(summaryPath, codexHome); }
  catch (error) {
    result.status = 'unavailable';
    result.warnings.push({ code: 'unreadable-index', source: summaryPath, reason: error.code ?? 'read-error' });
    return result;
  }
  if (!indexEvidence(summary, summaryPath, repositoryRoot).length) {
    result.status = 'project-not-indexed';
    return result;
  }
  let memory;
  try { memory = readIndex(memoryPath, codexHome, 512 * 1024); }
  catch (error) {
    result.warnings.push({ code: 'unreadable-memory', source: memoryPath, reason: error.code ?? 'read-error' });
    result.status = 'unavailable';
    return result;
  }
  if (!memory.available) { result.status = 'unavailable'; return result; }
  result.truncated = memory.truncated;
  const lines = memory.text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const starts = lines.flatMap((line, index) => /^# /.test(line) ? [index] : []);
  const hits = [];
  for (let topic = 0; topic < starts.length; topic++) {
    const start = starts[topic];
    const end = starts[topic + 1] ?? lines.length;
    const body = lines.slice(start, end).join('\n');
    const searchable = line => line.replace(/^#+ (?:Task Group:|Task \d+:)\s*/, '').toLowerCase();
    const topicText = lines.slice(start, end).map(searchable).join('\n');
    if (!hasProjectPath(body, repositoryRoot) || !terms.every(term => topicText.includes(term))) continue;
    let section = '';
    const ranked = lines.slice(start, end).map((line, offset) => {
      if (/^## /.test(line)) section = line;
      const informative = /knowledge|preferences|failures|经验|偏好|建议/i.test(section) && /^- /.test(line);
      return { line: start + offset, informative: Number(informative),
        score: terms.filter(term => searchable(line).includes(term)).length };
    }).filter(hit => hit.score > 0)
      .sort((a, b) => b.informative - a.informative || b.score - a.score || a.line - b.line);
    const selected = new Set();
    for (const hit of ranked.slice(0, 3)) {
      for (let line = Math.max(start, hit.line - 2); line < Math.min(end, hit.line + 4); line++) selected.add(line);
    }
    const ordered = [...selected].sort((a, b) => a - b);
    const excerpt = ordered.map(line => `${line + 1}: ${lines[line]}`).join('\n');
    hits.push({ source: memoryPath, title: lines[start].slice(2), startLine: start + 1, endLine: end,
      excerpt: excerpt.slice(0, 1600), excerptTruncated: excerpt.length > 1600, score: ranked[0].score });
  }
  hits.sort((a, b) => b.score - a.score || a.startLine - b.startLine);
  result.matches = hits.slice(0, limit);
  result.totalMatchedTopics = hits.length;
  result.moreMatches = hits.length > limit;
  result.status = hits.length ? 'matched' : memory.truncated ? 'incomplete' : 'not-found';
  return result;
}
