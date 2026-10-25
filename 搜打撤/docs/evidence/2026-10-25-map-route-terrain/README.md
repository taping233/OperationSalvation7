# 路线地形剪影试作

按老板要求为路线补地形依据，保留现有模糊剪影画风。新增 `map-route-terrain.js`，在正式 renderer 的已揭示同层道路下绘制稀疏、不对称的软边岸坡/路基；沿真实曲线取样，端点留白，位置由边标识稳定决定，不使用玩法随机源。首次密铺呈现重复纹样，最终改为约三分之一路段、以单侧为主，并变化长度和宽度。

只新增呈现，不改生成、寻路、存档与点击区域。原 renderer 和 map-travel 文档的已有增量保留。

验证：ESLint 两源码通过；Vitest `map-render-performance`、`contracts`、`architecture-boundaries` 共3文件68项通过。无全量测试、build或提交。

当前 Codex 内置浏览器使用现有5200服务，打开 `/dev/map-overview-review.html`，当前窗口1617×956；生产 renderer 加构造地图数据，不连接玩家存档。真实点击全部已知/局部揭示/收起工具，复核全景密度、文字与节点层级、未知连接不出现地形；页面错误日志为空。`overview.png`、`local.png` 为本轮截图。未检查其他层配色、实际存档跑局、连续拖拽缩放性能及其他窗口尺寸。
