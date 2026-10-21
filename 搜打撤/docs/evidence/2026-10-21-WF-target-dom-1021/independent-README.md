# Battle target DOM write guards

The frozen patch removes redundant targetability writes, without caching target eligibility or changing commands, previews, cancellation, labels, or target selection.

## Result

The real battle engine/view, with three enabled enemy targets, executed 20 unchanged `render()` calls in jsdom:

| Observed operation on the enabled foe nodes | Baseline | Candidate |
| --- | ---: | ---: |
| `role` / `tabindex` / `aria-label` writes | 180 | 0 |
| MutationObserver attribute records | 180 | 0 |
| `classList.toggle('can-target', ...)` calls | 60 | 0 |

The class toggle count is an API-call reduction; do not add it to attribute mutations. These are specifically target-node operations, not all battle DOM work, heap bytes, CPU duration, or FPS. Non-target neutral-label clear/reapply in `battle.layers.js` is unchanged.

- Final nearby regression run: **17 files / 352 tests passed; zero failures/skips** (`final-tests.json`, exact list `target-tests.txt`).
- New suite: **6/6 passed**. It exercises real render retention; foe and self-character renames; dead/re-enabled enemies; live-attribute repair; removal of only the previous target fields; explicit tabindex and null/undefined label coercion; cancel/reselect; and keyboard submission with the authoritative battle engine.
- Final old-source negative control: **4 expected optimization failures, 2 passing functional tests**. The identical suite and dependencies run against the original `battle.aim.js`; candidate restored in `finally`. See `ab-final/summary.json` and raw logs/reports.
- Focused ESLint and Node syntax checks passed.
- Full **542-module** graph with the candidate aim source substituted: acyclic, no architecture violations, no dead guard keys (`overlay-architecture.json`).
- `git apply --check` against the shared integration tree passed. Main aim source and Git index were unchanged; the test was not added to the main source (`final-preservation.json`).

## Scope and source

Source: `/workspace/scratch/b7a53a06c872/performance-e817a3aa-integration`, checkout HEAD `306376b7a80021a1820ad8d3d1047cae74d9020c`, frozen staged tree `d30bc098f7d785a4b78dcca27f2e13270d03e290` published by the parent as `b5a59762`.

The patch changes only:

- `搜打撤/game/src/battle/view/battle.aim.js`
- `搜打撤/tests/battle-target-dom.test.js`

`setTargetable` compares current attributes and target class before performing the same writes/removals. This uses the existing inline guard idiom; there is no reusable exported generic DOM setter in the inspected UI/core modules, and no new helper/cache/import was introduced. Reading live attributes preserves repair after outside mutation and fresh labels after character/name changes.

The small overlay uses read-only source/dependency links. No full checkout, dependency copy, build, main-source/index edit, push, or deployment was performed.

## Reproduce

From this directory (do not run a concurrent test on the same overlay):

```sh
node replay-target-dom.mjs replayed
cd 搜打撤
node node_modules/vitest/vitest.mjs run $(cat ../target-tests.txt) --reporter=json --outputFile=../replayed-nearby.json
node node_modules/eslint/bin/eslint.js game/src/battle/view/battle.aim.js tests/battle-target-dom.test.js
node --check game/src/battle/view/battle.aim.js
node --check tests/battle-target-dom.test.js
node ../check-overlay-architecture.mjs
```

`replay-target-dom.mjs` temporarily swaps only the overlay's aim file between frozen baseline/candidate, runs the same six tests twice, preserves reports/operation counts, and restores the candidate even if execution fails. It never writes the linked base or index. `patch-manifest.json` binds the exact original/candidate source, new test, and patch hashes.

## Verification boundary

- Browser QA was explicitly outside this task. Current-window built-in browser behavior, production build, and remote CI are **not claimed**. This is a behavior-preserving internal DOM optimization verified with jsdom inputs, not actual pointer/browser evidence.
- The repository's `contracts.test.js` graph assertion initially failed because its directory enumerator deliberately does not follow the lightweight overlay's symlinks, so it saw `battle.aim.js` but not linked `ui/ui-scale.js`. The other initial cases passed (345/346 total). That raw run remains `target-tests.json`. The explicit full-source graph above verifies the same source closure with the candidate substituted; the final 17-file runtime run does not imply the ordinary aggregate gate passed. Run the normal aggregate sentinel/gate after applying in the integration checkout.
- No new strict-type coverage is claimed: the changed legacy aim module is not a configured strict-UI entry. No aggregate full suite or build was run.
