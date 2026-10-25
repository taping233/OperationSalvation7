# 第二轮战斗纯规则冗余排查

日期：2026-10-23。结论：找到 1 项运行包迁出候选、1 项重复实现合并候选；均未实施。本轮战斗属地源码增加 0 行、删除 0 行；不计入主会话已删数量。没有整文件删除清单。

## 归属与未实施原因

主会话核实 `WF-live-repair-1023` 仍活跃，并明确占用战斗/发现领域，无法确认下述 combat/acquire 路径已释放，故明确要求本轮不实施。没有覆盖其改动，没有继续扩大查询等待。候选原文按读取时字节保存，同目录 `receipt.json` 记录 SHA256、字节数和来源；这些是候选快照，不是已执行补丁。

## C1：运行包迁出候选，非仓库净删

精确路径：

- `game/src/battle/core/combat.factory.js`：内置 `selfTest`，约第 281-472 行，192 行主体及说明。
- `game/src/battle/core/combat.js`：默认 runtime 的 selfTest 解构/导出。
- `tests/combat.test.js`：现有 selfTest 唯一实际调用点，第 8 行。
- 拟新增 `tests/helpers/combat-self-test.js`：容纳原样测试函数；当前未创建。

静态依据：生产源码中 selfTest 只在 factory 定义/返回、默认 combat 门面解构/导出，没有游戏调用；tests/tools 引用定位到 `tests/combat.test.js:8` 的 `Combat.selfTest()`。根下 code-map 与旧打包产物有历史索引/打包文本，不是当前源码调用点。函数内容只构造局部 A/B 测试目标、执行断言、收集报告，不参加正常战斗。

候选方案：将原函数搬至测试 helper，显式传入 combat runtime，并从参数解构其使用的 TYPES、dealDamage、addBleed、clearBleed、addCurse、hasCurse、purify、addBlessing、isStealthed、breakStealth、tickPoison、tickDurations、canAct、parseNotation；原测试调用 helper。生产 factory 与默认门面移除 selfTest，其他战斗接口与多实例隔离保持。原断言、顺序和返回报告保留。

收益：生产运行包不再携带约 192 行测试程序。测试代码会移入 tests，因此这项不能算作全仓净删除，也不能宣传为删掉测试覆盖。实际精确行数必须在解锁后根据当时基线重新统计。本轮未改。

## C2：合并直接获取到手牌/牌库的重复实现

精确路径：`game/src/battle/effects/battle.acquire-operation.domain.js`，`resolveAcquireOperation` 中 discover 分支返回后的 deck/hand 两段，约第 120-164 行（读取时全文件 168 行）。

静态依据：两个分支都按 `operation.n` 次执行 drawOne，空池 break；同一次取卡先 decorate，再加入原模板，dup 时再克隆加入第二份，最后 gained.push(name)。随后用相同 counts/detail 算法按卡名汇总，相同空池日志退出。区别只有加入命令（addDeckCard/addTempCard）、deck 成功后的 shuffleDeck 和各自成功日志。discover 已提前 return，不需与直发流程混合。

候选方案：先按 dest 选用加入命令，保留一套 drawOne→decorate→加入第一份→dup 克隆第二份→记录卡名的循环；共享 counts/detail 与空池反馈；成功日志及 deck 洗混仍按 dest 分开。原循环的 RNG 调用、对象克隆、onAcquire 的递归触发时机、同名可重复和日志顺序均须保持，不能先预抽整批后再发牌。

预计可净减约 20 行重复执行代码，真实数字以实施后差异为准。本轮未改。该文件同时装配发现/随机获取，不能因修改目标是重复循环而忽略活跃归属。

## 保留与覆盖边界

- 生产导入图中无入口的多数 battle 默认门面仍被测试使用；这些承载默认实例兼容，未按名字或导入数删掉。
- requested-card-batch 的 capNonLethalDamage 只有测试调用，生产另有非致死伤害实现，但它属于已覆盖的纯函数契约；本轮未通过删除测试来制造行数。
- 旧卡迁移、版本快照、多实例 runtime 与门面保持。上轮 bug 未修改。
- 定向排查 battle/core、effects、bag、runtime 与 cards 的引用、内部函数和直接执行重复；排除视图、DOM、音频及呈现。
- 没有运行测试、构建、游戏实页或语法检查（本轮没有源码修改）；只做静态读取、符号与导入引用核对。
