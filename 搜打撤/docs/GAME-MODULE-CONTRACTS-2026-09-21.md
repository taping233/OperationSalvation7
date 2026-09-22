# 《搜打撤》改造模块契约与派发顺序

版本：v1.1｜2026-09-21｜Friday｜制作人：老板

执行边界修订：本轮只做 Vite。下文 M12 的 Electron/EXE 条款是早期范围，当前已冻结，不在夜间授权执行包内；不得据此恢复桌面维护。当前 M12 收口以 `modules/R7-INTEGRATION-PLAN.md` 的 Vite 实机与本地反馈为准。

R0 审计修正：职业卡方向采用老板明确的“可带入、不可作为实物带出”。v1.0 的相反条款错误，不能作为验收依据；运行时代码尚未迁移。禁止带出后职业收藏的合法获得入口、安全格与珍珠盒的失败例外尚待制作人决定，不能以通过旧测试代替迁移。详见 `modules/R0-RULES-AUDIT.md` 与 `LINEAR-EXECUTION-2026-09-21.md`。

承接：[整体改造策划](./GAME-TRANSFORMATION-PLAN-2026-09-21.md)。本文把方案拆为可分别派发、分别验收的工作包；不表示这些接口已经实现，也不表示已经启动开发任务。首批产品目标仍是：**一个连接真实收藏、家具和人物成长的 2.5D 基地。**

## 1. 契约如何使用

每个模块约定：交付范围、输入、输出、数据写入权、依赖、异常处理、独立验收和接入验收。模块按责任划分，不等于一个文件，也不按模型或岗位划分。

接口是拟新增的 ESM 门面，使用 JavaScript＋JSDoc 即可；下文类型记法只用于说明，不要求迁移 TypeScript。先给当前逻辑加小范围适配，禁止为满足命名重写整个工程。原有 `Battle.commands` 等稳定接口优先复用。

**两种验收分开标记：**

- **模块通过**：用固定输入和替身依赖验证输出、错误及数据变化；可以不等其他模块完成。替身必须遵守本契约，不能自行虚构另一套字段。
- **接入通过**：用真实依赖走完对应流程。模块测试通过不等于已经接入，更不等于玩家认为好玩。

任何执行任务必须交付一个玩家能观察的变化，或一个下游能直接使用并验证的产物。纯重构、纯文档、纯截图不能冒充整个功能完成。

## 2. 模块总表与优先级

| ID | 模块／主要责任 | 玩家获得什么 | 第一包范围 | 原任务映射 |
|---|---|---|---|---|
| M01 | 存档与提交边界／程序 | 装修和成长不会重开消失或重复扣款 | 五档兼容、新增字段、基地单次提交 | B2、B3、C1 的支撑 |
| M02 | 收藏与人物成长／系统＋程序 | 收藏能转化、展示，知道人物下一项奖励 | 既有收藏转换、成长结果、皮肤保存 | B3、C1 |
| M03 | 家具与空间布局／系统＋程序 | 购买、摆放家具，展示已收藏内容 | 6 家具、1 房间、2 展位 | B2 |
| M04 | 视觉与 UI 资产规范／UI＋美术 | 基地和功能页看起来属于同一款游戏 | 四页样张、房间与家具资产包 | A2 |
| M05 | 2.5D 基地交互／客户端＋UI | 进入可操作的基地，快捷整理和出征 | 灰盒→正式资产、5 热点及全旧功能入口 | B1 |
| M06 | 收藏目标与出征准备／系统＋UI | 知道下一局追什么，快速选择投入 | 3 追踪目标、2 预设、实际带入核验 | C1 |
| M07 | 战斗规则与决策信息／战斗程序＋策划 | 出牌代价与目标可信，理解敌人威胁 | 已知修复、有限预览；后续 2 组遭遇 | A1 的战斗项及策划第 6 章 |
| M08 | 角色动作与反馈／技术美术＋程序 | 人物有真正可复用的动作表现 | 1 人待机＋攻击，绑定源与实机接入 | C2 |
| M09 | 地图路线／关卡＋程序 | 路线提供不同目标和风险 | 2 组分支模板，新局生成、旧局恢复 | D1 的地图部分 |
| M10 | 短剧情与持续后果／叙事＋程序 | 一次选择能改变后续事件和基地记录 | 1 链、3 段、2 个阶段结局 | D1 的叙事部分 |
| M11 | 对局结算与既有缺口／程序＋QA | 收获、损失与永久记录结算可信 | 成功／死亡／放弃分开验证，已知反馈缺口 | A1 的流程部分 |
| M12 | 集成、试玩包与反馈／集成＋QA | 拿到可以独立打开并反馈的版本 | 选定模块接入、Electron 包及反馈入口 | E1 |

**先做 M04 样张、M05 灰盒和 M01 最小存档边界；随后接 M02、M03，交付基地样板。** M07、M11 的已知问题作为有限支持线。M06、M08 在基地样板后进入；M09、M10 再后进入。M12 的集成记录从第一包开始，打包放在选定版本收口时。

## 3. 所有模块共同遵守的接口

### 3.1 身份、快照、命令与结果

```ts
type SlotId = 1 | 2 | 3 | 4 | 5;
type Id = string; // 必须使用稳定 ID；显示名、数组序号不是 ID
type Version = number; // 某作用域的状态修订号，不是程序版本或 schema 版本
type Context = { slotId: SlotId; requestId: Id; expectedRevision: Version };
type Failure = {
  ok: false; code: string; message: string;
  retryable: boolean; details?: object;
};
type Result<T> = { ok: true; value: T; revision: Version } | Failure;
type DomainEvent = {
  eventId: Id; type: string; slotId: SlotId; runId?: Id;
  revision: Version; payload: object;
};
```

- 查询返回不可变快照，不能返回可任意修改的 `Base.data`、库存对象或战斗私有状态引用。
- 所有写命令返回 `Promise<Result<T>>`；下文省略重复的 `Promise`。纯查询不写档、不消耗 RNG、不发奖。
- `expectedRevision` 对应目标作用域：基地用基地修订号，战斗用战斗修订号，对局用对局修订号。跨作用域命令显式传 `expectedBaseRevision`、`expectedRunRevision`，不能拿一个修订号假装覆盖全部。
- 同档位、同命令、同 `requestId`、同参数重试返回同一结果，不再次执行；同 ID 换参数报 `REQUEST_ID_CONFLICT`。先识别已完成请求，再检查过期修订号。新的一次主动购买／收藏必须生成新 ID。
- 基地经济命令和跨局奖励的完成记录随结果持久化，支持重启后重试。记录清理策略须在实现中注明；不能靠页面按钮禁用冒充幂等。战斗命令的重复保护限于当前战斗会话；读档按现行稳定检查点恢复，不恢复动画中间帧。
- 无效命令不得扣钱、扣卡、推进剧情或留下半成品。写入失败返回 `SAVE_FAILED`；只有持久化成功才发布“购买完成／收藏完成”事件。UI 可显示未提交的摆放预览，但必须能取消。
- 统一基础错误：`INVALID_ARGUMENT`、`NOT_FOUND`、`STALE_REVISION`、`REQUEST_ID_CONFLICT`、`INVALID_STATE`、`SAVE_FAILED`；模块再补业务错误。`STALE_REVISION` 要求刷新后让玩家确认，不能自动重放消费。
- 事件用于刷新和演出；奖励在命令内完成。不得监听 `collection.committed` 后再扣一次卡或再发一次经验。事件至少包含具体变动 ID 和数量，不只写“数据有变化”。

这些是目标保证。现有 `Base.save()`、`Meta.onCollect()` 等有内部保存行为，不能仅套一层函数就宣称满足“失败不扣款”。适配时必须消除该命令范围内的中途保存，或提供可验证的恢复方案。

### 3.2 固定数据形状

```ts
type CardRef = { cardId: Id; variantKey?: Id }; // 变体按现有堆叠规则区分
type StackRef = { stackKey: Id; card: CardRef; count: number };
type CollectionView = {
  card: CardRef; registered: boolean; ownedCount: number;
  characterId?: Id; canConvert: boolean; sourceIds: Id[];
};
type Placement = {
  instanceId: Id; furnitureId: Id; zoneId: Id;
  x: number; y: number; rotation: 0 | 90 | 180 | 270;
}; // x/y 为逻辑网格；旋转只允许该家具配置存在的方向
type DisplayRef = { kind: 'collection' | 'memorial'; refId: Id };
type AssetSpec = {
  assetId: Id; path: string; width: number; height: number;
  pivot: { x: number; y: number }; // 0..1 的归一化图像坐标
  layer: string; sourcePath?: string; fallbackId: Id;
};
```

`stackKey` 是适配器提供的稳定、可重验引用；不要求为全部历史库存重建实例系统。收集、带入等操作必须在执行时重新查库存；无法唯一确定某堆叠时返回错误，不能凭卡名猜。

### 3.3 领域数据所有权

| 数据 | 业务规则唯一负责人 | 其他模块允许做什么 |
|---|---|---|
| 现有收藏记录、人物经验／奖励、选择皮肤 | M02 | 读快照，调用收藏／换肤命令 |
| 家具拥有量、实例位置、展位引用 | M03 | 预览布局，提交布局命令 |
| 追踪目标、出征预设 | M06 | 读取或提交设置命令 |
| 卡牌战斗效果、战斗 RNG 与状态 | M07 | 读战斗快照，发送现有战斗命令 |
| 地图拓扑、已走节点、路线版本 | M09 | 查询可走节点，通过地图命令移动 |
| 剧情进度、选择、已领取结果 | M10 | 查询条件，通过故事命令选项推进 |
| 出征扣除、结算入库、对局关闭 | M11 | M06 发起出征，其他模块读结算收据 |
| 序列化、迁移、落盘与提交记录 | M01 | 各业务模块交付校验后的变更；无业务模块另写 localStorage |

业务数据变更由所属模块构造；实际持久化由 M01 负责。跨模块事务由发起命令协调，例如 M03 买家具同时扣现有储备币，必须一次提交；M02 收藏同时扣库存、登记收藏和加经验。禁止给 UI 暴露“任意 patch 存档”的接口。

## 4. M01：存档与提交边界

**范围与归属：**程序负责。适配 `base.js`、`game.storage.js` 及必要存档接线；首包只覆盖 M02、M03 所需的基地写入。M06／M10／M11 进入时再补对局跨键事务，不先建设通用数据库。

**输入：**当前五档存档、缺字段旧档、领域模块生成的校验后变更、新增字段默认值。**输出接口：**

```ts
readBase(slotId): Result<BaseSnapshot>
readRun(slotId): Result<RunSnapshot | null>
commitBase(context, preparedChange): Result<CommitReceipt>
commitRun(context, preparedChange): Result<CommitReceipt>
commitTransition(context, expectedRunRevision, preparedChange): Result<CommitReceipt>
// preparedChange 仅供领域模块使用；包含 beforeRevision、afterState、events、commandIdentity
// receipt 包含 requestId、baseRevision/runRevision、eventIds；绝不包含渲染对象
```

新增基地字段分组为 `home`、`appearance`、`goals`、`story`；已有收藏、经验、仓库继续作为唯一真源，不能复制到新分组。字段默认值、版本迁移和未来版本拒读策略由本模块登记。版本不在本文盲目指定为 3，实施时根据已有迁移链确定。

**依赖与异常：**不依赖任何 UI。存储适配器可替换为内存或注入写失败的测试实现。跨基地／对局两个键不是天然原子操作；必须以可恢复提交日志或等效方案处理，不能连续两次 `setItem` 就宣布事务成功。无法恢复时保留原数据并明确报错，不静默初始化空档。

**独立验收：**

- M01-A：用现有 v1／v2 样本和缺新增字段样本加载；原资源、库存、收藏及进行中对局不变；连续迁移两次结果相同。
- M01-B：档位 1 写入家具后，档位 2～5 原始内容不变；标题页无选档写命令报错。
- M01-C：模拟存储写失败，返回 `SAVE_FAILED`，内存与重载后库存、钱和布局均保持提交前状态；重试仅成功一次。
- M01-D：同请求重启后重试不重复扣款；过期新请求报 `STALE_REVISION`；同 ID 不同参数报冲突。
- M01-E（跨键扩展时）：分别在日志建立、基地写入、对局写入后模拟中断；重启后恢复到一致状态，无双份入库或重复开局。

**接入验收：**真实旧档完成购买、收藏、重开，结果一致。首包通过 A～D 即可服务基地，不等 E 才开始做界面。

## 5. M02：收藏、成长与外观

**范围与归属：**系统策划＋程序。承接 `game.hub.js` 的收藏回调、`meta.js`、`art.js`；把业务操作提到可独立调用的门面。现有经验、等级、里程碑及既有皮肤可用性不改变。

```ts
getCollection(baseSnapshot, cardCatalog): CollectionView[]
getCharacter(baseSnapshot, characterId): CharacterView
convertCollection(context, { stackKey, count }): Result<CollectionReceipt>
selectSkin(context, { characterId, skinId }): Result<AppearanceView>
// CollectionReceipt: consumed[{stackKey,count}], firstRegistrations[],
// xpChanges[{characterId,before,after}], rewards[], newUnlocks[]
// CharacterView: level、xp、nextReward 或 maxed、selectedSkinId、availableSkinIds
```

**输入：**真实库存、卡牌及人物配置、既有永久记录。**输出：**上列视图、精确转换收据、`collection.committed`／`appearance.changed`。**写入：**通过 M01 同时完成库存消耗、永久记录和成长；不能由 M05 或演出监听器补发经验。

**依赖与异常：**依赖 M01、现有卡牌／人物配置；缺卡 `INSUFFICIENT_CARDS`，不可收藏 `NOT_COLLECTIBLE`，皮肤未解锁 `LOCKED`。缺贴图回退默认图，不取消已选皮肤或删除拥有记录。

**独立验收：**

- M02-A：同种职业卡两张，先收藏一张，再以新请求收藏另一张；库存 2→1→0，首次记录只增加一次，经验两次均按现行规则增加。
- M02-B：重试第一次请求不再扣卡／加经验；材料不足的批量收藏整笔失败，不部分消耗。
- M02-C：先登记收藏、再失去全部同种实物；登记记录仍可用于展示，展示不能兑换成实物或出征战力。
- M02-D：重复触发里程碑不重复发奖；等级到顶的返回值明确，不出现虚构的下一等级。
- M02-E：已有皮肤仍可选，选定后重载保持；未知皮肤 ID 报错，缺单场景素材按清单回退并标明适用范围。

**接入验收：**基地收藏后人物和展位立即刷新；批量转换只显示合并反馈；退出重开保持一致。

## 6. M03：家具、布局与展位

**范围与归属：**系统策划＋程序。新增家具目录与纯布局校验，首包 6 件家具、1 房间、2 展位；使用现有储备币，不新增货币或战力加成。

```ts
getHome(baseSnapshot, furnitureCatalog): HomeView
validateLayout({ placements, roomSpec, ownedFurniture }): ValidationResult
buyFurniture(context, { furnitureId, quantity }): Result<PurchaseReceipt>
saveLayout(context, { placements }): Result<HomeView>
setDisplay(context, { displaySlotId, ref: DisplayRef | null }): Result<HomeView>
// FurnitureSpec: id, priceCoins, maxOwned, allowedRotations,
// surface('floor'|'wall'|'table'), footprint, assetIds
// ValidationResult: valid, violations[{instanceId, code, cells}]
```

**输入：**现有钱、家具拥有量、逻辑网格、M02 永久收藏视图；后期接受 M10 纪念物 ID。**输出：**购买收据、布局／展示快照和 `home.changed`。**写入：**只管 `home` 与本次购买扣币；收藏与剧情记录只读。

**依赖与异常：**依赖 M01、M02 只读查询；可用代用矩形代替正式图。`INSUFFICIENT_FUNDS`、`PLACEMENT_OUT_OF_BOUNDS`、`PLACEMENT_OVERLAP`、`INVALID_SURFACE`、`UNOWNED_INSTANCE`、`DISPLAY_NOT_UNLOCKED`。桌面物品必须有合法支撑，移走支撑物时整笔拒绝并给出原因，不能让物品消失。地毯等允许重叠关系由配置说明。

**独立验收：**

- M03-A：固定币值 C、单价 P；买一件后 C−P、拥有量＋1；同请求重复不变，新请求可按上限再买；不足时两者都不变。
- M03-B：合法布局保存后重载一致；越界、非法旋转、冲突及超拥有量均返回具体实例和原因，旧布局不变。
- M03-C：未买家具不能摆放；取消预览不会消费或落盘；展示已登记但实物为 0 的收藏合法。
- M03-D：设置／清空展位不改变卡牌数量、经验或战力；未登记收藏不能展示；没有购买任何家具时旧基地功能全部可用。

**接入验收：**在 M05 用鼠标完成买→摆→取消→重摆→保存→重开，空间与库存一致。

## 7. M04：视觉、UI 与可接入资产

**范围与归属：**UI＋美术。沿现有 painterly、人设库、字体和颜色语义制作，不另起画风；先交样张，再制作确定方向的素材。

**输入：**M03 家具尺寸／网格规范、M05 热点与遮挡需求、真实卡名／数量／错误文案、现有角色权威素材。**输出接口为文件与清单：**

```ts
VisualPack = {
  version, roomSpec, assets: AssetSpec[],
  uiTokens, componentStates, previewPaths, sourcePaths
}
// roomSpec: 逻辑区域边界、网格到画面的投影、遮挡层与热点安全区
// componentStates: default/hover/focus/disabled/loading/error/empty
```

交付四处 UI 样张（基地、收藏、备战、战斗提示），一间分层房间、6 家具及角色比例样张；透明图边界、脚底轴心、家具占地、层级、文件 ID、尺寸及缺图回退写入 manifest。路径通过现有 `art.js` 接入，不散落硬编码。角色动作拆件归 M08。

**依赖与异常：**只需冻结接口和固定数据，不等游戏模块完成。不写经济和存档；未定人设用已定视觉内容或环境元素，不补写成正式设定。缺资产可用明确标记占位物，不能把占位验收成正式美术。

**独立验收：**

- M04-A：所有 manifest 路径存在，尺寸／透明边缘正确，pivot 在合法范围；源文件可编辑；六家具能分别导出，不能只有一张合成房间图。
- M04-B：在项目 1920×1080 缩放基准及 1280×720 视口合成检查；真实长卡名、空仓库、满仓库、缺钱、未解锁状态可读且不遮挡主要操作。
- M04-C：房间图上标得出五热点及商店、升级、成就等旧功能入口；点选区域不会被前景家具完全挡死。
- M04-D：制作人确认样张方向；交付清单区分已选正式素材、候选和占位，不以自动检测代替审美验收。

**接入验收：**M05 实际加载同一包，检查 `winter.css` 最终级联、全局缩放和实际遮挡；静态样张通过不代表实机通过。

## 8. M05：2.5D 基地场景与交互

**范围与归属：**客户端＋UI。PixiJS 沿用项目锁定版本；DOM 面板承载复杂列表。只负责表现、输入及生命周期，不能直接修改 `Base.data`。

```ts
mountHome({ host, view: HomeSceneView, assets, onIntent }): HomeController
HomeController = { update(view), setActive(boolean), dispose() }
HomeSceneView = { home, character, collectionDisplays, resources, revision }
HomeIntent =
  | { type:'openPanel'; panel:'deploy'|'stash'|'shop'|'upgrade'|'characters'|'collection'|'pets' }
  | { type:'previewPlacement'; placement }
  | { type:'submitLayout'; placements; expectedRevision }
  | { type:'selectDisplay'; displaySlotId; ref }
// onIntent 由应用接线层转给领域命令，并把 Result 返回 UI
```

**输入：**M02／M03 的只读视图、M04 资产；首包允许替身数据与灰盒。**输出：**一室场景、五热点、快捷面板入口及上述意图。意图是“请求”，必须等业务成功才更新已保存状态。

**依赖与异常：**缺图降级；WebGL 不可用时保留 DOM 基地功能入口。使用现有缩放坐标转换、自绘提示和遮罩隔离规则。隐藏、进战斗及卸载时停止场景更新，解绑监听，不把多个画布和音效叠在一起。

**独立验收：**

- M05-A：替身记录每个热点和快捷键发出的意图，两种入口指向相同面板；旧功能无遗漏。
- M05-B：在两种视口点击家具与热点，视觉位置和命中位置一致；面板打开后背景不会误触。
- M05-C：模拟消费失败，保留已保存布局并显示原因；拖放取消无写命令；不同修订号更新不会留下旧选中引用。
- M05-D：连续进入／退出 10 次，画布、监听器与 ticker 数量回到初始值；`setActive(false)` 后没有基地逐帧更新；无 WebGL 仍能打开仓库并出征。

**接入验收：**真实档完成“入库整理→收藏→展位变化→买家具→摆放→出征”；首位角色可先复用现有帧，不等待 M08。

## 9. M06：目标、来源线索与出征准备

**范围与归属：**系统策划＋UI／程序。最多追踪 3 项、两套可编辑带入预设；“猛攻／跑刀”是可改名字的准备方案，不增加一套强制玩法模式。

```ts
getSources(targetId, catalogVersion): SourceInfo[]
setTrackedGoals(context, { targetIds }): Result<GoalView[]>
savePreset(context, { presetId, name, characterId, petId, picks }): Result<Preset>
previewDeployment({ baseSnapshot, preset, mode }): DeploymentPreview
startDeployment(context, { presetId, mode, expectedRunRevision }): Result<RunStartReceipt>
// picks: [{card:CardRef,count}]
// SourceInfo: sourceId, kind, conditions, evidenceRef, certainty('known'|'unknown')
// DeploymentPreview: resolvedPicks, missing[], forbidden[], costs, lossRuleSummary, canStart
```

**输入：**M02 收藏／人物状态、真实库存与卡池来源配置；后期接 M09 路线、M10 线索。**输出：**下一局目标、来源提示、缺卡／禁带说明和投入清单。**写入：**自身只写追踪与预设；实际扣卡、创建对局必须调用 M11 出征命令。

**依赖与异常：**首包不依赖新地图／新剧情。无可靠来源显示“来源未确认”，不杜撰掉率。预设可保存缺货的愿望配置；合法拥有的职业卡按老板规则允许带入，离局不能作为实物带回。当前运行时仍有旧禁带逻辑，迁移未完成前此项不能标为接入通过。开局前再次核验库存，不默默换成其他卡或悄悄减少数量。

**独立验收：**

- M06-A：第 4 个追踪目标返回 `GOAL_LIMIT`，前三项不变；重复目标去重；切档隔离。
- M06-B：库存足够／缺 1 张／全部缺失分别给出准确预览；合法职业库存允许带入并提示离局损失，不以职业稀有度直接禁带；打开预览 10 次不扣卡、不变随机状态。
- M06-C：预览后库存改变，再出发返回修订号或库存错误；同请求重试只产生一个 runId。
- M06-D：来源线索每项能追溯到实际卡池／事件条件；受条件限制的来源不能展示成必得；首版所有展示来源逐项核对。

**接入验收：**玩家能选择目标、改预设、理解缺卡，完成两种不同投入的合法开局；皮肤保存由 M02 提供，不另写一份。

## 10. M07：战斗结算、预览与遭遇

**范围与归属：**战斗程序＋策划。复用现有快照和 `Battle.commands`，先核对双镖与注能修复归属；第一包只提供确定的直接伤害、护盾和状态预览，复杂效果明确降级。普通消耗战、首脑循环牌库、龙巢差异保留。

```ts
getBattleSnapshot(): BattleSnapshot              // 适配已有入口
previewAction({ snapshot, action }): ActionPreview
executeAction({ battleId, requestId, expectedRevision, action }): Result<ActionReceipt>
ActionPreview = { legal, costs, targets, certainty:'exact'|'partial'|'unknown',
                  knownEffects, unknownReasons, warnings }
ActionReceipt = { actionId, consumed, resolvedEffects, events, nextRevision }
// action 映射现有命令；不能另建与 Battle.commands 并行的第二套结算器
```

**输入：**卡牌稳定 ID、目标 ID、注能材料、当前战斗状态与随机流。**输出：**一次权威结算、供 UI／动画使用的结果事件。**写入：**只写战斗作用域，战利品与对局关闭交 M11；演出不得通过命中回调再次造成伤害。

**依赖与异常：**规则与合法性查询独立于 DOM／Pixi；预览不得偷偷试运行真实 RNG 或修改快照。`INVALID_TARGET`、`INSUFFICIENT_COST`、`BUSY`、`STALE_REVISION`；指定目标死亡后按该卡既定规则处理，不能无依据转移后续效果。

**独立验收：**

- M07-A：双镖第一段杀死目标时，另一敌人不会获得错误流血；不注能不执行纯注能体；取消材料选择不支付；每项绑定实际卡 ID 与固定场景。
- M07-B：确定性预览与结算逐字段一致；重复预览不变 RNG／库存；随机、连锁类无法精算时显式返回 partial／unknown。
- M07-C：重复点击同命令只付一次费用、移动一次卡；不合法命令不变状态；普通和首脑分别验证卡牌去向。
- M07-D：关闭、跳过或加速动画后最终规则状态一致，且能继续下一次操作。
- M07-E（后续遭遇包）：交付 2 组复用现有行为的敌人组合、意图及奖励配置；同一初态记录两种合法行动顺序及资源／受伤差异，不仅修改血量。

**接入验收：**实机完成目标选择、注能、取消、1×／2× 行动及一次首脑战；遭遇的决策价值另记试玩观察，不用测试通过证明好玩。

## 11. M08：骨骼制作、动画与音效反馈

**范围与归属：**技术美术＋客户端。第一包一名角色待机＋攻击；提供真正可编辑的拆件、绑定与动作源，导出接现有序列帧播放器。更多受击／防御／胜利动作另包，不默认换运行时。

```ts
AnimationPack = { characterId, skinId, sourcePaths, toolVersion,
  actions: { [actionId]: { frames:AssetSpec[], durationMs, loop,
                          visualMarkers, fallbackAction } } }
playPresentation({ actionId, actorId, targetIds, receiptId, speed,
                   reducedMotion }): Promise<PresentationResult>
// PresentationResult: completed | skipped | fallback；不返回伤害或奖励
// visualMarkers 只驱动闪光、声音、镜头，不是规则结算时点
```

**输入：**M04 比例／pivot 标准、角色正式素材、M07 已确定的行动收据。**输出：**动画源文件、导出帧清单、动作播放器适配、现有音频系统的事件映射。**写入：**仅表现状态，不写卡牌、生命、经验或存档。

**依赖与异常：**可用固定行动收据独立制作；基地主流程不等待此模块。关节遮挡补画、分件及权重属于交付，整图摇晃不算绑定。缺帧、切后台、卸载和减少动态效果均须结束当前表现请求，不把战斗永久留在 busy。

**独立验收：**

- M08-A：另一执行者能打开源文件，改一个关节姿势并重新导出；全部帧有明确顺序，超过旧探测上限也能按 manifest 加载。
- M08-B：待机循环连续，攻击前后脚底轴心一致；关节不出现明显裂缝或穿插；两种倍率下可辨认攻击。
- M08-C：缺帧／卸载／隐藏／跳过分别返回结束结果，无悬挂请求；同 receiptId 不重复播放关键音效。
- M08-D：有动画、无动画两次相同行动规则结果完全相同；旧角色帧和静态兜底继续可用。

**接入验收：**真实战斗里并排记录旧、新动作效果，由制作人决定扩量／调整／放弃路线。贴图替换和动作完成不能冒充规则已验证。

## 12. M09：地图分支与恢复

**范围与归属：**关卡＋程序。保留四层主图和现有龙巢定位，在现有事件槽引入 2 组路线模板，不扩层数、不夹带修改撤离费用。

```ts
generateRoute({ seed, generatorVersion, worldConditions, routeCatalog }): MapSnapshot
getRouteOptions({ mapSnapshot, nodeId, goalIds }): RouteOption[]
restoreRoute({ savedMapData, supportedVersions }): Result<MapSnapshot>
// RouteOption: nodeIds, knownNodeKinds, riskHints, sourceIds, conditions
// MapSnapshot: stableNodeIds, edges, layerEntries, exits, generatorVersion, seed
```

**输入：**种子、版本、只读剧情条件和目标线索。**输出：**稳定图结构、可理解的路线提示、事件触发点。**写入：**地图相关对局字段通过 M01；不直接发剧情奖励。新生成器只影响新局。

**依赖与异常：**M10 条件可用固定布尔样例替代；基础路线不能依赖某条剧情已解锁。当前 `save-format.md` 含“按当前生成器重建”的历史描述，与本次“进行中不洗图”的目标不同；实施必须核对真实加载代码并补版本恢复／已生成拓扑持久化方案及文档，不能宣称当前已经满足。

**独立验收：**

- M09-A：固定 100 个种子检查入口至终点连通、层间及首脑／祭坛约束，必要节点可达；数量不被支路意外放大。
- M09-B：同种子、版本、条件重复生成输出一致；运行期间重载节点 ID、边和玩家位置保持一致。
- M09-C：缺剧情条件仍能完成基础路线；两组模板各提供可复现种子、不同目标与实际奖励池依据。
- M09-D：新版本加载旧进行中对局不洗图；未知版本不可静默重生成另一张图；迁移失败保留原档。

**接入验收：**真实开局分别走两条分支，刷新恢复位置；玩家选择前能读到差异，选择后实际遇到相应内容。

## 13. M10：短剧情、选择与持续记录

**范围与归属：**叙事＋程序。沿 Ink，第一包一条三段跨局链、两个阶段结局；先写环境线索，不替待定人物设定定稿。

```ts
getStoryState(baseSnapshot, runSnapshot): StoryView
getEligibleEvents({ nodeContext, storyView }): StoryEventRef[]
previewChoice({ eventInstanceId, choiceId, storyView }): ChoiceView
chooseStory(context, { eventInstanceId, choiceId, expectedRunRevision }): Result<StoryReceipt>
// StoryReceipt: persistentFlagsAdded, runFlagsChanged, rewards, memorialIds, nextEventIds
// 每个结果配置 persistence: 'immediate' | 'onSuccessfulExtract' | 'runOnly'
```

**输入：**事件实例、玩家选项、前置条件、基地与本局故事状态。**输出：**可选项、明确后果、M09 可读条件、M03 可展示纪念物。**写入：**M10 管故事字段；奖励使用白名单效果端口，由命令一次提交，Ink 不能执行任意 JS 或直接发卡。

**依赖与异常：**依赖 M01、M11 的结算边界；独立时用节点上下文和结算替身。每项成果明确死亡／放弃后保留条件：永久记录保留，要求撤离的实物按 M11 处理。不能把全部线索都默认变永久，也不能把永久结局当实物掉落清空。

**独立验收：**

- M10-A：固定输入分别走到两个结局，至少改变一个后续事件、地图条件或基地纪念物；不是仅结尾台词不同。
- M10-B：不满足条件的选项不可执行，返回 `CONDITION_NOT_MET`；不存在事件／选项报错且不改变状态。
- M10-C：各段结束重载、同事件重复触发，不重复领奖；中途死亡／放弃／撤离分别符合 persistence 配置。
- M10-D：文本／Ink 未加载时可退出并继续原流程，不误算已完成；单局临时标记不串到下一局。

**接入验收：**跨两次或多次真实开局推进整条链，基地出现对应后果；人物台词仍须符合权威设定。

## 14. M11：出征、结算与已知流程缺口

**范围与归属：**程序＋QA。适配 `game.session.js`、`game.run.altar.js`、`game.menu.js`。保留成功撤离、死亡、主动放弃的各自规则；不借统一接口把行为统一掉。

```ts
startRun(context, { resolvedPicks, characterId, petId, mode,
                    expectedRunRevision }): Result<RunStartReceipt>
previewSettlement({ runSnapshot, outcome, ruleVersion }): SettlementPlan
commitSettlement(context, { runId, outcome, expectedRunRevision }): Result<SettlementReceipt>
// outcome: 'extract' | 'death' | 'abandon'
// SettlementPlan/Receipt: recovered[], lost[], resourceDeltas,
// permanentChanges[], deferredStoryResults[], runClosed, ruleVersion
```

**输入：**真实卡牌来源标记、安全格／存放状态、结局和现行规则。**输出：**逐项可解释的收据、唯一入库结果和对局关闭。**写入：**经 M01 跨键提交；M02 永久记录、M10 故事结果由对应业务模块准备，不能另造副本。

**依赖与异常：**M01 跨键扩展；已有成功／死亡／放弃路径先做特征用例。安全格、带入标记、珍珠盒差异有冲突时注明“当前代码行为／设计待核对”，不悄悄统一。不合法开局返回 `RUN_ALREADY_ACTIVE`／`FORBIDDEN_CARD` 等。

**独立验收：**

- M11-A：同样库存分别执行 extract／death／abandon，逐项验证本局获得、带入、安全格及特殊存放组合；期望来自具体规则／当前分支，不用被测函数反算自身期望。
- M11-B：合法职业卡可从基地带入、不可作为实物从对局带回；永久收藏不因实物丢失而删除；已有可带入稀有实物该损失时确实损失。职业永久收藏的新入口未确定前，不得切断现有收藏循环后宣称迁移完成，也不得自行新增自动登记或复制卡。
- M11-C：重复开局请求扣卡一次；重复结算及重启恢复只入库一次、统计一次；对局关闭后不能再次领取。
- M11-D：满包选择不可接受奖励时显示具体原因，合法堆叠仍能领取；银河之旅日志无 M1 等内部占位文本；不借此改奖励规则。

**接入验收：**在目标版本分别记录成功撤离、失败返回和主动放弃，重开验证收据对应的库存／收藏。历史四层试玩最终战败，不能代替本次成功撤离证据。

## 15. M12：集成、独立试玩包与反馈

**范围与归属：**集成负责人＋QA。维护模块接线和验收表；发布阶段复用既有 Electron。首个朋友版本可只包含基地与准备升级，不等地图、剧情、全员动画。

**输入：**已接入模块清单、提交与未提交差异标识、资产清单、旧存档样本、各模块验收证据。**输出接口：**

```ts
ReleaseManifest = { buildId, version, sourceRevision, workspaceDiffHash,
  moduleContractVersions, includedFeatures, assetManifestHash,
  packageHash, knownIssues, acceptanceReportPath }
FeedbackRecord = { buildId, category, reproductionSteps, expected, actual,
  optionalScreenshotPath?, optionalSaveExportPath? }
```

不把仅有 HEAD 当成整个脏工作区的版本标识；不打包混入未核对的其他任务半成品。浏览器和 Electron 默认不同存储来源，必须说明新开档还是显式导入，不能声称自动继承浏览器档。

**依赖与异常：**只依赖本次选定的模块；未交付功能明确不进入包。反馈先支持复制／本地导出，不默认上传任何存档或替玩家发送消息。

**独立验收：**

- M12-A：从选定隔离基线重复制作包，manifest 可追溯到源码、改动和资产；程序内显示 buildId，版本与实际内容一致。
- M12-B：在无开发服务器、无需 Node 的 Windows 环境双击 exe，出现独立窗口；关闭重开保留新建档，缺资源时有可理解的回退。
- M12-C：包内完成基地整理、收藏、装修、出征、战斗、结算和重开；成功／失败分开记，不能以 Vite 页面通过代替包通过。
- M12-D：反馈包含版本、复现步骤和预期／实际；玩家可本地复制／导出，未主动导出时不携带整份存档。

**体验验收：**给 3～5 位朋友独立试玩，记录能否找到出征、理解投入风险、说出下一局目标，以及装修／收藏是否有吸引力；这些是定性反馈，不用小样本宣布普遍好玩。发现无趣先改对应模块的设计，不无限增加内容。

## 16. 依赖与第一批派发边界

```text
现有规则／代码 ──→ M01 基地提交 ──→ M02 收藏成长 ──→ M03 家具布局
                                              │           │
M04 样张／资产 ────────────────────────────────→ M05 基地场景
M05 可用契约替身先做灰盒；正式接入再替换为 M02/M03 的真实视图。

M01 跨键扩展 ──→ M11 出征结算 ──→ M06 目标与准备
M07 战斗行动收据 ──→ M08 动画表现
M01/M11 ──→ M10 剧情条件 ──→ M09 地图消费条件
M09 产生节点上下文，由应用接线层交给 M10；两者不互相 import。
选定模块 ──→ M12 集成与独立试玩包
```

依赖图不是等待链：上游未完成时可使用固定样例做独立验收。任何写存档、扣资源或发奖励的正式接入必须用真实上游，不能把替身留在交付版本。

| 波次／可派发包 | 明确完成点 | 暂不进入 |
|---|---|---|
| 1：M04-a 风格布局样张；M05-a 灰盒；M01-a 基地字段与提交 | 制作人看得到布局；五热点和旧入口能操作；新字段有兼容样例 | 全局战斗重构、长剧情、完整骨骼库 |
| 2：M02-a 收藏接口；M03-a 家具与展位；M05-b 真实接入 | 一室、6 家具、1 人、2 展位；收藏／摆放／重载完整闭环 | 新货币、生产排班、战力家具 |
| 支持线：M07-a 已知修复；M11-a 现有结算证据 | 每项独立关闭，有实际范围和证据；跨键改动需 M01-b | 所有 bug 清零、无证据的全局数值改动 |
| 3：M01-b 跨键；M11-b 开局适配；M06；M02-b 皮肤；M08 样板 | 下一局目标与投入可选；一人两动作可对照 | 全员动作铺量 |
| 4：M10 短链；M09 分支；M07-b 遭遇 | 两种路线与结局产生可见后果 | 全篇主线、多张新地图 |
| 收口：M12 所选版本 | 包内真实验收及朋友反馈；可在波次 3 后提前做 | 未入选模块的半成品 |

同一模块可以拆成这些有界小包，**不得给执行者直接下“把 M01～M12 全部做完”的无限任务。** 每包先约定成果和停止点；做完交证据，再决定下一包。

## 17. 文件所有权与接线规则

| 热点 | 唯一合入责任 | 其他模块的协作方式 |
|---|---|---|
| `base.js`、`game.storage.js`、迁移样本 | M01 | 提交字段／迁移需求，不各改一套序列化 |
| `meta.js`、收藏业务、外观选择状态 | M02 | M05/M06 调门面；资产映射补丁单独交接 |
| `game.hub.js` | M05 接线负责人 | M02/M03/M06 提供模块及具体挂载点，不同时改整页 |
| `base.css`、共用 UI token、`art.js` 路径映射 | M04 统一合入 | M05/M08 交有界补丁；不覆盖别人的映射或级联 |
| `battle.core.js`、`effect-steps.js` | M07 | M08 只消费结果，需 hook 时给最小接线要求 |
| `battle.frames.js`、动画清单 | M08 | M07 不把规则写入播放器 |
| 地图生成及版本恢复 | M09 | M10 提供条件与事件配置 |
| `narrative.js`、Ink、剧情配置 | M10 | M09 提供节点上下文，不直接改故事进度 |
| `game.session.js`、`game.run.altar.js`、结算分支 | M11 | M06 交开局输入，M10 交待结算结果 |
| `main.js`、统一接线、发布配置 | M12／本轮集成负责人 | 合入各模块的最小补丁；不重排无关 boot 顺序 |

这里的负责人是派发角色，尚未指派给某个模型。可独立编写模块不代表共享文件可以并发修改。若不同任务使用 worktree，启动前登记实际基线及所需未提交改动；不能假定从 HEAD 创建就带上老板当前版本。

## 18. 每个执行任务都复制的任务头与交付单

```text
任务：Mxx-阶段包名
契约：GAME-MODULE-CONTRACTS-2026-09-21.md v1.0 §对应章节
玩家可见成果：一句具体结果
实施基线：实际目录／分支／提交／本包需要的未提交改动清单
本包输入：数据样例、接口版本、资产版本
本包输出：导出接口、文件清单、玩家入口
允许修改：本包新增模块及登记热点的有界改动
不包含：本包以外的规则／内容与未授权清理
前置：真实依赖或契约替身，明确替身替换位置
验收：对应 Mxx-A/B/... + 本包实际接入流程
停止点：约定成果完成后交付，不自行展开下一阶段
```

交付时必须附：

1. 改动文件和源码基线；接口／存档／资产版本是否改变。
2. 各验收 ID 的通过／失败／未验证，命令或实机复现步骤和证据路径。
3. 至少一个正常样例、一个失败样例；涉及跨重启重复执行的模块再加重试样例。
4. 实机入口、玩家能看到的变化；剩余依赖和风险。
5. 回退办法。只回退自己的功能接线；新增持有物和存档字段必须保留或有经验证的兼容处理，禁止靠清空玩家存档回退。

接口需要变更时，由提供方先列出字段／语义变化、消费方、迁移及新增验收；兼容新增用小版本，破坏性变更必须安排全部消费方适配后一起接入。消费方不能靠猜字段“先跑起来”。

## 19. 本次核对依据与状态

- [整体方案](./GAME-TRANSFORMATION-PLAN-2026-09-21.md)：范围与先后顺序。
- [当前交接](./NEXT-AI-HANDOFF-2026-09-20.md)：他人未提交工作、输入／缩放／资产约束；本对话后续独立 exe 目标用于发布包范围，不扩展为引擎迁移。
- [现有架构](./architecture.md)：快照、命令、ESM 依赖方向和兼容门面。
- [现有存档文档](./save-format.md)：五档键与迁移样本；地图恢复策略存在本次目标差异，见 M09。
- [基地持久化](../game/src/base.js)、[收藏回调](../game/src/game.hub.js)、[人物成长](../game/src/meta.js)、[皮肤入口](../game/src/art.js)：核实需要适配的实际责任边界。

本次产物只有契约文档及整体方案的入口链接；没有改游戏代码、运行游戏测试、生成素材、打包或启动执行任务。模块验收 ID 是以后执行者需要交付的证据清单，**当前均未因本文而变成“已通过”。**
