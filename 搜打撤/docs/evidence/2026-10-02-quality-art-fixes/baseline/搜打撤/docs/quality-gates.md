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

日常按改动选相关测试；`test:target` 必须显式指定测试文件，不触发全量 `pretest`。普通提交门与冻结 index 门使用同一选择器，实际理由以 `check:staged:plan` 输出为准：

| 暂存变化 / 条件 | 本地选择 |
| --- | --- |
| 能确认直接或近邻测试的源码 | 定向测试 + contracts / architecture-boundaries 哨兵；间接扇出大而已有直接测试时优先短反馈 |
| 数据、剧情、fixture / helpers | 依赖图或引用定向；剧情编译仍在门内执行 |
| 已映射流程脚本、Agent compare / provenance | 专属契约测试；scripts 未映射/豁免脚本用 scripts-contract、文本引用核对与哨兵 |
| 纯删除 / 改名 | 删除引用定向 + 哨兵；改名按删除与新增解析，缺失测试、孤立新源码或类型变化保守升级 |
| lockfile 单独变化 | 架构哨兵；依赖完整性仍须核对 |
| package.json 仅 scripts 变化 | 非 scripts 内容与 HEAD 相同、脚本引用可达且无 lockfile / vite 配置同改才豁免全量，保留哨兵 |
| 包/构建配置其他变化、未映射 game/tools、FULL_SOURCE 公共状态/启动/存储/迁移边界 | 全量；源码清单与映射以 [acceptance-gate](../scripts/acceptance-gate.mjs) 为准 |
| 存活源码无可确认测试、定向选择超过测试文件上限 | 保守全量；上限以选择器 TEST_LIMIT 为准 |
| 纯文档 / 样式 / 图片 | 无 Vitest 路径可标 skip；提交门仍检查文档契约，玩家可见变化另需实页/图片验收 |

quick / full 执行剧情编译、语法、数据、类型、lint 与所选 Vitest。类型配置来自 [check-types 的 configs 清单](../scripts/check-types.mjs)，配置数量不在流程页另行维护。quick 只证明所选范围，全量覆盖与人工游戏验收分别记录。

现行出口：暂存命中无主物品先认领/排除；普通门发现相关未暂存、未跟踪或被忽略输入则拒绝以混树冒充 index。冻结验收隔离半成品，期间 index、依赖或受验输入变化均作废。任何逃生变量都是明确绕过，不是提速或验证通过；失败按输出补验。相关历史实证见 [快速门执行记录](archive/records-2026-09-28/ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md)和原任务证据，不在本页复述事故时间线。

快速门是局部反馈，不表示整项目通过。全量以 CI（master push/PR）为准；本地 `npm test` 全量在阶段收尾、集成风险需要且 CI 尚未覆盖时按需运行，"落库"不自动触发本地全量。全量已知红灯三项（boot.test 超时、hub-flow-regression 断言、m7-battle 随机获取断言）已于 10-01 修复清零：全量 266 文件/2131 通过/2 跳过/0 失败，详见 [PENDING #22](PENDING.md) 已决记录；此后本地全量结果按实际输出判读，出现红灯按新问题处置，不对照旧红灯豁免。`FORCE_FULL_TESTS=1` 可在提交钩子中强制旧全量路径；`SKIP_FULL_TESTS` 是明确绕过本地门，绕过后的提交不得记为本地验证通过。Git hooksPath 在同一仓库的工作树间共享；安装脚本拒绝从附属工作树改写它。隔离工作树检查新钩子时应直接运行该钩子或脚本的显式路径模拟，不据隔离提交推断其钩子已生效。

### 验收分级（09-30 双端对齐，保留 09-29 老板拍板）

| 改动 | 必要验收 | 证据限制 |
| --- | --- | --- |
| 纯工程说明/流程文档 | 自有 diff、事实/指针核对、相关文档守卫；不跑游戏全量或 build | 玩家可见文案/图片变化仍需对应实页/图片检查 |
| A 档删除 | 删除先获批；静态三证据 + 定向验证，免实页 A/B、免全量 Vitest | 三证据不全或分类不确定，一律 B 档 |
| 内部流程脚本/工具契约 | 对应定向契约测试；不要求游戏实页或 build | 行为涉及游戏或浏览器证据时另验对应场景 |
| B 档游戏语义 CSS/逻辑/共享架构 | 定向验证 + 当前窗口内置浏览器实页；公共游戏边界按风险补集成验证 | 相同源码、相关环境与范围的有效证据可复用；全量与实页各自记覆盖 |

A 档三证据：①与幸存正本逐字相同或全库零引用（搜索含 html/md）；②级联/调用关系可静态证明；③加载序靠后的文件没有同名活规则。证据照常落档；删除获批不代表自动提交获批。

本矩阵描述人工验收，不修改 `acceptance-gate.mjs` 的选择算法或提交钩子；钩子仍按实际暂存路径运行，冲突先说明，不自行绕过。全量测试与构建需稳定的自有环境；其他会话半成品在共享树时不 build，定向结果注明混树边界。

`npm run check:syntax` 使用项目已有的 Acorn，解析 `game/src`、`game/tools` 和 `scripts` 下的 `.js`、`.mjs`、`.cjs` 文件；跳过生成目录、依赖和临时目录。它报告相对路径、行、列，并在发现语法错误时以非零状态退出。它只检查语法，不做类型检查、规则检查或 ESLint 分析。

`npm test` 使用 Vitest 默认文件并行与 dot reporter（09-29 起）；现有 `pretest` 生命周期保持不变，会先编译剧情并校验数据；`npm run build` 同样保留现有 `prebuild` 数据/剧情检查和 `postbuild` 性能预算检查。

在可构建的干净工作区，可用 `npm run check:quality` 按语法、数据、类型、lint、测试、构建顺序执行完整本地质量门。该组合入口会运行测试和构建各自已有的生命周期钩子。工作区有其他会话半成品时，不运行包含 build 的组合入口，分别执行必要检查。`npm run typecheck` 的实际覆盖见 [configs 清单](../scripts/check-types.mjs)与各 jsconfig 的 include；严格检查的边界说明见[开发指南](development.md)，通过不代表全项目 strict。

混合工作树可先用 `npm run check:staged:isolate -- --plan` 核对，再显式运行隔离验收。工具冻结实际 index、按对象导出原始字节并复制经锁核对的依赖；依赖不符、index变化、检查改写快照、失败/中断都拒绝通过。它复用 index 版现有门的选择，不读取未暂存配置，不安装、不 build、不提交。没有暂存或纯说明未运行测试时标 skip，不能宣称全量通过；结果不绕过既有提交钩子。冻结报告的 gateReceipt 可用 `--reuse <报告>` 或 `GATE_RECEIPT` 交给门禁：精确匹配 index、选定检查、输入和依赖/环境后复用，任一校验失败就补验；工作树 verify 报告只是候选，不能冒充冻结 index。

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

- Codex 与 ZCode 都只能使用当前平台内置浏览器访问 Vite dev server；默认只验当前窗口，多尺寸须老板明确要求。不要用外部 Edge/CDP/headless 或 `python http.server` 替代。共享工作区有其他未提交任务时，不运行会污染 build/HMR 的流程。
- Codex：使用当次可用的内置浏览器工具入口；本轮是 `mcp__cua_repl` 的 `cua` API，首次按工具文档获取状态/绑定标签页。ZCode：使用当次内置浏览器工具说明与已授权桥接入口；方法名、返回值与点击能力先核实，历史经验不代表当前能力。
- 内置浏览器不可用、没有来源页或服务不可安全启动时，记录平台、来源地址、时间、错误和未核验场景；继续独立工作，不换外部浏览器，不宣称实页通过。
- 战斗验收走真实开局流程；`devForceBattle` 在没有随身卡牌的新局会拒绝启动。标题页 `#titleDev` 面板只用于构造节点入口测试。
- 交互优先走当次工具支持的真实输入。输入失效先核实现场；工具明确支持页面求值时可构造功能场景，合成事件需标注，不能当成真实输入/hover 证据。截图发黑先检查转场；启动等待采用工具支持的有界检查，页面疑似旧 bundle 时核对加载来源与缓存，重载前确认不会打断别人的验收。
- 检查页面 `error`、真实状态和完整交互路径。单张截图、DOM 静态结构或自动化单测不能替代真实页面验收；战斗日志位于 `#log`。
- 截图证明外观，计算样式 A/B 证明所选属性差异，合成交互证明所构造事件路径，真实输入/hover 证明真实输入路径，刷新/读档证明该存档场景；分别列范围，不互相替代。不得为了截图掩盖真实错误。
- 浏览器证据统一入口为 `npm run workflow -- browser import/compare`（实现在 `scripts/workflow-browser.mjs`；旧外部驱动原文见[归档](archive/workflow-completion-2026-09-30/README.md)，旧 page-snapshot 命令名已于 10-02 清理）。采集由当次内置工具完成，平台/操作声明须核对；窗口/origin/身份不一致记 inconclusive。`scripts/iab-drive.mjs` 已于 2026-10-01 收编纳管（WF-acceptance-scenes，PENDING #21 销账），作为内置浏览器驱动与验收剧本的一行式入口。
- 玩家可见变化的 B 档实页验收可用固定剧本（`SDT.Agent.scenes`，协议见 agent-protocol「验收剧本」节）：剧本断言 JSON 当逻辑证据 + 当次内置浏览器关键页截图 1–2 张当视觉证据，两者合并构成实页证据，验收结论仍由执行会话下（2026-10-01 老板拍板）。场景报告与过程坑记录落 `docs/evidence/<日期>-<任务>/`；长场景（>60s）在共享树受并行会话 HMR 重载限制，受阻时以 jsdom 同源测试先行、实机补跑挂 PENDING。

## CI 状态

每次交付说明最近全量实际覆盖的来源版本/相关输入指纹、结果与报告链接；远端 CI 要有对应提交的 Actions 链接和状态，不能以配置存在推定通过。本地远端引用未刷新标未核实；尚未推送/尚未提交的源码增量列未覆盖。全文档 HEAD 变化不必使相同源码证据失效，但必须复核相关输入。快速门、全量、构建与游戏实页分别记结果；skip 不算通过。没有全量覆盖也可完成定向任务，交付明确边界和阶段收尾补验条件。

`ci.yml` 使用锁定依赖，先运行语法、类型、lint，再通过 `npm test` 的 pretest 编译剧情、验证数据并执行默认并行的全量 Vitest；`vite-quality.yml` 使用同一 Node 版本和锁定依赖，只运行 Vite 构建（其 prebuild 编译剧情并验证数据、postbuild 检查预算）。这避免相关 PR/推送重复执行两份全量测试，也让剧情源文件在测试前生成。两条工作流的触发范围不同；文档只描述配置，远端 GitHub Actions 是否实际运行及结果以对应提交或 PR 的记录为准。

2026-09-23 本地独立提交 `89e46fa` 验收：隔离 Vite checkout 使用锁定依赖，语法检查 148 文件、数据校验、109 个测试文件 / 622 项、生产构建与原性能预算全部通过。首屏 JS gzip 227.7 KiB，入口 186.1 KiB，重复资源 0.52 MiB。基地首次加载、照相馆、战斗检查点恢复、胜利收取战利品及战后刷新读档已在内置浏览器验证。远端 Actions、长期运行性能及完整撤离/死亡分支仍未验收；详细证据与边界见 `architecture-alignment-plan-2026-09-23.md`。

2026-09-28 分层验收改造的路径选择、三类快速门耗时、一次全量失败的跨平台断言修复、最终 224 文件全绿与生产预算结果见 [执行记录](archive/records-2026-09-28/ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md)。证据来自隔离工作树；远端 Actions 未核实。
