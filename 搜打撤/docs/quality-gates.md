# Vite 质量门

本地检查与 CI 的现行口径。`.github/workflows/ci.yml` 在 master 的 PR/push 上跑静态检查与全量测试；`vite-quality.yml` 在 Vite 路径变更时跑生产构建及预算检查；两条工作流均用 Node 22 与锁定依赖。

## 本地检查

在 `搜打撤` 目录执行；日常按改动选相关测试，`test:target` 必须显式指定测试文件。普通提交门与冻结 index 门使用同一选择器，实际理由以 `npm run check:staged:plan` 输出为准：

```sh
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

quick / full 执行剧情编译、语法、数据、类型、lint、增量资产检查与所选 Vitest；eslint、jsconfig/tsconfig、Vitest 配置与提交钩子变更强制 full，类型配置见 [check-types 的 configs 清单](../scripts/check-types.mjs)。快速门是局部反馈，不表示整项目通过；全量以 CI（master push/PR）为准，本地 `npm test` 全量只在阶段收尾、集成风险需要且 CI 尚未覆盖时按需运行，"落库"不自动触发本地全量，出现红灯按新问题处置。`FORCE_FULL_TESTS=1` 在同一暂存验收链中强制 full；`SKIP_FULL_TESTS` 是明确绕过，绕过后的提交不得记为本地验证通过。任何逃生变量都是明确绕过，不是提速或验证通过；失败按输出补验。

### 验收分级

| 改动 | 必要验收 |
| --- | --- |
| 纯工程说明/流程文档 | 自有 diff、事实/指针核对、相关文档守卫；不跑游戏全量或 build；玩家可见文案/图片变化仍需对应实页/图片检查 |
| A 档删除 | 删除先获批；静态三证据 + 定向验证，免实页 A/B、免全量 Vitest；三证据不全或分类不确定一律 B 档 |
| 内部流程脚本/工具契约 | 对应定向契约测试；不要求游戏实页或 build；行为涉及游戏或浏览器证据时另验对应场景 |
| B 档游戏语义 CSS/逻辑/共享架构 | 定向验证 + 当前窗口内置浏览器实页；公共游戏边界按风险补集成验证 |

A 档三证据：①与幸存正本逐字相同或全库零引用（搜索含 html/md）；②级联/调用关系可静态证明；③加载序靠后的文件没有同名活规则。证据照常落档；删除获批不代表自动提交获批。本矩阵描述人工验收，不改 `acceptance-gate.mjs` 的选择算法或提交钩子；钩子按实际暂存路径运行，冲突先说明，不自行绕过。

工具说明：`check:syntax` 用项目 Acorn 查 `game/src`、`game/tools`、`scripts` 的语法；`npm test` 的 pretest 先编译剧情并校验数据；`npm run build` 保留 prebuild/postbuild 检查；`npm run check:quality` 在可构建的干净工作区按序执行完整质量门（混树时不运行含 build 的组合入口）。混合工作树用 `npm run check:staged:isolate -- --plan` 核对后显式运行隔离验收：冻结实际 index、按对象导出原始字节并复制经锁核对的依赖；依赖不符、index 变化、检查改写快照、失败/中断都拒绝通过；冻结报告的 gateReceipt 精确匹配 index、选定检查、输入和依赖/环境后可复用，工作树 verify 报告只是候选。Git hooksPath 在同一仓库的工作树间共享，隔离工作树检查新钩子直接显式运行该钩子模拟。

## 卡牌图鉴生成

`npm test` 中的 `tests/compendium.test.js` 只在内存生成并比较，不写回文档。有意更新 `docs/game-compendium.md` 时运行 `npm run docs:compendium`（由 `npm_lifecycleEvent` 允许落盘），更新后检查文档差异并随对应卡牌数据变更一并审阅。

## 卡牌效果审计

`tests/card-audit.test.js` 按稳定卡 id 和完整未识别句式去重：新增未识别项失败，已识别的旧例外也失败（提醒删除过期记录）。已知项集中在 `tests/fixtures/card-effect-audit-known.json`，每条须说明逐句解析尚未识别或审计缺少真实战斗上下文的原因；不能只放行整个卡 id。`allowMissingCardIds` 仅列独立工程提交尚不包含的五张 TT12 卡，正式合入后删除。

## 内置浏览器验收

- Codex 与 ZCode 都只能使用当前平台内置浏览器访问 Vite dev server；默认只验当前窗口，多尺寸须老板明确要求。不要用外部 Edge/CDP/headless 或 `python http.server` 替代。共享工作区有其他未提交任务时，不运行会污染 build/HMR 的流程。
- 平台工具入口按当次说明核实（Codex 当前为 `mcp__cua_repl` 的 `cua` API；ZCode 用当次内置浏览器工具与已授权桥接入口），历史经验不代表当前能力。内置浏览器不可用、没有来源页或服务不可安全启动时，记录平台、地址、时间、错误和未核验场景；继续独立工作，不换外部浏览器，不宣称实页通过。
- 战斗验收走真实开局流程；`devForceBattle` 在没有随身卡牌的新局会拒绝启动；标题页 `#titleDev` 面板只用于构造节点入口测试。交互优先走真实输入；工具明确支持页面求值时可构造功能场景，合成事件需标注。截图发黑先检查转场；重载前确认不会打断别人的验收。
- 截图证明外观，计算样式 A/B 证明所选属性差异，合成交互证明所构造事件路径，真实输入/hover 证明真实输入路径，刷新/读档证明该存档场景；分别列范围，不互相替代，不得为了截图掩盖真实错误。检查页面 `error`、真实状态和完整交互路径；战斗日志位于 `#log`。
- 浏览器证据统一入口 `npm run workflow -- browser import/compare`（`scripts/workflow-browser.mjs`）；`scripts/iab-drive.mjs` 是 ZCode 的驱动桥接入口，Codex 使用当次内置浏览器接口。窗口/origin/身份不一致记 inconclusive；证据同时注明真实输入或构造事件的范围。
- 玩家可见变化的 B 档实页验收可用固定剧本（`SDT.Agent.scenes`，见[接口协议](agent-protocol.md#九验收剧本sdtagentscenes)）：剧本断言 JSON 与当次内置浏览器关键页截图分别说明逻辑和视觉结果，由执行会话判断是否覆盖目标。报告落 `docs/evidence/<日期>-<任务>/`；共享树 HMR 导致长场景受阻时，可先做 jsdom 定向测试，把待补实页范围记入任务未核项；需老板处置时再登记 PENDING。

## CI 状态

每次交付列本轮实际验证范围、结果与未核项；纯工程文档/内部工具定向任务不额外盘点无关的游戏全量或远端 CI。阶段/集成交付或引用全量通过结论时，核对对应来源版本/输入指纹、报告和覆盖增量；远端 CI 须有对应提交的 Actions 链接与状态，引用未刷新标未核实。快速门、全量、构建与实页分别记结果，skip 不算通过；没有全量覆盖仍可完成定向任务，明确相关补验条件。

`ci.yml` 先跑语法、类型、lint，再经 `npm test` 的 pretest 编译剧情、验证数据并执行全量 Vitest；`vite-quality.yml` 只运行 Vite 构建（prebuild 编译验数据、postbuild 查预算）。文档只描述配置，远端是否实际运行及结果以对应提交或 PR 的记录为准。历史验收实证见 [快速门执行记录](archive/records-2026-09-28/ACCEPTANCE-FAST-GATE-RESULT-2026-09-28.md) 与归档证据，不在本页复述。
