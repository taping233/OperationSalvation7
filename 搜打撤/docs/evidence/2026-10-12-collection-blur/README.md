# 收藏室模糊延迟

收藏室外层 `.hub-page.page-in` 仍会命中旧 `camp-page-in`（200ms，opacity .4 → 1）。现行区域玻璃动画保持 opacity 1，但未覆盖这层祖先，内部玻璃背景采样仍受外层淡入隔离。

在 base-archive-facilities-v12.css 中仅对直接包含 archive-v12 的基地子页外层取消旧入场动画，固定 opacity 1 / transform none。保留现行内部区域入场与其余页面行为。

沿用老板免测试要求，未测试、构建或实页验收；显示效果未核验。未提交，无新服务。