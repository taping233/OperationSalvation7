import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL, URL as NodeURL } from 'node:url';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { TYPE_CONFIGS } from '../scripts/check-type-coverage.mjs';

// Same VM/injected-child pattern as acceptance-gate.test.js; never starts tsc.
const scriptUrl = pathToFileURL(path.resolve('scripts/check-types.mjs'));
const source = readFileSync(scriptUrl, 'utf8');
function load(coverage = { denominator: 2, implementationChecked: 2, strictChecked: 1, files: [] }, spawnErrors = new Map()) {
  const calls = [], children = [], events = [];
  let stdout = '', stderr = '', audits = 0;
  const processStub = {
    execPath: process.execPath,
    stdout: { write: text => { stdout += text; } },
    stderr: { write: text => { stderr += text; } },
  };
  // Only module wiring is replaced, not the scheduler or failure handling.
  expect(source.match(/^import .*;$/gm)).toHaveLength(3);
  const body = source.replace(/^import .*;\r?\n/gm, '')
    .replaceAll('import.meta.url', JSON.stringify(scriptUrl.href));
  const done = runInNewContext(`(async () => {\n${body}\n})()`, {
    process: processStub, TYPE_CONFIGS, fileURLToPath, URL: NodeURL,
    spawn: (node, args, options) => {
      calls.push({ node, args: [...args], options });
      events.push(`start:${args[3]}`);
      const index = calls.length - 1;
      if (spawnErrors.has(index)) throw spawnErrors.get(index);
      const child = new EventEmitter();
      child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      children[index] = child;
      return child;
    },
    auditTypeCoverage: async () => {
      audits++; events.push('audit');
      if (coverage instanceof Error) throw coverage;
      return coverage;
    },
  });
  return { calls, children, events, done, process: processStub,
    stdout: () => stdout, stderr: () => stderr, audits: () => audits };
}

async function finishAll(api, outcome = () => 0) {
  for (const [index, config] of TYPE_CONFIGS.entries()) {
    // Holding each child open must prevent the next spawn and the audit/report.
    expect(api.calls).toHaveLength(index + 1);
    expect(api.audits()).toBe(0);
    expect(api.stdout()).toBe('');
    expect(api.calls[index]).toEqual({ node: process.execPath,
      args: [fileURLToPath(new NodeURL('../node_modules/typescript/bin/tsc', scriptUrl)),
        '--noEmit', '-p', config, '--pretty', 'false'],
      options: { stdio: ['ignore', 'pipe', 'pipe'] } });
    const child = api.children[index];
    child.stdout.emit('data', Buffer.from(`out:${config}\n`));
    child.stderr.emit('data', Buffer.from(`err:${config}\n`));
    const result = outcome(index);
    api.events.push(`finish:${config}`);
    if (result instanceof Error) {
      child.emit('error', result);
      // Node emits close after spawn error; it must not overwrite that error.
      child.emit('close', -2);
    } else child.emit('close', result, result === null ? 'SIGTERM' : null);
    await Promise.resolve();
  }
}

const expectedOutput = (errorIndex = -1) => TYPE_CONFIGS.map((config, index) =>
  `Type-checking ${config}\n${index === errorIndex ? 'spawn failed' : `out:${config}\nerr:${config}\n`}`
).join('');

describe('serial type-check orchestration', () => {
  it('runs every original config in order, waits for each, then audits and exits zero', async () => {
    const api = load();
    await finishAll(api); await api.done;
    expect(api.events).toEqual([...TYPE_CONFIGS.flatMap(config => [`start:${config}`, `finish:${config}`]), 'audit']);
    expect(api.stdout()).toBe(expectedOutput() + 'Implementation type coverage: 2/2; strict: 1/2\n');
    expect(api.stderr()).toBe(''); expect(api.audits()).toBe(1);
    expect(api.process.exitCode).toBe(0);
  });

  it('collects nonzero, signal and spawn-error failures without skipping later configs or audit', async () => {
    const api = load();
    await finishAll(api, index => index === 0 ? 2 : index === 1 ? null : index === 2 ? new Error('spawn failed') : 0);
    await api.done;
    expect(api.calls).toHaveLength(TYPE_CONFIGS.length);
    expect(api.stdout()).toBe(expectedOutput(2) + 'Implementation type coverage: 2/2; strict: 1/2\n');
    expect(api.audits()).toBe(1); expect(api.process.exitCode).toBe(1);
  });

  it('still fails missing implementation coverage after otherwise successful checks', async () => {
    const api = load({ denominator: 2, implementationChecked: 1, strictChecked: 1,
      files: [{ file: 'game/src/missing.js', checkedBy: [] }, { file: 'game/src/checked.js', checkedBy: ['jsconfig.json'] }] });
    await finishAll(api); await api.done;
    expect(api.stdout()).toBe(expectedOutput() + 'Implementation type coverage: 1/2; strict: 1/2\n');
    expect(api.stderr()).toBe('Unchecked implementation files:\ngame/src/missing.js\n');
    expect(api.audits()).toBe(1); expect(api.process.exitCode).toBe(1);
  });

  it('attempts later configs after synchronous spawn throws, then rethrows the first rejection', async () => {
    const first = new Error('first spawn throw'), second = new Error('second spawn throw');
    const errors = new Map([[0, first], [2, second]]);
    const api = load(undefined, errors);
    const rejected = expect(api.done).rejects.toBe(first);
    for (let index = 0; index < TYPE_CONFIGS.length; index++) {
      if (errors.has(index)) continue;
      // One continuation settles runConfig; another catches a rejected spawn.
      await Promise.resolve(); await Promise.resolve();
      expect(api.calls).toHaveLength(index + 1);
      api.children[index].emit('close', index === 1 ? 2 : 0);
    }
    await rejected;
    expect(api.calls.map(call => call.args[3])).toEqual(TYPE_CONFIGS);
    expect(api.stdout()).toBe(''); expect(api.stderr()).toBe('');
    expect(api.audits()).toBe(0); expect(api.process.exitCode).toBeUndefined();
  });

  it('preserves coverage rejection rather than reporting a successful exit', async () => {
    const api = load(new Error('coverage failed'));
    const rejected = expect(api.done).rejects.toThrow('coverage failed');
    await finishAll(api); await rejected;
    expect(api.stdout()).toBe(expectedOutput());
    expect(api.audits()).toBe(1); expect(api.process.exitCode).toBeUndefined();
  });
});
