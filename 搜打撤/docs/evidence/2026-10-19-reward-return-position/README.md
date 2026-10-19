# Return to the same reward and backpack position

From 5edd48830653d939984c6ea8dea8f734106fb180:
- Returning from reward organization or the full backpack restores the original card-list scroll and selected card focus. Reopening the same box preserves position. This uses an ephemeral per-box WeakMap, never save data.
- Abandon confirmation focuses the safe keep/reconsider button.
- Pearl box, mage pouch and discard confirmation return to the original backpack scroll position and card. If the discarded stack disappeared, focus moves to a remaining neighbour; cancelled discard changes no inventory. Return state is scoped to the same run and inventory instance.
- The existing engineering plan records the requested batch-first workflow and resource-consumer review check.

## Resource regression correction
The preceding build (run 39211577184) grew 212.04 to 231.44 MiB. Its log identifies changed chests selectors; the safe fallback retained 109 reviewed legacy assets. This increment belongs to the preceding batch, not old budget debt.

Re-reviewed chests.js against the exact previously reviewed SHA256 dbde483382c453fe9c716cc72e102a1f2ed438373bcde179e8d61b17d9ee8d18. The entire delta is DOM scroll/focus preservation and closing-action guards; imports, asset paths, chest artwork configuration and dynamic asset selection are unchanged. Updated only the two fingerprints for this consumer; candidate list, fallback behavior, graph guard and budgets stay intact. Local planning again omits 195 assets with zero warnings. The next remote build must verify the package increment is removed; no final byte-size claim yet.

## Verification and limits
Combined run: 203 pass, one asset-presence check initially blocked by two missing recovery-workspace files. Retrieved those two original winter-arrival images from exact GitHub 5edd488, verified Git blob SHA, and reran both asset suites: 28/28 pass. All 204 distinct assertions are now covered successfully across these runs. No test was skipped or weakened. Syntax, eight type checks and lint passed. Logs retained once per combined run.

The recovered workspace is still partial. Native-browser keyboard, scroll geometry and animation remain unverified. No original art is changed or deleted; restored local originals are not part of this commit. Remote main CI and build are checked after publication.
