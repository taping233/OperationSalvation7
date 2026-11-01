# 照片导出 UI 独立只读复核

截至本报告所读版本，未发现需要退回修改的确定问题。本片未改生产或检查源，未编译、运行检查、启动 Unity/Player，也未操作剪贴板。卡牌/备注 payload 的纯服务契约由 Run 审查，本片只核调用、快照使用及 UI 边界。

## 已核实的生产链

- `PhotoStudioExports.cs:17–50`：工具只在开发模式显示；打开动作复核图库实例、启用状态、`_leaving`、State 引用、slot、开发资格、栈顶和工具展开状态。开关只变现有控件，不重建图库。导出页保留原图库及筛选。
- `CardLibraryScreen.OnClose:207–211`：正式关闭立即置 `_leaving` 并按原 State/slot/modal 条件恢复 phase。`UiStack.Close:115–135` 先出栈，再 OnClose、失活及延迟 Destroy，因而同帧关闭后新图库取得 modal 不再被旧 OnDestroy 覆盖；旧图库工具事件也会被 `_leaving` 拦截。
- `PhotoStudioExportScreen:64–70、97–127`：每次打开为新实例。动作均复核 Live；Live 同时含 `_closed`、当前栈顶、启用状态、原图库存活及其当前资格。OnClose 在 Destroy 前置 `_closed`，返回焦点只作用于仍有效的原图库按钮。旧导出实例不能借同名新按钮写入或关闭新页。
- `PhotoStudioExports.cs:82–94、102–118`：进入时只生成一次 `_payload`。文本区最多显示 8000 字符加明确截断提示；复制与文件调用都用完整 `_payload`。导出失败不清除 payload 或禁用按钮，保留同一 `_file` 重试。成功置 `_written` 并禁用文件按钮，直接重放旧 UnityEvent 也由 `_written` 拦截。
- 新输出子目录含时间和 GUID，文件名保留 `sdt-cards.json` / `card-notes.json`。`AtomicJsonFile.cs:13–25` 首次目标不存在时走临时文件 Move；只有已存在目标才走保留 `.previous` 的 Replace。正常单快照成功后不重写，因此不制造无用 `.previous`。沿用正式原子写入，没有新增降级路径。
- `CurrentArchiveUi.JsonArea:48–55` 与 `CurrentSlotArchiveScreen:24`：抽取的控件层级、尺寸、遮罩、明文显示、MultiLineNewline、只读条件及 20,000,000 字符容量与原 MakeArea 相同，整档字段名称仍为 `slotArchiveJson`。照片页只在自身赋值前截断预览，没有修改整档实际导入/导出值。
- `PhotoDetailScreen.CapturePendingNotes:20` 返回 Pending 的独立字典副本；导出 UI 读取该快照传纯服务，没有调用 SaveNote 或把会话草稿标为已保存。

## 检查源有效性与尚未运行的边界

`CurrentPhotoExportRound5Checks` 通过真实 `ExecuteEvents.submitHandler` 操作活动可交互按钮，不仅调用 onClick。含正常模式隐藏入口、同帧图库替换及下一帧 modal、空筛选下完整卡库、受限预览、完整文件、真实 `.writing` 目录故障、恢复后重试、无 `.previous`、成功/关闭后的旧事件、真实写失败 Pending 导出且不落盘、资格撤销时拒写和后续 Pending 重试。它明确只检查复制按钮可用，不读取或写操作系统剪贴板；不将构造 Submit 记为物理输入。检查源当前未执行，不能据源存在计通过。

`NativeDisplayReview.PhotoStudio.cs:23–53` 在正式图库入口幕布结束后操作工具；五次 Capture 分别覆盖工具区、卡牌预览、写入回执、备注预览和返回图库。共享 `ClickButton` 会 ForceUpdateCanvases、用 RaycastAll 核目标按钮的实际接收者后发送构造 pointerClick；共享 Capture 等幕布结束，强制布局后等待三帧及 EndOfFrame 才读取实际后缓冲。文件写入后独立读 JSON，核完整卡库/底稿数量。当前只是待运行探针，不预先认定射线、实际画面或 I/O 成功。枚举输出文件使用 Single，按本轮独立新 profile 的前置执行；不把重复复用已有输出目录当作验收支持范围。

本报告未扩大到 OS 物理输入、剪贴板集成、所有外部 I/O 故障、所有读写 payload 细节或多尺寸。运行后的结果与图片仍由 Root 统一绑定最终源码及构建标识。
