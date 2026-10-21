# Agent entry execution split (e817a3aa)

Frozen implementation: `agent-entry-lazy-e817.patch`; exact changed-path and SHA manifest: `frozen-manifest.json`. Only the independent small copy was edited. No build, publication, gameplay rule change, budget change, or shared integration edit was performed.

## Implementation
- Keep synchronous `act`, observe, policies, recorder, config access, parsing, data page and exports unchanged. `agent.js` itself and `game.boot.js` are unchanged.
- Preserve Promise-returning step/autoRun/waitSettle, replay capture/play and LLM decisions; load execution modules only upon actual use.
- One abort owner reserves autoplay before cold loading. Duplicate starts are rejected. Stop and the run deadline race the import wait, restore driver/ownership immediately, and never execute a late loaded run. Standalone cold steps reject stale slot/run identities.
- Optional chunk errors remain visible and retryable. Configured LLM cold waits honour cancellation and timeout before sending a request. Unconfigured factories do not load fetch machinery. Replay load failures are serializable receipts.
- Cold waitSettle includes import time in its finite timeout budget (20s normal / 8s turbo default), returns the existing stalled receipt if loading expires and passes only the remaining time to the unchanged settling loop. Its existing polling granularity remains unchanged. Cold step has the same finite loading deadline and returns an explicit load-timeout receipt without running a late decision; warmed calls pass their original options directly.
- Existing `agent.runner` import paths retain their public surface; extracted browser command routing is called `agent.action-router` because it is not a pure domain command module. Architecture guards were not modified.

## Validation
- `agent-settle-frozen-final-targeted.log`: latest complete patch including cold settle/step deadlines, 23 files / 212 tests passed. Incremental patch applies cleanly to the saved a7 inputs (`git apply --check`).
- Latest cold-settle correction: `agent-cold-settle-timeout-final.log`, 5 files / 55 tests passed. Apply `agent-cold-settle-timeout-from-a7.patch` to the already integrated a7 version, not the complete patch again. Only runner facade and its dedicated boundary test changed.
- `agent-frozen-final-targeted.log`: final frozen patch, 23 files / 206 tests passed (all Agent-prefixed tests plus replay/contracts/architecture).
- `agent-complete-targeted.log`: 23 files, 202 tests passed (all Agent-prefixed tests plus replay/contracts/architecture); this was before the final cold cancellation/deadline race addition.
- `agent-cold-cancel-final2.log`: final changed boundary and cancellation scope, 7 files, 38 tests passed. Includes four new unresolved-import Stop/timeout cases across autoplay and LLM.
- Targeted ESLint passed. Boundary graph tests prove optional execution modules are absent from the static main entry graph while synchronous contracts remain eager.
- Earlier failed logs are retained: missing small-copy test inputs were supplemented from the exact integration snapshot; the temporary action-router naming issue was fixed without changing guards.
- Original jsdom scene tests emit their existing mocked-resource/audio/animation warnings; tests pass. These are not browser evidence.
- Full project checks, production build/budget measurement and platform-browser verification remain with the integration owner. No claim of reaching the budget or actual byte savings is made here.

## Workspace and cache boundary
The copy occupies only source/tests and selected small runtime fixtures. Dependencies are package-level links inside a local node_modules directory; caches are local. Before that correction, initial Vitest runs used a top-level dependency link and wrote the shared `.vite` result cache. No dependency package bytes or baseline source were edited; no shared cache was removed.

## Further read-only candidate
`entry-static-module-attribution.json` ranks current static main-entry modules by independent minified gzip. These figures are not additive Rollup savings. The event-node controller closure is 8 exclusive modules / 86,946 source bytes / 22,340 independently gzipped bytes. `runEventDeck` is already async; `resumeEventCardChoice` is a synchronous saved-progress recovery contract that must be preserved rather than blindly converted to a Promise. The altar closure is 7 modules / 79,334 source bytes / 22,056 independently gzipped bytes, but has more class-choice and extraction-resume synchronous boundaries.
