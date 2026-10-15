import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { performance } from 'node:perf_hooks';
import { JSDOM } from 'jsdom';
import { esc } from '../../../game/src/core/shared.js';

const baselineCommit = 'a330d25f47';
const before = execFileSync('git', ['show', `${baselineCommit}:搜打撤/game/src/core/icons-bitmap.js`], { encoding: 'utf8' });
const after = readFileSync('game/src/core/icons-bitmap.js', 'utf8');
const helper = readFileSync('game/src/core/icon-hydration.js', 'utf8').replace(/^export /gm, '');
const sha = source => createHash('sha256').update(source).digest('hex');
function runtime(source, optimized) {
  const dom = new JSDOM('<!doctype html><body></body>'), frames = [], observers = [];
  const { document, Node, NodeFilter } = dom.window;
  const stats = { contains: 0, walks: 0, visited: 0 };
  const originalContains = Node.prototype.contains;
  Node.prototype.contains = function (node) { stats.contains++; return originalContains.call(this, node); };
  const createWalker = document.createTreeWalker.bind(document);
  document.createTreeWalker = (...args) => {
    stats.walks++;
    const walker = createWalker(...args), next = walker.nextNode.bind(walker);
    walker.nextNode = () => { const node = next(); if (node) stats.visited++; return node; };
    return walker;
  };
  const context = vm.createContext({ document, window: { addEventListener() {} }, Node, NodeFilter,
    esc, assetUrl: value => value, console, setTimeout,
    requestAnimationFrame: fn => frames.push(fn),
    MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} },
    sdtDefine: (name, value) => { context[name] = value; },
  });
  vm.runInContext((optimized ? helper + '\n' : '') + source.replace(/^import .*;\r?\n/gm, ''), context);
  const reset = () => { for (const key of Object.keys(stats)) stats[key] = 0; };
  return { Icons: context.Icons, document, stats, reset, close: () => dom.window.close(),
    deliver(records) { observers[0](records); while (frames.length) frames.shift()(); } };
}
const oldRuntime = runtime(before, false), newRuntime = runtime(after, true);
const examples = ['', '普通文字', '<b title="💚">[[icon:bag]] 💚</b>', '[[icon:heart]]',
  '&lt;img&gt; 🪙', '<button aria-label="[[icon:bag]]">背包</button>'];
for (const sample of examples) {
  if (oldRuntime.Icons.rich(sample) !== newRuntime.Icons.rich(sample)) throw new Error(`Rich output changed: ${sample}`);
}
const median = samples => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];
function richTime(fn, text) {
  const start = performance.now();
  for (let i = 0; i < 15000; i++) fn(text);
  return performance.now() - start;
}
const plain = '<section class="page"><p>当前回合造成 12 点攻击伤害，剩余 30 点生命。</p></section>'.repeat(5);
richTime(oldRuntime.Icons.rich, plain); richTime(newRuntime.Icons.rich, plain);
const oldTimes = [], newTimes = [];
for (let run = 0; run < 7; run++) {
  // Alternate order to reduce warmup/order bias.
  for (const kind of run % 2 ? ['after', 'before'] : ['before', 'after']) {
    (kind === 'before' ? oldTimes : newTimes).push(richTime(kind === 'before' ? oldRuntime.Icons.rich : newRuntime.Icons.rich, plain));
  }
}
function mutations(runtime, kind) {
  const { document } = runtime;
  document.body.replaceChildren();
  const records = [];
  for (let i = 0; i < 400; i++) {
    const el = document.createElement('section'); el.innerHTML = '<b>123</b><span>普通文本</span>';
    document.body.append(el);
    records.push(kind === 'attributes' ? { type: 'attributes', target: el }
      : kind === 'text' ? { type: 'childList', addedNodes: [el.firstChild.firstChild] }
        : { type: 'childList', addedNodes: [el] });
  }
  runtime.reset(); const started = performance.now(); runtime.deliver(records);
  return { ...runtime.stats, elapsedMs: performance.now() - started };
}
const mutationResults = Object.fromEntries(['siblings', 'attributes', 'text'].map(kind => [kind,
  { before: mutations(oldRuntime, kind), after: mutations(newRuntime, kind) }]));
oldRuntime.close(); newRuntime.close();
const report = { baselineCommit, beforeSha256: sha(before), afterSha256: sha(after),
  environment: { node: process.version, platform: process.platform, harness: 'vm + jsdom; synthetic CPU benchmark, not browser FPS' },
  equivalenceSamples: examples.length,
  plainRich: { iterationsPerSample: 15000, beforeMs: oldTimes, afterMs: newTimes,
    beforeMedianMs: median(oldTimes), afterMedianMs: median(newTimes), reduction: 1 - median(newTimes) / median(oldTimes) },
  mutationResults };
writeFileSync(new URL('benchmark.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
