# 真实注能战场滤镜

当前集中验收已完成，见[本轮结果](../../../搜打撤/docs/evidence/2026-10-31-unity-parity/README.md)。以下为分片实施记录，待验/未运行等时态按记录当时理解。

已实现 `CurrentArenaFilter.Set(RectTransform arena, bool enabled)`，只供真实 `snapshot.Infusing` 使用。来源是现行 `game/css/battle-infusion.css:69` 的 arena `blur(7px); opacity:.72`；普通 `RuleHandSelection` 没有这条滤镜。

原 arena 连同现行单位、文本和帧脚本移入私有 WorldSpace Canvas，不克隆演员。原位置使用不接收输入的 RawImage，保留父级、兄弟序号和 RectTransform 参数。私有相机不自动运行，仅渲染远离主场景的第 31 层；背景和手牌不是它的子树，不进入捕获。停用时还原原物、对象层、Graphic 材质；原父已销毁时销毁外移 arena，避免孤儿。

捕获 shader 使用普通 UI/Text 采样、RectMask2D 软裁剪和 stencil，RGB 按 SrcAlpha 混合、alpha 按 One 混合，获得正确预乘透明度。两次 13 点、正负 3 sigma 的可分离高斯卷积同时处理预乘 RGB 与 alpha。最终 UI 以 One/OneMinusSrcAlpha 合成，RGB 和 alpha 一起乘 .72，透明边缘不做重复乘 alpha。sigma 按 arena 的逻辑尺寸换算为 UV，不随半分辨率改变。

渲染通过 `Canvas.willRenderCanvases` 更新，有重入与同帧保护，遵守用户帧限且最高 60 次/秒。RT 采用屏幕半分辨率、最长 2048，尺寸不变复用 3 张纹理；逐帧成员扫描复用集合，纳入新增 Graphic 并及时还原移出子树的对象。只对新换材质的 Graphic 做局部重建，没有全局 `ForceUpdateCanvases`、GrabPass 或全背景截图。

当前边界是普通 Unity UI/Text；没有扩展到任意自定义着色器、世界渲染器或通用 UI 滤镜。当前项目使用 Built-in 渲染与 Gamma 色彩空间，专有相机位于远离现行主相机（far 500）的私有位置。仅新增 `CurrentArenaFilter.cs`、`CurrentArenaUI.shader`、`CurrentArenaBlur.shader`；接线归 battle 作者。

集中 `native-shared-6` 已通过捕获 alpha、卷积、新增/移出图形、显式关闭还原及 RT 释放，随后确证父节点禁用缺陷：Unity 日志明确禁止在祖先 `SetActive` 尚未完成时把 arena 重新挂入该祖先。原关闭流程接着销毁私有根，导致未还原的 arena 也被销毁。

本轮修复将父禁用/销毁分成两个时机：`OnDisable` 立即取消捕获、隐藏代理和私有 Canvas、还原材质与层、同步释放 RT，并卸载相机和材质；只把 arena、原父和布局记录交给私有根上的恢复组件。下一帧 `LateUpdate` 在激活锁结束后还原 arena；原父已销毁则销毁 arena，随后销毁私有根。延后期间的再次启用请求保留到还原后处理。正常显式 `Set(false)` 仍同步还原。修复尚未重新运行；Root 统一更新原生断言，必须先验即时隐藏/释放，再等安全恢复时机验父/布局/材质/层和销毁无孤儿。

集中验收应执行以下断言：

- 原 arena 引用、单位脚本和帧更新继续工作；普通手牌选择不产生滤镜宿主或离屏相机。
- 透明红 .5 与透明绿 .5 重叠的捕获中心约为 RGBA(.25,.5,0,.75)，不能得到 alpha .375 或 .5625；模糊后 RGB 不超 alpha，空白背景保持透明。
- 实际注能画面只模糊 arena，背景、源卡、已选区、候选手牌保持清晰；最终 arena 对比未滤镜区域按 .72 合成，无暗色矩形或字体黑边。
- 开启中新增 Graphic，以及移出 arena 的 Graphic/Transform，分别被纳入捕获或及时恢复原材质/层；文本 stencil 与 RectMask2D 的裁剪仍有效。
- 屏幕/父布局改变时 RT 与逻辑 sigma 更新；连续多次开启/关闭后，父级、序号、anchor/pivot/size/position/rotation/scale 和材质/层完全还原。
- 禁用或销毁原父、主动关闭、直接销毁宿主、战斗结束均释放相机、材质、3 张 RT 和静态活动记录；父已销毁时没有外移 arena 孤儿。
- 同帧多次 Canvas 回调只捕获一次；手动相机引发 Canvas 回调时不递归；停用时无渲染回调；捕获前后的 `RenderTexture.active` 相同。

当前集中原生断言为 `Assets/Editor/CurrentArenaFilterChecks.cs`，由 `CurrentParityValidation` 的真实播放器协程驱动；规划副本仅留作起始方案。后台编辑器不等待帧末，检查显式触发Canvas绘制；RGBA像素、卷积、新增/移出图形、显式还原/释放在native-shared-6已过，父禁用检查暴露Unity不允许停用回调内SetParent，已据此修复为立即隐藏/释放、下一帧安全还原。修后完整生命周期和pending重开仍待统一复验，不把早期部分通过当作完成。
