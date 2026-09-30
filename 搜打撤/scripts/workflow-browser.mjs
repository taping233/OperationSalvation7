import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// This function is self-contained: serialize it into the authorized built-in tab's
// evaluate call. It reads the current window only; no events, navigation or storage.
export function collectBrowserSnapshot(options) {
  const styles = ['display', 'visibility', 'opacity', 'color', 'background-color', 'font-size',
    'font-family', 'line-height', 'width', 'height', 'padding', 'border-radius', 'transform', 'pointer-events'];
  const nodes = [];
  const selectors = options.selectors ?? [];
  for (const entry of selectors) {
    const elements = document.querySelectorAll(entry.selector);
    if (elements.length > 500) throw new Error('单个选择器超过 500 节点，请缩小采集范围');
    for (const element of elements) {
      const attributes = {};
      for (const name of entry.identityAttributes ?? ['id', 'data-asset-key', 'data-card-id', 'data-key']) {
        if (element.hasAttribute(name)) attributes[name] = element.getAttribute(name);
      }
      const identity = Object.keys(attributes).length ? JSON.stringify(attributes)
        : JSON.stringify({ tag: element.tagName, text: element.textContent.trim().slice(0, 200), class: element.className });
      const computed = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      nodes.push({ key: entry.key, selector: entry.selector, identity, tag: element.tagName,
        text: element.textContent.trim().slice(0, 200), attributes,
        styles: Object.fromEntries(styles.map(name => [name, computed.getPropertyValue(name)])),
        rect: Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, rect[name]])) });
    }
  }
  return { schemaVersion: 1, kind: 'browser-snapshot', observedAt: new Date().toISOString(),
    scene: options.scene, collector: { ...options.collector },
    page: { origin: window.location.origin, pathname: window.location.pathname,
      viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio } },
    selectors: selectors.map(({ key, selector }) => ({ key, selector })), nodes,
    actions: options.actions ?? [{ type: 'static-inspection', detail: 'DOM 与计算样式只读采集' }],
    console: options.console ?? { coverage: 'not-collected', errors: [] }, screenshots: options.screenshots ?? [] };
}

function requireValue(condition, message) { if (!condition) throw new Error(message); }
function string(value) { return typeof value === 'string' && value.length > 0; }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function stringMap(value) { return object(value) && Object.values(value).every(item => typeof item === 'string'); }
function allowedKeys(value, keys, message) {
  requireValue(object(value) && Object.keys(value).every(key => keys.includes(key)), message);
}

export function validateBrowserSnapshot(snapshot) {
  allowedKeys(snapshot, ['schemaVersion', 'kind', 'observedAt', 'scene', 'collector', 'page', 'selectors', 'nodes', 'actions', 'console', 'screenshots'], '快照字段不符合 schema');
  requireValue(snapshot.schemaVersion === 1 && snapshot.kind === 'browser-snapshot', '不支持的浏览器证据 schema');
  requireValue(string(snapshot.scene) && string(snapshot.observedAt) && Number.isFinite(Date.parse(snapshot.observedAt)), '必须声明场景和采集时间');
  const collector = snapshot.collector;
  allowedKeys(collector, ['platform', 'browser', 'surface', 'transport'], '必须声明内置浏览器平台');
  requireValue(collector.surface === 'current-window' && ((collector.platform === 'Codex' && collector.browser === 'iab' && collector.transport === 'cua')
    || (collector.platform === 'ZCode' && collector.browser === 'builtin' && collector.transport === 'zcode-builtin')), '只接受当前平台内置浏览器的当前窗口声明');
  allowedKeys(snapshot.page, ['origin', 'pathname', 'viewport'], '页面字段不符合 schema');
  const { origin, pathname, viewport } = snapshot.page;
  requireValue(string(origin) && /^https?:\/\//.test(origin) && new URL(origin).origin === origin && string(pathname) && pathname.startsWith('/'), '必须提供有效 origin/pathname');
  allowedKeys(viewport, ['width', 'height', 'devicePixelRatio'], 'viewport 字段不符合 schema');
  requireValue(['width', 'height', 'devicePixelRatio'].every(key => Number.isFinite(viewport[key]) && viewport[key] > 0), '必须提供当前 viewport');
  requireValue(Array.isArray(snapshot.selectors) && snapshot.selectors.length > 0 && snapshot.selectors.length <= 50, '必须提供 1 至 50 个明确选择器');
  const selectorMap = new Map();
  for (const entry of snapshot.selectors) {
    allowedKeys(entry, ['key', 'selector'], '选择器字段不符合 schema');
    requireValue(string(entry.key) && string(entry.selector) && !selectorMap.has(entry.key), '选择器 key 必须唯一');
    selectorMap.set(entry.key, entry.selector);
  }
  requireValue(Array.isArray(snapshot.nodes) && snapshot.nodes.length <= 5000, '节点列表缺失或过大');
  for (const node of snapshot.nodes) {
    allowedKeys(node, ['key', 'selector', 'identity', 'tag', 'text', 'attributes', 'styles', 'rect'], '节点字段不符合 schema');
    requireValue(selectorMap.get(node.key) === node.selector && string(node.identity) && string(node.tag)
      && typeof node.text === 'string' && stringMap(node.attributes) && stringMap(node.styles), '节点身份/选择器/样式字段无效');
    allowedKeys(node.rect, ['x', 'y', 'width', 'height'], '节点尺寸字段不符合 schema');
    requireValue(['x', 'y', 'width', 'height'].every(key => Number.isFinite(node.rect[key])) && node.rect.width >= 0 && node.rect.height >= 0, '节点尺寸字段无效');
  }
  requireValue(Array.isArray(snapshot.actions) && snapshot.actions.length > 0, '必须声明证据操作类型');
  for (const action of snapshot.actions) {
    allowedKeys(action, ['type', 'detail', 'inputKind'], '操作字段不符合 schema');
    requireValue(['real-input', 'synthetic-event', 'static-inspection', 'screenshot', 'hover'].includes(action.type) && string(action.detail), '未知操作类型');
    if (action.type === 'hover') requireValue(['real-input', 'synthetic-event', 'static-inspection'].includes(action.inputKind), 'hover 必须注明真实输入/合成事件/静态检查');
    else requireValue(action.inputKind === undefined, '只有 hover 使用 inputKind');
  }
  allowedKeys(snapshot.console, ['coverage', 'errors'], 'console 字段不符合 schema');
  requireValue(['collected', 'not-collected'].includes(snapshot.console.coverage) && Array.isArray(snapshot.console.errors)
    && snapshot.console.errors.every(item => typeof item === 'string'), 'console 错误必须明确采集范围');
  requireValue(snapshot.console.coverage !== 'not-collected' || snapshot.console.errors.length === 0, '未采集 console 不能附带错误结论');
  requireValue(Array.isArray(snapshot.screenshots) && snapshot.screenshots.every(item => typeof item === 'string' && evidenceRelative(item)), '截图引用须位于日期任务证据目录');
  return snapshot;
}

function evidenceRelative(value) {
  return typeof value === 'string' && !value.includes('\\') && !value.includes(':') && !value.includes('\0')
    && !value.split('/').some(part => part === '.' || part === '..' || part === '')
    && /^docs\/evidence\/\d{4}-\d{2}-\d{2}-[A-Za-z0-9][A-Za-z0-9_-]*\/.+/.test(value);
}
function safeEvidencePath(root, relative) {
  requireValue(evidenceRelative(relative), '证据路径必须位于 docs/evidence/<日期>-<任务>/，禁止路径逃逸');
  const resolvedRoot = realpathSync(root);
  const target = path.resolve(resolvedRoot, relative);
  for (let current = target; current !== resolvedRoot; current = path.dirname(current)) {
    if (existsSync(current)) {
      requireValue(!lstatSync(current).isSymbolicLink(), '证据路径不能经过链接或 junction');
      const actual = realpathSync(current);
      requireValue(actual.startsWith(resolvedRoot + path.sep), '证据路径通过链接逃逸项目');
    }
  }
  return target;
}
function sha256(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function writeEvidence(root, task, date, suffix, bytes) {
  requireValue(typeof task === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(task), '任务编号无效');
  const dateValue = new Date(`${date}T00:00:00Z`);
  requireValue(typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(dateValue.getTime())
    && dateValue.toISOString().slice(0, 10) === date, '证据日期无效');
  const relative = `docs/evidence/${date}-${task}/browser-${randomUUID()}-${suffix}.json`;
  const target = safeEvidencePath(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  safeEvidencePath(root, relative);
  writeFileSync(target, bytes, { flag: 'wx' });
  return { file: relative, sha256: sha256(bytes) };
}
function readSnapshot(root, input) {
  // Explicit input may be a temporary export from the built-in browser. Outputs
  // and screenshot references are always confined to this project's evidence.
  const bytes = readFileSync(path.resolve(root, input));
  requireValue(bytes.length <= 10 * 1024 * 1024, '浏览器快照超过 10 MiB');
  const snapshot = validateBrowserSnapshot(JSON.parse(bytes.toString('utf8')));
  for (const screenshot of snapshot.screenshots) {
    requireValue(existsSync(safeEvidencePath(root, screenshot)), `截图引用不存在：${screenshot}`);
  }
  return { bytes, snapshot, sha256: sha256(bytes) };
}
export function importBrowserEvidence(root, { input, task, date }) {
  requireValue(string(input), '必须提供浏览器快照 input');
  const { bytes, snapshot } = readSnapshot(root, input);
  const result = writeEvidence(root, task, date, 'snapshot', bytes);
  return { ...result, scene: snapshot.scene, collector: snapshot.collector,
    limits: ['平台、操作类型和 console 覆盖为采集者声明；schema 不能证明实际工具来源',
      '静态样式、合成事件、截图不替代真实输入或真实 hover 验收；不自动判定游戏通过'] };
}

export function compareBrowserSnapshots(before, after) {
  validateBrowserSnapshot(before); validateBrowserSnapshot(after);
  const incompatible = [];
  for (const field of ['origin', 'pathname']) if (before.page[field] !== after.page[field]) incompatible.push(field);
  if (before.scene !== after.scene) incompatible.push('scene');
  for (const field of ['width', 'height', 'devicePixelRatio']) {
    if (before.page.viewport[field] !== after.page.viewport[field]) incompatible.push(`viewport.${field}`);
  }
  if (incompatible.length) return { status: 'inconclusive', incompatible, paired: 0, differences: [], inconclusive: [], limits: ['不同页面、场景或窗口尺寸不能直接作前后对比'] };
  const index = snapshot => {
    const result = new Map();
    for (const node of snapshot.nodes) {
      const key = JSON.stringify([node.key, node.selector, node.identity]);
      result.set(key, [...(result.get(key) ?? []), node]);
    }
    return result;
  };
  const left = index(before), right = index(after);
  const differences = [], inconclusive = [];
  let paired = 0;
  for (const key of new Set([...left.keys(), ...right.keys()])) {
    const previous = left.get(key) ?? [], current = right.get(key) ?? [];
    if (previous.length !== 1 || current.length !== 1) {
      inconclusive.push({ identity: JSON.parse(key), beforeCount: previous.length, afterCount: current.length,
        reason: previous.length > 1 || current.length > 1 ? '身份重复，不能按顺序强行配对' : '节点未配对' });
      continue;
    }
    paired++;
    for (const group of ['styles', 'rect', 'attributes']) {
      for (const field of new Set([...Object.keys(previous[0][group]), ...Object.keys(current[0][group])])) {
        if (previous[0][group][field] !== current[0][group][field]) differences.push({ identity: JSON.parse(key),
          field: `${group}.${field}`, before: previous[0][group][field] ?? null, after: current[0][group][field] ?? null });
      }
    }
    for (const field of ['text', 'tag']) if (previous[0][field] !== current[0][field]) differences.push({ identity: JSON.parse(key), field, before: previous[0][field], after: current[0][field] });
  }
  for (const key of new Set([...before.selectors.map(item => item.key), ...after.selectors.map(item => item.key)])) {
    if (!before.nodes.some(node => node.key === key) && !after.nodes.some(node => node.key === key)) inconclusive.push({ selectorKey: key, reason: '两侧均无节点，不构成通过证据' });
  }
  return { status: differences.length ? 'different' : inconclusive.length || !paired ? 'inconclusive' : 'equal',
    paired, differences, inconclusive, actions: { before: before.actions, after: after.actions },
    console: { before: before.console, after: after.console }, screenshots: { before: before.screenshots, after: after.screenshots },
    limits: ['equal 仅表示已配对节点字段一致；different 不是自动失败结论', '未配对/身份重复需人工复核；不同操作类型不可互相替代'] };
}
export function writeBrowserComparison(root, { before, after, task, date }) {
  const left = readSnapshot(root, before), right = readSnapshot(root, after);
  const report = { schemaVersion: 1, kind: 'browser-comparison', recordedAt: new Date().toISOString(),
    before: { input: before, sha256: left.sha256 }, after: { input: after, sha256: right.sha256 },
    ...compareBrowserSnapshots(left.snapshot, right.snapshot) };
  return { ...writeEvidence(root, task, date, 'comparison', JSON.stringify(report, null, 2) + '\n'), ...report };
}
