# 节点抵达镜头衔接

老板反馈到达地图新节点时晃动，要求更顺滑；沿用“不用测试”。完成未提交。

源码中侧栏变化先调用`setDetailInset`直接横移镜头，再调用`frameExploration`补间。自动取景现将inset更新与位置变化分开，从当前显示位置直接补间；手动视野沿用原侧栏位移语义。终点的补充取景由180ms改为360ms，缩放被限制时按最终缩放重算侧栏锚点。

修改`game/src/core/camera.js`、`game/src/run/expedition.view.js`，同步`docs/architecture.md`；保留既有未提交改动。移动路线、节点结算、存档及减少动态分支沿用原实现。

未执行测试、静态检查、浏览器或build，视觉改善尚未经实页确认。无新服务、提交或推送。
