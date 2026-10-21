import { describe, expect, it } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.join(root, 'jsconfig.framework-ports.json');

// Mutate the real JS module in the compiler's virtual filesystem. This catches a
// removed @ts-check/strict boundary even if the caller fixture keeps compiling.
function implementationDiagnostics(relativePath, before, after) {
  const modulePath = path.join(root, relativePath);
  const source = readFileSync(modulePath, 'utf8');
  if (before && !source.includes(before)) throw new Error(`Mutation anchor missing: ${before}`);
  const replacement = before ? source.replace(before, after) : source;
  const api = new API({ cwd: root, fs: {
    readFile: fileName => path.resolve(fileName) === modulePath ? replacement : undefined,
  } });
  try {
    api.parseConfigFile(configPath);
    const snapshot = api.updateSnapshot({ openProjects: [configPath], openFiles: [modulePath] });
    const project = snapshot.getDefaultProjectForFile(modulePath);
    if (!project) throw new Error('The strict ports project did not load the implementation');
    return project.program.getSemanticDiagnostics(modulePath);
  } finally { api.close(); }
}

describe('strict core assembly implementation boundary', () => {
  it('checks real numeric effect commands, beyond caller fixtures', () => {
    const module = 'game/src/battle/core/battle.effect-assembly.domain.js';
    expect(implementationDiagnostics(module)).toEqual([]);
    const errors = implementationDiagnostics(module,
      'instanceRuntime.set$energy(instanceRuntime.energy + (amount))',
      "instanceRuntime.set$energy('invalid-energy')");
    expect(errors.some(error => error.code === 2345)).toBe(true);
  });

  it('checks the actual projected snapshot fields', () => {
    const module = 'game/src/battle/core/battle.snapshot-projection.domain.js';
    expect(implementationDiagnostics(module)).toEqual([]);
    const errors = implementationDiagnostics(module,
      'battleToken: instanceRuntime.battleState.token', "battleToken: 'invalid-token'");
    expect(errors.some(error => error.code === 2322)).toBe(true);
  });

  it('keeps noImplicitAny enabled for the real assembly body', () => {
    const errors = implementationDiagnostics('game/src/battle/core/battle.effect-assembly.domain.js',
      'const { handSelectQueue, choiceQueue } = executionSession;',
      'const untypedCoreCommand = value => value;\nconst { handSelectQueue, choiceQueue } = executionSession;');
    expect(errors.some(error => error.code === 7006)).toBe(true);
  });
});
