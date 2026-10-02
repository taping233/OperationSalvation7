# Linux independent acceptance and incremental corrections

Apply this five-file incremental patch only AFTER the original quality-art-repair-2026-10-02 repair patch. This is not a HEAD diff and must not be applied to the original baseline. Every preimage is the verified post-repair hash from that bundle. No source replacement is permitted if a preimage differs.

Use apply_to_isolated.py --root /absolute/repository first for read-only precondition/git-apply checks, then add --apply only in the authorized integration checkout. No Git initialization is needed. The script verifies the patch hash, every preimage and every final hash. The exact delta also passed a separate byte-for-byte roundtrip fixture.

Corrections:
- Persist next request time from transport completion, keeping pending=true if completion clock or save fails. This conservatively guarantees >=45 seconds despite pre-dispatch fsync/scheduling delay
- Use one private per-call directory for payload, ZIP and verified image; publish only the validated image with atomic replace. Concurrent same-output callers cannot swap dimensions or undercharge quota; existing sibling payload/ZIP artifacts are untouched
- Classify vite.config.mjs and vite.config.cjs like other quality configurations so staged guards and full-test routing cannot skip them

Final Linux validation: 15 related JS test files, 258 passed, 0 failed and 3 explicitly excluded environment cases. All real POSIX symlink fixture tests ran without link skips. 18 offline NAI tests passed with no skips, including actual flock, file/directory fsync observation and persisted crash uncertainty. Expanded static lint, syntax (296 files), all 8 type configurations, data, shell hook syntax, docs and asset audit passed. Assets: 0 new errors, 1162 unchanged explicit old warnings. Original licenses were preserved; four new registrations remain explicitly pending. Scene count is 12 and normal tests remain write-free.

Initial failure logs are retained. Two missing-.git CLI cases and one frozen Electron source-exclusion case are not passes. Do not invent production history or claim those three were exercised here. No full game suite/build/server/UI/live NAI/real PIL output/remote CI validation was done.

Before-fix regressions proved a 35-second dispatch gap and a small-image reservation reading another caller's large-image payload. Their evidence and green final logs are included. Conservative completion-based pacing may wait longer than the old reservation-based behavior. Per-call payload/ZIP files are temporary rather than overwritten public siblings.

Local coordinator should apply only if five preimages match and rerun the same Windows targeted regression set and offline NAI suite. One explicit POSIX fsync test is expected to skip on Windows; Linux symlink evidence is supplied here. Preserve original workspace/index and unrelated edits.
