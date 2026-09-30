// @vitest-environment node
import {describe, expect, it, vi } from 'vitest';
import { API } from 'typescript/unstable/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fail, successReceipt } from '../game/src/hub/commands.shared.js';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sharedPath = path.join(projectRoot, 'game/src/hub/commands.shared.js');

function checkInMemory(source) {
  const virtualPath = path.join(projectRoot, 'tests/__commands-shared-contract-memory__.js');
  const configPath = path.join(projectRoot, 'tests/__commands-shared-contract-memory__.json');
  const files = new Map([
    [path.resolve(virtualPath), source],
    [path.resolve(configPath), JSON.stringify({
      compilerOptions: {
        allowJs: true,
        checkJs: true,
        noEmit: true,
        skipLibCheck: true,
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'Bundler',
      },
      files: [sharedPath, virtualPath],
    })],
  ]);
  const api = new API({
    cwd: projectRoot,
    fs: {
      fileExists: fileName => files.has(path.resolve(fileName)) ? true : undefined,
      readFile: fileName => files.get(path.resolve(fileName)),
    },
  });
  try {
    api.parseConfigFile(configPath);
    const snapshot = api.updateSnapshot({ openProjects: [configPath], openFiles: [virtualPath] });
    const project = snapshot.getDefaultProjectForFile(virtualPath);
    if (!project) throw new Error('TypeScript did not load the in-memory contract project');
    return [
      ...project.program.getProgramDiagnostics(),
      ...project.program.getSyntacticDiagnostics(virtualPath),
      ...project.program.getSemanticDiagnostics(virtualPath),
    ];
  } finally {
    api.close();
  }
}

describe('shared command result contracts', () => {
  it('keeps failure details optional and successful transaction receipts serializable', () => {
    const withoutDetails = fail('INVALID_ARGUMENT', 'bad input');
    expect(withoutDetails).toEqual({ ok: false, code: 'INVALID_ARGUMENT', message: 'bad input', retryable: false });
    expect(Object.hasOwn(withoutDetails, 'details')).toBe(false);
    expect(fail('LOCK_FAILED', 'try again', true, { slotId: 2 })).toEqual({
      ok: false, code: 'LOCK_FAILED', message: 'try again', retryable: true, details: { slotId: 2 },
    });

    const receipt = successReceipt({
      requestId: 'req-1', command: 'extract', baseRevision: 8, runRevision: 12,
      runId: 'run-1', output: { extracted: true },
    }, 8);
    expect(receipt).toEqual({
      ok: true,
      value: {
        requestId: 'req-1', command: 'extract', baseRevision: 8, runRevision: 12,
        runId: 'run-1', output: { extracted: true },
      },
      revision: 8,
    });
    expect(JSON.parse(JSON.stringify(receipt))).toEqual(receipt);
  });

  it('type-checks valid results and rejects malformed fail and receipt arguments', () => {
    const validDiagnostics = checkInMemory(`
      import { fail, successReceipt } from '../game/src/hub/commands.shared.js';
      const error = fail('INVALID_ARGUMENT', 'bad input', false, { field: 'slotId' });
      /** @type {false} */ const falseLiteral = error.ok;
      const output = { recovered: true };
      const receipt = successReceipt({ requestId: 'req', command: 'recover', baseRevision: 2,
        runRevision: 5, runId: 'run', output }, 2);
      /** @type {true} */ const successLiteral = receipt.ok;
      /** @type {boolean} */ const recovered = receipt.value.output.recovered;
      /** @type {number} */ const revision = receipt.revision;
    `);
    expect(validDiagnostics).toEqual([]);
    expect(checkInMemory('const = ;').length).toBeGreaterThan(0);

    const invalidExamples = [
      { source: `import { fail } from '../game/src/hub/commands.shared.js'; fail(7, 'bad input');`, code: 2345 },
      { source: `import { successReceipt } from '../game/src/hub/commands.shared.js';
        successReceipt({ command: 'recover', baseRevision: 2, runRevision: 5, runId: 'run', output: null }, 2);`, code: 2741 },
      { source: `import { successReceipt } from '../game/src/hub/commands.shared.js';
        successReceipt({ requestId: 'req', command: 'recover', baseRevision: '2', runRevision: 5,
          runId: 'run', output: null }, 2);`, code: 2322 },
      { source: `import { successReceipt } from '../game/src/hub/commands.shared.js';
        successReceipt({ requestId: 'req', command: 'recover', baseRevision: 2, runRevision: 5,
          runId: 'run', output: null }, '2');`, code: 2345 },
    ];
    for (const example of invalidExamples) {
      const diagnostics = checkInMemory(example.source);
      expect(diagnostics.some(diagnostic => diagnostic.code === example.code), JSON.stringify(diagnostics)).toBe(true);
    }
  });
});
