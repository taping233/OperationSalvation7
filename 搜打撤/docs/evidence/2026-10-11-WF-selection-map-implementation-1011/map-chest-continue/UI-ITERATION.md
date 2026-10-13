# 地图与背包当前窗口续作

2026-10-11。根代理提供 `continue-current-window/07-map-before.png` 与 `08-bag-before.png`，自然窗口1523×956、dpr1.25；本代理实际看这两张和IS7、星铁背包、1999仓库原参考。

地图中央空间、右侧相邻决策与底部薄工具已成立。当前硬问题是左上420设计px进度栏把四个长区域名、风险与精英概率强塞横排，产生逐字竖行。专属CSS将四层改为四行紧凑行，原区域名与pocket-strip真实风险装饰保持；风险徽标靠右、不换行，当前层用细左边与微弱承托区分。重复顶部中央 `layerBanner` 隐藏，当前区域仍由四层导航指出。没有修改层目标、邻接、迷雾、路径业务或缩放。

入口与火堆同三角不是未知type回退：已核 `renderer.icons.js` 把fire、entrance、extraction与emergencyExit主动分在同一case。仅在授权的 `renderer.js:drawIcons` 加恢复/通行专属剪影，火堆为火焰和交叉柴，入口/闸门/撤离为门框和方向箭头；其余保留既有类型，包括battle交叉剪影。未改共享icons模块。

背包原新屏的三库存、容量、卡面和返回已清楚。本轮仅将重复说明空态改为“暂无消耗卡牌”，以及只在可见 `#overlay.bag-full` 壳存在时隐藏重复浮动背包键。关闭背包后地图键自动恢复，没有新增持续状态或改使用/拖动规则。

定向 `expedition-view`、`bag-architecture`、`bag-pouch-capacity`、`bag-return-hook`、`contracts`、`architecture-boundaries` 6文件64项通过；2JS/2CSS解析与diff检查通过。仍需根代理同一当前窗口after屏确认布局、真实徽标与入口/火堆轮廓；未操作浏览器、未多尺寸、未启动服务、未build/删除/提交/推送。
