# 原生复核调用点

本页已切换现行单区结构，不再生成 `safe-slot.empty`、同屏口袋列表或 `flip-inner`。以下是正式生产组件的控件名；程序构造调用与系统真实鼠标输入须分别报告。

| 行为 | 正式控件 / 调用点 | 可观察结果 |
| --- | --- | --- |
| 打开/关闭 | `BagScreen.Open()`，`closeBag`；B / Esc | 打开现行单区壳；详情上按B先关闭详情 |
| 分区 | `bagZone-bag/safe/pocket`；`BagScreen.Current.SelectZone(zone)` | 只有一个 `bag-grid`；标题与容量、张数随区切换 |
| 筛选 | `bagFilter-all/move/装备/道具/资源` | 原有按钮实例保留；空态提供 `bagFilter-showAll` |
| 排序/整理 | `bagSortCycle` / `bagTidy` | 重写稳定 cardOrder；无卡时禁用；保存失败还原顺序 |
| 查看卡牌 | `inspectStack-{OwnedCard.uid}` 的 `BagCell`；`BagCardDetail.Show(name,safe,uid)` | 400px真卡+640px资料栏；不合并同名变体 |
| 查看消耗卡 | `inspectPocket-{index}` | 显示消耗张数及火堆复原状态 |
| 详情浏览/关闭 | `inventoryZoomPrevious/Next/Close` | 按当前分区/筛选的真实卡堆浏览，关闭回来源焦点 |
| 详情动作 | `useDetailCard`、`zoomMoveToSafe/Bag`、`detailDiscard`、`confirmDiscard`、`cancelDiscard` | 动作使用来源UID；初始牌保护沿公共函数 |
| 容器入口 | `pearlStoreZoom` / `pouchStoreZoom` | 正式双栏容器页，非主壳额外菜单 |
| 容器存取 | `{pearl/pouch}{Put/Take}-{uid}` | 整叠精确UID写入；禁用显示容量原因；保存失败保留原位 |
| 容器详情/帮助 | `{pearl/pouch}Inspect-{uid}`、`containerHelp`、`{pearl/pouch}Back` | 大卡详情、展开收纳说明、返回背包 |
| 发现 | `bagDiscoverPick-{index}`、`bagDiscoverConfirm`、`bagDiscoverCancel` | 先选后确认，取消保留已保存候选 |

拖放：`BagCell.Entry.uids` 是精确源卡堆；左轨 `bagZone-safe` 上的 `DropZone.kind=Safe`，`bagZone-bag` 上为 `BagArea`。主板空白放到末尾，卡格为排序目标；资源拖到珍珠盒卡格可整叠存入。原安全格空单元探针应改为左轨拖放。

生命周期用例：按住后拖动创建 Canvas 下 `bag-ghost`，关闭/刷新/失焦均取消浮影和延迟详情。拖放后一帧抑制点击，避免同区保留更新后意外开详情；关闭后等待大于0.04秒应没有详情出现。

当前证据：`isolated-build.log` 记录独立C#编译；`domain-checks.json` 记录领域断言。正式原生效果、Unity shader导入、当前窗口截图与系统真实输入由主会集中执行。
