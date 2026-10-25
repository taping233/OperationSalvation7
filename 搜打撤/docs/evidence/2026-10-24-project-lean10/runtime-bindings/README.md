# Runtime bindings and the engine facade

Completed without committing. Runtime source is reduced by **12,201 normalized
UTF-8 bytes** (12,372 raw bytes) and **2,191 non-comment JavaScript tokens**, after
including the new `game/src/core/live-bindings.js` helper. Exact inputs and final
SHA-256 values are in `source-manifest.json`.

The runtime generates 91 read-only getters and 59 ordinary setters from its own
state and an explicit write-field list. Six explicitly typed setters and the
copying `handInfuseCounts` setter remain explicit. The five compatibility slices
are unchanged. The engine's 81 rest-argument compatibility commands use one typed
late-bound forwarder; `cancelDiscover`, `getTriggerSnapshot`, `resolveCard.steps`
and engine replacement checks retain their existing contracts.

Validation:

- Original-source differential comparison passes for all 190 runtime API keys,
  66 setter cases and 84 engine exports. It checks public key order, frozen
  descriptors, function name/length/prototype metadata, copying and reference
  identity, reentrant and aggregate notification order, engine replacement,
  receiver binding, `.steps` and rejected replacement. `differential.mjs` uses the
  SHA-verified originals in the ignored baseline cache; no working source is
  rolled back. Monotonic battle identity tokens are compared by their increment
  and an explicitly shared fixture identity.
- Six focused files pass: 18 tests, including four new API/notification/identity
  regressions and the existing runtime isolation, independent battles, engine
  facade, runtime field whitelist and core port type tests.
- `jsconfig.framework-boundaries.json`, `jsconfig.framework-ports.json` and
  `jsconfig.runtime.json` pass before and after. Targeted ESLint, source syntax
  and diff whitespace checks pass.
- `framework-battle-engine-services.test.js` has two passing cases and one
  existing failure at line 50: its equality assertion does not accept the
  current card `_presentation` field. Injecting both original source files via
  the isolated baseline Vitest transform reproduces the same failure. Neither
  the assertion nor the card implementation was changed.

The first type check found orphaned parameter annotations after removing their
functions; retaining the six explicitly typed implementations preserves their
original type precision and resolves those errors. The parent owns final battle
integration and the eleven-config type gate. This slice did not build, open a
browser, delete files, commit or change the five ESM compatibility slices.

## Final integration failure comparison

The parent's 156-file integration run reported 1,816 passes and 24 failures.
Re-running its 13 failing files against the task's original game JS/CSS gives
**103 passes, the same 24 failures and no skips** (127 cases). All 127 names and
statuses, and every failed case's first diagnostic line, match exactly; no new
failure was found in this comparison. Stack locations and timing are excluded
from the diagnostic comparison.

The isolated config overrides actual Vite module loading for 417 frozen game
modules and maps raw game-file reads to the frozen baseline. All 794 baseline
source hashes were checked first. Tests with CSS-reader adaptations use their
earliest saved pre-adaptation source; other selected tests retain their current
unchanged source. `integration-baseline-inputs.json` records the exact sources
and hashes, and `integration-baseline-summary.json` records the comparison.
The complete Vitest JSON remains under ignored `node_modules/.cache/`.
`run-integration-baseline.mjs` and `compare-integration-baseline.mjs` reproduce
the check without overwriting shared source or changing assertions.
