# 全项目并行缺陷审查

后续老板已授权实施：本页保留审查时点结论；已完成的26项修复与验证结果见[后续修复记录](../2026-10-23-project-bugfix/checks.json)。

2026-10-23，Friday / 01a16935。四路只读审查确认 **20项问题：14项新增确认、6项此前已知且本轮仍可复现**。全部按P2记录：应修复的行为或功能缺口，本轮未确认达到P0/P1的无条件致命问题。新增确认按今日backend-audit与当前PENDING去重，不声称项目历史从未记录。

优先处理正常玩法直接触发的随机池绕过、获取附赠遗漏、定向抽牌漏触发、复活攻击错误、战后时长重复累计，以及整档操作入口缺失。其余按异步换页、服务入口、自定义规则或故障注入条件排期，不能把条件性问题写成每局必现。

## 新增14项

| 编号 | 玩家/使用者实际遇到的问题 | 主要位置 | 触发边界 |
| --- | --- | --- | --- |
| E4 | 神秘货箱可3币买到禁止进入一般随机池的职业装备“黑暗吊坠” | [game.run.shop.js:152](../../../game/src/run/game.run.shop.js#L152) | 真实fresh卡库、原生seed=24，正常购买 |
| E5 | 神秘货箱抽到阿猫的礼物，只发主卡、漏发附赠卡 | [shop-commands.js:30](../../../game/src/run/shop-commands.js#L30) | 随机货箱购买，金币/容量足够；不泛指明牌购买 |
| B-NEW-01 | 武装定向抽到天启剑，漏触发“抽到时额外抽1张” | [battle.draw.domain.js:182](../../../game/src/battle/core/battle.draw.domain.js#L182) | 原生过滤抽牌与onDraw卡组合 |
| B-NEW-04 | 元素领主被影噬后复活，定义8攻却在下回合变15攻 | [battle.foe-lifecycle.domain.js:74](../../../game/src/battle/core/battle.foe-lifecycle.domain.js#L74) | 原生复活+偷攻，残留旧形态归还记录 |
| PERSIST-2 | 战斗时间已入账，下一保存又算一遍；应累计121秒，实际141秒 | [battle-settlement.commands.js:198](../../../game/src/hub/battle-settlement.commands.js#L198) | 同局已有时长检查点→胜利→继续保存 |
| UI-2 | 整档导出/导入/中断导入恢复没有可点入口，错误提示却要求先导出 | [menu-slots.js:49](../../../game/src/ui/menu-slots.js#L49) | 实际选档页；上一Run检查点恢复仍存在 |
| E1 | 旧入城补给保存完成后覆盖新局或标题页面 | [game.run.altar.js:181](../../../game/src/run/game.run.altar.js#L181) | 初始/领取保存挂起期间换局或换页，两个分支均复现 |
| E2 | 营火保存完成后抢回已由其他页面接管的弹层 | [game.run.altar.js:157](../../../game/src/run/game.run.altar.js#L157) | 保存挂起期间同局同坐标换modal页面 |
| B-NEW-02 | 随机伤害同一段前摇指向甲，实际扣乙的血，还多用一次随机数 | [battle.resolution.domain.js:281](../../../game/src/battle/core/battle.resolution.domain.js#L281) | 两名存活敌人、结构化随机目标伤害；等待期间目标未失效 |
| PERSIST-1 | 空档包导入活动槽后，旧999币/7张旧卡被后续保存写回 | [base.js:448](../../../game/src/hub/base.js#L448) | 公开整档服务入口；当前导入UI尚缺入口，未称实页点击复现 |
| E3 | 祭坛奖励未承接成功，却已清除待领资格，重入无法重试 | [game.run.altar.js:414](../../../game/src/run/game.run.altar.js#L414) | 条件性：Chests.restore接管前返回false |
| E6 | 资源二选一实际已发卡但未标记领取，再点重复发卡 | [node-reward-state.js:111](../../../game/src/run/node-reward-state.js#L111) | 条件性：实际入包后UI.log首次抛错 |
| B-NEW-03 | 已消耗的短期闪避到期，再扣掉后来获得的长期闪避 | [combat.factory.js:230](../../../game/src/battle/core/combat.factory.js#L230) | 已支持的自定义多时长闪避组合；不泛指普通单张内建闪避 |
| B-NEW-05 | 不同时长偷攻共用一个归还时间，敌我攻差到期不同步 | [effect-steps.m2.domain.js:128](../../../game/src/battle/effects/effect-steps.m2.domain.js#L128) | 已支持的自定义stealAtk.duration组合；原生同为1回合不在该例范围 |

## 既有6项，本轮补动态证据

来源均为[今日非前端审查](../2026-10-23-backend-audit/README.md)，不混入14项新增。

| 既有编号 | 本轮确认的实际结果 | 位置 |
| --- | --- | --- |
| backend B1 | 铸甲消耗装备完成、获得护甲，但装备onConsume提供的2能量漏发 | `effect-steps.m2.domain.js:419` |
| backend B2 | 消灭目标被免疫挡住，仍计入数量上限，后续合法目标也没被消灭 | `effect-steps.m2.domain.js:325` |
| backend S1 | 事务键读取成功、主Run键单独SecurityError时，身份读取直接throw | `game.storage.js:140` |
| backend A1 | Agent不识别现行古朴与武术/法术/能力卡分类，编组和丢卡排序失真 | `agent.policy.js:57-60` |
| backend A2 | Agent出售读不存在的card.rarity，传说在前时先卖传说留下稀有 | `agent.policy.js:863` |
| backend A3 | 一局曾撤退、之后事件死亡，累计fought>won使死因被误判为战斗中 | `agent.stats.js:73` |

## 验证结论

现有回归累计 **110文件执行、1369项测试执行通过**；按批次累计，不宣称用例去重或全量通过。全项目语法675文件、基础数据和1543文件代码风格检查通过；资产门0错误、570条历史警告。类型检查未通过，9处不同位置的诊断单列为工程检查阻断，未当9项玩家bug重复计数。

缺陷证明按断言含义区分：战斗、远征、Agent脚本断言错误现象，退出0表示复现成功；持久化3项与UI入口1项按正确期望断言失败，退出1是缺陷证据。错误模拟newRun等待选角的UI-1候选已由独立复核排除，不计数。

仅当前平台内置浏览器、当前窗口查看首页、设置分类与不写档开发者战斗首屏。同期热更新打断长链路，未声称全流程实页通过。未构建、全量测试、远端CI、提交或推送，未修改业务源码、共享测试或玩家档案。

## 分报告与可复跑证据

- [战斗与卡牌：5新+2既有](battle/REPORT.md)：最小复现、原生卡对照、源码指纹、当前规则支持范围。
- [持久化与基地：2新+1既有](persistence/README.md)：真实Base/RunStorage双键命令与故障注入。
- [远征、地图、事件、商店：6新](expedition/README.md)：正常操作、异步所有权、条件性异常分别说明。
- [Agent：3既有动态复核](agent.md)。
- [整档UI入口及选角误报独立复核](battle/review-root.md)；UI入口真实生成器探针为`slot-entry.audit.test.js`，原始结果为`slot-entry.json`。
- [完整验证命令、类型错误、实页边界、误报与工具观察](validation.md)。
- `final-receipt.json` 记录最终工作树摘要、源码SHA256及分域收据稳定性；不是冻结提交或CI证明。

状态：审查完成，问题未修复。项目仍含其他会话大量完成未提交与在途增量，结论以对应源码指纹为准。本轮不保证穷举所有bug或全部组合。
