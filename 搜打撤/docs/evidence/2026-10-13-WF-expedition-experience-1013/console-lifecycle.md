# 控制台来源恢复与商店大卡开收

2026-10-13，Friday / Sol 接续既有实现。状态：定向逻辑回归通过；当前窗口真实输入与动画观感由主代理复核，本文不记实页通过。

## 控制台

- 打开前保存来源真实 DOM、动作表、input/hover handler、overlay 模式、房间/卡牌页标记及焦点。关闭事件、商店和领奖来源时复用真实节点，保留直接监听器、待领取闭包与原输入状态。
- 地图来源关闭后隐藏控制台；实时战斗来源通过既有 `refreshView()` 恢复当前战斗。关闭动作在 `showOverlay()` 后注册，避免旧关闭清理动作表使控制台无法关闭。
- Ctrl+L 统一切换调试、Agent、数据、快捷键四个标签；长按、输入法组合与 keyCode 229 不重复切换。搜索只更新命中列表，切走再回调试保留查询并恢复输入处理。
- 遮罩捕获关闭只处理控制台这一层，不把刚恢复的商店再关掉。控制台过期或关闭后的 80ms 战斗调试回调不重新覆盖来源。
- 商店收到恢复通知时读取当前余额与货位，更新可购买状态，不重抽库存。

## 商店详情动画

复用既有深灰货架与居中大卡；只为局部详情定义动画，不增加公共弹层或整张货架动画。

- 查看商品：遮罩淡入，大卡与紧邻动作区短距离上移、由 94% 放大到完整尺寸。入场结束移除动画标记，成交刷新不重播入场。
- 收起：保留卡面完成淡出和轻微缩回，期间详情 inert；动画结束再隐藏、释放内容并回焦原货位。按动画时长设置超时兜底。
- 快速重开另一商品时取消上一收起任务；迟到结束事件/定时器不能隐藏新详情。
- 本地“减少动态效果”和系统 reduced-motion 都直接开收，不等待动画；原 CSS 减弱规则继续生效。

## 实际验证

最终有效反馈由两组独立运行组成，共 **70 项通过**：

1. `node node_modules/vitest/vitest.mjs run tests/dev-console-lifecycle.test.js tests/sys03-loot-shop-txn.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`：4 文件、69 项通过。随后商店动画结束监听增加标准事件清理，单独重跑 `tests/sys03-loot-shop-txn.test.js`，26 项通过，替代前一次该文件结果。
2. `node node_modules/vitest/vitest.mjs run tests/boot.test.js --testNamePattern '真实启动接线的 Ctrl\+L'`：1 项通过、18 项跳过。真实导入 main/boot 接线，以 jsdom KeyboardEvent 覆盖全部标签关闭、debug 输入框中 Ctrl+L、repeat/IME 守卫；这属于构造键盘事件，不代替浏览器真实键盘输入。

`node --check` 检查 `game.run.dev.js`、`game.boot.js`、`game.run.shop.js` 通过；目标 `git diff --check` 通过。

首次沙箱 Vitest 因既有依赖 `node_modules/vitest/dist/spy.js` 的 realpath EPERM 未执行任何测试；正常权限补跑后得到上述结果。一次含完整 boot 文件的五文件运行是 86 通过、2 失败，不记整体通过：既有照相馆加载回归收到 modal/title 状态不符，另一照相馆导航回归遇到 jsdom 未提供 `scrollIntoView` 并保持旧选中卡。本切片未修改照相馆源码或环境补桩；未进一步扩修，交由主代理判断归属。

未操作浏览器标签、服务、安装、build、提交或删除。待主代理当前窗口复核：地图/商店/事件/领奖/战斗来源开关、控制台实际搜索与动作，以及详情进入/收回观感、连续输入和减少动态效果。
