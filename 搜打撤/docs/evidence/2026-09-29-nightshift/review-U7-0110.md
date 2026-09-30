# review-U7-0110 —— R5 独立复审：fix-U7-0145（D-4 终局守卫 + D-2 op 差集守卫）

- 复审人：R5（夜班三代理编制·第三方独立复审，只读，唯一写入=本单）。
- 时间：2026-09-29 深夜；基线 HEAD `bb2e122`，复审对象=工作树未提交改动。
- 复审方式：逐条对照 git diff / 生产源码 / 亲跑 vitest，全部结论引原文实证。

## 1. diff 最小性 —— 通过

`git diff --stat` 全工作树含多会话并行改动，但 U7 名下生产改动恰为 2 文件：

- `game/src/battle/core/battle.selection-flow.js`：+1 行（装配行）。
- `game/src/battle/effects/battle.discover-flow.js`：JSDoc 改 1 行 + pickDiscover 入口加 4 行（3 注释 + 1 守卫）。

测试改动恰为 2 文件：`tests/battle-selection-flow-boundary.test.js`（fixture 1 行 + 追加 2 用例）、新建 `tests/schema-op-coverage.test.js`。与修复单 §1.1/§1.2/§2 所述逐字一致。

工作树其余改动（winter.css/page-rewards-bag-help.css/package.json/AGENTS.md 等）经 `docs/PARALLEL-REGISTRY.md` 核对归属：CSS=精修班「压树待落库」、package.json=验收分级班、package-lock.json=登记表标注「无主」（夜班绕开）——均非 U7 夹带，U7 未触碰。**无越界、无夹带。**

## 2. 接线行正确性 —— 通过

- **G 字段语义**：`G` 系 `battle.selection-flow.js:2` 自 `../runtime/battle.runtime.js` 导入的运行时全局；`battleActive` 为纯 boolean，三个翻转点全在 `battle.lifecycle.js`——`:103`（读档恢复）置 true、`:148`（finish）置 false、`:216`（start）置 true。无对象形态。`!!G?.battleActive` 取值语义正确（G 恒在，`?.` 为冗余防御）。
- **装配点唯一性**：`rg -n "createBattleDiscoverFlow" game/src tests` 仅命中定义处与 `battle.selection-flow.js:23` 一个调用点——全部 discover-flow 消费方都经此装配，**无第二装配点漏接线**。下游链：`selection-flow.js:67` 包装 → `battle.engine.js:1336` 转发 → `battle.core.js:395` 出口 → view/agent 两入口。

## 3. 守卫语义 —— 通过

- **未接线行为不变**：守卫原文 `if (battle.battleActive && !battle.battleActive()) return;` 位于 pickDiscover 首行、先于 `interaction.get()` 判空；`battle.battleActive` 为 undefined 时短路为 false，函数体走原路径逐字一致。
- **正常多段发现不误拦**：`battleActive` 唯一置 false 点是 `lifecycle.js:148` finish()，而 finish 同段原文即 `set$discoverQueue([]); clearBattlePopups()`（面板与队列同清）——不存在「battleActive 已 false 而发现面板仍开」的正常时序；连开多张全程 `battleActive=true`，守卫恒放行。view（`battle.view.js:275`）与 agent（`agent.state.js:148`）两入口均只在战斗中触发。全卡库实打审计（真实 start() 链路，含发现面板自动选牌）绿为旁证。
- **拦截目标精确**：仅剩 finish 后 state 残留的 stale 调用这一防御面。

## 4. fixture 适配审查 —— 通过（必要适配，非掩盖误拦）

`set$G({ log })` → `set$G({ battleActive: true, log })`（boundary 测试 :222）：该用例经 `createBattleSelectionFlow` 真实装配链路，接线后 `!!G?.battleActive` 对缺省字段取 false 会触发守卫——而生产实况中 pickDiscover 只发生在 start() 置 true 之后，补字段是使 fixture 对齐生产契约的**必然适配**，断言零改动。判别证据：53 个走真实 lifecycle 的 discover 相关测试文件（abyss-sovereign、battle-all-cards 等）不经任何 fixture 补丁全绿——守卫没有拦任何真实路径；若守卫误拦正常路径，红的是那 53 个而非这一个单测。且新增「正常路径零影响」用例显式断言 addTempCard×1 + finish(true)。

## 5. U7-b 差集测试质量 —— 通过

- **op 归类抽查 3/23**：`discover` @ `battle.resolution.js:888`、`foeFight` @ `:903`、`coins` @ `:954` 均落在修复单所称循环 2 段（:873-996）内，原文形态 `if (operation.op === 'discover' ...)`；循环 1 `if (operation.op !== 'damage') continue;` @ :585 附近、兜底 `if (!['heal', 'armor', 'draw'].includes(operation.op))` throw @ :997 附近，均属实。`transform` 双入口显式拒绝属实（`card-rules.capability.js:134/:190` 两处 reject），排除正确。
- **回流入口**：`battle.bag.js:128` 带 schedule 剥除后合成 `triggerOps`、`battle.engine.js:427-433` 合成卡 `rules.triggers.onPlay` 回 `resolveCard` 均核实属实。
- **源码自检防腐化**：真实存在且双向有效——(a) 运行时分支改名/删除 → 自检用例红（grep `operation.op === 'X'` / `!== 'damage'` / 三元 includes 落空）；(b) 运行时新增分支而清单未同步、卡库已用 → 差集用例红（used ⊄ RESOLUTION_HANDLED_OPS）。测试清单腐化不会静默变死。

## 6. 亲跑复验 —— 通过（全绿）

```
npx vitest run <rg -l "discover" tests/ --glob "*.test.js" 共 53 文件>
  Test Files  53 passed (53)   Tests  683 passed | 1 skipped (684)   [20.25s]
  （含 battle-all-cards 全卡库实打：272 张，硬失败 0）
npx vitest run tests/architecture-boundaries.test.js tests/contracts.test.js
  Test Files  2 passed (2)     Tests  37 passed (37)
```

无 Unhandled、无失败。A 案未引入架构违规（可选端口零新增 import，双守卫绿）。

## 7. make-work 检查 —— 非 make-work

D-2 测试守卫的是真实风险：`resolution.js` 兜底 throw 发生在能量已扣、卡已离手之后（半结算态），防线此前仅靠 schema/capability 单层，「两清单失配→玩家结算期红」无测试层守卫；D-4 守卫对应 find-D-0100 指名的 stale 回调竞态，修复最小且语义同位 STS2 IsEnding。均无重复造轮（capability 层测试管入口拒绝，本测试管运行时回流清单，射程不重叠）。

## 备注（不阻塞）

1. 守卫只加 pickDiscover 入口、未加 processDiscoverQueue——已在修复单 §1.3 明示为发现单未指名的扩围不做；残留面为「队列中已入队的 stale job 被后续 processDiscoverQueue 消费」，属记录在案的已知边界。
2. 自检用例按字面模式 grep 源码，理论上若分支删除而同字面量残留在注释/它处可漏红——现核查 resolution.js 注释无该字面形态，风险极低，记录备查。
3. 大跑中 1 skipped 为既有跳过项，与本次改动无关。

## verdict

PASS WITH NOTES（备注 1-3 均为记录性观察，不构成缺陷或阻塞；U7 交付与修复单所述逐项相符，亲跑复验全绿。）
