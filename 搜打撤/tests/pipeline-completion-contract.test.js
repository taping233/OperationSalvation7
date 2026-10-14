// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';

const sourceOf = file => readFileSync(path.resolve(file), 'utf8');
const astOf = source => parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const functionSource = (file, name) => {
  const source = sourceOf(file);
  const node = astOf(source).body.map(item => item.type === 'ExportNamedDeclaration' ? item.declaration : item).find(item => item?.type === 'FunctionDeclaration' && item.id.name === name);
  if (!node) throw new Error(`Missing function ${name}`);
  return source.slice(node.start, node.end);
};
const withoutImports = source => {
  let code = source;
  for (const node of [...astOf(source).body].reverse()) {
    if (node.type === 'ImportDeclaration') code = code.slice(0, node.start) + code.slice(node.end);
  }
  return code;
};
class ToolExit extends Error {
  constructor(code) { super(`Tool exited ${code}`); this.code = code; }
}
async function runSupervisor({ fresh = false, stamp, weights = '{}', history = JSON.stringify([{ gen: 1, sigma: 0.06, cluster: 'all', results: [{ tag: 'g1-i0', fitness: 0, extract: 100, abandon: 0, hard: false }] }]), missingHistory = false, unknown = false } = {}) {
  let now = 1000000;
  const output = [];
  const writes = new Map();
  const context = {
    process: { pid: 42, argv: ['/node', '/supervise', '--dir', '/fixture/evolve', '--grace', '1', '--interval', '1', '--max', '4', '--kill', '0'],
      cwd: () => '/fixture', exit(code) { throw new ToolExit(code); } },
    Date: class extends Date { constructor(value) { super(value ?? now); } static now() { return now; } },
    console: { log: (...args) => output.push(args.join(' ')), error: (...args) => output.push(args.join(' ')) },
    resolve: path.resolve, join: path.join,
    existsSync: file => file === '/fixture/evolve/best-weights.json' || (!missingHistory && file === '/fixture/evolve/history.json'),
    readdirSync: (_file, options) => options?.withFileTypes ? [{ name: 'best-weights.json', isDirectory: () => false }] : ['best-weights.json'],
    statSync: file => { if (missingHistory && file.endsWith('/history.json')) throw new Error('ENOENT'); return { mtimeMs: stamp ?? (fresh && now > 1000000 ? now : 999000) }; },
    readFileSync: file => file.endsWith('/history.json') ? history : weights, writeFileSync: (file, value) => writes.set(file, value),
    spawnSync: () => ({ status: unknown ? 1 : 0, stdout: '', signal: null }),
    setTimeout: callback => { now += 1000; callback(); },
  };
  let exitCode = null;
  try {
    await vm.runInNewContext(`(async () => { ${withoutImports(sourceOf('game/tools/agent-supervise.mjs'))} })()`, context, { timeout: 1000 });
  } catch (error) { if (!(error instanceof ToolExit)) throw error; exitCode = error.code; }
  return { exitCode, output: output.join('\n'), writes };
}

describe('Remaining development-tool lifecycle contracts', () => {
  it('fullrun accepts a newly persisted record after the 200-entry ring rotates', async () => {
    const ring = Array.from({ length: 200 }, (_, i) => ({ id: `prior-${i}` }));
    const checks = [];
    const context = {
      ensureTestRun: () => true, waitSettle: async () => {}, strategicPolicy: () => () => null,
      finalSnapshot: () => ({}), recorder: { listRuns: () => ring.slice() },
      autoRun: async () => { ring.push({ id: 'fresh' }); ring.shift(); return Object.assign([], { stopReason: 'run-end' }); },
    };
    vm.runInNewContext(`${functionSource('game/src/agent/agent.scenes.runtime.js', 'sceneFullrun')}\nglobalThis.run = sceneFullrun;`, context);
    await context.run({ options: {}, check: (name, pass) => checks.push({ name, pass }) });
    expect(checks.find(item => item.name === '跑局记录落盘')?.pass).toBe(true);
  });
  it('supervisor rejects pre-existing weights after processes disappear', async () => {
    const result = await runSupervisor();
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('VANISHED');
    expect(result.writes.size).toBe(1);
  });
  it.each([['invalid weights JSON', { weights: '{bad' }], ['invalid history JSON', { history: '{bad' }], ['missing history fields', { history: '[{}]' }], ['missing history artifact', { missingHistory: true }], ['non-numeric weights leaf', { weights: '{"geo":{"ban":"bad"}}' }]])('supervisor rejects %s', async (_label, options) => {
    const result = await runSupervisor({ fresh: true, ...options });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('VANISHED');
  });
  it.each([999999, 1000000, 1001001])('supervisor rejects an old, equal-start, or future timestamp: %i', async stamp => {
    const result = await runSupervisor({ stamp });
    expect(result.exitCode).toBe(1);
  });
  it('supervisor accepts a fresh timestamp just after the window opens', async () => {
    const result = await runSupervisor({ stamp: 1000001 });
    expect(result.exitCode).toBe(0);
  });
  it('unknown process enumeration never authorizes artifact completion', async () => {
    const result = await runSupervisor({ fresh: true, unknown: true });
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('MAX-TIME');
    expect(result.output).not.toContain('VANISHED');
    expect(result.output).not.toContain('监督结束');
  });
  it('supervisor accepts final artifacts freshly written during supervision', async () => {
    const result = await runSupervisor({ fresh: true });
    expect(result.exitCode).toBe(0);
    expect(result.writes.size).toBe(0);
  });
});

describe('IAB helper raw-value and polling contracts', () => {
  it.each([['synchronous value', '1+1', 2], ['asynchronous object', 'Promise.resolve({ ok: true, value: 7 })', { ok: true, value: 7 }]])('evalRaw awaits %s before JSON serialization', async (_label, expression, expected) => {
    const context = {};
    vm.runInNewContext(`${functionSource('scripts/iab-drive.mjs', 'evalRaw')}\nglobalThis.run = evalRaw;`, context);
    const tab = { playwright: { evaluate: code => vm.runInNewContext(code) } };
    expect(await context.run(tab, expression)).toEqual(expected);
  });
  it('evalRaw propagates a rejected page expression', async () => {
    const context = {};
    vm.runInNewContext(`${functionSource('scripts/iab-drive.mjs', 'evalRaw')}\nglobalThis.run = evalRaw;`, context);
    const tab = { playwright: { evaluate: code => vm.runInNewContext(code) } };
    await expect(context.run(tab, 'Promise.reject(new Error("fixture rejected"))')).rejects.toThrow('fixture rejected');
  });
  it.each([0, -1, NaN, Infinity])('runScene uses its finite default for invalid timeout %s', async timeoutMs => {
    let now = 0;
    const context = { Date: { now: () => now }, evalRaw: async (_tab, expression) => expression.includes('.start(') ? { ok: true } : { done: true, report: { pass: true } } };
    vm.runInNewContext(`${functionSource('scripts/iab-drive.mjs', 'runScene')}\nglobalThis.run = runScene;`, context);
    const tab = { playwright: { waitForTimeout: async () => { now += 10; } } };
    expect(await context.run(tab, 'battle', { timeoutMs })).toEqual({ pass: true });
  });
  it('runScene returns a successful completion before timeout and prefers timeoutMs', async () => {
    let now = 0, polls = 0;
    const context = { Date: { now: () => now }, evalRaw: async (_tab, expression) => expression.includes('.start(') ? { ok: true } : ++polls === 1 ? { done: false } : { done: true, report: { pass: true } } };
    vm.runInNewContext(`${functionSource('scripts/iab-drive.mjs', 'runScene')}\nglobalThis.run = runScene;`, context);
    const tab = { playwright: { waitForTimeout: async () => { now += 10; } } };
    expect(await context.run(tab, 'battle', { timeoutMs: 100, timeoutMsMs: 5, pollMs: 10 })).toEqual({ pass: true });
  });
  it('runScene respects the standard timeoutMs option', async () => {
    let now = 0;
    const context = { Date: { now: () => now }, evalRaw: async (_tab, expression) => expression.includes('.start(') ? { ok: true } : { done: false } };
    vm.runInNewContext(`${functionSource('scripts/iab-drive.mjs', 'runScene')}\nglobalThis.run = runScene;`, context);
    let waits = 0;
    const tab = { playwright: { waitForTimeout: async () => { now += 10; if (++waits > 4) throw new Error('fixture polling exceeded requested timeout'); } } };
    expect((await context.run(tab, 'battle', { timeoutMs: 5, pollMs: 10 })).code).toBe('POLL_TIMEOUT');
  });
  it('runScene terminates repeated status errors while SDT remains present', async () => {
    let now = 0;
    const context = { Date: { now: () => now }, evalRaw: async (_tab, expression) => {
      if (expression.includes('.start(')) return { ok: true };
      if (expression === '!!window.SDT') return true;
      throw new Error('status fixture unavailable');
    } };
    vm.runInNewContext(`${functionSource('scripts/iab-drive.mjs', 'runScene')}\nglobalThis.run = runScene;`, context);
    let waits = 0;
    const tab = { playwright: { waitForTimeout: async () => { now += 10; if (++waits > 4) throw new Error('fixture endless error retry'); } } };
    expect((await context.run(tab, 'battle', { timeoutMsMs: 5, pollMs: 10 })).code).toBe('POLL_TIMEOUT');
  });
});

describe('Standalone rarity preview constructor contracts', () => {
  const previewContext = () => {
    const source = sourceOf('game/src/rarity-design-lab.js');
    const declarations = astOf(source).body.filter(node => node.type === 'FunctionDeclaration'
      || (node.type === 'VariableDeclaration' && !node.declarations.some(item => ['grid', 'dialog'].includes(item.id.name))));
    const context = {};
    vm.runInNewContext(`${declarations.map(node => source.slice(node.start, node.end)).join('\n')}\nglobalThis.renderCard = (tier, scheme, edition) => { revision = edition; return card(tier, scheme); };`, context);
    return context;
  };
  it('all four retained editions render every theme and tier without invalid numeric markup', () => {
    const context = previewContext();
    for (const edition of [6, 7, 8, 9]) for (const scheme of ['orbit', 'ink', 'frost', 'blade', 'rose']) for (let tier = 0; tier < 5; tier++) {
      const markup = context.renderCard(tier, scheme, edition);
      expect(markup).toContain('class="cost"');
      expect(markup).toContain('class="rules"');
      expect(markup).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it('ornament definitions retain unique IDs across multiple simultaneous cards', () => {
    const context = previewContext();
    const markup = [6, 7, 8, 9].flatMap(edition => [0, 1, 2, 3, 4].map(tier => context.renderCard(tier, 'rose', edition))).join('');
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const refs = [...markup.matchAll(/url\(#([^)]+)\)/g)].map(match => match[1]);
    expect(refs.every(id => ids.includes(id))).toBe(true);
  });
});
