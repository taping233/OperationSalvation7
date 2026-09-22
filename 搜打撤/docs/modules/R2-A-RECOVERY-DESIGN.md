# R2-a 两键恢复设计门

**采用前滚（redo）日志。** 持久化层只接收领域层算好的 `afterBase`、`afterRun|null`，不解释职业卡、收藏或保护规则。每档日志键 `sdt-tx-v1-slot{slotId}`：

```js
{ version:1, txId, slotId, requestId, command, fingerprint,
  runId, expectedBaseRevision, expectedRunRevision,
  before:{baseRaw,runRaw}, after:{baseRaw,runRaw}, receipt,
  phase:'prepared'|'base-written'|'run-written' }
```

`fingerprint` 规范化 `command+payload+runId`，只做相等比较，不充当锁。收据也进入 `after.base._m01.requests[command:requestId]`，日志清除后仍可重放。对局新增 `_r2:{runId,revision}`：新局创建稳定随机 runId；受管写递增 revision。旧 v1/v2 对局首次使用门面且无 pending 时补写 runId/revision=0；失败则 `SAVE_FAILED`，不开始事务。自动保存必须保留 runId 并递增 revision。

## 算法

任何受管读取、选档继续和提交先 `recoverSlot(slotId)`。恢复前严格解析 before/after：两侧 JSON 都必须符合允许版本，afterBase 不得为空，base/run 修订、runId、请求指纹及嵌入基地的收据必须与日志身份一致。坏日志、未知版本、slot/runId 不符或快照/收据无法校验时原样保留日志及玩家两键，返回 `RECOVERY_BLOCKED`，禁止进入、覆盖或自动保存该档。

1. 恢复后先查完成收据；同 command/requestId/参数直接返回原结果，先于 revision 校验；异参报 `REQUEST_ID_CONFLICT`。
2. 读取并迁移真实 base/run，核对 runId 及两 revision；不符报 `STALE_REVISION`。
3. 日志保存可比较的完整 before/after 原串。写 `prepared` 后重读两玩家键：每个当前串都必须严格等于该键的 before 或 after；出现任一第三值立即 `RECOVERY_BLOCKED`，保留日志及所有原键，绝不覆盖。
4. 写完整 afterBase→记 `base-written`；写或删除 afterRun→记 `run-written`；重读验证两键后删日志并返回收据。
5. 首次日志写入失败返回 `SAVE_FAILED`，此时旧键未变且不存在 pending。日志已成功写入后的 phase 更新、玩家键写入或日志清理异常才返回 `SAVE_FAILED_PENDING_RECOVERY`：“提交已开始，刷新后继续恢复”。恢复不信任 phase，先执行领域日志校验及同一 before/after/第三值检查；仅当两个键都属于日志状态时，才把仍等于 before 的键前滚到 after，验证后清日志。

基地写/恢复后更新 `peekCache`，当前档同步替换 `Base.data`，但不得再次加 revision；run 写后清 `readCache`。恢复只在选档加载前或结算阻塞页执行，不能静默替换正在游玩的 `game` 内存。

## 并发边界

受管门面用 Web Lock `sdt-slot-{slotId}` 串行化彼此；Web Locks 只约束主动申请者，不会锁住旧 `Base.save()`、`RunStorage.write/remove()` 或另一标签的同步 localStorage 写。最小实施必须让这些旧入口、清档/覆盖重开和 `beforeunload` 自动保存发现 pending 后拒写；事务适配器使用私有直写入口。选档在 `Base.use/RunStorage.has/loadGame` 前恢复。raw-string 缓存指纹只能发现改写，不是锁。

另一标签仍可能在“检查 pending”与写入 prepared 之间竞态；写日志后的严格原串检查会阻塞已观察到的第三值，但检查完成后非参与写者仍可能竞态覆盖，localStorage 无 compare-and-swap，不能声称全局线性化。缺少 Web Locks 时生产事务直接返回 `CAPABILITY_UNAVAILABLE`，不用假锁。R2-a 只承诺门面间互斥、pending 后旧入口拒写和无竞争崩溃恢复。完整跨标签保证需以后把所有写入口迁入异步门面。

## 最小交付

门面：`recoverSlot(slotId)`、`readSettlementReceipt(context,identity)`、`commitBaseAndRun(context,prepared)`；最小适配 `base.js` 的 pending/缓存刷新和 `game.storage.js` 的 runId/revision、缓存失效、私有事务写。QA 用独立存储适配器与专属命名空间覆盖日志前后、base 后、run 后、清理前故障，特别覆盖“prepared 后竞争写入再重启必须阻塞”，以及旧/坏/未来档、五档隔离、重启重试和参数冲突，不触碰玩家键。

尚未迁入门面的成功撤离、死亡、放弃、旧出征扣卡及其他同步业务仍无跨键保护；不能称玩家结算已修复。R2-b/R2-c 后续逐条接线。规则决策继续待老板，本层不新增收藏来源或保护例外。
