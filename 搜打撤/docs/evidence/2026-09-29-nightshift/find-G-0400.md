# find-G-0400 —— STS2 对照第四批：遗物/药水/商店经济域（开采者 G，2026-09-29 夜班）

对照方向：① 商店/经济（价格/库存/购买一致性）② 药水/道具触发时序。
本项目源码 game/src/；参照 D:\素材\杀戮尖塔2源码\sts2-decompiled\（STS2 v0.107.1，只读）。
本项目无独立 relic/charm 系统（对应物：道具卡 + 携带宠物效果，如招财猫 shopFree），时序对照落在战斗道具/药水上。

---

## 发现

### G-1 | P2 | BOSS 战「禁逃跑」只在视图层执行，引擎侧无复检；agent 命令通道可直达逃跑
- 本项目 `game/src/battle/bag/battle.bag.js:43-46`（itemUsability，BOSS 禁逃口径）：
  `if (mode === 'boss' && ITEM_BOSS_FLEE_PATTERN.test(String(card.desc || ''))) return { usable: false, why: 'BOSS 战中无法逃跑' };`
  `if (mode === 'boss' && Array.isArray(card.rules?.bag?.use) &&`
  `    card.rules.bag.use.some(op => op?.op === 'flee')) return { usable: false, why: 'BOSS 战中无法逃跑' };`
- 本项目 `game/src/battle/bag/battle.bag.js:50-53`（useItem 入口门禁，5 态，无 itemUsability 复检）：
  `if (busy || infusing || discovering || choosing || handSelecting) return;`
- 本项目 `game/src/battle/bag/battle.bag.js:133-136`（结构化 flee op 结算，无 mode 检查）：
  `if (op.op === 'flee') {`
  `  G.log('[[icon:runner]] 逃出了战斗（非 BOSS 战道具）', 'ok');`
  `  finish(null);   // 逃跑语义=null（烟雾弹）；false 是战败会走死亡结算直接终局`
- 本项目 `game/src/battle/core/battle.engine.js:273`（itemUsability 唯一消费点——只进快照药水栏）：
  `const u = itemUsability(o.card);`
- 本项目 `game/src/agent/agent.state.js:198-202`（agent 命令清单，无 usable/isBoss 过滤）：
  `for (const item of (game.ownedCards || []).filter(o => o.card && o.card.type === '道具' && !o.safe)) {`
  `  push('useItem', [item.uid]);`
  `}`
  `for (const p of snap.potionBar || []) push('usePotion', [p.uid]);`
- 数据侧佐证 `game/src/cards/cards.sync.m6.js:61`：`['tt4-smoke-bomb', BAG([{ op: 'flee' }])],`
- 现状边界：人类路径目前被两处视图拦住——药水栏 `.off`（`game/src/battle/view/battle.view.js:334` `p.usable === false`）与 BOSS 战 btBag 拒开（`game/src/battle/view/battle.view.js:485-489` `if (getSnapshot().opts.isBoss) { UI.log('[[icon:lock]] BOSS 战为牌库制：道具与资源不参战，背包不可打开', 'warn');`）；无 B 键绑定（battle.layers.js:58 键盘只有数字/Esc/方向键）。但快照里 BOSS 战仍生成 potionBar（battle.engine.js:272 无 mode 过滤），agent 通道 push 的 useItem/usePotion 直达引擎即生效，`finish(null)` 经 `game/src/battle/core/battle.lifecycle.js:127` 走 flee 分支终局。
- STS2 参照 `MegaCrit.Sts2.Core.Entities.Merchant/MerchantEntry.cs:69-80`（引擎 wrapper 强制复检，不信任视图）：
  `public void OnTryPurchaseWrapper(MerchantInventory? inventory, bool ignoreCost = false)`
  `{`
  `    if (!IsStocked)`
  `    {`
  `        InvokePurchaseFailed(PurchaseStatus.FailureOutOfStock);`
  `        return false;`
  `    }`
  `    if (!EnoughGold && !ignoreCost)`
  `    {`
  `        InvokePurchaseFailed(PurchaseStatus.FailureGold);`
  `        return false;`
  `    }`
  另 `MegaCrit.Sts2.Core.Entities.Potions/PotionUsage.cs:5-10`：`public enum PotionUsage { None, CombatOnly, AnyTime, Automatic }`——使用时机是数据声明、引擎执行的约束。
- 差距：BOSS 战禁逃规则的两处实现（文本 pattern + 结构化 flee）都只活在 itemUsability，而它仅被快照渲染消费；useItem/useBattleEffectItem/useStructuredBattleBag 全链路不复检，「该拒绝的时机」在引擎侧没有拒绝点。
- 建议修法：在 useItem 入口（或至少 useStructuredBattleBag 的 flee op 处）补 `itemUsability(card).usable === false` 即拒绝并提示 why，使战斗背包/拖拽/agent 三条通道同闸。

### G-2 | P4 | sellCard 不复检 stored——珍珠盒存放卡的销售拦截只在渲染层
- 本项目 `game/src/run/game.run.shop.js:276`（收购台渲染过滤）：
  `const sellableOwned = game.ownedCards.filter(owned => SDT.Cards.isSellable(owned.card) && !owned.stored);   // 珍珠盒中存放的资源卡不在此列出（2026-09-10 #29）`
- 本项目 `game/src/run/game.run.shop.js:412-419`（sellCard act，只查 isSellable 不查 stored）：
  `UI.act('sellCard', data => {`
  `  const index = game.ownedCards.findIndex(owned => owned.uid === data.uid);`
  `  if (index < 0) return;`
  `  const owned = game.ownedCards[index];`
  `  if (!SDT.Cards.isSellable(owned.card)) {`
- STS2 参照 `MegaCrit.Sts2.Core.Entities.Merchant/MerchantEntry.cs:70-75`（同 G-1 引文：引擎侧 wrapper 复检 IsStocked，渲染置灰不作为约束）。
- 差距：「存放中的卡不可卖」只由按钮不渲染保证，act 本身对 data-uid 直调不设防；当前 UI 无入口（商店页被背包 overlay 覆盖时点不到），属防御缺失非可复现漏洞。
- 建议修法：sellCard 内补一行 `if (owned.stored) return;`。

### G-3 | P4 | useItem 与 usePotion 门禁不对称（缺 viewingGrave/selectingDeck 两态）
- 本项目 `game/src/battle/bag/battle.bag.js:53`（useItem 5 态）：`if (busy || infusing || discovering || choosing || handSelecting) return;`
- 本项目 `game/src/battle/bag/battle.bag.js:362`（usePotion 7 态）：`if (busy || infusing || discovering || choosing || handSelecting || viewingGrave || selectingDeck) return;`
- STS2 参照 `MegaCrit.Sts2.Core.Entities.Potions/PotionUsage.cs:5-10`（同 G-1 引文：使用时机约束统一收敛，不因入口而异）。
- 差距：同一「使用道具」动作的两个入口门禁集不一致；drag（battle.aim.js:614 `useItemCmd(a.uid, hit.idx)`）与战斗背包 btUseItem（battle.overlays.js:165 `UI.act('btUseItem', (d) => useItemCmd(d.uid));`）走 5 态版。当前 selectingDeck 时药水栏不渲染（battle.engine.js:272）、查看墓地与背包 overlay 互斥，实际可达性低，故 P4。
- 建议修法：把 7 态门禁提为公共函数，useItem/usePotion 共用。

---

## 商店/经济域查证范围（未发现「钱货不一致」类缺口）
- 购买事务顺序与 STS2 同构：币检→容量→扣款→入包，全同步无中间态（game.run.shop.js:361-377）；STS2 对照为「先 FailureSpace 后 LoseGold」（MerchantCardEntry.cs:135-141）。
- 价显与扣款同源 slot.price；招财猫免费格 price=0 一致处理（game.run.shop.js:57,113,375）。
- 双买防护：slot.sold 在结算内同步置位，神秘货箱 2.6s reveal 演出期间重复点击被 `slot.sold` 早退挡住（game.run.shop.js:360,376,382）。
- 货架防刷落盘：shopStocks 进对局存档（game.session.js:171,344,455）且有存档校验（run-save-validation.js:32-36），D-1 审计结论成立。
- 面板去重：6 随机位 + 神秘货箱共用 panelTaken（game.run.shop.js:39-76），口径同 STS2 全面板 canonical 去重（MerchantCardEntry.cs:70-74 `_cardPool.Except(second)`）。
- buySha 容量走 canReceiveCard 统一口径（game.run.shop.js:397），初始牌补满有 sold 态（:119）。
- 卖出：isSellable/sellPrice 单一来源，先 splice 后加币再 saveGame（game.run.shop.js:420-425）。

## STS2 参照模式（供后续域借鉴）
1. 价格单一来源 + 读取期钩子：`MerchantEntry.cs:19-32` Cost getter 统一过 `Hook.ModifyMerchantPrice`；本项目为静态 PRICE 表 + 招财猫免费格，无价格随机浮动（STS2 `MerchantCardEntry.cs:124-127` 基价 ×NextFloat(0.95,1.05)，折扣 `_cost /= 2` 且恰一张 SetOnSale，`MerchantInventory.cs:100-111`）——设计差异非缺口。
2. 购买是引擎事务：失败原因枚举化（PurchaseStatus：OutOfStock/Gold/Space），顺序=查货→查钱→扣货→扣款→同步（MerchantEntry.cs:69-96、MerchantCardEntry.cs:135-141）。
3. 使用时机数据化：PotionUsage enum（None/CombatOnly/AnyTime/Automatic）+ 商店进货走 `PotionFactory.CreateRandomPotionsOutOfCombat`（MerchantInventory.cs:143）——时机约束集中在数据+引擎，而本项目散在视图层（G-1/G-3 根因即此）。

## 结论
3 条（P2×1，P4×2）。经济/商店域本体干净，未发现钱货不一致；最重的缺口在道具使用时序的「引擎侧拒绝点缺失」。遗物域无对应系统，未展开。
