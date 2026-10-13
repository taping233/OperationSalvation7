# 基地旧样式清理

2026-10-10，老板令先删除基地前端旧有失效样式。只清理CSS，不实施审核报告中的视觉整改。

## 已完成

- `game/css/base-camp.css`：删除旧人物档案/名册、旧扩建容量面板、旧仓库壳的失效选择器；清理相同选择器、相同媒体条件下已被后续六分页样式覆盖的旧声明。
- `game/css/base-camp-compact.css`：删除上述退役结构对应的窄窗规则。
- 合计删除37条旧规则、5个混合选择器退役分支、41条完全覆盖声明，减少5296字节。
- 当前人物与设施使用`personnelHTML`/`facilitiesHTML`。退役类在`game/src`与入口HTML没有生成代码；`person-tab`仅残留在通用动效查询中，不是页面生成者，本轮未扩大为JS清理。
- `base-bar`仍用于收藏奖励，`camp-upgrade-glyph`仍用于物资详情；选角/整备/放大层及其现行规则保留。`base-camp-roster.css`、`base-camp-rework.css`、入口HTML未改。

## 删除依据与边界

加载链：入口HTML的`base-camp.css`先导入选角基础，再加载`base-camp-compact.css`；`game.hub.js`模块导入`base-camp-rework.css`。

完全覆盖判定仅采用相同选择器分支、相同media/supports上下文、相同属性以及后声明优先级不低于旧声明；不猜选择器包含关系、不合并断点、不展开简写属性。混合`:is`分支保留现行选择器。另会话的`#cardZoom`及`camp-card-actions`区域没有清理。

计划写入前核对四个CSS来源的SHA，任何并发变化即停止。逐项删除及覆盖来源见[receipt.json](receipt.json)；原字节保留在两个`.before`文件，候选与计划仅为本轮清理证据。

沿用老板不测试约定：未运行测试、浏览器验收、多尺寸、build或提交，未启停服务。结果为静态清理完成、待老板实页查看；不声明视觉回归通过。