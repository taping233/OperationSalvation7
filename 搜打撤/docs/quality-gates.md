# Vite 质量门

本页记录搜打撤 Vite 主线的本地检查与 GitHub Actions 检查。仓库根目录的 `.github/workflows/ci.yml` 在发往 `master` 的 PR 和 `master` push 上运行静态检查与完整测试；`.github/workflows/vite-quality.yml` 在 Vite 相关路径变更时运行生产构建及预算检查。两条工作流均使用 Node.js 22。

## 本地检查

在 `搜打撤` 目录执行：

```sh
npm run test:target -- tests/battle-hand-selection-rules.test.js
npm run check:staged:plan
npm run check:staged
npm run check:syntax
npm run validate:data
npm test
npm run build
```

日常先按改动选相关测试；`test:target` 要求显式指定测试文件，避免漏填时误跑全量，且不触发全量 `pretest`。提交钩子调用 `scripts/acceptance-gate.mjs`，根据暂存路径先打印选择理由，编译剧情，再执行语法、数据、七配置类型、lint 和定向 Vitest。源码改动附带 `contracts` 与 `architecture-boundaries` 两项架构哨兵；能确认的直接或近邻测试纳入快速门。Agent compare/provenance 工具有专属定向测试；`agent-batch.mjs`、`agent-ledger.mjs` 和其他未映射的 `game/tools` 改动回退全量，不能跳过。老板已确认速度优先的口径：当间接测试扇出很大但存在直接测试时，本地只跑直接测试及架构哨兵，完整套件交由 CI 与阶段收尾；这仍是局部验收。数据、脚本、测试配置、公共状态/启动/存储/迁移边界、无可确认测试或实际选择超过上限会回退完整 Vitest。暂存提交涉及源码等验收门路径时，若同一工作树还有未暂存的相关改动，门禁拒绝以混合状态冒充暂存快照；剧情编译或测试引起的新差异也会再次检查。纯文档、样式和图片跳过本地 Vitest 门，玩家可见变化仍须做实页或图片验收。

快速门是局部反馈，不表示整项目通过。公共架构变更或阶段收尾使用 `npm test` 和所需完整质量门；CI 保留一次完整套件。`FORCE_FULL_TESTS=1` 可在提交钩子中强制旧全量路径；`SKIP_FULL_TESTS` 是明确绕过本地门，绕过后的提交不得记为本地验证通过。Git hooksPath 在同一仓库的工作树间共享；安装脚本拒绝从附属工作树改写它。隔离工作树检查新钩子时应直接运行该钩子或脚本的显式路径模拟，不据隔离提交推断其钩子已生效。

`npm run check:syntax` 使用项目已有的 Acorn，解析 `game/src`、`game/tools` 和 `scripts` 下的 `.js`、`.mjs`、`.cjs` 文件；跳过生成目录、依赖和临时目录。它报告相对路径、行、列，并在发现语法错误时以非零状态退出。它只检查语法，不做类型检查、规则检查或 ESLint 分析。

`npm test` 会按文件串行运行 Vitest，并使用 dot reporter。现有 `pretest` 生命周期保持不变，会先编译剧情并校验数据；`npm run build` 同样保留现有 `prebuild` 数据/剧情检查和 `postbuild` 性能预算检查。

在可构建的干净工作区，可用 `npm run check:quality` 按语法、数据、类型、lint、测试、构建顺序执行完整本地质量门。该组合入口会运行测试和构建各自已有的生命周期钩子。工作区有其他会话半成品时，不运行包含 build 的组合入口，分别执行必要检查。`npm run typecheck` 汇总七个配置；selection 配置只检查战斗选牌工厂新增外部端口的 JSDoc 调用契约及正反编译 fixture；hand-selection 配置严格检查纯手牌选牌规则、发现候选与状态 builder、独立发现流程实现及其类型 fixture。旧 `battle.selection-flow` 其余交互状态与 runtime/engine 接线不因此自动纳入严格覆盖，也不代表整个战斗域已严格检查。

## 卡牌图鉴生成

普通 `npm test` 中的 `tests/compendium.test.js` 只在内存生成并比较图鉴，不会写回文档。需要有意更新 `docs/game-compendium.md` 时，运行现有入口：

```sh
npm run docs:compendium
```

该命令由 npm 提供的 `npm_lifecycle_event` 允许测试落盘生成结果；更新后应检查文档差异并随对应卡牌数据变更一并审阅。

## 卡牌效果审计

`tests/card-audit.test.js` 对战斗卡遍历六种职业上下文，按稳定卡 id 和完整未识别句式去重。新增未识别项会失败；已识别的旧例外也会失败，提醒删除过期记录。已知项集中在 `tests/fixtures/card-effect-audit-known.json`，每条必须说明逐句解析尚未识别，或审计缺少真实战斗上下文的原因。例外不代表玩法已验证，也不能通过只放行整个卡 id 来覆盖新句式。

`allowMissingCardIds` 仅列出当前工作区已有、但独立工程提交尚不包含的五张 TT12 卡。该卡存在时照常检查未知项和过期例外；缺少其他已记录卡牌仍会失败。TT12 正式合入后应删除这五个缺席许可，保留仍有证据支持的精确句式记录。

## 内置浏览器验收

- 优先使用 Codex 内置浏览器访问 Vite dev server；不要用 `python http.server` 直接提供源码。共享工作区有其他未提交任务时，不运行会触发 build/HMR 的流程。
- 战斗验收走真实开局流程；`devForceBattle` 在没有随身卡牌的新局会拒绝启动。标题页 `#titleDev` 面板只用于构造节点入口测试。
- locator 点击失效时先检查实际 DOM，再按需合成事件；截图发黑时先等待转场动画结束。启动状态 `boot` 可能持续较久，应轮询状态；页面疑似旧 bundle 时先重载确认缓存。
- 检查页面 `error`、真实状态和完整交互路径。单张截图、DOM 静态结构或自动化单测不能替代真实页面验收；战斗日志位于 `#log`。

## CI 状态

`ci.yml` 使用锁定依赖，先运行语法、类型、lint，再通过 `npm test` 的 pretest 编译剧情、验证数据并执行串行全量 Vitest；`vite-quality.yml` 使用同一 Node 版本和锁定依赖，只运行 Vite 构建（其 prebuild 编译剧情并验证数据、postbuild 检查预算）。这避免相关 PR/推送重复执行两份全量测试，也让剧情源文件在测试前生成。两条工作流的触发范围不同；文档只描述配置，远端 GitHub Actions 是否实际运行及结果以对应提交或 PR 的记录为准。

2026-09-23 本地独立提交 `89e46fa` 验收：隔离 Vite checkout 使用锁定依赖，语法检查 148 文件、数据校验、109 个测试文件 / 622 项、生产构建与原性能预算全部通过。首屏 JS gzip 227.7 KiB，入口 186.1 KiB，重复资源 0.52 MiB。基地首次加载、照相馆、战斗检查点恢复、胜利收取战利品及战后刷新读档已在内置浏览器验证。远端 Actions、长期运行性能及完整撤离/死亡分支仍未验收；详细证据与边界见 `architecture-alignment-plan-2026-09-23.md`。

2026-09-28 分层验收改造的路径选择、三类快速门耗时、一次全量失败的跨平台断言修复、最终 224 文件全绿与生产预算结果见 [执行记录](ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md)。证据来自隔离工作树；远端 Actions 未核实。
