# 修复后续查

本页逐项覆盖前次报告的旧结论，避免将修复前 findings 当作当前状态。

- DoorModal 已改用现行“层间闸门”文案、正文穿门与可选商队、页脚整理背包和返回当前层，旧撤离分支已移除；已有 owner 与 entering 守卫。
- CurrentNodeScene 已建立 node-kicker，CurrentNodeChoice 已显示“不可选”并局部将 DisabledOpacity 设为 1。
- GameBoot 已调用 StartupTransition.Install；新 StartupTransition 真实调用 departure film，并禁止跳过、绑定标题 owner、在完成/失效时清理。前次“启动片头未接线”已不成立。

## 后续复核时发现、现已静态确认修复的问题

**P2：局内指南仍显示共享 HUD，覆盖指南页头。** `Assets/Scripts/Sdt.UI/Kit/CurrentRunTopBar.cs:81-85` 的 Covered 没有 GuideScreen / CurrentBeginnerGuide；`Update` 的 visible 为 runActive && !Covered。`Screens/Menu/CurrentLeavePage.cs:42` 的 leaveGuide 实际打开 GuideScreen，且不会结束 run。源 `game/css/beginner-guide.css:3` 明确对指南隐藏共享 header。标题态打开指南不会暴露这个入口差异。

**P2：普通节点选项 idle 背景仍与源不同。** `Screens/Run/CurrentNodeScene.cs:86,96` 给可用选项整块填充 `#10212b`、alpha .7；源 `game/css/entry-events.css:36-39` 为 background:none，只有 `.ok > b` 薄荷标题底，hover 才出现深色底。禁用状态已修成透明，不影响本条普通 idle 差异。

再次回读：CurrentRunTopBar.Covered 已包含 GuideScreen；CurrentNodeChoice 的 idle fill 已设 Color.clear，仅可用 hover 填底；generic 叙述已置于独立 Clamped ScrollRect；Guide Flow 已调用 SourceTextLayout.LineSpacing。以上四项静态缺口已关闭，真实输出与滚动输入仍待实测。

## 待实图/输入核验

- node-context 的 target 外框为 x58/y30/760×39，文字 x72/y38；共享 HUD 控件 y16–74，几何相交。源 entry-events 的 context 也在 node-panel padding-top30，room-footer 说明 shared header overlays rooms，不能仅凭“一般应预留104”任意改变源设计。须看最终实图，区分源既有布局与新增迁移遮挡。
- generic 新滚动层及 Guide 新行距换算的实际效果仍待图像和滚动输入，不能把静态接线当作实机已验。
- Guide 构造已按现行两列图文、目录、页脚、原图阅读与sticky实现，不能只因新组件存在判通过。需要实际查看首章及更长章节、原图阅读与滚动位置。

## 图像证据状态

`player-1/result.json` 明确 passed:false，错误为 Failed to capture screen shot；目录无PNG。2560×1440、Canvas scaleFactor1.3333、启动片头进度/shader metadata只证明已运行到对应点，不证明图像质量。主会话已判该次取证失败，准备正常播放器隐藏父窗口方案；本复核未启动Unity/CUA或修改任何生产文件。

`player-2/result.json` 同样 passed:false / Failed to capture screen shot，未产生PNG；不作为图片通过证据。主会话准备从实际当前backbuffer读取像素的新取证方式，尚未交付本复核者查看。
