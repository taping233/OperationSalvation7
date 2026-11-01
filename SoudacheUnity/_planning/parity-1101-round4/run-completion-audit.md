# 局内完整性与验收矩阵

2026-11-01。核心判断：出发→四层地图/节点→奖励/商店/事件→撤离或失败→保存/读取均有现行正式实现；当前 RunReceipts 与 RunJourney 已由 Root 在796项冻结源输入上重跑通过。局内补充恢复检查29条也已通过。本报告分开记录领域/原生构造验收与正常播放器画面，不把受控流程称为自然游玩，也不将未测组合写成缺少功能。

审计及后续复核没有自行编译、运行检查或启动 Unity。Root 授权后仅补两条 Editor 恢复检查、修正其首次领取的 RNG 基线，并为旧验收驱动截图后输入分帧，生产未改。第三轮历史画面基线为 buildGUID `cfbe07ccdc1147f28801339933512ee0`（780项源码/设置/元数据、3945项构建输入、166项产物）；本轮直接执行以各自实际输入清单绑定。后续正常Standalone已完成，GUID为 `66a82ecd32f2426e98d4bf06b8ed3308`，程序passed/exit0、当前2560×1440/DPI120；本代理实看7张的范围与SHA见[本轮Run视觉小结](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round4/visual-run.json)，其余画面不自动归入人工复核结论。

## 入口索引与证据口径

[MIGRATION.md](../../MIGRATION.md) 仍规定完整桌面玩家流程，包括 Unity 自身可靠保存/读取；不移植 Agent、不兼容旧网页档，研究所第二图和关闭制作坊不在当前范围。

[24类页面矩阵](../migration-1029/current-ui-version/version-matrix.json) 采集于2026-10-29，只作为入口/源文件定位。此次涉及02选档、06人物、07整备、08–10背包/安全格/消耗区/容器、18插画节点、19奖励、20撤离、21结算、22地图及23–24战斗连接；商店的现行独立组件从18的节点路由进一步核对。01/03–05/11–17仅有入口依赖或属于其他片，本次未重新验收。没有将矩阵中的旧 Unity 行号、SHA、缺口标签作为当前状态。

证据简称：

- **D3**：[第三轮摘要](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/final-summary.json)，领域986项，其中当前局内基线326项、Round2新增32项。对应原始摘要为 `../parity-1101-round3/RunParityChecks.csproj.log`、`RunRound2Checks.csproj.log`；326项包含99个移动可达性与200个容量对照。
- **N2→3**：[第三轮短验收摘要](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/final-summary.json)记录第二轮原生重跑375项：公共23、Run13、背包容器339，另有共享48项；并非375项都是局内业务分支。原始回执路径/SHA见[产物索引](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/artifacts.json)，本地原始路径为该轮 `native-round2-regression-2/result.json`。
- **N3**：[第三轮记录](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/README.md)及其短摘要记录奖励54、商店42、战斗25、归档10；商店正式事务专项另覆盖成交/未保存、凭据、神秘附赠等。本地原始结果为该轮 `native-round3-final/result.json`、`native-shop-source/result.json`，获取方式与SHA由同轮 artifacts.json维护。
- **P3**：[第三轮正常播放器短摘要](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/final-summary.json)记录2560×1440/DPI120、exit0与61张实际backbuffer画面；大原始 `2026-11-01-unity-parity-round3/player/result.json` 仅本地保留，路径/SHA见[产物索引](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/artifacts.json)。构造页面/状态/程序内输入与[商店](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/visual-shop.json)、[奖励](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/visual-reward.json)、[战斗](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/visual-battle.json)、[归档](../../../搜打撤/docs/evidence/2026-11-01-unity-parity-round3/visual-archive.json)各自实看范围分开，不把61张全称逐张人工复核或自然旅程。
- **H-J/H-T**：较早正式Journey4与Receipts4均 passed，实际入口为 `CurrentMigrationFlowValidation.RunJourney/RunReceipts`。原始大JSON仅本地：`搜打撤/docs/evidence/2026-10-29-unity-desktop/fidelity-1030/journey-4/result.json`、`搜打撤/docs/evidence/2026-10-29-unity-desktop/current-receipts-4/result.json`。前者429 tick，后者38 tick，均为原生构造射线/提交及明示正式命令，非物理输入；版本早于P3，不能改称当前GUID整套重放。
- **N4-R/J**：[本页当前执行复核](#run-native-execution)记录本轮Receipts-2（61 tick）与Journey（422 tick）均 passed，独立进程exit0、无超时，各796项输入前后完全一致。均为1920×1080离屏、构造uGUI射线/事件及标注的Runtime命令，osHardwareInput=false；原始结果/轨迹保留路径及SHA列在文末，作为本地证据。另本轮本地 `native-round4-5/result.json` 含Run29；后续三个旧驱动QA文件变动不涉及该检查源或生产消费者，不预先链接尚未发布的R4大JSON。

下面 Run 指 `Assets/Scripts/Sdt.Run/`，UI 指 `Assets/Scripts/Sdt.UI/Screens/`，Boot 指 `Assets/Scripts/Sdt.Boot/`。

## 主流程矩阵

| 主流程 / 24页索引 | 当前实装与正式源码 | 最近直接证据 | 仍弱或未覆盖 |
| --- | --- | --- | --- |
| 选档→选人/模式→整备→出发（02/06/07） | UI `SlotPickerScreen`、`ClassChoiceScreen`、`Hub/DepartPrepScreen`；Run `GameRuntime.NewRun`、`GameRuntime.Departure`。出发按当前仓库身份/容量与角色草稿提交，不用旧预览页面替代。Vite索引为menu-slots、class-choice.page、game.hub.depart。 | D3基地472项继续通过；N2→3含正式出发打开指南及覆盖/减动效收尾；H-J有正式入口与后续旅程。 | P3不是五档×角色×模式×携带组合全遍历；本片没有重新核对全部角色卡池。 |
| 入城补给（18/19） | UI `EntrySupplyScreen`；Run `GameRuntime.Map.ClaimEntrySupply/ClaimAllEntrySupply`。按候选顺序逐张容量判断，批次一次保存、brought标记、首次职业卡身份及防重复领取。 | D3 Run326/32覆盖标记、保存读回、批次顺序/容量跳过/故障回滚；N2→3 Run13有实际全部领取仅一次保存。 | 原生为受控库存/候选；不等于所有角色/宠物的开局自然组合均已玩过。 |
| 四层地图移动、地点确认、门与过场（22/18） | `Sdt.Core/LayeredMapGenerator`、`MapModel`；Run `GameRuntime.Map.GetReachableNodeIds/CanMoveToNode/TryMoveToNode`；Boot `RunLoopBridge.PresentNode`；UI `NodeModals.DoorModal`。现行Layered地图，不走旧三环。 | N4-J执行33次正式移动与3个层门，四层通路通过；D3 Run326有99组可达性对照；N2→3验证遮挡时移动继续完成、背景停写与恢复。 | 受控路线不等于自然走完所有随机地图；移动对照的99组不是所有种子穷举。 |
| 物资/拾取（18/19） | Run `GameRuntime.Map.GetResourceRewardCards/ClaimResourceReward`、`GameRuntime.CurrentPickup`；UI `PickupScreen` 与共享奖励/读卡入口。候选来自现行 CardLibrary，凭据冻结且逐项防重。 | D3 Run32核现行覆盖/自定义资源池、加权次序与RNG；归档39领域及N3归档10补跨档定义闭包；P3奖励/腾位画面。 | 截图未专门构造新自定义资源/变体组合；那些结果来自领域或Editor，不能归功于61图。 |
| 普通战/首脑入口→战后继续（23/24/18） | Boot `BattleBridge`、`RunLoopBridge`；Run `GameRuntime.BossGate`、`CompleteBattleNode`；UI `CurrentBossGateScreen`、`BattleScreen`、`BossPackCleanup`；Core `BattleSession`。二段目标归属、取消、终局与自动批次等待已修。 | N4-J记录10场真实BattleEnded胜利（含1场首脑）及正式首脑门；本轮等待选择专项另有领域与原生30条。D3/N3/P3证据按原范围保留。 | N4-J有10000生命/2000攻击及补牌、自动选择；不能证明自然战斗平衡或全部晚回合组合。 |
| 火堆/祭坛→奖励或复原（18/19） | UI `FireRestScreen`、`AltarRitualScreen`、`CardSacrificeScreen`；Run主文件火堆命令、`GameRuntime.Altar` 和 `TryActivateAltar`。复原来源、附赠候选、防重和容量失败重试沿正式事务。 | D3 Run326覆盖祭坛本体占末格→附赠等待→整理后同候选领取与RNG；Run32/N2→3 Run13覆盖实际变体复原与来源；P3祭坛图。此前祭坛连续复原焦点有独立原生历史验收。 | P3祭坛图只证明所构造阶段，不证明所有祭坛支线/材料组合；最新原生变体复原不冒称正常播放器专测。 |
| 宝箱/事件/战后奖励→读卡/整理/继续（18/19） | Run `GameRuntime.CurrentNodeRewards`；UI `ChestOpenScreen`、`CurrentRewardScene/Flow/Tile`、`CurrentRewardCapacityOrganizer`、`CurrentRewardCardZoom`。来源key、taken/lost回执及当前Tile/确认版本维护防重。 | N3奖励54直接覆盖旧确认/旧Tile、关闭/替换/owner移除、UID安全格/丢弃、失败回滚、焦点与保留布局；P3奖励待领/读卡/满包整理；D3 Run326/32。 | 原生使用受控item/库存，不能推出所有宝箱/事件奖励队列组合都跑过；对象保留由身份断言证明，截图本身不证明性能。 |
| 事件、骰子、重编、军需等（18） | Run `GameRuntime.Events/EventRoutes`；UI `EventDialogScreen/Choices/Recode`。选择按实际来源、slot/seed/node与当前owner校验，重编结果冻结，保存失败保留原卡/结果并可重试。 | D3 Run32及N2→3 Run13覆盖复原实际变体/过期owner；P3重编结果、读卡和保存失败三图及程序内检查；N3奖励/归档覆盖共用边界。 | 没有覆盖事件卡全体×每选项×所有骰点；P3重编图按每列旧名→新卡面理解，不是两卡应同名。 |
| 商店/凭据/购买出售→背包返回（18） | UI `ShopScreen`、`CurrentShopView*`、`CurrentShopCommission`；Run `GameRuntime.Commission/ShopAcquisition`。报价/UID/owner固定，保留视图；已成交I/O失败按源保留当前交易，离店重试保存，未成交仍回滚。 | N3商店42 + 正式SourceValidation；P3七张商店/详情/空收购/凭据/免费货位逐图复核；D3相关源按当前输入构建。 | P3空收购图不证明有货售卖布局；非默认市场/收购滚动的完整往返不由七图独证，焦点/UID/故障由原生专项承担。 |
| 背包/安全格/消耗区/锦囊珍珠盒（08–10） | UI `Bag/BagScreen/BagCurrentView/BagCurrentCell/ContainerScreen/BagCardDetail`；Run `CardContainerCommands/BagItemCommands`。按稳定组与真实UID，普通/资源/总容量分开；整堆移动和安全预览由正式命令重验。 | N2→3背包容器339；D3基地472与Run容量200样本；P3基地变体/仓库动作等定向图。 | 普通占格已经超限、但扩展总格仍有余量的公式经独审，第二轮未增专用UI构造；本片没有把它当已发现生产错误。 |
| 紧急/终局撤离的门槛与献祭（18/20） | Run `TryEmergencyExtract/TryFinalExtract` 与 `GameRuntime.BossGate`；UI `CardSacrificeScreen`、`NodeModals.FinalExtractionModal`；Boot正式节点分派。要求当前地点/祭坛/首脑等条件，不由任意页面直接绕过。 | N4-J走正式层门、祭坛激活、首脑门与终局撤离；D3保留门槛领域覆盖，P3有构造撤离整理画面。 | N4-J不是自然游玩，也未单独实际执行紧急撤离献祭分支；不能把经过EmergencyModal截图当献祭命令证明。 |
| 撤离整理→入仓/放弃剩余→结算→基地（20/21） | Run `GameRuntime.Settlement.DoExtract/ExtractStash*/FinishExtract`；UI `ExtractScreens`、`CurrentExtractionPage`、`CurrentSettlementReport`。稳定结算identity、left清单与幂等回执，操作走默认事务。 | N4-R实际存档锁下撤离/整理/完成失败、重试与重复不增发通过；N4-J最终撤离→结算→基地且完成回执保留；Run29验证同名variant部分入仓后恢复。 | 1920原生离屏与同进程重进，不等于新正常播放器的当前窗口或跨进程恢复验收。 |
| 死亡/主动投降/主动放弃→抢运/丢失→基地（21） | Run `GameRuntime.Settlement.DoDeath/AbandonRun`；Boot `RunEnded`；UI `DeathScreen`、菜单离场确认与结果报告。失败与主动放弃区分brought/安全来源，终局回执防重复。 | N4-R通过真实致命EndTurn→DeathScreen、两张安全卡抢运、主动投降写失败重试、主动放弃仅抢运非带入安全卡及重复终局；D3已有brought保存读回。 | 致命敌人和携带来源为受控夹具，输入为构造uGUI/正式命令；不声称物理投降输入或自然死亡场次。 |
| 选档读取→节点/战斗/撤离整理继续（02/18/20/21） | Run `GameRuntime.LoadRun:451–505`、`GameRuntime.BattleCheckpoint`、`SaveSystem.RunValidation`；Boot `BattleBridge.RestoreBattleCheckpoint/RunLoopBridge.RunLoaded`；UI选档正式入口。恢复地图、RNG、回执与sorting；战斗按正式入场checkpoint恢复。 | Run29独立SaveSystem读取文件，再正式ShowTitle/LoadRun恢复冻结未领候选及部分入仓sorting，核UID/variant/RNG/left/成长/identity与重放防重；N3归档10/领域39支持跨profile定义闭包。 | 当前补充是同进程重进；不声称第二进程/强杀/断电恢复，或任意待选二段/滚动位置续接。 |
| 单档备份→新目标预检/冲突→导入后继续（02） | Run `SaveSystem.SlotArchive/ArchiveCards`、Core `CardLibrary` 与选档备份入口。必要自定义定义/传递依赖随包，冲突预检阻断，不覆盖目标其它global/档位。 | D3归档39两profile领域 + N3归档10；P3导出/导入/预览与归档视觉报告。 | 正常P3图未专门构造自定义资源候选跨profile迁移，该闭包由领域/Editor证明；不承诺旧网页档兼容。 |

## 审计时提出的两个核验项及当前收口

### 1. 敌方回合触发自动释放与玩家选择的外层等待

该项已由 Battle 片按合法星辰→神灯复制、逆鳞受伤抽牌及嵌套目标链实施并冻结；当前来源、生产变更及验收归 [battle-turn.md](battle-turn.md)，检查独审见 [battle-check-independent-review.md](battle-check-independent-review.md)。Root 新增统一原生中的战斗30条已通过。本记录不再将这一已处理条件列为待实施，但仍不把有限合法链推广成全卡组合证明。

### 2. 当前版本终局与持久中断点的小闭环复核

本项所列当前版本核验已执行闭合：N4-R/J 重跑正式终局与四层旅程；新增 Run29 检查独立文件读取、同进程标题后 LoadRun 恢复冻结未领候选和部分入仓 sorting，核来源、variant、RNG、left及结算identity。没有新增跨进程恢复框架，不将两个独立执行进程误说成“一个进程保存、另一个进程恢复同一中断点”；战斗仍按既定入场/正式选择 checkpoint 合同恢复，未要求任意帧输入快照。

多尺寸、物理键鼠、全事件骰点穷举、平衡与整帧性能仍是已声明边界，本片不将它们升格为未经要求的实施项。审查完成，等待 Root 统一协调。

## Root授权后的当前验证源与执行

新增 `Assets/Editor/CurrentRunRound4Checks.cs` / `.meta` 的冻结指纹见 [run-freeze.json](run-freeze.json)。其后为正式 RunReceipts/RunJourney 修正三个 QA 驱动的截图后分帧，见 [receipts-frame-freeze.json](receipts-frame-freeze.json)；生产未改。下列入口均已由 Root 统一执行，本代理没有自行调用入口。

| 入口 | 这次动作与已有/新增断言 | 输入输出及边界 |
| --- | --- | --- |
| `Sdt.Editor.CurrentMigrationFlowValidation.RunReceipts` | **当前重跑通过，61 tick**。真实致命EndTurn→死亡抢运、战斗设置主动投降确认/失败保存/重试、主动放弃带入/安全卡区别、撤离入库/完成写失败和所有终局重复不增发；另走火堆、宝箱与事件，未复制终局框架。 | 独立Editor进程与隔离profile；result.passed=true/Exit0，23次记录的构造射线全部命中精确目标。1920×1080离屏，不能当正常当前窗口播放器证据。 |
| `Sdt.Editor.CurrentMigrationFlowValidation.RunJourney` | **当前重跑通过，422 tick**。正式NewRun/补给夹具后四层移动、3个层门、祭坛、首脑门与10场战斗、奖励、最终撤离/结算、基地返回；自动选项、补攻击牌与强化属性均保持明确，不称自然旅程。 | 独立Editor进程与另一个隔离profile；result.passed=true/Exit0，25次构造射线全部命中精确目标。遵守原310秒/1600tick预算，无超时，未并发PlayMode驱动。 |
| 全局 `CurrentRunRound4Checks.Run()` / `Assertions` / `Step` | **新增两条恢复场景**，成功路径预期29条Require：Run本体25条 + Fixture每次2条×2次。其一从全层真实resource节点走正式ResolveCell准备候选，独立文件读取核候选/RNG，标题后LoadRun恢复并领取一次；其二按实际sourceKey将同名不同variant卡中的一张部分入仓，再恢复sorting并继续，核left/卡面来源/入仓数/成长/RNG/结算identity及过期identity、重复操作。 | Root既有统一IEnumerator驱动接入；要求 `SDT_UNITY_TEST_DATA`，复用当前原生Canvas/Boot/Bus。只写slot5隔离数据，finally清面板。不自行设置新Editor流程，不提供生产测试回退。 |

新检查使用 `new SaveSystem()` 从实际profile文件独立读取，再通过正式 `ShowTitle/LoadRun` 恢复同一运行时；恢复前刻意改变未持久的live候选/库存/RNG，用以拒绝“只沿用当前内存”的假通过。它没有更换只读Saves服务、没有反射替换Runtime，也没有创建跨进程框架。明确是**独立文件读取 + 同进程标题重进**，不证明进程强杀、断电或第二个播放器进程恢复。

新增场景的地图位置和两张variant卡为受控前置；随机资源候选由实际生产resolver抽取，后续不覆盖候选或改规则。普通撤离门槛/四层可达性由既有RunJourney承担，补充检查直接使用正式DoExtract/ExtractStore/FinishExtract来隔离持久整理问题。没有把这些方法级检查误写为物理输入/完整游玩。

修正后29条已由 Root 的本轮原生统一执行通过；当前 Receipts/Journey 的796项输入清单另有执行前后相等证明。正常播放器的GUID和7张实看画面另由后续Standalone实际结果与visual-run.json绑定，不由这两个离屏结果代填。

## native-round4-2 检查基线修正

Root 的统一原生第2次在 Run 第12条停止，原复合断言把首次领取前的完整 RNG 用作重复调用后的基线。只读核对后确认这是检查误报，未发现或修改生产重复领取逻辑。

- 现场目录为父项目 `搜打撤/docs/evidence/2026-11-01-unity-parity-round4/native-round4-2/profile/`。`profile.json.previous` SHA256 `a93c10ce9fd0c2bfa04509c126ab5969edf170dd6d3a9c399debf22590405482`：节点 `1,3` 候选为 tt-key/tt-wood、rewardTaken=null、owned=[]，identity状态1266749431。
- `profile.json` SHA256 `e097bb4c6f492721591e2a4ec70498ac515a2466f92c2999e7182c904553899a`：同候选、rewardTaken=0、completed=true，恰一张 tt-key，UID为 `omvx6qrmjuogj`，identity状态634913761。reward状态3090702870、gameplay状态4072039400在两文件完全相同。identity变化恰为两次 `0x6D2B79F5` 步进取32位，匹配正式 `GrantCard→NewUid`（GameRuntime.cs:302–315、387–396）；Vite `game/src/run/game.session.js:147–148` 同样生成两段 identity 随机数。
- `GameRuntime.Map.cs:179–184` 在已有 rewardTaken 时直接拒绝、不进入事务。检查现拆开验证“重复调用返回false”和“首次成功后的完整RNG、精确owned序列、候选/已领回执不变”，再以新 SaveSystem 检查相同UID及首次成功后的RNG落盘。没有删掉重复领取或随机顺序断言。
- 同时静态核对 `GameRuntime.Settlement.cs:32–47、76–102`：错误整理identity返回null；已完成时 ExtractStashAll/FinishExtract返回已有完成回执，DoExtract返回完成视图，不要求重复操作返回null。当前受控夹具 usedPocket为空，入仓及完成步骤不需要新随机；保留这一约束，并以完成后的独立RNG/成长基线检查重放返回Done且库存、统计、成长与随机状态不变。

本次仅修改检查源与自有说明/冻结清单，生产及其它检查源未动；新增一条分离返回口径的Require，成功路径由28变29。修正后未自行执行，由Root统一验证。

## Receipts 旧驱动截图后的输入分帧

Root 后续统一原生新增127条（31/25/12/29/30）及既有554条已通过。正式 RunReceipts 重跑在step1的 exRarity 射线检查停止，Journey 因依赖链尚未启动。本段记录 QA 驱动修正，不将其登记为生产遮挡或布局缺陷。

只读证据为父项目 `搜打撤/docs/evidence/2026-11-01-unity-parity-round4/native-receipts/`：已逐图查看 `receipts-sort-before.png`（SHA256 `f2c32104aa0c95b6568261fc3b7e23a020eb095f632c4d8035f41e8c7ceeae12`），按稀有度按钮清楚可见，没有其它控件遮挡。`receipts-trace.json`（SHA256 `e44714cd9e6b3b4442b0668177cbe955a2af0e3dd878c0f04aa155de287851be`）的截图测得按钮范围 x1536–1856、y592–660，中心约(1696,626)；同tick后续 Click 却投影为(119369.7,14375.918)，first/receiver为空、hits为空。因此没有命中遮挡者，失败消息中的“blocked”实际是视口外坐标。

正式提取页当前没有入场幕布；驱动顶层也已经等待 startup 幕布结束。该step先 Shot 后同tick Lock/Click，OffscreenCapture.Write 临时改正交投影并恢复旧投影，而 Canvas 的真实更新/渲染尚未跨帧。最便宜的定向修正为只改变现有 QA 时序：新增窄 ShotReady，按step/名称/当前面板只拍一次，等待 frameCount 至少+2，保证中间有一个完整原生帧后再按当前变换计算实时坐标。

已静态核对全部 Receipts/Journey 的同类路径。Receipts在step1/5/8/13/18/19/20/23/25/27/29分别等截图后帧，其中19是截图后重建下一夹具；Journey在step2、4及首次页面/层截图后等待。所有保存失败的 Lock 仍在等待完成后才加上，真实 RaycastAll、精确receiver、pointer-down及回滚/防重复断言未改。剩余普通 Shot 后只有解锁/跳到下一tick或直接结束，没有同tick输入。

只改三个现有 Editor 驱动文件及自有文档，生产、OffscreenCapture 与其它检查源保持原样。没有手动渲染救援、没有缓存截图坐标、没有调用按钮回调代替射线。本代理未执行检查；三文件指纹见 [receipts-frame-freeze.json](receipts-frame-freeze.json)。该冻结快照保留生成时的待执行状态，实际执行结论以下段为准。

<a id="run-native-execution"></a>

## Receipts/Journey 当前执行复核

只读核对两次实际 result、process、独立trace及执行前后输入清单后，确认上述 QA 分帧修正在当前冻结源上通过。没有重复运行或修改生产/检查源。

| 当前入口与证据目录 | 实际结果与进程 | 轨迹直接支持的范围 |
| --- | --- | --- |
| `RunReceipts` / `native-receipts-2` | passed=true，61 tick，PID35048，exit0，无超时；136条独立trace记录与result中的记录数一致；15张离屏截图已生成。 | 原保存故障、重试、终局防重复、brought/安全来源及后续节点断言均走到最终step31。23次射线的target/receiver全部一致；exRarity失败保存与重试两次均在(1696,626.000061)命中自身。11次截图后等待均完成，观察到的最小跨帧间隔31（要求仍为至少2）。 |
| `RunJourney` / `native-journey` | passed=true，422 tick，PID26272，exit0，无超时；648条独立trace记录与result中的记录数一致；28张离屏截图已生成。 | 33次正式移动、从0/1/2层进入3个层门、1次正式首脑门、10场BattleEnded均胜利（含1首脑），完成终局撤离/结算/基地。25次射线target/receiver全部一致。27次截图后等待完成，最小帧差2；最终returned-base-ready为slot5、runActive=false、identity=`5:351237698`、status=complete。 |

两次 process 均记录 sourceCount=796、inputsUnchanged=true、changedInputs=[]。另独立比对各自 source-before/source-after 的796个键值，差异为0；其中三个 QA 源的实际哈希逐项等于 `receipts-frame-freeze.json`，并非仅依赖 passed 标记。

| 实际证据文件（父项目本轮 evidence 内） | SHA256 |
| --- | --- |
| `native-receipts-2/result.json` | `2078d71ea592bb167a9ec1f6ac7916b926194844ddaa8d49b76fe647c9f4a1cb` |
| `native-receipts-2/process.json` | `b8d472b181ddcc67a9e76a4c9f4521650b1fe2706a97be0ec54dd9b00fd07f75` |
| `native-receipts-2/receipts-trace.json` | `a306f06399ccb61aeb53dcb9e345e9fd4f30be3baf7dd10ed837642482d580b3` |
| `native-journey/result.json` | `a8d44ab00acb894a99bd9257fa1e23b33b4c8d45a36fd018e1f75af937dccab0` |
| `native-journey/process.json` | `22182721513377fd01e29b6635f1c844f46229a9c88b57cc9b98cc7bf4146a51` |
| `native-journey/journey-trace.json` | `ebf1e80d4f2795c4f56941a62c7c2b1967d0d2e9ad046cd94cc1af0e63bf4353` |

输入与呈现边界保持明确：这两次是1920×1080原生离屏、构造 uGUI RaycastAll/ExecuteEvents/InputField-endEdit及明示的 Runtime 命令，osHardwareInput=false。Journey 的 controlled-fixture 实际记录 powerful=true、HP10000/ATK2000，源码还会补充初始攻击、腾出背包、自动编组/选项/目标；它证明当前受控正式流程可完成，不证明自然获得、平衡、所有骰点、原版随机结果逐次等价或物理键鼠输入。43张新离屏截图的生成不等于本代理逐张视觉验收。

后续正常Standalone是另一组已完成证据：GUID `66a82ecd32f2426e98d4bf06b8ed3308`、实际2560×1440/DPI120、61张backbuffer、passed=true/exit0；输入仍为构造页面和程序事件、没有OS物理输入。大原始 `搜打撤/docs/evidence/2026-11-01-unity-parity-round4/player/result.json` 仅本地保留，短视觉结果为同轮visual-run.json。本代理仅实际查看其中7张，并注明前序失败短时Toast与资源二选一无独立图的边界，未将1920旧图或61张生成通过替代逐图复核。源码及检查源继续冻结。
