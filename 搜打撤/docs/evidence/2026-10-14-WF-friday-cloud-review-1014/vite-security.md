# Narrow Vite security patch

Applied 2026-10-13 UTC in `/workspace/shared/OperationSalvation7-db831272/搜打撤`.

## Result

- `package.json` raises the Vite minimum from `^6.0.0` to `^6.4.4`.
- `package-lock.json` changes only the root Vite range and Vite's version, official registry tarball URL and npm-generated integrity from 6.4.3 to 6.4.4.
- Installed Vite is 6.4.4. Vitest and @vitest/mocker remain 3.2.7; vite-node remains 3.2.4. Every other lock entry, every dependency range in Vite's lock entry, and all other manifest properties are unchanged.
- npm 11.9.0 removed 16 existing `peer: true` fields during install. Their original values were restored after checking that these were the only unrelated generated changes. The original npm output lock is preserved separately.

## Security scope

This is the smallest compatible correction for the two Vite advisories verified in the external runtime dependency review:

- https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22
- https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw
- Official release: https://github.com/vitejs/vite/releases/tag/v6.4.4

The separately documented @vitest/mocker advisory and the exact npm audit aggregate remain unresolved. No audit, alternate private dependency disclosure, major dependency migration or zero-vulnerability claim was made.

## Execution and checks

Used Node 22.23.3, npm 11.9.0, `/workspace/shared/friday-npm-cache` and the official npm registry:

`npm install --save-dev --save-prefix='^' vite@6.4.4 --no-audit --no-fund --ignore-scripts --registry=https://registry.npmjs.org`

npm reported “changed 1 package in 9s”. Project/install lifecycle scripts were disabled.

Passed:

1. Exact parsed comparison of both manifests and all lock entries, asserting that only the intended range/version/URL/integrity changed.
2. Installed package version comparison with the final lock.
3. `vite --version`: vite/6.4.4 linux-x64 node-v22.23.3.
4. `npm ls vite vitest --depth=2 --no-audit`: no missing/invalid entries in the selected graph; every Vite consumer dedupes to 6.4.4.
5. `git diff --check -- package.json package-lock.json`.

Not run: npm audit, full suite, build/budgets and browser. These are parent-owned integration checks while independent workers are editing. Repository quality guidance requires full selection for package/build configuration changes; this focused verification does not substitute for that final integration gate.

No shared registry, Vite configuration, repository evidence, staging, commits or pushes were changed by this worker. Package-file ownership and any in-repository registration/evidence are coordinated by the parent.

Detailed lock fingerprints and install logs are retained with the cloud review deliverable; no package audit or major-version migration is claimed.
