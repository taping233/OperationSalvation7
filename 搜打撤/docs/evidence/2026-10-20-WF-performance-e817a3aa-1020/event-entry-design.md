# Event entry lazy split (e817a3aa)

Production files frozen; no production build was run in this seed. Integration owns the single measurement of actual entry/initial gzip delta.

## Change
- `game.run.flow.js` loads `event-runtime.js` on ordinary event entry.
- `event-runtime.js` assembles UI, story, and narrative services without relaxing the existing pure-controller architecture rule.
- `event-lifecycle.js` keeps synchronous boolean reward restore, the single card-choice controller and its unsaved-reward WeakSet, save retry, request generation, and settlement reentry shared with the heavy controller.
- Cold loading has immediate feedback, cancel/exit, a 10s timeout, retry, per-request ownership, and late-completion suppression. The loader releases presentation ownership before the existing node transition takes over.
- Last Lamp continuations now carry request generation. Narrative permits only the original closing page/transition to clear naturally. Record completion requires the same visible choice page. A successful Base receipt is retained when the page is gone; no late page update, hook clear, sound, or node consumption follows. Bag return rebuilds a fresh presentation snapshot.

## Patch
`event-entry.patch` applies with cwd `搜打撤`, `-p1`.
SHA256: `3695c625de8e2675073185dd6ec378bcbf79be153ff3088b5a6f1410f8a2ceab`
`event-entry-manifest.json` contains exact e817 base Git blob IDs and every final file hash.
Four production files and eleven tests. Eight existing event test helpers now wait for dynamic import before advancing fake transition timers. The story source guard follows the new current argument and additionally checks the ownership guard.

## Verification
- `events-regression-final.log`: 22 files, 306 tests passed, including 39 architecture tests.
- New loader tests: 28. New story continuation tests: 11.
- ESLint: `eslint-final.log`, exit 0.
- `node --check`: all four production files, exit 0.
- Independent final source review: no remaining blocker within scope.
- Existing four-player teardown logs `requestAnimationFrame is not defined`; reproduced unchanged against fixed e817 source in `baseline-four-player.log` (6 tests pass). This was not suppressed or fixed by this patch.

## Additional verification
`extended-regression.log` records six other related suites. `event-entry-test-supplement.patch` contains only the same dynamic-import wait for the black-market preview test; it does not alter production files or assertions.

## Measurement caution
18.25 KiB was an attribution estimate from independent minified gzip files, not expected additive savings. Loader/lifecycle costs and compression sharing reduce actual savings. Only the integration production build can decide whether the remaining 17.6/16.1 KiB budget gap is closed.
