# 浏览器证据适配器实施记录

2026-09-30，WF-workflow-completion 浏览器子任务。负责 `scripts/workflow-browser.mjs`、`tests/workflow-browser.test.js`；真实当前窗口采集和 CLI 接线由主会话负责。

## 已实现

- `collectBrowserSnapshot(options)` 为可序列化、自包含只读函数；只能由当前平台已授权的内置浏览器 evaluate 入口调用。采集指定选择器的 DOM 摘要、稳定身份、计算样式白名单、矩形、当前 origin/pathname/viewport。它不导航、不启动浏览器、不调整尺寸、不派发事件、不读取 localStorage。
- 必填声明：`scene`、`collector`、`selectors`。Codex 为 `{platform:'Codex',browser:'iab',surface:'current-window',transport:'cua'}`；ZCode 为 `{platform:'ZCode',browser:'builtin',surface:'current-window',transport:'zcode-builtin'}`。选择器项为 `{key:'唯一范围名',selector:'已核对选择器',identityAttributes?:['id','data-key']}`。
- `actions` 保留真实输入、合成事件、静态检查、截图与 hover 的区别；hover 必须加 `inputKind`。默认只声明静态检查。`console` 默认 `not-collected`，不能推断零错误；已采集时明确 `{coverage:'collected',errors:[...]}`。截图只能引用已经存在的日期任务证据目录文件。
- `validateBrowserSnapshot` 拒绝缺失/外部平台、未知字段、错误尺寸、未声明操作类型。`importBrowserEvidence(root,{input,task,date})` 校验后保留输入原字节及哈希，`wx` 唯一文件写入，不覆盖旧证据。
- `compareBrowserSnapshots` 按选择器 key + selector + 节点 identity 配对，同名节点凭 data-key 等稳定属性区分；缺节点、身份重复、两侧空选择器均记 inconclusive。origin/pathname/scene/viewport 不同直接不可比较。返回 equal/different/inconclusive，差异不自动等于验收失败。
- `writeBrowserComparison(root,{before,after,task,date})` 额外留存来源哈希与对比 JSON。输出路径只允许 `docs/evidence/<日期>-<任务>/`，拒绝路径逃逸及目录链接/junction。

## 子任务验证

`node node_modules/vitest/vitest.mjs run tests/workflow-browser.test.js --reporter=dot`：2026-09-30 18:28（北京时间），10 项通过。默认 sandbox 的 esbuild 子进程报 spawn EPERM；经批准的同命令执行通过，无安装、build 或外部浏览器启动。

`node --check scripts/workflow-browser.mjs` 与 `node node_modules/eslint/bin/eslint.js scripts/workflow-browser.mjs tests/workflow-browser.test.js`：通过。

测试覆盖：纯只读采集与存储禁读、同名重排、未配对/重复身份/空选择器、origin/viewport/scene/pathname 不一致、外部平台拒绝、证据类型不混淆、原始字节保留与唯一写入、任务/截图路径逃逸、日期、截图引用存在性、junction 防逃逸。

## 边界

schema 验证是来源声明校验，不能加密证明实际使用哪个浏览器；需要主会话实页采集记录相互印证。采集错误/截图引用/操作类型的声明保留原意，不自动升级为真实输入验收。DOM 字段一致不代表视觉无变化，截图、真实 hover、玩家存档和游戏流程仍按质量门单独确认。子任务未使用或占用 CUA 浏览器，实页结果以主会话证据为准。
