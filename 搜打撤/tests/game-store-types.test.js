import { describe, expect, it } from 'vitest';
import { API } from 'typescript/unstable/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const storePath = path.join(projectRoot, 'game/src/hub/game.store.js');

function checkInMemory(source) {
  const virtualPath = path.join(projectRoot, 'tests/__game-store-contract-memory__.js');
  const configPath = path.join(projectRoot, 'tests/__game-store-contract-memory__.json');
  const files = new Map([
    [path.resolve(virtualPath), source],
    [path.resolve(configPath), JSON.stringify({
      compilerOptions: {
        allowJs: true,
        checkJs: true,
        strict: false,
        noEmit: true,
        skipLibCheck: true,
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'Bundler',
      },
      files: [storePath, virtualPath],
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
    if (!project) throw new Error('TypeScript did not load the in-memory GameStore contract project');
    return [
      ...project.program.getProgramDiagnostics(),
      ...project.program.getSyntacticDiagnostics(virtualPath),
      ...project.program.getSemanticDiagnostics(virtualPath),
    ];
  } finally {
    api.close();
  }
}

describe('GameStore TypeScript contract', () => {
  it('accepts writable state and rejects writes through the typed snapshot', () => {
    const valid = checkInMemory(`
      import { GameStore } from '../game/src/hub/game.store.js';
      /** @typedef {import('../game/src/hub/game.store.types.js').JsonData} JsonData */
      const store = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } });
      store.state.coins = 7;
      store.state.ownedCards.push({ uid: 'u1', card: {
        cost: 2, type: '法术', rarity: '古朴', desc: '示例', value: 3, dmg: 1,
        rules: { triggers: { onPlay: [{ op: 'damage', amount: 2 }] } },
        meta: { origin: 'test' }, mechanics: { target: 'enemy' }
      } });
      store.state.ownedCards[0].card.rules.triggers.onPlay[0].amount = 3;
      const snapshot = store.getSnapshot();
      /** @type {number | undefined} */ const amount = snapshot.ownedCards[0].card.rules.triggers.onPlay[0].amount;
      /** @type {JsonData | undefined} */ const metadata = snapshot.ownedCards[0].card.meta.origin;
      /** @type {JsonData | undefined} */ const mechanics = snapshot.ownedCards[0].card.mechanics.target;
      snapshot.map.rules.playerMaxHp = 40;
    `);
    expect(valid).toEqual([]);
    expect(checkInMemory('const = ;').length).toBeGreaterThan(0);

    const invalidExamples = [
      { source: `import { GameStore } from '../game/src/hub/game.store.js';
        const snapshot = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } }).getSnapshot();
        snapshot.ownedCards[0].card.rules.triggers.onPlay[0].amount = 9;`, code: 2540 },
      { source: `import { GameStore } from '../game/src/hub/game.store.js';
        const snapshot = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } }).getSnapshot();
        snapshot.ownedCards[0].card.cost = 'free';`, code: 2540 },
      { source: `import { GameStore } from '../game/src/hub/game.store.js';
        const store = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } });
        store.state.ownedCards.push({ uid: 'u1', card: { cost: 'free' } });`, code: 2322 },
      { source: `import { GameStore } from '../game/src/hub/game.store.js';
        const snapshot = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } }).getSnapshot();
        snapshot.ownedCards[0].card.meta.origin = 'changed';`, code: 2542 },
      { source: `import { GameStore } from '../game/src/hub/game.store.js';
        const snapshot = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } }).getSnapshot();
        snapshot.shopStock.push({ price: 2 });`, code: 2339 },
      { source: `import { GameStore } from '../game/src/hub/game.store.js';
        const snapshot = new GameStore({ rules: { playerMaxHp: 30, playerAtk: 4 } }).getSnapshot();
        snapshot.inventory[0].count = 99;`, code: 2540 },
    ];
    for (const example of invalidExamples) {
      const diagnostics = checkInMemory(example.source);
      expect(diagnostics.some(diagnostic => diagnostic.code === example.code), JSON.stringify(diagnostics)).toBe(true);
    }
  });
});
