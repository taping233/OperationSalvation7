# Shop detail covered-region keyboard isolation

## Current interaction

货架上的卡面用于查看商品详情，独立的“购买/免费领取”按钮才提交交易；卡面点击不扣币或发牌。详情页仍提供购买、收起与必要的整理背包入口。金币不足和售罄的购买按钮不可提交，背包装不下时货架提供整理入口。卡牌完整规则较长时可展开阅读。

商品详情不再重复展示当前/购买后余额和默认入包去向；余额保留在商店页头，详情只保留金币不足、背包容量及售罄等状态。神秘货箱在货架和详情中共用夸张手绘问号卡背，成交后显示真实卡牌。购买刷新复用原按钮时，将新可用状态交给保存锁收尾，避免旧状态重新启用已买不起的补货按钮。商店短转场使用暗色底，保留原滑光和淡出节奏。

详情遮罩覆盖的货架与商人区域暂时退出键盘焦点范围，可见页头和页尾仍可使用。收起详情后焦点回到原商品；离页、重绘或打开背包会清理旧详情的遮罩状态。2026-10-23本轮只核对源码和现有DOM回归，没有新的实页验收结论。以下2026-10-20记录保留其当时的验证范围。

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
