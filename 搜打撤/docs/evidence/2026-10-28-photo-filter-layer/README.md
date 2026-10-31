# 照相馆筛选菜单遮挡修复

2026-10-28，Friday。修正 `game/css/photo-studio-unified.css` 的筛选栏层级。

内置浏览器 http://localhost:5200/ 当前窗口复现：筛选栏动画 transform 建立层叠上下文，照片列表实际 z-index 为 2，遮住菜单。筛选栏明确 position:relative、z-index:3 后，三个菜单重叠区的 elementFromPoint 均命中菜单内部。

真实点击验证：稀有度选择“稀有”得到50张，排序选择“名称”、人物选择“通用”及重置正常；截图 `fixed.png` 为重置后展开稀有度菜单。控制台 error/warn 为空。

定向测试：photo-page-lifecycle-audit、premium-ui-pages 两文件22项通过。Stylelint 与定向 diff 空白检查通过。未运行全量、build；未提交推送。复用既有5200服务，未启停。
