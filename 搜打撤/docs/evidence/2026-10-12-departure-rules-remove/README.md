# 整备规则文字删除

老板要求删除整备规则文字。仅移除 `game/src/hub/game.hub.depart.js` 的「出征与卡牌损耗规则」说明块，同步调整已有页面测试断言；保留携带摘要、操作提示与出发逻辑。

验证：`npx vitest run tests/departure-browse-state.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`，3 文件 / 42 项通过，退出码 0；目标 diff 检查通过。

实页：Codex 内置浏览器（cua）、当前窗口、`http://127.0.0.1:5200/`。真实点击进入城市 → 档位01 → 出征整备 → 下一步选择卡牌。规则说明节点不存在，整备与出发按钮存在；所采集 console error 为空。截图见 `departure.png`，结构化来源见 `browser-input.json`，已通过 workflow browser import 登记。

未确认出发；不覆盖实战或其他尺寸。本轮未 build、未提交、未启动或停止服务。既有同文件改动保留。
