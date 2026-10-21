# 奖励领取动效样板

状态：代码与定向回归完成；尚未进行内置浏览器实页验收，视觉幅度与节奏待主会话复核。

## 改动

- `game/src/ui/reward-acquisition-motion.js`：飞行外层继续负责可重定向位移，内层一次性播放轻抬与分段缩放。替换背包节点、滚动、窗口几何改变时沿用原克隆和原截止时间，不重播内层。
- `game/css/card-state-motion.css`：340ms 基准内最高抬升 22 个布局像素；缩放按 1 → .96 → .58 → .12 推进，保留原来的轻描边抵达反馈、连续抵达合并与透明度收束；未增加粒子。
- 飞行或抵达过程中开启应用/系统减动效时清理视觉节点并释放媒体查询监听。成功发牌后的调用位置、容量规则、领取逻辑、缺少端点时的原反馈回退均未改变。
- 未改水平手牌、页面编排、公共 target-motion、游戏规则。

原字节备份：仓库根 `.tmp/sts-polish-1020/motion-before/`，含以上两个实现文件及原 `tests/reward-acquisition-motion.test.js`。

## 验证

`npm run test:target -- tests/reward-acquisition-motion.test.js tests/reward-card-feedback.test.js tests/card-state-motion.test.js tests/target-motion.test.js tests/reward-capacity-preview.test.js tests/architecture-boundaries.test.js`

结果：6 文件、97 测试全部通过。覆盖来源身份与成功领取反馈、动态端点更换、滚动/窗口变化合并且不延长时限、连续独立领取与重复卡计数、旧回调到达、立即离开、场景移除、应用/系统减动效、非 1 倍 UI 缩放，以及公共卡片状态、目标运动、容量预览和架构边界哨兵。

`git diff --check -- game/src/ui/reward-acquisition-motion.js game/css/card-state-motion.css tests/reward-acquisition-motion.test.js` 通过。

## 限制

测试使用 DOM 与可控动画完成信号，证明生命周期及目标追踪契约；不等同于浏览器中的 CSS 曲线、画面遮挡和视觉节奏验收。主会话仍需在当前窗口核对单张、连续多张、目标变动和立即继续；本子任务未启动服务、build、浏览器或提交。
