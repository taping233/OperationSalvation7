# Battle end-turn selection lifecycle

## Result

BL-02 is fixed at the installed BattleSession boundary. A swift-rune end turn now waits for the auto-played card's entire action/decision chain before starting one enemy phase. The state machine still forbids ENEMY → RESOLVING.

Source: verified upstream snapshot `db831272780b8d0c792e93b9661404b5ee68e5ab`. Local baseline `d6551cc` is an import of acquired files, not upstream history. Changed-file hashes and baseline blob identities are in `battle-inputs.json`.

## Production changes

- `battle.execution-session.js`: owns one generation-scoped, one-shot pending end-turn continuation. Queue execution, staged resolution and the readiness predicate must all be settled. Reset/abort invalidates the pending continuation before clearing actions.
- `battle.action-runner.js`: invokes the injected idle settlement callback after queue idle and generation/token checks, before ordinary RESOLVING → PLAYER cleanup.
- `battle.engine.js`: defines readiness across hand selection, choice, discovery, target interaction and all queued decision jobs; wires idle settlement; resumes on target cancellation. While a turn-end continuation is pending, independent card/infusion, equipment, item and bag-skill commands cannot replace its dependent target interaction.
- `battle.enemy-phase.js`: defers swift-rune continuation until readiness, sets enemy busy ownership explicitly and rejects repeat end-turn commands while waiting. A synchronous preflight rejection without a payment modal falls through to normal end-turn processing.
- `battle.selection-flow.js`: resumes settlement after non-action decisions, drains skipped empty discovery jobs, rejects non-live/wrong-type effect-selection UIDs and invalid/terminal choice callbacks, and clears a completed consume selection before firing triggers that may open another selection.

## Why continuation ownership is safe

The pending slot is cleared before the continuation is invoked, so reentrant settlement or repeated clicks cannot invoke it twice. A reset changes the execution generation and clears the slot; battle-token/active/phase checks provide a second boundary. Modal completion alone is insufficient: the action queue must be idle and staged resolution depth zero, so a selected child waiting for feedback still prevents enemies from starting.

When settlement does start the enemy phase, it sets busy=true. The action runner only performs normal player cleanup if the phase is still RESOLVING, so an older action's finally cannot unlock the enemy phase. Pending targets can still be resolved or explicitly canceled; unrelated player actions cannot take over that slot.

## Regression coverage

Three new test files add 27 regression cases:

- `battle-end-turn-selection.test.js` (14): public BattleSession, real current 剑荡妖邪 / 初始攻击; nested current cards; feedback-held child actions; duplicate end-turn/pick commands; skip; child victory; flee; replacement at a modal and during an active child; real 血毒双镖 target resolution/cancellation and independent-action isolation; real 神灯 choice → fixed discovery → hand-selection chain; explicitly constructed single-discovery direct-play scenario
- `battle-execution-continuation.test.js` (5): one-shot/reentrant ownership, child queue and staged-depth blockers, reset/abort generation invalidation, and busy/phase transfer before runner cleanup
- `battle-selection-consumer.test.js` (8): generic two-card consumption rejects duplicate/stale/wrong-type UIDs; on-consume nested modal preservation; valid free-play deduplication; non-action zero/discovery settlement; refused child preflight; empty discovery queues; invalid/terminal callbacks

BL-01 is treated as a latent generic-consumer invariant. Its regression constructs a generic selection job; it does not use the retired 魔法锅炉 producer or claim ordinary catalog reachability.

## Focused verification

Final focused Vitest run: 11 files, 161 tests passed. It includes the three new files, full-review-regressions-battle, battle-selection-flow-boundary, battle-lifecycle, battle-architecture, battle-restart, battle-resolution, architecture-boundaries and contracts. Node 22.23.3 with locked installed dependencies; `--maxWorkers=2`. Full command/output: `battle-focused.log`.

Scoped ESLint over the five source and three new test files passed; output: `battle-lint.log`. Scoped `git diff --check` passed.

Isolated pre-fix differential: copied source/test inputs to a temporary workspace, restored only the five original battle files from the imported baseline, and ran the public BattleSession regression file. All 14 tests fail because the old implementation advances the turn while the dependent decision is still open. The shared source was never reverted. Output: `battle-baseline-integration.log`.

The first sentinel attempt failed because acquired desktop-app/main.js was absent. After the parent restored that pinned source input, the final contracts run passes. The acquisition failure is not counted as a production battle defect.

## Remaining acceptance

No full suite, production build or browser was run by this worker. Parent integration owns those gates and player-visible browser acceptance. These tests use controlled BattleSession fixtures, a runtime swift-rune flag, fake timers and explicitly fixed discovery candidates; they establish ordering and cancellation, not a complete real-input rune-acquisition/playthrough.

Browser target: arrange current 剑荡妖邪 as the leftmost eligible hand card with 极速 and a second martial card. End turn; confirm the enemy/round does not advance while the visible hand selector waits. Choose the martial card through the visible UI, then confirm its free effect resolves before exactly one enemy phase and the next playable round. Also exercise a dependent target or nested selector when practical.

## Integration follow-up

The parent full integration gate exposed two test-baseline mismatches. Only these two test files changed in this follow-up:

- `battle-engine-facade.test.js` now explicitly lists the intended `deferEndTurn` and `hasPendingEndTurn` exports consumed by `battle.enemy-phase.js`. The exact export-set guard is retained and the fixed expected count is 68.
- `battle-end-turn-selection.test.js` now expects HP47 and armor0 for the 神灯 discovery choice. The independent card fix removed unconditional armor from that choice; the helper still requires exactly one enemy attack and exactly one enemy-phase transition. Other branches are unchanged.

Latest focused feedback: 5 test files / 41 tests passed, covering facade, end-turn selection, execution continuation, selection consumer and all card choice-armor guard cases. Scoped ESLint and whitespace checks passed. No production source, full-suite, build or browser changes/actions were made in this follow-up. Logs: `battle-integration-followup.log`, `battle-integration-followup-lint.log`; current scoped input hashes: `battle-integration-followup-inputs.json`. The earlier 161-test run and its input manifest remain historical pre-card-integration evidence.
