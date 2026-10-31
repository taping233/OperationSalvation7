# TODO-contracts（契约补充/裁决区）

各 writer 发现契约缺口时按 `## W{n}: 问题 | 建议方案` 追加在这里，协调者裁决后回填 00-contracts.md。

## 协调者补充（W6/W5 必须实现）

- `Sdt.UI.Kit.App.Launch()` — 静态入口（GameBoot 调用）。职责：建根 Canvas（Screen Space Overlay + CanvasScaler 1920×1080）+ EventSystem、调 `Sdt.View.BoardViewHost.Attach()` 挂地图相机、初始化 UiStack/Tooltip/AudioService、`GameRuntime.I` 预热、压入标题屏。W6 拥有。
- `Sdt.View.BoardViewHost.Attach(Transform uiRoot)` — W5 拥有。创建正交相机（专用 layer `Board`，建议 layer 8，代码里 `LayerMask.NameToLayer("Board")` 取不到就自建——直接用 layer 8 数值并写注释）+ BoardView 组件，接受节点点击/拖拽/滚轮输入，暴露 `FocusNode(string nodeId)`、`PanTo(Vector2)`、`FitAll()`、`SetRotation(int quarter)`（Q/E 旋转）、`FitPlayer()`（F 定位）。
- `Sdt.View.Fx` — 全局飘字/震屏/脉冲服务（对应 SDT.FX），W5 拥有，UI 可调用 `Fx.Float(Vector3 worldPos, string text, FxKind kind)` 与 `Fx.Shake(float strength)`。
- 字体兜底：`Theme.Mono/Sans` 加载失败（Res 返回 null）时回退 `Font.CreateDynamicFontFromOSFont("Microsoft YaHei", 14)` 或 `Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf")`，不许抛异常。
- battle.view 的敌人立绘/卡面图 key 全部走 `Sdt.Res.Res.*`；名字映射进 `_planning/asset-map.md`（W8 产出）。

## 协调者补充 2（W5/W6/W7/W9）

- **键盘分发**：W6 的 `App` 提供全局键注册表 `App.RegisterKey(KeyCode k, Action h)` / `UnregisterKey`，App.Update 统一轮询。W7/W9 的屏在 Build() 注册、Close() 注销。快捷键全集：Space/Enter 掷骰、Q/E 旋转、G 全景、F 定位、B 背包、N 结点编号、Esc 关闭当前页。
- **图标文本降级**：legacy Text 不支持 sprite 内嵌，`UIKit.IconText` 实现为"图标 Image + 文本"水平组合控件；`[[icon:xxx]]` 解析后拼成 (iconName, text) 片段序列渲染。
- **BoardView 事件回传**：`BoardView.OnNodeClicked : event Action<string nodeId>`（Sdt.View 不引用 Sdt.Run），由 App 桥接到 GameRuntime/UI。

## W3: Sdt.Run 对 Sdt.Core/W2 的依赖面（集成期对齐；W1/W2 落地时按此核对或反向调整 Sdt.Run 调用点）

- **MapData（mapData.js → W1）**，GameRuntime.BuildDerived/BuildEncounter 等用到以下成员，若 W1 命名不同请二选一对齐：
  - `static IReadOnlyList<LayerDef> Layers`；LayerDef 字段 `id,name,nameEn,inset,color,risk, entrances:int[], entranceNames:string[], doors:MapDoorDef[], altarEntrances:MapAltarDef[], cells:Dictionary<int,MapCellDef>`
  - `MapDoorDef { pair, at, toLayer, arriveAt, exit }`；`MapAltarDef { pair, at }`；`MapCellDef { type, n, name }`
  - `static List<GridPos> MakeRing(int inset)`（Count 可取）
  - `static Dictionary<string, MonsterTpl> Monsters`（`id,name,hp,atk,behavior,elite`）
  - `static List<EncounterDef> Encounters`（`pool:string[], size:int[2], risk, strategy, elite{pool,size:float[2]/int[2],chance,strategy}`）
  - `static AltarDef Altar`（`bosses: List<{id,name,hp,atk,behavior,affix,affixName,affixDesc}>`）
  - `static ItemsDef Items`（`wood/rations/key : ItemTpl{name,value,tier}`）
  - `static List<RandomEventDef> RandomEvents`（`w,coins:int[2],item,nothing,text`）、`static List<ItemTpl> ChestTable`
  - `static NodeLayout BuildNodePositions(int[] logicalCounts)`；NodeLayout `{ layers:List<List<NodePos>>, center:List<NodePos> }`，NodePos `{float x,y}`（Sdt.Core 禁 UnityEngine，故不能是 Vector2）
- **GameRules（rules.js 顶层别名）**：`DiceSides, StepMs, EmergencyExitCost, FireHeal, FireClassCardChance, PlayerMaxHp, PlayerAtk, BagSize, BagMax, BagUpgradeWood, SafeStart, SafeMax, SafeUpgradeRations, StashStart, StashMax, StashUpgradeWood, StashUpgradeSlots, StarterSha`
- **CardDatabase（W2 生成）** 需在 §3 契约之外补：`ById(string)`, `ByName(string)`, `ClassPool(cls)`, `RandomClassCard(cls=null)`, `SellPrice(card)`, `ShopWeights`(稀有度→权重), `IsRandomObtainable(card)`, `Classes`(职业表), `CardBacks`, `ShaId`(="builtin-sha")。
- **CharacterTable**：`CharacterFor/CharacterName/Characters/MigrateCharacterProgress`（BaseData/MetaProgress 用，MigrateRunCharacter 已由 W3 在 SaveSystem 内实现）。
- **Rng 流语义缺口**：原版 Random.random('dice'/'gameplay'/'enemy'/'card'/'event'/'audio'/'identity') 按流分流（snapshot 存 streams）；契约 §2 的 Rng 无流参数，W3 统一走单流 NextDouble()。若 W1 实现带流版本，建议给 Rng 加 `NextDouble(string stream = null)`，W3 改一行调用即可。
- **Sdt.Run.RunState 与 Sdt.Core.RunState 重叠**：契约 §2 把 game.store.js→RunState 划给 W1，但 §4 GameRuntime.State 需要含运行时字段（phase/pos/hop/chainMove…），W3 在 `Sdt.Run.RunState` 自持 schema §5 字段 + 运行时字段。若 W1 也建 Sdt.Core.RunState，请协调者二选一合并（建议保留 Sdt.Run 版，W1 删除或改为转发）。
- **BattleStartContext**：契约 §2 归 Sdt.Core.Battle；W3 定义了 `Sdt.Run.BattleRequest`（Foes/IsBoss/Layer/Name/Risk/Strategy/ReturnTo）并在 BattleRequested 事件里携带。集成期要么把 BattleRequest 映射到 BattleStartContext，要么 BattleSession.Start 直接收 BattleRequest。
- **基地数据落点**：base.js 的基地数据在网页版按档位存 localStorage 键 `sdt-base-v2-slot{1..5}`；W3 按契约 §5 收进 `sdt/global.json`，但**保留原键名**作为 global.json 的顶层键（`"sdt-base-v2-slot1"…"sdt-base-v2-slot5"`），保持按档位隔离与网页版迁移兼容。

## W3: 新增事件类清单（Bus，UI/View 订阅；RunEvents.cs）
RunStarted / RunLoaded / RollCompleted(RollResult) / NodeEntered(NodeResult) / BattleRequested(BattleRequest) / ShopOpened / ClassChoiceOpened / HubOpened(tab) / BagOpened / SaveCompleted(slot) / RunEnded(win|dead|abandon) / LogRequested(text,tone) / ToastRequested(text) / PlayerHealed / PlayerDamaged / ItemAdded / CoinsGained / CardGranted / PocketRestored / ExtractStashChanged(ExtractResult) / LevelUp / AchievementUnlocked。
（契约 §4 列的 ToastRequested 已实现；GameRuntime.NarrativeBridge : Func<CardDef,List<EventChoice>> 由 Boot 接 W4 NarrativeService，事件选项 effectKey 语义=game.run.js eventChoiceSpec effects 表。）

## W7: Sdt.Run/Sdt.Core 未定型 API 假设清单 | 局内/背包/图鉴界面已按下列签名调用，集成期请对齐（对齐方向二选一：实现侧补齐，或改 W7 调用点）
- GameRuntime 补充方法：`EnterLayer(int toLayer,int arriveAt)`、`OpenHub(string tab)`、`AddItem(string name,int n)`、`AltarBosses : IReadOnlyList<BossInfo>{id,name,atk,hp,affixDesc}`、`LeaveAltar()`、`GetNodeInfo(li,idx)`（layerName/nodeKind/n/hasDoor/doorExit/doorTo/hasAltarEntrance/entranceName）、`GetNodeNote/SetNodeNote(li,idx,text)`（§5 便签 sdt-cell-notes-v1）。
- BaseData：`BagCap()/SafeCap()/StashRoom()/StashUsed()/StashCap()/Deposit(inv)/DepositCards(List<PocketStack>,bool)/IsSha(CardDef)/Coins/CollectionCount/IsCollected(name)`。
- MetaProgress：`ClassLv(string):int`、`PerkText(int):string`。
- RunState UI 侧用到字段：`runActive/battleActive/bossCleanupPending/chainMove/pendingEventLoot/eventLog/elapsed(float)`；类型 `OwnedCard{uid,card,safe,brought}`、`PocketStack{card,count}`、inventory 条目 `{name,count,value,tier}`。W1 定型 OwnedCard/PocketStack 请落在 Sdt.Core。
- CardDatabase：`All/Sha/Potion/ClassPool(cls)/RandomClassCard(cls?)/SellPrice/IsSellable/RarityOf/Upsert/Remove`（Upsert/Remove = 自定义卡入库 sdt-cards-v1）。
- SceneCopy：`Scenes[kind]{icon,title,tone,btn,lines[],auto}`、`SceneMeta/EventSceneMeta : Dictionary<string,string[]>`。
- GameRules：`EmergencyExitCost/FireHeal/FireClassCardChance/StarterSha`。
- 事件类型：`ToastRequested(string)` 需带文案构造器；`BattleRequested` 需可字段初始化（isBoss/name/returnTo/preDamage）；`EventLogEntry{name,desc,turn}`、`PendingLoot{text,chests[]}` 由 W3 提供，否则移入 Sdt.Core。
- UIKit：`Scroll` 返回的内容根请自带 ContentSizeFitter 或等效（W7 假定向其 AddComponent<LayoutElement> 后可继续挂 Grid/布局）；W7 未依赖 UIKit.Row/Column（自带 UiExt.Row/Col 纯容器）。
- Sdt.UI.asmdef 需引用 Sdt.Res（契约补充 2 已要求立绘走 Sdt.Res.Res.*）。

## W7: 宝箱开启 UI 缺口 | 事件选项 chest_small/chest_medium 与物资箱格的「开真宝箱」当前只发 ToastRequested 占位，请 W3/协调者给出 Chests.open 对应的 UI 入口事件（建议 Bus.Emit(new ChestOpenRequested(chests))），W7 补渲染。

## W9: BattleSnapshot 及配套类型的字段形状 | 建议 W1 按下列形状实现（battle.view.js 已按此引用，编译期需对齐）
- `BattleSnapshot`：`Mode(string, "boss"/其他)、Turn、Energy、MaxEnergy、Busy(bool)、Opts(BattleOpts)、Player(BattlePlayer)、Pdef(PlayerDefense)、Pstat(PlayerStatus)、Foes(IReadOnlyList<BattleFoe>)、Hand/DrawPile/Discard/Grave(IReadOnlyList<string> uid)、Infusing(InfuseState)、Discovering(DiscoverState)、PendingTarget(PendingTargetState)、PendingHint(string)、ViewingGrave(bool)、DreadShown(bool)、DeckSelection(DeckSelectionState)`，可空状态为 null（对齐 JS getSnapshot()）。
- `BattleOpts{IsBoss,Strategy}`；`BattlePlayer{Hp,MaxHp,Atk,SpellPower,MyClass,CharacterId}`；`PlayerDefense{Shield,Armor,Guard(bool)}`；`PlayerStatus{Status(IReadOnlyDictionary<string,int>)}`。
- `BattleFoe{Id,Name,Affix,Hp,MaxHp,Atk,Dead(bool),Status(IReadOnlyDictionary<string,int>),Defense(FoeDefense),Intent(FoeIntent)}`；`FoeDefense{Shield,Armor,Guard(bool)}`；`FoeIntent{Icon,Label,Damage(int)}`。
- `Infusing{Uid,Card(CardDef),Need,Picked(IReadOnlyList<string>)}`；`Discovering{Options(IReadOnlyList<CardDef>)}`；`PendingTarget{Uid,Card(CardDef)}`；`DeckSelection{Need,StarterCount,Selected(IReadOnlyList<string>),Cards(IReadOnlyList<OwnedCard>),Boss(BattleFoe)}`。
- `IBattleCommands.PlayCard` 的 targetIndex 约定扩展：`-1`=自己（JS 'self'）、`-2`=未指定目标（JS play(uid) 无 target，即普通卡点击出牌）、`>=0`=敌人下标。W9 视图已按此调用。
- `IBattleViewApi` 已由 W9 追加两项：`AffixMeta(string affix)`（AFFIX_META）、`DmgTypeName(string dmgType)`（Combat.TYPE_NAME，无效 key 回落 fixed）——W1 需实现。
- UIKit 假设：`Panel(name,parent)` 返回带 Image 的全屏根或裸 RectTransform（W9 未在返回值上二次 AddComponent Image，若 Panel 不带图请保持裸节点）；`Row/Scroll` 不自带 LayoutGroup（调用方自加，与 W7 用法一致）。
- 战斗 SFX key 沿用 JS 同名（hover/click/victory/defeat/flee），经 `AudioService.PlaySfx`；若 §7 路径表 Audio/Sfx/Battle/ 下文件名不同请 W3 映射。
