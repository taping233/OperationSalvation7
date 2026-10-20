# Courtyard koi: reuse one body's projection within a draw

## Scope and evidence (2026-10-20)

The map/scene loop audit found existing safeguards rather than a new broad hidden-render defect: the Home Pixi scene is rendered on demand; courtyard animation already stops for visibility, pause, reduced motion and departure. No scheduler, clock, audio, random stream or quality thresholds were changed.

A concrete repeated calculation remained in `KoiPond.js`: each fish renders the same body outline twice (shadow, then body). Each outline previously recomputed all seven spine samples independently for both sides. For nine fish this was 9 × 2 × 2 × 7 = 252 spine evaluations per frame, although only 63 samples were distinct.

The new `bodyPoints()` evaluates those seven samples once per fish draw. The two existing canvas paths receive the same projected points. No result survives a draw; every subsequent pose, resize and reset is evaluated normally. Canvas operations, path coordinates and their order stay the same.

## Validation

- Shipped regression suite: `npx vitest run tests/courtyard-koi.test.js tests/courtyard-lifecycle-deep-audit.test.js tests/courtyard-rain-tableau.test.js tests/hub-courtyard-v3.test.js` (4 files, 38 tests).
- A separate temporary before/after comparison ran 120 frames with identical seeded RNG, feeding, pointer movement, resize, reset, paused renders and large dt. Full transformed fill/stroke command sequences matched exactly on every frame (1 additional test, not shipped).
- Static draw instrumentation measured 330 → 141 `Math.sin` calls in the canvas test harness. This includes nine unchanged calls used by the harness's matrix rotation; the engine's body spine evaluations specifically fall 252 → 63. The unchanged baseline fails the new count assertion with 330 actual calls.
- Tests retain original per-side equations, check unchanged outline/path counts, confirm matching shadow/body paths and ensure subsequent animation still changes the pose. Existing feeding, bounded simulation and lifecycle checks pass.
- Focused ESLint, JavaScript syntax and patch whitespace checks pass.

This demonstrates reduced duplicate arithmetic/allocation, not an observed FPS gain. No browser performance measurement or pixel screenshot comparison is claimed. The optimization does not reduce draw calls or change the rendered scene.
