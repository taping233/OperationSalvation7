# 独立交易页代理记录

状态：交易边界只读检查完成，等待根会话确认 UI 职责后实施。代理仅预留 `game/src/hub/hub.trade-shop-v5.js`、`tests/hub-trade-shop-v5.test.js`，不触碰仓库特写页脚、共享 CSS、共享流程记录；内置浏览器实页由根会话完成。

## 当前可复用事务

- `Base.purchase({ price, material, card })` 在扣款前检查有限非负价格、材料字段、商品、储备币和卡牌仓库空间；扣币与入库共用一次 `mutate`。口粮、木材购买直接进入物资字段，不占卡牌空间。
- `Base.sellStashCards(name, n)` 按卡名重读现行仓库堆，拒绝已收藏或材料卡，数量限制到当前堆数。减卡与增币共用一次 `mutate`。
- `Base.save` 拒绝未选档、事务占用、损坏/未来档、其他标签页修改及写盘异常。交易返回 `why: save`，运行态不被部分修改。
- `Cards.sellPrice(card)` 优先使用正 `value`；否则按有效稀有度半价，至少 1 币。`Cards.isSellable` 属于局内卡规则，不能直接用于基地货架筛选。
- 当前现货：穿刺/`tt3-skewer` 6 币、法杖/`tt3-staff` 6 币，口粮和木材各 4 币。直接复用 `HUB_SHOP_GOODS`，不扩大商品或改经济。
- 仓库特写额外禁止出售宠物蛋、经济卡包。传说、金币、彩色筹码、经济卡包为特殊收藏品；未发现独立珍品保护字段，保护依据为收藏记录。

## 建议职责

一个独立商店页，页内只保留“购入 / 出售”工作区切换。购入沿用现行 4 商品与 Base.purchase；出售只读当前仓库卡堆，隐藏材料、蛋、卡包，收藏卡以保护状态禁售。列表选择与右侧交易台同页，展示单价、持有数、单张和整堆收益。

每次提交前按稳定卡 ID 和名称重读堆；高价（单价 ≥ 5）、最后一张、整堆出售沿用 2.6 秒就地二次确认。切换选择、库存变化、切换工作区均解除确认；取消收藏仍通过现有收藏入口，不在商店暗改保护状态。

## 已核对证据

- `game/src/hub/base-economy.js`
- `game/src/hub/base.js` 保存、mutate、sellStashCards、collectToggle
- `game/src/cards/cards.rules.js` sellPrice 与 isSellable
- `game/src/hub/game.hub.pages.js` 现货与原特写事务
- `game/src/hub/game.hub.js` shopBuy
- `tests/base-mutation.test.js` 出售、购买保存失败不变与单次提交
- `tests/hub-pages-rework.test.js` 收藏保护、高价/最后一张确认、切换卡解除确认

未修改共享源码、未起服务、未运行构建、未提交。主会话负责优秀游戏参考与视觉系统，方案不替代实页验收。

## 实施与验证

状态：新交易模块、对应测试完成，源码冻结等待根会话集成。根会话已确认“交易所”页名、购入/出售两工作区、同页交易台；仓库只读预览另由根会话实现，旧特写页脚不改。

- 新 `hub.trade-shop-v5.js` 无根壳或 Base 静态依赖，通过端口复用现行经济命令。商品未变；不改存档格式、不转移收藏、使用或孵化职责。
- 购入、出售前重读当前资源和稳定卡身份。材料、蛋、卡包不列售出；收藏堆可预览但受保护。高价、最后一张、整堆二次确认；切堆、工作区、预览、数量/价格/保护变化均解除旧确认。
- 同名异 ID 卡的当前第一堆与选中身份不一致时拒绝售出，避免 Base 按卡名接口误卖。数组换序不影响正常交易。
- `createTradeShopState()` 返回 `{ mode: 'buy', goodKey: '', sellKey: '' }`。根壳换档重建；重绘/换页先调用 `bindTradeShopV5()` 返回的销毁函数，移除确认计时器、停用旧动作。工作区与选择仅属界面，不保存。
- 预览回调 `preview(card, { from, material })`；普通卡 material 为空串，物资为 wood/rations，全部只读。
- `notice(message, type?)` 使用纯文本；成功交易另调用可选 UI.log 和 sound.ding。外部仓库、扩建链接继续使用根 hubTab 动作。

验证：12 项新交易行为 + 18 项现行 Base 原子变更，30/30 通过（`agent-trade-tests.json`）；两文件 ESLint 通过，模块 `node --check` 通过。覆盖浏览不写盘、缺币/满仓、材料直入、收藏保护、单张/整堆/高价确认、计时过期、切换解除、售空刷新、报价变化、同名异卡、保存失败与销毁/换档旧动作停用。

未验：当前窗口真实买卖/视觉/返回路径由根会话集成后验证；未执行 build、全量测试、提交或服务操作。
