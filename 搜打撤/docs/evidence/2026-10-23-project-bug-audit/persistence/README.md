# 存档、基地业务与背包审查

2026-10-23；只读审查当前工作树，未修改业务源码、共享测试或台账；只新增本目录审查证据。确认 2 项新 P2 和 1 项已有 P2，均有可运行的最小复现。没有运行全量、build 或浏览器，因此下列结果仅为领域模块与实际存储的测试结论。

## PERSIST-2（新，P2）：战后累计时长在下一次同步时重复计入

- 主位置：`game/src/hub/battle-settlement.commands.js:195–199`。该命令把 `elapsedDelta` 加入 `stats.playSeconds`，却原样保留旧 `playTimeCheckpoint`。
- 消费位置：`game/src/hub/base-elapsed.commands.js:21–22` 优先采用同 `runId` 的持久化检查点，即使传入的 `elapsedSynced` 更新也不采用；`game/src/hub/game.bag.settle.js:257` 在战后已将会话的 `elapsedSynced` 推进到本次结算时长。
- 正常触发：上一稳定点已同步过游玩时长，战斗继续耗时，胜利结算将这段耗时写入基地；之后继续游玩触发保存。战后没有同步推进持久化检查点，下一次同步把战斗已入账的耗时再次入账。读取该战后检查点也会经过同一时长恢复入口。
- 最小复现：已有累计 `100` 秒，同局检查点 `10` 秒；真实 `createBattleSettlementCommands` 准备并提交当前时长 `30`、增量 `20` 的胜利；再调用真实 `Base.syncPlayTime(31,30,runId)`。
- 实际：胜利后累计 `120`、检查点仍 `10`；下一次同步 `delta=21`、累计 `141`。期望：下一次只增 `1` 秒，累计 `121`，持久化检查点与已入账事实一致。
- 证据：`probes.test.js` 的 PERSIST-2，用真实 Base、RunStorage、双键恢复服务与战后命令。按正确预期断言失败，命令退出 `1`。该问题会影响累计时长和按游玩时长判定的成就。

## PERSIST-1（新，P2）：空档包导入活动槽后，旧基地资产可被重新写回

- 主位置：`game/src/hub/base.js:443–451`。`_refreshExternal` 在读取空槽时将保存基线推进为 `null`，但只有 `found.value` 存在才替换当前 `data`。
- 入口：`game/src/hub/save-archive.js:144`；整档导入成功后用该入口刷新活动基地。
- 最小复现：活动槽 1 有 `999` 币和 7 张旧卡；导出完全空的槽 2，通过真实 `previewImport` 后明确确认导入槽 1；再调用 `Base.save()`。
- 实际：导入成功瞬间持久主键为空，活动内存仍是 `999` 币和 7 张旧卡；随后 `Base.save()` 返回 `true` 并把它们完整写回。期望：空档导入后旧活动内存应被替换或失去写权，下一次保存不能复活被替换的资产。
- 证据：`probes.test.js` 的 PERSIST-1。按正确预期断言失败，命令退出 `1`。
- 可达性边界：`saveArchive` 为 `game.session.js` 的公开服务，选档控制器绑定导入动作；当前代码检索仅在 `save-management.js` 找到 `importSlotArchive` 等动作处理器，没有生成相应按钮的模板。因此本轮确认的是公开存档服务缺陷，未声称已经从游戏界面点击完成导入。缺少按钮的产品接入缺口单独交由总审查归并。

## S1（已有，P2）：Run 身份主键读取异常逸出失败通道

- 位置：`game/src/hub/game.storage.js:140`；身份读取的主键 `getItem` 仍在捕获 JSON 错误的 `try` 之外。
- 去重来源：`docs/evidence/2026-10-23-backend-audit/storage.md` 已静态记录，本轮仅补动态故障注入，没有算成新发现。
- 最小复现：事务键与导入键读取成功且均不存在，仅 `sdt-save-v2-slot1` 读取抛 `SecurityError`。
- 实际：`readIdentity(1)` 同步抛 `SecurityError`；期望返回稳定 `{ok:false,code:'STORAGE_READ_FAILED'}`。恢复预检在该调用处先行中断，终局命令也可能 reject。
- 证据：`probes.test.js` 的 S1，用真实 `Storage.prototype.getItem` 故障注入，正确预期断言失败，命令退出 `1`。

## 复现命令与已完成验证

工作目录：`D:\素材\代号柒\搜打撤`。

```text
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-10-23-project-bug-audit/persistence/vitest.audit.config.mjs --reporter=verbose
```

退出 `1`，1 文件 / 3 测试均在正确预期处失败；控制台 `AUDIT` 记录实际原值。首次尝试因夹具替换 `window.SDT` 破坏门面安装而在收集期失败；保留已有门面对象后重跑得到上述有效复现，首次收集错误没有计入项目 bug。

```text
node node_modules/vitest/vitest.mjs run tests/storage-review-remediation.test.js tests/base-write-lock.test.js tests/base-save-snapshot.test.js tests/session-base-persistence.test.js tests/save-slot-lock-interleaving.test.js tests/extraction-recovery.test.js tests/terminal-persistence.test.js tests/nest-settlement-transaction.test.js tests/departure-persistence.test.js tests/shop-transaction-lifecycle.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot
```

退出 `0`，10 文件 / 173 测试通过。这说明既有覆盖没有捕获上面 3 个边界，不能据此认定整个存档系统无缺陷。

```text
node node_modules/vitest/vitest.mjs run tests/base-inventory-lifecycle-audit.test.js tests/base-hub-business-lifecycle-audit.test.js tests/base-storage-read-failure.test.js tests/save-compat.test.js tests/e5-save-validation.test.js tests/e5-session-recovery.test.js tests/base-progression-commands.test.js tests/bag-inventory-commands.test.js tests/bag-container-pages.test.js tests/game-session-slices.test.js tests/game-session-elapsed.test.js tests/collection-conversion.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot
```

退出 `0`，12 文件 / 230 测试通过。两批合计 22 文件 / 403 测试通过；独立缺陷复现的 3 项失败单列，不混入常规覆盖结果。源码指纹与具体实际值见 `verification.json`。

## 覆盖与未核项

完整或主要逻辑阅读：Base 的同步草稿、异步同槽锁封装、保存与刷新、仓库经济/复原/升级/消耗材料、进度与时长命令；RunStorage 的预检/采纳/身份/保存/删除/上一检查点；整档导入导出及导入恢复；会话持久化与装载；撤离与死亡结算；容器转移、通行证合成、收藏转换与保护。

定向阅读：战后双键结算时长、巢穴终局时长、基地库存详情动作、选档与存档管理入口。已对前轮 backend-audit 和当前 PENDING 去重，没有把既定同名堆叠政策、旧档兼容或纯推测列成新 bug。

未全面覆盖：大型地图生成/路线、所有商店/事件/开箱页面分支、所有自定义或恶意损坏存档形状、跨浏览器真实 Web Locks 与关窗中断、实际界面输入及动画时序。本轮没有保证穷举所有 bug。
