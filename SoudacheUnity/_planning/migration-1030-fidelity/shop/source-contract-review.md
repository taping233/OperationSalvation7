# 当前商店：源码实现对照（2026-10-30）

最终成品补查：Root 的 `desktop-final-player-1` 真实画面仍显示金币像小粒、货位价格折为两行。本轮只重开商店专有呈现，新增 `CurrentShopCoin` 复用原 `Res.Ui("coin")`，将占位与原图的1.7倍居中绘制分离，主店/检视/收购台六个实际消费者分别接48/36/30/28的原占位；没有放大全局金币、替换资源或改变交易。货位价格改为原单行coin/value/unit；同一offer无owned行时state居中，双行仍保留9/36位置，已由独立审图及active CSS共同确认。此增量仍待 Root 统一重建后的实际画面复核，前一快照的流程通过不充当本补丁画面通过。尺寸、来源和修前图见 `coin-source-contract.json`。

| 活跃金币消费者 | 占位 / 内部原图（逻辑像素） | Native接线 |
|---|---|---|
| `.shop-resource.coin > .shop-coin-icon` | 48 / 81.6 | `shop-resources` |
| `.shop-v14-price .shop-coin-icon` | 36 / 61.2 | `CurrentShopOffer`单行价格 |
| `.shop-sellpost > .shop-coin-icon` | 36 / 61.2 | `openSell`独立图标 |
| `.shop-buy-price .shop-coin-icon` | 30 / 51；左右margin各4 | 详情操作左/价格右 |
| `.sell-ledger-total .shop-coin-icon` | 36 / 61.2；gap8 | 收购合计独立数值行 |
| `.sell-item-offer b`内默认金币 | 28 / 47.6；gap5 | 卖出可得左/报价右 |

当前补给站呈现已改用现行 `game.run.shop.js` 与 `expedition-shop.css`；商人键盘穿越、规则焦点、凭据失败恢复及覆盖层回焦问题均已按独审修正。凭据完整流程和明确的成交动效已接齐，交易保存失败改用 Root 的显式店内保留模式。生产与正式Editor probe均已冻结供统一原生验证；本记录不以类型检查或截图数量宣称整体一致。原 Web 源码只读。

| 现行 Source 入口 | Native 对应 | 行为差异、处理状态 | 最小验证 |
|---|---|---|---|
| `game.run.shop.js renderShop`；`expedition-shop.css .shop-layout/.shop-board-grid` | `CurrentShopView.Render/BuildMarket/LayoutMarket` | 旧 3×3 内联买卖页已换现行左26/右74、5列2行、商人五句对话、商品检视、独立收购台；背景不再作为 VerticalLayoutGroup 的布局子项。 | 静态核5列约束、双行高度、背景独立层；真实播放器效果由 Root 统一复核。 |
| `slotHTML` → `shopInspect` → `shopDetailHTML` | `CurrentShopOffer.Build` → `Inspect` → `BuildDetail` | 点货架只检视，不交易；不足金币/满包也可检视，详情购买禁用并写理由，满包有原背包入口。神秘未售不建真实卡面、不暴露真实名称。 | 对照可交互条件和内容分支；已备 Editor probe，尚未原生运行。 |
| `setShopInspectionBackdrop`；`patchDetail` | `BuildDetail/SetMerchantInteractive/FinishCloseDetail` | 已修独审两P2：检视期间货架及商人均不可交互，merchant回调额外守卫；规则开关重建恢复原action焦点，初开才聚焦关闭。页头/返回地图不被禁用。 | 检查 merchant 所有按钮 false、三个回调守卫、详情精确名称回焦；无需截图判断。 |
| `captureShopBrowseState/restoreBrowseOnFrame`；`openSell/backShop/shopOpenBag` | `SaveBrowse/RestoreFocus/Render/Update` | 主店与收购台各存滚动和action；保留详情选中/长规则/详情滚动、收购规则；卖出UID消失后回相邻出售按钮。背包返回重建当前页，再恢复状态。 | probe备有主店↔收购台、收购台→背包、满包详情→背包；未原生执行。 |
| `renderSellPage`；`createShopCommands.sell` | `BuildExchange/Sell` | 源是每UID出售×1，无批量卖。已移除 Native 额外 `safe!=true` 过滤，标签对应安全格；保留stored/pouch过滤与既有TryDiscard。源pouch内容进入时stored=1，正常状态过滤等价。 | 静态确认TryDiscard本身允许safe、唯一UID守卫；probe备实际TryMoveSafe→出售失败回滚→解锁重试。 |
| `openShop(stockKey)`；`generateShopStock` | `ShopScreen.Open/GenerateStock`；专人维护的 `CardLibrary.PickOfRarity` | **抽取时点一致**：首次开店立即抽出神秘格，并存入按节点复用的货架；检视/购买不重抽。此前发现的过滤、按类型而非逐卡权重、拒绝采样和随机流差异已交 RNG 专人修复，当前生产已接其冻结代码；本商店视图代理未修改该区域。 | 逐语句Source132-188与新GenerateStock/PickOfRarity；独立差分证据归 `../shop-rng/`，本清单不替代该代理的源码验证结论。 |
| `shop-commands.js buy` 调 `prepareAcquiredReward` | `Buy` 的 `slot.mystery` 守卫 → `ReserveShopAcquisition` | 附赠条件已核并修：**只有神秘货箱买中 tt2-apollo** 才预留附赠，不是任何货位阿猫。购买、币、售出状态、loot/reward抽出的附赠一起留在既有事务；领取交给CurrentNodeRewards与ChestOpenScreen。 | probe改为第8神秘货位受控阿猫；检查失败时无卡/币/货架/queue半笔成交，重试只预留一次。 |
| `shop.js buy成功的Chests.restore回调`；`scenes.js resumeChestsOnCell` | `Close` 商店 → `ChestOpenScreen.OpenPending(null)` → 既有 `FinishQueue/TryPrepareCurrentRewardContinuation` | **领取完返地图，不自动返店**。待领暂离后再进节点，源 `game.run.flow.js214` 优先恢复pendingReward；Native `ShopScreen.Open` 也先恢复同队列。待领期间不先展示商店，原shopStock仍保留；领取/放弃完成后再进商店看到同一售出货架。 | 检查shop Close/FinishNode不会清shopStock/queue、HasPending守卫与receipt完成路径；probe备续领ID不变、领取重复调用拒绝、再进店售出状态保留。 |
| `tradeReceipt/persistShop/closeShop`；`shop-commands.js execute/buy/sell` | Root的 `TryPersistMutation(...,true,out applied)` + Shop `_unsaved/Leave` | **旧原子适配决策已撤销，现已改具体源行为**：动作生效后仅I/O失败时保留本局币/卡/货架/附赠/RNG，返回值仍代表保存成功，applied另示成交。未保存时离店再保存失败阻断；保存成功只落盘，不重复交易/抽取，再续领附赠。动作自身异常仍回滚，默认其它调用仍原子回滚。Main/Commission/ESC均接Leave。 | 核Source commit→save与Native retain条件；正式probe覆盖默认原子失败、动作异常（含动作抛IOException）、失败CardGranted一次/SaveCompleted零次、无悬挂事务、锁文件Buy/Sell留存、失败离店阻断、解锁只保存、附赠保存后才开箱；尚未原生执行。 |
| `shop-commission.js renderStart/dice/story`；`commissionEligibleSlots` | `GameRuntime.Commission`；`CurrentShopCommission`；`CurrentNodeScene.UseCommissionLayout` | **完整阶段已接**：不再排除神秘格，骰子与兑付清单均用“神秘货箱”保密；初开只绑定保存，点击开始才预留/复用现有EventDie；两次确认后应用两格免费并进入文字兑付清单（不领取卡牌），单独保存 `commissionAnnounced` 成功才进货架。applied未announced重进直接回清单，pending重进先开始页再复用原骰。新专用视图使用既有NodeScene的显式居中单滚动模式和IllustratedDice，默认节点布局不变。 | Source `shop-commands.js commissionEligibleSlots`、`shop-commission.js18/98/125`、`event-dice.js` 与 Native `Bind/Start/Roll/Confirm/Apply/Announce`；reserve/roll已接显式retain，正式probe备完整阶段、精确写失败断点与键盘submit；尚未原生执行。 |

此前独审确认的呈现细节已补代码：Inspect立即更新当前格金底与下沿，Close清理选中，不再残留；免单格从同节点已兑付凭据显示原金框；神秘卡在240ms塌缩后，720ms停留区间的前320ms按原Bezier从scale(.4)/alpha0显形，再560ms飞行，抵达后用原10帧decayOsc采样做420ms背包回弹，移除替代该演出的额外奖励receipt。以上是参数和调用链对照，尚未原生实绘验收。

凭据保存边界：绑定与announced保持原子失败回滚；确认先保存既定骰结果，再把选中slot加入本局草稿；apply的事务快照取在slot加入之后，因此失败回滚价/free/status但保留两格选择及骰结果，重试只apply而不投第三次。候选与roll单独标记draft，已接Root显式retain接口，失败时保留本局候选/结果/RNG。

独审修正的精确恢复点：第1确认checkpoint成功后，第2die reserve保存失败会留在slots1/dice2/result=null。该阶段retry只走StartCommissionDice重开既有die2，不能再Confirm；probe用SaveCompleted回调在checkpoint成功后立即锁文件，断言解除锁后可投第2die，候选与RNG不变。

凭据重绘按button.name恢复同一操作，缺失时选择当前阶段的开始/投骰/继续/兑付/重试动作，并将其滚入现有viewport。覆盖状态同时包含UiStack与非栈SuggestionBox；骰子动画回调总先清busy，仅真正可见才重绘，反馈关闭后下一帧恢复当前骰子。正式probe使用selected+submit走到die2，并在投骰中打开真实反馈组件，验证输入框不被夺焦、submit不确认底骰、关闭后回Continue。独审对该增量已回看闭合，原生输入尚未运行。

凭据背景按实际消费者区分：`shop-commission.js:59` 的root没有`.shop-pg`，不命中1011覆盖；现行 `scenes.css` 明确让它使用既存scene-shop-anime-v2及node-pg的单横向暗幕（42% .12、66% .55、100% .82）。UseCommissionLayout保留该已有NodeScene背景，只切换此源渐变；主商店/收购台仍用1011批准图。没有把有旧文件名的仍active消费者静默替换。

## 两份现行素材

来源与输出SHA256、尺寸及解码像素一致性见同目录 `assets-receipt.json`。现行消费者为 `expedition-shop.css:12` 的1011场景与 `game.run.shop.js:23-24` 的1025问号卡背。没有生成或重新设计图片，没有改全局旧映射、背景资源或BGM。

- `merchant-approved.png`：1659×948，1,784,954 bytes，大于1MB，不进git。
- `mystery-back.png`：768×1152，959,424 bytes。
- 两者保留原像素，Default textureCompression=0，Standalone override=false继承Default，maxTextureSize=2048覆盖原尺寸，enableMipMap=0；不改无效Standalone字段。

## 验证边界

本轮由本代理执行代码契约对照与必要类型检查。正式probe在 `Assets/Editor/CurrentShopSourceValidation.cs`；检查脚本直接引用该Assets文件，不再引用planning副本，二者同步。本代理未启动Unity、未构建播放器、未运行原生probe、未操控前台、未更改Source、未提交。Root随后已确认包含最后共性读卡note的全生产类型检查与原生Unity编译成功，代码依赖闭合；真实画面、实际输入、故障流程仍待Root统一原生probe验收。

最终金币呈现增量已冻结：独立审查确认六入口的占位/1.7绘图与nowrap接线、单行居中均匹配active CSS；唯一末次全生产私有类型检查exit0、0error/10warning。没有启动Unity或Player。Root统一实绘仍须核header行右对齐、低币/满包长操作文字与右侧价格不相撞，及六处金币实际大小；此前旧快照流程通过不替代本增量实绘。
