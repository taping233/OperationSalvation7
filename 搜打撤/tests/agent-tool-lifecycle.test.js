// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { parse } from 'acorn';

const sourceOf = file => readFileSync(path.resolve(file), 'utf8');
const astOf = source => parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const variableSource = (file, name) => {
  const source = sourceOf(file);
  const declaration = astOf(source).body.find(node => node.type === 'VariableDeclaration'
    && node.declarations.some(item => item.id.name === name));
  if (!declaration) throw new Error(`Missing variable ${name} in ${file}`);
  return source.slice(declaration.start, declaration.end);
};
const withoutImports = source => {
  let code = source;
  for (const node of [...astOf(source).body].reverse()) {
    if (node.type === 'ImportDeclaration') code = code.slice(0, node.start) + code.slice(node.end);
  }
  return code;
};
const functionSource = (file, name) => {
  const source = sourceOf(file);
  const node = astOf(source).body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
  if (!node) throw new Error(`Missing function ${name} in ${file}`);
  return source.slice(node.start, node.end);
};

class ToolExit extends Error {
  constructor(code) { super(`Tool exited ${code}`); this.code = code; }
}

// Execute the exact optimizer body with in-memory artifacts and a stub child.
// No game startup, subprocess, LLM call, dependency install, or repository write.
function runOptimizer(result, { stale = false, produce = true } = {}) {
  const files = new Map();
  const output = [];
  const summary = JSON.stringify({
    overall: { runs: 5, outcomes: { abandon: 0 }, avgLayer: 3, extractRate: 100, clearRate: 0 },
    meta: { timeoutRuns: 0, avgRunMs: 1 },
  });
  const records = Array.from({ length: 5 }, (_, i) => JSON.stringify({
    seed: 77001 + i, outcome: 'extract', maxLayer: 3,
  })).join('\n');
  if (stale) files.set('/fixture/evolve/eval-g0/summary.json', summary);
  const spawnSync = vi.fn((_executable, args) => {
    if (produce && result.status === 0 && !result.error && !result.signal) {
      const dir = args[args.indexOf('--out') + 1];
      files.set(path.join(dir, 'summary.json'), summary);
      files.set(path.join(dir, 'runs.jsonl'), records);
    }
    return { stdout: '', stderr: '', error: undefined, signal: null, ...result };
  });
  let exitCode = null;
  const context = {
    process: { execPath: '/node', argv: ['/node', '/optimizer', '--gens', '1', '--pop', '4',
      '--runs', '5', '--out', '/fixture/evolve'], cwd: () => '/fixture', exit(code) { throw new ToolExit(code); } },
    console: { log: (...args) => output.push(args.join(' ')), error: (...args) => output.push(args.join(' ')) },
    resolve: path.resolve, mkdirSync: () => {},
    writeFileSync: (file, bytes) => files.set(file, bytes),
    readFileSync: file => { if (!files.has(file)) throw new Error('ENOENT'); return files.get(file); },
    appendFileSync: (file, bytes) => files.set(file, (files.get(file) || '') + bytes),
    existsSync: file => files.has(file), spawnSync,
    DEFAULT_WEIGHTS: { geo: { ban: -1000, bias: 5 }, base: { extractLocked: 20 } },
    SeededRandomService: class { random() { return 0.5; } },
  };
  try { vm.runInNewContext(withoutImports(sourceOf('game/tools/agent-evolve.mjs')), context, { timeout: 1000 }); }
  catch (error) { if (!(error instanceof ToolExit)) throw error; exitCode = error.code; }
  return { exitCode, output: output.join('\n'), files, spawnSync };
}

describe('Agent tool lifecycle contracts', () => {
  it('accepts the optimizer strategic policy and selects its real factory', () => {
    const source = sourceOf('game/tools/agent-batch.mjs');
    const guard = astOf(source).body.find(node => node.type === 'IfStatement'
      && source.slice(node.start, node.end).includes('未知策略'));
    const exit = vi.fn();
    vm.runInNewContext(`const POLICY = 'strategic';\n${source.slice(guard.start, guard.end)}`, { process: { exit }, console });
    expect(exit).not.toHaveBeenCalled();
    const strategic = vi.fn();
    const context = { POLICY: 'strategic', Agent: { policies: { strategic }, llm: { decide: vi.fn() } } };
    vm.runInNewContext(`${variableSource('game/tools/agent-batch.mjs', 'policyFactory')}\nglobalThis.selected = policyFactory;`, context);
    expect(context.selected).toBe(strategic);
    expect(sourceOf('game/src/agent/agent.js')).toContain('strategic: strategicPolicy');
    expect(sourceOf('game/src/agent/agent.policy.js')).toContain('function strategicPolicy(');
  });

  it.each([
    ['nonzero status', { status: 2 }],
    ['termination signal', { status: null, signal: 'SIGTERM' }],
    ['spawn failure', { status: null, error: { code: 'ENOENT', message: 'missing executable' } }],
  ])('rejects %s even when a prior summary exists', (_label, result) => {
    const run = runOptimizer(result, { stale: true, produce: false });
    expect(run.exitCode).toBe(3);
    expect(run.spawnSync).toHaveBeenCalledTimes(1);
    expect(run.files.has('/fixture/evolve/best-weights.json')).toBe(false);
    expect(run.output).toContain('异常停车');
  });

  it('rejects a successful process that produced no summary', () => {
    const run = runOptimizer({ status: 0 }, { produce: false });
    expect(run.exitCode).toBe(3);
    expect(run.output).toContain('没写出 summary.json');
    expect(run.spawnSync).toHaveBeenCalledTimes(1);
  });

  it('accepts successful fixture evaluations and writes complete optimizer artifacts', () => {
    const run = runOptimizer({ status: 0 });
    expect(run.exitCode).toBe(0);
    expect(run.spawnSync).toHaveBeenCalledTimes(5);
    expect(run.files.has('/fixture/evolve/best-weights.json')).toBe(true);
    expect(run.files.has('/fixture/evolve/history.json')).toBe(true);
  });

  it('retains the fresh terminal record when the recorder ring is already full', async () => {
    const ring = Array.from({ length: 200 }, (_, i) => ({ id: `prior-${i}`, outcome: 'death' }));
    const fresh = { id: 'fresh-terminal', outcome: 'extract', seed: 77001, carriedValue: 12 };
    const context = {
      SEED_BASE: 77001, pendingSeed: null, DRIVER: 'strategic', MODE: 'standard', RUNS: 201,
      MAX_STEPS: 1, RUN_TIMEOUT_MS: 30000, STOP_SETTLE_WAIT_MS: 15000,
      lastStepAt: 0, errorBucket: [], noiseBucket: [], DEBUG_STEPS: 0, SLOW_STEP_MS: 1000,
      OUT_DIR: '/fixture', policyFactory: () => () => null,
      console: { log() {}, error() {} }, setTimeout: () => 0, cleanup: async () => {},
      window: { SDT: { game: { nestActive: false, terminalPending: null } } },
      Agent: {
        recorder: { listRuns: () => ring.slice(), resetRunCounters() {} },
        autoRun: async () => {
          ring.push(fresh); ring.splice(0, ring.length - 200);
          return Object.assign([], { stopReason: 'run-end' });
        },
      },
    };
    vm.runInNewContext(`${variableSource('game/tools/agent-batch.mjs', 'runOne')}\nglobalThis.run = runOne;`, context);
    const record = await context.run(0);
    expect(record.id).toBe('fresh-terminal');
    expect(record.outcome).toBe('extract');
    expect(record.seed).toBe(77001);
    expect(record.stopReason).toBe('run-end');
  });

  it.each([
    ['spawn failure', { error: { code: 'ENOENT', message: 'missing powershell' }, status: null, stdout: null }],
    ['nonzero status', { status: 1, stdout: '[{"pid":123}]' }],
    ['termination signal', { status: null, signal: 'SIGTERM', stdout: null }],
    ['malformed output', { status: 0, stdout: '{invalid' }],
  ])('supervisor treats %s as unknown, never as no processes', (_label, result) => {
    const context = { PATTERN: 'agent-evolve.mjs', KEY: 'fixture', process: { pid: 42 },
      spawnSync: () => result, console: { error: vi.fn() } };
    vm.runInNewContext(`${functionSource('game/tools/agent-supervise.mjs', 'psProcs')}\nglobalThis.result = psProcs();`, context);
    expect(context.result).toBeNull();
    expect(context.console.error).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['', []],
    ['{"pid":123,"cmd":"fixture"}', [{ pid: 123, cmd: 'fixture' }]],
    ['[{"pid":123,"cmd":"fixture"}]', [{ pid: 123, cmd: 'fixture' }]],
  ])('supervisor accepts successful enumeration: %s', (stdout, expected) => {
    const context = { PATTERN: 'agent-evolve.mjs', KEY: 'fixture', process: { pid: 42 },
      spawnSync: () => ({ status: 0, stdout, signal: null }), console: { error: vi.fn() } };
    vm.runInNewContext(`${functionSource('game/tools/agent-supervise.mjs', 'psProcs')}\nglobalThis.result = psProcs();`, context);
    expect(context.result).toEqual(expected);
    expect(context.console.error).not.toHaveBeenCalled();
  });
});
