# 随机流与回放整改

2026-10-23；任务 `WF-review-remediation-1023`；源码 C02/C10。

## 实现

- C02：`core/random-streams.js` 为唯一展示/非规则随机流清单。回放规则快照和回放包声明共用 `visual/fx/audio/scene/recording/agent-policy`，避免开启动效时误判规则分歧。原始 `initialRng/decisionRng/rngAfter` 仍保留完整快照，规则投影只排除明确的非规则流，不白名单过滤未知规则流。
- C10：`SeededRandomService.reseed` 为新局创建 `version:2`。`Random.random(legacyStream,purpose)` 及 `randomRule(purpose,legacyStream)` 支持显式用途：`shuffle/reward/target/generation/enemy`。真实洗牌、已知奖励抽取、战斗目标选择、战斗生成和敌方随机行为分流。
- `restore` 对缺版本和仅 seed 的旧档使用 v1，忽略 purpose、继续原命名流；旧 `card/battle/status/loot/...` 快照无需重命名或清零。v2 快照还原后继续原 v2 流位置；版本随现有 `rngState` 持久化，不另增槽位版本。
- 原随机算法、未标用途的共享 pick/weighted、地图流、地图生成与拓扑均不修改。随机排序算法保留原实现，只调整所属用途流。新局规则结果按 v2 变化，旧局按旧版恢复。

## 检查

- 7 个随机/回放/卡牌实例/地图位等价定向文件，57 项全部通过；日志 [random-tests.txt](random-tests.txt)。
- 新增 `tests/random-stream-version.test.js`：用 `nextRandom/hashSeed` 对照验证缺版本快照的原 card/battle 精确序列；使用实际 deck shuffle 验证奖励、目标、敌方和 FX 的额外消耗不改变洗牌；v2 往返继续；未标用途 map/gameplay/layout 在 v1/v2 位等价；回放规则投影不修改原快照。
- `tests/sts2-agent-replay.test.js` 新增真实 Agent 3 条战斗命令测试：捕获期间消耗 FX/audio/visual，回放不消费这些展示流，仍完成全部命令且无规则分歧。
- 随机及战斗 purpose 改动 ESLint 通过；runtime 类型检查退出 0；交易异步类型 fixture 已 await 实际结果，framework-boundaries 类型检查退出 0。
- 房间与相邻战斗语义集成的 13 个文件覆盖 157 项：12 文件/124 项通过；奖励文件 2 项旧流名调用断言因新增 purpose 失配，保留调用次数、顺序和卡牌结果断言，补齐显式 `reward` 参数后该文件 33 项通过。没有放宽行为守卫。
- 主会话统一执行最终集成检查；本线未 build、修改真实存档或执行浏览器。

当前功能描述同步于 `docs/architecture.md` 随机服务段。现行业务规则以代码与主会话集成结果为准。
