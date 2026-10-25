# 存档与基地纯业务审查（2026-10-23）

本轮已精简 `game/src/hub/game.storage.js` 中两个透传函数、一组重复返回分支及从不写入内容的诊断 Map。保留全部公开入口、版本迁移、同槽锁、坏档备份、显式恢复与写基线保护。另记录一项条件性错误通道缺口，未修改其行为。

## 已实施的安全删除

- 原文件 39 行的 `loadIssueMessages` 只有 `delete/get`，全项目搜索没有 `set`；其诊断文本生产路径已不在当前代码中。因此删去 Map 及三个无效清空动作，公开 `loadIssueMessage()` 继续返回原本恒定的 `null`。调用方和既有兼容 API 均保留。
- 原文件 86–103 行的 `readRaw → readRun → reader.parse` 为透传链。`readRun` 成功、空原串和解析失败三条分支都只返回 `{run,raw}`，从不改写原串。`read` 和 `readForPreflight` 直接使用 `reader.parse`；预检仍绑定同一次读取的原始串，并仅在成功时登记 WeakMap 候选。
- 本轮只修改这一个业务源码文件，净减少 19 行。修改前已有未提交变化（相对 HEAD 92 行新增、52 行删除），本轮保留；没有整文件删除。

## 已确认的条件性缺陷（未修复）

### P2：身份读取失败可越过结构化失败返回

- 位置：修改后 `game/src/hub/game.storage.js:140`，`readIdentity` 的 `localStorage.getItem(RUN_KEY(index))` 位于 JSON 解析 `try` 之外。
- 触发条件：事务键和导入键读取成功、确认无待恢复事务，随后主档键读取抛出异常。这里不把“所有 localStorage 读取持续失败”误报成同一触发条件；该情况已由前面的 `txPending` 保守拦截。
- 具体影响：`game/src/run/game-session-restoration.js:10` 的预检首先调用该入口，尚未进入能返回 `STORAGE_READ_FAILED` 的 `readForPreflight`，因此同步预检直接抛出。其 `game/src/run/game-session-persistence.js:258–277` 的 `trackRestoration` 只有 `finally`，不转化异常。`game/src/hub/terminal.commands.js:58` 的终局尝试也在其局部 `try` 之前调用该入口，导致该异步命令 reject，跳过当前函数原有的结构化失败结果。原档不会因这个读取异常被本函数修改。
- 最小修法：仅把主档 `getItem` 纳入独立 `try/catch`，返回稳定的 `STORAGE_READ_FAILED` 失败对象；保留身份校验、memo、事务保护。调用链对新错误码的展示/恢复策略应一并定向核对。
- 证据范围：静态调用及 catch 边界确认；未执行故障注入或复现测试。

## 未列为可删项

- `readForLoad` 有现行兼容使用；不能仅因主要生产装载已用预检/采纳两步删除。
- `unlockNestLegacy` 由 `game/src/run/game.nest.js:114` 调用，仍有生产路径。
- `versioned-slot-reader.js` 的 `didBackUpCorrupt` 当前检索仅见测试直接调用，但公开 helper 的保护诊断含义及现有覆盖应另行决策，未以“只有测试引用”判死或删除。
- 旧档迁移、同槽写锁、事务恢复、前版本备份与库存操作失败保护均保留。未发现有足够证据可整文件删除的候选。

## 覆盖与验证

完整读取：`game.storage.js`、`slot-write-lock.js`、`versioned-slot-reader.js`、`recoverable-pair.js`、`base-mutation.js`、`game.store.js`、`base-state.js`、`base-economy.js`、`base.commands.js`、`base-departure.commands.js`、`base-progression.commands.js`、`base-meta.commands.js`、`base-elapsed.commands.js`、`base-pet-egg.commands.js`、`bag-inventory-commands.js`、`bag-token-craft-plan.js`、`bag-use-compatibility.js`、`receipt-retention.js`、`collection-protection.js`。

定向抽读：`base.js` 的读取、保存、内存 checkpoint、提交刷新、库存追加和命令门面；终局命令、恢复命令和会话恢复/持久化的相关调用与错误边界。只读检索相关调用方与已有测试文件；没有修改前端、运行测试、build 或实页。

静态核对：`node --check game/src/hub/game.storage.js` 与 `git diff --check -- game/src/hub/game.storage.js` 均无错误；Git 仅提示已有 CRLF/LF 转换约定。保留公开 API 后，Map 和两个透传函数的残留引用检索为空。

源码 SHA256：

- 修改前：`916ACDB05636B2EECA9AC042658928727EF06EB03D38E30C756CB94EA7336F4F`
- 修改后：`C98F8370E78B89B664E79E30EE2432B4ADE377C8BB8D312EBD0658CF69D7B93E`

本报告仅覆盖上述静态审查范围，不代表非前端代码全库无缺陷。
