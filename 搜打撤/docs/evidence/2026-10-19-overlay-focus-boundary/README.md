# Dialog focus stays in the active surface

Baseline: a37cf1f9b685101c2b16a469dfac3f85268da97f. This is a shared overlay focus fix, following the duplicate-close lifecycle correction.

## Player-facing behavior
The chest reward picker marks its background `inert`. The common focus list previously still included buttons in that background, so initial focus and the Tab boundary could target controls unavailable during selection. The shared filter now excludes inert/hidden/ARIA-hidden ancestors and natively disabled controls. Negative tabindex is excluded from sequential navigation. An explicit heading with tabindex=-1 remains a valid initial target. Disabled fieldsets retain the native first-legend exception.

The same availability predicate serves sequential focus and initial focus, rather than adding a reward-only workaround. No rewards, save migrations, styles, assets or performance budgets changed.

## Reproduction and validation
- Before fix: three added dialog regressions failed; eight existing tests passed (before.log).
- After fix: five targeted UI suites, 55 tests passed (target-final.log), including real UI-created dialog axe rules already introduced by the preceding batch. This is jsdom coverage, not a live page.
- fast-check: seven tests passed; 200 lifecycle action sequences plus 200 generated focus-availability combinations. Focus cases cover inert/hidden/ARIA-hidden/disabled/fieldset state and absent, negative, zero and positive tabindex.
- Stryker focus ranges: first run killed 21 of 24 mutants. Three survivors exposed missing zero/positive tabindex boundary coverage. Adding these real cases killed all 24, with zero timeout, uncovered or error mutants. Both reports retained; no mutation exclusion or threshold relaxation.
- Syntax, eight type checks and project lint passed; final changed-test lint passed. UI jscpd: 74 sources, one existing seven-line clone in page-visual-ready.js, zero new clones; report retained. No new tool installation or dependency change.

## Reproduce
Run `npx vitest run tests/overlay-dialog.test.js tests/battle-decision-lifecycle.test.js tests/reward-frame-review.test.js tests/reward-capacity-organizer.test.js tests/help-return-lifecycle.test.js`.
Run `npx vitest run --config tests/tools/overlay-lifecycle.vitest.config.mjs`.
Run `npx stryker run tests/tools/overlay-focus.stryker.json`.
Run `npm run check:syntax`, `npm run typecheck`, and `npm run lint`.

## Boundaries
This recovery workspace contains sources and selected assets, not a full checkout. Native browser/live-page keyboard and visual verification remain outstanding; no screenshot, full asset restoration or manual playtest is claimed. Main remote CI is tracked separately after publication. Prior Vite build succeeded but four existing package/entry/initial-JS/CSS budget failures remain. The earlier artifact dedup budget improvement is unchanged.

The preceding batch's official Spec Kit acceptance structure and design review remain references, not a claim that its lost historical CLI artifacts were recovered. This batch's acceptance is: opening the picker focuses an active control, Tab/Shift+Tab wrap within that active surface, and explicit accessible heading focus remains possible.
