# 基地玻璃入场即时显示

老板反馈除卡背外仍有玻璃模糊延后出现。共用基地区块入场WAAPI及surfacePageIn CSS均从opacity0淡入：玻璃面板或其祖先低于opacity1时会形成独立背景采样边界，模糊在淡入过程中不能持续采样原壁纸。

修改：hub.presentation.enterRegions、基地首页animateRegion的起止帧均保持opacity1，保留原位移和时序；base-page-motion-v7.css为base-content切换到opacity1的专用入场关键帧，基地外层遮罩/卡片入场不叠加淡入。离场动画沿原逻辑。范围仅基地，没有修改地图或其他页面动效。

验证：base-ui-sample 11项通过，新增用例断言基地次级页每个入场帧opacity1且保留横移/延时填充；两JS node --check、CSS PostCSS解析通过。扩大执行三个测试文件19通过3失败：base-motion-v4两个旧事件反馈断言、surface-motion一个32px/10px旧期望不一致，这两模块本轮未改。目标ESLint仍报hub.presentation已有direction和before未使用，未清理这些参数。

2026-10-12，Codex当前窗口内置浏览器 http://127.0.0.1:5200/，真实从档位01进入基地、建设及收藏。建设facility-map/stage/details透明度均1，模糊16/16/18px。收藏页外层overlay/card透明度1且无动画；标题/目录透明度1、模糊18/16px；内容区实时捕获入场关键帧opacity1→1，位移translate(-32px) scale(1)→none。

后续其他房间验收被共享页面模块错误中断：`/src/core/map-node-art.js`未导出`drawMapSelectionRing`，引用来自`/src/core/renderer.js`。未重启服务或修地图；后勤、交易所、庭院及角色本轮实页未核验，源码共用路径已覆盖。截图runtime-blocker.png记录中断现场。

完成未提交，释放自有编辑占用；无新后台进程，无build、全量、提交或推送。
