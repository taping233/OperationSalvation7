import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const snapshot = path.resolve(here, '../snapshot');
const require = createRequire(path.resolve(snapshot, '../../../../package.json'));
const { JSDOM } = require('jsdom');
const source = file => fs.readFileSync(path.join(snapshot, file), 'utf8');
const strip = text => text.replace(/^import[^\n]*;[^\n]*$/gm, '').replace(/^export\s*\{[^}]*\};?\s*$/gm, '').replace(/^export (const|function|class|let) /gm, '$1 ');
const load = (file, bindings, exports) => {
  const context = vm.createContext({ console, setTimeout, clearTimeout, setImmediate, performance, AbortController, ...bindings });
  vm.runInContext(strip(source(file)) + '\n globalThis.result = {' + exports.join(',') + '};', context, { filename: file });
  return context.result;
};
const results = {};
{
  const dom = new JSDOM('<!doctype html><body><canvas id="game"></canvas><div id="overlay" hidden></div></body>', { url: 'https://fixture.invalid/' });
  const SDT = dom.window.SDT = { Notes: { get: () => '' }, Sound: { sfx() {} }, Motion: { reduceMotion: () => false } };
  const canvas = dom.window.document.getElementById('game');
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 });
  const frames = [];
  const scheduler = { invalidate() {} };
  const cameraSource = load('game/src/core/camera.js', { window: dom.window, renderScheduler: scheduler,
    requestAnimationFrame: fn => frames.push(fn), ease: { cubicInOut: u => u < .5 ? 4*u*u*u : 1-Math.pow(-2*u+2,3)/2 } }, ['nodeHitRadius']);
  const MAP = { cols: 10, rows: 10, tile: 100, boardId: 'fixture' };
  const cam = new SDT.Camera(MAP, 800, 600); cam.cx = 0; cam.cy = 100; cam.zoom = 1;
  const nodes = [0, 1, 2].map(idx => ({ li: 0, idx, x: idx * 100, y: 100, def: { type: 'chest' } }));
  const game = { state: 'idle', nodes, layerIdx: 0, trackPos: 0, seen: { '0,0': 1, '0,1': 1, '0,2': 1 },
    layerData: [{ name: 'fixture', logical: [{ next: [[0,1],[0,2]] }, {}, {}] }] };
  const moves = [];
  const UI = { el: { overlay: dom.window.document.getElementById('overlay') }, refresh() {}, hideTooltip() {}, showTooltip() {}, log() {} };
  const boot = source('game/src/game.boot.js');
  const bind = boot.slice(boot.indexOf('  function bindInput() {'), boot.indexOf('\n  // 结点命中'));
  const pick = boot.slice(boot.indexOf('  // 结点命中'), boot.indexOf('\n  // ---------- 主循环'));
  const context = vm.createContext({ window: dom.window, document: dom.window.document, canvas, cam, MAP, game, SDT, UI,
    renderScheduler: scheduler, nodeHitRadius: cameraSource.nodeHitRadius,
    requestAnimationFrame: fn => frames.push(fn), moveTo: (li, idx) => { moves.push([li,idx]); return true; },
    initDevMode() {}, cardPageLoading: false, cardPageOpen: false, storeGet: () => null,
  });
  vm.runInContext(bind + '\n' + pick + '\nbindInput();', context);
  // Real Camera.glideTo remains active while the map is idle; actual bindInput receives these events.
  cam.glideTo(100, 100, { dur: 460 });
  const pointer = type => { const e = new dom.window.MouseEvent(type, { button: 0, clientX: 500, clientY: 300, bubbles: true }); Object.defineProperty(e, 'pointerId', { value: 1 }); return e; };
  canvas.dispatchEvent(pointer('pointerdown')); // At down this coordinate points at node 1.
  frames.shift()(performance.now() + 500); // The actual glide reaches its endpoint while held.
  canvas.dispatchEvent(pointer('pointerup')); // No pointer motion, but the coordinate now points at node 2.
  assert.deepEqual(moves, [[0,2]]);
  results.cameraClick = { nodeUnderPointerAtDown: 1, selectedNodeAtUp: moves[0][1], physicalPointerMovementPx: 0, cameraGlideWhileIdle: true };
  dom.window.close();
}
// All DOMs are isolated jsdom fixtures. No live game, browser, configuration or storage is read.
{
  const dom = new JSDOM('<!doctype html><body><div id="name"></div></body>', { url: 'https://fixture.invalid/', runScripts: 'dangerously' });
  const SDT = dom.window.SDT = {};
  const esc = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
  load('game/src/core/icons-bitmap.js', { SDT, window: dom.window, document: dom.window.document,
    NodeFilter: dom.window.NodeFilter, Node: dom.window.Node, MutationObserver: undefined,
    sdtDefine: (name, value) => SDT[name] = value, assetUrl: s => s, esc }, []);
  const name = '<img id="injected" src="missing" onerror="window.auditInjected = true"> 🎒';
  const node = dom.window.document.getElementById('name');
  node.innerHTML = esc(name); // The same escaping used by cards.view.js:134.
  assert.equal(node.querySelector('img'), null);
  SDT.Icons.hydrate(node);
  const injected = node.querySelector('#injected');
  assert.ok(injected, 'escaped text was reparsed into an HTML element');
  injected.dispatchEvent(new dom.window.Event('error'));
  assert.equal(dom.window.auditInjected, true);
  results.hydrate = { escapedInput: name, renderedHtml: node.innerHTML, eventHandlerExecuted: dom.window.auditInjected };
  dom.window.close();
}
{
  const dom = new JSDOM('<!doctype html><body><div id="overlay"><div id="card"><h1 id="ovTitle"></h1><div id="ovBody"></div></div></div></body>', { url: 'https://fixture.invalid/' });
  const SDT = dom.window.SDT = { Sound: { sfx() {} } };
  const overlay = dom.window.document.getElementById('overlay');
  const body = dom.window.document.getElementById('ovBody');
  const methods = load('game/src/ui/overlay.js', { window: dom.window, document: dom.window.document }, ['overlayMethods']).overlayMethods;
  const UI = SDT.UI = { ...methods, el: { overlay, ovBody: body }, _acts: {}, act(n, fn) { this._acts[n] = fn; }, log() {} };
  const game = { runActive: false, battleActive: false, nestActive: false };
  const show = name => { overlay.hidden = false; body.innerHTML = '<button data-act="closeSettings">' + name + '</button>'; UI._acts = { closeSettings() {} }; };
  const nav = load('game/src/ui/quick-nav.js', { window: dom.window, document: dom.window.document, game,
    openSettings: () => show('设置'), openBaseHub: () => show('基地'), openSuggestionInbox() {}, openDataPageUi() {},
    openCardLibrary() {}, cancelPendingCardPageOpen() {} }, ['jump', 'listPages']);
  const controller = load('game/src/agent/agent.console.js', { window: dom.window, document: dom.window.document,
    jump: nav.jump, listPages: nav.listPages, esc: s => s, escAttr: s => s }, ['bindKeysTab']);
  body.innerHTML = '<button data-act="devcGoto" data-page="settings">进入设置</button>';
  controller.bindKeysTab(() => {});
  body.addEventListener('click', e => { const b = e.target.closest('[data-act]'); UI._acts[b.dataset.act](b.dataset); });
  body.querySelector('button').click();
  assert.equal(body.textContent, '设置', 'jump did open settings');
  assert.deepEqual(Object.keys(UI._acts), [], 'hideOverlay immediately discards new page actions');
  await new Promise(r => setTimeout(r, 230));
  assert.equal(overlay.hidden, true);
  results.quickNav = { openedSettings: true, hiddenAfterClick: overlay.hidden, remainingActions: Object.keys(UI._acts) };
  dom.window.close();
}
const game = { state: 'title', runActive: false, nestActive: false, discoveredPairs: {}, nestRunes: {}, ownedCards: [] };
const dom = new JSDOM('<!doctype html><body><div id="overlay" hidden><div id="ovTitle"></div><div id="ovBody"></div></div></body>', { url: 'https://fixture.invalid/' });
const SDT = dom.window.SDT = { game };
const recorder = load('game/src/agent/agent.recorder.js', { window: dom.window, localStorage: dom.window.localStorage, Random: { random: () => 0.5 } }, ['setDriver', 'getDriver', 'listRuns', 'resetRunCounters']);
const observe = () => ({ phase: 'title', turn: 0, run: null, battle: null, ui: { open: false, actions: [] }, actions: [] });
const protocol = load('game/src/agent/agent.protocol.js', {}, ['normalizeAction', 'actionId']);
const runner = load('game/src/agent/agent.runner.js', { ...protocol, ...recorder, window: dom.window, document: dom.window.document, game,
  getActiveSlot: () => 1, observe, settleSignature: () => 'title', bustSigCache() {}, markUiFailure() {}, isTurbo: () => true,
  findUiElement: () => null, collectActionKeys: () => [], overlayVisible: () => false,
  battleTick() {}, battleActionTick() {}, battleEnd() {}, moveTo() {}, reenterCell() {}, startNewGame() {} }, ['autoRun', 'stopRun']);
{
  recorder.setDriver('human');
  const trace = await runner.autoRun({ decide: () => null, driver: 'greedy', preSettled: true });
  assert.equal(trace.stopReason, 'decide-null');
  assert.equal(recorder.getDriver(), 'greedy');
  results.driverRestore = { prior: 'human', requested: 'greedy', after: recorder.getDriver() };
}
{
  let greedyCalls = 0, llmCalls = 0;
  const line = source('game/tools/agent-batch.mjs').split('\n').find(s => s.startsWith('const policyFactory = '));
  const context = vm.createContext({ POLICY: 'llm', Agent: {
    policies: { greedy: () => { greedyCalls++; return () => null; } },
    llm: { isEnabled: () => true, decide: () => { llmCalls++; return () => null; } },
  } });
  vm.runInContext(line + '\n policyFactory({ resetSlots: true });', context);
  assert.equal(greedyCalls, 1); assert.equal(llmCalls, 0);
  results.llmFactory = { policy: 'llm', configured: true, greedyCalls, llmCalls };
}
{
  const text = source('game/tools/agent-batch.mjs');
  const start = text.indexOf('const runOne = async (i) => {');
  const end = text.indexOf('\nconst provenanceStart = ', start);
  let stopCalls = 0, cleanupCalls = 0;
  const Agent = { ...runner, recorder, phase: () => 'title', stopRun() { stopCalls++; runner.stopRun(); } };
  const context = vm.createContext({ console: { log() {}, error() {} }, setTimeout, Date, window: dom.window, document: dom.window.document,
    SEED_BASE: 123, pendingSeed: null, lastStepAt: 0, errorBucket: [], noiseBucket: [],
    Agent, DRIVER: 'slow-fixture', MODE: 'standard', RUNS: 2, MAX_STEPS: 5, RUN_TIMEOUT_MS: 10,
    SLOW_STEP_MS: 1000, DEBUG_STEPS: 0, OUT_DIR: here, resolve: path.resolve,
    // This fake policy delays only a decision. Real autoRun remains active across the batch timeout.
    policyFactory: () => () => new Promise(r => setTimeout(() => r(null), 120)),
    cleanup: async () => { cleanupCalls++; },
    writeFileSync() {}, appendFileSync() {},
  });
  vm.runInContext(text.slice(start, end) + '\n globalThis.runOne = runOne;', context);
  const first = await context.runOne(0);
  const second = await context.runOne(1);
  assert.equal(first.stopReason, 'timeout');
  assert.equal(second.stopReason, 'already-running');
  assert.equal(stopCalls, 0);
  await new Promise(r => setTimeout(r, 180));
  results.batchTimeout = { firstStopReason: first.stopReason, nextStopReason: second.stopReason, stopCalls, cleanupCalls };
}
{
  const text = source('scripts/perf-ledger-capture.mjs');
  const start = text.indexOf('function killStaleAutomationEdge() {');
  const end = text.indexOf('\nfunction killEdgeTree()', start);
  const calls = [];
  const context = vm.createContext({ CDP_PORT: 5331, log() {}, execFileSync: (command, args) => {
    calls.push({ command, args });
    return command === 'netstat' ? '  TCP    127.0.0.1:5331  0.0.0.0:0  LISTENING  424242\n' : '';
  } });
  vm.runInContext(text.slice(start, end) + '\nkillStaleAutomationEdge();', context);
  const kills = calls.filter(call => call.command === 'taskkill');
  assert.equal(kills.length, 1); assert.ok(kills[0].args.includes('424242'));
  results.portCleanup = { fixtureProcess: 'unrelated listener 424242', commandsRecordedOnly: kills, identityQueryBeforeKill: false };
}
fs.writeFileSync(path.join(here, 'repro-results.json'), JSON.stringify({ fixtureOnly: true, liveBrowserUsed: false, realConfigRead: false, results }, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
dom.window.close();
