# 非前端冗余与缺陷排查

本页记录首轮排查时点。最新结果见[第六轮精简](phase6/README.md)：本轮实际净减 83 行，六轮代码累计净减 1353 行；另有第三轮 195 行自测从游戏代码迁入测试，按游戏源码与工程脚本口径累计净减 1548 行。[第五轮](phase5/README.md) 净减 710 行，[第二轮](phase2/README.md) 已经老板批准删除两份退役脚本。各轮指纹、计数和“无整文件删除”说明仅适用于对应时点，首轮缺陷表不代表后续其他会话的修复状态。

2026-10-23，Friday / 01a1691d。老板明确要求子代理并行查非前端冗余与 bug；三子代理分查存档与基地命令、战斗与卡牌规则、地图会话与 Agent，主会话查 core 和工程工具，并复核结论后精简确定冗余。沿用本会话“不用测试”，仅做静态核对。

## 已实施

共精简 7 份代码文件，无整文件删除，无前端改动，无提交推送：

| 文件 | 本轮变化 |
| --- | --- |
| `game/src/hub/game.storage.js` | 删除从未写入的 Map、无效清空、两层私有透传和相同返回分支；净减 19 行，公开 API 保留。 |
| `game/src/battle/effects/effect-steps.m2.domain.js` | 实现直接沿用公开名称，删除内部纯转发；净减 4 行。 |
| `game/src/run/game-session-restoration.js` | 删除 `loadGameImpl` 私有透传，保留 tracing 与持久化等待的原顺序。 |
| `game/src/run/map-snapshot.js` | 删除私有成功构造器后两处不可达的失败返回分支；外部校验、错误返回及旧地图重建保留。 |
| `scripts/impact-query.mjs` | 删除未使用的本地导入，公开 re-export 保留。 |
| `scripts/esm-convert.mjs` | 删除两个未使用的导入符号及其整条 import。 |
| `scripts/workflow-status.mjs` | 删除未再读取的 year 自减赋值，保持日期计算结果。 |

工作树原有完成未提交改动保持原归属，本轮只计算上述增量。没有找到足够证据支持整文件删除的候选；旧存档迁移、旧地图恢复、事务回滚、同槽锁、公开门面均保留。

## 确认的 6 项缺陷

以下为静态调用链确认，均未修改业务行为，未运行故障注入或游戏复现。详细位置、触发条件及修法见各分报告。

| 编号 | 当前源码位置 | 触发与影响 |
| --- | --- | --- |
| B1 | `game/src/battle/effects/effect-steps.m2.domain.js:419` | 铸甲消耗手牌装备时没有遍历消费钩子，漏掉已激活的消费火球或装备 onConsume。 |
| B2 | `game/src/battle/effects/effect-steps.m2.domain.js:331` | 消灭伤害被免疫、潜行或庇护挡住后仍累计 killed；当前内建会错报成功并占用消灭数量上限，自定义 execute+onKill 还可能错发奖励。 |
| A1 | `game/src/agent/agent.policy.js:57` | 旧分类缺少古朴、武术、法术、能力卡，影响编组、发现和满包丢牌排序。 |
| A2 | `game/src/agent/agent.policy.js:863` | 出售策略从扁平观察数据读取不存在的 card.rarity，所有候选被视作同稀有度，可能先卖高档牌。 |
| A3 | `game/src/agent/agent.stats.js:73` | 曾撤退后发生非战斗死亡，累计 fought>won 仍把死因归为战斗。 |
| S1 | `game/src/hub/game.storage.js:140` | 条件性：事务键读取成功后主档读取单独抛异常，身份读取越过结构化失败返回，恢复预检会 throw、终局命令会 reject；原档不会因此被此读取函数修改。 |

## 分报告与静态核对

- [存档与基地](storage.md)：完整读取的模块清单、精简前后 SHA256、S1 的异常边界。
- [战斗与卡牌](battle.md)：B1/B2 调用证据、等价精简和已有修改归属。
- [地图会话与 Agent](run-agent.md)：A1–A3、地图与会话精简及未覆盖范围。
- [core 与工程工具](core-tools.md)：已查范围、脚本精简、未成功的 Knip 扫描说明；对应 [静态结果](core-tools-static.json)。
- [收官指纹](final-static-receipt.json)：7 份代码的 SHA256 及实际静态核对来源。

修改后语法解析和定向差异核对通过；三份工程脚本另通过定向 ESLint。未执行测试、构建、浏览器、网络或发布。静态排查不等于全库无缺陷，报告不声称已穷举全部非前端逻辑。
