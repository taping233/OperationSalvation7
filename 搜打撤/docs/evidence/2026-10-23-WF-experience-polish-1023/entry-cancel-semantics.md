# 公共返回与取消归属：实施批次，待集中验收

本批已完成代码与直接回归编写，按老板要求未运行测试、静态检查或浏览器，尚未同步副本。设置初始化的两文件修复继续保留，等待统筹最终动作包一起同步。

## 已改机制

- `linkedBackHTML` 使用现有 `data-cancel`，增加可选 `cancel` 声明，未声明的旧调用保持原行为。选档、人物主页面、人物卡池、出征整备、跑局数据五处明确声明 `cancel:true`。点击、Esc、右上关闭与遮罩沿同一按钮执行，不再靠这些入口的中文文案推断。
- `overlay._overlayCancelRoot` 按当前DOM找可用的最上层内置dialog，复用 `action-dispatch.isAvailableControl`；`_findCancelBtn` 在该所属范围查显式取消，再沿原规则兜底。可见内层无安全取消入口时，不继续落到底层页面或背包兜底，不跳过必须选择。
- `closeTopOverlayByEsc` 对现有 `cardZoom._closeCardZoom` 优先处理；由遮罩或右上关闭发起的取消也先收回特写。既有ui.js的特写/IME/长按处理未改，未新建界面栈、动作准入规则或revision绑定。

参考本地STS2 `ActiveScreenContext.GetCurrentScreen` 的活动界面优先、`NOverlayStack.Peek/Remove` 的最上层自有关闭原则。项目实现沿现有DOM/按钮取消协议落地，未移植另一套栈。

## 待集中验证

- 已编写：五种返回动作的原生点击/Esc/遮罩同路由；内层详情先关闭、下一次取消才返回父页面；内层必须选择在普通页和背包页均不穿透；特写先处理；显式false不被文案推断取消；旧未声明调用不被批量标记。
- 已补五页面渲染的 `data-cancel=true` 声明断言；原P1等待所有权与既有动作回归保留。
- 运行目标建议：`overlay-dialog`、`overlay-disclosure-focus`、`menu-pages-lazy-entry`、`departure-browse-state`、`departure-class-confirmation`、`node-cancel-semantics`，与设置两文件及统筹其他公共机制合并到下一集中验收窗口，不立即逐个运行。
- 实页建议：人物/卡池/整备的返回与Esc一致；卡牌特写先收回、原页面仍在；奖章详情/商店详情先关闭；必须选牌仍不可由Esc绕过。真实输入由旅程代理统一执行。

## 本批待同步文件

源码：`home-linked-interactions.js`、`overlay.js`、`game.menu.pages.js`、`game.run.class-choice.page.js`、`game.hub.depart.js`。

直接回归：`overlay-dialog.test.js`、`menu-pages-lazy-entry.test.js`、`departure-browse-state.test.js`、`departure-class-confirmation.test.js`。

另有前批待同步：`settings-navigation.js`、`settings-page.test.js`。未删除旧 `settings-transition.js`，未build、提交或推送。
