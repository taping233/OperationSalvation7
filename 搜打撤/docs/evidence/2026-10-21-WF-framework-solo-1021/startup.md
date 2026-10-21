# 启动依赖整改

状态：源码与定向回归完成；当前窗口实页留给后续集成验收。

## 改动与边界

- `core/mapData.js` 具名导出 MAP，仍通过 sdtDefine 挂载同一对象；JSON 导入增加标准 type 属性，使原生 Node 可解析。
- `core/renderer.fx.js` 具名导出 FX，改用无浏览器可用的 sdt-facade 并保留 SDT.FX。FX 只有状态和方法，不创建画布或音频；Sound 仍在调用反馈时从兼容门面读取。
- `run/game.session.kernel.js` 直接导入 MAP/FX，不再捕获模块求值时的 SDT.MAP/SDT.FX。GameStore 仍仅创建一次，game、game.map、兼容门面的引用不替换；画布和日志继续由 configureGameRuntime 注入。
- `game.boot.js` 主循环直接消费同一 FX。`main.js` 与 `boot-order.js` 仅校正文档：独立顺序合同保留，整体入口与懒加载模式不变。页面尚有求值时读取 SDT.UI 等兼容依赖，去掉整体顺序需要更大迁移；将合同从 main 派生会削弱独立守卫，因此本轮不改加载模式。
- `game.session.js` 兼容导出无需变更。未改 game.store、战斗域、类型配置、架构脚本或共享现行文档；未启动服务、build、提交或推送。

## 验证

环境：Windows PowerShell，Node v24.13.0；2026-10-21，项目当前工作树。测试只对应本轮定向范围，不代表全量或浏览器验收。

1. `npm run test:target -- tests/game-session-browser-boundary.test.js tests/boot.test.js tests/light-startup-boot.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`：退出码 0，5 文件、87 测试通过，16.07 秒。
   - Node 环境测试另启原生 Node 子进程，在完全没有 window/document 时先加载内核，再导入 MAP/FX 源入口，核对依赖、门面、GameStore 状态与快照的对象身份；修改 FX.timeScale 后内核同步可见，日志注入不替换会话对象。
   - boot 使用真实 main 加载和 DOMContentLoaded，新增 MAP/FX、game、canvas、ctx、cam、log 的接线断言；既有标题、会话和懒战斗入口回归通过。
   - 轻量启动、独立 BOOT_ORDER 合同、架构边界守卫通过。
   - jsdom 的既有音频 codec、fetch arrayBuffer 与 card:martial-melee 映射警告仍输出；无失败测试。
2. `npx eslint` 指定本轮 8 个 JS 文件：退出码 0。
3. `git diff --check` 指定本轮 8 个 JS 文件：退出码 0；main.js 提示 Git 后续规范化 CRLF 为 LF，无空白错误。
4. 原生 `node --input-type=module -e` 直接导入内核：退出码 0，输出 `{"window":"undefined","document":"undefined","hp":30,"mapIdentity":true,"fxReady":"function"}`。

## 后续集成未核项

- Codex 内置浏览器当前窗口真实 main 冷启动、标题交互、会话开局、画布/日志与懒入口实际运行；本轮 jsdom 不能代替此证据。
- 集成代理汇总其他属地后按风险运行静态/定向验证；本轮没有全量测试或生产构建结论。
