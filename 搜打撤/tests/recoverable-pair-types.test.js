// @vitest-environment node
import {describe, expect, it, vi } from 'vitest';
import { API } from 'typescript/unstable/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(projectRoot, 'game/src/hub/recoverable-pair.js');

function checkInMemory(source) {
  const virtualPath = path.join(projectRoot, 'tests/__recoverable-pair-contract-memory__.js');
  const configPath = path.join(projectRoot, 'tests/__recoverable-pair-contract-memory__.json');
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
      files: [sourcePath, virtualPath],
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
    if (!project) throw new Error('TypeScript did not load the in-memory recoverable-pair project');
    const program = project.program;
    return [
      ...program.getProgramDiagnostics(),
      ...program.getSyntacticDiagnostics(virtualPath),
      ...program.getSemanticDiagnostics(virtualPath),
    ];
  } finally {
    api.close();
  }
}

const validExample = `
  import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
  const storage = /** @type {Parameters<typeof createRecoverablePair>[0]['storage']} */ ({
    getItem: (_key) => null,
    setItem: (_key, _value) => {},
    removeItem: (_key) => {},
  });
  const pair = createRecoverablePair({
    storage,
    keyFor: slotId => ({ base: 'base-' + slotId, run: 'run-' + slotId, journal: 'journal-' + slotId }),
    failpoint: point => { /** @type {'after-journal' | 'after-base' | 'after-run' | 'before-cleanup' | 'recover-after-base' | 'recover-after-run'} */ const validPoint = point; },
  });
  const entry = /** @type {Parameters<typeof pair.commit>[1]} */ ({
    version: 1, txId: 'tx-1', slotId: 1, requestId: 'req', command: 'settle', fingerprint: 'fp', runId: 'run',
    expectedBaseRevision: 0, expectedRunRevision: 0,
    before: { baseRaw: 'old-base', runRaw: null }, after: { baseRaw: 'new-base', runRaw: null },
    receipt: { ok: true, revision: 'opaque' }, phase: 'prepared',
  });
  const read = pair.readJournal(1);
  if (read.ok && read.value) {
    /** @type {'prepared' | 'base-written' | 'run-written'} */ const phase = read.value.phase;
    /** @type {string | null} */ const raw = read.value.before.baseRaw;
  }
  const recovered = pair.recover(1);
  if (recovered.ok) {
    /** @type {Record<string, unknown> | null} */ const receipt = recovered.value;
  }
  const committed = pair.commit(1, entry);
  if (committed.ok) {
    /** @type {Record<string, unknown>} */ const receipt = committed.value;
    /** @type {unknown} */ const revision = committed.revision;
  }
`;

describe('recoverable pair type boundary', () => {
  it('accepts the storage port and narrows each public result by ok', () => {
    expect(checkInMemory(validExample)).toEqual([]);
  });

  it('rejects bad ports, journal fields, slot arguments, and unsafe result assumptions', () => {
    const invalidExamples = [
      { source: `import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
        createRecoverablePair({ storage: { getItem: () => null, setItem: () => {} },
          keyFor: () => ({ base: 'b', run: 'r', journal: 'j' }) });`, code: 2741 },
      { source: `import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
        const pair = createRecoverablePair({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          keyFor: () => ({ base: 'b', run: 'r', journal: 3 }) });`, code: 2322 },
      { source: `import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
        const pair = createRecoverablePair({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          keyFor: slotId => ({ base: String(slotId), run: String(slotId), journal: String(slotId) }) });
        pair.readJournal('1');`, code: 2345 },
      { source: `import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
        const pair = createRecoverablePair({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          keyFor: () => ({ base: 'b', run: 'r', journal: 'j' }) });
        pair.commit(1, { version: 1, txId: 't', slotId: 1, requestId: 'q', command: 'c', fingerprint: 'f', runId: 'r',
          expectedBaseRevision: 0, expectedRunRevision: 0, before: { baseRaw: 2, runRaw: null },
          after: { baseRaw: null, runRaw: null }, receipt: {}, phase: 'prepared' });`, code: 2322 },
      { source: `import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
        const pair = createRecoverablePair({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          keyFor: () => ({ base: 'b', run: 'r', journal: 'j' }) });
        pair.commit(1, { version: 1, txId: 't', slotId: 1, requestId: 'q', command: 'c', fingerprint: 'f', runId: 'r',
          expectedBaseRevision: 0, expectedRunRevision: 0, before: { baseRaw: null, runRaw: null },
          after: { baseRaw: null, runRaw: null }, receipt: {}, phase: 'finished' });`, code: 2322 },
      { source: `import { createRecoverablePair } from '../game/src/hub/recoverable-pair.js';
        const pair = createRecoverablePair({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
          keyFor: () => ({ base: 'b', run: 'r', journal: 'j' }) });
        const result = pair.commit(1, { version: 1, txId: 't', slotId: 1, requestId: 'q', command: 'c', fingerprint: 'f', runId: 'r',
          expectedBaseRevision: 0, expectedRunRevision: 0, before: { baseRaw: null, runRaw: null },
          after: { baseRaw: null, runRaw: null }, receipt: {}, phase: 'prepared' });
        if (result.ok === true) { const code = result.code; }`, code: 2339 },
    ];
    for (const [index, example] of invalidExamples.entries()) {
      const diagnostics = checkInMemory(example.source);
      expect(diagnostics.some(diagnostic => diagnostic.code === example.code), `negative example ${index}: ${JSON.stringify(diagnostics)}`).toBe(true);
    }
  });
});
