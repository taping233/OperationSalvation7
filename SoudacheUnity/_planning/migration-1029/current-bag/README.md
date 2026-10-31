# 现行背包迁移

来源：`搜打撤/game/src/hub/game.bag.js`（动作与页面状态）、`game.bag.view2.js`（纯视图）、`core/bag-render-derivation.js`（单次派生）、`bag-pane-view.js`（同区保留更新）、`game.bag.drag.js`（左轨跨区与堆排序）、`game.container-store.view.js`（双栏容器）、`ui/inventory-zoom.js`（大卡与操作台）。最终布局沿 `expedition-inventory.css`，材质/字体沿 `bag-design-system.css` 与 `feedback-1018.css`，容器沿 `container-store.css`。

当前状态：主会开放写入窗口后已安装现行背包与容器模块，生产冻结供主会原生复核。此目录内草稿不参与 Unity 导入或共享编译。

- 主界面：112px 左轨、28/34px 内边距、24px 栏间距，背包/安全格/消耗区一次一个。背包有全部/招式/装备/道具/资源筛选、稀有度/类型排序与整理。五列16px间距，卡宽 `min(canvasWidth*.142,cellWidth-12)`，卡格比例5/7.4。
- 数据：容量、张数、散装物资件数分别派生；散装物资每三件一格并匹配现行同名资源卡。稳定卡身份使用 id/variantKey；动作携带具体 OwnedCard UID，不依同名寻找替代对象。
- 详情：400px真卡 + 640px资料栏，72px间隔，840px栏高；卡牌效果、持有张数、所在分区、使用/容器/合成/跨区/丢弃动作、前后浏览。消耗区只有详情与复原说明。
- 容器：左容器/右随身背包、300px真卡、整叠存取和独立查看详情，容量及阻断原因、可展开收纳说明。
- 生命周期：所有刷新/关闭取消延迟详情与Canvas ghost；同区保留卡格、筛选按钮和滚动；保存命令通过 `GameRuntime.TryPersistMutation`。

主会追加授权下已最小修复 Run：CardContainerCommands 统一复用 DepartureStackKey 的 id/variantKey 身份，两向存取尊重 sourceUids；DepositCards 保留身份/快照并原子落盘，IsSha 使用现行 CardLibrary.SHA.id。Core/Res/Kit/Editor未由本线编辑，组件补齐复用主会新增 UIKit.GetOrAdd。

独立验证：最新UI编译零错误；26项领域断言通过，涵盖UID、变体、初始牌实际守卫、末张重读与存档失败。正式原生效果、shader导入与系统真实输入尚待主会。

原生验收由主会统一：左轨拖放、同名变体、第二堆精确UID、关闭取消延迟详情/ghost、保存失败保留、筛选和浏览、容器存取。旧同屏空安全格探针不适用本版。
