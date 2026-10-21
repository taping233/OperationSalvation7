# 框架严格类型与自动架构边界

状态：本片完成；源码、配置、脚本、测试已冻结，供主会话做集成全量和实页验收。未提交、推送、构建或安装。既有未提交现场保留。

## 严格类型覆盖

新增 `jsconfig.framework-boundaries.json`，启用 `strict:true`、`checkJs:true`。检查实现体：

- `game/src/run/shop-commands.js`：买卖、报价身份、保存回执、委托优惠草稿。
- `game/src/run/event-commands.js`：扣款、资源和生命、收卡、选择凭据、重铸与事件结算。
- 传递依赖 `core/run-checkpoint.js`、`run/event-recode-candidates.js`：保存端口、候选池和来源快照。
- `cards/card-execution-plan.js` 及其 `card-trigger-contract.js`：触发/装备执行权、注册快照、即时文本抑制和预检视图。

类型复用现行 `game.store.types.d.ts`、`run-domain-commands.types.d.ts` 和 `card-rules.capability.types.d.ts`。新增 `card-execution-plan.types.d.ts` 明确触发点、装备点、数值字段、操作名及计划结果。没有引入 `any`、`@ts-nocheck` 或用万能接口代替端口建模。

两个预检视图刻意保留未验证输入：`cardRulePreflightView(unknown)` 和 `createCardRuleExecutionView(object, readonly unknown[])` 位于 schema/capability 校验之前，必须把非法声明交给原验证器处理。内部用返回 `unknown` 的字段读取完成严格检查；接受任意预检输入不表示声明合法。其余执行计划接口使用明确类型，错误触发点、操作名、装备技能形状和数值字段均有编译反例。

`tests/framework-boundaries-types.fixture.ts` 从真实 JS 导出构造正例和 16 个 `@ts-expect-error` 反例，覆盖数值/身份/回执判别、委托、事件选择及规则执行计划。TypeScript 会同时拒绝失效的反例注释。

## 仅接口覆盖的战斗范围

新增 `jsconfig.framework-ports.json`，`strict:true`、`checkJs:false`，只检查 `framework-battle-ports-types.fixture.ts` 从真实 `createBattleCardPlay` 返回值取出的 `submitCardPlay`、`getCardPlayAvailability`，以及既有命令/回执类型。正例验证 ready/rejected、needs-input、queued 和完成承诺的判别；7 个反例验证非法 UID、目标、forceDirect、缺失序号、完成承诺和取消原因，以及未判别前访问 receipt。

这不是 battle 工厂实现体整体 strict，也没有检查其全部依赖注入参数。`battle.turn-continuation.js`、`battle.turn-start.js`、`battle.damage.js` 本片只做架构边界保护，业务行为回归由引擎片提供。没有为凑绿灯将领域命令或纯计划的 `checkJs` 降级。

两个新配置均已加入 `scripts/check-types.mjs`；原有配置保持。

## 自动架构保护

`scripts/architecture-graph.mjs` 对新文件名默认匹配 `*.commands.js`、`*-commands.js` 和 `*execution-plan.js`，无需手工登记后才生效。命令禁止直接依赖 SDT 门面、会话内核/浏览器、全局战斗运行态、store 和页面；纯执行计划禁止直接依赖 battle/run/hub/ui 或 SDT 门面。均禁止捕获 `window`、`document`、`globalThis`、`SDT`。

四个战斗工厂 `battle.card-play`、`battle.turn-continuation`、`battle.turn-start`、`battle.damage`，以及 `game.run.events`、`game.run.resources` 显式纳入端口工厂保护。允许注入状态/渲染端口和纯规则模块；既有 `battle.state.js` 的纯状态转换函数依赖合法。新增 factory 清单和例外表继续接受 `deadGuardKeys` 实际源码命中检查。

已知旧债按文件及既有能力精确保留：`hub/base.commands.js` 的 window/base；`collection.commands.js` 的 window/globalThis；`extraction.commands.js` 的 globalThis；`recovery.commands.js` 的 window/globalThis/base/storage。它们没有得到通用豁免：例如 collection 新增 document 仍会失败，新文件不会继承例外。

两个 run 工厂只允许现行五项适配依赖：events 的 `game.run.data.js`、`event-signal-puzzle.js`、`event-recode-result.js`；resources 的 `reward-card-feedback.js`、`reward-scene-view.js`。这些显示适配器本身没有因本次工厂保护而成为纯模块。DOM 由 flow 注入 `dom`，由状态片完成。

`architecture-boundaries.test.js` 用虚拟、未登记的新命令和新纯计划证明自动匹配；另有四个 battle 工厂、两个 run 工厂的违规反例及合法显式端口正例。原循环、动态 import、懒加载和旧名单守卫保留。

边界限制：检查的是源码图直接依赖与受保护模块中的标识符访问；没有宣称所有传递依赖整体纯化或全工程 strict。

## 本片验证

- `npm run typecheck`：全部 10 个配置通过，含新增实现体/接口两配置。首次沙箱子进程 `spawn EPERM`，同命令经自动审核放行后成功。
- `npx vitest run tests/architecture-boundaries.test.js tests/contracts.test.js tests/card-execution-plan.test.js --reporter=dot`：最终 3 套、64 项通过。首次沙箱 esbuild 子进程 `spawn EPERM`，同命令经自动审核放行后成功。
- 7 个本片源码/脚本/测试目标 ESLint 通过：架构脚本、类型编排脚本、纯执行计划、触发契约、保存检查点、重铸候选和架构测试。
- 全量 Vitest 和真实内置窗口验收由主会话统一执行，本片未操作浏览器或服务。

## 集成反馈增量修正

主会话全量发现 `workflow-cli-integration.test.js` 仍把类型配置数写死为 8。已将守卫改为用 Acorn 读取真实 `scripts/check-types.mjs` 的 `configs` 字面量，逐项验证字符串配置及唯一性，并与证据指纹中的配置完整集合比较；同时明确断言本轮两份新配置和原 hand-selection/ui 配置仍在真实编排内。新增配置会自动进入预期集合，编排改为无法解析的结构则直接失败，未缩减证据检查范围。

增量验证 `workflow-cli-integration.test.js` 1 套 13 项通过，目标 ESLint 通过。类型实现及运行时源码均未修改，复用前述 10 配置通过证据；未重复 typecheck。主会话另行处理 acceptance-gate 的独立失败，本片未修改其测试。
