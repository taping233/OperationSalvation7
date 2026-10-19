# 背包帮助返回连续性

背包打开帮助后，从返回按钮或共享 Esc 返回，恢复进入帮助前的背包面板滚动与帮助入口焦点；分区、筛选和排序沿用原状态。仅在原 run 与卡牌数组仍有效、仍在帮助页时执行返回，旧回调不能抢回其他页面。

## 改动

- `overlay.showHelp` 增加可选 `before()`，在替换 DOM 前捕获返回状态并传给原 `back(state)`；未提供该 hook 或 back 的帮助页保持原行为。共用返回按钮显式声明 `data-cancel="true"`，Esc 不再依赖按钮文字猜测取消语义。
- `bag-pane-view.js` 捕获面板横纵滚动；受原背包返回 guard 保护后恢复新面板位置，并以 preventScroll 聚焦帮助入口。原 overlay 延后首焦点逻辑保留已有页内焦点。
- `game.bag.js` 仅调整帮助注册，不修改消费、选牌、战斗或整个弹层框架。

## 验证

- 修前真实 `game.bag` / `overlay` / pane 模块 jsdom 测试6项中2红：返回按钮与 Esc 返回均使滚动217变为0；run变化、cards替换、新页面旧回调与无back帮助4项通过。原始输出：`red.log`。
- 最终5文件84项通过：新连续性8项，以及 bag-page-lifecycle-review、bag-render-snapshot、overlay-dialog、bag-architecture。包括连续两次打开/返回、分类排序保留、安全格与消耗区保留、延后聚焦不抢入口。原始输出：`green.log`。
- 四个改动源码/测试的定向 ESLint通过；8套 typecheck通过（`types.log`）；自有 diff 空白检查通过。
- 测试是 jsdom 合成交互，Escape 经测试事件适配器进入实际共享关闭方法；不是浏览器实页、真实键盘输入或视觉验收。浏览器环境阻塞沿主线程已核实结论，本轮没有启动外部浏览器/headless。待支持的内置浏览器可用后补真实滚动及键盘往返。
- 未运行 build、全量测试、提交或推送；无新增服务。
