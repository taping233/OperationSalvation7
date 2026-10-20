# 设置最终结构一次性挂载

## 依据和范围

2026-10-20真实浏览器三次设置入口阶段样本：overlay-sync 51.5/38.6/57ms，navigation-sync 26.8/26.8/33.3ms，分别与96/92/115ms longtask区间重叠。冷module-wait 212.5ms；资源等待单独统计，不能计作同步CPU。该样本支持优先检查同步挂载路径，但不证明某次DOM操作独占长任务。

本改动仅涉及设置模板及导航初始化。通用overlay、安全确认、性能设置保存与音频逻辑保持原实现，诊断默认关闭方式不变。不调整帧率或加载阈值。

## 变化

- 每次打开仍即时读取游戏、存储和音频状态，生成6组设置HTML。
- `settingsLayoutHTML` 在字符串层组合最终5页签和5面板，首次挂载只有通用面板可见；8个checkbox的文案包装、switch语义也直接写入最终HTML。
- `initSettingsNavigation` 不再创建/搬移6组DOM或重新包装checkbox；只查询最终节点、设置入场顺序、绑定事件和测量marker。
- 初始aria/hidden/selected状态已在HTML中，不再在首次select时重复改写。每个新页面独立初始化，WeakSet只防同一节点重复绑定，不保存设置值。
- 切页marker的offsetTop/offsetHeight先读完再写两个CSS变量，消除该处读写交错。动效、分类滚动记忆及Home/End/上下循环焦点语义保持不变。

## 验证与边界

独立副本、相同JSdom环境，对未优化/候选实现的最终语义DOM（全部文字、属性、控件顺序和结构）归一化比较一致。在showOverlay插入HTML之后到同步初始化结束，childList MutationRecord数量从39降为0。该计数证明移除了连接DOM的重组，不是耗时或FPS结果。

新增回归验证：第一次插入即有完整5面板及4个hidden面板；8开关包装和父节点稳定；重开读取最新存储/游戏/音频状态；毁档确认不跨重开保留且仍须两次触发；Home/End/循环焦点、分类滚动、输入节点身份；marker两次读取发生在两次写入之前。

11个定向文件91项测试通过（含1项临时旧/新DOM对照）；定向ESLint与两个源码node --check通过。测试日志另有selection-state-motion MutationObserver在全局桩恢复后的requestAnimationFrame未定义控制台错误，不能把此轮称为无警告的完整质量门通过。未改测试框架去隐藏错误。未跑全量测试或生产构建。

真实性能收益尚未验证。集成后须沿用相同浏览器/页面/配置，复采冷打开及两次热打开的四阶段JSON，对照上述样本，并确认设置保存、返回、重开和键盘行为。不要由MutationRecord计数推算耗时降幅，或把资源等待计作CPU。
