# 撤离整理：恢复令牌、整数选择与符文仓容

## 结论

已修复三项撤离事务缺陷，并补齐符文与卡牌共用仓容的命令边界。2026-10-13 18:13 UTC，14 个定向测试文件共 164 项全部通过；三个改动源码/测试文件的 ESLint 与 `git diff --check` 通过。没有运行游戏全量、构建或浏览器；真实页面验收由本轮集成任务继续完成。

来源是远端 `db831272780b8d0c792e93b9661404b5ee68e5ab` 的私有导出。当前本地仓库的 `d6551cc` 是人为导入基线，不是原项目历史。本文仅描述本轮未提交的撤离改动，不将其他工作者的并行改动记为本任务成果。

## 修复与边界

1. **完成令牌不能被入库续放。** `updateCards` 检查保留令牌的命令类型。此前完成事务在 `after-base` 或 `after-run` 中断后，点击卡牌、全部入库或智能整理，会误用完成令牌，清空运行态，却丢失结算页响应。现在入库返回带操作指引的 `REQUEST_PENDING`，不恢复或改变该完成事务；原「完成整理」按钮可重试并取得原结算回执。反向的「入库中断后点击完成」保护也保留。现有整理页错误路径即可处理，不需要修改页面源码。

2. **日志前修订冲突释放旧令牌。** begin、入库和完成遇到 `STALE_REVISION` 时，清除仍属于该请求的内存令牌。下一次调用重读当前基地/对局快照并重新准备，保留并发保存的内容。提交锁内的二次修订拒绝也明确返回可重试。仅该已知日志前拒绝会释放令牌；写入中断、恢复失败或未确认结果仍保留原令牌，继续日志恢复与回执重放。

3. **入库数量使用严格正安全整数。** 参数必须是数组；每项是包含非空卡牌名称和正安全整数数量的对象。拒绝小数、NaN、Infinity、负数、零、数字字符串、布尔/对象数量、超出安全整数、缺字段、null/数组项、稀疏数组和非数组容器。验证发生在任何异步读档/恢复前；无效输入不会修改基地、对局、修订、日志或整理内存。有效输入在等待前复制名称/数量，额外字段不参与事务。空数组是合法无操作；同名重复选择、超过剩余张数/仓容的整数选择仍按实际可入量收敛。

4. **符文占用从本次提交快照计算。** Base 的现行规则是每块符文占一仓库格；原命令只扣卡牌数。现在同时扣除 `afterBase.runes.length`，沿用原仓容上限接口。即使整理页基地内存仍显示两格，而另一标签页新增符文后持久态只剩一格，命令也只入库一张，不依赖 UI 预先限量。没有改变升级费用、仓容上限或符文玩法。

## 回归实证

- 先添加核心失败回归，再修改实现：校正重复档位测试夹具的乐观写入基线后，两个 recovery/UI 文件为 **47 失败、9 通过**。失败分别覆盖三种整理入口误用完成令牌、两个完成中断阶段、六个日志前修订竞争，以及 36 个非法参数/持久和内存模式组合
- 修复后相同 56 项全部通过，随后扩展空白名称、稀疏数组等输入，以及 begin/入库/完成 × `after-journal` / `after-base` / `after-run` / `before-cleanup` 的 12 项恢复矩阵。每项检查资源、经验、口袋与撤离计数只结算一次，日志最终清理
- 符文专项先观察 **5 项失败**：持久/内存模式下 18 或 19 张仓库卡牌加一块符文，以及另一标签页新增符文的过期 UI 情况。原实现会接收超量卡牌；修复后这些场景在最终定向运行全部通过
- 既有口袋 1/3 保留、首探经验、回执持久化、刷新恢复、档位/对局切换保护、满仓仍可完成、卡牌部分入库等测试全部保留通过
- UI 测试调用实际注册的异步动作处理器并检查 jsdom 页面/状态，覆盖卡牌、全部入库和智能整理的错误提示及后续结算页可达性；它不是浏览器真实输入或真实磁盘故障证据

重复档位夹具现在用现有 `RunStorage.remove` 清除模块乐观写入基线再创建新局，并断言初始写入成功。UI 夹具补充与实际共享模块一致的 clone 导出。这两项只影响测试准备。

## 本轮实际验证

环境：Node 22.23.3，锁定依赖安装完成后的 Vitest 3.2.7。使用本轮已有依赖，无额外安装。

```sh
PATH=/workspace/shared/friday-toolchain/node_modules/node/bin:$PATH \
npm_config_cache=/workspace/shared/friday-npm-cache \
npm run test:target -- \
  tests/extraction-recovery.test.js tests/extraction-recovery-ui.test.js \
  tests/extraction-first-explore-xp.test.js tests/extraction-flow.test.js \
  tests/extraction-preview.test.js tests/extraction-receipt-idempotency.test.js \
  tests/extraction-receipt.test.js tests/extraction-session-resume.test.js \
  tests/extraction-settlement.test.js tests/exp003-extraction-pocket-copy.test.js \
  tests/r2a-recovery.test.js tests/recoverable-pair-contract.test.js \
  tests/contracts.test.js tests/architecture-boundaries.test.js
```

结果：**14 文件 / 164 项通过**，约 5.29 秒。

```sh
node node_modules/eslint/bin/eslint.js \
  game/src/hub/extraction.commands.js \
  tests/extraction-recovery.test.js tests/extraction-recovery-ui.test.js
git diff --check -- game/src/hub/extraction.commands.js \
  tests/extraction-recovery.test.js tests/extraction-recovery-ui.test.js
```

结果：均 exit 0。早先 contracts 守卫因导出未包含 `desktop-app/main.js` 而失败；集成任务恢复对应固定来源文件后，最后一次运行已通过，未通过删除/放宽守卫规避。

最终三个文件 SHA-256：

- `game/src/hub/extraction.commands.js`：`8af535b74bf6c881aae2710cf1b78d24a3df75ff54fb807c8dbdfb0bfe020e10`
- `tests/extraction-recovery.test.js`：`d467ed4391b07e053e3b74d61cf97440b1942cd8f9da4811c6ab0fc62d4136c7`
- `tests/extraction-recovery-ui.test.js`：`de5f3054b77fad6783caefe2c0e7b3ed518a4f72ca680159a7e1c70fbf286bf6`

## 仍需集成关注

- 本轮没有真实浏览器/玩家输入覆盖。需在当前内置浏览器核验正常撤离到整理、部分入库、满仓/含符文容量与完成结算；中断恢复场景若由注入构造，应明确标注
- `inFlight` 在异步读取之后建立，仍不是单飞互斥。两个首次并发动作的响应顺序、页面重绘和录制副作用未被本轮系统性覆盖；事务修订/收据保护不能单独证明 UI 并发没有重复展示或丢响应
- 仓容上限仍使用现有 `Base.stashCap()` 接口；本轮只修正当前提交快照的占用数，没有改造跨标签页升级上限的读数接口
- 本轮仅做定向验收，没有宣称全量、生产构建、真实存档故障或远端 CI 通过。提交/推送/共享登记由集成任务负责
