// @vitest-environment node
import {describe, expect, it, vi } from 'vitest';
import { API } from 'typescript/unstable/sync';
import { readFileSync as readTextFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const fixturePath = path.join(projectRoot, 'tests/battle-settlement-types.fixture.ts');
const configPath = path.join(projectRoot, 'jsconfig.battle-settlement.json');
const productionPath = path.join(projectRoot, 'game/src/hub/battle-settlement.commands.js');
const typesPath = path.join(projectRoot, 'game/src/hub/battle-settlement.commands.types.d.ts');

function diagnosticsFor(source) {
  const files = new Map([
    [path.resolve(configPath), readTextFileSync(configPath, 'utf8')],
    [path.resolve(fixturePath), source],
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
    const snapshot = api.updateSnapshot({ openProjects: [configPath], openFiles: [fixturePath] });
    const project = snapshot.getDefaultProjectForFile(fixturePath);
    if (!project) throw new Error('TypeScript did not load the battle settlement contract project');
    const program = project.program;
    return [
      ...program.getGlobalDiagnostics(),
      ...program.getConfigFileParsingDiagnostics(),
      ...program.getProgramDiagnostics(),
      ...program.getSyntacticDiagnostics(),
      ...program.getBindDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ];
  } finally { api.close(); }
}

describe('battle settlement command types', () => {
  it('checks the production command and typed attempt/receipt results', () => {
    const source = readTextFileSync(fixturePath, 'utf8');
    expect(diagnosticsFor(source)).toEqual([]);
    expect(productionPath).toContain('battle-settlement.commands.js');
    expect(typesPath).toContain('battle-settlement.commands.types.d.ts');
  });

  it('rejects malformed nodes, attempt identities, afterRun snapshots, and unchecked results', () => {
    const source = readTextFileSync(fixturePath, 'utf8');
    const invalidNode = source.replace(
      "const node: BattleSettlementNode = { layerIdx: 2, trackPos: 4, isBoss: false, encounterId: 'group-4' };",
      "const node: BattleSettlementNode = { layerIdx: 'two', trackPos: 4, isBoss: false, encounterId: 'group-4' };",
    );
    expect(diagnosticsFor(invalidNode).some(diagnostic => diagnostic.code === 2322)).toBe(true);
    const invalidSnapshot = source.replace(
      "visited: { '2,4': 1 },",
      "visited: 'completed',",
    );
    expect(diagnosticsFor(invalidSnapshot).some(diagnostic => diagnostic.code === 2322)).toBe(true);
    const invalidAttempt = `${source}
      const malformed: BattleSettlementAttempt = {
        context: { slotId: '1', requestId: 'wrong', expectedBaseRevision: 3, expectedRunRevision: 'five' },
        command: 'battle.win', runId: 17, payload: node,
        afterBase: { eggBattles: 9, stats: { playSeconds: 22 } }, afterRun,
        output: { eggBattles: 9 },
      };
      commands.commitAttempt(malformed);
    `;
    expect(diagnosticsFor(invalidAttempt).some(diagnostic => diagnostic.code === 2322)).toBe(true);
    const uncheckedResult = `${source}
      commands.readReceipt({ slotId: 1, node }).then(result => result.value.requestId);
    `;
    expect(diagnosticsFor(uncheckedResult).some(diagnostic => diagnostic.code === 2339)).toBe(true);
  });
});
