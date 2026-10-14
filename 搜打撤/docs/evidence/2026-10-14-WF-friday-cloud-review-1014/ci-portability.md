# CI portability repair

Verified on 2026-10-13 at approximately 18:10 UTC in the isolated cloud import of upstream snapshot `db831272780b8d0c792e93b9661404b5ee68e5ab`. The local imported baseline is `d6551cc`, not an upstream-history checkout. This evidence covers the narrowly delegated port preflight and temporary Git-hook fixtures only.

## Changes

- `scripts/perf-ledger-capture.mjs`: replace Windows-only `netstat` parsing and its silent precheck bypass with asynchronous Node socket bind probes for IPv4 and IPv6 loopback. Close only the probes created by this script. Recognize `EADDRINUSE` as occupied, retain the explicit no-process-killing diagnostic, reject invalid ports and other probe errors, and permit an unavailable IPv6 address family without bypassing the mandatory IPv4 probe. Await the preflight before Edge discovery or spawn.
- `tests/perf-ledger-port-occupancy.test.js`: retain real-listener survival and no-cleanup-log assertions; add IPv4 wildcard, IPv6 loopback, free-port release and invalid-port coverage. Suppress Edge discovery in the isolated child process so tests never need or launch a browser. The IPv6 case alone may skip when the host has no IPv6 support; it ran and passed here. HTTP liveness uses Node's direct HTTP client, and the fixture dev server uses IPv4, avoiding environment proxy handling of `::1`.
- `tests/workflow-ship.test.js`: create only the owned fixture hook with exclusive `wx`, then set that newly created file to `0755` on POSIX and assert its executable bits. Apply the helper to all three existing pre/post-commit fixtures. Preserve all existing commit-failure, completed-commit, staged-document, concurrent-index and no-overwrite assertions.

## Focused verification

Toolchain: Linux, Node `v22.23.3`, Vitest `3.2.7`, existing lockfile dependencies installed by the parent task. No package installation was performed by this repair worker.

```sh
PATH=/workspace/shared/friday-toolchain/node_modules/node/bin:$PATH \
npm_config_cache=/workspace/shared/friday-npm-cache \
node node_modules/vitest/vitest.mjs run \
  tests/perf-ledger-port-occupancy.test.js tests/workflow-ship.test.js --reporter=dot
```

Result: exit 0, **2 test files and 23 tests passed**, zero skipped, duration 4.14 seconds. All three occupied-listener families remained reachable after capture-script exit. All three intended Git hook failure/concurrency paths executed successfully through their retained assertions.

```sh
PATH=/workspace/shared/friday-toolchain/node_modules/node/bin:$PATH \
node node_modules/eslint/bin/eslint.js scripts/perf-ledger-capture.mjs \
  tests/perf-ledger-port-occupancy.test.js tests/workflow-ship.test.js
git diff --check -- scripts/perf-ledger-capture.mjs \
  tests/perf-ledger-port-occupancy.test.js tests/workflow-ship.test.js
```

Both exited 0. Existing `environmentMatchGlobs` deprecation and environment HTTP-proxy experimental warnings were nonblocking.

The initial expanded test run exposed a fixture-only IPv6 HTTP proxy issue before the preflight was reached. The fixture was corrected to use an IPv4 reusable dev server and direct HTTP listener liveness; the final scoped suite above passed. That failed attempt did not launch a browser or a Vite process.

## Production hook recommendation and limits

Before the parent integration change, `git ls-files --stage .githooks/pre-commit` reported mode `100644`; the filesystem mode was `0644`. The shell script itself is valid. `scripts/setup-commit-gate.mjs` already tries to chmod it to `0755`, but preserving executable mode `100755` in Git is the durable ordinary-Linux-checkout fix. The parent owns that mode change; this worker did not modify the production hook or Git hooks configuration.

Windows execution, a fresh exported checkout, aggregate checks, full suite, build and browser/gameplay QA were not run by this worker. Parent integration must establish those results as applicable. Socket preflight is an instantaneous availability check, not an atomic reservation through browser spawn. Cleanup remains limited to script-created probes and existing script-created child process handles; no foreign listener cleanup was added. Shared task/registry files, archive bytes/manifests, assets and publication were left to the parent and other scoped workers.
