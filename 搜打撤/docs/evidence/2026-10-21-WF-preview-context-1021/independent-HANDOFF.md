# Synchronous AOE hover hand projection

**Ready patch: `preview-hand-context.patch`.** It applies over the current target-DOM-guarded aim source. Four production files, two new suites, and one existing drag mock contract update; no generic cache/helper, no final-availability cache, no main/index edit, no build or push.

## Exact result

Actual `BattleSession.restore` + production `render` + `startAim` followed by dispatched pointermove/frame -> AOE empty-ground loop -> production hover/core/command domains. Not the earlier audit's four-call loop. The count boundary starts after pickup and ends after the hover transition.

| Raw hand / four live foes | Hand projections before → after | `findCardInState` calls before → after | Owned UID reads before → after |
|---|---:|---:|---:|
| 9 | 8 → 1 | 88 → 25 | 380 → 65 |
| 30 | 8 → 1 | 256 → 46 | 3,740 → 485 |
| 60 | 8 → 1 | 496 → 76 | 14,660 → 1,850 |

Every fixture retains **8 cost queries and 8 capability checks**. All four preview strings match byte-for-byte. Current catalog `tt3-flame-storm` independently confirms the 9-card result, four damage/cost-two/play prompts unchanged. The 30/60 sizes are scale fixtures, not typical-player claims. No timing/FPS assertion.

`ab-delivery/summary.json` binds final runs:
- Original four sources: 4 expected optimization failures, 4 functional passes.
- Deliberately retained aim-level hand context: 3 expected re-entry freshness failures, 5 passes.
- Candidate restored: 8/8 pass.

The initial stale-cache mutation still preserved wording because downstream execution availability also checks live hand requirements. The tests were strengthened to assert actual new projection work on unchanged re-entry and renderer refresh, then the final mutation failed as intended. Earlier diagnostic runs are retained, not claimed as final evidence.

## Implementation and safety

The AOE loop creates `{}` next to its existing snapshot, passes it through hover to both core preview eligibility and command availability, and discards it at loop end. Existing raw `findCard` projection/legacy repair is reused. All effective-card, cost, capability, infusion, target and execution checks stay per target. `performCardPlay` and submission receive no context. Standalone callers stay fresh. Optional context UID documentation permits strings and numbers.

New coverage: actual pointer entry/re-entry/idle frame, renderer-preserved aim, cancellation/reselection, fresh battle token, hand removal/replacement, raw overrides, in-place rules, energy/dead target, spell-power/shield/immune/dodge, standalone preview, final pointer rejection; domain tests cover raw self duplicates/missing UIDs, override→owned→granted priority, transformations, both legacy TT7 repairs on unselected cards, infusion/fuel/waivers/free-cast and fresh final submission.

## Checks

- **29 files / 555 tests pass**, no failures/skips: `final-tests.json`, exact list `target-tests.txt`.
- **2 sentinel files / 57 tests pass**: `sentinel-tests.json`.
- Complete **542-module** graph: acyclic, no architecture violations/dead guard keys (`overlay-architecture.json`).
- Focused ESLint + Node syntax on all seven patch files pass.
- Independent four-source review: no behavioral blocker.
- `git apply --check` passed. All four main source hashes match initial copies; new tests absent from main at delivery (`patch-manifest.json`).

The lightweight overlay links unchanged inputs. Ordinary architecture enumeration ignores linked files, so its first run produced three missing-source/dead-key failures (plus one now-updated drag argument expectation). Sentinel tests use `sentinels.vitest.config.mjs`, an in-memory filesystem reader adapter following file links; assertions are unchanged. A separate normal reader of the full main source plus exact four candidate substitutions independently verifies the graph. Run normal integration sentinels/aggregate gates after applying; the overlay is not an aggregate-gate receipt.

Current-window browser QA, build, remote CI, and expanded strict typing were not run/claimed. The changed legacy modules are not newly added to strict-type coverage. Dependencies remain read-only and caches stay in this scratch directory.

## Reproduce

From this directory, without concurrent source swaps:

```
node replay-preview-context.mjs replayed
node check-overlay-architecture.mjs
cd 搜打撤
node node_modules/vitest/vitest.mjs run $(cat ../target-tests.txt)
node node_modules/vitest/vitest.mjs run --config ../sentinels.vitest.config.mjs
node node_modules/eslint/bin/eslint.js game/src/battle/view/battle.aim.js game/src/battle/view/battle.hover.js game/src/battle/core/battle.core.js game/src/battle/core/battle.card-play.domain.js tests/battle-area-hover-hand-context.test.js tests/battle-preview-hand-context.test.js tests/battle-drag-reference.test.js
```

`replay-preview-context.mjs` restores all four candidate source files in `finally`. `patch-manifest.json` records original/candidate/patch SHA-256s. No task processes remain running.
