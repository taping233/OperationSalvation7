# 首页、设置、照片及成就：本轮完成审计

2026-11-01。按现行Vite入口核对Unity实际消费者。结论：01、11–14已有正式页面；本次确认照片与留言的旧回调归属、照片入场抢焦点两处补口，已修改，等待全批集中验收。没有把早期24页矩阵中的历史缺项重新认作现状。

| 页/路径 | 当前正式实现与行为 | 已有证据及本轮补口 |
| --- | --- | --- |
| 01 首页→档位/指南/收藏/系统/信箱 | `TitleScreen`、`CurrentHome*`、`HomeInboxScreen`、`HomeInboxDeleteDialog`；源为`game-title-controller.js`、home-menu及menu-feedback。壁纸模式、脚注动作、启动过场和返回链沿正式入口。留言留在本地Global，删除经确认，失败留原记录及错误 | Round3正常播放器有标题及返回链，历史共享原生验证页栈/输入/音频。旧留言行回调以前可在重绘/关闭后重放；本次统一owner/渲染代次，确认先关闭后复查owner再写。重绘先失活并移除旧树，减少同帧重复布局/绘制。专用`CurrentInboxRound4Checks`待统一运行 |
| 11 设置 | `SettingsScreen`承载`CurrentSettingsPage/Dialogs`及实际音频、输入、性能偏好消费者；四分类、危险操作、音量、键位冲突和失败反馈已接正式持久入口。`Current`/`Release`约束owner与监听生命周期 | Round3正常播放器设置画面、既有音频/输入/原生性能验证是已验基线。本轮未改；不把原版网页专有入口当成必需桌面能力。原生压缩比上限10与源12的既有平台差异保持公开记录 |
| 12 照片馆 | `CardLibraryScreen`及`PhotoStudioWall/Dossier/Motion/Room`；正式目录、筛选、搜索、虚拟化挂载、选片台及返回定位，源为`game.cardslib.page.js`和photo-studio系列 | Round3有正常播放器`player-photo`，并非逐卡截图。打开/返回及关闭端复查当前owner，打开先确认筛选成员。挂载范围及卡片尺寸未变时不重复扫描/摆放，复用移除键列表替代LINQ临时数组；筛选统一清树并失效局部缓存。仅该函数稳定100次更新的分配待验，不作整帧收益声明 |
| 13 照片详情/备注 | `PhotoDetailScreen`；源为`card-zoom-controller.js`、`card-photo-notes.js`。原图纸片、背签、键盘前后导航、240字自动保存/清空回到底稿、写失败保留本次会话草稿 | 备注Global跨槽共享是正式行为，固定Runtime/Global无需新增slot隔离。旧InputField回调读取当前`_index/_note`、旧关闭按钮可作用于新画面，本次用渲染代次拦截。正式OnClose在对象失活前保存，关闭动画已保存则不重复写；应用退出仍保存。入场结束保留用户已选择的页内控件。`CurrentPhotoRound4Checks`覆盖这些条件及真实写失败/重开/原值重试，待集中运行 |
| 14 成就 | `AchievementsScreen`、`CurrentAchievementPage/Grid/Motion`；源为achievement-gallery/medals/motion，最近游玩档位只读展示、筛选/类别/网格列表/详情与返回，实际领取在基地正式命令 | 既有原生及播放器基线可用于页面存在和正常入口，本轮未发现新的持久写入口或确证生产差异。不声称逐个成就条件/平衡已穷举 |

现行要求和边界仍沿`MIGRATION.md`。24页覆盖由本表（01、11–14）、`hub-save-completion-audit.md`（02–05、07、15–17及恢复）、`run-completion-audit.md`（02、06–10、18–24）、`battle-turn.md`（23–24本轮补口）共同索引。表中“已有”对应Round3冻结基线，不自动覆盖本轮未执行代码。Round4统一结果另记证据目录，不能将待验断言写成通过。

`operation-inventory.json`仅核生成卡规则声明与当前执行器case名：58个声明op、0个未匹配。它是遗漏筛查，不能证明每个op的领域位置、数值语义、所有卡组合或全部动态内容等价。相关行为仍依赖领域断言、可达调用链和正式原生流程。

保留的工具差异：Vite照相馆开发模式还有卡牌导出层与`card-notes.json`底稿回填导出，Unity目前没有这两个入口；普通浏览、备注保存及原生整档备份已有实现。它们不计作本轮玩家流程已实现项，后续对照应单列资料制作工具，不能因为24类玩家页已接齐就声称整库零差异。源中仍为空函数的制卡/删除/导入钩子不直接照搬成桌面空入口。

后续性能候选：`BaseData.TrySavePhotoNote`目前仅修改Global备注，却经`GameRuntime.TryPersistMutation`序列化整局、基地、撤离清单和战斗checkpoint。普通设置和信箱已经使用Global自身的原子持久入口。下一批应先核备注事务的实际观察者/失败约束，再考虑共用该入口减少无关序列化；本轮开始集中验证后不再追加这项生产重构，不将候选写成已优化。

本轮不承诺物理键鼠、多尺寸、每张卡/每个事件穷举、整帧GC或FPS收益；这些是证据边界。研究所第二图、关闭制作坊、Agent和旧网页档兼容继续按现行范围暂缓。
