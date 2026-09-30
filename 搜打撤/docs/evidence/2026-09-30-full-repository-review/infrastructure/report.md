# 底座、Agent、音频与工程工具审查

冻结主线 HEAD：fd38468ea6025fa616ba8bfa0a0cdd466ee7617a（master）。审查对象为本轮snapshot，不把完成但未提交的workflow代码或未认领package-lock修改冒充已入HEAD。106个分配目标全部有逐文件记录：deep 7 / systematic 90 / static-only 9 / not-reviewed 0。

深度口径：deep=完整源码阅读、具体调用链和独占行为夹具；systematic=完整文本或生成锁结构阅读并核对风险边界，未称全路径动态验收；static-only=完整静态阅读，但旧外部浏览器/Electron/迁移工具未执行。没有把搜索命中或绿测试称为逐行深审。

7项确认发现（2项P1、5项P2；其中1项P1属于旧外部CDP工具）。

## INFRA-01 · P1 · 图标水合重新把转义文本解析为HTML

位置：`game/src/core/icons-bitmap.js:63`。

触发：自定义卡牌名称/备注含HTML字符并包含可匹配的emoji或[[icon:]]；初次渲染已esc转义。

预期：用户文本仍为文本，只把图标标记转换为受控img。

实际：hydrate读取textNode.nodeValue后直接赋span.innerHTML；夹具的已转义<img ...> 🎒变成真实img，并保留onerror。

影响：破坏原有文本边界，名称/备注可以改变DOM与布局、插入事件属性；应先转义文本或只以DOM节点替换图标。

调用链：cards.view.js:134 esc(c.name) → icons-bitmap.js:78-100 MutationObserver → icons-bitmap.js:63 hydrate。

证据：`repro-results.json` 的 `hydrate`；已确认HTML重解释；jsdom以合成error事件确认事件属性可执行。未在真实浏览器复现自动error执行，也未读取任何真实存储。

## INFRA-02 · P2 · 快捷键页签成功跳转后关闭刚打开的页面

位置：`game/src/agent/agent.console.js:111`。

触发：开发者控制台→快捷键页签→合法页面的进入按钮（如设置、基地）。

预期：目标页面保持打开并保留新页面动作。

实际：jump同步page.enter开新页后bindKeysTab调用UI.hideOverlay，立即清掉新页_acts，210ms后隐藏并清空新页。

影响：控制台的点击直达入口失效；开页前关闭旧层或让目标入口接管。

调用链：agent.console.js:bindKeysTab → ui/quick-nav.js:jump → page.enter → ui/overlay.js:hideOverlay。

证据：`repro-results.json` 的 `quickNav`；使用实际jump/bindKeysTab/hideOverlay；目标openSettings入口以标准DOM页夹具替代，不是浏览器验收。

## INFRA-03 · P2 · autoRun把新driver当成旧driver进行还原

位置：`game/src/agent/agent.runner.js:368`。

触发：driver原为human，运行greedy/auto一局后，继续人工游戏。

预期：finally恢复调用前的human。

实际：setDriver(driver)返回刚写入的driver；previousDriver成为greedy，finally setDriver(previousDriver)仍greedy。

影响：后续人工终局记录被标为AI驱动，按驱动统计失真；应先读取getDriver再设置。

调用链：agent.recorder.js:26 setDriver返回当前值 → agent.runner.js:368 → agent.runner.js:522 finally。

证据：`repro-results.json` 的 `driverRestore`；实际recorder+autoRun在独占fixture运行；不读取真实跑局记录。

## INFRA-04 · P2 · 配置完整的llm批跑仍选择greedy工厂

位置：`game/tools/agent-batch.mjs:301`。

触发：提供合法LLM配置后使用--policy llm。

预期：选择Agent.llm.decide()作为决策工厂，模型调用实际发生。

实际：Agent.policies没有llm；policyFactory=Agent.policies[POLICY]||Agent.policies.greedy，因此走greedy，但记录policy/driver为llm。

影响：批跑产生误标的LLM实验数据；配置fail-fast只挡未配置，不能保证LLM真的参与。

调用链：agent.js:policies和llm独立门面 → agent-batch.mjs:LLM配置检查 → agent-batch.mjs:301 policyFactory → runOne.decide。

证据：`repro-results.json` 的 `llmFactory`；真源工厂选择语句在桩门面执行，greedyCalls=1/llmCalls=0；未使用API密钥或发请求。

## INFRA-05 · P2 · 单局超时后未停止和等待旧autoRun收口

位置：`game/tools/agent-batch.mjs:429`。

触发：某局autoRun决策/命令仍挂起时RUN_TIMEOUT_MS先到。

预期：请求取消并等待旧驱动安全结束，再清局与开启下一局。

实际：Promise.race只拒绝runOne外层；catch后直接cleanup，下局立即再autoRun；真runner仍持有runAbort，返回already-running。

影响：超时会污染后续局的执行与统计；旧任务也可能在清局后继续操作新现场。

调用链：agent-batch.mjs:runOne Promise.race → runOne catch→cleanup → 主循环下一runOne → agent.runner.js:autoRun重入守卫。

证据：`repro-results.json` 的 `batchTimeout`；实际autoRun慢决策夹具：第一局timeout、第二局already-running、stopCalls=0。未跑完整游戏批次。

## INFRA-06 · P1 · 旧外部CDP工具按端口终止未确认归属的进程

位置：`scripts/perf-ledger-capture.mjs:103`。

触发：旧脚本startEdge时CDP_PORT（默认5331）被其他会话或无主进程监听。

预期：报告占用并停止，或只终止本次创建且身份确认的进程。

实际：netstat挑出监听PID后直接taskkill /T /F，没有核对可执行文件、独占档案、创建时间或本会话PID。

影响：手动运行旧工具可能强制杀死其他服务及整棵进程树。此工具已非当前内置浏览器授权路线，不能用于本轮验收。

调用链：startEdge → killStaleAutomationEdge → netstat按CDP_PORT筛PID → taskkill /T /F。

证据：`repro-results.json` 的 `portCleanup`；纯execFileSync桩返回无关监听PID并记录所选taskkill命令；绝未枚举、启动或终止真实进程。旧外部Edge/CDP工具，不是现行路线。

## INFRA-07 · P2 · 自动镜头运动期间用up时刻相机解释down坐标

位置：`game/src/game.boot.js:88`。

触发：到达节点后的460ms取景glide尚在运行、地图已idle时，按住下一节点后原地松开。

预期：保存pointerdown命中节点/世界坐标，按该点击意图移动。

实际：downPos仅存client坐标；pointerup使用当时cam.screenToWorld。真Camera+bindInput夹具零指针位移下，从down指向节点1变成移动节点2。

影响：快速点击或按住时可能错走另一路线；8px拖拽阈值无效，因为是相机在移动。

调用链：game.run.flow.js:66 frameExploration({glide:true}) → resolveCell返回idle → game.boot.js:54保存屏幕坐标 → game.boot.js:88 pointerup逆变换。

证据：`repro-results.json` 的 `cameraClick`；真实Camera.glideTo、bindInput与pickNode在独占jsdom夹具运行，合法节点选择结果已记录；未浏览器实测。

## 验证和限制

复用了已成功执行的7项最小复现，不在收官再跑。命令：`node docs/evidence/2026-09-30-full-repository-review/infrastructure/repro.mjs`。证据为`repro-results.json`。VM读取快照原源码（仅剥ESM import/export以注入端口），DOM为独占jsdom，系统命令为纯桩。

图标问题确认了转义文本被重新解释为HTML；事件属性执行仅在jsdom合成error事件下确认，真实浏览器自动执行未验。不得据此冒充完整浏览器安全验收。

perf-ledger-capture.mjs、perf-benchmark.cjs、electron-title-smoke.mjs均是旧外部Edge/CDP/Electron工具，不是现行授权路线。其静态缺陷可以记录，但本轮不使用这些工具开展游戏验收。

未读/改用户真实LLM配置、Git index、玩家存档；未安装、启服、build、浏览器操作或终止实际进程；被审源码/测试/共享文档均未修改。原始位图/声音、全卡牌策略语义和实际GPU/音频设备行为没有动态验收。

逐文件覆盖见`coverage.json`，机读发现及3项静态疑点见`findings.json`。静态疑点未计入确认问题数。
