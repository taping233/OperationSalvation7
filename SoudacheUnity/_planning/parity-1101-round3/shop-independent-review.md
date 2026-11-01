# 商店第三片独立审查

2026-11-01，Battle 作者只读复核 Run 作者的商店片。结论：在本片报价归属、回滚重绑定、保存观察器切页和保留页面调度中，未发现需要退回修正的确定生产缺陷；可以进入 Root 集中验证。没有编译、运行测试、启动 Unity 或修改生产文件。

读取 `shop.md`、`shop-files.json` 的8个生产源及各自当前 diff；8个文件原始 SHA256 均与冻结清单一致。另只读正式 `GameRuntime.Persistence.cs`、`GameRuntime.ShopAcquisition.cs`、`UiStack.Close`、现役 Vite `game.run.shop.js` 与新增原生检查源码，用于验证合同和验收范围。

## 已核实的源码合同

- 购买按钮捕获固定 index/ShopSlot，`ShopScreen.cs:165-179` 同时核 `_stock` 对象身份、节点 receipt 引用、卡 ID、价格、免费/神秘/补充计数、已售/空位。详情没有继续使用可变 `_selected` 作为旧按钮的成交目标；`CurrentShopAction.Bind` 换事件且增加版本，旧事件不能套用新报价。源版同样在实际成交前复核 quotedSlot，再通过 transaction 兑现。
- 出售按 UID 保留对象，但每次刷新绑定当前 OwnedCard 与 CardDef；`ShopScreen.cs:210-222` 在正式事务内要求唯一 UID、原 OwnedCard/卡面引用、未存放/未进容器及现行可出售条件。`CurrentShopView.Exchange.cs:35-49` 更新同一 UID 控件，替换卡面时更新来源；删除仅禁用/销毁对应 UID。没有把同名卡当整叠出售。
- 默认 I/O 回滚通过 Populate 保留 RunState/Base 根对象，却可能替换内部 nodeRewards/OwnedCard；商店身份绑定与之兼容。`RefreshStockView` 先 ReloadStock，覆盖返回再 Render 重绑 receipt 与按钮，修复旧内部对象阻断回滚后首笔合法购买的问题。商店自己的业务拒绝后也 ReloadStock/Rebuild。该结论是来源校核，实际文件锁复现仍待运行。
- 已成交 I/O 失败继续采用 `retainAppliedOnSaveFailure=true`；未保存标志与持有物/币/货架保留，离店保存失败不离页。`Buy/Sell/Leave` 在保存后再次区分 OwnsShop 与 ShopActive；观察器打开背包后不再播放旧页成交反馈或聚焦，返回后更新事实。凭据 Mutate/Roll/Announce/RequestLeave 同样在保存后重查 Live，骰子回调还要复核当前 owner。
- 两页按首次入口惰性构造。`Render` 先用 `_renderedExchange` 保存旧页浏览状态，再构造目标页，将 `_boardScroll` 切成该页专用 ScrollRect 后才 Layout 和恢复位置（`CurrentShopView.cs:44-93`）。因此首次市场→收购与返回没有把市场 ScrollRect 传给 LayoutExchange 的顺序问题。卖品、九货位、详情卡面和 ScrollRect 的保留位置与刷新事实分离；规则展开仅更新文字/激活与布局。
- 详情刷新先停止旧协程，恢复 alpha/scale/interactable，再按需进场；关闭只隐藏保留详情，并仅在 Current 时把焦点交回商品。覆页期间有限动画可以结束，但完成点不能抢覆页焦点。购买携带动画只在 ShopActive 时推进，失去 owner 时释放；已作用于目标按钮的弹动在销毁时复位。

## 验证边界

新增 `CurrentShopRound3Checks` 确实包含实际 ISubmitHandler、保留对象、详情滚动、规则折叠、旧事件、同 UID 换卡面、业务拒绝、文件锁回滚后首笔购买及 SaveCompleted 覆页检查；源码准备不代表它已通过。本审查不以先前商店截图或既有绿测替代新检查。

市场/收购台各自滚动值在源码中独立保存；现有新检查主要断言详情滚动值、货架 ScrollRect 身份与页面往返，未直接对两个目录的非默认滚动数值做完整往返断言。Root 若本轮需要该行为的运行证据，可在集中原生验收补实际滚动后往返；此处没有发现需修改生产调度的证据。

未评定整个商店所有素材/布局、自然随机货架分布、真实键鼠/设备听感或其它模块；未新增框架、兼容回退或审批要求。
