// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { API } from 'typescript/unstable/sync';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const snapshotPath = path.join(projectRoot, 'game/src/battle/battle.snapshot.js');
const previewPath = path.join(projectRoot, 'game/src/battle/battle.preview.js');

function checkInMemory(source) {
  const virtualPath = path.join(projectRoot, 'tests/__battle-snapshot-contract-memory__.ts');
  const configPath = path.join(projectRoot, 'tests/__battle-snapshot-contract-memory__.json');
  const files = new Map([
    [path.resolve(virtualPath), source],
    [path.resolve(configPath), JSON.stringify({
      compilerOptions: {
        target: 'ESNext', module: 'ESNext', moduleResolution: 'Bundler', lib: ['ESNext', 'DOM'],
        allowJs: true, checkJs: false, strict: true, skipLibCheck: true, noEmit: true,
      },
      files: [snapshotPath, previewPath, virtualPath],
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
    if (!project) throw new Error('TypeScript did not load the in-memory battle snapshot contract project');
    const program = project.program;
    return [
      // TypeScript 7's unstable Program API folds compiler-option diagnostics into getProgramDiagnostics().
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
  import { createBattleSnapshot } from '../game/src/battle/battle.snapshot.js';
  import { previewAction } from '../game/src/battle/battle.preview.js';
  import type { BattleSnapshotInput } from '../game/src/battle/battle.snapshot.types.js';
  import type { PreviewActionInput } from '../game/src/battle/battle.snapshot.types.js';
  import type { SnapshotBattleCard } from '../game/src/battle/battle.snapshot.types.js';
  const card = { id: 'starter-attack', name: '初始攻击', type: '武术', cost: 1, dmg: 0,
    dmgType: 'attack', desc: '攻(+0):造成等同于攻击力的伤害',
    rules: { triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', extra: { tags: ['fixture'] } }] } } };
  const input: BattleSnapshotInput = {
    battleToken: 11, mode: 'normal', turn: 1, energy: 3, maxEnergy: 3, busy: false,
    phase: 'player', actionQueueLength: 0, opts: {}, player: { hp: 20, maxHp: 20, atk: 4, spellPower: 0 },
    pdef: null, pstat: { status: {} }, foes: [{ hp: 8, dead: false, status: {}, defense: { shield: 0, armor: 0 } }],
    deathFxPending: [false], allies: [], hand: ['u1'], drawPile: [], discard: [], grave: [],
    infusing: { uid: 'u1', card, picked: new Set() }, discovering: { options: [card] }, handSelecting: null,
    choosing: null, pendingTarget: { uid: 'u1', card }, pendingHint: null, viewingGrave: false,
    viewingDeck: false, viewingBag: false, dreadShown: false, selectingDeck: false, deckNeed: 0,
    selDeckMax: 0, selShaN: 0, sel: new Set(), selPool: [{ uid: 'u1', card }], potionBar: null,
    pendingItem: null, slamPending: false, dartPending: false,
    equipped: [{ uid: 'e1', card, name: '装备', desc: '', skill: '', used: false }],
  };
  const snapshot = createBattleSnapshot(input);
  const action: PreviewActionInput['action'] = { kind: 'play-card', uid: 'u1', targetIndex: 0 };
  const context = { card, targetIndexes: [0], legal: true, effectiveCost: 1, damageGrowth: 0 };
  const result = previewAction({ snapshot, action, cardContext: context });
  const compatibleInput = createBattleSnapshot({ ...input,
    infusing: { uid: 'legacy-infuse', picked: new Set() },
    pendingTarget: { uid: 'legacy-target' },
    selPool: [{ uid: 'legacy-deck' }],
    pendingItem: { uid: 'legacy-item' },
    equipped: [{ uid: 'legacy-equipped', name: '', desc: '', skill: '', used: false }],
  });
  const optionalInfusingCard: SnapshotBattleCard | null | undefined = compatibleInput.infusing?.card;
  const optionalTargetCard: SnapshotBattleCard | null | undefined = compatibleInput.pendingTarget?.card;
  const optionalDeckCard: SnapshotBattleCard | null | undefined = compatibleInput.deckSelection?.cards[0].card;
  const optionalItemCard: SnapshotBattleCard | null | undefined = compatibleInput.pendingItem?.card;
  const optionalEquippedCard: SnapshotBattleCard | null | undefined = compatibleInput.equipped[0].card;
  void optionalInfusingCard;
  void optionalTargetCard;
  void optionalDeckCard;
  void optionalItemCard;
  void optionalEquippedCard;
  const operationName: string | undefined = snapshot.pendingTarget?.card?.rules?.triggers?.onPlay?.[0].op;
  type IsAny<T> = 0 extends (1 & T) ? true : false;
  function requireTyped<T>(value: T & (IsAny<T> extends true ? never : unknown)): void { void value; }
  requireTyped(snapshot);
  requireTyped(snapshot.pendingTarget?.card?.rules);
  requireTyped(operationName);
  requireTyped(snapshot.pendingTarget?.card?.rules?.triggers?.onPlay?.[0].extra);
  requireTyped(result.cost);
  requireTyped(result.damage?.total);
  requireTyped(result.damage?.hits);
  // Non-card state is shallowly described: consumers must narrow unknown extensions first.
  const nonCardStatusExtension: unknown = snapshot.foes[0].status?.customState;
  void nonCardStatusExtension;
`;

describe('battle snapshot TypeScript contract', () => {
  it('type-checks real production imports and keeps their results typed', () => {
    expect(checkInMemory(validSource)).toEqual([]);
    expect(checkInMemory('const = ;').length).toBeGreaterThan(0);
  });

  it('rejects invalid builder input, nested snapshot card writes, and malformed preview snapshots', () => {
    const invalidExamples = [
      { source: `${validSource}\n createBattleSnapshot({ ...input, player: { hp: 20, maxHp: 20, atk: 'four', spellPower: 0 } });`, code: 2322 },
      { source: `${validSource}\n createBattleSnapshot({ ...input, foes: [{ hp: 8, dead: false, status: { dodge: 'many' }, defense: { shield: 0 } }] });`, code: 2322 },
      { source: `${validSource}\n const readonlyCard = snapshot.pendingTarget?.card;\n if (readonlyCard?.rules?.triggers?.onPlay) readonlyCard.rules.triggers.onPlay[0].op = 'mutation';`, code: 2540 },
      { source: `${validSource}\n const readonlyCard = snapshot.pendingTarget?.card;\n if (readonlyCard?.rules?.triggers?.onPlay) readonlyCard.rules.triggers.onPlay.push({ op: 'damage' });`, code: 2339 },
      { source: `import { previewAction } from '../game/src/battle/battle.preview.js';
        previewAction({ snapshot: { foes: [{ hp: 'bad', dead: false, status: null, defense: null, intent: null }], player: null, pstat: null },
          action: { kind: 'play-card', uid: 'u', targetIndex: 0 }, cardContext: { card: null, targetIndexes: [] } });`, code: 2322 },
    ];
    for (const [index, example] of invalidExamples.entries()) {
      const diagnostics = checkInMemory(example.source);
      expect(diagnostics.some(diagnostic => diagnostic.code === example.code), `negative example ${index}: ${JSON.stringify(diagnostics)}`).toBe(true);
    }
  });
});
