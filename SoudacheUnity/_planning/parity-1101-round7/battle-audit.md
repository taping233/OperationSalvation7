# 编组与牌堆只读对照

状态：2026-11-01 Round7 实施及检查源已写齐，等待 Root 集中验证；本片没有编译、测试或启动 Unity。下列前三节保留 R6 版本的初始源码依据和拟议范围，最终实际改动见文末。Round6 发布基线为 `d8a8a2eb`、GUID `c3ee3347a03149de80bbb7fe3f0bb5c2`。Vite 动作在途四文件没有作为本审计来源。

本片三类项已获 Root 批准实施：编组稳定帧重复布局、牌堆重复投影与返场焦点、牌堆缺失来源状态。公共卡面与 CardDef 单一运行时字段由 Root 明确分配本片；未改公共 UiStack 或 Root 持有的 BattleSubpages。

## 1. 编组稳定帧与选择刷新反复布局

`CurrentDeckFormation.cs:115–128` 在每个 `LateUpdate` 无条件调用 `Layout`；其中 15 次 `Set` 每次写 anchorMin/anchorMax/pivot/anchoredPosition/sizeDelta，共 75 次 RectTransform 属性赋值，另写 workspace 尺寸/位置、grid 列数/高度，并查询 confirm Text.preferredWidth、GridLayoutGroup、LayoutElement。页面稳定及详情覆盖期间也执行。这里仅统计代码调用，不声称每个 setter 都触发了 Unity 重建，更不声称 FPS 或整帧分配收益。

`Refresh:63–74` 对每次选/撤序列化完整候选池，重写选择状态，最后 `Canvas.ForceUpdateCanvases()` 后又 `Layout`；首次内容重建 `RebuildContent:107` 也调用 Layout。布局只依赖当前父矩形、确认文案宽度、网格对象/数量，不依赖经过全局 Canvas 强制刷新后的坐标。`_rulesOpen` 改变内容高度属于现有布局组职责。

建议仅改 `CurrentDeckFormation.cs`：缓存 Text/Grid/LayoutElement；首次挂载、池重建、确认文案宽度变化或父尺寸变化才布局，稳定帧只检查必要输入，不重复写；选中状态用本次 HashSet 避免 N×S 的 List.Contains。保留当前整卡池比较，不以可变 CardDef 引用相同代替卡面变化检查。取消全局 ForceUpdateCanvases。Source `battle.overlays.js:47–64` 已有 retained fast path，但其 `cardsHTML:33–44` 在 fast path 前仍整池生成 HTML，是无需照搬的重复工作。

该项已在 R6 `battle-audit.md:40` 明确延期；本轮没有把它记成新功能。建议新增真实组件回归：稳定若干帧几何不写、选/撤控件与滚动保留、规则展开与详情浏览返回、父矩形实际变化后布局及页脚可达。只写检查源，Root 统一运行。

## 2. 牌堆重复查询与返回焦点

当前正式入口是 `BattlePresentation.cs:234–237` → `BattlePileScreen.Open/BuildPile`，并非 `BattleSubpages.GravePanel` 的 Core 墓地页。`InputLocked:156` 拒绝 busy/待选/敌方/终局时打开牌堆，战场输入也有 Top 守卫。

`BattleSecondaryViews.cs:59–66` 对 N 个 UID 已计算 FindCard、EffCostOf、BattleDescription；造 S 个可见 stack 的 CardFace 又经 `Options:120–123` 重做三项。每次进入页面计 N+S 次来源查找/有效费/描述投影；每次详情浏览再做一组。FindCard 当前仍线性遍历 owned/granted，EffCost 在相应牌型下还可能读当前消耗堆。这里确证减少调用次数，不声称改变整个引擎的复杂度阶数。

另外 deck 分支明确 `group=false`，`CurrentBattlePileData.Build:36` 只用 UID 作 key，但上游仍为 N 个 Context 序列化 JSON；grave 分支则序列化、Parse、Canonical 再序列化。建议 `BattleSecondaryViews.cs` 保留一次本页卡面投影供网格/阅读器共用，deck 不建立无消费的 JSON。若调整 key 的类型，最小涉及 `CurrentBattlePileData.cs`，仍必须保留完整 effective card/rules/原费/描述状态，并只排序复制列表。

返场焦点是独立的现役差异：Source `battle.secondary-overlay.js:97,139–142` 捕获真实战场 opener，返回时验证同场与活跃后恢复 focus；`tests/sts2-pile-view-1021.test.js:136–147` 保留这一断言。Native `BattlePileScreen.OnClose:154` 仅 RestoreForeground；`UiStack.Close:113–137` 无焦点恢复。键盘/Submit 从 HUD 打开→在返回按钮提交或 Esc 后，当前没有把焦点交回原 HUD 入口的代码。建议 `BattlePresentation.OpenPile` 传原按钮、`BattleSecondaryViews` 保存 battle owner/token，只有返场 Top/会话仍一致且按钮仍活跃可交互时恢复；无公共 UiStack 改动，无新会话回焦。

已有回归可以复用其对应边界：`CurrentBattlePileValidation.cs:80–135` 验隐藏抽牌顺序、deck 逐 UID、grave 合堆、滚轮、详情浏览→pile 的当前项焦点与滚动、真实返回。它没有核 pile→battle opener 焦点，也未涵盖下一节来源状态。R6 当前窗口 formation/rules/pile 图和整链通过不替代本轮性能或状态专项证明。

## 3. 临时/变形来源状态被牌堆投影丢弃

Source `battle.overlays.js:12,87–103` 使用 `findEffectiveCard`；`battle.card-inspection.domain.js:53–65` 生成 `_presentation={uid,temporary,transforming,transformed,originName,baseCost}`；`battle.pile-view.js:9–15` 合堆 key 仅去掉 presentation.uid，其他状态保留。`cards.view.js:167–173` 实际显示“临时/随动变形/已变形”标签，最终 `card-layout-selected.css:288–289` / `battle-pile-view.css:100–103` 只停止牌堆光效，保留标签。现役测试 `sts2-pile-view-1021.test.js:22–28` 明确同卡面临时 99 张与永久 1 张分堆。

Native `BattleViewApi.FindCard:88–91` 只输出 UID/Card；`CurrentBattlePileData.Entry:14–20` 的 PresentationKey 由 CardFace.BattleDescription 构造，内容只有攻击、法强、星盘状态（`CardFace.cs:12–22`），不存在上述来源字段；CardFaceOptions/CardFace 无这些状态标签。合法情形是持有某张永久牌，又由实际发现/复制得到同卡面的临时牌，两者打出后同入消耗堆；当前同 CardDef 字段/费/星盘状态会合成一个 stack，失去到期来源辨别。无需改消费与战后账本，只修显示投影。

建议先由 Root 确认公共最小范围：Core Battle 的只读来源查询 → BattleViewApi/IBattleViewApi → CurrentBattlePileData/当前页 → CardFaceOptions/CardFace。仅 UID-free 来源字段参与 key，所有 UID 仍完整保留；状态不写回 CardDef/存档，不引入新的随机或兼容 fallback。原费还需保留 Source 的 `_baseCost` 语义；当前 CardDef 未保存该字段，不能仅用最新 cost 假称原费。该细节若本片纳入，应沿实际零费/逐回合降费/费用互换的赋值闭包一次核准，不能用目录样例推断所有卡。

## 本轮拟修改范围

- 无公共接口的性能/焦点闭包：`CurrentDeckFormation.cs`、`BattleSecondaryViews.cs`、`BattlePresentation.cs`，按是否需要纯 key 调整再涉及 `CurrentBattlePileData.cs`；新专用 Editor 检查。
- 来源状态需要另获明确接口属地：Core Battle 只读投影、Boot ViewApi、UI 接口定义、Run/CardVisual 与 CardFace。当前未修改，也未将其纳入已完成声明。
- 不改 Vite、不改规则消费/顺序/RNG、不修改公共 UiStack，不扩展到其余战斗方向。

## 最终实际实现（待执行验证）

1. `CurrentDeckFormation.Layout` 只在首次、真实父尺寸、池重建或确认文案改变时写几何，稳定 LateUpdate 只比较父矩形尺寸；缓存确认 Text/网格组件，删除两处重复 Layout、全局 ForceUpdateCanvases、Choice 无消费者字段。Refresh 用本次 HashSet 比较选中 UID。候选池仍按完整卡面序列化比较，没有用可变对象引用冒充内容身份。token/池重建递增内容版本，旧选择/详情回调拒绝；旧阅读器同帧关闭，正常选择和普通阅读仍保留父树/滚动。

2. `BattleSecondaryViews.BuildPile` 每 UID 一次正式 `CardPresentation`，构造 Context 后缓存供网格/阅读器共用；当前页的 reader cards 只建一次，Options 不再查卡、费用或描述。deck 不造 JSON；grave 用 JToken 直接规范化，去掉 JSON string→parse 往返。`CurrentBattlePileData` 继续含完整 CardDef/有效费/描述状态/原费/UID-free 来源状态；不改实际牌堆或 UID 次序。

3. `BattlePresentation.OpenPile` 传真实 `_draw` / `_consumed` 按钮与当前 BattleScreen。退出仅当同 battle token、原战场仍在栈且为 Top、按钮活跃可交互时回焦；不会跳到新场入口。reader 同时拥有该源守卫。SourceCurrent 读 UiStack.PanelAt，不新增每帧栈快照分配。

4. 新 `Core/Battle/BattleCardPresentation.cs` 从真实 owned/granted 和现有 cardOverrides 读取来源，返回 `Uid/Card/Temporary/Transforming/Transformed/OriginName/BaseCost/EffectiveCost`。不读 UID 前缀、不增加来源字典、不构造整场 Snapshot。所有实际变形写点在产生新 override 时捕获 printed cost，查询本身不扫全卡库。

5. `CardDef._baseCost` 是 `[NonSerialized] int?`：MemberwiseClone 保留；现有 SaveJson/导出不增加持久字段。正式 zeroCost 发现、Source semantic ids/types/expire 的零费克隆、逐回合降费保留费用历史；普通 acquire 的其他直发修饰仍按其 Source 分支，不泛化新增历史。费用互换第二张在现有克隆上记自身原费，保留原有 AddTempCard/FireAcquire/RNG 顺序，第一张沿真实原实体读取。变形从权威模板在实际写点捕获，不为 UI 查询重复全库查找。

6. Boot ViewApi 和 IBattleViewApi 只读转接；无需 BattleBridge 新命令。共同 CardFaceOptions/CardFace/CostTone 呈现静态来源标签、来源悬浮说明和原费对比颜色；接入真实手牌、编组、注能源牌/已选材料、正式 HUD 牌堆及其阅读器。初版误沿用只含 id/cost/desc/live费的旧手牌 key；Run 独审确认当前 Source `battle.hand.js:12–16` 已包含来源与原费，本批已统一修正，见下节。Source 状态呼吸光晕按 Root 确认采用静态状态标签替代，减少装饰更新；不将未运行的动效写成复刻通过。

## 独审修正与候选映射闭包

- `CurrentBattlePileData.EffectiveKey` 有 State 时移除内部 `_baseCost` 表达，以 State.BaseCost 事实参与身份，避免真实迷之匣第二张为保存原费而多带内部字段时被错拆堆。State 空的纯工具入口仍保留 `_baseCost` 差异。Native 检查实际迷匣在两张有效招式受控池中两轮都选择同一真实ID/费用，再经正式查询和数据投影核合并、原UID全部保留；catalog/custom providers 与原缓存引用在 finally 完整恢复，不写档。
- `BattleHandProjection.StackKey(BattleCardPresentation)` 是当前普通手牌/真实注能候选/数字键的共同来源 key：当前卡面身份、原始cost/desc、live费及 Temporary/Transforming/Transformed/OriginName/BaseCost。旧无State的纯工具重载保留其原合同；算法共用同一排序/展开实现，没有兼容回退或第二状态表。HandGroup 传递当次只读 State，避免合并后只查询首UID而掩盖其它来源。
- 真实注能先按完整来源组聚合，再移除 picked，保留组首UID被选走后剩余副本的原组序；快捷键仍包含已选真实UID并按同一组序展开。普通规则选牌继续逐UID原位，不套分组；库存UID/卡牌资格/数字输入命令不变。
- 仅 deckBottom 新增 `DiscoveringState/Snapshot.candidateUids`，对应最多3张显示候选，Snapshot 拷贝字符串列表；原保留/取消的全量 UID 闭包独立不变。Source 最终 `battle.view.js:362–371` 会按 deckBottomUids 再读有效源，Native 该映射让 Root DiscoverPanel 能使用现有 CardPresentation 呈现真正临时/变形/原费与live费。Core没有新增支付、选牌或退款路径。UI、Root检查与RootProbe由Root接线；本片不并写 BattleSubpages。
- 底牌回归状态由正式生成/变形命令产生，仅 UID 所处牌堆与底部顺序受控，真实挖掘宝藏后核映射、Snapshot列表拷贝/卡面引用、原UID选择、未选原序、源费及完整 RNG。Native 在真实发现页核标签/绿色0并通过真实Submit确认。未运行，不能当成已通过。

## 自然入口与旧 Grave 的边界

正式 Native HUD `_consumed` / `_draw` → `OpenPile` → `BattlePileScreen` kind grave/deck。消耗选集是 snapshot.ConsumedPile，由 `BattleItems.BattleConsumedPile` 合并 played/consumed/discard/grave，去重并排除 hand/draw/resolvingItem；与 Source `battle.consumed-pile.readConsumedPile` 一致。

Native `OpenGrave` 的生产自然 HUD 没有调用者；当前唯一 Boot 调用在 opt-in `NativeDisplayReview.Round6` 受控探针。Core/Bridge 公开命令仍可进入 ViewingGrave → GravePanel，属于保留命令通道与 QA 可达页。R6 的几何/HUD 修复及截图证明该受控通道，不能推成自然 HUD 的完整牌堆验收。本轮不删除或重写其 API/类，不把按名旧列表当作正式 HUD 的新差异；Root 持有该 Base 的必要维护。

## 已写检查源与集中复验入口

- 领域：`_planning/parity-1031/battle-check/Round7Checks.cs`，原 Program/csproj 已接 `CardPresentationChecks()`；静态计数新增32个Check，原492的相同完整流程预期为524。覆盖来源集合而非UID前缀、真实imitate→martial、zeroCost/两次decay/真实Mist费用互换、来源分组与实际注能选撤、底牌UID映射/费用/随机流、克隆/目录不变。未运行。
- 原生：全局 `CurrentBattleRound7Checks.Run()/Assertions`，静态预期74（46直接Check+14次Submit×2）。真实Bridge/会话、同名2/5费编组、稳定几何/实际父尺寸恢复、选撤控件与滚动、无同步全局Canvas强刷、阅读浏览焦点、永久/生成/零费三实体、普通手牌与注能来源分组/shortcut/组首撤回、底牌映射/实际标签与费用、迷匣同面合并、只读查询次数、阅读/两类牌堆返场、Esc/旧会话事件不抢焦点。卡牌前置用正式Session.PlayCard；交互用实际ISubmitHandler，非OS输入。组件父矩形局部变化不等于多尺寸窗口测试。未运行。
- 正常播放器：新增同类 partial `NativeDisplayReview.Round7Battle.cs` / `ReviewRound7Battle()`，Root 在主 driver 串行接入；此片未编辑主文件。准备 5 张当前窗口实绘：`player-r7-formation-selected`、`player-r7-hand-state`、`player-r7-consumed-provenance`、`player-r7-pile-reader`、`player-r7-pile-return`。BattleRequested/正式 PlayCard 构造已明确记录，与实际射线命中后的选编/打开自然消耗堆/阅读/返回分开；记录真实 UID、卡面成本/原费/来源及当前焦点。既有 Round6WaitForButton 有界读取真实命中就绪，后继仍 ClickNamed/ClickButton 严检，无跳过命中、OS 输入或窗口改动。战场两个真实按钮仅补语义名称 btDeck/btGrave，以便沿同一正式等待入口定位。待 Root 统一执行和人工看图，当前没有画面通过声明。
- 旧纯牌堆检查 `migration-1030-fidelity/pile/Program.cs` 仅适配 typed JToken 入参，并增加同有效 0 费、不同原费仍分堆的断言。其 data-check 项目引用旧生成的 Core csproj；执行前 Root 应刷新正式工程或把引用定向到当前生成工程，不能复用漏新文件的旧 Core 编译结果。
- 推荐复用原 `CurrentBattlePileValidation` 的隐藏抽牌顺序、真实滚轮及阅读器/前景恢复；相关 Core R3/R4/R6 自动批次、发现预览/取消与严格 Source oracle 仍需按 Root 集中门执行。正常 Standalone 建议查看选中编组、永久/临时并列的消耗堆及其阅读器，当前实际窗口验证标签不遮卡面与费用、返回不残留。不把静态调用削减写成 FPS/整帧分配收益。

精确文件与 SHA 见同目录 `battle-freeze.json`；生产与检查源一次冻结后停止编辑，只有 Root 集中门给出具体失败时再修。
