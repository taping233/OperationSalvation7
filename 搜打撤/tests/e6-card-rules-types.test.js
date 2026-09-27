// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.join(projectRoot, 'jsconfig.card-rules.json');
const productionFiles = ['game/src/cards/card-rules.capability.js', 'game/src/battle/battle.rule-guard.js'];

function diagnosticsFor(source, overrides = []) {
  const fixturePath = path.join(projectRoot, 'tests/__e6-card-rules-memory__.ts');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.files.push(fixturePath);
  const files = new Map([
    [path.resolve(configPath), JSON.stringify(config)], [path.resolve(fixturePath), source],
    ...overrides.map(([name, text]) => [path.resolve(projectRoot, name), text]),
  ]);
  const api = new API({ cwd: projectRoot, fs: {
    fileExists: name => files.has(path.resolve(name)) ? true : undefined,
    readFile: name => files.get(path.resolve(name)),
  } });
  try {
    api.parseConfigFile(configPath);
    const snapshot = api.updateSnapshot({ openProjects: [configPath], openFiles: [fixturePath] });
    const project = snapshot.getDefaultProjectForFile(fixturePath);
    if (!project) throw new Error('E6 TypeScript project was not loaded');
    const program = project.program;
    return [
      ...program.getGlobalDiagnostics(), ...program.getConfigFileParsingDiagnostics(), ...program.getProgramDiagnostics(),
      ...[fixturePath, ...productionFiles.map(name => path.join(projectRoot, name))].flatMap(name => [
        ...program.getSyntacticDiagnostics(name), ...program.getSemanticDiagnostics(name),
      ]),
    ];
  } finally { api.close(); }
}

const valid = `
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { assertCardRulesExecutable, rejectUnsupportedCard } from '../game/src/battle/battle.rule-guard.js';
import type { BattleOperationName, OperationTarget, CardRuleCapability, AcquireDestination, AcquireAction } from '../game/src/cards/card-rules.capability.types.js';
const operation: BattleOperationName = 'acquire';
const target: OperationTarget = 'allEnemies';
const destination: AcquireDestination = 'hand';
const action: AcquireAction = 'dup';
const input: unknown = { rules: {} };
const result: CardRuleCapability = inspectCardRuleCapability(input);
if (!result.ok) { const message: string = result.issues[0].message; }
assertCardRulesExecutable(input);
const rejected: boolean = rejectUnsupportedCard(input, { warn(message: string) {} });
`;

describe('E6 strict production capability and battle guard type boundary', () => {
  it('checks both actual production roots plus a valid unknown-input consumer', () => {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    expect(config.compilerOptions.strict).toBe(true);
    expect(config.files).toEqual(productionFiles);
    for (const file of productionFiles) expect(readFileSync(path.join(projectRoot, file), 'utf8')).toMatch(/^\/\/ @ts-check/);
    expect(diagnosticsFor(valid)).toEqual([]);
  });

  it('rejects invalid operation, target, result branch, acquisition and warning port types', () => {
    const cases = [
      [`const wrong: BattleOperationName = 'summon';`, 2322],
      [`const wrong: OperationTarget = 'nearestEnemy';`, 2322],
      [`const wrong: AcquireDestination = 'bag';`, 2322],
      [`const wrong: AcquireAction = 'discard';`, 2322],
      [`if (result.ok) result.issues;`, 2339],
      [`rejectUnsupportedCard(input, { warn(message: number) {} });`, 2322],
      [`const wrong: CardRuleCapability = { kind: 'supported', ok: false, issues: [] };`, 2322],
    ];
    for (const [extra, code] of cases) {
      expect(diagnosticsFor(valid + extra).some(diagnostic => diagnostic.code === code), extra).toBe(true);
    }
  });

  it('proves production table and adapter implementations are checked, not only the fixture', () => {
    const capability = readFileSync(path.join(projectRoot, productionFiles[0]), 'utf8');
    const invalidTarget = capability.replace("damage: ['chosenEnemy', 'allEnemies', 'randomEnemy']", "damage: ['nearestEnemy']");
    expect(invalidTarget).not.toBe(capability);
    expect(diagnosticsFor(valid, [[productionFiles[0], invalidTarget]]).some(diagnostic => diagnostic.code === 2322)).toBe(true);
    const invalidOperation = capability.replace('heal: [], armor: []', 'unsupported: [], heal: [], armor: []');
    expect(invalidOperation).not.toBe(capability);
    expect(diagnosticsFor(valid, [[productionFiles[0], invalidOperation]]).some(diagnostic => diagnostic.code === 2353)).toBe(true);
    const guard = readFileSync(path.join(projectRoot, productionFiles[1]), 'utf8');
    const invalidGuard = guard.replace(/port\.warn\([^\n]+\);/, 'port.warn(42);');
    expect(invalidGuard).not.toBe(guard);
    expect(diagnosticsFor(valid, [[productionFiles[1], invalidGuard]]).some(diagnostic => diagnostic.code === 2345)).toBe(true);
  });
});
