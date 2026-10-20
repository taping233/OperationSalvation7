# 普通战斗 99 张临时初始攻击真实库

当前最新授权已取消所有模式的空库自动洗回：普通、BOSS、龙巢抽空均停止，仅由明确卡牌效果取回消耗牌。下方第一批记录中“BOSS 真实弃牌回收保持”是当时的验证结论，已由本文末尾“统一消耗堆后的无自动洗回”记录替代。牌区统一由其他分片负责，本分片不改运行态合并或回收效果。

2026-10-20，领域实现与定向回归完成。普通战随身可用牌仍直接入手，另建立 99 个本场临时初始攻击实体；抽牌、类型抽取、洗入与牌库底发现使用实际牌库。开局和每回合不固定抽牌，明确的抽牌效果才移动卡牌。没有启动服务、浏览器、构建或提交；实页验收由主会话负责。

## 实现范围

- `game/src/battle/bag/battle.deck.js`：创建恰好 99 个具有唯一 UID 的初始攻击临时实体，卡模板独立复制。
- `game/src/battle/core/battle.lifecycle.js`：普通入口把临时实体放入 `granted`，UID 放入 `drawPile`，不写入 `ownedCards`。先建库再执行开战被动，开战被动可按自身规则改变/抽取实际库。随身原过滤条件不变。结束时保留已出/注能的本场记录，但从提供给战后消耗区的 `opts.spentCards` 排除该 99 库实体，避免被 `game.bag.settle.js` 存入消耗区。
- `game/src/battle/core/battle.draw.js`：类型抽取只移动实际库内匹配的 UID，不从全卡池随机补足；普通抽牌与类型抽牌保留原普通手牌容量，不引入 BOSS 的 8 张门。BOSS 原手牌上限和真实弃牌回收保持。
- `game/src/battle/core/battle.resolution.js`：结构化/字段抽牌统一实抽，洗入真实库；牌库底发现仅使用真实候选 UID，空库结束。库底操作的 n 表示候选数，发现队列单次选择一张，其余按既有流程回底，不再产生后续随机候选。
- `game/src/battle/core/battle.enemy-phase.js`：剑仙形态明确的额外抽牌使用真实库；普通常规回合/额外回合没有新增固定抽牌。
- `game/src/battle/bag/battle.bag.js`：道具结构化抽牌统一实抽，日志使用实际张数，空库不生成。

未改 `battle.card-play.js`、`battle.exec-play.js`：普通已出牌仍在 played、注能等消耗仍在 consumed，未改成 BOSS 弃牌回收制度；普通墓地不新增实体。能力卡、道具、资源等的原入口过滤条件保持。明确获得/创建临时牌的效果仍执行自己的获得语义，未把所有“获得”改成抽牌。

## 并行边界与接线

定向 handoff 已核对目标源码并保存当前工作树基线，原有未提交改动保留。生产文件已冻结交接给主会话；共享 `battle.core.js`、`battle.engine.factory.js`、`effects/*` 的普通查看/旧抽牌替代分支由主会话协调处理，本分片未修改。共享最终集成检查以主会话结果为准。

修改前源码基线：项目根 `.tmp/battle-flow-1020/deck-before/`，保存 core 下 draw/lifecycle/card-play/resolution/enemy-phase、bag 下 deck/bag，以及 reactive-draw-cast-continuation 测试的局部接续基线。

## 验证

最后定向命令：

```text
node node_modules/vitest/vitest.mjs run tests/normal-starter-deck.test.js tests/battle-resolution.test.js tests/battle-restart.test.js tests/boss-equip-select.test.js tests/reactive-draw-cast-continuation.test.js --reporter=dot
```

结果：5 个测试文件、97 项全部通过。运行时间为本机 22:55:53，耗时 3.96 秒；只有 Vitest 已存在的 environmentMatchGlobs 弃用提示。

新增 `tests/normal-starter-deck.test.js` 14 项真实引擎回归覆盖：

- 普通开局随身直接入手，99 个唯一 UID 可解析成初始攻击，随身卡不增。
- 99 → 抽 7 → 92，最终抽空返回 0，不生成替代牌。
- 普通随身已有 10 张、配置 BOSS 上限 8 时，抽 2 后 12 张、类型抽 2 后 14 张；库依次 99 → 97 → 95。
- 常规/额外回合均不自动补手牌或补库。
- 结构化普通/类型抽牌，类型不匹配少抽；补到目标手牌数在空库停止。
- 道具结构化抽牌使用实际库、空库不生成。
- 洗入只增加库，库底候选来自真实实体，选一后不追加随机发现；空库不发现。
- 普通已出/墓地制度和能力卡/库存类型入口过滤保持。
- 普通临时攻击打出后不进 BOSS 弃牌/墓地；结束清空临时库，不提供战后可存模板。
- 正式检查点 JSON 恢复按原读档重开制度重新建立 99 个可用且唯一的临时 UID，未写入随身卡。
- 原牌区 JSON 往返保存和还原全部 99 个原 UID。
- BOSS 保留固定开局/每回合抽牌与原初始攻击数；龙巢保留原卡盒编入/初始攻击与固定抽牌制度，不注入普通 99 库。

`tests/battle-resolution.test.js` 三处旧普通无牌库/直接获得断言按新制度更新。`tests/reactive-draw-cast-continuation.test.js` 仅在一个“普通入口后手动改 mode=boss”的弃牌回收夹具清空普通库，维持原效果断言，避免新普通库干扰该 BOSS 场景。

`git diff --check` 已对本分片文件检查通过；HEAD diff 含接续前他人的已完成改动，不能把整份 HEAD diff 当成本分片改动清单。

## 保存与验收边界

正式 `BattleSession.serialize()` 当前维护入场检查点，读档重开本场，不保存半结算中局；因此恢复生成新的战斗 token 与 99 个新 UID，不能宣称读档后 UID 字面不变。原牌区恢复函数仍能原样还原 99 UID，两种制度分别回归通过，没有改动既有保存方式。

领域测试证明 UID 移动、模式和清理路径；玩家看到的牌库入口、说明、同名叠放及实际输入由 UI 分片和主会话当前窗口验收。取消敌人重绘后本分片没有启动任何生成；原美术样板不属于本次接入。

## 统一消耗堆后的无自动洗回

2026-10-20 最新授权：弃牌、消耗牌、墓地合并一个消耗牌堆，牌库抽空不自动洗回，仅由卡牌效果取回。本分片只处理 draw/deck 自动洗回边界，不承担牌区别名合并、卡牌取回效果或 UI 文案。生产文件与测试完成后冻结交接。

### 调用核对与修改

当前兼容链是 `battle.engine.js` → `battle.engine.factory.js` → `battle.draw.js`。框架分片已产生 `battle.engine.factory.domain.js` → `battle.draw.domain.js` 的实例实现；在框架协调释放属地后，两份 draw 都删除自动 refill 分支与对应 import。空库直接结束，不触摸消耗区、不播洗牌音、不生成替代牌。

`battle.deck.js` 和 `battle.deck.factory.js` 的纯 `refillDrawPile` 工具契约保持，未改成静默吞操作的 no-op；`rg -n 'refillDrawPile\(' game/src/battle -g '*.js'` 仅命中这两处函数定义，没有生产调用。`battle.core.js`/view `_test` 仍有兼容导出，但未在抽牌或回合流中调用。

本轮生产修改仅：

- `game/src/battle/core/battle.draw.js`
- `game/src/battle/core/battle.draw.domain.js`

未改变普通 99 库/普通原容量、普通无固定抽牌、BOSS/龙巢原开局及回合抽牌次数与手牌上限。没有修改任何战后结算路径，未新增“仅 played 的随身牌永久消耗”。现有临时 99 库战后模板隔离继续由第一批 `lifecycle.finish` 补丁保障。

原字节备份在项目根 `.tmp/battle-flow-1020/deck-no-auto-before/`，包含两份 draw、两份 deck 及本轮相关测试。备份用 Copy-Item 保留原文件字节；未清理或回滚他人现场。

### 回归更新与结果

新增 `tests/normal-starter-deck.test.js` 四项：普通、BOSS、龙巢空库保留消耗实体并返回 0；新 `createDrawDomain` 实例工厂空库返回 0、不洗回且不播洗牌音。

必要旧断言更新：

- `tests/battle-rule-audit-1014.test.js`：自动牌/补到目标手牌数到空库即停止，不取回消耗牌。
- `tests/stellar-divination.test.js`：抽到自动施放的副本只生效一次，后续空抽不回收；隔离手动切 BOSS 夹具，不混入普通 99 库。
- `tests/reactive-draw-cast-continuation.test.js`：两次反射后仅最初一张冰刺造成伤害，不再回收冰刺重复施放。
- `tests/r3-b-action-boundary.repro.test.js`：BOSS 空库回合不把已消耗 UID 放回手牌，不能直接重复打出。
- `tests/infuse-free-paths.test.js`：空库不回收；免注能特征在夹具显式返回牌库后仍保留，夹具不代表卡牌回收效果已验收。
- `tests/battle-modules.test.js`：同步先前已授权的普通牌库卡可使用断言；纯 refill 工具原测试未改。

最终命令：

```text
node node_modules/vitest/vitest.mjs run tests/normal-starter-deck.test.js tests/reactive-draw-cast-continuation.test.js tests/battle-rule-audit-1014.test.js tests/stellar-divination.test.js tests/r3-b-action-boundary.repro.test.js tests/infuse-free-paths.test.js tests/battle-modules.test.js tests/boss-equip-select.test.js tests/battle-restart.test.js --reporter=dot
```

结果：9 个测试文件、97 项全部通过，23:13:06 启动，耗时 8.46 秒。该结论针对上述命令时现场；之后牌区合并和回收效果分片接入后由主会话做集成验证。本轮没有构建、启动服务、浏览器或提交。
