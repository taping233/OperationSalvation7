# 战斗与卡牌域审查

日期：2026-09-30。审查者：battle_cards。范围：父代理分配的 102 个 review-target，冻结源为 ../snapshot，HEAD fd38468，包含前一轮本会话已授权四项未提交修复。没有把那四项历史问题重新算作发现。

**结论：确认 10 项新的 P2 问题；独占复现 10 项成立，另 1 项有效卡库结构检查通过。仅审查，无游戏/主线测试/共享台账修改，无提交、安装、服务或浏览器操作。**

## 覆盖与边界

[coverage.json](coverage.json) 对全部 102 个文件逐一记录快照 SHA-256、行数、审阅深度、风险与限制：62 deep，37 systematic，3 static-only，0 not-reviewed。

deep 表示已完整阅读模块逻辑并追踪关键生产/消费调用，不表示每条分支实测。systematic 表示按模块函数/契约/风险分段审阅，未宣称逐行全部阅读。static-only 是两份类型声明及 effect-verbs 识别注册表。**本报告不能作为“102 个文件均逐行深审完毕”的声明。**

重点覆盖战斗状态机、出牌费用/手牌支付/注能、动作排队与终局、真实卡 UID/牌区、装备/触发器、多段/结构化与文本路径、发现/获取、延迟/回合时钟、战斗存档入场检查点、视图命令路由/拖拽会话/异步演出生命周期。所有迁移批定义及实际 canonical 卡库载入链均做了对照，但未逐张打出所有卡牌的每种组合。

视图相关文件为源码审查；未做浏览器输入、GPU/视觉布局、音频体验、多窗口或多尺寸验收。冻结 Godot/Unity/EXE 与生成资产不在范围。

## 已确认发现

| ID | 优先级 | 问题 | 原项目定位 |
|---|---|---|---|
| BC-01 | P2 | 极速符文使结束回合停在同一玩家回合 | game/src/battle/core/battle.enemy-phase.js:40 |
| BC-02 | P2 | 灰烬满手直接释放后真实卡 UID 从全部牌区消失 | game/src/battle/core/battle.draw.js:46 |
| BC-03 | P2 | BOSS 武装检索不足时凭空生成随机装备 | game/src/battle/core/battle.draw.js:139 |
| BC-04 | P2 | 挖宝护甲按前次抽牌而不是本次发现牌计算 | game/src/battle/core/battle.resolution.js:1055 |
| BC-05 | P2 | 搜索大宝箱的旧 ID 分支覆盖现行规则并继续多开随机发现 | game/src/battle/core/battle.resolution.js:548 |
| BC-06 | P2 | 正午决战到期合成卡丢失目标契约，延迟攻击每回合报错 | game/src/battle/core/battle.engine.js:430 |
| BC-07 | P2 | 黑暗形态把多一个候选项改成多一次获得 | game/src/battle/core/battle.engine.js:534 |
| BC-08 | P2 | 连续射击的精确预览忽略动态段数 | game/src/battle/view/battle.preview.js:43 |
| BC-09 | P2 | 战斗通行证消耗后没有发牌或开启发现 | game/src/battle/bag/battle.bag.js:192 |
| BC-10 | P2 | 规则化饮血剑遗漏多杀和非卡牌击杀 | game/src/battle/core/battle.engine.js:777 |

每项完整触发条件、预期/实际、影响、调用链、准确原项目位置及复现证据见 [findings.json](findings.json)。P2 排序不意味着可忽略：BC-09 涉及消耗母本无奖励，BC-06 会阻断回合开始后续结算，BC-01 会跳过敌方阶段。

BC-05 的定版依据冲突明确保留：现行卡面/M2 规则为“随机获取 3 张卡牌”，遗留固定 ID 分支却按旧探宝底牌三选一运行，并又创建两次随机发现。本审查不替老板选择玩法；两种已存在依据都无法解释当前结果。

BC-06 的直接实证原因是合成卡丢失 battle.target，导致 schema 异常；q.ops 未剥掉 schedule 是同入口的二级修复风险，由源码确认，未做修改后实验。建议修复者同时处理，不能只补目标字段。

## 动态证据

[复现源码](battle.repro.test.js)、[配置](repro.config.mjs)、[最终日志](repro.log)。

执行命令（项目目录）：

```powershell
node node_modules/vitest/vitest.mjs run --config docs/evidence/2026-09-30-full-repository-review/battle_cards/repro.config.mjs
```

最后一次运行：23:02:56（客户端 UTC+8），11/11 通过、1 个测试文件。此前 10 项缺陷复现均复用同一冻结 snapshot 实际模块。测试断言的是“确认现有缺陷存在”，**不是修复后通过的回归用例**。

有效 seed/catalog 272 张卡、其中 221 张带 rules；逐张 validateCardRules/inspectCardRuleCapability 全通过。这证明现有结构门无法捕获上述时序/接线/UID/语义问题，不能证明 272 张卡效果正确。

示例实证输出：

- SWIFT：turn=1、HP=100、phase=player，已自动打出 1 张，未进入敌方阶段。
- ASH：溢出卡 UID 在 hand/drawPile/discard/grave/played/consumed 全部不存在，敌 HP 已减少 1。
- ARMUP：牌库无装备仍新增 2 张随机装备；原普通牌留在牌库。
- TREASURE：发现底牌 cost=9，选牌前/后护甲均为 0。
- CHEST：初次底牌 bottom1/2/3；选 1 后剩余 2 次随机发现，另两张真实底牌放回牌库。
- NOON：敌 HP 1000→1000、turn=2，stderr 报 chosenEnemy 目标契约错误，一次性 delayed 仍存在。
- DARK：现行卡面明确候选项+1，但 options=3、n=2。
- PREVIEW：连续射击 confidence=exact，预览伤害 2，真实伤害 4。
- TOKEN：员工通行证 B 母本已移除；granted=0、discovering=null、queue 留有传奇池任务。
- BLOODDRINKER：真实 AOE 双杀后 +1 攻，再砸击第三杀仍 +1；3 名敌人确已 dead。

## 已知项与未确认疑点

known 单列，未重复挂台账、未计入本次 10 项：

- PENDING #16：自施 debuff 首 tick 语义待定，保留当前规则。
- PENDING #19：文本同句多动词终局短路及遗留 dmg 字段深化待定。
- PENDING #20：finish(false)→terminalPending 的保存负 HP 异步窗口，归 hub/run；本域不重复改账。

未确认疑点（详见 findings.json）：action-runner 无返回 promise 的注释/实现差异；旧格式战斗恢复高级状态与 trigger registry；注能 perFuelCost 卖价与最新费用口径差异。未提供完整实际损害依据，故不报成已确认缺陷。

## 移交

父代理负责独立复核、跨代理去重、合并全仓覆盖与总报告。后续修复只应在老板明确授权后执行。此域未保留任何后台服务或长进程，Vitest 已结束。

