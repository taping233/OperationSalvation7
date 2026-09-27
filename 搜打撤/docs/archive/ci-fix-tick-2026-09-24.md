# CI 平台差异修复：敌方步进节拍 vitest 归零（2026-09-24）

## 根因（两行）

测试辅助用固定次数 `setTimeout(0)` tick 当等待预算，而引擎敌方回合靠真实 `setTimeout(step, 420ms)` 节拍推进；tick 真实间隔平台相关（Windows ≈15.6ms / Linux ≈1ms），CI 上预算在 840–1260ms 的敌方回合走完前耗尽，7 文件 9 用例确定性红。详见 `.tmp/audit-0924/ci-platform-diff.md`（含九用例机制表）。

## 改动（方案 A，点状 3 处，单文件）

文件：`game/src/battle/battle.enemy-phase.js`。**未动 `demoMs` 本体**（battle-pace.test.js 直接测其数学语义）。

1. import 块后新增环境探测常量（探测表达式与 `battle.engine.js:837` 的 `SURGE_WAVE_MS` 先例逐字同款）：
   ```js
   const ENEMY_STEP_ZERO = (typeof process !== 'undefined' && process.env && process.env.VITEST);
   ```
2. 两处敌方步进调用点（step 链尾 + 首步，原 182/184 行）：
   ```js
   setTimeout(step, ENEMY_STEP_ZERO ? 0 : demoMs(420));
   ```

**与任务书示例的偏差说明**：任务书示例为 `const ENEMY_STEP_MS = VITEST ? 0 : demoMs(420)`（模块加载期求值）。实测 `demoMs` 每次调用动态读 `pace`（支持运行时 1×/2× 档切换，`battle.pace.js` 的 `setPace`），模块期固化会把 2× 档对敌方步进的缩放钉死在加载时的档位，属运行时行为变化。故改为探测布尔 + 调用点三元：vitest 下为 0，运行时 `demoMs(420)` 照常逐次求值，玩家侧零影响。

## 验证证据（本地 Windows + node v24.13.0，vitest 3.2.7）

| 批次 | 文件 | 结果 | tests 耗时 |
|---|---|---|---|
| demoMs 本体 | battle-pace | 5/5 绿 | 3ms（无误伤） |
| enemy-phase 相关 | battle-modules、battle-lifecycle、nest-hearts、nest-regression、nest-runemaster | 21/21 绿 | 866ms |
| CI 九受害用例所在 7 文件 | hero-cards、direct-cast、chase-slash、rapid-fire、r3-b-action-boundary.repro、r7a-battle-orders、message-fixes | 43/43 绿 | 18.36s（基线同批 43.49s，↓58%） |
| 其余 endTurn 调用方 | abyss-sovereign、boot、playthrough-bot、tt12-hitechrd-battle-baseline、tt12-hitechrd-structured | 26/26 绿 | 6.51s |
| 全量 | **142 文件 / 800 用例** | **全绿** | tests 59.20s，总 Duration 225.26s（wall 3m45.96s） |

- 全量用例数 798→800：工作区另有并行会话在途改动（nest/extraction/hub 等 +2 用例），非本改动引入。
- 全量耗时 225s vs 基线 ~250s：下降主要在战斗测试墙钟等待（定向批可见 43.5s→18.4s）；剩余大头是 vitest environment 启动（107s），不属本修复范围。

## 节拍依赖检查（任务 4）

全 tests 目录 rg `demoMs|420|步进|节拍`：仅 4 文件命中——
- `battle-pace.test.js`：只测 `demoMs` 纯数学（1×/2×/80ms 下限），不经过本次改的调用点，绿；
- `camera-interaction.test.js`：420 是镜头坐标，无关；
- `message-batch-0917.test.js`：SURGE_WAVE_MS 先例的注释，其节拍本就 vitest 归零；
- `contracts.test.js`：无节拍断言。

另核对了全部 12 个调用 `endTurn` 的测试文件并定向跑绿。**结论：无任何测试依赖非零敌方节拍或断言敌方回合中间态，无需测试文件微调。**

## 在途改动共存说明

开工时 `battle.enemy-phase.js` 已有并行会话的在途改动（import 区 3 行 unused-symbol 清理，关联 `docs/lint-unused-cleanup-exec-2026-09-24.md`）。经确认与其零重叠（本改动在 import 块之后追加常量 + 函数体内两处调用点），Edit 精确替换未覆盖在途行，双方改动共存于工作区，各自落库。

## 遗留项

- **真验收未完成**：需推送后 GitHub Actions "CI" workflow 在该 commit 转 142/142 绿。推送须老板明确指示，本次未 commit/push。
- Linux 侧 `setTimeout(0)≈1ms` 仍是由 CI 耗时反推（未直接打点），见审计报告未核实项。
