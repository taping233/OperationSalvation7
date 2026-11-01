# 公共遮挡与动画独审

状态：只读源码审查完成。未编译、运行测试或启动 Unity；本文不是原生或实绘验收结果。没有修改生产或测试。

已读本轮 `UIKit`、`UiStack`、`DesktopRunHud`、`CurrentHomeMotion`、`CurrentHomePlate`、`CurrentSlotPaint`、`MenuDialogs`、`BoardView`、`MapBackdrop` 的 diff 和对应活跃调用链，并追到实际背景/页面构建。通用 `Panel` 只有 RectTransform，通用 mask 为 .55，不能从类型基类、Top 或 Blocked 推断完全遮挡。

## 遮挡边界

| 页面 | 当前安全边界 |
| --- | --- |
| SettingsScreen | 可以白名单：整屏 `#11171F` 不透明底色。切分类只淡化内容区；额外 PageEntry curtain 不使本页底色透明。 |
| BagScreen | 可以白名单：整屏 `#101b28` 不透明铺底，后续背景材质、阴影及局部拖拽透明度不影响该铺底。 |
| BattleScreen | 保持默认 false：没有整屏不透明底色，far/ground 所在 world 上移110，底部只有半透明渐变。far 纹理本身 opaque 不足以证明整窗遮挡。 |
| GuideScreen | 保持 false：纸页至多96%窗宽、94%窗高，外围 .72 遮罩仍需要底图。 |
| ClassChoiceScreen | 保持 false：人物主视图不透明，但同一 Panel 的卡池分支为局部 .93 面板，不能按类型整体白名单。 |
| SlotPickerScreen | 保持 false：底图 opaque，但整页入场/退场有 CanvasGroup alpha、位移及退场缩放，关闭前已经透出底图。 |
| TitleScreen | 保持 false：壁纸交叉淡化不保证合成 alpha=1；两个 .5 层按普通混合仅合成 .75。 |
| HubScreen / NodeShellPanel | 本轮不扩白名单。Hub 当前背景纹理 alpha255、EnvelopeParent 全覆盖，可以作为后续明确候选。NodeShell 有重写 Build 的子类，且38个节点背景键对应33张纹理，其中 outskirts 最低 alpha254，其余32张全opaque，不能把整个基类认作严格不透明。 |

上表纹理 alpha 来自只读像素检查，不是截图验证。战斗内普通手选、真实注能、牌堆、发现、设置和详情需要保留战场底图；真实注能为 .4 遮罩及 arena 局部模糊，牌堆还通过 GrabTexture 采样下层，不能把战场当作无关背景停画。上层透明页可以覆盖一个仍不透明的下层页面，因此按栈内实际覆盖页判断比只判断 Top 合适。

## 已反馈并收敛的边界

1. 原版只在 HUD.Update 同步地图遮挡：若 HUD 先更新、随后关闭不透明页，本帧页面已隐藏而地图仍 cullingMask=0。主会话改为 UiStack.Changed 在 Push/Close 同帧同步；已回读通知顺序，Close 先移栈、执行关闭/停用，再通知，消除了原先依赖 Update 顺序的恢复窗口。
2. Home 最初把 covered return 放到交叉淡化之前，并在 .18s 清掉离场身份：快速切壁纸后打开半透明指南会冻结中间 alpha。主会话已让交叉淡化/显隐及有限离场继续收口，再停止常驻写入；已回读该修正。
3. 减动效切换是同一有限过渡的附加边界：原 `reduced || phases==1` 会只朝0更新一帧便冻结旧缩放/滤镜。主会话回告已将三个阶段在减动效时直接归零，并把长停留后返回标题的 rest 状态纳入原生检查；此最后补丁依据主会话回告，未另行运行验证。

其余已读部分未发现需要新增修复的确定问题：ClearChildren 先禁用再脱父，避免同帧查到旧控件；Close 的幂等移栈及 OnClose 顺序保留 owner 清理；地图只关绘制并保留相机、AudioListener 和移动推进；字体 dirty 保留到恢复后的 LateUpdate/onPreCull；Backdrop 的层、缩放、尺寸 dirty 能覆盖恢复；Slot 的缓存/圆周点替代保持原值，入场末尾补回 scale=1。

集中原生只需明确覆盖：同帧关闭即恢复地图 mask；连续同帧重建只命中新控件；覆盖/返回后壁纸和有限过渡收口；减动效在覆盖期间切换并长停留后返回 rest。实际运行与画面结果由主会话统一登记。
