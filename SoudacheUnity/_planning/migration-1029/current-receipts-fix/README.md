# 现行回执验收的动画依赖

`current-receipts-1` 的 step 8 在真实 `EndTurn` 后固定等待约 650ms，就要求出现死亡页。当前生产桥 `GameBattleHost.OnBattleEnd` 会先调用 `BattleScreen.WaitForActorResult`，等敌方蓄力、命中、死亡动作和原生人物帧结束后再保存并打开死亡页，因此该次失败不能作为死亡结算失败的证据。

第一轮只修改 Editor 验证脚本，生产行为未修改；后续 `current-receipts-3` 发现的实际奖励差异见下节：

- `CurrentMigrationFlowValidation.Receipts.cs`：生命归零和主动判负重试后，检查真实 `snapshot.over`，等待真实死亡页。等待期间记录战斗 token、队列忙碌状态/剩余节拍、人物动作/帧/运行状态，以及当前页面；每种依赖最多 25 秒，总场景原有 120 秒限制保留。意外保存重试状态立即失败，不自动强制结算。
- 同一脚本的初次主动撤离点击前等待生产动画空闲，避免按钮操作被 `PresentationBusy` 正常拦截。
- `CurrentMigrationFlowValidation.Journey.cs`：`snapshot.over` 后等待结果桥接，停止发后续卡牌/回合命令；按 BattleToken 只计一场完成战斗。普通战斗命令前等生产表现队列和人物帧空闲，保证下一命令遵循实际页面的输入边界。

私有检查 `check_types.py` 捕获当前生产 Scripts 和本轮 Editor 脚本到自有 `types/snapshot/`，采集前后 SHA 一致才编译。退出 0，7 个既有警告，0 错误；证据为 `type-check.log`、`source-manifest.json`。这只证明类型一致，**不能替代原生 RunReceipts / RunJourney 重跑**。

仍沿用构造 uGUI `RaycastAll + ExecuteEvents` 和显式记录的正式命令；未增加操作系统硬件输入或 650ms 物理按住成功的声明。未启动 Unity，未使用共享 compile 输出，未改主验证文件。

冻结文件 SHA256：

| 文件 | SHA256 |
| --- | --- |
| `Assets/Editor/CurrentMigrationFlowValidation.Receipts.cs` | `B2C43CC28414D2823C0D0A2D6EEF433D5B0BE06EE4E95882329398C8612346D5` |
| `Assets/Editor/CurrentMigrationFlowValidation.Journey.cs` | `CD86BB33B2D9AF9CF824D9388BD83D47E0538635D59819B6D1724C49CD733154` |
| `Assets/Scripts/Sdt.UI/Screens/Run/ChestOpenScreen.cs` | `62A15F2ABF8483368CA26C0A313ACD05D7E642C930427EA59920BE64543CB40B` |
| `Assets/Scripts/Sdt.UI/Screens/Run/CurrentChestProgress.cs` | `E0AD7A310029D15C65E7FF5A4D059DFCC52FBB8FBB9BD35B431C690D2430B2F8` |
| `Assets/Editor/CurrentMigrationFlowValidation.cs` | `B68B82B0F016CE1D2972DE55C30A50DB65FE70F5F0327D13B6BE4729C257118C` |
| `Assets/Editor/CurrentMigrationFlowValidation.RewardInput.cs` | `BBED50862D892ABB04BDC4211092D96EDE337521DBEF4339920824AC1471151C` |
| `Assets/Editor/CurrentMigrationFlowValidation.RewardTransition.cs` | `F115C0EAE1B17F63E8977D92B1C4B70962BAC231D70F337132668934DFDF8C1E` |

## current-receipts-3 的多卡奖励差异

该次已通过死亡、主动撤离重试、放弃与火堆流程，执行到 step 27；前一步“全部收下”后，Unity 页已关闭、`chestIndex` 已越过队尾，故 `CurrentChestReceipt` 合理返回 null，旧脚本解引用产生 NRE。

但沿现行源 `game/src/run/chests.js` 核对后发现生产差异：`takeAll`（769–789）调用 `closePicker`，`closePicker`（408–419）若没有下一个待领箱，则保留当前完成态并 `render()`；完成页有 `继续探索`，`chestContinue`（692–696）才调用 `next` / `finishQueue`。单箱 small、单卡、非互斥且非 battleSettlement 的直接单卡领取才在 `claimRewardAt`（729–731）特别自动完成。Unity `ChestOpenScreen.Take` 完成 Overview 时一律 `Next()`，`Forfeit` 也直接推进，导致多卡最后一箱提前退出。

Root 核对后授权本子代理扩展至 `ChestOpenScreen.cs` 和新共用纯判定 `CurrentChestProgress.cs`。现已按实际源修复领取和放弃后的流程：只在另有待领箱时切箱；最后一箱保留完成态与“继续探索”；单箱 small 单卡直接领取的自动完成仅限非战斗奖励，并须后续保存及续流全部成功才显示完成回执。`BattleBridge` 的战斗奖励与节点完成权保持在原消费者，未改 Core/Run。空箱的继续也按源 `boxResolved` 条件处理，不依赖提前设置的 completed 标志。

新 step 27 按稳定 `_roomNode` 重新读取 `nodeRewards[node].chestQueue[0]`（事务失败会重建对象，不保留对象引用），严格检查：

- 失败时 taken/lost/完成状态、金币和原档均保留；重试只发两张固定候选，各索引 taken 一次、lost 为空。
- fresh SaveSystem 读盘同时检查完成、候选、背包数量和金币；重复单卡领取拒绝，重复整箱领取不增加卡牌或金币。
- 源完成态仍停留当前奖励页，真实点击 `继续探索` 后才要求队列完成、页面退出和新读盘完成。

`source_chest_policy.mjs` 从现行实际 `run/chests.js` 提取 `boxResolved/cardsResolved/pendingBox/nextPendingBoxIndex`、`closePicker`、`next` 和单卡自动完成条件；源 SHA256 为 `fd42e9bde3b8cb28e913687c77e6aa462cae57dcee24309a637523e76cdf732e`。18 组向量覆盖最后多卡箱、单小箱单卡、战斗奖励、互斥与附赠、空箱、金币待收、多箱推进和放弃；C# 使用生产共用纯判定比较 108 项，PASS，无差异，见 `chest-source-vectors.json` / `chest-policy-result.json`。

最新完整私有类型检查仍为 0 错误、7 个既有警告。原生流程仍须 Root 重跑：纯判定向量不能证明 MonoBehaviour 页面、真实 uGUI 点击、原生保存与回调串联已通过。

## current-journey-1 的奖励点击诊断

Root 已实测 `current-receipts-4` PASS。随后 `current-journey-1` 走至四层、祭坛和首脑后，第 11 场战斗后节点 `3,9` 的第二箱选择页失败。原档显示第一箱 large 三卡均已领取，第二箱 medium `claimMode=one` 三候选均待选。脚本选中的 GO 名叫“收下”，实际文案是“选择”；不是已领取按钮或独立附赠。其中心 `(616,292)` 命中 `scroll`，没有 IPointerClickHandler，未点击成功。

该点按源固定布局应在视口内，但旧 trace 没有实际 mask 边界、Graphic.depth/cull，不能据此把原因判为滚动越界或渲染滞后，也没有失败当帧截图。已单独安装 Editor `RewardInput` partial，产品未修改：

- 每次选奖励前记录实际文字、卡牌、索引、屏幕边界、真实 mask 边界、Graphic.depth/cull，以及 Raycast 首命中和接收者。
- 首个待选项若中心在 mask 内且受阻，记录正常相机 Render 前后状态；Render 不修改场景或 sorting。Render 后仍受阻则保存失败图并停止，即使另有可点候选也不换项掩盖问题。
- 仅首项中心被可滚视口裁剪时才允许其他可见可达候选；没有可达项时向实际 Raycast 命中的 ScrollRect 派发 scroll 事件，每步记录位置和位移，再让真实页面更新。不会直接 Invoke、改 ScrollRect 位置或跳过领取约束。
- 原有 `Click` 仍执行首命中检查和真实 uGUI 按下/释放/点击；`choice`、`bonus`、完成继续由生产页消费者处理。

私有准备时已修正 Unity 6000.6 对 GetInstanceID 的编译错误，并避免将 Unity Vector/Rect 直接交给 JSON 造成循环属性。最终私有当前依赖检查 0 错误、7 个既有警告；安装后 SHA 与已编译私有文件逐字节相同。原因仍待 Root 下一轮原生 `current-reward-input-probe` 与失败图闭环，不能提前声明该问题已修复。

## 精确旧卡序奖励切换入口

`Sdt.Editor.CurrentMigrationFlowValidation.RunRewardTransition` 已安装，仍只改变 Editor 验证文件。Root 原生运行前，入口只读复制 Journey 1 的自产 profile 至本轮 `Output/profile-rewardTransition-<UTC>/`，校验原生格式、seed `169015024`、节点 `3,9`、两箱 large/all → medium/one 及每箱三卡，并记录源 SHA。原证据文件不写入。

Play 后通过真实 `LoadRun(5)` 加载副本，随后显式记录 controlled receipt reset：按精确 UID 移除 old large 箱已发三张，扣回两箱已收四币，清 taken/lost/completed/coinsTaken，chestIndex 复原 0，保留 battleWon、当前地点、随机状态、卡序和战斗续流权。背包剩余容量须至少容纳四张；基础收集历史保持原副本值，因此不用于收集数值平衡证明。预检数据见 `reward-transition-fixture-preflight.json`。

重放通过 `ResolveCell → RunLoopBridge → BattleBridge.ResumeRewards` 正式链，采用原 Journey 的约 220ms 操作节奏。large 创建和全部收下之间不额外截图/强制渲染；切 medium 后逐个验证三个候选的实际对象 Raycast，首项必须处于原 `(616,292)` 并按源序点首项。若常规首帧不可达，记录正常相机渲染前后；渲染后任一候选仍受阻则截图失败，不能换项。

最后用真实“继续探索”完成 BattleBridge 续流，fresh SaveSystem 检查 node completed、旧 seed、精确四张重发结果、金币回到原值和原文件 SHA 未变。输出 `reward-transition-source.json`、常规 flow trace、精确对象命中与重放夹具记录、选后和完成画面。私有当前依赖类型检查 0 错误、7 个既有警告；尚未由本代理启动 Unity，实际结果由 Root 后续原生运行确认。
