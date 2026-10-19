# 工程测试质量复核（限定范围）

<!-- cleanup-status-20261019 -->
> 2026-10-19清理后提示：本报告及本目录附件记录当时状态，其中提及的旧资源、旧音频实现或旧交付路径可能已按批准清单删除。“保留原文件/保留旧包”不代表今天仍可访问。当前保留包、替代入口与执行回执见[清理后状态](../../../CLEANUP-STATUS.md)；下文历史验收结论与原始内容保持。


冻结HEAD fd38468。选择 32 个工程测试：全文定向深审 11 个，仅机械AST索引 21 个。未列出的测试未审，battle/card/effect/m-batch测试交其他分片。没有重跑测试，也没有改原coverage/findings或被审代码。

## 实际全文读过

- `tests/acceptance-gate.test.js`：实际planForPaths/parseStagedStatus、两条无参数失败CLI。覆盖定向/全量升级/样式skip。将compare CLI映射到纯provenance测试而非实际compare逻辑；未覆盖所有配置变化分类或真实staged完整质量门。
- `tests/agent-command-results.test.js`：实际act/step/autoRun与真实菜单注册，session、持久化/加载/渲染端口为桩。异步受理/完成、拒绝、context凭据、迟到失败、commandTimeout覆盖有价值；存档保留断言仅文案，已在注释承认；不覆盖batch外层墙钟。
- `tests/agent-compare-provenance.test.js`：实际inspectComparisonProvenance纯函数，summary/runs人为对象；覆盖代码/环境/配置/重复seed/legacy门。未运行agent-compare CLI、score/符号检验/晋级判决及ledger真实入口。
- `tests/agent-llm-abort.test.js`：实际decide，fetch与localStorage为桩，Node同realm；取消前/中途/墙钟超时覆盖。fetch桩主动遵守AbortSignal；不证明忽略signal端点的挂起，也不证明batch策略接线。
- `tests/agent-llm.test.js`：实际llm.decide和127.0.0.1随机端口HTTP服务；独占Map配置。回复解析/重试/5xx覆盖，不经过batch策略工厂，漏INFRA04。未清理SDT_AGENT_BASE_URL/API_KEY/MODEL环境覆盖；局外真实环境可能改写fixture路由。
- `tests/agent-recorder.test.js`：实际recordRun/聚合/CSV；卡牌价值与游戏为桩。测试在beforeEach setDriver(human)，标签用例也手动还原human；没有autoRun前后getDriver断言，漏INFRA03。
- `tests/agent-run-provenance.test.js`：实际指纹/附加provenance；Git/文件读取注入桩，Z:/missing-project验证未知lock。覆盖指纹变化和Git不可用，不证明真实Git pathspec范围完整或批跑产物真实策略。
- `tests/agent-runner-abort.test.js`：实际runner/state；session/flow为桩。覆盖signal取消、局间控制器重建、runTimeoutMs及already-running；未调用agent-batch外层race/cleanup，漏INFRA05。停止用例不证明所有下游命令无副作用。
- `tests/workflow-cli-integration.test.js`：实际CLI help/docs/staged --plan及项目fingerprint；staged只读当前index。坏链接断言使用不存在的broken-link kind，生产实际为missing-relative-link；可造绿。npm脚本字符串断言不证明apply/verify/staged执行联通。
- `tests/workflow-scope.test.js`：实际fingerprint/freshness和独占目录字节变化；覆盖state/docs/code/env/失败/过程中变化/旧schema。不运行runCheck，只人工制造exitCode/环境报告，因此不证明实际命令产出、日志hash或真实已安装依赖字节。
- `tests/workflow-staged.test.js`：实际runStaged/stagedPlan、独占mkdtemp Git仓库和fixture gate；测试隔离index字节、忽略工作树、依赖守卫、symlink/gitlink、信号、快照变异、index变化、skip。fake acceptance gate故意替代生产质量门，passed仅证明隔离机制，不能称完整Vite门通过。清理由独占前缀/路径检查约束，等待activeCases防超时后过早删除；不运行真实主仓index变更。

## 仅机械索引，断言语义未审

- `tests/architecture-boundaries.test.js`
- `tests/boot.test.js`
- `tests/camera-interaction.test.js`
- `tests/contracts.test.js`
- `tests/cov-motion-primitives.test.js`
- `tests/diagnostics.local.test.js`
- `tests/docs-consistency.test.js`
- `tests/hub-architecture.test.js`
- `tests/perf-probe-summary.test.js`
- `tests/random.test.js`
- `tests/render-scheduler.test.js`
- `tests/run-architecture.test.js`
- `tests/sound-policy.test.js`
- `tests/soundscape.test.js`
- `tests/ui-scale.test.js`
- `tests/workflow-browser.test.js`
- `tests/workflow-handoff.test.js`
- `tests/workflow-index.test.js`
- `tests/workflow-memory.test.js`
- `tests/workflow-task.test.js`
- `tests/workflow-tools.test.js`

## 可行动测试缺口

### TEST-INFRA-01 · 坏链接断言检查不存在的诊断kind

位置：`tests/workflow-cli-integration.test.js:24`。

该断言筛kind===broken-link；生产scripts/index-validation.mjs输出missing-relative-link，因而即使坏链接存在也不会命中。

建议：断言生产诊断的实际kind，并在独占文档fixture中注入缺失链接证明红灯。

### TEST-INFRA-02 · 真实HTTP测试未隔离环境变量配置优先级

位置：`tests/agent-llm.test.js:64`。

saveConfig写入本地fixture端点；实际loadConfig优先SDT_AGENT_BASE_URL/API_KEY/MODEL。用例没有stubEnv/删除并还原这些变量；不能保证带配置环境仍只访问127.0.0.1。

建议：在用例setup显式隔离三项SDT_AGENT_*变量并在teardown恢复；捕获目标路由，断言只使用本地fixture。

### TEST-GAP-INFRA03 · 人工setDriver复位遮住autoRun标签恢复缺陷

位置：`tests/agent-recorder.test.js:15`。

beforeEach及驱动标签用例都手动复位human；没有同时调用真实autoRun/getDriver并检查finally后的前值。

建议：保持真实recorder，分别在decide-null/cancelled/exception结束后核对原driver及后续人工recordRun标签。

### TEST-GAP-INFRA04 · 适配器端到端不覆盖批跑入口选择LLM

位置：`tests/agent-llm.test.js:76`。

所有网络用例直接decide()(obs)；batch没有被导入或调用，configured llm实际走greedy的路由仍可全绿。

建议：对实际batch策略选择接缝测configured llm、缺配置拒绝、greedy三个分支，并断言LLM工厂/请求实际被调用。

### TEST-GAP-INFRA05 · runner墙钟与command超时不覆盖batch外层race取消/收口

位置：`tests/agent-runner-abort.test.js:59`。

这里验证runner.runTimeoutMs与already-running；agent-command-results验证commandTimeoutMs。两者都没有调用batch的runOne→外层Promise.race→cleanup→下一局。

建议：延迟真实autoRun决策跨过batch墙钟，检查stopRun/等待收口发生在cleanup之前，且下一局能启动、迟到动作不能写新局。

### TEST-GAP-COMPARE · compare主CLI定向门只选provenance纯函数测试

位置：`tests/acceptance-gate.test.js:38`。

expect(compare.tests)固定为agent-compare-provenance.test.js；该文件只import inspectComparisonProvenance，不执行compare的score/binomTail/minDetect或晋级判决。

建议：补无外部数据的compare CLI fixture，覆盖胜/负/平、边界p值/硬约束、legacy/verified判决，再将该实际契约纳入映射。

## 证据边界

workflow-staged使用真实隔离导出器和独占Git仓库，但gate是专用桩，所以passed只证明隔离机制，不能代表生产Vite质量门通过。workflow-scope测试真实fingerprint/freshness，但人工构造命令exitCode与环境报告，不证明runCheck实际链路。CLI帮助与npm字符串检查不替代apply/verify/staged真实执行验收。

新增workflow测试未入HEAD；不能把本轮工作树覆盖当已提交主线测试。原7项源码确认与复现保持不变；本文件只增加测试质量信息。

机器索引、import/mock/危险操作位置及每文件深度在`test-review.json`。AST计数为语法数量（含it.each工厂），不是实际用例或执行次数。
