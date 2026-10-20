# Shop detail covered-region keyboard isolation

## Evidence and scope (2026-10-20)

The private v14 browser check reported by the parent confirmed that, while a wood item detail remained open, Tab could reach a shelf checkbox behind the shade. The visible page header and footer are outside that shade and remain usable. Merely reaching “返回地图” is therefore not treated as a defect.

The detail is an absolutely positioned child of `.shop-layout`; its backdrop covers sibling `.shop-board` and `.shop-merchant`. The outer overlay focus scope correctly excludes inert descendants, but previously neither covered sibling was inert. This affected all item details, including nested card controls and merchant actions.

## Change

- While the detail is open, mark only those two covered siblings inert. Do this both on inspection and on a shop redraw with retained selection.
- Keep them blocked throughout the exit animation. Release on the matching close completion, before returning focus to the original preview. Cancelled close callbacks cannot unblock a newly opened detail.
- Remember preexisting inert attributes per element and preserve them on release. The existing page-surface lifetime is active only while the detail is open. Leaving, opening a bag, rebuilding, or externally replacing/closing the overlay cancels old motion and restores owned inert state on the old nodes. No additional global listeners, full-modal focus trap, or stored settings are added.
- If browse-state restoration finds its previous action unavailable, prefer an available action in the open detail before the usual bag/back fallback. A closed detail still restores the normal shelf entry.
- Stock, pricing, purchase/save rollback, bag capacity, and session guards are unchanged.

## Verification

`npx vitest run tests/shop-detail-focus.test.js tests/shop-transaction-lifecycle.test.js tests/sys03-loot-shop-txn.test.js tests/overlay-disclosure-focus.test.js tests/overlay-dialog.test.js`

New tests cover actual public overlay focus enumeration, visible header/footer availability, reduced-motion close and original-slot focus, animated close/rapid reopen, preexisting inert ownership, help-return redraw, leaving/replacing old roots with preexisting inert preserved, late close isolation, and purchase → continue browsing without duplicate charges. The existing browse restoration test now explicitly rejects returning focus to a shaded merchant entry. These are DOM unit checks; native keyboard behavior and visual shade bounds after deployment still require the parent's same-browser check.

Manual acceptance: inspect a product; Tab and Shift+Tab may visit detail/header/footer but never shaded shelf card checkboxes or merchant actions; Escape/close restores the original slot; repeated reopen, buy, help and bag returns preserve detail availability and correct focus.

Results: 5 files / 81 tests passed; focused ESLint and syntax checks passed. Against the unchanged current main-tree source (including both hideValue shop calls), the new covered-region regression fails because the focus scope still contains the shaded controls. The no-detail sell/bag original-entry restoration tests remain unchanged.

## Replenishment affordability after purchase

When a repeatable item purchase exhausts the remaining coins, its replacement buy button is disabled. If focus was inside that detail, restoration first keeps the same available action; if no purchase/continue/bag action is available, it selects the detail close/back control instead of the inert shelf. Focus already on a visible header/footer stays there. Regression tests cover the 1→0 coin boundary, a still-affordable repeat purchase, and unchanged header focus. This fixes the v16 observed loss of focus; the earlier shade/Escape checks do not establish this new boundary passed in the browser.
