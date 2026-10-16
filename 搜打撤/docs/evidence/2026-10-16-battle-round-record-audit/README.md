# 战斗轮数记录审查与最小修复

结论：跑局记录把阶段机创建时的固定值 `battleState.round` 当成了战斗轮数。实际对局时钟是 runtime 的 `turn`，实时快照和终局复盘已采用它。已在父任务解冻授权后仅修改 `battle.lifecycle.js` 的一个数据源表达式：`round: battleState.round` → `round: turn`。

## 实机证据与问题边界

- 输入：[父任务正常UI导出的JSON](../2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-213829.json)，导出时间 `2026-10-15T21:38:29.851Z`。本任务只读，没有改写导出或游戏历史。
- 第二轮白塔记录的 fought/won 均6，6条 `lastBattles.round` 均1。父任务 [PLAYLOG](../2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md) 的 21:24–21:26 UTC 段记录第4场实机打到第3回合胜利，与该行 round=1 冲突。该行是第3层 node7，战后hp34，局内行动钟turn18。
- 第一轮肃清总督记录 round=1，而同一PLAYLOG明确为第5回合失败。这里只把父已记录的实机事实与JSON交叉核对；本任务未操作浏览器，也未独立复验截图或真实输入。
- 首轮总战斗数缺失不属于此补丁；本次不补造未采集的 hits、potions 等字段，也不从行动钟或战斗次数反推历史轮数。

## 根因

- `game/src/battle/runtime/battle.state.js` 的 `createBattleState()` 设置 `round: 1`；`transitionBattle()` 保留该值，只更新phase。全仓相关源码没有随对局推进更新该字段。
- `game/src/battle/runtime/battle.runtime.session.js` 提供真实 `turn` 活绑定：开局置1，旧格式恢复读取 `data.turn`。
- `game/src/battle/core/battle.enemy-phase.js` 的普通回合与额外回合分支均 `set$turn(turn + 1)`。
- `battle.engine.js` 的快照使用该turn，`battle.lifecycle.js` 的 `readBattleSummary(turn, foes)` 也正确；只有 `noteBattle` 的round读了阶段机初值。
- `G.turn` 是局内行动钟，不可替代战斗轮数；专测将其设为42以防混用。

## 改动归属

- 游戏源码只有 [implementation.patch](implementation.patch) 中1行；[patch-fingerprint.json](patch-fingerprint.json) 保留本任务编辑前后该文件SHA256。文件已有其他任务的未提交更改，未覆盖或重排。
- 新增 `tests/battle-round-recording.test.js` 8例专测，通过真实BattleSession命令推进普通/额外回合并检查实时snapshot、终局summary和跑局record相等。
- 额外回合由测试fixture直接设置已获得的效果，后续用真实endTurn分支推进；不是实页卡牌输入证明。
- 状态机round的含义未改，未新增历史迁移，没有变更保存格式。

## 验证

1. 修前：7例中5失败、2通过，所有失败都指向记录轮数1而应为3或5，见 [red-test.log](red-test.log)
2. 一行补丁后：相同7例全过，见 [green-test.log](green-test.log)
3. 最终新增自然攻击致死边界后：8/8通过，见 [final-round-test.log](final-round-test.log)。覆盖第3轮普通胜利、第5轮首脑认输、第5轮敌方攻击致死、普通/额外第3轮撤退、首轮胜利、检查点重开回第1轮、旧行保留而新行使用第3轮
4. 最终8例连同相关生命周期、统计持久化及 contracts / architecture-boundaries：5文件69项全部通过，见 [final-targeted-test.log](final-targeted-test.log)。此前7例版本的5文件68项通过日志另保留为 [targeted-test.log](targeted-test.log)
5. 最终源码和测试的定向ESLint、Node语法检查、diff空白检查均通过，见 [static-check.log](static-check.log)

可从任何目录运行 `node docs/evidence/2026-10-16-battle-round-record-audit/reproduce.mjs`（路径以项目根为例），通过现有Vitest重跑8例。最初尝试直接Node导入BattleSession因项目JSON导入缺少Node import attribute而失败，未能形成运行样本；现有Vitest已提供项目所需的JSON变换，后续验证均经Vitest完成。

## 未核验与收官

- 修后真实UI多回合战斗→终局→设置/数据管理导出JSON，仍由父任务补验；jsdom通过不替代实机。
- 此补丁晚于R4冻结，R4既有结果不覆盖本补丁。未跑build、全量、远端CI，未启停服务，未操作浏览器，未提交。
- 源码和测试编辑已结束，完成未提交，释放本任务编辑范围。
