# Player2 最终菜单、指南与单档备份独立复查

结论：本次直接查看的 7 张新包正常 Standalone 原图及对应实际输入记录中，已知菜单/指南/备份项均闭环，本审范围内没有未闭环的确认 P1/P2。未使用旧 Player1 的 passed 或旧矩阵推断当前效果。

图片来自 `desktop-final-player-2`，passed=true、进程退出0；2560×1440、DPI120、正常 ScreenSpaceOverlay、CanvasScaler 1.33333、D3D12，Build GUID `38d6541a41004fd88bbf4438a283dccb`。宿主为零透明度、不激活、不接收系统输入。全页查看工具将原PNG缩至2048×1152显示；每张文件仍为2560×1440。

## 直接图像和执行核对

| 范围 | 结论及依据 |
| --- | --- |
| Guide第5章更多 | 正常背包与安全格中的可编组卡牌都能参与；容器需移回。与source battle.lifecycle.domain.js:419及Native BattleSession.cs:467实际无safe排除条件一致。 |
| 五档稳定取证 | slots-backup和returned-slots都显示01至05，05基地档操作和备份3动作均可见，无动画中断缺卡。Capture等待SlotPickerScreen .95秒后才读实际backbuffer。 |
| 导出/导入/预览 | 导出只读JSON、导入可编辑JSON、先预览且显式确认，来源档5/保存时间/覆盖警告均完整。文本、边框、底部按钮无重叠或截断。 |
| 实际构造输入与返回 | result中exportSlotArchive-5、slotArchiveBack、importSlotArchive-5、slotArchivePreview、confirmation-accept、slotBack都由EventSystem raycast找到同名接收者。输入JSON来自同档导出值直接赋值，未触剪贴板或OS。默认Cancel及完成后slots/唯一title由执行代码显式断言，passed仅在全部断言后写入。 |
| 正常上一备档恢复保全 | PreviewPreviousSlotArchive取.previous目标三分区且冻结值；Import复核磁盘和实例缓存一致、预览后指纹一致，再现有事务只替换目标run/base/settlement；File.Replace保留当前完整profile到.previous。正常现存主profile的其余四档/全局保留。此前31项真实生产DLL含previous target partition only；本次不把外部删除/损坏后连续恢复假设视为确认缺陷。 |

备份画面的新增布局保留选档页作为背景，导出/导入各自明确标题、说明、JSON区、固定底部按钮；预览确认显示来源档位、时间和覆盖提示，初始焦点为返回。未发现缺字、图标空白、按钮遮挡或大段文字挤压。新 `slots-backup` 已等到五档入场稳定，不沿用旧图只有三卡的取证时点。

安全卡编组文案已实际出现在新图中。源 `prepareDeckSelection` 和 Native `PrepareDeckSelection` 都排除 stored/pouch 与不可编组类型，均不排除 safe；本次据实际过滤条件判定文案修正成立，未照抄源旧 prose。

## 备份与返回边界

Source `menu-slots.js`/`save-management.js` 的活跃流程是单档导出、预检、明确确认、刷新；本机新档沿同一流程使用 JSON 输入适配。Source 多 localStorage 键中断日志在当前单文件原子替换下不需另造 journal，未引入 Web 旧档兼容。

代码检查了 `ArchiveWritable`、冻结预览、目标三分区替换、事务和 `AtomicJsonFile`。在正常存在且可读的主profile上，目标恢复不会改变另外四档或全局；提交还保存整份恢复前profile至.previous。既有生产DLL31项中上一备档目标分区隔离通过；本次没有为外部删主文件、全局损坏后的假设扩展验收结论。整份损坏拒绝局部覆盖并保留原始文件。

正常实际 UI 路径为基地→选档→导出→返回→导入→校验预览→确认→选档→主菜单，最后真实画面为完整首页。正式验收代码只在默认Cancel、导入完成回slots、最终唯一Title且Phase为title都成立后写passed。这里的“默认返回”是选中状态和显式断言，并没有伪称本次实际点击取消按钮。

完整输入、文件SHA256及观察范围见同目录 `visual-final-player2.json`。本审未启动Unity、修改Assets、前台操作、触系统剪贴板、硬件输入、构建或多尺寸测试；其他图片归其他独审范围。

## 本次直接查看的图片

- `player-guide-more-4.png`
- `player-slots-backup.png`
- `player-slot-archive-export.png`
- `player-slot-archive-import.png`
- `player-slot-archive-import-preview.png`
- `player-returned-slots.png`
- `player-returned-title.png`

- result.json SHA256：`a6e543301350f828598243c959592a7b422d649fe54d88e2549efe89e6b2d0e6`
- process.json SHA256：`e7db9c4c0462f67a0ef933e6d33ed31e3f3090342fb16330f422ca769923b5eb`
