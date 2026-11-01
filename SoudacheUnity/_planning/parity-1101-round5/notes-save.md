# 照片备注全局保存

2026-11-01。Round5 最小优化已实现并冻结检查源，尚未编译、测试或启动 Unity。只修改 `BaseData.Customization.cs` 的备注保存及读取接口，不改图库 UI、导出实现或 SaveSystem。

## 契约与收益依据

照片手写层是全局 `sdt-card-photo-notes-v1`；读取仍优先手写、空白移除手写后回到底稿，跨档共享。Vite 现行 `cards/card-photo-notes.js:47-62` 直接写该全局键，trim 后截取240字符；失败稿由图库的会话 Pending 保留。

Unity `GlobalStore.SetJson` 已沿 `SetRaw → FlushGlobal → Persist → AtomicJsonFile.TryWrite` 原子替换整个 profile，I/O 失败恢复 `_persisted` 并抛出 IOException。外层再用 `TryPersistMutation` 不增加原子性，却先序列化 State/Base/RNG/结算余量/战斗快照，克隆事务 profile，调用 SyncPlayTime、Base.Save，并可能写对局及发 SaveCompleted。照片输入的240ms自动保存不需要这些工作；现优化移除这条额外路径，仍保留一次正式 profile 序列化/原子写盘。没有声称零I/O、具体毫秒或FPS收益。

`SaveCompleted` 的正式消费者 `CurrentRunTopBar` 会清除整局保存失败提示。备注成功不等于当前局保存成功，故直接全局保存不再发送该事件，也不顺带持久化当前基地/对局的未保存变化。

## 实现边界

- 卡牌存在校验、trim/240限制、空值删除保持；`PhotoNote` 与跨档 Global 来源保持。
- `internal static BaseData.ReadPhotoNotes(SaveSystem saves)` 与 `PhotoNotesKey` 是同程序集唯一备注读取/键入口，正式 PhotoNote、保存及 Run 作者的纯导出服务复用；解析及错误行为沿用原实现，不拥有 UI Pending 缓存。
- 直接复用 GlobalStore.SetJson；外层只转换 bool/reason 及保留原 warn Toast。失败时仍由现有 UI 保留 Pending；同值重试仍能写盘。
- 若处于已有外层事务，GlobalStore 保持缓冲语义；异常上抛交给外层回滚，不能吞掉。没有第二个事务框架或旧版本回退。

## 待集中验证

正式独立入口 `Sdt.Editor.CurrentPhotoSaveRound5Checks.Run()/Assertions`，要求隔离 profile。检查源覆盖真实活动对局中仅备注键变化、未保存 Base/State/RNG 不变、无 SaveCompleted、独立磁盘重读、跨档共享、240限制、清空底稿、无效卡牌拒绝、已有事务缓冲/取消/异常上抛，以及真实锁档导致失败后图库局部回执、关闭重开保稿和同值重试。检查只构造现役 UI 事件，不发送 OS 输入；尚未执行。

本轮冻结清单和原字节/LF指纹见同目录 `notes-save-freeze.json`。Root 统一接线及验证，作者不启动检查。
