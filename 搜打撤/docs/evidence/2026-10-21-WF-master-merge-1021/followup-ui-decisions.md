# Incoming UI fixture reconciliation

Result: `ui-fixtures-master-relative.patch` changes three files (two tests plus the diagnostic title HTML fixture); no gameplay source, main index, production CSS, assembly workspace or Git index was edited. `candidate-manifest.json` contains exact expected/current/output hashes and the patch passes `git apply --check` against assembly.

## Incoming baseline

`incoming-source-proof.json` verifies 826 incoming-master input blobs, including exact source, tests, diagnostic HTML/JS, main index, CSS and existing dependency fixture files. Source/CSS/data dependencies are reused read-only from the exact incoming type-baseline directory; no full repository was copied. The copied six test/HTML inputs are independent.

From `incoming/搜打撤`:

`./node_modules/.bin/vitest run --config vitest.fixtures.config.mjs tests/departure-stack-lifecycle-review.test.js tests/sys03-altar-restore-txn.test.js tests/title-resource-review.test.js --reporter=verbose`

`incoming-baseline.log`: 46 passed / 3 failed. All three failures reproduce before cloud changes.

## Exact decisions

- Departure: retain consumed-pile destination, reusable-after-restoration meaning, first-open disclosure and position before Deploy. Adapt the restoration-help pointer to current concise `方法见背包` and assert the actual disclosure heading. The removed generic extraction slogan is no longer part of incoming departure markup. The separate substantive dynamic pending-restoration loss warning test next to the final Deploy action remains unchanged and passes, as do identity, capacity, persistence, interruption and transaction tests.
- Entry supply: successful receipt explicitly resets `claimNotice`, and markup omits `.reward-notice` when empty. Assert absence instead of dereferencing a nonexistent node. The same test still requires full-bag failure to show the preservation warning, preserve cards/progress, and permit later success. All completion, persistence, duplicate/stale-action and transaction assertions remain.
- Title diagnostic: incoming main index comments out experimental `cover-remaining.css`; diagnostic HTML still loaded it, shifting the otherwise identical stylesheet prefix. Comment out only that experimental link in the diagnostic fixture, mirroring main. Keep new `transition-illustrations.css` and its order, all title DOM/art, and the complete unchanged stylesheet-order/privacy/interval lifecycle tests. Main index and source CSS stay untouched.

## Validation

- `focused-final.log`: 3 files / 49 tests pass against exact incoming dependencies.
- `eslint.log`: pass for both modified tests using assembly project config. `node --check`: pass.
- `negative-help.log`: removal of current backpack-help pointer fails the intended departure test.
- `negative-notice.log`: failure to clear successful claim notice fails the intended supply test. Negative controls are transform-only; source bytes are unchanged.
- Original title test already fails against the obsolete active experimental link in `incoming-baseline.log`, then passes unchanged after the diagnostic fixture correction.
- Not run: full gate, build, browser. These fixture/contract checks are not visual acceptance.
