# 设置入口阶段诊断（本地、显式开启）

此诊断只测量，不调整布局、动画、加载阈值或帧率。使用现有 `?runtimeTrace=1` 和本地 JSON 下载；不联网，不新增依赖，不采集文本、URL、存档、路径或异常信息。默认没有采集 sink、时钟调用或新增持续监听器。原有输入、DOM及longtask记录保持原义。

## 新增固定阶段

输出仍为 `sdt-runtime-trace-v1`，revision 更新为 `runtime-interactions-20261020-2`。新增 `kind: stage`，只允许以下四个 `stage` 值。`tMs` 是阶段开始时间，`durationMs` 是结束减开始，`interaction` 在入口捕获，后来的输入不会改变它。记录在结束时追加，因此数组顺序不是严格开始时间顺序。

- `settings-module-wait`：冷面板工厂入口 `await loadPages()` 的等待区间。包含模块请求、评估及调度等待，不能称CPU时间；不含加载遮罩前两次帧等待。面板控制器已存在的热入口不产生此行；失败也会完成此阶段，不能据此断言打开成功。
- `settings-overlay-sync`：设置 HTML 已生成之后，实际 `UI.showOverlay` 同步调用区间，包含其同步包装器。模板字符串生成不包含在此段。
- `settings-navigation-sync`：`initSettingsNavigation` 同步调用区间，包括最终节点绑定、竖排选中条布局读取及surface注册（设置结构已随HTML一次挂载，不再在此阶段重组节点；现行竖排4分类见[设置挂载结构](settings-mount-structure.md)）。设置首次打开使用公共导航入场，不启动装饰切幕。
- `settings-visual-wait`：仅设置页面的 `stagePageVisual` 内 `waitPageVisual` 等待，首个layout帧之后开始、reveal之前结束。包括可见图片/页面背景/字体及最终帧调度；不等于纯网络耗时，也不包含独立装饰切幕的 `prepareCityCut` 或外层 `runPageLoading` 的等待。

四段不覆盖全部点击延迟，不能直接求和当作总延迟或FPS。取消或失败可产生已耗时的阶段行，阶段行只表示计时结束，不表示操作成功；结合DOM变化、交互轨迹及真实页面验证成功。没有当前已采集输入时不创建阶段，避免伪造interaction。

## 隐私、生命周期和默认关闭

`runtime-trace-stages.local.js` 是无监听器的窄桥接。仅已显式开启的trace安装有界sink，沿用400行缓冲。标签采用固定白名单，所有其他文本仍由sanitize丢弃。没有debug事件广播、performance.mark持久条目或全局可写调试对象。

异步路径在调用入口捕获上下文；作用域只包裹同步挂载调用，finally还原，绝不跨await保留全局作用域。clear、visibilitychange、stop和destroy使已有上下文和未结束阶段失效。阶段finish幂等；旧trace实例的上下文不能写入新实例。现有pagehide停止逻辑同时解除sink。

## 采集建议和已知边界

保留原画质与浏览器条件，同一轮做冷打开→返回→热打开→返回→热打开→返回，另测立即取消/重开。先与既有89ms及重复样本比较同步阶段是否与longtask重叠；若同步阶段小而输入延迟大，再查调度/资源路径。重叠只增加定位线索，不构成根因证明。自动化本身及浏览器负载仍可能影响样本。

原trace仅监视overlay子树childList，不监视hidden/aria属性，切换画面页签没有dom-update不表示失败。原样本后段DOM变化可能是切幕移除，不能当作整页构建耗时。

## 2026-10-20验证记录（历史）

独立小副本执行：8个相关Vitest文件、70项测试通过；修改源码/测试的定向ESLint通过。覆盖：默认关闭无采集、四标签白名单、去重完成、无输入不关联、冷/热入口、模块失败、原interaction跨后续输入保持、同步页面边界、资源等待与取消、clear/visibility/stop/destroy失效、旧实例上下文隔离，以及既有设置音频/性能选项/导航生命周期回归。

JSdom只验证边界、顺序和生命周期，不测真实布局、FPS或性能收益。未运行全量测试、发布构建和真实浏览器阶段采集；需要集成后对最终版本执行这些验证。本轮不含外部发布或主树修改。

2026-10-23仅同步设置结构说明，没有新增真实浏览器阶段采集结果。
