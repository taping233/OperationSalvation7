# 独立代码审查：保存、交易与商店委托

本轮找到的三项 P2 均已由作者修复，并经独立静态复核闭合；所查范围没有剩余可证 P1/P2，也未发现保存接口新增的重复发卡/附赠路径。最终复核的 CurrentShopCommission 指纹为 `a037e69d8f2407783c9fdbde2cfe11f65d9dac95483c15b1deca77cfaa014b34`。以下为静态代码结论，尚未执行原生玩家验证。

审查范围：`GameRuntime.Persistence`、`ShopScreen` 的 Buy/Sell/Leave/OnClose、`GameRuntime.Commission`、`CurrentShopCommission`，并追到实际使用的 SaveSystem/EventBus、当前商店视图与共享输入模块。未改生产，未编译，未运行 Unity 或前台工具。事件改装台与奖励整理器由另一位独立作者审查，本报告不重复其范围。

## P2-1：第一颗骰确认后的重试无法进入已预留的第二颗骰（增量已静态闭合）

触发步骤：第一颗骰已投出；点击“确认结果，继续”时，先保存固定结果成功；随后保存新预留的第二颗骰候选失败。故障解除后点击“重试并继续”。

Native 调用链：

1. `GameRuntime.Commission.cs:84` 先保存固定结果；`:93` 把第一格加入 `commissionSlots`；`:94` 调 `StartCommissionDice()`。
2. `StartCommissionDice` 在 `:74` 以 draft/retain 模式生成并保存第二颗骰。若这一步 I/O 失败，第一格、第二颗骰候选和消费后的 RNG 均保留；第二颗骰的 result 仍为 null。
3. 外层 `CurrentShopCommission.Mutate` 的原 delegate 是 `ConfirmCommissionDice`。`:72` 将失败页“重试并继续”绑回 `Mutate(run)`，因此故障解除后重复执行 Confirm。
4. 这次空保存可以成功，但 `ConfirmCommissionDice:87` 检查到当前第二颗骰尚未投出，又返回 commission-retry；失败页仍绑定 Confirm。重试页不能进入已有的第二颗骰投掷页。暂离并重进可以绕开，故列 P2。

源 `shop-commission.js:129-134` 在第二颗骰候选保存失败时将恢复动作指向 `next`；`next` 重开已有 diceStep，而不是确认尚未投出的骰子。源没有这个重试循环。

建议：区分“确认结果保存失败”与“接受第一格后，为下一轮预留失败”。后者重试保存后应调用 Start/next 并呈现已预留的第二颗骰，保持原候选与 RNG。不要给第二颗骰自动投点。

增量复核：`CurrentShopCommission` 候选指纹 `8527e45782683ff989e958a7d45e9196ab3d80c8a083d6a154827deeff1055f7` 已在 failure 分支识别 slots=1 且当前 die.result 尚空的状态，将重试指向 StartCommissionDice。Start 不再 Reserve 已存在的候选，保存成功即进入原第二颗骰；本缺陷静态闭合，仍需集中原生注入第二次写失败验证。

## P2-2：委托页重绘丢失键盘焦点（普通路径增量已静态闭合）

触发可不依赖保存故障：进入委托投骰页，点击“点数与结果”折叠按钮，然后尝试用方向键/Enter 继续；或完成开始/投骰/确认导致阶段重绘。

`CurrentShopCommission.Clear:25` 调 `CurrentNodeElements.Clear` 将 Body 子物体失活并销毁。`Render:35`、`Failure:95-97` 重建全部按钮。该类、`CurrentNodeScene.Complete:69-78` 及 `UIKit.Btn:37-61` 均不恢复被替换控件的焦点，也没有新阶段首操作兜底。`Update:131` 在覆盖页返回时同样直接 Render。

实际安装的是 `App.cs:53` 的 StandaloneInputModule。当前包代码 `StandaloneInputModule.cs:471` 在 selected 为 null 时拒绝 submit，`:540` 将方向导航发送给当前 selected，没有为这次页面重绘选择新控件。因此旧按钮失活/销毁后，键盘无法选择新阶段动作，需要鼠标重新点击。尚未用原生播放器点验，属于可从现行调用链确定的键盘恢复缺口。

源同阶段 `shop-commission.js:62-66` 使用 syncViewChildren 保留控件；阶段改变则 `UI.showOverlay` 经 `overlay.js:163-172` 重新选择当前页首焦点。建议复用现有商店按按钮名称回焦的机制：同阶段恢复原规则/操作，切换阶段选择当前可用主操作；从覆盖页返回也恢复原按钮。

同一增量加入 RememberFocus，重绘前按名称记录，在 Complete 按名称及阶段首操作恢复并调整滚动位置；一般规则折叠、换阶段、UiStack 覆盖返回的焦点路径已静态闭合。下面的反馈覆盖层例外尚需处理。

## P2-3：投骰结束时新回焦代码会抢占右键反馈输入（增量已静态闭合）

触发：非减弱动态模式下点击“投掷骰子”，在 1.25 秒动画结束前右键打开试玩反馈并输入文字。SuggestionBox 只挂在 App.UiRoot（MenuDialogs.cs:147-150），不压 UiStack；CurrentFeedbackComposer:64 已把输入焦点放到反馈正文。

此时 UiStack.Top 仍为 ShopScreen，CurrentShopCommission.Live 仍为真。动画结束回调调用 Render，而上述增量的 Complete 无条件 SetSelectedGameObject 到底下的 eventDiceContinue。反馈输入被取消选择，接着 Enter 能通过底层按钮的 Live 检查确认骰子。遮罩只拦指针，不隔离此次键盘提交。

源 menu-feedback.js:99 调用 bindDialogSurface；dialog-surface.js:12-17 对背景施加 claimInputIsolation。overlay.js:164 看到 inert 的背景 overlay 即跳过新的自动聚焦，因此源在这里保持反馈输入所有权。

建议：将 SuggestionBox.IsOpen 纳入委托的覆盖状态与返回检测；覆盖期间不抢焦点、不发送底层操作。动画回调应无论是否可见都先清 busy，然后仅在当前可见时 Render；关反馈后恢复已保存的原骰子结果和正确操作焦点。只给 Complete 增加不聚焦条件会遗漏反馈关闭后的恢复，因为反馈没有改变 UiStack.Top。

最终增量复核：上述 `a037e69d…4b34` 版本的 Live 显式排除 SuggestionBox，Complete 先检查 Live，Roll 动画回调总先清 busy 再判断是否 Render，Update 的 covered 同时包含反馈层。反馈打开期间不会对底层 Render 或接受动作；动画结束后关反馈，下一 Update 在相同固定骰子结果上重绘并恢复 Continue 焦点。初审三项至此均静态闭合，没有据此声称原生 probe 已通过。

## 已核对的保存与交易边界

| 条件 | 静态结论与依据 |
|---|---|
| SaveCompleted 与 I/O 失败 | 只在 `CommitTransaction()` 成功后由 Persistence:37-38 排入延后队列。retain 失败分支没有发该事件，普通失败取消整个延后队列 |
| 默认保存失败、动作异常 | Persistence:53-59 取消存储事务和观察者，恢复 State/Base/RNG 等快照；applied=false。retain 也只在 mutation 已完成且为 IOException 时成立 |
| retain 保存失败 | Persistence:42-50 保留已完成的交易或骰子草稿，只交付普通观察者。EventBus.CommitDeferred:20 逐观察者捕异常，排除了观察者异常打断 applied 返回的疑虑 |
| 购买、出售 | ShopScreen:171/212 仅交易动作使用 retain；不适用/容量不足/物品过期走 applied=false。出售的嵌套 TryDiscard 属于外层事务，异常传播给外层统一回滚 |
| 失败后离店 | ShopScreen:137 只用空 mutation 重试保存；成功后才关闭。没有再次调用 GrantCard/ReserveShopAcquisition/TryDiscard |
| 神秘阿猫附赠 | ShopScreen:181 在同次购买事务中预留；失败保留预留和已售标记。后续重试保存、离店及待领取入口均不重新 reserve，不会因此生成第二份礼物 |
| 普通返回与 OnClose | 当前返回按钮和 Escape 均经过 Leave；正常离店先设 _departed，OnClose 不再重复 FinishNode。系统菜单的保存退出先成功 SaveCurrent 再切换标题，失败保持原面板 |
| 两颗已确认后优惠保存失败 | Confirm:93 先加入第二格，Apply 的原子快照在此之后，失败回滚 price/free/used 而保留两个 slots/dice；再次 Confirm:82 直接 Apply，无第三颗骰 |
| announced 单独保存 | 只在两格已应用后的故事页显式操作中保存；失败默认回滚 announced，优惠及两格仍保留；同店 used&&!announced 可恢复故事页 |
| 商店详情/出售列表回焦 | CurrentShopView.SaveBrowse/RestoreFocus 保存语义名称，出售后有同 UID/相邻按钮和返回商店兜底；详情关闭恢复原货位。未发现本次交易接口破坏这些路径 |

## 没有升级为玩家缺陷的差异

- 对已失效引用直接调用 Buy/Sell，或外部直接 `UiStack.Close(shop)`，可以绕过视图入口/Leave；本轮没有找到普通生产按钮或 Escape 走该旁路，因此不据直接函数调用列 P2。
- Source 对货物使用对象 quote，Native 货架保存 cardId。若外部在挂起商店期间用同 ID 修改卡库，可能影响实际取得的定义；本轮未证实可达的玩家修改路径，也没有扩大检查制作坊。
- 共享 picker 的空字符串 typeFilter 是原有保留差异，商店生成不传该参数，不属于本次 Persistence/Commission 接口回归。
- 委托壳当前实际是 `.pg.node-pg.sc-shop`，没有 `.shop-pg`，因此其原节点商店背景不能直接按主商店新背景替换。对照了源 event-dice.css 的 660px/85vh 单列容器与现场 UseCommissionLayout；未执行画面验收，不宣称逐像素一致。

## 集中原生验证建议

1. 分别对普通购买、出售、神秘阿猫购买制造一次保存失败：检查 applied 状态、币/包/售罄/礼物预留只变一次，SaveCompleted 未发；解锁后只重试保存离店并继续领取一次礼物。
2. 分开命中“第一颗固定结果保存”“第二颗候选预留保存”“第二颗固定结果保存”“两格优惠保存”“announced 保存”的失败点。尤其第一颗确认后的第二次写入失败，应在原第二颗候选上继续；两格已选时绝不能投第三颗。
3. 点击或键盘展开规则后，用方向键与 Enter 完整走 Start→Roll→Confirm×2→Story→EnterShop，并从覆盖页返回，检查所选控件仍属于可见当前页。
4. 在投骰动画中右键开反馈，等待动画结束，继续输入并按 Enter，检查骰子仍未确认；关反馈后下一帧应回到同一骰子结果的 Continue，点击后只接受一次。

报告以指纹记录的实际代码为依据；最初商店冻结清单之后的 CurrentShopCommission 三项修复已增量复核。CurrentShopCarry 同期由其他作者调整，不在本次保存/委托审查结论内。集中原生验证由 Root 统一执行，静态结论不替代真实输入和保存失败注入。
