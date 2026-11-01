# 第六轮局内流程审计与最小修复

2026-11-01。本片先只读追踪出发、地图、节点、背包使用、事件、结算和续档，随后按 Root 授权修改 `BagItemCommands.cs`、`GameRuntime.CurrentPickup.cs` 及主 `GameRuntime.cs` 中事件抽池这一行，补独立领域检查源。尚未编译、运行测试或启动 Unity；下文的检查数量是静态计数，不能当作通过结果。

Root 指定上轮已发布 `d8f40d78`、代码 `eabc0ccd`、播放器 GUID `3a68596b7ad04387a7ea36420d8ac12e`。本地 Unity 仓库审计时 HEAD 为 `81b87cbd5f7b6bb7de48b0973c534ba494cb84a9`；Vite HEAD 为 `f966e859043b7ab3703839005029ef090a4677b5`。当前 Vite Run 源无在途修改；四个在途动作文件 `battle.frames.js`、`character-idle.js`、`character-idle.css`、`character-idle.test.js` 未用于本片行为取证，工作文本未读取。Root 统一维护812项发布输入回核及本轮其它属地。

## 已有流程和本次差距

沿用 [R4局内矩阵](../parity-1101-round4/run-completion-audit.md) 的入口和证据边界，未将其历史通过搬作 R6 已执行。第五轮状态见[已发布短记录](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round5/README.md)；大原始 result/trace 仍仅本地保留。

| 流程 | 当前正式来源 | 本次判断 / 既有直接覆盖 |
| --- | --- | --- |
| 出发、补给 | Vite `game.run.altar.js`；Unity `GameRuntime.Departure.cs`、`GameRuntime.Map.cs:138–166`、`EntrySupplyScreen.cs` | 现行批量入口一次事务，按候选顺序逐张容量判断、brought、classCard、防重与失败回滚；R2新增32及旧 Run326已直接覆盖，未再次报告已修差异。 |
| 四层路径、门、关键节点 | Vite `game.run.flow.js`；Unity `GameRuntime.Map.cs:49–101`、`LayeredMapGenerator.cs:134–142`、`NodeModals.cs` | BFS可达性、门和到达回执仍是正式链；既有99组移动对照、R4受控Journey四层/33移动/3门。没有发现必须修改的当前路径错误；不是种子穷举。 |
| 物资、宝箱、奖励整理 | Vite `game.run.resources.js`、`chests.js`；Unity `GameRuntime.CurrentNodeRewards.cs`、`CurrentRewardScene/CapacityOrganizer`、`EntrySupplyScreen.cs` | 当前卡库资源池、变体来源、过期Tile/确认、容量和原子回滚已有 R2/R3专项。保留现有实现，不复制框架。 |
| 商店/读卡/整理返回 | Vite `game.run.shop.js`；Unity `CurrentShopView*`、`GameRuntime.ShopAcquisition.cs` | R3已保留真实货架/卡面/详情/滚动及固定报价/UID/owner；成交保存失败保留已生效交易属于明确源语义，本轮未改。 |
| 地图道具获取/发现 | Vite `hub/bag-item-effects.js:63–70`、`hub/game.bag.rules.js:116–169`；Unity `BagItemCommands.cs` | 本轮修正当前权威池与重开发现重复持久，详见下节。真实发现传说为员工通行证C `tt4-shine-token`；员工通行证A `cmtmvq6ss84l` 是获取本职业能力卡，未伪造为发现入口。 |
| 事件抽取、选择、骰子与复原 | Vite `game.run.events.js`；Unity `GameRuntime.cs:826–841`、`GameRuntime.Events/EventRoutes.cs`、`EventDialog*` | 选择与复原已用当前卡库/真实CardFaces与来源key；主文件首次事件抽池原为静态库，本轮另获授权改为当前库。没有声称事件全体×选择×骰点已验收。 |
| 祭坛/紧急献祭 | Vite `game.run.altar.js:645–713`；Unity `CardSacrificeScreen.cs`、`GameRuntime.Map.cs:115–134` | 命令按真实UID/普通背包复检并和撤离支付同事务；可见选择仍是纯姓名行，有当前明确UI缺口。R4未直接执行紧急献祭，不能把EmergencyModal画面当命令证明。 |
| 撤离/失败/续档 | Vite `game.run.altar.js:826+`及结算命令；Unity `GameRuntime.Settlement.cs`、`GameRuntime.cs:451–506`、`CurrentExtractionPage/SettlementReport` | 稳定identity、剩余清单、同名variant来源、默认回滚和已完成幂等口径已有 R4 Run29/Receipts；现行LoadRun仍是正式入场/节点检查点，不承诺任意UI帧或跨进程强杀恢复。新增归档检查仅覆盖本轮发现候选闭包。 |

## 本轮已授权修复

### 1. 地图道具的权威候选与只读重开

原 `BagItemCommands.cs:30–31` 的 `Pool` 使用 `CardDatabase.All`，而 Vite `bag-item-effects.js:65–67`、`game.bag.rules.js:127–128` 和 `cards.rules.js:265–266` 使用 `Cards.all/classPool`。因此新增自定义目标缺席，同ID覆盖后的 rarity/cls/unrandom 也未参与资格；原准备页末尾又用 `FindById` 呈现，可能出现“旧定义资格、新定义卡面/领取”的错配。

现统一使用 `CardLibrary.All()`，保留传说的随机资格、本职能力卡的显式职业池语义、池顺序及随机流。准备发现一次构造当前池和ID lookup；合法已有receipt按原ID顺序只读投影，不再进入 `TryPersistMutation`。首次生成仍在原事务内抽取/赋值，保存失败完整回滚候选与RNG；非法version/kind/数量/重复/缺失资格的receipt保留且不重抽。确认领取也校验完整receipt和当前来源的实际发现规则，再按排除源UID后的真实容量提交。

只读快路径仍保留 `Source` 的runActive、非战斗、唯一UID、普通背包/道具资格，并调用 `Saves.HasSlotReadError/ReadErrorForSlot`，对应原 `BeginTransaction/WriteSlot` 的损坏profile/slot拒绝边界。首次事务成功后若SaveCompleted观察者已更换run或来源，不返回旧来源候选。未改UI owner机制，也未加入旧接口回退。

复杂度依据：原准备每候选再次构造Pool、末尾逐项FindById；3项候选会执行4次Pool筛选加3次卡库查找。现为一次Pool/lookup构造和至多3次O(1)校验/投影。每次合法重开去掉全State/Base/RNG/撤离/战斗快照、profile事务克隆、Base/run序列化与原子写；首次和最终领取的持久边界保留。不据此宣称具体毫秒或FPS收益。

### 2. 已保存金币领取的Phase-only返回

`PickupScreen.cs:58–59` 原先先Claim保存，再Leave完整保存。最终活跃消费者 `RunLoopBridge.cs:133` 传入 `onDone=null`，因此是两次保存，没有第三次FinishNode；早期推断已更正。

Vite `game.run.scenes.js:411–449` 的同一checkpoint保存后只切idle/刷新/关闭；Unity `CaptureRunSave`（`GameRuntime.Persistence.cs:74–80`）不持久Phase，`LoadRun:500→EnterLayer:627`固定恢复idle。现仅在已claimed且pickupSaved后直接将Phase改idle并返回；不再写profile，也不发第二次SaveCompleted。已有读错误不阻止这一只读返回，错误标记不会被清除，后续实际写操作仍受原保护。

Claim未保存时，保留源码先到账/settled后尝试保存的语义；写失败保留已到账金币和内存回执，Leave仍重试同一检查点。未领退出保留原保存，记录 `PickupScreen.OnPrepare:27–28` 场景文案消耗的gameplay RNG。没有将整个领取错误改成回滚金币的原子事务。

**可达性限制：当前新图的 `LayeredMapGenerator.Assign:138` 与预算校验`:200`不生成coin/wood/rations/key节点。** 因此该三行优化对应保留命令/开发构造路径，不计作自然新地图的常见性能收益。领域检查明确构造coin receipt，不伪称找到了新地图金币节点。

### 3. 首次事件抽池使用当前定义

主 `GameRuntime.cs:828` 原从 `CardDatabase.All` 抽事件，对照 Vite `game.run.events.js:66/84–109` 应使用当前库；原流程首次取旧定义、保存后重进`:682`却用FindById取新定义。Root另授权只改此唯一来源为 `CardLibrary.All()`，现新增事件及同ID覆盖后的type/name/desc均参与首次抽取，保持原history/id去重、候选顺序与单次gameplay抽样，用尽不增加随机数。未更改其它方法、空库处理或增加源版旧随机表fallback。

## 跨属地补缺与待协调UI

- **发现候选缺定义的单档备份预检**：`SaveSystem.ArchiveCards.cs:29/46/55` 已递归导出正常 `ownedCards[].bagDiscover.cardIds`，无需新闭包。原 `ValidatePendingArchiveCards:111–143`漏查这类pending；删除候选自定义定义后仍可导出无法继续领取的包。Root本轮已窄补当前run及settlement.run的pending IDs校验；共享文件不由本代理编辑。新领域源通过公开API检查完整包、正确重签的缺定义包、目标缺定义时的合法导入与继续领取。
- **献祭UI**：`CardSacrificeScreen.cs:32–43`只展示姓名并每次选/撤整段Rebuild；Vite `game.run.altar.js:664–695`使用真实卡面/费用/描述、同UID原位局部更新。Native同名变体玩家无法辨认；`:55`取消直接关闭到地图，源`:697–698`返回原祭坛/撤离点。建议复用现有CardFace、保留滚动/行身份，按owner和来源复检/清除无效选择，取消回正确入口。尚未在本片授权范围实施，不将它标为完成。

火堆复原本体仍保留实际variant；其结果列表按restoredIds重取卡库的做法在 Vite `game.run.altar.js:152–155`也存在。本片未把这一共同呈现限制误判为Native新增玩法损失，也未扩成存档schema修订。

## 新检查源和集中执行入口

新增 [run-check/RunRound6Checks.csproj](run-check/RunRound6Checks.csproj) / [Program.cs](run-check/Program.cs)，复用既有Core/Run编译集合与 `migration-1029/current-departure/Stubs.cs`，没有新框架或生产测试入口。静态成功路径预期 **93条Check**：发现/重开11；首次失败/容量/领取/重放12；5种非法receipt与资格变动13；传说/本职获取及本职发现6；金币受控检查14；归档公开API11；真实event节点的当前定义/恢复与三种历史排除/用尽RNG共19；区域/战斗/非活动与读错误7。

范围包括新增与同ID覆盖资格/顺序、RuleValue真实道具入口、完整RNG、唯一UID、独立SaveSystem文件读取、真正文件锁下只读重开、首次/领取真实I/O失败、缺定义包拒绝、导入后不重抽、金币已到账失败重试及Phase-only退出。不运行UI，不证明自然地图中的金币节点或物理键鼠、全事件/种子组合、实际帧率、跨进程中断恢复。

由Root在全部属地冻结后统一还原依赖并执行 `dotnet run --project _planning/parity-1101-round6/run-check/RunRound6Checks.csproj --no-restore -c Release`；另由Root决定旧Run326/32、旧归档4模式39项、原生/正常播放器的相关回归。当前本代理仅做定向源码自审与 `git diff --check`，未执行上述命令。冻结文件及SHA由同目录 `run-freeze.json`记录。
