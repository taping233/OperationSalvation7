# 第三轮协调释放后的战斗精简

日期：2026-10-23。状态：两份原先待协调的候选已应用。主会话确认 `WF-live-repair-1023` 的活跃属地仅剩 HUD/overlay/decision-shell 及对应测试，明确释放 combat.factory.js、combat.js、acquire-operation.domain.js；应用前重新核对所有既有目标的 base SHA256，新增 helper 确认不存在后才应用。

本补充批次修改/新增 5 个文件：生产源增加 14 行、删除 227 行，净减 213 行；连同测试搬迁计算，全仓增加 211 行、删除 229 行，净减 18 行。它与上级目录卡牌迁移初批的净减 12 行分别计数，不重复计入。

| 候选 | 精确源码与测试属地 | 生产源码净减 | 全仓净减 |
| --- | --- | ---: | ---: |
| 内置 selfTest 迁入测试目录 | game/src/battle/core/combat.factory.js；game/src/battle/core/combat.js；tests/combat.test.js；新增 tests/helpers/combat-self-test.js | 195 行 | 0 行 |
| 直接获取卡牌循环合并 | game/src/battle/effects/battle.acquire-operation.domain.js | 18 行 | 18 行 |

## selfTest 搬迁的静态保证

原 combat factory 中的自测程序现位于测试 helper，测试仍传入同一个 Combat 门面函数集合。生产 factory 和默认门面不再返回/导出 selfTest，其他战斗 API 保持。

搬迁后新增一行 combat 参数解构；移除该行再比较，原函数主体的 AST 完全一致。原来 67 个 eq 调用的参数、顺序、局部赋值和返回报告全部保留。静态自由变量检查找出 14 个外部依赖，与 helper 解构项逐一相等，并确认它们全部仍由 Combat 门面导出。没有执行这些断言，也没有删除其测试覆盖。

helper 的 JSDoc 引用从 tests/helpers 使用 `../../game/src/battle/core/` 路径；原相对 factory 的类型路径已同步修正。这是运行包代码迁出，不是全仓净删除，表中单列为 0。

## 获取循环合并的静态依据

discover 分支保持原流程并提前返回。其后通过 dest 选择 addDeckCard 或 addTempCard，使用一套逐卡 drawOne、decorate、加入原模板、dup 时再克隆第二份、记录名称的循环；两份卡的加入仍发生在下一次随机抽取之前，首份引起的 onAcquire 也仍先于副本克隆。函数调用仍为无 receiver 的普通调用。

两条路径共享卡名计数和空池日志；成功时仅 deck 路径在发牌完成后调用 shuffleDeck 并输出原牌库日志，hand 路径保留原临时卡日志。原 RNG 调用次数、同名重复、装饰字段、入牌/克隆时机及成功/空池返回值保持。

## 源码与静态检查证据

- `.tmp/backend-phase3-pending/battle/{combat,acquire}/` 保留应用前原字节、候选镜像、base SHA 和可应用补丁；对应补丁及原文也复制到本证据目录的候选子目录。
- 本证据目录的原文快照使用 `.before.txt` 后缀，避免被测试文件发现规则当作实际用例；receipt 的 evidenceBeforeSnapshot 记录其位置。`.tmp` 预备镜像保留真实扩展名供静态语法检查。
- 两份补丁分别及合并后 `git apply --check` 均返回 0；所有既有目标的应用前字节 SHA 与候选基线匹配。
- Git 应用时按仓库规范使用 LF；预备镜像中的旧文件保留原 CRLF。因此本证据 receipt 分别记录 candidateSha256 与 appliedSha256，并逐文件确认只差 CRLF→LF，业务文本完全相等。没有用行尾转换掩盖其他差异。
- 应用后 5 个文件分别 `node --check` 均为 0；两个候选分别 `git diff --check` 为 0。
- acquire 的整个工作区 diff 显示 +17/-35，其中原先已有 +6/-6；本补丁独立基线为 +11/-29，原有改动已保留，不归本轮重复计数。
- `receipt.json` 汇总实际目标路径、应用前/候选/应用后 SHA、精确行数及静态结果；`static-verification-before-application.json` 留存 AST 比较、67 个 eq 调用和自由变量证明。
- 按老板要求，未运行测试、构建或游戏实页；未修复前轮报告的 bug，未提交。
