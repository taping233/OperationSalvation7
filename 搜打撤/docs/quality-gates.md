# Vite 质量门

本地检查与 CI 的现行口径。`.github/workflows/ci.yml` 在 master 的 PR/push 上跑静态检查与全量测试；`vite-quality.yml` 在 Vite 路径变更时跑生产构建及预算检查；两条工作流均用 Node 22 与锁定依赖。

## 本地检查

在 `搜打撤` 目录执行；日常按改动选相关测试，`test:target` 必须显式指定测试文件。普通提交门与冻结 index 门使用同一选择器，实际理由以 `npm run check:staged:plan` 输出为准：

```sh
npm run test:changed -- --plan
npm run test:target -- tests/battle-hand-selection-rules.test.js
npm run check:staged:plan
npm run check:staged
npm run check:syntax
npm run validate:data
npm test
npm run build
```

| 暂存变化 | 本地选择 |
| --- | --- |
| 能确认直接或近邻测试的源码 | 定向测试 + contracts / architecture-boundaries 哨兵 |
| 数据、剧情、fixture / helpers | 依赖图或引用定向；测试 helper 透明传递到实际测试，不占业务邻近层数；剧情编译仍在门内执行 |
| 已映射流程脚本、Agent compare / provenance | 专属契约测试；未映射用 scripts-contract 与哨兵 |
| 纯删除 / 改名 | 删除引用定向 + 哨兵；孤立新源码或类型变化保守升级 |
| game/assets 图片 / 清单、资产审计债基线 | 静态与增量资产检查；新增/修改债阻断，旧债警告 |
| 纯文档 / 样式 / 非资产目录图片 | 无 Vitest 路径可标 skip；玩家可见变化另需实页验收 |
| lockfile 单独变化 / package.json 仅 scripts 变化 | 架构哨兵；仅 scripts 变化须非 scripts 内容与 HEAD 相同、脚本引用可达且无 lockfile/vite 配置同改才豁免全量，保留哨兵 |
| 包/构建配置其他变化、未映射 game/tools、FULL_SOURCE 公共状态/启动/存储/迁移边界、存活源码无可确认测试 | 全量；源码清单与选择算法以 [acceptance-gate](../scripts/acceptance-gate.mjs) 为准 |

quick / full 执行剧情编译、语法、数据、类型、lint、增量资产检查与所选 Vitest；eslint、jsconfig/tsconfig、Vitest 配置与提交钩子变更强制 full，类型配置见 [check-types 的 configs 清单](../scripts/check-types.mjs)。快速门报告所选范围；全量以 CI（master push/PR）为准。本地 `npm test` 全量在阶段收尾、存在集成风险且 CI 尚未覆盖时按需运行；落库沿用已选检查，红灯按新问题处理。`FORCE_FULL_TESTS=1` 在同一暂存验收链中强制 full；`SKIP_FULL_TESTS` 等逃生变量记为绕过，提交保留待补验状态，补齐失败或绕过的检查后再报告通过。

本地 `acceptance-gate.mjs` 的四项静态检查分阶段执行：语法与数据检查并发，二者结束后运行原类型检查，再运行原 ESLint；类型检查内部 11 个配置逐个执行，收齐结果后按配置顺序汇报，再执行原覆盖审计。配置、参数及 Vitest 选择范围、覆盖保持原样。四项收齐后统一判定，任一失败即停止后续步骤；下游和汇总诊断等待上游结束。日志保留各项输出、原生退出码、信号和 spawn 错误，空正文也显示退出结果。调度可能延长总耗时，资源改善及 OOM 根因分别按实测记录。

### 验收分级

| 改动 | 必要验收 |
| --- | --- |
| 纯工程说明/流程文档 | 以自有 diff、事实/指针核对和文档守卫完成验收；玩家可见文案/图片变化补对应实页/图片检查 |
| A 档删除 | 删除先获批；静态三证据 + 定向验证，免实页 A/B、免全量 Vitest；三证据不全或分类不确定一律 B 档 |
| 内部流程脚本/工具契约 | 以对应定向契约测试完成验收；行为涉及游戏或浏览器证据时补验对应场景 |
| B 档游戏语义 CSS/逻辑/共享架构 | 定向验证 + 当前窗口内置浏览器实页；公共游戏边界按风险补集成验证 |

A 档三证据：①与幸存正本逐字相同或全库零引用（搜索含 html/md）；②级联/调用关系可静态证明；③加载序靠后的文件没有同名活规则。证据照常落档；删除与提交分别取得授权。本矩阵用于人工验收，`acceptance-gate.mjs` 的选择算法与提交钩子沿用现行实现；钩子按实际暂存路径运行，冲突先说明并按结果处理。

工具说明：`check:syntax` 用项目 Acorn 查 `game/src`、`game/tools`、`scripts` 的语法；`npm test` 的 pretest 先编译剧情并校验数据；`npm run build` 保留 prebuild/postbuild 检查；`npm run check:quality` 在可构建的干净工作区按序执行完整质量门。混合工作树用 `npm run check:staged:isolate -- --plan` 核对后显式运行隔离验收：冻结实际 index、按对象导出原始字节并复制经锁核对的依赖；依赖字节证据接受 npm 根层或递归 `node_modules/.bin/<命令>` 相对文件链接，目标须在同层包内、匹配包 `bin` 声明，且路径各段均无链接。任意包内链接、越界、悬空、链式链接、依赖不符、index 变化、检查改写快照及失败/中断均阻断验收。冻结报告的 gateReceipt 精确匹配 index、选定检查、输入和依赖/环境后可复用，工作树 verify 报告进入候选复核。Git hooksPath 在同一仓库的工作树间共享，隔离工作树检查新钩子直接显式运行该钩子模拟。

### 测试收集与等待

Vitest 通过 `vite.config.js` 的两个互斥项目收集 `tests/**/*.test.js`：纯逻辑清单使用 Node，其余默认 jsdom，文件级环境声明仍生效。新增或调整纯逻辑测试时，确认测试及其传递依赖不使用页面接口，再添加 `@vitest-environment node` 并复测；需要页面的用例保留 jsdom。两者继承相同的进程池、并发和超时；`tests/quality-config.test.js` 核对实际收集结果，防止漏测或重复运行。`test:target` 与 `workflow verify --tests` 只执行指定 Vitest；剧情编译、数据及其他静态检查须按上表选择对应入口。

日常入口 `test:changed` 合并项目内暂存、未暂存及未忽略的新文件，沿用原选择器、阈值、公共边界和提交门执行 quick/full/skip。共享工作树可显式传本轮路径，命令见[流程指南](WORKFLOW-TOOLS.md#定向反馈)；没有改动时记 skip、未执行检查。

默认测试入口同时输出当次耗时报告，路径在控制台 `[tests] 耗时报告` 行，文件位于 `node_modules/.cache/test-reports/`。报告包含前10个慢文件、全部文件耗时及逐项跳过说明；缺少原因的跳过标为原因未提供。并发文件耗时与整轮墙钟耗时分别统计；显式指定其他 reporter 时仅输出该诊断报告。流程测试复用准备好的基线字节，各用例拥有独立工作文件和完整 Git 元数据；用例结束先等异步任务完成，文件结束再集中清理本文件创建的目录，清理前校验临时目录边界并核实清理结果。Windows 链接权限探测前置，junction 验证保持独立。

共用战斗等待入口为 `tests/helpers/battle-fixtures.js` 的 `drainBattle`：跨调度间隙复核空闲，等待耗尽后明确报错。需要用例操作面板时，通过 `stopAt` 指明 `discovering`、`choosing` 或 `handSelecting`，在指定状态读取快照。规则拒绝测试先确认输入是否合法，再断言具体拒绝原因；格式错误、尚未支持与时点未登记分别验证。

## 卡牌图鉴生成

`npm test` 中的 `tests/compendium.test.js` 在内存生成并比较。有意更新 `docs/game-compendium.md` 时运行 `npm run docs:compendium`（由 `npm_lifecycleEvent` 允许落盘），更新后检查文档差异并随对应卡牌数据变更一并审阅。

## 卡牌效果审计

`tests/card-audit.test.js` 按稳定卡 id 和完整未识别句式去重：新增未识别项失败，已识别的旧例外也失败（提醒删除过期记录）。已知项集中在 `tests/fixtures/card-effect-audit-known.json`，每条记录具体未识别句式或缺少的真实战斗上下文，例外精确到句式。`allowMissingCardIds` 现行清单为空，正式卡库按完整清单审计。

## 内置浏览器验收

- Codex 与 ZCode 的验收环境限定为当前平台内置浏览器与 Vite dev server；默认验当前窗口，多尺寸由老板明确指定。外部 Edge/CDP/headless 与 `python http.server` 均排除在验收入口外。共享工作区有其他未提交任务时，保持其 build/HMR 现场，采用隔离验收路径。
- 平台工具入口以当次说明为准（Codex 当前为 `mcp__cua_repl` 的 `cua` API；ZCode 用当次内置浏览器工具与已授权桥接入口）。内置浏览器不可用、缺少来源页或服务启动条件不足时，记录平台、地址、时间、错误和待验场景，实页状态记未核验，继续独立工作。
- 战斗验收走真实开局流程；`devForceBattle` 在没有随身卡牌的新局会拒绝启动；标题页 `#titleDev` 面板只用于构造节点入口测试。交互优先走真实输入；工具明确支持页面求值时可构造功能场景，合成事件需标注。截图发黑先检查转场；重载前确认不会打断别人的验收。
- 证据按范围记录：截图对应外观，计算样式 A/B 对应所选属性差异，合成交互对应构造事件路径，真实输入/hover 对应真实输入路径，刷新/读档对应该存档场景。检查页面 `error`、真实状态和完整交互路径，同步保存原始错误；战斗日志位于 `#log`。
- 浏览器证据统一入口 `npm run workflow -- browser import/compare`（`scripts/workflow-browser.mjs`）；`scripts/iab-drive.mjs` 是 ZCode 的驱动桥接入口，Codex 使用当次内置浏览器接口。窗口/origin/身份不一致记 inconclusive；证据同时注明真实输入或构造事件的范围。
- 玩家可见变化的 B 档实页验收可用固定剧本（`SDT.Agent.scenes`，见[接口协议](agent-protocol.md#九验收剧本sdtagentscenes)）：剧本断言 JSON 与当次内置浏览器关键页截图分别说明逻辑和视觉结果，由执行会话判断是否覆盖目标。报告落 `docs/evidence/<日期>-<任务>/`；共享树 HMR 导致长场景受阻时，可先做 jsdom 定向测试，把待补实页范围记入任务未核项；需老板处置时再登记 PENDING。

## CI 状态

每次交付列实际验证范围、结果与待验项；纯工程文档/内部工具定向任务汇报相关检查。阶段/集成交付或引用全量结论时，核对来源版本/输入指纹、报告和覆盖增量；远端 CI 附对应提交的 Actions 链接与状态，旧引用标待刷新。快速门、全量、构建与实页分别记结果，skip 记未执行；定向任务按自身标准完成，并列明相关补验条件。

`ci.yml` 的 `Full test suite` 使用原入口 `node scripts/acceptance-gate.mjs --full --run`：剧情编译、语法/数据检查、全部原类型检查及覆盖审计、原 ESLint、真实项目全局资产审计与完整 Vitest。它保留 `npm test` 原 pretest 的编译和数据检查；原门禁的 `--silent` 仅调整日志。显式 FULL 独立于暂存差异执行完整选集；提交的混树/归属守卫、冻结 receipt 另行核验，空暂存差异上的强制 hook 按实际选集报告。Node 22、30 分钟 job 超时与原测试预算不变。`vite-quality.yml` 保留原 Vite 构建、prebuild 编译验数据、postbuild 预算以及构建来源与私有产物留存。

`Dependency audit diagnostics` 是独立诊断 job，依赖安装状态、版本与 lock 保持原样：先运行无网络解析器 fixture，再执行 `npm audit --package-lock-only --ignore-scripts --json --registry=https://registry.npmjs.org/ --audit-level=info`。退出 0/1 且成功 JSON 结构、逐严重级别计数、详细条目与退出状态相符时记“诊断收集成功”；漏洞以 warning 和摘要列出，安全验收另行处理。网络/进程错误、error 字段、无效 JSON、异常退出或计数不符记失败，独立 FULL job 继续执行。产物限定为成功的公开依赖审计 JSON，保存为仓库私有 artifact、保留 3 天，位置独立于源码。远端执行与结果以对应提交或 PR 记录为准；历史验收见 [快速门执行记录](archive/records-2026-09-28/ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md) 与归档证据。

2026-10-22 候选增量的时点结果见[历史验证记录](evidence/2026-10-24-WF-context-reading/candidate-validation-2026-10-22.md)；当前工作树按对应版本核验。
