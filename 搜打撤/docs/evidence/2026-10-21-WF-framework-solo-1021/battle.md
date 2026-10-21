# 战斗框架职责拆分

状态：已完成局部实现和定向验证；未提交。现有测试未修改，断言未降级。浏览器、最终联合验证由集成代理接续。

## 实现

- `game/src/battle/core/battle.engine.factory.domain.js`：1234 → 834 行。保留入口接口、渲染调度、执行会话、卡牌支付/动作/触发/选择装配；抽出完整文本/结构化效果端口装配、快照投影、封印与符文启动机制。
- `game/src/battle/core/battle.resolution.domain.js`：1309 → 929 行。保留完整卡牌执行计划及operation调度；抽出获取操作及诅咒/祝福操作。
- 新增 `core/battle.effect-assembly.domain.js` 279 行；`core/battle.snapshot-projection.domain.js` 71 行；`core/battle.setup-mechanics.domain.js` 140 行；`effects/battle.acquire-operation.domain.js` 164 行；`effects/battle.status-operations.domain.js` 237 行。行数为本代理交接时，随后类型代理可能增加JSDoc。
- 新增 `tests/framework-battle-decomposition.test.js` 4个行为测试。

## 边界与行为等价依据

效果装配公开 `createBattleEffectAssembly({ runtime, cards, combat, random, executionSession, createBattleResolution, sound, commands })`，返回 `{ applyTextEffects, createResolution }`。commands逐项具名解构，跨装配依赖均以惰性回调传入。文本执行器仍在原装配点创建；结构化结算仍在原装配点调用createResolution；两者共用同一combat包装。保留原addCurse彩闪、伤害记录、资源加减、发现加候选、弃手触发等命令体与先后顺序。

快照公开 `createSnapshotProjection({ runtime, executionSession, interactionOf, battleBagItems, itemUsability, getConsumedPile, R, isBattleStartEquip, equipCap, equipSkillText })`，返回 `{ getSnapshot, snapshotSignature }`。每次读取当前runtime；缓存仍归本runtime，无新全局或第二份战斗状态。

获取、状态及启动机制保留原函数体、随机源与队列。curse仍在windup后重新选择存活目标；获取保留牌库底UID、模板副本装饰及发现job跟踪；封印仍一次消耗并按boss模式进入墓地。原支付/取消、执行器/触发器、行动信号和双实例状态实现不变；独立实例真实开局/出牌/敌方回合/收尾以及支付前后取消由既有回归覆盖。

五个新增模块不读SDT、window或document，不创建模块级可变战斗状态。status与既有resolution仍引用纯提示目录 `view/battle.attack-cues.js`，其仅生成提示数据；目录层级收口可由集成代理按需处理，本轮未扩大至视觉整改。

## 验证

全部命令于搜打撤运行，退出码均为0：

1. 初始四模块后：`npx vitest run tests/framework-independent-battles.test.js tests/framework-battle-engine-services.test.js tests/battle-resolution.test.js tests/battle-snapshot-integration.test.js tests/battle-staged-timing.test.js tests/builtin-card-execution-battle.test.js tests/structured-onplay-battle.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：9文件144测试通过。
2. 完整效果装配提取后：同上去掉contracts和architecture-boundaries：7文件87测试通过。
3. `npx vitest run tests/framework-battle-decomposition.test.js tests/battle-engine-decomposition.test.js tests/battle-action-timing.test.js tests/battle-execution-continuation.test.js tests/tt12-structured-battle.test.js tests/battle-trigger-lifecycle-unification.test.js tests/battle-curse-immunity-lifetime.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`：9文件119测试通过。
4. `npx vitest run tests/framework-battle-decomposition.test.js tests/schema-op-coverage.test.js tests/battle-infusion-material-state.test.js tests/battle-pouch-entry.test.js tests/battle-all-cards.test.js tests/battle-rule-audit-1014.test.js --reporter=dot`：6文件45测试通过。全卡真实战斗282张，硬失败0；既有零效果警告5张：能源结晶、铸甲、快意恩仇、复原药水、精神控制，未改变其断言或实现。
5. `npx eslint game/src/battle/core/battle.engine.factory.domain.js game/src/battle/core/battle.resolution.domain.js game/src/battle/core/battle.setup-mechanics.domain.js game/src/battle/effects/battle.acquire-operation.domain.js game/src/battle/effects/battle.status-operations.domain.js tests/framework-battle-decomposition.test.js`：通过。效果装配及快照两模块交给类型代理后未再改动，最终类型与lint由其接续。

## 交接与未核项

- 冻结两个原domain、五个新增模块与专测；effect-assembly/snapshot-projection已协调移交类型代理，可以添加严格端口契约；其他代理修改需先协调。
- 未运行build、全量Vitest、提交或推送。共享现行文档、架构脚本键、浏览器真实输入/截图、最终联合验证由集成代理负责，本文件不声明这些通过。
- 无需老板新决策；没有修改其他会话属地或共享登记。
