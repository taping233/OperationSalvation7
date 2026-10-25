# 战斗与卡牌非前端静态排查

日期：2026-10-23。状态：审查完成；按主会话授权仅实施 R1 等价精简，两个 bug 仅报告。未运行测试、构建或游戏实页，只做源码语法和差异检查。当前工作区含既有未提交改动，问题行号按本轮精简前读取的工作区标注。

## 结论

确认 2 个战斗执行 bug、1 项可完全等价精简。没有可据此整文件删除的清单。旧卡迁移、默认门面、多实例绑定、纯测试辅助均未作为冗余删除。

## 确认的 bug

### B1：铸甲消耗装备漏掉消费事件（P2）

- 入口：`game/src/cards/cards.sync.m3.js:173` 的 `tt2-turtlearmor`（铸甲）声明 `armor amount:10, consumeEquip:true`。
- 调用链：`game/src/battle/core/battle.resolution.domain.js:701` 调用 `resolveConsumeEquip(card, m2Deps)`。`game/src/battle/effects/effect-steps.m2.domain.js:418-434` 找第一张手牌装备，移出手牌并加入 consumed/grave 后直接返回，没有触发消费事件。
- 消费事件并非观察 consumed 数组统一广播：`game/src/battle/core/battle.engine.factory.domain.js:579-583` 的 `onHandConsumed` 才调用 `fireConsumeTriggers` 并逐步结算 `consumeFireballSteps`。`game/src/battle/runtime/battle.runtime.piles.js:22-38` 的订阅只更新绑定，不广播卡效，且这里是数组 push。
- 对照：`game/src/battle/effects/effect-steps.m1.domain.js:127` 在消耗手牌时显式 `yield* deps.onHandConsumed`；`game/src/battle/core/battle.turn-effects.domain.js:58-59` 的临时牌消耗也显式运行此钩子。resolution 的 `m1Deps` 在第 82 行接入钩子，`m2Deps` 没有相同端口。
- 实际触发：先激活“每消耗 1 张卡牌自动施放火球”（builtin-card-execution 的 consumeFireball 规则），再用铸甲消耗装备，装备已消耗但火球不触发；若被消耗装备有 onConsume，也一并遗漏。
- 最小修法：把 `resolveConsumeEquip` 改为 generator，成功移动 UID 后 `yield* onHandConsumed(card, uid)`；给 m2Deps 注入现有端口，并在 armor 分支 `yield*` 获取支付结果。保持先支付、消费联动、再加甲的顺序，不能仅调用 generator 而不遍历。

### B2：消灭操作按尝试次数计击杀（P2）

- 位置：`game/src/battle/effects/effect-steps.m2.domain.js:325-338`；`hitFoe(...)` 后第 330 行无条件 `killed++`，之后据 killed 判断日志、返回成功和 operation.onKill。
- 防御链：`game/src/battle/core/combat.factory.js:72-80` 会让免疫或潜行目标直接返回 0 伤害；`battle.damage.domain.js:28-46` 还可能拦截庇护。`hitFoe` 第 142 行默认即时调用 `resolveFoeDefeat`，不是等待下一次 sweep 才判断死亡；`battle.foe-lifecycle.domain.js:25-27` 明确 hp>0 不置 dead。心数模式同样在 `battle.damage.domain.js:112-122` 结算后调用死亡处理。
- 当前内建入口：`cards.sync.m3.js:122` 的吞噬，以及 `cards.sync.m6.js:57` 的 TNT。对满足攻击力上限且免疫/潜行的目标，消灭被挡住，仍会声称已消灭、返回 true，并占用 count 上限，后续符合条件敌人可能因此不再处理。
- 奖励边界：当前这两张内建 execute 没有配置 operation.onKill。错发奖励只发生在自定义/编辑的合法 execute 配置同时携带 onKill 时；`applyDamageOnKill` 第 229-244 行只检查 kills，没有再次确认目标死亡。登记型全局击杀事件另有调用链，不应泛称其全部受影响。
- 最小修法：在命中前记存活状态，命中后只对实际死亡（hp<=0 或 dead，结合复活逻辑）的目标累计 killed；失败尝试不占“实际消灭数量”上限。复活目标可能立刻重获 hp 并清 dead（foe-lifecycle 的 nestRevive），修复时需明确这类转换是否计击杀，不能只按正伤害判断。

## 可安全精简

### R1：移除内部扫描器与公开函数之间的纯转发

- 文件：`game/src/battle/effects/effect-steps.m2.domain.js`。
- 全项目符号查询：`scanHandMoveCurses` 只有第 23 行定义和第 438 行 wrapper 内调用；外部使用 `handMoveCurses`，其名称由 domain return 与 `effect-steps.m2.js` 门面保留。
- 补丁：将第 23 行 `function scanHandMoveCurses(deps)` 直接改为 `function handMoveCurses(deps)`，移除第 436-439 行只返回该调用的 wrapper（把其有用注释移到真正实现处）。
- 此改动不改变遍历顺序、回调次数、返回值或公开导出。它只是去掉一层内部空转发；不删除默认实例门面。
- 已按主会话明确授权实施，公开名称保持 `handMoveCurses`，现定义在第 24 行；未改其函数体。

### R1 修改与静态验证证据

- 文件：`game/src/battle/effects/effect-steps.m2.domain.js`。
- 修改前 SHA256：`5F6D2C62121C04E965674B3527B57FF2DE5D4B27A2D50B38F0153A3252C1F732`。
- 修改后 SHA256：`5CF7047975EA50351F1F9716B64699A4B638746DDCB9874420C6939E7F772B7B`。
- 本轮最小差异：把真实实现的私有名改为公开名，合并两处说明，删除纯转发，共 +3/-7 行，净减 4 行。
- 完整工作区 diff 显示 +4/-8，另 1 行是本轮开始前已存在的 `deps.random()` → `deps.random('target')`；该既有变更已保留，未归为本轮清理。
- `node --check game/src/battle/effects/effect-steps.m2.domain.js` 退出码 0。
- `git diff --check -- game/src/battle/effects/effect-steps.m2.domain.js` 单独执行退出码 0。Git 给出工作区 CRLF 将在后续 Git 写入时规范化为 LF 的提示，没有修改全局配置。
- 源码/tests/tools 定向符号查询只剩真实的 `function handMoveCurses(deps)`；无 `scanHandMoveCurses` 残留。
- 未运行测试、构建、浏览器；未提交。

## 未列入删除的候选

- `isLastHandCard` 的 filter→every 可避免临时数组，但 every 会短路，改变 deps.findCard 的调用次数；当前任务不为这类小收益引入行为观察差异，保留。
- `battle.piles.js` 的 moveUid/zoneForUid/assertUniqueZones 在测试中有显式调用，removeUid 有生产调用，不能仅因部分方法未被生产使用就整文件删除。
- `resolveFoeFight` 的同步包装被既有测试明确使用；生产使用 generator 版本，不能把兼容 API 当死代码。
- `deckDraw` 与 `drawCards` 对 onDraw 的处理有差异，但本轮未核实定向抽取的完整业务约定，不将其报成确认 bug。
- 旧卡兼容、迁移注册表与旧版本规则快照均有当前用途，未按“历史代码”推断可删。

## 覆盖与限制

清点了 battle/core、effects、bag、runtime 与 cards 目录；定向阅读了抽牌、伤害、死亡、结构化结算、M1/M2 执行、触发器、消费、费用、动作队列、执行会话和卡牌迁移入口/数值回填/落盘标记。用全项目引用查询复核了上述候选。排除了 DOM、视图、呈现、音频和卡面描述渲染；没有逐条穷举所有规则与所有卡。本报告不代表全模块无其余 bug。
