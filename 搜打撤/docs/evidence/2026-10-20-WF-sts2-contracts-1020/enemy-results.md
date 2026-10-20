# 敌方计划独立复核与真实回合测试

2026-10-20。只新增 `tests/sts2-enemy-plan.test.js`，没有修改生产源码或已冻结的实例线。

结论：本轮目标分支的纯计划、当前意图计算、回合预测与实际敌方命中次数一致，没有发现新的源问题。

## 真实执行范围

测试使用真实 BattleSession.start、commands.endTurn、敌方阶段及伤害结算；通过本场 damageSummary 记录核对每次命中，而不是只按总血量反推。渲染器为空回调，计时由Vitest推进，不代表实页验收。

固定夹具为敌人4攻、玩家1000生命、空防御，无伤害/回合触发牌。使用真实 `playerCurseImmune` 旗阻止狂乱的随机诅咒改变后续命中数值；没有替换伤害或诅咒实现。stunned/freeze由夹具直接设置运行态，再执行正式回合。每次推进同时确认普通临时初始攻击牌库仍为99张，没有自动抽牌。

| 用例 | 意图/预测与实际核对 |
| --- | --- |
| 普通攻击 | 1击、4伤害 |
| evenAttack | 第1/2/3回合依次0/1/0击 |
| noFirstAttack | 第1/2回合依次0/1击 |
| frenzy | 两次独立命中，各4伤害 |
| stunned | 本次0击并清除旗，下一回合1击 |
| 玩家回合中附加freeze=1 | 当前动态意图不可行动、本次0击；到期后下一回合1击 |
| behavior=orc_boss但没有frenzy | 显示“攻击”，实际1击 |
| 纯查询 | 计划、动态意图、预测不改变真实状态或随机流 |

## 意图缓存边界

`captureSnapshotInput`仍把foes中的缓存intent交给快照；该字段没有承诺在玩家回合中每次状态变化后立即刷新。实际战斗单位显示在 `battle.layers.js:878` 调用 `calculateEnemyIntent(f, currentTurn, playerStatus)`，冰冻还有展示覆盖；预测和敌方阶段均直接读取当前状态构建计划。

测试按这个真实动态计算路径校验中途冰冻，没有修改缓存语义，也没有把snapshot.foes[].intent当作实时意图。该结论不等于完成了实页显示验证。

## 验证

命令：`node node_modules/vitest/vitest.mjs run tests/sts2-enemy-plan.test.js --reporter=dot`

退出码0；1文件8测试通过，23:02:38开始，Vitest 2.02秒。新测试文件的node语法检查、ESLint均退出码0。没有运行全量、build、服务或浏览器。

测试文件SHA256：`39E676E434598191D6610A659B5AEB1EE43441273028F40B86339BBF2C9EFF19`。
