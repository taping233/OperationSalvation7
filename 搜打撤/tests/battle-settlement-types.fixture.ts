import { createBattleSettlementCommands } from '../game/src/hub/battle-settlement.commands.js';
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
});
const receiptLookup = commands.readReceipt({ slotId: 1, node });
declare const attempt: BattleSettlementAttempt;
const commitResult: Promise<Awaited<ReturnType<typeof commands.commitAttempt>>> = commands.commitAttempt(attempt);
void result;
void receiptLookup;
void commitResult;
