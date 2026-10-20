# 选择态装饰层查询减量

公共选择态装饰层在 DOM 成员不变时，滚动和尺寸刷新不再重复查询全部控制组及其成员。当前选择、可见性、实际几何和颜色仍在刷新时读取；不改变游戏状态、焦点或交互规则。

## 实现边界

- 范围：`game/src/ui/selection-state-motion.js`，服务背包分区、筛选和设置导航。
- 初次安装、childList 或 class 变更使成员缓存失效；DOM 变更仍在下一次合并帧重新发现分组，并对新增/移除成员更新 ResizeObserver。
- aria-selected、aria-pressed、hidden 保留原有调度，只跳过成员扫描。disabled 不在成员/选择器中，不新增其监听规则。
- 组移出根节点或不再匹配组 class 时释放装饰层与观察；dispose 断开观察、移除监听、取消排队帧，并删除全部组引用。
- 仍执行选中元素查询和几何测量。没有缓存布局结果，也没有假设滚动或尺寸变化不影响位置。

## 定向验证

2026-10-19，在完整 `9b0fe799` 基线的独立副本验证；既有依赖，无新安装。

1. 将新增专测对原基线执行，5 项中 3 项失败、2 项通过，退出码 1，证明专测能识别原问题。
   - 连续 20 帧 scroll/window resize/ResizeObserver 同步触发：root querySelectorAll 为 60 次，单组 item querySelectorAll 为 20 次。
   - aria-selected、隐藏、恢复共三帧：root 扫描为 9 次。
   - 组 class 移除后原实现未释放装饰层。
2. 应用实现后执行：
   `node node_modules/vitest/vitest.mjs run tests/selection-state-query-work.test.js tests/selection-state-motion.test.js tests/target-motion.test.js --reporter=verbose`
   - 3 文件、20 项全部通过。
   - 同一 20 帧场景 root/item 扫描均为 0，最后目标 x=20，几何跟随保持有效。
   - 覆盖新增/删除成员与组、class 失效、根节点本身作为组、选中/隐藏/恢复、取消待执行帧、重复安装、dispose 和重新打开。
3. 定向 ESLint 和 `node --check game/src/ui/selection-state-motion.js` 通过。

上述数字是 jsdom 调用计数，不是帧率、真实浏览器耗时或用户手感测试。未做全 CI、build、真实游戏实页或 FPS 测量；未提交、推送或启动服务。

## 隔离说明

仅本实现、新增专测和本文组成补丁。未改共享登记或其他并行属地。`npm run handoff -- --paths game/src/ui` 已尝试，隔离副本缺少 Git 元数据导致失败；使用母会话提供的受保护范围与已确认无冲突属地继续，不伪称 handoff 通过。
