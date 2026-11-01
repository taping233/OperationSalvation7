# 照片页刷新与动效性能审查

本片确认三处有实际调用频率的重复工作。已按主会话追加授权，只修改 `PhotoStudioRoom.cs` 内两处动效/背景消费者并编写专用原生检查源；图库搜索主文件由 Root 持有，本片仅交证据。未编译、运行检查或启动 Unity/Player。此前 Round4 已验收的旧回调、备注失败保全、挂载范围缓存及每 100 次稳定挂载零分配，不当作本次新修改已通过的证明。

## 1. 减动效仍逐帧计算、移动不可见尘点：已修改

修改前 `PhotoStudioRoom.cs:40–50`：当图库为栈顶且减动效为真，光束分支跳过，但 12 个尘点仍逐帧执行 Repeat、插值，重复设置固定 anchorMin/anchorMax，设置变化的 anchoredPosition，并将 alpha 写为 0。`PhotoStudioElements.Reduced` 原来在光束条件和每个尘点各读取一次，共 13 次 Global 字符串读取/可见帧。正常动效的 24 个固定锚点赋值同样重复。

现行 Vite `game/css/photo-studio-room-effects.css:69–80` 已合理地区分：照片详情打开时隐藏 room 场景并暂停动画，减动效时关闭动画且隐藏尘点。Unity 的图库非栈顶早退本来有效，残余只在可见图库的减动效分支。

最小修改：固定尘点锚点移到 Awake；可见帧只读一次减动效，进入减动效时将 12 个 alpha 置 0 一次，之后直接返回。切回正常时由同一批对象按当前绝对时间恢复位置和 alpha，未销毁重建尘点，也未暂停整个 Canvas、相机或正常输入。非栈顶原有隐藏和早退保留。

可测量边界：稳定减动效帧不再执行 12 组尘点相位/位置计算和 36 次 RectTransform setter 调用；固定锚点在正常动效下也不再逐帧重设。这是调用点计数，不能推出 Canvas 必然重建次数、CPU 毫秒、GPU 绘制减少量或 FPS 百分比。组件的可见性查询和 group alpha 处理仍存在，没有宣称整个组件停更。

## 2. 固定照片室背景每帧重排：已修改

修改前 `PhotoStudioRoom.cs:7–15` 的 `PhotoRoomBackdrop.LateUpdate` 每帧 GetComponent<Image>、读图与父尺寸、计算 cover 布局，再调用 Place 设置 anchorMin、anchorMax、pivot、anchoredPosition、sizeDelta。`CardLibraryScreen.BuildRoom:184–189` 供图库和 `PhotoDetailScreen.Build:49` 的详情共同消费；背景布局只依赖父 Rect 大小和 Sprite.rect 大小，不依赖时间。源 `photo-studio-unified.css` 的固定房间背景由布局/CSS 处理，没有必要照搬成每帧重写原生 Transform。

最小修改：Awake 缓存 Image/RectTransform；每帧只检查父对象、父尺寸及实际 Sprite 几何，变化时才执行原来的 cover 和 +140 垂直偏移算法。首次启用重新布局，父尺寸变化、换成不同尺寸的 Sprite 继续布局；仅更换为相同几何的 Sprite 不重排。位置/入退场变化仍随父对象变换，不需要重算局部几何。未引入公共更新框架或静态资源缓存。

可测量边界：稳定帧 PhotoRoomBackdrop 不再调用 Place 的五个 Transform setter；Image 获取从每帧一次降为 Awake 一次。仍按帧读取尺寸以识别真实变化。本片未测这些 setter 在当前 Unity 内部是否因等值自行跳过，也不把原 setter 次数当作实际网格重建次数。

## 3. 每次搜索刷新重复匹配十遍：交 Root

`CardLibraryScreen.cs:19` 有 9 类。`Refresh:125` 扫 `_catalog` 一遍，`SyncTabs:150–154` 对每类再扫一遍，并在类型判断之前调用 `Matches(card,true)`，每次刷新共 10N 次 Matches 调用。`Matches:108–112` 每次创建分词数组并 Split/All；多个词没有命中名称时重复调用 CurrentCardPresentation.Description。后者 `Sdt.Res/CurrentCardPresentation.cs:37–60` 含 Normalize、多次 Replace 和条件规则派生。无其它过滤且一个查询词既不命中名称也不命中描述时，描述会恰好派生 10N 次。搜索有 120ms 防抖（CardLibraryScreen:99、168），不是每帧全库刷新，仍会在实际输入停顿、换类、排序、筛选操作后触发。

现行 Vite `game.cardslib.page.js:101–117` 使用单次 skip-tab projection 汇总全部类型；`ui/collection-view.js:103–126` 将 query 编译一次并按需形成搜索文本，原来源处理合理。建议最小实现：每次 Refresh 只拆词一次；单次遍历做不含 tab 的公共筛选/搜索，同时累计各类数量并形成当前 tab 的列表；单卡描述仅在名称不能满足查询时派生一次。保留现行 CurrentCultureIgnoreCase、空格拆词、排序、筛选恢复和 UID 定位语义。为本项收益无需增加长寿命目录缓存、公共 API 或在本片修改 BaseData.Customization。具体落地及其检查由 Root 持有。

## 排除的伪高频项

- `PhotoStudioWall.UpdateTiles:33–47` 已有 first/last/宽高稳定范围早退；滚动重复通知没有继续扫描和摆放已挂载卡片。没有重新申报 Round4 已修项。
- `RenderDossier` 的清树重建由实际选择变化、刷新、尺寸变化和详情返回触发；`Select` 同 ID 早退。当前证据不足以把它认作每帧重建。
- `PhotoStudioElements.Tab:21–30` 只在 Tab 按下且非输入法组合时扫描可选控件；没有空闲每帧扫描整树。
- `PhotoDetailScreen.LayoutPhoto` 只在 Build/导航时强制布局一次。备注 240ms 防抖和 onEndEdit/离开时保存有实际语义，稳定未变值早退。持久事务范围归 Hub，未重做该域。
- `PhotoStudioSurfaceMotion` 达到 duration 后早退；详情 Enter/Leave 是有限过渡。`PhotoNegativeGesture` 在未按住时早退；`PhotoPrismaticText` 仅有 pending bounds 才写 Material。未为这些短路增加通用 guard。
- `PhotoInlineLinks` 有布局尺寸与已生成目标的复用；空链接描述仍进入少量检查，但本片没有量化出值得单独改动的高频成本，未扩为空分支优化。

## 待集中运行的检查与冻结范围

新增 `Sdt.Editor.CurrentPhotoMotionRound5Checks.Run()` / `Assertions`，沿正式图库入口创建实际 PhotoStudioRoom，再检查减动效连续帧不改尘点 Transform、切回正常同对象恢复、再次减动效稳定隐藏。独立真实 PhotoRoomBackdrop 组件检查首次 cover 几何、稳定帧 Transform.hasChanged、父尺寸变化、Sprite 尺寸变化、同几何换图和重新启用布局。仅构造组件/正式命令，无物理输入或整帧性能声明。临时 Texture/Sprite 和页面在 finally 清理，减动效偏好恢复；不增加生产计数器或验证接口。

生产仅 `Assets/Scripts/Sdt.UI/Screens/Misc/PhotoStudioRoom.cs`；检查仅 `Assets/Editor/CurrentPhotoMotionRound5Checks.cs` 及其 meta。本片源码最终 SHA/字节数见同目录 `photo-motion-freeze.json`。冻结后停止编辑，由 Root 统一编译和验收。
