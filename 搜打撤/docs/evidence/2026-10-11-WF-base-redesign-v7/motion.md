# 基地 V7 动效实施记录

状态：根会话已接入独立模块，本轮修正首次展开时机与目的地逐项入场，待老板验收。老板明确要求不用检测和测试；本任务未运行浏览器、测试、build 或提交。

基地大画面保持稳定，等实际过场撤去后，再让标题、主行动、每个房间和辅助目的地逐项展开。页面是可立即操作的真实界面；动效不等待输入、不接管焦点、不引入转场定时导航。

## 首次入场时机修正

代码依据：`interface-motion.js` 的首次基地分支在 `showOverlay()` 返回前同步调用 `enterCamp()`；`camp-entry.js` 同步挂载 `data-camp-entry`、选档副本与切幕，最后一起撤去。`camp-entry.css` 的切幕和下层揭幕时长为 800ms；`enterCamp()` 在 980ms 清理标记。上一版局部动画在 `renderHub()` 中立刻执行，最晚 385ms 结束，早于遮罩撤去。这与老板反馈的“基地动效没有”对应；本轮没有浏览器复核，结论依据实现时序。

共享过场没有公开的基地 reveal 事件。`page-loading.js` 的 `onRevealStart` 是调用者参数，未向页面广播；其 `.leaving` 状态仍包含遮罩离场。新版因此观察现有 `data-camp-entry` 撤销与 `.page-loading` 节点移除，两个遮挡都结束才播放，不增加猜测延时，也不修改共享过场。

等待时仅给文字和目的地条目预置隐藏状态，壁纸保持可见；实际撤幕后的同一轮同步设置本地关键帧，避免完整界面先出现又隐藏。若等待期间同页资源刷新重建主页 DOM，尚未播放的入场请求转移到新 DOM，仍等真实撤幕。返回主页没有遮罩时立即展开。

## 依据与应用边界

- [Apple Human Interface Guidelines：Motion](https://developer.apple.com/design/human-interface-guidelines/motion)：目的明确、反馈简短、允许取消、尊重减少动态效果。落在本次实现中的是短入场、用户开始操作即取消剩余入场、动态偏好在入场期间变化立即停止。
- [Google Material：Duration & easing](https://m1.material.io/motion/duration-easing.html)：运动要足够快以避免等待，也要保留用户理解状态变化的时间。这里沿项目公共时长和减速曲线；没有另设一套弹簧、长尾或循环效果。
- [Google Material 3：Easing and duration](https://m3.material.io/styles/motion/easing-and-duration/applying-easing-and-duration)：作为现行动效导航来源；网页动态内容未完整提取，具体判断采用上面可读取的官方指南与项目已有参数，不虚称已阅读全部内容。
- [少女前线 2 官方网站](https://gf2-mobile.sunborngame.com/main/)：已读取官方功能空间设定与 PV 入口，可用于根会话继续选大页面、美术和转场材料。本任务未观看 PV，也未把未核实的游戏动画时长写成规则。

## 接口与编排

模块：`game/src/hub/base-page-motion-v7.js`；样式：`game/css/base-page-motion-v7.css`。

```js
import { bindBasePageMotionV7 } from './base-page-motion-v7.js';

// presentHub 完成并装入 V7 主页 DOM 后调用。
const disposeBasePageMotion = bindBasePageMotionV7(
  document.getElementById('hubMain'),
  { changed: tabChanged },
);
// 基地关闭时可调用；不会忘记当前 view，后续同页重绑仍不重播。
disposeBasePageMotion();
```

接口仍为 `bindBasePageMotionV7(root, { changed = true } = {})`，现有调用点无需修改。根必须带 `.base-frame-v7`，主页为 `.base-home-v7`。标题使用 `.base-home-title`，主行动使用 `.base-home-launch`；房间为 `.base-home-menu > button`，难度区为 `.base-home-mode`，其他目的地为 `.base-home-services > button`；壁纸为 `.base-room-art`。

根的 WeakMap 保存上一 `data-view`；已播放的 `changed=false` 和同 `data-view` 重绑不重复入场，即便同页数值刷新重建主页内部 DOM。过场等待中的同页重绑保留未播放请求。进入子页时记录新的 view，但交给 `surface-motion` 与 `hub.presentation`；返回主页才再逐项展开。

已有 `surface-motion` 的基地 profile 将 `.hub-page > *` 作为内容块；已有 `hub.presentation` 在主页没有子页区域时把第一个孩子作为目标。这两处会移动整张房间图，因此 V7 主页限定样式禁用旧 CSS 容器入场，绑定时只取消 target 等于主页容器/主页页体的公共 WAAPI。不会取消子页、人物或卡牌自身动画。

区域复用 `linkedAnimate`、`motionTiming.regionEnter`（360ms）、`motionTiming.stagger`（35ms）、`motionTiming.staggerMax`（105ms）和 `motionEasing.enter`。标题从左侧 24px、主行动从右侧 72px、各房间从右侧 96px、辅助区从下方 24px 展开；房间与其他目的地逐条错峰，最迟在真实撤幕后 465ms 结束。只动画 opacity/transform；没有循环漂移、缩放壁纸、扫光或闪烁。

交互、遮罩状态和动态偏好监听仅在本轮等待/入场期间存在，完成/取消后全部释放。新绑定先取消上轮自有动画；根或主页被移除、overlay 隐藏/关闭、减少动态效果启用、用户开始操作都会取消本轮并撤去条目的预置隐藏状态。

## 交付边界

已完成授权文件的实现与资料记录。现有主入口调用保持不变。没有运行代码检查或视觉复核，不能宣称动效、实际排版与浏览器兼容性通过验收；最终视觉判断由老板承担。
