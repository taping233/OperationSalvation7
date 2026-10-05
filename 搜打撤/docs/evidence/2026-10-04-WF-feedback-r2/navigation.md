# WF feedback R2：基地返回选档

- 修改：基地所有页签共用同一 `closeBase()`；左上返回和 `game.cardslib.common.js` 的 Escape 钩子均进入已有 `startNewGame()` 菜单门面，呈现选档页。该路径不清档、不重置 Base、不清除 active slot，也不触发新局或改写对局存档。
- 帮助问号：移除基地页头 `UI.helpBtn(...)`，并删除仅供基地页头问号使用的 `registerHubHelp()` 绑定与主题定义。其他页面的帮助入口未改。
- 接口：复用 `game.session.js` 已导出的 `startNewGame()`；不需扩展 menu/session 门面。
- 回归：`tests/boot.test.js` 实际执行标题→选档→新档基地→返回选档，再进入同一基地仓库页签并按 Escape 返回选档；断言 active slot 与 Base 档案不变、基地页无问号。原有启动链用例在关闭基地后显式返回标题，以保持后续用例起始状态。
- 验证：`vitest run tests/boot.test.js` 通过（17/17）；`vitest run tests/hub-flow-regression.test.js tests/hub-architecture.test.js` 通过（10/10）。`git diff --check -- game/src/hub/game.hub.js tests/boot.test.js` 通过。
- 环境提示：boot 用例会打印 jsdom 缺少 `Path2D` 和 Pixi 无可用 renderer 的既有渲染告警，未导致测试失败。
- 范围：未改 `game/src/run/game.session.js` 或 `game/src/ui/game.menu.js`；这两文件在本轮开始前已有未提交改动，保留原状。`game.hub.js` 也保留了本轮前已有的领取失败提示增量。
- 未核：未在内置浏览器实页验证；按委派要求未启动服务或操作浏览器。未 build、未提交。
