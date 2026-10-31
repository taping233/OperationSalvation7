# Current final asset provenance

Status: passed. 11 primary receipts: 1270 source checks and 1287 Unity output checks matched SHA256; no drift. Counts include repeated assets across receipts. Includes all 264 frames, 8 fonts, 4 current BGM.

Music matches current sound.music.catalog.js exactly: title v12, board ashline, battle v2, shop v3. CurrentAssets.Music has only four keys. AudioService uses Res.Music; missing clip stops playback and clears clip. Legacy Res.Bgm API has zero call sites.

Eight node source-svg paths are receipt-local extracts: extracted SHA matches and reconstruction from current illustrated-node.js ghosts/template matches 8/8. Both node and frame manifest SHAs match.

Limits: primary receipt coverage only; no full dynamic reachability claim. 17 home CSS-derived output SHAs matched, source design relies on parent Source794/CSS evidence. No fresh pixel/render/playback/native tests. Existing conversion evidence remains reusable through matching input/output hashes. Historical isolated or missingSourceImages entries are not reported as current bugs.

Evidence: receipt-recheck.json contains per-entry paths, expected/actual SHA, primary receipt SHA, music mappings and limits. Only this directory written. No production/editor/build/browser/shared compile actions.
