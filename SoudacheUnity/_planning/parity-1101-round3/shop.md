# 补给站：本轮源码改进

状态：生产与原生检查源码已冻结，等待 Root 集中编译、领域与原生验收。本片没有编译、运行测试或启动 Unity。上一轮正常播放器基线 GUID：`a529e27adc834c58a21f47beebe94436`。

范围为 ShopScreen、CurrentShopView 各 partial、CurrentShopCommission/Carry/Coin 与对应 GameRuntime.ShopAcquisition。实际凭据命令位于 GameRuntime.Commission，本片只读，未获新增修改授权。沿现行 Vite HEAD `f966e85904` 的正式商店调用，不转译未完成变动。

## 已证实问题与实施合同

1. `CurrentShopView.Render` 每次交易和覆盖返回均清空整页，连带重建九个货位、卡面、ScrollRect 和详情；规则折叠也重造详情卡。现行 Vite `game.run.shop.js:534–590` 保留货架/详情并同步状态。本轮保留页面主体、货位、UID 卖品和详情卡，仅在卡面来源变化或神秘商品揭晓时替换相关面。
2. 头部 UsedSlots/BagCap 各查询全包，每货位重复查入包容量与持有数，详情再查同一商品。本轮每次真实刷新创建呈现快照，Query 一次、持有名计数一次；容量保留正式 CanReceiveCard 口径，每个 distinct 候选一次，详情复用，不近似推导 Grant 语义。
3. 旧详情按钮读取可变 selected，屏幕仅绑定 nodeId；源版命令绑定报价、UID 和页面生命周期。本轮固定 runtime/run/base/slot/seed/node、实际 receipt 报价与出售对象身份，按钮重绑时旧事件失效；保存通知后再校验来源，防止旧回调对新页交易、反馈或抢焦点。

已成交但 I/O 失败仍使用既有 retainAppliedOnSaveFailure：币/背包/货架/附赠保留，离店重试保存；业务拒绝和凭据 draft 仍使用各自既有回滚。规则、RNG 次序和 UID 生成不改。未删除文件或目录。

## 验收准备

新增 `Assets/Editor/CurrentShopRound3Checks.cs` 与 meta，入口为全局静态 `IEnumerator CurrentShopRound3Checks.Run()`，`Assertions` 和 `Step` 可读。完整执行预期 42 断言，其中 17 条来自实际 ISubmitHandler 提交目标的可用性检查，其余 25 条检查玩家结果与对象身份。使用现有隔离 profile 和正式 ShopScreen.Open；固定货架是受控夹具，不声称自然随机商店分布或物理键鼠输入。

覆盖保留货架/详情卡面/按钮/滚动器、规则折叠、背包返回、交易后原购买按钮转为“继续浏览”的焦点、旧按钮不购买新 selected、背包默认 I/O 回滚后首笔交易、同 UID 换 CardDef 后拒绝旧出售报价、整张 UID 出售和下一张焦点、失效 owner、SaveCompleted 观察者打开背包后不抢焦点、修改现时报价后不发卡/扣币/消耗 RNG/写盘。当前检查源码没有执行。

继续复用 `CurrentShopSourceValidation` 已有九货位/神秘隐藏/满包、已成交 I/O 失败保留、未保存离店重试、附赠队列与 RNG、凭据两骰/折扣 draft 保存恢复；本片没有把已成交 I/O 失败改成回滚。正常 Standalone 画面由 Root 重新构建后核对，前轮截图仅为改前基线。

## 实装结果与边界

- 市场和收购台惰性构造并保留，两者切换只切激活与更新事实。交易/返回不再 Clear 整页；头部币/容量行、详情购买价格行也保留并重算文本宽度。
- 货位按位置保留，出售项按实际 UID 保留。卡名、插画、类型/职业/稀有度、费用/运行期费用、伤害与解析说明组成当前卡面签名；签名或神秘揭晓状态变化才替换相应面。不会为了状态文字变化重建其它卡面。
- 一次真实刷新创建 `ShopFacts`：表头容量只 Query 一次，持有名称计数与出售列表一趟生成，容量 Fits 在该快照内按 CardDef 缓存。Fits 仍调用正式 CanReceiveCard，所以该部分保留每个 distinct 未售候选的完整扫描；没有宣称整页容量计算变成 O(N)，也没有近似处理资源扩展、半堆或 Grant 的规则。
- 来源校验绑定 runtime、RunState、Base、slot、seed、node 与 active/top owner；Buy 校验实际 receipt 引用及全部关键报价字段，Sell 绑定实际 OwnedCard 与绑定时的 CardDef 引用。保留按钮换整份事件并带局部版本，已捕获的旧事件不能转用新报价。
- 默认持久回滚会重新 populate nodeRewards/OwnedCard，因此背包覆盖返回先 ReloadStock，再重绑视图；避免 receipt 身份检查把回滚后的首笔合法交易误拒绝。成交后的保存通知改变 owner 时，只保留当前成交事实和未保存标记，旧页不再播放反馈、重绘或聚焦。
- 凭据 UI 使用同一 ShopScreen owner 守卫和按钮事件版本；交易/骰子/公告保存之后再检查归属。未修改 GameRuntime.Commission、GameRuntime.ShopAcquisition、公共 Kit 或前一轮属地。

## 性能依据与清理

原每次交易重建 9 个货位、货位卡面、选中详情卡面和 ScrollRect；现在保留来源未变的这些对象，状态文字/价格/可用性就地更新，神秘揭晓仅替换对应货位与详情面。出售从重建全出售目录改为增删对应 UID，存活 UID 仅更新事实与绑定。详情规则展开不查询库存、不创建卡面或滚动器。对象数量与源码路径是改进依据，尚未测量帧时间或分配数字。

持有数从每货位 ownedCards.Count 扫描改为一趟名称计数；表头两次容量 Query 收敛一次；详情复用该轮货位已计算的 Fits。快照不跨库存刷新缓存，持久化与 Grant 的正常成本保留。

删除了旧整页 Clear 重建路径、规则切换重造详情、重复未保存赋值、凭据 UI 重复的弱 node/seed 字段、零调用私有 Fill 和未用 using 等文本冗余；没有删除文件或目录，没有新增旧接口回退。

## 冻结清单

准确 10 路径与 SHA256 见 [shop-files.json](shop-files.json)：8 个既有 UI 生产源、2 个新增原生检查文件。`git diff --check` 对 8 个生产文件通过；仅有仓库现行换行转换提示。此静态结果不代替编译或原生通过。

集中原生第六次运行已进入 Shop，仅在 Fixture 的节点前置失败（`native-round3-6/result.json`，Reward54、Shop1）。查证为新检查误找首层 shop：现行 LayeredMapGenerator 配额首层为 fire，shop 在第二/第四层；既有 CurrentShopSourceValidation 同样选择第二层真实 shop。已仅将本检查改为从实际快照全层寻找 shop，并使用其 li/idx 设置位置；没有修改生产入口、制造 shop 节点或删除断言。42 条预期检查保持，等待 Root 重跑；这次修正没有自行运行。

第七次进入详情后，在无差别选择 ScrollRect 的检查前置失败（`native-round3-7/result.json`，Reward54、Shop3）。当前详情外层名为 `shop-detail-scroll`，CardFace 在 ScrollDescription=true 时还带自己的说明滚动器（CardFace.cs:105–109），所以 `.Single()` 假设错误。已将本检查三处详情滚动器获取统一改为按 `shop-detail-scroll` 名称选择；原对象身份、滚动位置与卡面保留断言全部保持。其余 Single 均已静态核对为明确按钮名、货架滚动器名或实际唯一 UID；未改生产，42 条计划不变，未自行运行。
