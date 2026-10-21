// Real core assembly bodies are opt-in strict-checked; legacy factories stay outside that scope.
import { createBattleCardPlay } from '../game/src/battle/core/battle.card-play.js';
import { createBattleEngine } from '../game/src/battle/core/battle.engine.factory.js';
import { createBattleEngineInstance } from '../game/src/battle/core/battle.engine.instance.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
import type { CardPlaySubmission, CardPlayAvailability, CardPlayFinal, CardPlayReceipt } from '../game/src/battle/battle.play-submission.types';
import { createBattleEffectAssembly } from '../game/src/battle/core/battle.effect-assembly.domain.js';
import { createSnapshotProjection } from '../game/src/battle/core/battle.snapshot-projection.domain.js';
import type { EffectAssemblyOptions, SnapshotProjectionOptions, ResolutionPorts, CombatPort,
  RandomPort, BattleCardLibrary, CoreCard } from '../game/src/battle/core/battle.core-ports.types.js';
import type { BattleSnapshot } from '../game/src/battle/battle.snapshot.types.js';

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

declare const effectOptions: EffectAssemblyOptions;
declare const snapshotOptions: SnapshotProjectionOptions;
declare const resolutionPorts: ResolutionPorts;
declare const coreCard: CoreCard;
const assembly = createBattleEffectAssembly(effectOptions);
assembly.applyTextEffects(coreCard, '抽1张牌', null, { triggered: true });
assembly.createResolution().steps(coreCard, null, false, 0, 'owned-1');
const projected: BattleSnapshot = createSnapshotProjection(snapshotOptions).getSnapshot();
const signature: string = createSnapshotProjection(snapshotOptions).snapshotSignature();
const numberOfCards: number = resolutionPorts.drawCards(1);
const damage: number = effectOptions.combat.dealDamage({ atk: 2 }, effectOptions.runtime.pstat, 2, 'attack').dealt;
const combat: CombatPort = effectOptions.combat;
const random: RandomPort = { random: () => 0.5 };
const catalog: BattleCardLibrary = effectOptions.cards;
effectOptions.executionSession.handSelectQueue.push({ n: 1, act: 'zero' });
effectOptions.executionSession.choiceQueue.push({ cardName: '抉择', options: ['选项一', '选项二'] });
const queueResult: false | void = effectOptions.commands.queueCardExecution('owned-1', coreCard, [], null, true);
type IsAny<T> = 0 extends (1 & T) ? true : false;
const resolverIsAny: IsAny<ReturnType<typeof assembly.createResolution>> = false;
const projectionIsAny: IsAny<ReturnType<typeof createSnapshotProjection>['getSnapshot']> = false;
void [projected, signature, numberOfCards, damage, combat, random, catalog];
void [queueResult, resolverIsAny, projectionIsAny];

// @ts-expect-error Effect assembly requires its complete command bag.
createBattleEffectAssembly({ ...effectOptions, commands: { alive: () => [] } });
// @ts-expect-error A snapshot projection must receive its rule reader.
createSnapshotProjection({ runtime: snapshotOptions.runtime, executionSession: snapshotOptions.executionSession });
// @ts-expect-error Numeric runtime commands reject string energy.
effectOptions.runtime.set$energy('2');
// @ts-expect-error Draw commands return a numeric count.
createBattleEffectAssembly({ ...effectOptions, commands: { ...effectOptions.commands, drawCards: () => 'two' } });
// @ts-expect-error The resolution factory must return a callable resolver with generator support.
createBattleEffectAssembly({ ...effectOptions, createBattleResolution: () => ({ resolve: true }) });
// @ts-expect-error Combat damage receipts must expose numeric dealt damage.
createBattleEffectAssembly({ ...effectOptions, combat: { ...combat, dealDamage: () => ({ dealt: '2', log: [] }) } });
// @ts-expect-error Snapshot item usability exposes a boolean availability.
createSnapshotProjection({ ...snapshotOptions, itemUsability: () => ({ usable: 'yes', why: '' }) });
// @ts-expect-error Text effects require a text clause.
assembly.applyTextEffects(coreCard, 3);
// @ts-expect-error Resolvers receive a combat target rather than a target index.
assembly.createResolution()(coreCard, 0);
// @ts-expect-error Snapshot projections are immutable at their public boundary.
projected.energy = 99;
// @ts-expect-error Resolution energy resource commands return numeric receipts.
const wrongReceipt: string = resolutionPorts.addEnergy(1);
// @ts-expect-error Pending recast feedback needs a structured event.
effectOptions.commands.emitRecast(coreCard);
// @ts-expect-error Public context random services must return numbers.
createBattleEngineInstance({ cards: {}, readRules: () => ({}), random: { random: () => '0.5' } });
// @ts-expect-error Public context combat services must be complete.
createBattleEngineInstance({ cards: {}, readRules: () => ({}), combat: { addCurse: () => 1 } });
// @ts-expect-error Presentation waits are asynchronous ports.
createBattleEngineInstance({ cards: {}, readRules: () => ({}), presentation: { waitForFeedback: () => 1 } });
void wrongReceipt;
