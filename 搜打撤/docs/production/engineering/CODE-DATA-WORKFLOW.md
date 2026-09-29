# 代码与数据工作流

本文记录 Vite 主线当前事实；建议项单列，避免把流程约定写成已实现能力。项目入口见 [README](../../../README.md)，规则细节见[架构](../../architecture.md)、[开发指南](../../development.md)、[存档契约](../../save-format.md)与[质量门](../../quality-gates.md)。

## 当前事实

### Git 与并行集成

- 本仓库实际包含冻结的 Godot/Unity/EXE 等内容；本项目约束限定本轮产品开发在 `搜打撤/` Vite。提交前先看 `git status --short`、`git log -1` 和当前变更归属。共享工作区有其他会话未提交内容时，不覆盖其文件、不构建、不顺手提交；只读相关 diff 或 `--stat`。
- 并行工作按文件/目录明确所有者。集成时以实时工作区为准，检查目标文件差异、冲突和调用契约；不可用旧交接或历史快照代替当前状态。集成快照应记录时间、HEAD 与远端差异、证据和未核实项；共享现行记录被占用时另建记录。
- 删除/移动（含临时文件）须先列出路径并获同意；回滚、提交、推送和发布须有明确指示。禁止 `git clean` / `git checkout` 清理现场。

### 模块入口

`index.html` 以 ESM 加载 `game/src/main.js`；`boot-order.js` 是启动顺序事实源，`game.boot.js` 负责跨域接线。`core/`、`ui/`、`battle/`、`cards/`、`run/`、`hub/`、`home/`、`audio/`、`agent/` 是主要功能域。模块依赖层次、边界及延迟加载约束见 [src 模块说明](../../../game/src/README.md)和[架构文档](../../architecture.md)。

| 数据/状态 | 权威来源 | 生成、校验与运行时关系 |
|---|---|---|
| 游戏规则、地图格与遭遇 | `game/src/core/rule-config.js`（跨模块数值真源）、`core/rules.js`（兼容门面）、`core/mapData.js`、`run/game.run.data.js` | 运行模块读取规则/授权数据；调整概率、容量等定向跑相应校验。 |
| 宠物、成就与场景内容 | `game/data/pets.json`、`achievements.json`、`scenes.json` | `scripts/validate-data.mjs` 检查这些类别的部分必填字段、重复 id 与引用；具体行为仍需对应领域测试和实页核对。 |
| 素材映射与清单 | `game/data/art-mapping.json`、`game/assets/asset-manifest.json`；可编辑原稿在 `game/art-source/` | 数据校验检查已登记映射的部分目标文件，资产审计检查体积/重复与清单；运行时是否引用仍须核对加载代码和真实页面。 |
| 卡牌定版同步数据 | `game/data/cards-sync.json` 及其定版来源 | 由 `scripts/sync-cards-from-live.mjs` 生成/更新；勿手改 JSON。`cards.catalog.js` 按稳定 id 解析，`cards.sync*.js` 负责既有档案播种迁移；由数据验证、同步快照守卫等检查。 |
| 其他卡牌、规则与迁移 | `game/src/cards/cards.data.js`、`cards.rules.js`、`cards.sync*.js`、`cards.consts.js` | 运行时卡库由 cards 门面装配；迁移 key/版本控制旧档播种。TT10/TT11 的内联历史快照须符合定版守卫。 |
| 剧情 | `narrative/events.ink` | `scripts/compile-narrative.mjs` 生成 `game/src/generated/narrative-events.js`；生成文件勿手改，启动/测试/构建会编译。 |
| 普通局地图拓扑与随机状态 | 存档内 `mapSnapshot`、seed/version、`rngState` | 新局由生成器产生；恢复先严格校验，再重建派生坐标/缓存。龙巢使用独立状态。见[存档契约](../../save-format.md)。 |
| 进行中对局、基地进度 | localStorage 的 `sdt-save-v2-slot1..5`、`sdt-base-v2-slot1..5` | `game.storage` / `hub` 存储边界读写；格式变更须更新兼容样本与迁移测试。分开的 Run/Base 写入不等于跨存储原子事务。 |
| Agent 逐局记录与聚合 | Agent runner/recorder/stats；批跑 `runs.jsonl`、`summary.json` | `game/tools/agent-batch.mjs` 在新汇总中记录代码/运行条件指纹；`agent-compare.mjs` 校验配对与实验条件并输出机器判决；`agent-ledger.mjs` 记录假设、T/V 产物 hash 与判决。具体晋级条件和人工留证见[实验复现约定](AGENT-EXPERIMENTS.md)。批量结果不是浏览器真实体验验收。 |
| 图鉴文档 | 卡库运行数据 | 常规测试只在内存比较；显式 `npm run docs:compendium` 才写 `docs/game-compendium.md`。 |

### 验证与 CI 边界

- 默认定向验证。按改动选择 `check:syntax`、`validate:data`、`typecheck`、`lint`、相关 Vitest、浏览器实页或图片复核。CSS、文案和图片变化应看真实页面/图片。全量 `npx vitest run`（默认并行；2026-09-29 实测解除旧串行规则：234 文件/1888 用例 304.5s→约 55s，连续 4 次全绿）用于收尾落库或公共架构变化；共享工作区有他人半成品时禁止 build。
- `.github/workflows/ci.yml`：master push 与 PR 触发；Node 22，`npm ci`、语法/类型/lint，再由 `npm test` 的 pretest 编译剧情、校验数据并执行全量 Vitest；该 workflow 没有构建步骤。
- `.github/workflows/vite-quality.yml`：master push 与 PR 按 Vite 路径过滤触发；Node 22，`npm ci` 与 `npm run build`（prebuild 处理剧情/数据，postbuild 检查性能预算），不重复全量测试。配置只说明预期流水线，是否实际运行/通过须查对应 Actions 记录。
- 本地质量门脚本和覆盖限制见[质量门](../../quality-gates.md)。构建成功、静态测试或 Agent 模拟均不单独代表实页完整验收。

### 已知债务与防重复建设

- TypeScript 检查按显式配置边界增量覆盖；通过 typecheck 不代表全项目严格类型检查。存档层仍有兼容旧流程直接写状态的路径；Base 与 Run 分存储也不是统一原子事务。
- RenderScheduler 文档已按当前源码更正为活动上限目标 120 FPS、静态空闲零绘制；这不等于实页已稳定达到 120 FPS。`development.md` 中桌面发布步骤属于已冻结的 EXE 线，接手时以 Vite 开发路径为准。
- `cards-sync.json` 是生成物，勿手改；剧情生成文件勿手改；普通测试不会刷新图鉴文档。先复用现有同步器、编译器和生成入口，不另造平行真源。
- 架构图及依赖守卫已有 `scripts/architecture-graph.mjs`、`tests/architecture-boundaries.test.js` 与 contracts 检查；不要新建第二套模块分层/循环扫描器。
- Agent 已有协议、策略迭代手册、batch、compare、evolve、supervise 和 ledger。先扩展现有结果记录/台账约定，不另建一套实验 runner 或跟踪服务。

## 建议

- 新增源数据时，在同一改动中说明权威文件、生成命令、校验入口与运行时消费者；生成物更新必须审阅 diff。
- 并行任务开始前明确文件所有权和集成点；交接保留命令及原始输出/产物位置，结束只汇总实际运行证据。
- 验证报告分别标明定向检查、全量检查、构建、实页验收；未执行的门槛写“未核实”，不从旧快照推断当前通过。
