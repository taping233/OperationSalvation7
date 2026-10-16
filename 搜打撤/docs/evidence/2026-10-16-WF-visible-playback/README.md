# 当前窗口可见转场辅助工具

## 结果与边界

新增 `scripts/visible-playback.mjs` 与 `tests/visible-playback.test.js`。模块接收调用方当前已授权的内置浏览器 tab，只根据公开可见 DOM 快照作计划；不启动浏览器，不连接外部 Playwright/CDP，不读写存档，不使用页面求值、SDT API、合成点击或固定时长 sleep。

这是可见重复转场的辅助工具及定向契约验证，**不是完整实机验收，也不代表一局游戏已通关**。本任务没有操作浏览器。父任务继续用当前 `gameTab7` 实际游玩，实际运行所得报告由父任务另存。

## 使用方法

在父任务已初始化的 `mcp__cua_repl` 中导入；现有 tab 由调用方提供：

```js
const VP = await import('file:///workspace/scratch/b7a53a06c872/OperationSalvation7-f0e84c5d/搜打撤/scripts/visible-playback.mjs?v=20261016-r2.2');
// 先只读检查当前状态
const plan = VP.planVisibleStep(await gameTab7.playwright.domSnapshot());
// 自动执行最多 4 次白名单真实点击，任何未知或有风险状态立即交还控制
const report = await VP.runVisibleSteps(gameTab7, { maxSteps: 4 });
```

- 当前导出版本：`VISIBLE_PLAYBACK_VERSION === '20261016-r2.2'`
- `maxSteps` 仅接受整数 1–8，默认 4；超出范围直接停止
- `timeoutMs` 是 locator 的操作/条件等待上限，默认 5000，最大 30000；不作为固定 sleep
- `allowedActions` 可用白名单的子集进一步收窄，例如 `['领取宝箱', '继续探索']`，不能加入其他动作
- `seenFingerprints: report.seenFingerprints` 可把已执行状态传给后续调用，防止跨批次重复循环
- 页面发生人工选择后，由调用方查看新 DOM，再明确决定是否开始新批次；不要在 unknown/错误/歧义后盲目自动重跑
- REPL 若已导入旧版模块，需使用新的变量名及查询后缀重新导入，或重用已有最新版绑定

## 放行规则

| 允许动作 | 必须具备的已知可见状态 |
| --- | --- |
| 领取宝箱 | “获得宝箱/战斗胜利”＋“待领取宝箱”＋“领取宝箱后”说明；未来选卡说明只允许揭晓，不会继续作选卡决定 |
| 唯一“收下” | 已知奖励页、“奖励操作”，没有多奖励/选卡/容量阻塞信号；固定事件奖励须在唯一的 `archive 收获 · 小型物资箱 · 第 1 / 1` dialog 子树内有唯一精确 heading“领取奖励”和“奖励操作”区域 |
| 继续探索 / 返回地图 | 奖励完成或休整完成的明确状态，没有待领/放不下/冲突信号 |
| 进入该地点 | 已有选中地点预览、“可以前往”＋“关闭地点预览”按钮 |

每个按钮必须在快照中唯一、未 disabled。点击前再检查实时 locator `count() === 1`、`isEnabled()`、`isVisible()`，点击保留默认严格匹配与 actionability，不使用 force。

多“收下”、改名“整理背包”的容量阻塞、多奖励提示、实际选卡、未知事件、购买、出售、丢弃、删除/覆盖存档、不可逆放弃和战斗操作均停止。完成状态和待领取状态矛盾也停止。已知“当前进度未保存”等错误提示会停止。

## 观察与返回

`planVisibleStep(snapshot, options)` 为纯函数，返回 `kind: action | wait | stop`、状态、原因、快照摘要。只接受文本形式的 `domSnapshot()`；不支持的/截断快照会停止。

`runVisibleSteps()` 返回 `status: 'stopped'` 与停止原因、`steps`、`waits`、`final`、`seenFingerprints`。这里的 stopped 表示本批已交还控制，不表示操作失败或游戏结束。

每次尝试动作保存前后摘要、按钮名、结果；点击报错也尽力读取新的 DOM，不重试。已知开箱动画只对刚观察到的标题做 `waitFor({ state: 'hidden' })`，随后重新取 DOM。点击后完全无变化时，只等该已观察按钮消失一次，再重新分类；不重复连点。旅行转场若只显示数字 heading 等未知 DOM，保留成功点击记录并以 unknown-state 返回，交由父任务判断。

实时 `count() === 0` 表示刚才观察到的按钮已消失：只重新读取一次 DOM、按同一选项重新分类，返回 `reason: 'live-button-disappeared'`、`refreshed: true`，不再次点击，即使刷新后的计划为另一个允许动作也交还控制。`count() > 1` 仍为 `live-ambiguous-button` 并停止。已有成功点击记录保留 `clicked`，零数量检查对应尝试记录为 `not-clicked`，不把快速转场误写成点击失败。

摘要指纹忽略 `[ref=...]` 与焦点标记，用于检测 A→B→A 等已见状态。指纹仅用于保守循环保护，不是游戏存档身份或游戏进度证明。

## 验证与来源

- `npx vitest run tests/visible-playback.test.js --reporter=dot`：61 项通过，全部为纯函数/假 tab 契约测试
- `npx eslint scripts/visible-playback.mjs tests/visible-playback.test.js`：通过
- `node --check`：两个新增源码文件通过
- 多奖励、disabled、删除/覆盖、真实保存警告、未知旅行 DOM、循环、操作失败、动画条件等待和实时 actionability 均有拒绝/返回控制测试
- `node-preview-dom.txt`：父任务提供的真实当前内置浏览器地点预览快照，来源为父任务 `2026-10-16-WF-cloud-play-eight-hours/screenshots/node-preview-dom.txt`；本工具任务只复制其原文作解析 fixture，没有捕获或操纵浏览器
- 已检查现有 `scripts/iab-drive.mjs` 与 `scripts/workflow-browser.mjs`。它们没有可复用的纯可见状态分类器；前者依赖旧平台/页面求值/固定等待，后者面向样式证据，因此本模块没有导入它们

## 门禁映射与最终定向检查

初次脚本契约检查发现新增脚本未登记。父任务随后明确授权仅增加脚本→专测映射。实际映射定义位于 `scripts/gate-plan.mjs`，`scripts/acceptance-gate.mjs` 只重新导出；因此只在前者添加一条 `visible-playback.mjs`→`visible-playback.test.js` 映射，并在 `tests/acceptance-gate.test.js` 增加对应断言。门禁算法、阈值和其他选择范围均未改变，未绕过检查。

最终执行：`npx vitest run tests/visible-playback.test.js tests/scripts-contract.test.js tests/acceptance-gate.test.js --reporter=dot`，三文件共 158 项通过；上述四个源码/测试文件 ESLint 与定向 diff 空白检查通过。只验证本工具及映射相关范围，没有运行游戏全量测试或构建，没有将假 tab 测试称为实机验收。


## R2 实机反馈与重建回归

父任务提供两条真实输入的局部流程报告，保存在相邻父任务证据目录：

- [`auto-first-reward.json`](../2026-10-16-WF-cloud-play-eight-hours/screenshots/auto-first-reward.json)：模块真实点击“领取宝箱”，按可见开箱动画等待，三选一页面以 `card-choice` 停止，没有自动选卡
- [`auto-second-reward.json`](../2026-10-16-WF-cloud-play-eight-hours/screenshots/auto-second-reward.json)：父任务人工选毒箭后，模块真实点击“继续探索”；快速转场时下一次旧快照仍残留按钮，实时数量为 0，未再点击。旧版把该情况称为 ambiguous，父任务随后确认已回地图；R2 将此准确区分为 button-disappeared，并再次读 DOM 返回新分类

`fixtures/fixed-single-reward-dom.txt` 和 `fixtures/fixed-single-reward-complete-dom.txt` 根据父任务 2026-10-15 19:28 UTC 的真实观察重建，不是浏览器原始导出：污染空投箱、唯一冰冻药水、heading“领取奖励”、小型物资箱 1/1 dialog；领取前容量 10/16，领取后 11/16，卡牌改为“已入背包”、底部“1 张已入背包”，按钮变“继续探索”。

`fixtures/reward-leaving-dom.txt`、`fixtures/map-after-reward-dom.txt` 根据第二条实机报告的摘要与父任务确认重建，用来模拟旧奖励 DOM 短暂残留、实时按钮消失、随后地图 DOM 可见。回归只证明 R2 在这些形状中不重复点击，并返回新的可见分类。固定事件奖励新增放行逻辑的 R2 实机复验仍由父任务继续，本工具任务没有操作浏览器；上述局部真输入证据不代表整局或全局验收通过。
