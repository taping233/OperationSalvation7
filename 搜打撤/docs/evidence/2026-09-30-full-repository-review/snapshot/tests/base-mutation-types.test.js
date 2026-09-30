// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { API } from 'typescript/unstable/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const mutationPath = path.join(projectRoot, 'game/src/hub/base-mutation.js');
const sharedPath = path.join(projectRoot, 'game/src/core/shared.js');

function checkInMemory(source) {
  const virtualPath = path.join(projectRoot, 'tests/__base-mutation-contract-memory__.ts');
  const configPath = path.join(projectRoot, 'tests/__base-mutation-contract-memory__.json');
  const files = new Map([
    [path.resolve(virtualPath), source],
    [path.resolve(configPath), JSON.stringify({
      compilerOptions: {
        target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ESNext', 'DOM'],
        allowJs: true, checkJs: true, strict: true, skipLibCheck: true, noEmit: true, types: [],
      },
      files: [sharedPath, mutationPath, virtualPath],
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
    if (!project) throw new Error('TypeScript did not load the base mutation contract project');
    const program = project.program;
    return [
      ...program.getGlobalDiagnostics(),
      ...program.getConfigFileParsingDiagnostics(),
      ...program.getProgramDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getBindDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];
  } finally {
    api.close();
  }
}

const validSource = `
  import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
  const state = { coins: 2 };
  const result = commitBaseMutation(state, draft => { draft.coins += 1; return draft.coins; }, draft => draft.coins > 0);
  if (result.ok) {
    const value: number = result.value;
    // @ts-expect-error success has no failure code
    result.code;
    void value;
  } else {
    const code: 'SAVE_FAILED' = result.code;
    // @ts-expect-error failed results do not contain a value
    result.value;
    void code;
  }
`;

describe('base mutation TypeScript contract', () => {
  it('checks the generic state, success and failure branches', () => {
    expect(checkInMemory(validSource)).toEqual([]);
  });

  it('rejects invalid draft members and persistence results that are not boolean', () => {
    const invalidExamples = [
      { source: `import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
        commitBaseMutation({ coins: 2 }, draft => draft.inventory.push('item'), () => true);`, code: 2339 },
      { source: `import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
        commitBaseMutation({ coins: 2 }, draft => draft.coins, () => 'saved');`, code: 2322 },
      { source: `import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
        const result = commitBaseMutation({ coins: 2 }, draft => draft.coins, () => true);
        if (result.ok) { const code = result.code; }`, code: 2339 },
      { source: `import { commitBaseMutation } from '../game/src/hub/base-mutation.js';
        const result = commitBaseMutation({ coins: 2 }, draft => draft.coins, () => false);
        if (!result.ok) { const value = result.value; }`, code: 2339 },
    ];
    for (const [index, example] of invalidExamples.entries()) {
      const diagnostics = checkInMemory(example.source);
      expect(diagnostics.some(diagnostic => diagnostic.code === example.code), `negative example ${index}: ${JSON.stringify(diagnostics)}`).toBe(true);
    }
  });
});
