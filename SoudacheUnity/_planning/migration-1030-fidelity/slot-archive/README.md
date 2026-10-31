# 桌面单档备份与恢复

已补齐原版选档页活跃的整档导出、导入预检和确认流程。仅接受 Unity 桌面新档格式，不兼容 Web 旧存档。生产与正式 Editor 探针已冻结，指纹见 `freeze-manifest.json`；尚未在本代理运行 Unity，主线集中执行原生与实际播放器验证。

## 复用与平台适配

- 对照现行 `menu-slots.js`、`save-management.js`、`save-archive.js`、`page-slot-select.css` 和 `confirm-dialog.js`；来源指纹在 `source-inputs.json`。
- 同一 `profile.json` 内，仅替换所选档位的 `runs[slot]`、`global[sdt-base-v2-slotN]` 与 `settlements[slot]`。其它四档、全局设置和照片备注均保留。
- 复用现有 `BeginTransaction/CommitTransaction` 和 `AtomicJsonFile`，整档一次原子替换。原版多 localStorage 键的中断导入日志不搬到单文件架构；“恢复上一备档”从既有 `profile.json.previous` 读取目标档位，仍先预览并确认，只恢复该档。
- 提取已有 `ReadSlot` 的验证块到 `ParseValidatedRun`，正常读档和归档预检共用。独立审查已与提取前快照逐行核对语义一致，未另建一套对局校验器。
- SHA256 校验完整性、预检令牌冻结目标数据，导入前再次验证。真实磁盘必须与该 SaveSystem 实例已知的持久快照一致，陈旧缓存不能用新文件指纹覆盖其它窗口的改动。
- 跨档只重绑实际身份：主对局 `slot`、战斗入场快照 `run.slot`、结算 `run.slot` 及 `slot:seed` 身份。卡牌 UID、随机状态、地图与奖励回执保持原值。
- 归档特有的结算结构校验覆盖实际恢复/报告消费者：待整理和保留牌堆、概率数量、收据净带回/损失/卡牌列表、纪念与战斗摘要。合法 checksum 不能绕过结构校验。
- 单档异常仍可导出原始分区或用有效备份修复。整份 profile 无法解析时拒绝单档导入，保留原始文件，不用空档覆盖未知的其它四档。

## 界面

每个档位包括异常档都有“备份与恢复”展开入口。导出支持复制和持久目录 `desktop-v1/exports` 下的独立时间/随机文件名；导入沿已有桌面多行 JSON 输入方式，先校验预览，再复用正式确认组件明确确认。确认初始焦点为返回，取消回到来源控件。

归档窗口复用现有 uGUI、档案样式与确认框；未接被禁用的卡牌编辑导入命令。文本框复用弹性布局，底部操作固定，长提示能增高。选档重建和窗口返回按稳定动作名恢复焦点，并保护反馈覆盖层。

稳定动作：`slot-archive-N`、`exportSlotArchive-N`、`importSlotArchive-N`、`slotRecovery-N`；窗口 `SlotArchive`，输入框 `slotArchiveJson`，`slotArchivePreview/Copy/Download/Back`；确认组件继续用 `confirmation-cancel/accept`。

## 验证

- 私有生产及正式 Editor 类型检查通过，0 error，5 条既有增量 warning；`editor-check.log`。所有新增 `.meta` 已提供。
- 真实生产 DLL 在隔离目录执行 31 项，`data-run-221255/result.json`：五档隔离和全局保留、跨档身份、预检不写盘、明确确认、一次消费令牌、真实文件锁失败与重试、无效格式/校验/基地/对局拒绝、checksum 合法但不可恢复的结算结构拒绝、陈旧预检和陈旧实例、上一备档、单档坏数据修复、整份坏串保护。该结果不是 UI、Unity 或 `LoadRun` 证明。
- 最早私有执行因构造 BaseData 时触发 Unity Resources 内部调用，改为复用本轮已生成的隔离原生快照；随后实际执行找到显式 JSON null 的 checkpoint 子节点访问错误，已改为 `JObject` 形状检查。保留失败日志，不计为通过。
- 正式原生入口 `Sdt.Editor.CurrentSlotArchiveValidation.Run` 已落盘并类型检查，待 Root 执行：真实五档 NewRun、文件锁、跨档实际 LoadRun、实际战斗入场快照恢复、实际 DoExtract 待整理恢复、两实例保护及坏整档保全。受控地图/敌人与硬件输入边界在探针结果中注明。
- Root 负责正常 Standalone 界面取证与最终默认桌面构建。本代理未启动 Unity、构建或前台操控，未修改 Vite、提交或删除文件。

API：`ExportSlotArchive(slot)`；`PreviewSlotArchive(text,targetSlot)`；`ImportSlotArchive(preview,true,out reason)`；`PreviewPreviousSlotArchive(slot)`。失败不会消费预检令牌或取消调用方已有事务。
