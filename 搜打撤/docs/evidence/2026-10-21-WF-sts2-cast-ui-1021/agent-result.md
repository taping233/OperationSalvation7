# Agent 注能入口回归修复

Agent 现在能够通过真实 `BattleSession` 命令选择注能材料并确认；纯注能牌不再进入反复 `playDirect` 的停滞。`greedy` 和 `strategic` 优先完成选材与确认，同一步没有推进时取消；`random` 只从当前可推进的材料动作、合法直打、确认和取消中选择。

受影响文件仅 `game/src/agent/agent.state.js`、`game/src/agent/agent.policy.js` 和新增 `tests/sts2-agent-infusion-1021.test.js`。没有改 BattleSnapshot、核心命令接口或 projection，没有直接写战斗 runtime。

`agent.state.js` 沿原有动态预热入口读取 `findEffectiveCard`、`infusionFuelReason`、`infuseOf`、`effCostOf`、`unplayableReason`，配合纯规则能力和必需注能判定，生成同一份 Agent 注能投影供观察与动作枚举复用。投影新增 `need`、`selectionId`、`candidateUids`、`invalidPickedUids`、`canConfirm`、`canPlayDirect`；保留原 `uid/name/picked`。普通手牌的直打入口经既有 `getCardPlayAvailability(uid, undefined, true)` 筛选。选材 UID 与步骤标识加入原轻签名，使无 DOM 驱动也能识别材料选择推进。

有效已选材料不会被随机策略反复撤回；失效且仍有卡实例的已选材料可通过原 `selectInfusion` 撤回。彻底失去卡实例的已选 UID 不再列出领域无法执行的撤回，保留取消出口。材料不足或源卡失效时没有无效确认。领域命令保留最终校验与资源消费权。

开始编辑前原字节保存在 `.tmp/sts2-cast-ui-1021-agent-before/`，目录下 `sha256.json` 记录原始哈希。本轮只在原预热、注能投影/动作枚举、轻签名及策略注能分支增量修改；`agent.policy.js` 原有 random/greedy 类型标注和库存类型修正均保留，定向与该原字节副本的 diff 已核对。

| 原始文件 | 编辑前 SHA256 |
| --- | --- |
| `agent.state.js` | `BCB3AD2C2A98F3A89348D8F507A29B91BBBBD44CEDAEE5D90EAF3244874B00E7` |
| `agent.policy.js` | `BCBAD40E9CC8362B132D633C4DBBC168635463DE1C8C8C27DDEAC3869AECAAB8` |

| 验证 | 结果 |
| --- | --- |
| `npm run test:target -- tests/sts2-agent-infusion-1021.test.js tests/sts2-agent-replay.test.js tests/sts2-infusion-flow-1021.test.js tests/required-infusion-play.test.js tests/agent-command-results.test.js tests/agent-optional-lazy-boundary.test.js tests/agent-policy-door-threshold.test.js tests/architecture-boundaries.test.js tests/contracts.test.js` | 退出 0；9 文件、165 例通过；13:03 本机时间。含专属最初 11 例。 |
| 最后新增“卡实例消失时不枚举无效撤回”条件后，`npm run test:target -- tests/sts2-agent-infusion-1021.test.js` | 退出 0；最终专属 12 例通过；13:04 本机时间。 |
| `node node_modules/typescript/bin/tsc --noEmit -p jsconfig.runtime.json --pretty false` | 最终源文件退出 0 |
| `node node_modules/eslint/bin/eslint.js game/src/agent/agent.state.js game/src/agent/agent.policy.js tests/sts2-agent-infusion-1021.test.js` | 最终源文件退出 0 |
| 自有目标 `git diff --check` | 退出 0 |

专属回归使用真实 `Agent.observe / Agent.step / BattleSession`：纯注能牌不列直打；主卡与禁用材料不列候选；同名材料保留两个物理 UID；未满不确认；`greedy/strategic` 完成真实 `tt12-raydragon` 的选材和施放，各仅消耗一次；默认 random 在三个种子下逐步改变状态并在材料步数界内退出；失效材料撤回和材料消失后取消不耗资源；可选注能与实例免注能仍保留原直打语义；同一就绪状态重复返回时取消。

本子任务未运行浏览器、全量或 build，未提交。玩家实页由父会话统一验收。本轮最初测试用自造卡把 `dmgType` 放在结构化 damage op 内，能力门拒绝该非法测试卡；改为项目支持的 `amountField: 'dmg'` 后通过，没有放宽能力门或断言。

| 最终自有文件 | SHA256 |
| --- | --- |
| `game/src/agent/agent.state.js` | `71414EC7DBAEB2A3DDF7524697B0E7CB3313EC11962428D84CC54D642D7BFCE5` |
| `game/src/agent/agent.policy.js` | `6317E381B290A95F7232FF15F2700577910DA495DFCE222F69ADDA0114252037` |
| `tests/sts2-agent-infusion-1021.test.js` | `5409235DE3FEAD3A129AF5CE7626BDE23A4B4C09DB7D3B526ED994979A9C374C` |
