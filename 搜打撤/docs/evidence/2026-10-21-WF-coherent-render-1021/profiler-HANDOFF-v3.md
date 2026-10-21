# Final local CPU / allocation comparison: persistent battle stage v3

## Decision-useful result

The actual production battle render workload is materially smaller. This is an architectural retained-stage improvement, measured with the already-used external **Flameox 0.2.9** rather than adding a duplicate profiler. Local evidence supports integrating the frozen candidate; browser frame-rate and visual validation are separate gates.

Four alternating fresh-process baseline/candidate pairs, identical scenario and harness, give these unprofiled pooled wall timings (60 samples per operation per variant):

| Scenario / operation | Baseline median / p95 ms | v3 median / p95 ms |
|---|---:|---:|
| Typical: HP-change render | 9.018 / 11.044 | 4.901 / 6.596 |
| High: HP-change render | 8.572 / 12.385 | 4.908 / 6.630 |
| Typical: hand-page action | 15.269 / 23.811 | 12.633 / 19.725 |
| High: hand-page action | 16.114 / 25.339 | 14.259 / 20.183 |
| Typical: unchanged render | 5.847 / 8.667 | 4.291 / 6.440 |
| High: unchanged render | 5.180 / 8.577 | 4.049 / 7.172 |

HP-change medians improve 45.7% / 42.7%; hand-page medians improve 17.3% / 11.5%. HP-change is faster in every pair. High hand-page has one pair with a slightly slower candidate median (15.766 to 15.837 ms); do not imply every observation improves.

The fixed mixed profile stream's median total sampled allocation estimates are:

| Scenario | Baseline bytes | v3 bytes | Reduction |
|---|---:|---:|---:|
| Typical: 12 hand cards, 2 foes | 207,577,156 | 106,942,380 | 48.5% |
| High: 28 hand cards, 4 foes | 236,024,264 | 125,871,236 | 46.7% |

These count **sampled allocations including objects already collected**, not retained heap, RSS, GPU memory, or browser frames. One candidate high-load heap file (block 1) has one unresolvable allocation sample, estimated 32,800 bytes; it is included in the total but has no frame attribution. Every requested row is returned; all other main CPU/heap captures have complete reported coverage.

## Absolute attribution, not percentage dilution

Flameox high-load inclusive hotspot medians across four captures:

| Frame | Baseline CPU samples / allocation bytes | v3 CPU samples / allocation bytes |
|---|---:|---:|
| mountUnitLayer | 273 / 48,084,592 | 1 / 196,848 |
| Old showBattleStage → new stage.show | 300 / 40,274,324 | 106.5 / 8,857,652 |
| updateHand | 513.5 / 70,164,360 | 460.5 / 64,628,020 |

CPU values are native **sample counts, not milliseconds**. Inclusive frames overlap; recursive `patchNode` appears repeatedly on stacks and must not be added to `stage.show` or `render`. Zero observed samples would not establish zero work. `hotspot-comparison.json` contains every per-block absolute value.

For the complete main CPU captures, median sample counts are typical 1,755.5 to 1,097; high 1,902 to 1,162. `analysis-summary.json` also preserves all absolute sampled intervals, inspector self intervals and totals. Actual interval and inspector overhead vary, so unprofiled wall/process-CPU timing is the speed evidence, not a fixed conversion of sample counts into milliseconds.

## Countermetric and bounded follow-up

In the short high-load unchanged-render scenario, process-CPU p95 worsens from **9.584 to 14.510 ms**, even though wall median/p95 and CPU median improve. Two of four paired wall p95 values also worsen. Keep this result visible; do not claim universal improvement.

The independently repeated steady unchanged-render check (30 warmups + 150 renders per process, three alternating pairs, 450 samples per variant) gives:

| Measure | Baseline median / p95 ms | v3 median / p95 ms |
|---|---:|---:|
| Wall time | 5.419 / 8.056 | 4.007 / 5.212 |
| Process CPU | 6.131 / 12.042 | 4.804 / 9.564 |

All three steady-state paired wall medians and p95 values improve. Observed GC events are baseline 7/6/6 versus candidate 3/3/3. This does not prove GC explains the earlier short-probe tail; no such causal claim is made. The original countermetric is retained, not replaced by the focused result. No more repeated profiling is needed to establish the bounded local outcome.

## Correctness and identity

- 104 paired main-workload checkpoints: zero compared game-state differences. Normalized DOM has exactly 208 disclosed attribute additions: the hand container's `role="group"` and `aria-label="当前手牌"`, restoring semantics lost by the old mount replacement. Every other compared normalized attribute, text and structural value matches. This is not exact attribute equality; whitespace-only nodes and attribute/class/style order are normalized.
- Sixteen actual card submissions per variant queue and remove the played card, with matching observed state. Assertions execute real BattleSession commands, not fabricated action outcomes.
- Independent candidate contracts: **49/49 pass**, including stale public-token rejection, hand semantics repair, external descendant/attribute/sibling repair, controlled-state contamination, and precise real feedback-node ownership. See `candidate/contracts-complete.log`.
- Baseline is preserved published commit `91052c8b094cdd7f351a544338bdd83038036ca4`, tree `ea0da5c7aff1702028ac712b4771debcb8511603`; 755 source/data/CSS files verified before and after. No historical source-injection config is enabled.
- Frozen v3 patch SHA256: `4b594bc9d305a7ebca78d47e040e3b0f7e25e76350996060eca441d63d72aa01`, exactly seven production files (full hashes in `candidate-manifest.json`). Independently applied only to the candidate snapshot. All profile production URLs resolve to the correct snapshot.
- Identical main harness SHA256: `d437a8aa58c0c4a2e0646e108b926ea530beecb65c6bca2d195a0913421faa49`.
- v1 remains rejected because of its stale-token generation bug; v2 remains separately preserved with its actual regression/tradeoffs. Neither is silently substituted for final v3 evidence.

## Exact scope and reproduction

Node 24.19.0, Vitest 3.2.7, Linux, AMD EPYC 9V74, 9 exposed logical CPUs; one Vitest worker, all captures sequential. No process affinity was applied. The frozen baseline source, dependencies and main harness match v2; v3 pairs are freshly recorded, not historical reuse.

Two deterministic scenarios use actual production BattleSession, card commands, snapshots, availability, forecast, preview, render, layers and HUD log. Seed `deep-battle-perf-1018`; 12 cards/2 foes or 28 cards/4 foes; two real equipment commands, three potions, nine energy. Art/image readiness, frame/audio backend and outer UI shell are stubbed. Each normal operation has three warmups plus 15 samples per process. Separate CPU and heap passes each perform 12 HP-change renders, 12 hand-page actions and 12 AOE-preview groups. CPU sampling requests 250 microseconds; heap sampling requests 32,768 bytes and includes allocations collected by minor/major GC. Semantic observations are outside the timed/profile windows.

The independent post-profile contract suite adds only five exact small frame-catalog JSON files, never used by profiling mocks; provenance is in `candidate/supplemental-contract-data.json`.

Preparation and analysis: `python3 prepare.py`, then from each variant directory `AB_RUN=blockN node node_modules/vitest/vitest.mjs run --config vitest.config.mjs --reporter=dot` in B/C, C/B, B/C, C/B order, then `python3 analyze.py`. Use a new empty output root for reproduction, not an overwrite of these raw captures. The focused check uses identical `tests/idle.test.js` and `idle.config.mjs` in both variants, `AB_RUN=idleN`.

## External project provenance and practical boundary

[Flameox 0.2.9 official PyPI release](https://pypi.org/project/flameox/0.2.9/) and [versioned repository](https://github.com/morluto/flameox/tree/v0.2.9): MIT license, Python >=3.12. [Official adapter documentation](https://github.com/morluto/flameox/blob/v0.2.9/docs/adapters.md) covers native V8 CPU/allocation inputs. The official wheel SHA256 `ffeb3fc47dd9705b9d41dc8f02de90101a4d678be5c72eab817cfccc3c8aeb88` matches the download; 95 installed source files match the wheel. The isolated venv, downloaded wheel and dependency freeze remain in sibling `external-runtime-profile-20261021`.

Commands used are `flameox analyze rank_cpu_hotspots FILE --format cpuprofile --limits '{"max_rows":1000}'` and `rank_allocation_hotspots FILE --format heapprofile` with the same limits. This is a local CLI, not a global/MCP installation or persistent access change. Source-map resolution is not applied.

Existing counters could expose unnecessary full-stage parsing, but did not quantify absolute CPU/allocation weight or validate the new recursive repair cost. Reusing Flameox with a current-source production replay connected that diagnosis to the retained-stage architecture and exposed countermetrics rather than merely adding reports.

No browser DevTools route was retried or bypassed. Node inspector measures only our own offline process. Browser FPS, layout, paint, GPU, real image/audio decode and perceived smoothness remain unmeasured here; standard allowed browser visual/interaction checks must be treated separately. No main checkout mutation, build, push, or deployment was performed by this measurement task.

## Durable evidence

All final v3 files live in `/workspace/scratch/b7a53a06c872/external-runtime-ab-stagev3-20261021/`, not only `/tmp`:

- `analysis-summary.json`: compact identity, absolute comparisons, semantic summary, limitations.
- `ab-summary.json`: full main run data; `idle-summary.json`: focused data and GC observations.
- `hotspot-comparison.json`: all absolute named-frame values.
- `raw-hash-manifest.json`: raw and derived evidence paths, sizes, SHA256 values; `copy-verification.json`: readback/hash verification of durable handoff.
- `baseline/runs/`, `candidate/runs/`: unchanged raw profiles and semantic oracles.
- `candidate/contracts-complete.log`: 49/49 independent contracts.

All captures/tests are complete. Release/integration and browser validation remain owned by the parent workflow.
