import { createBattleSettlementCommands } from '../game/src/hub/battle-settlement.commands.js';
import { applyXpGain, addXpToProgress, LEVEL_MAX, xpForNext } from '../game/src/hub/meta-progression.js';
import { prepareBattleVictoryProgress } from '../game/src/hub/battle-victory-progress.js';
import { createNestSettlementCommands } from '../game/src/hub/nest-settlement.commands.js';
import type {
  BattleSettlementAttempt,
  BattleSettlementNode,
  BattleSettlementRunSnapshot,
} from '../game/src/hub/battle-settlement.commands.types.js';

const node: BattleSettlementNode = { layerIdx: 2, trackPos: 4, isBoss: false, encounterId: 'group-4' };
const afterRun: BattleSettlementRunSnapshot = {
  layerIdx: 2,
  trackPos: 4,
  visited: { '2,4': 1 },
  elapsed: 45,
  savedAt: 1_790_000_000_000,
};
const commands = createBattleSettlementCommands({
  getBase: () => ({
    slot: 1,
    _readForCommit: () => ({ eggBattles: 8, stats: { playSeconds: 20 }, _m01: { revision: 3, requests: {} } }),
    issue: () => null,
  }),
  getRunStorage: () => ({
    readIdentity: () => ({ ok: true, value: { runId: 'run-123', revision: 5 } }),
    read: () => afterRun,
  }),
  getRecovery: () => ({
    recoverSlot: async () => ({ ok: true, value: null }),
    readSettlementReceipt: async () => ({ ok: true, value: null, revision: 3 }),
    commitBaseAndRun: async () => ({ ok: true, value: {
      requestId: 'battle-win:run-123:2,4', command: 'battle.win', baseRevision: 4,
      runRevision: 6, runId: 'run-123', output: { eggBattles: 9 },
    }, revision: 4 }),
  }),
  getActiveSlot: () => 1,
});

const result: Promise<Awaited<ReturnType<typeof commands.createAttempt>>> = commands.createAttempt({
  slotId: 1, node, afterRun, elapsedDelta: 2.5,
  victoryProgress: { foeNames: ['训练靶'], isBoss: false, classId: '武术', xpMultiplier: 1 },
});
const receiptLookup = commands.readReceipt({ slotId: 1, node });
declare const attempt: BattleSettlementAttempt;
const commitResult: Promise<Awaited<ReturnType<typeof commands.commitAttempt>>> = commands.commitAttempt(attempt);
void result;
void receiptLookup;
void commitResult;

const settlementOutput: BattleSettlementAttempt['output'] = {
  eggBattles: 9,
  progression: { levelUps: [{ classId: '武术', levels: [2] }] },
};
const levelList: readonly number[] = settlementOutput.progression?.levelUps[0]?.levels ?? [];
void levelList;
// @ts-expect-error Victory progress must contain typed foe names and a numeric multiplier.
commands.createAttempt({ slotId: 1, node, afterRun, elapsedDelta: 0, victoryProgress: { foeNames: [42], isBoss: false, classId: '武术', xpMultiplier: 1 } });
// @ts-expect-error Settlement progression levels must be numeric.
const invalidSettlementOutput: BattleSettlementAttempt['output'] = { eggBattles: 1, progression: { levelUps: [{ classId: '武术', levels: ['2'] }] } };
void invalidSettlementOutput;

const xp = applyXpGain({ lv: 1, xp: 0 }, 55);
const progressionLevel: number = xp.after.lv;
const compatibilityXp = addXpToProgress(null, 20);
const nextLevelXp: number = xpForNext(compatibilityXp.after.lv);
const maximumLevel: 10 = LEVEL_MAX;
void progressionLevel;
void nextLevelXp;
void maximumLevel;
// @ts-expect-error Progress level and experience must be numbers.
applyXpGain({ lv: '1', xp: 0 }, 10);
// @ts-expect-error XP gain must be numeric.
addXpToProgress(undefined, '10');

const victory = prepareBattleVictoryProgress(
  { stats: { kills: 0, bossKills: [] }, classes: {} },
  { foeNames: ['训练靶'], isBoss: false, classId: '武术', xpMultiplier: 1 },
);
const killCount: number = victory.afterBase.stats?.kills ?? 0;
const gained: readonly number[] = victory.levelUps[0]?.levels ?? [];
void killCount;
void gained;
// @ts-expect-error Foe names are strings.
prepareBattleVictoryProgress({}, { foeNames: [42], isBoss: false, classId: '武术', xpMultiplier: 1 });
// @ts-expect-error XP multiplier is numeric.
prepareBattleVictoryProgress({}, { foeNames: [], isBoss: false, classId: '武术', xpMultiplier: '1' });

const nestSettlement = createNestSettlementCommands({
  getActiveSlot: () => 1,
  getBase: () => ({ _readForCommit: () => ({ runes: [], stats: {} }) }),
  getRunStorage: () => ({ readIdentity: () => ({ ok: true as const, value: { runId: 'nest-run', revision: 2 } }) }),
  getRecovery: () => ({
    recoverSlot: async () => ({ ok: true as const, value: null }),
    readSettlementReceipt: async () => ({ ok: true as const, value: null }),
    commitBaseAndRun: async (_context, _prepared) => ({ ok: true as const, value: null }),
  }),
});
const nestResult = nestSettlement.settle({ slotId: 1, runId: 'nest-run', runes: ['rune-a'], score: 10, elapsedDelta: 5 });
const nestPromise: Promise<Awaited<ReturnType<typeof nestSettlement.settle>>> = nestResult;
void nestPromise;
// @ts-expect-error Nest settlement identity uses a numeric slot and string run ID.
nestSettlement.settle({ slotId: '1', runId: 2, runes: [], score: 0, elapsedDelta: 0 });
