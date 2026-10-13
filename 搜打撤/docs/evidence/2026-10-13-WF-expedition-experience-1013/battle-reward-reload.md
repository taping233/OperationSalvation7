# 战斗领奖刷新丢失修复

状态：实现完成，156 项定向测试通过；真实内置浏览器刷新复核交由主会话。本任务未提交。

## 已确认根因

主会话在真实首战胜利得到「基础开发」和 1 币后刷新继续，待领奖励消失，证据为本目录 `05-natural-victory.jpg` 与随后恢复现场。

1. `game.bag.settle.js` 的战斗胜利调用只传 `battleSummary`，而旧 `serializeChestReward` 只接受 `onCell`，战斗奖励始终序列化为 `null`。
2. 直接补 `onCell` 仍不完整：旧 `resumeChestsOnCell` 只回地图，会跳过 `afterRewards` 内的额外传说、胜利经验/击杀进度、宠物蛋战斗计数与 Base+Run 事务。
3. `restoreGame` 先调用 `enterLayer` 自动保存，才恢复奖励控制器；若恢复失败，可能先把原存档的待领奖励覆盖为空。

## 实现边界

- 宝箱快照增加可验证的战斗续流上下文：档位、runId、节点、必要战斗参数、已冻结的 victoryProgress。页面回调和动效不序列化。
- 战斗和普通节点分别恢复；战斗恢复入口重建原胜利回调，从领奖结束直接续到现有幂等 `createAttempt/commitAttempt`，不重新消费卡牌、发事件物品、播放胜利过场或掷战利品。
- 当前奖励卡牌、已收/已散落集合、金币已领取标记继续复用同一快照。恢复后继续完成原经验、击杀、宠物蛋计数与额外传说结算。
- 存在待领奖励时，进层暂缓自动保存；奖励控制器接回后再持久化。恢复失败返回 `REWARD_RESTORE_FAILED` 并保留原档，不降级成普通地图恢复。
- 原本已丢失且没有奖励快照的旧存档无法重建当时随机内容；本修复不伪造补发。
- 按老板新指示暂停额外视觉重设计；本阶段没有继续改 CSS 或展示标记。

## 文件

生产文件：`game/src/run/chest-reward-save.js`、`game/src/run/chests.js`、`game/src/hub/game.bag.settle.js`、`game/src/hub/game.bag.js`、`game/src/game.boot.js`、`game/src/run/game.session.kernel.js`、`game/src/run/game.session.js`。

回归：`tests/battle-settlement-retry.test.js`、`tests/e5-session-recovery.test.js`。

## 验证

- 最新一轮：7 文件 / 156 项通过，退出码 0：`battle-settlement-retry`、`e5-session-recovery`、`four-player-chest-reload`、`e5-save-validation`、`chest-click-flow`、`contracts`、`architecture-boundaries`。
- 新增真实 Chests 控制器 + 战后结算联动回归：普通/首脑战未领、部分领取、全部领取未继续三个时点反复恢复，卡不重掷/不重领，金币一次，口袋只移一次，胜利进度进入事务，蛋战斗计数一次；首脑额外传说一次，故意写入失败后重试复用同一 attempt。
- 新增真实 session 读档分派回归：战斗奖励只调用战斗续流；奖励重新接回前没有 Run 写入；恢复失败保留原始存档字节。
- `npm run typecheck` 八套配置通过；所有本阶段修改 JS/测试的定向 ESLint 与 `git diff --check` 通过。
- 第一轮组合测试暴露新增用例与旧用例共享 spy 次数，已用每例清空 mock 隔离；同轮真实 session 用例有一次运行超时。单独重跑 20 项与后续组合 156 项均通过。
- 未运行 build、全量测试或多尺寸检查；真实浏览器验证由主会话记录。
