# Central inventory and explicit pouch-release fixture repair

No production gameplay source, budgets, test config, or skip condition changed. Four files only; patch is incremental against frozen `2c51b365a9703a5f9d4ab7e5e250d2c5a4bba388`.

## Exact incoming baseline

The original incoming type-baseline source view plus four SHA-verified historical documentation inputs reproduces 5 failures / 27 passes / 1 pre-existing opt-in inventory-generation skip across E8 inventory, M batch production, and required-infusion play. Log: `/tmp/merge-master-b7207a28-evidence/incoming-inventory-pouch-baseline.log`. The full merged gate had the same four lamp-guard failures and stale pouch-rejection assertion, among its 12 failures.

## Inventory guard repairs

The incoming baseline projection updates the lamp description, but `isApprovedLampArmorRemoval` still compares against the unprojected old description, so every genuine current lamp fails. The repair locks the projected before card and exact approved after card. Expected description is a fixed independently reviewed literal; expected rules come from the pre-existing frozen approval fixture, not current production data. All existing mutations remain; random-pool and armor-effect changes are additionally rejected. Historical before artifacts remain byte-identical.

Once the lamp comparison is repaired, an existing masked shadowbug guard fails: E8 before has no M3 rules, but the incoming special case permits rarity-only changes. It now permits exactly `rarity` plus the independently specified already-approved M3 steal-attack rule. No numeric/effect change is introduced. A new test rejects six current-card/rule mutations and two old-baseline mutations. The first candidate failure log is preserved: `central-inventory-pouch-repair.log`.

## Explicit pouch release

Latest incoming discovery code explicitly passes `directRelease=true` for `act:'pouch'`; ordinary manual/free/queue entry guards remain unchanged and still reject required infusion without materials. The stale pouch-rejection case is replaced with a real-engine positive contract using a stored `pouchOf` source (excluded from the hand), a separate retained hand material, exact 11 damage, unchanged hand/energy/discard/grave/material-count resources, removal of only the stored ownership entry, retention of exact pouch/material objects, one identified consumed temporary spell, and the accurate direct-release note.

Negative control: run this new test against exact incoming runtime with its eight-argument facade defect. It fails at the intended damage assertion (999 versus 988), not an import or fixture error: `central-pouch-old-facade-negative.log`. Its 13 unselected tests are normal `-t` filtering only; the final full focused run executes all 14 required-infusion cases.

## Validation

- Three suites: 33 passed, 1 existing opt-in inventory-generation skip, 8.66 seconds (`central-inventory-pouch-repair-final.log`).
- ESLint: passed for all four modified files (`central-inventory-pouch-lint.log`).
- Patch apply check: passed against assembly; exact before/after Git/SHA256 hashes are in manifest.json.
- No full gate/build/browser claim. Review required before integration.
