# Exact-source v4 CPU / allocation handoff

## New v4 result — not reused v3 metrics

Four newly recorded, alternating fresh-process pairs against immutable published baseline `91052c8b` show substantial retained-stage render savings. These are local Node/jsdom results, not browser FPS or a claim that the final combined integration has passed its FULL gate.

Pooled unprofiled wall timings, 60 measurements per operation per variant:

| Scenario / operation | Baseline median / p95 ms | v4 median / p95 ms |
|---|---:|---:|
| Typical: HP-change render | 8.654 / 13.756 | 4.971 / 6.887 |
| High: HP-change render | 8.535 / 11.480 | 4.564 / 5.927 |
| Typical: hand-page action | 16.257 / 26.770 | 12.504 / 19.527 |
| High: hand-page action | 17.277 / 25.650 | 13.699 / 18.808 |
| Typical: unchanged render | 5.533 / 8.369 | 4.309 / 5.495 |
| High: unchanged render | 5.076 / 7.046 | 3.799 / 7.130 |

HP-change median improves **42.6% / 46.5%**. All four paired HP-change and hand-page medians improve in both scenarios, but not every tail observation improves.

Median total sampled allocations for the fixed mixed stream:

| Scenario | Baseline bytes | v4 bytes | Reduction |
|---|---:|---:|---:|
| Typical: 12 hand cards, 2 foes | 208,569,704 | 107,899,040 | 48.3% |
| High: 28 hand cards, 4 foes | 234,753,820 | 122,873,556 | 47.7% |

These estimate allocations **including objects already collected**, not retained heap/RSS/GPU memory. Baseline high-load block 2 has one allocation sample (estimated 32,800 bytes) without frame attribution; it remains included in total bytes. All rows are returned; all other main CPU/heap captures report complete coverage.

## Preserve the countermetric

Short high-load unchanged-render wall p95 rises slightly, **7.046 to 7.130 ms**; three of four paired wall p95 values rise. Process-CPU p95 rises **8.034 to 15.225 ms**, although CPU median improves from 5.427 to 4.206 ms. Do not claim universal improvement or erase these observations.

One bounded repeat of the identical focused idle scenario (30 warmups + 150 unchanged renders, three alternating pairs, 450 samples per variant) gives:

| Measure | Baseline median / p95 ms | v4 median / p95 ms |
|---|---:|---:|
| Wall time | 5.654 / 9.048 | 4.541 / 6.658 |
| Process CPU | 6.249 / 12.347 | 5.497 / 12.252 |

Steady-state wall time improves; its process-CPU p95 is nearly unchanged. This bounds the short-scenario regression rather than proving a cause or guaranteeing browser smoothness. All paired distributions and GC observations remain in `idle-summary.json`; no further exploratory sampling was performed.

## Absolute sampled attribution

High-load Flameox inclusive medians across four fresh captures:

| Frame | Baseline CPU samples / allocation bytes | v4 CPU samples / allocation bytes |
|---|---:|---:|
| mountUnitLayer | 282 / 47,810,188 | 3 / 262,436 |
| Old showBattleStage → new stage.show | 324.5 / 40,877,052 | 118.5 / 8,723,788 |
| updateHand | 511 / 68,636,840 | 494 / 63,658,988 |

This locates the larger gain in stage/unit-layer work rather than percentage dilution. CPU counts are native samples, **not milliseconds**. Inclusive frames overlap and recursive `patchNode` must not be added to stage/show/render. `hotspot-comparison.json` preserves every per-block absolute value; the summary also retains total sampled intervals and inspector overhead. Speed claims use unprofiled timings, not conversion from requested sampling interval.

## Identity, correction history and correctness

- Baseline commit: `91052c8b094cdd7f351a544338bdd83038036ca4`; tree: `ea0da5c7aff1702028ac712b4771debcb8511603`. Independently preserved 755 source/data/CSS files, checked before and after. No historical source-switch injection.
- Exact complete **eight-production-file v4 patch SHA256**: `43d5ed9a248c46e8febe121432910f1a6e79af3c77bf5873f68457cba808f22e`. See `candidate-manifest.json` for all file hashes. Candidate snapshot is baseline plus only this patch, **not** the diagnostic + infusion combined integration.
- v3-to-v4 incremental correction (three production + three test files) SHA256: `58561fef26ac1244353734a4baafa08335bf2eff412bf5a6c4a63c801251e44e`. Corrections verify live stage token/first-child ownership, reject inactive potion callback owners, and reapply isolated QA host disabled controls. The retained-stage performance architecture remains, but v4 is nevertheless remeasured in full.
- v3 FULL-gate failures and original metrics remain preserved. The former v3 measurement directory has `SUPERSEDED-v4.json`; no original raw profile, oracle or reported number was rewritten. v3 metrics are not presented as v4 evidence.
- Main harness unchanged SHA256: `d437a8aa58c0c4a2e0646e108b926ea530beecb65c6bca2d195a0913421faa49`. Both snapshots use identical regular-file harnesses and dependencies.
- **104 paired main checkpoints:** zero compared state differences; normalized DOM differs only by hand container `role="group"` and `aria-label="当前手牌"` restoration (208 explicit attribute additions). No new difference is filtered. Whitespace-only nodes and attribute/class/style order are normalized, so this is not byte equality.
- Sixteen real card submissions per variant queue and remove the played card, with matching observed state. Focused idle oracles are checked separately.
- **Independent five-file contract suite: 66/66 pass**: persistent stage 36, mounts 9, validator 5, potion lifecycle 15, isolated QA host 1. Tests are copied regular files, not mutable symlinks; `candidate/contract-source-manifest.json` records hashes and they still match the frozen author files. `candidate/contracts-complete.log` is the result. The QA-host correction is covered by this live-host contract, not claimed as part of the battle profile hot path.

## Exact bounded scenario and external tool

Node 24.19.0, Vitest 3.2.7, Linux, AMD EPYC 9V74, nine exposed CPUs, one Vitest worker, all runs sequential with no CPU affinity change. The integration worker explicitly reserved a window after its corrected build and held FULL until all captures/contracts ended. Capture began 09:38:18 UTC; all capture and contract processes ended by 09:40:53 UTC. The window was then explicitly released.

Actual production BattleSession, commands, snapshots, availability, forecast, preview, render, layers and HUD log run with seed `deep-battle-perf-1018`, two real equipment commands, three potions and nine energy. Typical/high scenarios have 12/28 hand cards and 2/4 foes. Art/image readiness, frame/audio backend and outer UI shell are stubbed. Each normal operation has three warmups + 15 measurements per process. Separate CPU and heap passes each run 12 HP-change renders, 12 hand-page actions and 12 AOE-preview groups. CPU sampling requests 250 microseconds; heap sampling requests 32,768 bytes and includes minor/major-collected allocations. Semantic observations are outside profile/timing windows.

Use the existing [Flameox 0.2.9 official release](https://pypi.org/project/flameox/0.2.9/) / [versioned MIT repository](https://github.com/morluto/flameox/tree/v0.2.9), not another duplicate profiler. The verified isolated venv, wheel SHA256 `ffeb3fc47dd9705b9d41dc8f02de90101a4d678be5c72eab817cfccc3c8aeb88`, and dependency freeze remain in sibling `external-runtime-profile-20261021`. Offline CLI operations are `rank_cpu_hotspots --format cpuprofile` and `rank_allocation_hotspots --format heapprofile`, both with `max_rows:1000`; source-map resolution is not applied.

No browser DevTools route was retried or bypassed. Node inspector measured only our own offline processes. Browser FPS/layout/paint/GPU/image/audio decode and perceived smoothness remain unmeasured. This task did not mutate the main checkout, build, push or deploy.

## Durable evidence / reproduction

Root: `/workspace/scratch/b7a53a06c872/external-runtime-ab-stagev4-20261021/`.

- `analysis-summary.json`: compact exact-source results, complete absolute comparisons, oracle and coverage summaries.
- `ab-summary.json`, `idle-summary.json`, `hotspot-comparison.json`: detailed new v4 measurements.
- `baseline/runs/`, `candidate/runs/`: unchanged raw profiles, operation samples and semantic oracles.
- `raw-hash-manifest.json`, `copy-verification.json`: explicit paths, SHA256 fingerprints and handoff readback verification.
- `candidate/contracts-complete.log` and `candidate/contract-source-manifest.json`: 66 contracts and immutable test fingerprints.
- `prepare.py`, `analyze.py`, `postprocess.py`, `finalize-analysis.py`: preparation and analysis. Reproduce in a new empty root, not by overwriting these captures. Run each variant with `AB_RUN=blockN node node_modules/vitest/vitest.mjs run --config vitest.config.mjs --reporter=dot` in B/C, C/B, B/C, C/B order. Focused idle uses `idle.config.mjs` and `AB_RUN=idleN`.

No capture/test process remains running. The parent integration workflow owns final combined-build FULL/visual/release acceptance.
