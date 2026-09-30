import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';
import { collectBrowserSnapshot, compareBrowserSnapshots, importBrowserEvidence, validateBrowserSnapshot,
  writeBrowserComparison } from '../scripts/workflow-browser.mjs';

const roots = [];
const collector = { platform: 'Codex', browser: 'iab', surface: 'current-window', transport: 'cua' };
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-browser-evidence-'));
  roots.push(root);
  return root;
}
function capture(html = '<button data-key="a">同名卡牌</button><button data-key="b">同名卡牌</button>') {
  const dom = new JSDOM(html, { url: 'http://localhost:5200/game/index.html', runScripts: 'outside-only' });
  // Test the exact serialized browser function, with no module imports available.
  const snapshot = dom.window.eval(`(${collectBrowserSnapshot.toString()})`)({ collector, scene: '基地',
    selectors: [{ key: 'cards', selector: 'button' }] });
  dom.window.close();
  return snapshot;
}
function exportInput(root, snapshot = capture()) {
  const input = 'input.json';
  writeFileSync(path.join(root, input), JSON.stringify(snapshot));
  return input;
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'sdt-browser-evidence-'))) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('内置浏览器证据适配', () => {
  it('采集只读 DOM，不访问存储，不派发事件，不改变 viewport', () => {
    const dom = new JSDOM('<button id="one">出发</button>', { url: 'http://localhost:5200/game/index.html', runScripts: 'outside-only' });
    Object.defineProperty(dom.window, 'localStorage', { get() { throw new Error('不能读存档'); } });
    let clicks = 0;
    dom.window.document.querySelector('button').addEventListener('click', () => clicks++);
    const snapshot = dom.window.eval(`(${collectBrowserSnapshot.toString()})`)({ collector, scene: '基地', selectors: [{ key: 'depart', selector: '#one' }] });
    expect(validateBrowserSnapshot(snapshot)).toBe(snapshot);
    expect(snapshot.nodes[0].text).toBe('出发');
    expect(snapshot.page.viewport.width).toBe(dom.window.innerWidth);
    expect(snapshot.console.coverage).toBe('not-collected');
    expect(clicks).toBe(0);
    dom.window.close();
  });
  it('同名节点按稳定身份配对，重排不会出现假差异', () => {
    const before = capture();
    const after = capture('<button data-key="b">同名卡牌</button><button data-key="a">同名卡牌</button>');
    expect(compareBrowserSnapshots(before, after)).toMatchObject({ status: 'equal', paired: 2, differences: [] });
    after.nodes[0].styles.color = 'rgb(255, 0, 0)';
    const result = compareBrowserSnapshots(before, after);
    expect(result.status).toBe('different');
    expect(result.differences[0].identity[2]).toContain('"b"');
  });
  it('未配对、同名身份重复和两侧空选择器不当通过', () => {
    const before = capture();
    const after = capture('<button data-key="a">同名卡牌</button>');
    expect(compareBrowserSnapshots(before, after)).toMatchObject({ status: 'inconclusive', paired: 1 });
    const repeated = capture('<button>同名卡牌</button><button>同名卡牌</button>');
    expect(compareBrowserSnapshots(repeated, repeated)).toMatchObject({ status: 'inconclusive', paired: 0 });
    expect(compareBrowserSnapshots(capture(''), capture('')).status).toBe('inconclusive');
  });
  it('origin、场景、viewport 不一致直接记 inconclusive，不跨窗口作比较', () => {
    for (const modify of [s => { s.page.origin = 'http://localhost:5331'; }, s => { s.page.viewport.width++; },
      s => { s.scene = '战斗'; }, s => { s.page.pathname = '/other'; }]) {
      const before = capture(), after = capture();
      modify(after);
      expect(compareBrowserSnapshots(before, after)).toMatchObject({ status: 'inconclusive', paired: 0 });
    }
  });
  it('拒绝外部平台、外部浏览器、缺平台标记以及未声明的附加存储字段', () => {
    for (const modify of [s => { s.collector.browser = 'edge'; }, s => { delete s.collector.platform; },
      s => { s.collector.transport = 'cdp'; }, s => { s.collector.surface = 'headless'; },
      s => { s.localStorage = { savedGame: 'private' }; }]) {
      const snapshot = capture(); modify(snapshot);
      expect(() => validateBrowserSnapshot(snapshot)).toThrow();
    }
    const zcode = capture();
    zcode.collector = { platform: 'ZCode', browser: 'builtin', surface: 'current-window', transport: 'zcode-builtin' };
    expect(() => validateBrowserSnapshot(zcode)).not.toThrow();
  });
  it('区分真实输入、合成事件、hover 来源与未知 console 覆盖', () => {
    const snapshot = capture();
    snapshot.actions = [{ type: 'real-input', detail: '内置浏览器点击出发' }, { type: 'synthetic-event', detail: '合成按键' },
      { type: 'hover', inputKind: 'static-inspection', detail: '只检查 hover 相关样式，未移动指针' }];
    const result = compareBrowserSnapshots(snapshot, snapshot);
    expect(result.actions.before).toEqual(snapshot.actions);
    expect(result.console.before.coverage).toBe('not-collected');
    delete snapshot.actions[2].inputKind;
    expect(() => validateBrowserSnapshot(snapshot)).toThrow('hover');
    snapshot.actions.pop(); snapshot.console.errors = ['编造未采集错误'];
    expect(() => validateBrowserSnapshot(snapshot)).toThrow('未采集');
  });
  it('证据导入保留原始字节，每次生成唯一文件，并输出有来源哈希的对比报告', () => {
    const root = fixture(), input = exportInput(root);
    const request = { input, task: 'workflow-completion', date: '2026-09-30' };
    const first = importBrowserEvidence(root, request), second = importBrowserEvidence(root, request);
    expect(first.file).not.toBe(second.file);
    expect(readFileSync(path.join(root, first.file))).toEqual(readFileSync(path.join(root, input)));
    const report = writeBrowserComparison(root, { before: first.file, after: second.file, ...request });
    expect(report.status).toBe('equal');
    expect(report.before.sha256).toBe(first.sha256);
    expect(JSON.parse(readFileSync(path.join(root, report.file), 'utf8')).kind).toBe('browser-comparison');
  });
  it('拒绝任务路径逃逸、错误日期、截图逃逸和缺失引用，不写目标外文件', () => {
    const root = fixture(), input = exportInput(root);
    for (const task of ['../outside', 'a/b', 'a\\b', 'C:escape']) {
      expect(() => importBrowserEvidence(root, { input, task, date: '2026-09-30' })).toThrow('任务');
    }
    expect(() => importBrowserEvidence(root, { input, task: 'test', date: '2026-02-31' })).toThrow('日期');
    expect(existsSync(path.join(root, 'docs'))).toBe(false);
    for (const screenshot of ['docs/evidence/2026-09-30-test/../../outside.png', 'docs/evidence/test/a.png', 'C:/outside.png',
      'docs/evidence/2026-09-30-test/missing.png']) {
      const snapshot = capture(); snapshot.screenshots = [screenshot]; exportInput(root, snapshot);
      expect(() => importBrowserEvidence(root, { input, task: 'test', date: '2026-09-30' })).toThrow();
    }
  });
  it('截图明确引用现有任务证据，保留证据种类而不声称验证通过', () => {
    const root = fixture(), snapshot = capture();
    const screenshot = 'docs/evidence/2026-09-30-test/current.png';
    mkdirSync(path.dirname(path.join(root, screenshot)), { recursive: true });
    writeFileSync(path.join(root, screenshot), 'fixture screenshot reference');
    snapshot.screenshots = [screenshot];
    snapshot.actions.push({ type: 'screenshot', detail: '当前窗口截图引用' });
    const input = exportInput(root, snapshot);
    const result = importBrowserEvidence(root, { input, task: 'test', date: '2026-09-30' });
    expect(result.limits.join(' ')).toContain('不自动判定游戏通过');
  });
  it('拒绝证据目录通过 junction 指到项目其他位置或项目外', () => {
    const root = fixture(), target = fixture(), input = exportInput(root);
    mkdirSync(path.join(root, 'docs/evidence'), { recursive: true });
    symlinkSync(target, path.join(root, 'docs/evidence/2026-09-30-test'), 'junction');
    expect(() => importBrowserEvidence(root, { input, task: 'test', date: '2026-09-30' })).toThrow('链接');
    expect(existsSync(path.join(target, 'browser'))).toBe(false);
  });
});
