# 可见转场条件等待 R2.3

## 结果

`scripts/visible-playback.mjs` 导出版本 `20261016-r2.3`。旅行和已点击按钮的关闭动效可在同一批次完成短、有界的条件等待，减少父任务再次取快照的轮次。只改该脚本、对应专测和本证据目录，没有修改游戏、门禁、存档或浏览器现场。

本任务未启动、连接或操作浏览器。测试均为纯规划器和假 tab 契约测试，不能代替真实浏览器复验，也不代表完整游戏流程通过。

## 当前使用

调用方继续传入已授权的当前内置 tab。若 REPL 曾加载同名版本，请用新的变量名及查询后缀，避免模块缓存：

```js
const VP23final = await import('file:///workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d/搜打撤/scripts/visible-playback.mjs?v=20261016-r2.3-final');
const report = await VP23final.runVisibleSteps(gameTab, { maxSteps: 4 });
```

原有动作白名单、实时唯一/可用/可见检查、真实 locator 点击、错误和选择保护继续有效。等待不跳过卡牌选择、战斗决策、未知界面或可见错误，也不会因超时再次点击。

## 等待契约

- 旅行须同时看到以「前往中 · n/m 段」开头的 text/generic/status 行、唯一 disabled「进入该地点」和唯一「关闭地点预览」，且没有 dialog。单纯 disabled、帮助文字提到旅行、数字标题或未知 dialog 均不触发旅行等待
- 旅行等待目标是这个精确按钮与 `:disabled` 的 locator 交集，等待 `hidden`。按钮被移除/改名或恢复可用时交集即消失，随后重新读取 DOM；不会点击「查看本地内容」或再次点击「进入该地点」来推进旅行
- 成功点击后，新 DOM 若仍被规划为同一状态的同一个精确按钮，先对已点击按钮等待一次 hidden。无关控件改变快照指纹也适用，避免关闭动效产生第二次旧按钮尝试
- 实时按钮数量为 0 时仍先取新 DOM。只有新分类是已知旅行/开箱 wait 才继续等待；新动作、选择或未知页面仍以 `live-button-disappeared` 返回，不重试消失按钮
- 已知开箱标题等待沿用。所有条件等待，包括点击后按钮关闭等待，共享从第一次等待起的 10 秒 wall-clock 预算及最多 8 次条件等待上限。每次 timeout 为 `min(timeoutMs, 剩余预算)`；默认单次至多 5000ms，大于 10000ms 的 timeout 也不能扩大总等待预算
- 等待到期、失败、快照未改变或预算/次数耗尽均交还控制。`maxSteps` 仍为 1–8，等待不会增加可点击预算

`waits` 现在也记录点击后的关闭等待；每项包含目标、前后摘要、该次 timeout 和结果。步骤保留点击结果，成功条件等待才标记 `waitedForButtonHidden: true`，错误同时保留到 `waitError`。

## 公开 API 与可见结构来源

父任务提供了本轮已返回的 `gameTab.playwright` 文档：`getByRole`、`locator(selector)`、locator `and` 及 `waitFor({state, timeoutMs})`。因此没有推测或反射浏览器对象，也未调用浏览器来读取文档。

旅行结构由父任务本轮真实观察说明，并对照只读源码 `game/src/run/expedition.view.js` 的 `status`、预览关闭按钮和入口按钮渲染核实。专测中的 travel 字符串为这些可见特征的最小重建，不是原始浏览器导出。旧奖励关闭形状沿用 [R2 证据](../2026-10-16-WF-visible-playback/README.md) 中已注明来源的重建 fixture。

实现没有页面求值、隐藏 state/window/游戏 API、存储或网络访问，没有固定 sleep、合成输入或外部浏览器客户端。

## 验证

- 三组定向：`tests/visible-playback.test.js`、`tests/scripts-contract.test.js`、`tests/acceptance-gate.test.js`，175/175 通过，见 `targeted-tests.log`
- 最终错误证据字段微调后，重跑本工具专测，78/78 通过，见 `final-focused-tests.log`、`final-focused-tests.json`
- 两个源码/测试文件 ESLint 和 `node --check` 通过，见 `lint.log`、`checks.json`
- 覆盖旅行交集选择器、旅行后未知/选卡/战斗立即停止、消失按钮仅经已知 wait 恢复、关闭动效指纹变化、点击预算、共享 10 秒预算、单次预算夹取、最多 8 次等待、不重复点击及原有保护
- 没有运行游戏构建或全量测试。关闭动效的新等待路径仍只有假 tab 契约覆盖

## 父任务旅行实测补充

父任务在 2026-10-15 22:41 UTC 报告：当前内置浏览器的第三层节点 6 未知事件自然行进中，R2.3 真实点击「进入该地点」一次；精确 disabled 入口交集的 hidden 等待返回 settled，等待后指纹改变。后续页面为 disabled「查看本地内容」及 disabled 工具、没有 dialog，工具以 unknown-state 交还控制，没有点击未知流程；之后父任务可见偶遇见闻的数字标题 2。

此处是父任务本轮实测结果的文字补充，本任务没有直接采集浏览器报告或截图。它覆盖旅行等待和未知落点停止，不覆盖新关闭动效等待或完整游戏流程。

`visible-playback.before.mjs.txt` 与 `visible-playback.test.before.js.txt` 是接手时脚本/测试原文；`changes.diff` 对照这两份原文记录本轮增量。最终文件指纹见 `checks.json`。
