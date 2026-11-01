# 照片与首页信箱：独立只读复核

范围：PhotoDetailScreen.cs、PhotoStudioWall.cs、CurrentPhotoRound4Checks.cs；追加 HomeInboxScreen.cs、HomeInboxDeleteDialog.cs。未修改生产/检查源，未执行测试、编译或 Unity。

最新结论：下述独审发现均已由主会话最小修正，静态回核闭合；新增原生检查源待集中运行，没有通过结论。本片停止扩查其他页面。

已确认的处理：照片页 Build 先更新 revision 再失活旧内容；旧备注变化、结束编辑及关闭事件捕获原 revision，不能借新照片字段写入。正式 OnClose 在 delayed Destroy 前提交当前备注，随后 closed/revision 使旧事件失效；正常关闭动效起始提交一次，关闭中禁用交互，结束 OnClose 不重复保存。Pending 即使等于新页初始文本也仍可重试，未落盘内容可在同一会话重新打开恢复。备注属于本机 global、跨 slot 共享，不增加 Base/slot owner 校验。

初审发现 Enter 结束无条件抢焦点。主会话已修正：仅当前页没有有效选择时默认选 PhotoClose，保留当前根内已有有效选中对象，且已补 >.42s 后备注焦点的检查源。静态回核该项闭合；未把新增检查记为通过。

另曾报主会话、现已静态闭合的确定漏点：

1. PhotoStudioWall 的打开端 BuildTile→Inspect 原先缺当前照片墙启用/Top 与筛选成员守卫。旧 tile 事件在墙关闭/被覆盖时可重开 PhotoDetail；在筛选重绘后 ID 不再属于 `_filtered` 时，Inspect 的 FindIndex 为 -1，PhotoDetail.Open 会回到新列表 index0，打开另一张。现 Inspect 先检查启用/Top，查到当前 ID 后才 Select/Remember/打开，两种误操作均被拒绝；returned 的 owner 守卫保留。
2. HomeInboxScreen 的持久 header 返回原先直接 E.Hit(back,Close)，覆盖期间旧返回能移除底层 Inbox owner。现 back 动作先检查 Current，与同页其他持久 header owner 守卫一致；删除持久状态仍由现有确认流程负责。

信箱删除顺序修正静态正确：确认时先复制 action、正式关闭 dialog（OnClose 清 Confirm），再由原 Inbox 的 Current+revision 复查后 Mutate；过期确认不可再次删除，保存失败由原 Global 写入门回退并呈现错误。此处不增加存档或异步框架。

检查源边界：当前 Photo 检查覆盖导航前保存、旧 photo 事件、直接正式关闭、写失败保全及同值 Pending 重试；已另增实际 PhotoClose.onClick→等待 .18s→回到照片墙同 tile 焦点，以及被覆盖/筛掉/关闭后的旧墙 tile 事件。Enter 焦点也有选中备注后等待 .5s 的断言。这些新增源静态可达、仍待集中运行，不能把源存在记为已通过。所有当前输入均是构造事件，不宣称物理键鼠。

## 照片墙挂载范围精简回核

只读核对 CardLibraryScreen/PhotoStudioWall 的新增 range 缓存及对应原生源，未发现确定失效漏口。`_filtered` 的替换、排序和选中初值统一经 Refresh；Refresh 清除实际内容与 mounted 字典，同时把 first/last 改为不可能命中的初始哨兵，空结果也会重新建立提示。滚动、Locate 和尺寸布局继续调用 UpdateTiles；first/last 每次均按当时 scroll/view 重新计算，tile 宽高另外参与比较。视口变化若未改变范围和 tile 尺寸，原有 tile 局部位置本就不变，无需为了 viewport 本身再失效。

选中边框独立由 Select 更新，新挂载 tile 按当前 selectedId 建立，不受稳定 range 的早退阻断；动画移动墙的父级也不需要反复重写每张子卡局部坐标。实际 mounted 的清空/移除都在本类现有入口，未见外部修改该字典后缺失失效的消费者。此次不声称修复既有 resize 卡片内部画法或动态更换 catalog 的其他行为。

复杂度限于四个挂载签名标量和一份复用移除键 List，仍属当前虚拟墙局部维护，不是新缓存框架。稳定范围避开 Keys.Where/ToArray、对象遍历和重复 Place；变化范围才收集移除键，保持安全地在枚举结束后修改字典。

原生新增检查使用实际私有 UpdateTiles 的预热 Action 委托，委托创建/反射在计数区外，100 次调用期间只比较当前线程分配计数；后续仍须能取到真实 tile 并走打开/关闭/筛选流程才算整组通过。检查尚未运行；即使该段最终为零，也仅代表稳定范围的该生产调用段，不代表整帧、整页或 FPS。
