# 架构守卫复活记录（arch-guard-revive-2026-09-24）

- **日期**：2026-09-24；HEAD 基线 `b156a22`（工作区含多会话在途改动，本任务未触碰任何源码业务文件）。
- **背景**：九域目录重构（e527fec）后，`scripts/architecture-graph.mjs` 的 18 个判据键全部指向旧文件名（如 `battle/core.js`），与真实文件（`battle/battle.core.js`）零匹配，五条域规则恒返回空集，`tests/architecture-boundaries.test.js` 此前 26 项"全绿"是假绿。分析见 `.tmp/audit-0924/arch-coupling.md` P0-1。
- **改动文件**：`scripts/architecture-graph.mjs`、`tests/architecture-boundaries.test.js`（其余为本文档）。未修任何存量违例源文件；未 commit/push。

## 1. 键映射表（逐键已对照现场文件核实）

| 规则 | 旧键（死） | 新键（真实路径，相对 game/src） |
| --- | --- | --- |
| RUNTIME_OWNERS（独占访问 battle.runtime） | `battle/core.js` | `battle/battle.core.js` |
| | `battle/engine.js` | `battle/battle.engine.js` |
| | `battle/enemy-phase.js` | `battle/battle.enemy-phase.js` |
| PURE_MODULES（独立规则/快照模块） | `battle/card-cost.js` | `battle/battle.card-cost.js` |
| | `battle/intent.js` | `battle/battle.intent.js`（已核实为敌方意图纯计算；注意 `battle.intents.js` 是视图模型，非旧键语义，未纳入） |
| | `battle/resolution.js` | `battle/battle.resolution.js` |
| | `battle/snapshot.js` | `battle/battle.snapshot.js` |
| | `cards/catalog.js` | `cards/cards.catalog.js` |
| VIEW_MODULES（视图切片，禁旁路 engine/enemy-phase） | 正则 `^battle/(view|…)\.js$` | 精确集合：`battle.view / battle.overlays / battle.layers / battle.vfx / battle.anim / battle.aim / battle.hover / battle.frames / battle.piles.view`（均带 `battle/battle.` 前缀） |
| 目标侧写死路径 | `battle/runtime.js`、`battle/engine.js`、`battle/enemy-phase.js`、`core/sdt-facade.js` | `battle/battle.runtime.js`、（engine/enemy-phase 复用 RUNTIME_INNER 集合）、`core/sdt-facade.js` |
| FLOW_PREFIXES | `hub/`、`run/` | 不变（目录仍存在且非空） |

实现方式：全部判据改为**精确 Set 匹配**（`RUNTIME_INNER`/`RUNTIME_OWNERS`/`PURE_MODULES`/`VIEW_MODULES`/`PROTECTED_TARGETS`），删除了路径正则。语义与旧规则等价：旧反向依赖正则 `^battle/(runtime|engine|core|enemy-phase)\.js$` ≡ `RUNTIME_OWNERS ∪ {battle/battle.runtime.js}`。

**语义边界说明（未扩权项）**：`battle/battle.intents.js`（意图视图模型）、`battle/battle.animation.js`（可取消动画等待器，DOM 注入式）、`battle/battle.preview.js` 均不在旧键语义内，本次未纳入任何集合——守卫范围与腐化前严格一致，不借机扩权。

## 2. 防再发自检机制

- 脚本侧：新增导出 `deadGuardKeys(sources)`——遍历全部判据键（含目标侧写死路径与 `hub/`、`run/` 前缀），任一键在真实 `game/src` 树零命中即列入返回值。
- 测试侧（`tests/architecture-boundaries.test.js` 新增 2 项）：
  1. `守卫判据键自检：每个键必须命中真实文件，杜绝规则死、测试绿` —— 断言 `deadGuardKeys(真实树)` 为空；
  2. `自检本身能红：文件改名（或删除）会让对应判据键被判死` —— 从真实树拷贝中删除 `battle/battle.snapshot.js`，断言 `deadGuardKeys` 报出该键（证明自检具备失败能力，不是恒真断言）。
- 效果：未来再发生目录/文件改名时，守卫测试先在自检处红掉，不会再出现"规则死、测试绿"。
- 同步修正：4 个合成用例的判据键从死键名改为真实键名（旧用例恰因用死键名而无法发现规则已死）。

## 3. 守卫有效性实证（注入→红→还原→绿）

注入对象选择 `battle/battle.snapshot.js`（PURE_MODULES 成员，**无在途会话改动**；`battle.view.js` 等有在途改动，避让）。

1. **基线证据**（注入前，node 直跑守卫）：`deadGuardKeys: []`，`violations: []` —— 真实树零存量违例、键全部命中。
2. **注入两类已知违例**：
   - `import '../hub/game.storage.js';`（流程域反向依赖）
   - `export const __archGuardProbe = typeof window !== 'undefined' ? window.SDT : null;`（浏览器全局读取）
3. **结果（红）**：`architecture-boundaries.test.js` 11 项中 1 项失败，失败信息精确命中注入点：
   - `battle/battle.snapshot.js:3: 独立规则/快照模块不能反向依赖 hub/game.storage.js`
   - `battle/battle.snapshot.js: 独立规则/快照模块不能读取全局浏览器对象 window:5, window:5`
   - 其余 10 项（含自检 2 项）不受影响。
4. **还原**：从 `.tmp` 备份 `cp` 回写，`cmp` 校验**字节一致**，`git status` 对该文件为空，备份已删除。
5. **复跑（绿）**：6 个目标测试文件全绿（见下）。

## 4. 存量违例豁免清单

**空**。守卫复活后对真实树（144 个 JS）的裁决为 `violations: []`，五条域规则（runtime 所有权、视图禁旁路、纯模块禁反向依赖/禁流程域/禁浏览器全局）全部零违例——此前恒空集"碰巧"与现状一致，但如今是**规则活着得出的零**，且有自检保证规则持续活着。

## 5. 验证记录

```
node node_modules/vitest/vitest.mjs run tests/architecture-boundaries.test.js tests/contracts.test.js
  tests/battle-architecture.test.js tests/bag-architecture.test.js
  tests/hub-architecture.test.js tests/run-architecture.test.js --no-file-parallelism
→ Test Files 6 passed (6) / Tests 57 passed (57)
  （architecture-boundaries 11 = 原 9 + 自检 2；contracts 17；battle 13；run 6；hub 5；bag 5）
```

**遗留盲区（只记录，不在本次边界内）**：`contracts.test.js` 的"核心机制层不访问 DOM"白名单为 opt-in 制，`battle.actions.js`、`effect-steps.*` 等纯逻辑模块不在名单内（audit P0-1 连带盲区，属该文件改造，本次硬边界未触碰）。
