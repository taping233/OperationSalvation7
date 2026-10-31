# 首页、选档、基地活跃入口：独立代码审查

本轮只读当前源码和实际调用，不继承旧矩阵、历史passed或截图结论；未改Assets、未运行Unity/构建/浏览器。所有发现已即时发Root，原生验证与修复由Root统一处理。直接读取指纹见inputs.json；哈希只标记所读文件版本，不代表逐行穷尽。

## 确证问题

### P2：从基地回选档，再返回主菜单会留下空UI栈

标准路径：首页进入选档→开新档或进入基地→基地左上返回选档→选档左上返回主菜单或ESC。

- 原版 `game/src/ui/menu-slots.js:358` 的slotBack明确关闭overlay并showTitle，始终恢复首页。
- Unity `CurrentSlotPage.Launch:106–108` 进入基地时关闭previous全部面板，包括原TitleScreen。
- `HubScreen.Back:62` 只关闭基地并压新的SlotPicker。
- `CurrentSlotPage.BeginClose/Leave:115–117` 只调用原_close（Panel.Close），依赖首页仍在下层。第二次选档已无首页，关闭后UiStack空，Phase仍modal。
- `UiStack.Close`与`App`没有空栈自动恢复标题逻辑。

复用建议：选档“返回主菜单”的完成动作走现存 `App.ShowTitle:93–98`。该入口清栈、调用运行时ShowTitle并创建TitleScreen；单独 `GameRuntime.ShowTitle:1229–1235` 只改状态和音频，不创建页面。应原生验证初次选档取消、基地往返取消、已存档/新档两条路径，确认只保留一个标题owner且不清空档案。

### P2功能遗漏：选档的整档备份与恢复尚未迁入

原版不是死代码或未注入的可选功能：`run/game.session.js:58/138` 创建并导出saveArchive，`ui/game.menu.pages.js:55` 注入选档，`menu-slots.js:18–23/200` 为每个档位呈现并绑定“备份与恢复”；异常档catch分支同样保留它。`save-management.js` 实际提供导出、预检导入、确认覆盖、有效上一检查点恢复及中断导入前原串恢复。

Native `CurrentSlotPage.BuildCard:75–80` 只提供进入/覆盖重开/删除，异常档没有恢复动作。全 `Sdt.Run` 没有对应slot archive服务。用户“不带Web旧档”只排除旧格式兼容，不能证明Unity自身无需这项功能；MIGRATION也明确可靠新档恢复在范围内。

## 备份最小复用与原子性边界

源 `hub/save-archive.js:12–14` 只捕获当前slot的base/run/journal/previousRun/corruptRun/corruptBase/preservedBase/preservedRun/importRecovery，不导出全局设置。导出是原串保全，因此损坏档也能导出；导入才做格式、版本、字段完整性、SHA256、base/run/map/待撤离身份校验。预览持有目标原串，确认提交时拒绝目标已变化；多键写入前保留恢复journal，失败回原串，冲突时停止保留现场。

Native可按自己的结构和已授权边界适配：

1. 使用新的桌面slot archive格式；不接受或迁移Web旧档，不增加云端服务。
2. 当前profile是一个完整原子文件，slot实体是 `runs[slot]`、`global[BaseData.SlotKeyPrefix+slot]`、`settlements[slot]`。应把当前slot三部分作为一个payload；不要把整profile覆盖回目标，避免改掉其他四档和全局偏好/照片备注。
3. 复用 `SaveSystem.Begin/CommitTransaction`、`AtomicJsonFile.TryWrite` 的同目录flush+replace以及已有 `.previous` 完整备档。源多localStorage键journal解决的问题在Native单文件提交可由现有原子写处理，无需另建重复事务框架。
4. 跨slot导入必须明确绑定目标：Native `ReadSlot` 强制run.slot==index，战斗重启还有嵌套checkpoint.run.slot，settlement也有run和slot:seed身份。不能只替换外层字典key；需核对并调整相关身份后完整验证LoadRun和待整理恢复。
5. 预检不写盘；确认包含来源slot、保存时间、覆盖目标；提交时复查目标快照仍一致。文件锁/写失败应保持全部目标与其他slot不变，重试不重复奖励。
6. 异常全profile触发HasReadError时，不能从空占位_profile写回“修单档”而丢失其他档。先保全原始字节，解析有效previous并明确整profile恢复边界；上一备档也不能直接整文件替换来冒充只恢复一个slot。
7. `ImportExportOverlay` 是CardLibrary专用，导入还被CardEditingEnabled关闭；可复用UIKit多行输入、复制、写持久目录等已有UI部件，但其CardDef parser/Upsert不是档案服务。无需打开已关闭制作坊或借用卡牌导入业务。

必要验证：五档串存、跨档导入身份重绑、战斗入场检查点、撤离sorting/complete记录、旧preview过期、损坏/较新版本/错误checksum拒绝、写失败后原profile与其他档不变、损坏档可导出保全。

## 直接核对但未据此认定旧版的部分

- 当前 `TitleScreen.Build` 活跃使用左右command/support、七壁纸层、wordmark、当前菜单项、底部静音/信箱/壁纸与只看壁纸，不是历史居中菜单壳。`CurrentHomePlate` 已接当前新增灯光/扫光/呼吸逻辑。没有原生画面验证，不宣称每个像素或动画相等。
- 基地实际 `HubScreen.Build` 走七目的地公共壳与Current专用页；`BuildDeploy` 的事务卡、人物/携带摘要、整备、难度、预设、待复原与 `hub.home-v3.js` 结构对应。基地operations-v5图是源活跃资源，不因名称旧判错。
- Base导航七项及顶部资源顺序与 `hub.navigation-v7.js` / `game.hub.runtime.js` 一致；研究所第二地图按已定范围排除，未将源条件按钮缺失当本轮缺陷。
- 没有把无生产调用旧类计作玩家界面，也没有只按旧version-matrix的历史结论报告整改。

未覆盖：人物/仓库/交易/收藏/建设/庭院每个详细命令、全部最终CSS规则与硬件键盘导航；本轮只做首页→选档→基地壳/返回与档案恢复的高信号检查，不能据此宣布基地完整同态。
