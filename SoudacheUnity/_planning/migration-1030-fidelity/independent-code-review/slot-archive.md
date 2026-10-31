# 独立审查：桌面单档备份与恢复

本轮找到的陈旧实例覆盖其他档位 P1、坏结算通过预检 P2，均已由作者修复并经独立静态复核闭合；所查范围没有剩余可证阻断。已读作者真实 DLL 数据检查的 `passed 31` 记录，其中包含本轮恶例；该记录不替代 Root 的原生验证。本报告没有运行 Unity、构建或前台工具，也没有修改生产文件。

实现范围为 Unity 桌面单档的基地、对局、结算三分区；明确拒绝 Web 旧档。源 `hub/save-archive.js` 与 `ui/save-management.js` 作为流程依据，桌面单 profile 的原子替换及 `.previous` 备份沿现有存储机制。

## P1：预览之前的外部更改会被旧缓存覆盖（静态已修）

旧实现的 `EnsureLoaded` 只在 `_profile==null` 时读盘。A 实例先读旧档，B 实例随后修改非目标档或全局；此后 A 的 Preview 从旧 `_profile` 取 Before，却从新磁盘取 ProfileHash。Import 时这两项各自仍相等，最终将旧的其他档/全局随目标档一起写回，丢失 B 的更新。

这是实际两实例/另一进程写盘的可达情况，不依赖反射或伪造预览。源实现按当前目标键读取并只替换目标键，不存在整 profile 回写旧缓存的问题。

作者增量在 `ArchiveWritable` 中解析当前磁盘，与实例 `_persisted` 做 DeepEquals；export/preview/import/previous-preview 均经过该入口，陈旧实例在绑定新的磁盘指纹前即拒绝。文件缺失、外部新盘无效等情况同样不能被旧缓存接纳。静态闭合；作者私有检查中“两实例写非目标 run/global 后旧实例拒绝 preview”一项也已通过。

## P2：坏结算可通过预检并在读取时崩溃（静态已修）

在合法 sorting/extract 备份上，把 `settlement.keptPocket` 改为 `[null]` 并重算合法 checksum。初版 ValidateArchiveValues 只检查 `record.left`，没有检查 keptPocket；Preview 与 Import 均可成功。随后进入该档，经 `GameRuntime.LoadRun` 的待整理分支到 `BuildExtractResult`，`GameRuntime.Settlement.cs:53` 的 `Where(s => ... s.card ...)` 解引用 null。

另一个直接案例是存在 receipt 时将 `receipt.losses` 置 null：初版预检允许，`BuildExtractResult:54` 读取 `receipt.losses.pocketLost` 时崩溃。并非仅展示文案不同，导入会替换原本有效的目标档，并使待整理恢复失败；上一备档仍可救回，列 P2。

源 `save-archive.js` 的 validateArchivedRun 调用 `validatePendingExtraction`，`hub/extraction.commands.js:40-50` 校验 keptPocket 的每条 stack、requestSeq 以及 total/lost/kept 的一致性。桌面结算结构不同，应按其真正读取链补 stack、计数与 receipt 必要组的结构验证。已要求作者加入两项重算 checksum 的坏数据拒绝测试，并证明磁盘不变。

增量复核：`ValidateArchiveValues:95-100` 以 ValidStacks 拒绝坏 left/keptPocket，校验 requestSeq、来源版本及 long 求和后的概率计数；`ValidateArchiveReceipt:107` 拒绝 null netTake/losses 和坏 savedCards/notable，并检查实际渲染消费的 memento/review 结构。这些检查均在 `BeginTransaction:68` 之前；我的两项恶例已静态闭合。作者实际 DLL 检查新增四项重算 checksum 恶例（null kept、null left、null losses、计数不一致），拒绝时磁盘保持原样。

## 校验提取精确性

独立找到提取前 SaveSystem 快照：capacity-focus、recode、startup 三处保存的是同一份 SHA256 `59e25a122eea12fc8029a724464704a035078bdfe8fe7dfe2649fa424cc566e5`，三份不是三个不同版本的基线。

`slot-archive-extraction-check.py` 仅读文件并逐行比较，忽略行首缩进及空行：

- 原 ReadSlot 从格式判定到 `return raw;` 的整个校验块与新 ParseValidatedRun 精确相等。
- 原 ReadSlot 只把该块替为 `return ParseValidatedRun(token,index);` 后，与当前完整 reader 外壳精确相等。范围检查、settlement sorting fallback、异常诊断均保留。
- 规范化校验块 SHA256：`eeb1b670a2058a8a4c2a54c3675773422e9b62f5db2206e57774b9a07e99e7da`。

执行结果见 `slot-archive-extraction-result.json`。这项检查没有编译或执行 C#。

## 其余已核边界

| 范围 | 静态结论 |
|---|---|
| 三分区及全局 | SlotValues 只提取目标 base/run/settlement，Import 仅 SetPartition 目标三个键；其他档及其余 global 不在赋值范围。整 profile 提交以磁盘新鲜度检查为前提 |
| preview 后变化 | 比较目标 Before 和整个 profile 字节指纹；当前状态变化后拒绝，快照不公开给 UI 修改 |
| 明确确认与 token | confirm=false、其他 Owner、null 或已 consumed 预览均拒绝；只在 Commit 成功后设置 Consumed=true |
| 坏包 | 格式/version/sourceSlot、三分区形状、SHA256 均在写入前检查；Web 格式明确拒绝 |
| 跨 slot 身份 | 改写 run.slot、battleRestartCheckpoint.run.slot、settlement.run.slot 及 settlement.identity；改写后再次验证。battle 入场对象中没有其他 slot 字段，卡牌 UID 不因换档重生成 |
| 坏目标修复 | 单档读错可以用已校验备份替换；只在自有事务中清该 target 的读错标记，失败恢复读错快照 |
| 整 profile 读错 | RequireWritable 在分区修改和清目标错误之前拒绝 HasReadError，不能从未知其他档内容拼一个新 profile |
| I/O 失败 | 三键先在内存自有事务内替换，File.Replace 成功后才消费 token；失败恢复 _profile 和 slotReadErrors，允许原 preview 重试。不会取消调用方原有事务 |
| `.previous` | 读取上一完整 profile 后仅提取目标三个分区并走同一预检；不把所有其他档整体回退，不引入 Web journal |
| UI Live 与刷新 | 普通动作要求该 archive 页为栈顶；确认回调还检查 owner/current，后端校验 preview.Owner。导入成功后隔帧关闭导入页，OnClose 仅在原父面板仍为栈顶时刷新 |
| UI 回焦 | CurrentSlotPage 记住 archive 操作名，刷新后隔帧按 revision/Ready 恢复，且不抢 SuggestionBox 输入。确认框的首次键盘焦点留集中原生验证 |

## 集中原生验证建议

1. 正常导入、取消确认、导出页返回、恢复上一备档之后，核对五档摘要、目标操作回焦、后台页面未误触，以及确认后仅刷新原父页面。
2. 真实 1→4 导入普通 run、battle entry、pending extraction；逐键比对非目标的四档 base/run/settlement 和所有其他 global，检查 checkpoint 与 settlement 的目标身份。
3. 保留 preview 后修改目标/非目标/全局应拒绝；A 缓存后让 B 改其他档和全局，再由 A 开始 preview，也应拒绝且磁盘逐字不变。
4. 锁住 profile 后确认导入必须失败且不消费 token；解锁后同 token 只成功一次；外层事务存在时拒绝，不取消外层事务。
5. 坏 checksum、Web 包、无效地图/UID/battle entry、坏 base stack、keptPocket=[null]、receipt.losses=null、错误概率计数和整 profile 损坏，均需显示失败、磁盘不变。所有数据和文件锁仅用隔离档案目录。

作者私有执行与 Root 原生 probe 属于不同证据层，本报告不会把尚未执行的界面/读取流程写成已通过。
