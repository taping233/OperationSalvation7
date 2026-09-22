# R2-a 恢复边界交付

实现 `recoverSlot`、`readSettlementReceipt`、`commitBaseAndRun` 三个门面及可注入存储的 redo 核心。三个生产门面都返回单层 Result；恢复完成直接返回原完成收据，无 pending 时返回 `{ok:true,value:null}`。日志保存完整 before/after 原串；恢复先验证两侧 JSON、版本、非空 afterBase、runId/revision 及嵌入收据身份，再接受每个当前键严格等于 before 或 after。任何非法日志或第三值均保留日志与现场并返回 `RECOVERY_BLOCKED`。完成收据在修订校验前重放，同 ID 异参冲突。生产事务缺少 Web Locks 时返回 `CAPABILITY_UNAVAILABLE`。

旧 `Base.save/reset/_writeCommitted/wipe/migrateLegacy` 与 `RunStorage.write/remove/migrateLegacy` 在 pending 日志键存在时拒写，包括空串坏日志；删除失败不再报告成功。对局存储开始保存稳定 `_r2.runId` 并递增 revision。缓存适配只供恢复门面刷新。本包没有接入选档、出征、撤离、死亡或放弃。

隔离验收页实际 URL：`http://localhost:5173/@fs/D:/素材/代号柒/搜打撤/docs/modules/R2-A-QA.html`（Vite root 是 `game`，不能使用 `/docs/...`，否则会回退到标题页）。打开后按“初始化→基地写后中断→刷新页面→恢复→同 request 重试”；四步均使用注入 QA 存储适配器的真实 `createRecoveryCommands`，并调用浏览器 Web Locks。页面只使用 `sdt-qa-r2-*`，明确不触碰五个玩家档。

验证命令：

```text
npx vitest run tests/r2a-recovery.test.js tests/r2a-commands.test.js tests/m01-base-commit.test.js --no-file-parallelism
```

覆盖日志首写、phase 更新、玩家键写入和清理的真实 I/O 故障；prepared 后竞争第三值并重启；after 非法 JSON、未来版本、空基地、身份/收据错配；读/锁异常 Result 边界；五档隔离；缺 Web Locks；空串 pending；稳定 runId/revision；跨重启幂等收据与参数冲突。

能力边界：Web Locks 只互斥参与门面，pending 守卫也无法消除另一标签在检查与写日志之间的同步竞态；本包不承诺全局线性化。玩家结算仍走旧路径，尚未获得两键恢复保护；真实选档恢复和三结局接线属于后续包。未新增收藏来源、保护例外或经济规则。
