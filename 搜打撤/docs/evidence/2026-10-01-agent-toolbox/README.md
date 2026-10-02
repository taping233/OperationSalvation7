# 2026-10-01 agent 工具箱（WF-agent-toolbox）

老板指令：「做一些有利于并行开发 快速迭代 常用操作 agent理解和测试游戏的工具或者框架」+ 追加「要配 agent 使用文档；原机制别太限制 agent 发挥；低效工具可重写/合并/删除」。

## 交付物

| 交付 | 路径 | 说明 |
| --- | --- | --- |
| 影响面查询工具 | `scripts/impact-query.mjs` + `npm run impact -- <路径...>` | 一次答四件事：并行属地撞线（解析 REGISTRY 活跃表）/ 反向依赖闭包（直接+传递分层，src/tests/scripts/tools 全覆盖）/ 验证计划（复用 acceptance-gate planForPaths，与 quick 门同源）/ 可直接复制的现成命令。`--json` 结构化、`--all` 不截断、目录自动展开为文件集 |
| 专属测试 | `tests/impact-query.test.js`（14 用例） | 路径归一/token 提取（含「不碰」排除声明防误报）/活跃表解析/双向包含/BFS 分层含环/端到端真实仓库断言 |
| gate 映射登记 | `scripts/acceptance-gate.mjs` 两处 | `reverseImports()` 导出复用（影响面与 quick 门同图同口径）+ WORKFLOW_TESTS 加 impact-query 行（scripts-contract 守卫要求） |
| agent 工具箱文档 | `docs/AGENT-TOOLBOX.md` | 意图→命令查表（接手/影响面/结构理解/起服/剧本/验证/台账/记忆）；「机制的松与紧」节落老板口径：自助查询随便用，硬门只三处（提交门/属地/删除授权）；挂 docs/README.md 两处路由 |
| iab-drive 端口对齐 | `scripts/iab-drive.mjs` | 默认 URL 5334→5200（主线 Vite 约定），隔离验收显式传 url 覆盖 |
| 清理清单报批 | `docs/PENDING.md` #29 | page-snapshot 合并/perf-ledger-capture 去留等，全部只报未动 |

## 设计取舍

- **复用不重造**：测试计划直接 import `planForPaths`、反向图 import `reverseImports()`（本会话新导出）——工具与 quick 门永远同口径，不会出现「工具说 quick、门说 full」的漂移。
- **测试游戏方向本轮不新建**：盘点发现 SDT.Agent.scenes 十场景 + iab-drive runScene 已把实机验收压到两行（openGame + runScene），本轮只做端口对齐；剧本扩展的真缺口是 PENDING #26 宝箱队列 bug 修复后的 extract/fullrun 收口，属修 bug 非建工具。
- **并行开发方向**：handoff/task ledger/staged isolate 已厚，缺口在「动手前自助预检」——impact 补的就是这一环（此前要人读 REGISTRY 全表比对）。

## 验证记录（2026-10-01 深夜）

- `npx vitest run tests/impact-query.test.js` → **14/14 绿**（含两轮修复：目录属地 token 提取、单段目录正则）
- `npx vitest run tests/scripts-contract.test.js` → **37/37 绿**（映射守卫认 impact-query 登记）
- `npx vitest run tests/acceptance-gate.test.js` → **23/23 绿**（reverseImports 导出无副作用）
- `npx eslint`（4 个改动文件）→ 0 问题
- `npm run docs:check -- --json` → ok:true，AGENT-TOOLBOX.md 入扫描，无新 findings
- 实跑冒烟：`game/src/agent`（目录展开：直接 18+传递 47）、`code-map/generate.mjs`（属地命中 WF-code-map ✓）、`game/src/run/game.session.js`（37 直接引用者、「不碰 game/」排除声明不误报）

## 并行协调记录

- WF-code-map（待验收）属地 `code-map/`——零接触。
- WF-DEBT-campaign（10-02 登记，进行中）在其行内将 `scripts/impact-query.mjs` 误标为 WF-code-map 属地；本会话 REGISTRY 行已澄清实际归属（其「不动」声明对本会话是避让，双方零冲突）。

## 未验项

- 未跑游戏全量（纯工具域改动，定向+契约+文档守卫足够；按 quality-gates 口径全量以 CI 为准）。
- `npm run impact` 的 JSON 输出消费者（其他 agent 会话）尚未有真实使用反馈。
