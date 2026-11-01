# 基地、背包与存档：第二轮对照

当前状态：生产与回归检查源已冻结，尚未编译、测试或启动 Unity。集中验证由 Root 执行，本记录不沿用上一轮通过结论。

## 范围与来源

- 独占实现：Sdt.Run 的 BaseData 六文件、SaveSystem 三文件、SaveJson、CardContainerCommands；经 Root 扩展含 BagItemCommands、MetaProgress 系列与 GameRuntime.Persistence。UI 为 Screens/Hub 与 Screens/Bag。
- 本轮实际修改仅 CardContainerCommands、BagScreen、BagCurrentView、BagCurrentCell、ContainerScreen，另有专用 Editor 检查及 meta。GameRuntime 主文件、Res/CardLibrary 与共享 Kit 没有由本片改写。
- Unity 基线 81b87cbd5f7b6bb7de48b0973c534ba494cb84a9；Vite 只读 HEAD f966e859043b7ab3703839005029ef090a4677b5。未转译父项目四个 active 帧/idle 工作树改动。
- 当前容量来源为 core/card-capacity.js:44；容器来源为 hub/bag-container-pages.js、bag-inventory-commands.js。原子保存仍调用既有 TryPersistMutation。
- 旧 parity-1031 仅用于定位已完成内容，没有修改任何旧规划文件。

## 确证与处理

1. 真实空位显示不一致：合法资源满包 base16 + 盒9、普通1格/资源24格时 used25，旧背包页仍宣称普通可用15格，而 CanReceive 拒收。现统一 ordinaryFree=max(0,min(baseCap-ordinarySlots,totalCap-used))；已有普通超限时 resourceFree=0，与正式容量判断一致。
2. 容器说明切换和存取过去逐次销毁整棵子树、重新创建全部卡面。现根、双列、ScrollRect、按钮和未变卡面保留；帮助开合只调整布局与滚动，不查询库存、不重建内容。存取仅增删发生变化的堆，卡面指纹入口与背包单元复用。
3. 容器原按钮不检查面板拥有者，关闭/重绘后保留的事件可以继续引用旧 UID。现要求当前 runtime/Base/slot/seed、启用、栈顶和代次；关闭及换局不再接受旧事件。重绑使用新的 ButtonClickedEvent，旧事件保留旧代次；校验先于通用 click 声。
4. Bag 每次刷新反复分组两区，排序逐堆 IndexOf，拖序另建同一批分堆。现一次双区分堆供计数与列表共用，按首出现顺序拆堆；排序建首位置索引，拖序共用同一快照，散装资源目录一次读取。现行 cardOrder 的名字输入仍有当前消费者，保留其等价解析与稳定顺序。
5. 整堆取出过去每张卡复制全包并 Query：M 张、N 库存产生 O(MN) 遍历和投影。现只建立一次最终投影并一次 Query，再沿既有原子事务修改所有 UID；失败回执与回滚入口不变。
6. 奖励整理的批量安全格查询交给 Run 接入：CreateSafeStoragePreview 返回现有 BagCapacityQuery；同一 Query 保留分组元数据，SafeUsed、CanStore(card,count,out requiredSlots) 每堆常数次查询。除安全格增格，还检查移出后总格和普通格容量；CanTakeFromContainer 为容器列表提供同一份最终容量预览。快照仅供当次呈现，不跨库存变更缓存。
7. 按 Root 公共遮挡接口为 BagScreen 声明 CoversBoard。BuildShell 的全屏 #101b28 底层不透明，背景 shader 叠在底层上；仅单卡和拖拽影子有 alpha/缩放，无整页 alpha/位移动画。Container 自身不额外声明全屏遮挡。

以上收益依据为实际遍历、对象创建与重新挂载路径减少，没有帧率、耗时或 GC 测量声明。未引入新存档格式、全局库存缓存或通用渲染框架。

## 集中验证入口

正式文件 Assets/Editor/CurrentHubSaveRound2Checks.cs，类 Sdt.Editor.CurrentHubSaveRound2Checks：
- public static IEnumerator Run()
- public static int Assertions

Root 的 CurrentRound2Validation 统一提供 Play 模式、App Canvas 与隔离 SDT_UNITY_TEST_DATA。本检查只使用隔离 slot5；没有自动启动注册、OS 输入或玩家入口。planning 同名文件是初稿留存，不作为维护入口。

必要回归源已覆盖：合法资源满包真空位；safe 同名不同 variant、装备/普通分堆边界与完整 Query 对照；取出预览和完整投影一致；只读查询不改库存/RNG；真实 EventSystem submit 的整叠存取；帮助开合保留根/卡面/ScrollRect；重绑、关闭和新容器打开后的旧 UnityEvent 重放无效；正常返回和 UID 保全。

输入方式边界：EventSystem submit 是构造的界面操作路径；旧 UnityEvent 是专门的陈旧回调重放，分别断言，不宣称物理键鼠或射线实绘验收。Root 另行集中编译、原生与播放器检查。

## 冻结

精确文件、原字节与 LF SHA256、大小、mtime 见 hub-freeze.json。仅 git diff --check 和源文本复核已完成；没有运行编译、测试、Unity、构建、提交或推送。
