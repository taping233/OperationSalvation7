# 独立只读源码复核（2026-10-30）

结论：本次查看的代码有实际接线，但仍有源文字/操作遗漏，不能据 catalog 或既有 passed 矩阵宣布忠实迁移完成。未运行 Unity、未操作前台、未修改生产或共享文档；这里只记录静态证据。后续需对当前实际播放器图片作独立复核。

## 已确认差异

1. **层间门仍调用旧内容，缺整理背包入口。** 源 `game/src/run/game.run.altar.js:382-389` 为“层间闸门”、按 reverse 区分叙述、主体穿门操作、页脚“整理背包 / 返回当前层”。目标 `Assets/Scripts/Sdt.UI/Screens/Run/NodeModals.cs:32-57` 为“隔离闸门”、旧叙述、“留下”正文按钮，没有背包页脚。`Sdt.Boot/RunLoopBridge.cs:107-115` 实际将 Door 节点送入此页。目标还保留 `_door.exit` 撤离分支，源注释明确门不再撤离；这条额外分支是否可达尚需具体地图数据证明，本报告不把它升级为已证实业务漏洞。
2. **非插画节点遗漏区域上下文文字。** 源 `game/src/ui/node-scene-view.js:43-44` 非 themed 分支输出区域与层数；`game/src/run/game.run.scenes.js:124` 提供真实 region/layer。`entry-events.css:157-161` 的共享 header 最终覆盖仅隐藏 `.event-themed` 的 context，不能推论所有场景已由共享 header 替代此文字。目标 `CurrentNodeScene.cs:25-35` 完全没有 context/kicker；门与首脑页通过 `RunUi.cs:193-196` 可达。
3. **禁用节点选项缺“不可选”，且被额外降透明度。** 源 `entry-events.css:51-53` 禁用箭头变“不可选”，文本 opacity 为 1、颜色 `#a0a8ac`。目标 `CurrentNodeScene.cs:89,98` 虽改文本颜色，箭头始终“→”；`Kit/InlineIconText.cs:113-120` 还对禁用 Selectable 内文本再乘 `.45`。祭坛碎片不足时 `AltarRitualScreen.cs:71-73` 的选项确实进入该状态。这是可达的可读性/状态文字差异，无需先假定图片看起来如何。
4. **桌面启动片头尚未接线。** 源 `game/src/ui/startup-transition.js:30-65` 在 desktop startup preparing/playing 时播放 departure 城市片头；`desktop-app/preload.js:24-25` 实际发起该握手。目标 `Sdt.Boot/GameBoot.cs:23-36` → `Kit/App.cs:35-90` → `ShowTitle():93-98` 直接打开标题，没有等价启动片头调用。`DepartureCinematic.Open` 只在 `Hub/DepartPrepScreen.cs:142` 的出发链调用，不能充当应用首次启动证据。

## 接线与取消边界

- `RunLoopBridge` 实际进入 shop/event/door/altar/emergencyExit film；fire 直接开页；Passage 在层变更事件上调用；这比仅枚举 profiles 有效。不能把 catalog 中全部 kind 视为已调用。
- 出发由独立 `DepartureCinematic`（并非 CurrentRunFilm departure kind）接 `ConfirmDeploy` → 建局 → EntrySupply；收藏档案也有独立 `CurrentAchievementMotion`。因此缺少 `Play("departure")` / `Play("achievement")` 本身不是遗漏证据。
- `UiStack.cs:85-88` PageEntry 只明确覆盖 Guide/Settings/SlotPicker/ClassChoice/HomeInbox，CardLibraryScreen:45 单独走 photo。源 `game.menu.js:70-105` 还将 openLeaveMenu/openSuggestionBox/openDataPageUi 等送入通用 loading；目标这些入口未发现相应 PageEntry。需按真实按钮及其专属演出继续核定，不能以 PageEntry 方法存在覆盖所有页面。本轮未将其列为全部已证明错误。
- CurrentRunFilm 的 callback 在 Update 中先置 `_continued=true` 再执行；Boss Gate 的 TryBeginBossGate 同步触发 BattleRequested 时，BattleBridge:352-353 复用已经继续的 boss film，未发现这条链必然双开战斗。
- film 的 owner/valid 失效会 Dispose 并清除 callback；Begin 的 `_entering` 只有失败回调复位。当前阻挡输入及 owner 生命周期下，未证明玩家可使 owner 暂时离栈、取消 film 后回来卡死；保留为未实测取消条件，而非确认 bug。

## 排版与清晰度：证据边界

- CurrentNodeScene 叙述区高度 `min(preferred+96, (height-146)*.7)`，内容沿用 UIKit.Label 的 Overflow，没有源 `event-narrative` 的 overflow:auto/独立滚动。短现行叙述不足以证明遮挡；长叙述或当前窗口高度应在实机确认。
- `SourceTextLayout.LineSpacing` 将 CSS em 除以导入字体行度量；这是合理的单位换算，不能仅凭数值比 1.65 小就判断错误。需要实际 font metrics 和行距截图。
- CardFace 的规则文字有独立 ScrollRect，默认 `ScrollDescription=true`；读图时应验证滚动到底及放大字号。不能因卡面首帧只显示一部分就直接判为文本丢失。
- InlineIconText 的新 density 路径按 Canvas 之外祖先缩放提高 glyph 栅格密度，再将网格除回逻辑单位；方向上针对了放大卡面低分辨率字形。它不提高原始贴图分辨率，也不证明所有小字/普通输入框已清晰（InputField 显式排除该路径）。
- NativeDisplayReview 记录 Screen/Display/Canvas/字体 atlas、glyph 请求像素及实际 ScreenCapture，能帮助区别桌面缩放、backbuffer、祖先缩放与贴图来源。其 result.passed 只证明自动取证流程成功；范围仅标题、卡牌对照、影像馆、设置，且没有 OS 真实输入。不能代替本轮全流程验收。
- 当前没有本复核者实际查看的 standalone backbuffer；清晰度改善、文字遮挡、shader 输出、片头持续时间与真实交互均未验收。

本轮只写此目录；以上 1–4 已即时发给主会话，生产修复由主会话协调。
