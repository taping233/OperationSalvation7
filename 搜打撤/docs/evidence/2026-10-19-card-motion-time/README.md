# 卡牌趋近的时间一致性与中断接续

战斗卡牌的起拖、停靠、回手牌复用 `battle.aim.js` 的 `advanceCardPose`。原先使用 `min(1, delta * 7/8)`，不同分帧方式产生不同位置；回位尚未结束时重抓又把缩放重置为1。修改集中在既有入口，不新增动画框架，也不改出牌、命中、费用或目标判定。

## 当前行为

- 位置和缩放使用按 elapsed time 合成的指数趋近，保持原60Hz系数；对相同静止目标，30/60/144Hz在相同时间得到相同姿态。
- 回位中重抓复用当前 position/scale，保留原transform/transition/inert恢复值。
- 仍沿用1逻辑像素、0.002缩放阈值，到位后恢复精确手牌样式并停止回位帧，无无限尾追。
- 减少动态效果保留必要指针跟随，取消时跳过装饰回位；回位期间开启该设置，在下一帧恢复终态。
- 页面隐藏时取消现有瞄准、完成所有回位、取消帧并清空时钟；恢复页面不会补播后台旧运动。该监听覆盖已取消瞄准、仍在回位的时段，HMR释放监听。

## 验证

- workflow review 使用显式路径，结果为 snapshot：恢复副本无Git，handoff不能提供HEAD/index证明。影响选择11文件，未命中资源guard指纹。
- 11文件270项Vitest通过：architecture-boundaries、battle-aim-canvas-resolution、battle-area-hover-snapshot、battle-drag-reference、battle-hand-inspector、battle-hand-keyword-interaction、battle-infusion-action-layout、battle-tools-lifecycle、contracts、expedition-battle-presentation、skull-sword-effective-session。
- 新增6项覆盖帧率等时位置与缩放、回位重抓、终态阈值、运行时减动效、拖动中/回位中切后台；最后加强等时测试使其同时实际改变scale，再单独重验该文件27项通过。
- 生产文件与测试ESLint、501文件语法检查、8配置类型检查通过。skull-sword测试输出jsdom Canvas未实现提示，但断言通过；不是浏览器绘制证明。
- 源码与已验证备份逐diff核对，仅上述视觉时钟和生命周期变更；未动核心命令与玩法。
- 未构建、提交或推送。未进行当前平台游戏实页、真实拖放、FPS或视觉顺滑度测量；以上是受控DOM/时钟回归，不称实玩或实机性能提升。全量及远端CI由统一发布流程核验。
