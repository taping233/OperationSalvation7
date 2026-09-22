# R3-b 出牌边界复现报告

## 结论

真实 `BattleSession.commands.playCard` 已稳定复现同 UID 迟到命令的重复结算。普通战与 BOSS 战结果一致：第一次合法结算稳定后，卡已不在手牌；再次传入相同 UID，仍会再次扣 1 能量并造成 4 点伤害。

该红灯随后按批准方案完成最小 runtime 修复；最终结果见 `R3-B-DELIVERY.md`。本节保留修复前证据。

## 复现

测试文件：`tests/r3-b-action-boundary.repro.test.js`

```text
npx vitest run tests/r3-b-action-boundary.repro.test.js --no-file-parallelism
```

结果：4 项中 2 项按预期失败、2 项通过。

| 场景 | 首次稳定状态 | 迟到同 UID 后实际状态 | 期望 |
| --- | --- | --- | --- |
| 普通战 | 能量 2，敌 HP 46，UID 不在手牌 | 能量 1，敌 HP 42 | 保持能量 2、敌 HP 46 |
| BOSS 战 | 能量 2，敌 HP 46，UID 已进弃牌堆 | 能量 1，敌 HP 42 | 保持能量 2、敌 HP 46 |

测试在第一次动作的 `busy=false` 且 `actionQueueLength=0` 后才发送第二条命令，因此不是队列尚未稳定时的并发调用。

## 必须保留的合法同 UID 路径

同一测试文件的两项绿灯证明不能建立全战斗永久 UID 黑名单：

- 「不朽斩」结算后仍在手牌，同 UID 连续两次合法使用，能量 3→2→1，敌 HP 50→45→40。
- BOSS 战初始攻击第一次进入弃牌堆，结束回合后洗回并重抽，同 UID 第二次合法使用，敌 HP 46→42。

因此后续最小守卫应判断命令发生时 UID 是否真实位于当前手牌及既有合法特殊路径，而不是记录“曾经用过的 UID”。

## freeCast 低能量口径

当前 `game/src/battle.core.js` 中 `freeCast` 只有初始化、读取、删除与注释引用；未找到 `.add()`、赋值注入或外部设置入口。`freeCastTarget()` 也没有调用点。当前真实可达的发现/手选“直接释放”路径直接调用 `queueCardExecution(..., true)`，不会进入等待目标的 `freeCast` 集合。

所以本阶段无法从公开 commands 复现“freeCast 临时卡等待目标且能量低”的场景，也没有增加私有测试入口。静态代码仍存在潜在矛盾：`play()` 在读取 `freeCast.has(uid)` 前先按 `effCost > energy` 拒绝，而后续 `execPlay(..., freeCost=true)` 才会免扣费用。若未来恢复可达的 `freeCastTarget` 路径，需要单独统一此口径。

## 最小修复方向（待根批准）

在普通玩家 `play()` 入口解析卡牌前，要求 UID 当前仍在 `hand`；保留现有队列内部的直接释放调用，它们不经过普通玩家命令入口。这样可以拒绝结算后迟到命令，同时允许保留牌与弃牌洗回重抽后的同 UID 再次使用。

修复时需复跑本红灯文件，使四项全部通过，并回归注能完成后的 TARGETING、取消后重选、直接释放与现有 R3-a/R3-0 测试。

## M08 presentation receipt 建议（未实现）

可在每次通过入口守卫并真正提交到 `queueCardExecution` 时分配 `{ battleToken, actionSeq }`，其中 `actionSeq` 仅在本场合法动作提交时递增。表现层只读消费该 receipt 去重；规则结算仍以 action queue 为权威，不等待动画回调，也不持久化动画中间态。

receipt 不使用卡牌 UID：同一张保留牌或洗回重抽后的卡必须获得新的 `actionSeq`。
