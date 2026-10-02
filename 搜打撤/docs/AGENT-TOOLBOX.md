# Agent 工具箱（按意图查表）

给 agent / 会话的能力地图：**我想做 X，用什么**。工具是助力不是门槛——本表只回答「哪里有能力」，流程纪律（授权边界、登记、验收分级）以根 AGENTS.md 与 [WORKFLOW-TOOLS](WORKFLOW-TOOLS.md) 为准，不在此重复。新工具落库时在本表加一行；工具合并/删除时同步移除并更新引用。

## 一图流：一次开发的典型路径

```
接手 ── npm run handoff（实况：HEAD/占用/无主/活账）
  │
动手前 ─ npm run impact -- <路径>（撞线？谁引用？跑什么测试？）
  │
改代码（只改任务范围）
  │
验证 ── impact 输出的现成命令 / npm run test:target -- tests/x.test.js
  │        玩家可见变化 → 内置浏览器跑 SDT.Agent.scenes 剧本
  │
收官 ── workflow task close（需跨会话跟踪时才建任务）；登记销账
```

## 意图 → 工具

| 我想要 | 用什么 | 说明 |
| --- | --- | --- |
| 接手时看实况（HEAD/并行占用/无主/活账） | `npm run handoff` | 单命令简报；`-- --json` 拿结构化数据；含登记行失真核对（编辑中无动静/已落库残留自动浮疑点）与活账老化提示（⏰ 最老五项） |
| 动手前查影响面（撞线/反向依赖/该跑什么） | `npm run impact -- <路径...>` | 属地撞线提示先协调；反向闭包分层；输出可直接复制的验证命令；`--json`/`--all` |
| 理解代码结构与依赖关系 | `code-map/index.html`（5301 端口，可视化）；`docs/architecture.md`；`game/src/README.md` | code-map 为在途会话产物，状态见 [REGISTRY](PARALLEL-REGISTRY.md) |
| 查某测试/脚本覆盖哪些文件 | `npm run --silent workflow -- status --paths <路径>` | 流程脚本状态与依赖闭包 |
| 起服（主线 5200 幂等复用） | `npm run web` | 「拉起网页版」固定指令；详细口径见根 AGENTS |
| 跑固定验收剧本（battle/shop/event/extract/fullrun 等 10 场景） | 内置浏览器 console：`await SDT.Agent.scenes.run('battle')`；或 `scripts/iab-drive.mjs` 的 `runScene(tab, 'battle')` | 一次调用=前置+驱动+断言+结构化报告；剧本清单 `SDT.Agent.scenes.list()`；协议见 [agent-protocol](agent-protocol.md) |
| 驱动游戏页面实测 | `scripts/iab-drive.mjs`（node_repl import 函数库） | ZCode 内置浏览器专用；`openGame()`/`clickDevButton()`/`evalRaw()`；默认主线 5200 |
| 跑定向测试 | `npm run test:target -- tests/a.test.js tests/b.test.js` | 只收 tests/*.test.js |
| 留验证证据（自动报告） | `npm run --silent workflow -- verify --task <编号> --tests/--paths ...` | 详见 [WORKFLOW-TOOLS](WORKFLOW-TOOLS.md) |
| 混树提交前冻结检查 | `npm run check:staged:isolate -- --plan --json` | 只验冻结 index；确认后去掉 --plan |
| 建跨会话任务台账 | `npm run --silent workflow -- task start/update/close ...` | 单会话小修不需要，见免登规则 |
| 老板拍板事项 | [PENDING](PENDING.md) | 唯一真源，拍板即销账 |
| 找历史经验 | `npm run memory:discover -- --json` | 项目记忆索引，按需读正文 |
| 文档一致性检查 | `npm run docs:check -- --json` | 守卫=tests/docs-consistency.test.js |
| 性能基线 | `npm run perf` / `perf:soak` / `perf:budget` | 手动基准与预算门 |

## 机制的松与紧（2026-10-01 老板口径）

- **自助查询类**（handoff/impact/code-map/status/memory:discover）：只读、不登记、不阻断，随便用。
- **硬门只有三处**：提交门（staged 检查）、并行属地（他人未提交内容不覆盖）、删除/回滚/发布授权。这是并行开发的底线，不是对发挥的限制——门内怎么实现、怎么验证完全自由。
- **免仪式范围**：单会话活跃时小额共享台账修改与说明类小修直接做（详见根 AGENTS 10-01 合并版），不必走 task/SHA 两段式。
- 工具不好用就说：低效工具可重写/合并/删除（删除报批清单见 PENDING），不将就。

## 保养

- 新脚本进 `scripts/` 时：在 acceptance-gate `WORKFLOW_TESTS`（配专属测试）或 `EXEMPT_SCRIPTS` 登记，否则 scripts-contract 守卫红——一行登记换 quick 门定向加速，值。
- 本表行与真实命令失配时以 `package.json` scripts 与脚本头注释为准，改完命令同步本表。
