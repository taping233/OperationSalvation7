# Achievement list/detail selection after filtering

## Evidence and existing directory behavior

In the parent's v17 private-browser check, searching for 能工巧匠 left that single result (16/30) beside the previously selected 初出茅庐 detail (0/1). This patch's author did not perform that browser check.

The shared `bindArchive` filter only updated row visibility; the V3 detail was updated only by medal click or target focus. The collection-card directory in the same room (`hub.collection-v4.js`) already retains a visible selection, otherwise chooses the first result or an empty detail. Card backs and the other record directories have no equivalent search filter. There is no documented reason to keep an excluded achievement's actionable detail visible.

## Coordination

After the shared filter has updated rows and toolbar state, it emits a local bubbling `archive-filter-change` notification from the toolbar. The current archive root handles it; no document/global listener or observer is added. Initial binding also reconciles retained filters because the shared binder runs before the V3 binder.

The achievement view preserves the selected row and existing detail DOM if that row remains visible. Otherwise it selects the first visible row and updates the detail and `aria-pressed` states together. With zero results it clears selection and shows an explicit empty detail, with no stale reward action. Hidden/stale selection actions are ignored. This does not steal focus from the search input, change the query/status matching rule, save data, or award anything. Directory visits without an achievement detail do not reset the remembered medal.

## Tests and acceptance

`npx vitest run tests/hub-archive-v3.test.js tests/archive-progress-rendering.test.js tests/hub-collection-v4.test.js`

3 files / 22 tests pass. New cases cover search excluding selection, retained visible choice and DOM identity, search focus, no-results/empty detail/reset, status changes and empty status, retained filters on rebuild, directory return and stale hidden actions. Existing target-location and reward/state tests remain. The search-exclusion regression fails on the unchanged baseline and passes with this patch. Focused ESLint and syntax checks pass.

Same-browser acceptance after release: open achievement targets, search 能工巧匠 and confirm the displayed progress/detail matches the only result immediately; clear the query and retain that selection; search a nonexistent name and see no stale reward/detail; reset and switch status filters, then navigate away/back. No browser success or performance improvement is claimed by these unit results.
