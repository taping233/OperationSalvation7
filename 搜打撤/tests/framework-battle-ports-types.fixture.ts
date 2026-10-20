// Exercise the real factory's command/receipt surface; this does not strict-check its legacy body.
import { createBattleCardPlay } from '../game/src/battle/core/battle.card-play.js';
import { createBattleEngine } from '../game/src/battle/core/battle.engine.factory.js';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
import type { CardPlaySubmission, CardPlayAvailability, CardPlayFinal, CardPlayReceipt } from '../game/src/battle/battle.play-submission.types';

declare const commands: Pick<ReturnType<typeof createBattleCardPlay>, 'submitCardPlay' | 'getCardPlayAvailability'>;
const submission:CardPlaySubmission = commands.submitCardPlay('owned-1', 0, false);
const availability:CardPlayAvailability = commands.getCardPlayAvailability(3, 'self');
void availability;
if (submission.status === 'queued') {
  const receipt:CardPlayReceipt = submission.receipt;
  const final:Promise<CardPlayFinal> = submission.settled;
  void [receipt, final];
} else if (submission.status === 'needs-input') {
  const kind:'target' | 'infusion' | 'payment' = submission.kind;
  void kind;
} else { const code:string = submission.reason.code; void code; }
// @ts-expect-error Card identities are stable string/number UIDs, never booleans.
commands.submitCardPlay(true);
// @ts-expect-error Force-direct selection is boolean.
commands.submitCardPlay('owned-1', 0, 'true');
// @ts-expect-error Targets use the existing side/index contract.
commands.getCardPlayAvailability('owned-1', { enemy:0 });
// @ts-expect-error Receipts require an action sequence.
const missingSequence:CardPlayReceipt = { uid:'owned-1', battleToken:1 };
// @ts-expect-error Queued submission receipts also carry the completion promise.
const missingCompletion:CardPlaySubmission = { status:'queued', uid:'owned-1', battleToken:1, receipt:{ uid:'owned-1', battleToken:1, actionSeq:1 } };
// @ts-expect-error Cancellation requires a rejection reason.
const missingReason:CardPlayFinal = { status:'cancelled', uid:'owned-1', battleToken:1, receipt:{ uid:'owned-1', battleToken:1, actionSeq:1 } };
// @ts-expect-error A submission may still need input and has no unconditional receipt.
const prematureReceipt = submission.receipt;
void [missingSequence, missingCompletion, missingReason, prematureReceipt];

const runtime = createBattleRuntime();
const instance = createBattleEngineInstance({ cards: {}, readRules: () => ({}), runtime });
instance.runtime.set$energy(2);
// @ts-expect-error Runtime energy updates remain numeric.
instance.runtime.set$energy('2');
// @ts-expect-error An instance requires its explicit rule reader.
createBattleEngineInstance({ cards: {}, runtime });
// @ts-expect-error Browser compatibility services remain required at the old factory boundary.
createBattleEngine({ cards: {}, readRules: () => ({}) });
// @ts-expect-error A partial object cannot act as the battle's mutable runtime.
createBattleEngineInstance({ cards: {}, readRules: () => ({}), runtime: { energy: 2 } });
