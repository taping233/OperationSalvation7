# 人物选择与皮肤柔和切换

老板反馈人物界面切换人物和皮肤僵硬。选人页原流程先替换立绘或 src，再等图解码后播放入场，旧图立即消失。

- 共用 swapPortrait：旧立绘保持显示，等新图解码后交叠淡出淡入，人物切换附带14px位移；皮肤仅交叠淡化，时长沿现有 regionEnter 360ms。
- 人物与皮肤连续点击均只允许最后请求落入页面；离开当前页后不会回写旧页面。减弱动态效果时立即切换，无交叠图层。
- 保留头像按钮条，仅更新选中样式和 aria-pressed，避免重建按钮丢失焦点。
- 定向测试：departure-class-confirmation、class-choice-lazy-entry、global-ui-character-lifecycle、surface-motion 共4文件37项通过；新增 character-view-motion 两项通过，覆盖解码期间保留旧图、乱序完成只显示最后目标和减弱动态效果。测试环境缺少 animate，首轮失败后补上局部动画桩，重跑通过。
- Codex 内置浏览器 localhost:5200 当前窗口，真实进入档位01基地→出征整备，切换星月、切回无、选择春日·机车，DOM与截图确认人物、皮肤、技能说明及选中状态匹配，页面error日志为空。未确认出发。只核验出征人物选择页；基地培养/外观页未改动。
- 浏览器只支持当前暴露的只读DOM求值，document.getAnimations不可用，未以浏览器动画时间线证明帧过程；实际播放机制由定向测试验证。未build、提交、推送，无新服务。
