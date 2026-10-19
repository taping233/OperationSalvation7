# Keep position across reward and container actions

## Changes players encounter
- Pearl box and mage pouch: storing/taking a stack preserves the open help section and body/content/list scroll positions. Existing safe focus policy stays: continue the same transfer direction if available, otherwise return; never focus the inverse transfer automatically.
- Container detail actions are bound to the rendered container identity. A callback retained from the previous render cannot open an outdated card after a transfer. Detail focus identity includes the card name, not just a moving list index.
- Reward capacity organizer: discard confirmation, keep, and successful organization preserve list scroll position while the existing nearest-row focus policy continues.
- Reward selection: abandon/cancel/reselect preserves both horizontal and vertical card-list scroll. No reroll or reward is triggered by cancellation.
- During an overlay closing animation, obsolete reward actions cannot grant cards, save state, or rebuild the picker.

## Evidence
Before correction: four new container regressions failed (before.log), one organizer regression failed (organizer-before.log), two reward regressions failed (chest-before.log). These are actual failed runs, not reconstructed historical evidence. The initial container test proposed inverse-action focus; existing regression contracts demonstrated why that would be unsafe, so the implementation and final test retain the established same-direction/return behavior instead.

Final: seven relevant suites, 143 tests passed (final.log); project syntax, eight type checks and lint passed (static-final.log). Tests cover container real entry points, stale callbacks, capacities, reward suspension, multi-box queues and cancel flows. No gameplay capacity, grant rule, dependency or budget changed.

Commands: `npx vitest run tests/chest-callback-lifecycle-audit.test.js tests/chest-multi-queue-regression.test.js tests/chests-reward-capacity-notice.test.js tests/reward-capacity-organizer.test.js tests/bag-page-lifecycle-review.test.js tests/pearl-storage-interface.test.js tests/safe-pearl-access.test.js`; `npm run check:syntax`; `npm run typecheck`; `npm run lint`.

These are source/jsdom validations in a recovered partial workspace. Native-browser scroll geometry, animation and manual keyboard play remain unverified. Remote full CI follows publication; prior four build budgets remain outstanding. No former missing logs were recreated as historical results.

## Full-CI random assertion follow-through
Preceding commit a37cf1f9b685101c2b16a469dfac3f85268da97f had 6332 passing, two skipped and one failing test: https://github.com/taping233/OperationSalvation7/actions/runs/39209736972 . The old mage-scavenge test assumed every random reward increases the hand, while the existing acquisition chain directs items to the item toolbar. The preceding successful run did not guarantee this random branch. The captured log proves the assertion failure; it does not identify the particular random card.

The test now selects two canonical eligible cards deterministically, verifies each legal destination, exact energy cost and no target-selection mode, and restores the pool spy in finally. No gameplay code is altered for this test. Combined focus/container/reward/scavenge checks: ten suites, 170 tests passed (merged-final.log); merged syntax/types/lint passed (merged-static.log).
