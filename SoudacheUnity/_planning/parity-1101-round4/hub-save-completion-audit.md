# 基地、五档与恢复：完成审计及本轮补口

结论：现行迁移范围内的本地五档→基地准备/收藏交易→死亡或撤离入库→备份/清空/恢复已有正式入口和已验收基线。本片只确认一个新的实际缺口：目标与预设页的旧按钮/输入回调归属不足；主会话已授权最小修正，源码及专用回归源已补，等待集中验证。没有把旧 Web 档、远端账号、研究所第二图或关闭制作坊列为缺项。

审计范围沿现行 MIGRATION。Vite 为只读基线 HEAD `f966e859043b7ab3703839005029ef090a4677b5`，不转译四个动作帧/idle 在途改动。当前验收播放器 GUID `cfbe07ccdc1147f28801339933512ee0`；Round2 的 `a529e27adc834c58a21f47beebe94436` 只作历史基线。没有新编译、测试、Unity 或播放器执行。

## 当前完成要求与证据

| 玩家路径 | 当前必须满足的结果及源码入口 | 已有证据与边界 |
| --- | --- | --- |
| 标题/五档 | 本地档案、五个独立 slot；新档入基地，存在对局则恢复；覆盖/删除需明确确认，失败留原档。Vite `menu-slots.js`、`menu-slot-view.js`；Unity `CurrentSlotPage.Launch/Confirm`、`GameRuntime.EnterSlot/ResetSlot/ClearSlot` | Round3 正常 Player passed，标题→五档→返回均有 capture；当前归档视觉复核包含 returned-slots。现役菜单未发现远端账号登录消费者，不把云账号作为移植完成条件 |
| 基地准备与出发 | 人物/伙伴资格、真实库存及容量；两个固定预设、至多三个收藏目标；应用后仍经正式整备确认。Vite `game.hub.preparation.js`、`preparation.commands.js`、`base-departure.commands.js`；Unity `PreparationScreen`、`BaseData.Preparation`、`DepartPrepScreen`、正式 departure projection | 已验收领域/原生基线覆盖容量与变体身份；当前 Player 没有专门“目标与预设”编辑 capture。本轮新增旧回调/失败编辑补口须独立集中验收，不能借历史 passed 结案 |
| 仓库/收藏/交易 | 仓库详情不直接卖；保护不耗牌、不加 XP，取消不删收录；转化显示实际成长/溢出；出售按稳定 ID+variant、正式售价和确认条件，失败回滚。Vite `game.hub.pages.js`、collection/交易正式命令；Unity `HubCurrentInventory`、`HubCurrentTrade`、`MetaProgress`、`BaseData` | 当前 Round3 Player 保留 variant-stock、warehouse-actions、trade-variant/base-variant、conversion-overflow、restore-unbanked-keys 与 returned-base 场景；Round2 Hub 472 领域基线及本轮整体回归通过。不把每张图生成等同逐张人工复核 |
| 死亡/放弃入库 | 安全抢运/损失/成长/收据形成同次持久结果；同一 settlement 不重复发放，失败保留原局。Unity `GameRuntime.Settlement.DoDeath/AbandonRun`、`SettlementMutation`、死亡/结算正式页面；Vite 失败结算与现行 settlement 命令 | 正式生产仍走既有 TryPersistMutation 和已存 settlement 身份重放；领域/旧原生作为行为基线。当前 Round2/3 正常 Player capture 名单没有死亡页，不声称这两轮已拍到死亡→基地的完整画面链 |
| 撤离整理→基地 | 同名不同 variant 分别入库，真实仓库余量，整理进度与最终回执可恢复；明确放弃余牌才结束，重放不再发奖。Vite `extraction.commands.js`；Unity `DoExtract/ExtractStore/FinishExtract`、`CurrentExtractionPage`、`ExtractScreens` | 当前 Player 有 extraction 与 returned-base，正常构造流程通过；结算身份、容量和原子保存沿既有领域/原生回归。截图不能证明断电/损坏恢复或全部概率分支 |
| 导出/导入/上一备档 | 正式 v2 档包携带引用自定义定义闭包，预检冲突/目标变化/缺待领定义，确认后与 slot 同事务；保留其他 slot/global；Unity 原生三分区 v1 可读，不兼容 Web 旧档。`SaveSystem.SlotArchive/ArchiveCards`、`CurrentSlotArchiveScreen` | 已验收跨空 profile 独立进程 39 项及原生 Archive10，本片直接复用，不重查已闭合定义链。当前 Player 归档 v2、导入确认、返回档位三张已人工复核；普通图包没有自定义迁移夹具 |
| 清空/可靠失败 | 设置分开清空便签、自定义卡库、五档；明确确认，写失败报错，不能提示成功后丢失原档。`CurrentSettingsPage.General/Confirm`、`ClearAllSlots`、`GlobalStore.FlushGlobal`、`AtomicJsonFile` | 失败通过正式事务/Flush 抛错反馈，不加旧 fallback。全局不可解析 profile 仍以保全原文件及诊断为先；不宣称 UI 可自动修复任意损坏文件。当前 Player 没有独立危险清空及整文件损坏恢复 capture |

证据入口：父项目 `docs/evidence/2026-11-01-unity-parity-round{2,3}/README.md`、Round3 `final-summary.json`、`native-round3-final/result.json`、`native-round2-regression-2/result.json`、`native-shared-regression/result.json`、`player/result.json/trace.json`、`visual-archive.json`。当前已登记领域 986（含 Hub472、Archive39）；新增原生 131（奖励54/商店42/战斗25/归档10）及既有375+48通过。数字属于对应冻结基线，不包含本片新检查。

## 唯一确证补口与最小实施

旧 `PreparationScreen.Current` 只检查 Base 引用及 slot。在同档 Base 不变时，关闭后保留的 goal-remove/goal-add UnityEvent 可以继续 TrySetTrackedGoals；重绘后的旧输入 onEndEdit、预设按钮也没有页面代次检查。普通鼠标不能点击已失活旧物体，本缺口是明确的陈旧事件重放条件；不声称已用物理输入复现。现役 Vite preparation feature 的 isCurrent 包含 generation、root 连接、当前页面及会话，dispose 递增 generation。

现只修改 `PreparationScreen.cs`：

- 按当前 owner、启用、栈顶、Base、slot 和 render revision 统一守卫所有追踪按钮、输入、Dropdown、预览/应用/返回；Build 在失活旧内容前先更新 revision，OnClose 再递增，旧事件保留旧代次。没有仅依赖禁用物体。
- 保存/追踪同步事务后再次核 owner 才写本页反馈。失败保持现有输入、焦点与错误；预设编辑是本面板的 detached 草稿，重绘仍保留，重新提交原编辑即可走正式保存重试。未保存的草稿不应用到出发；真实预览及应用仍复查当前库存/资格。
- 成功的编辑提交延后一帧重绘，避免在 InputField 结束编辑/Dropdown 回调中拆自身；保留滚动与控制名称焦点，若用户已移到另一有效控件则不抢焦点。保存失败不会重建整页。

无新增存档字段、库存缓存或通用框架，没有顺带改其他领域。其他主流程未在本片确认新的生产缺陷；画面/硬件/任意损坏恢复的未覆盖项保留为证据边界，不凑成新功能待办。

## 待集中验证

正式新源 `Assets/Editor/CurrentPreparationRound4Checks.cs` + meta，入口 `Sdt.Editor.CurrentPreparationRound4Checks.Run()` / `Assertions`。由主会话提供真实 Play 循环和隔离 profile；构造 EventSystem submit 与单独的旧 UnityEvent 重放分别记录。

覆盖：正常返回基地；关闭→同档新页旧按钮/输入无效；重绘→旧追踪按钮/Dropdown/编辑/预览无效；覆盖面板不写原编辑；真实 profile I/O 失败保全 Base、磁盘、RNG、输入对象/值/焦点与错误；重绘保留失败草稿；当前输入重新提交成功并清错误；成功后旧失败事件仍不能写入。没有自行运行；后续集中原生及当前窗口画面结论另记。冻结源指纹见 `preparation-freeze.json`。
