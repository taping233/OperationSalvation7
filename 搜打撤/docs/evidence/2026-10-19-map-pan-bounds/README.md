# 节点地图拖动边界

老板反馈空白区域可持续向外滑动。原边界使用全局网格尺寸加160世界单位，与当前层节点和窗口无关。

相机现在使用当前层全部有效节点的包围盒，结合缩放、窗口、详情侧栏及现有HUD安全留白计算中心范围。能完整显示的轴固定居中；放大的轴仅允许查看至节点区域边缘。拖动、释放惯性、缩放和程序钳位共用边界；窗口变化在更新尺寸后重新钳位。通过相机引用的游戏对象读取当前层，换层和新局替换几何后不会沿用旧节点。已有跟手、惯性及有限边缘回弹保留，不改节点生成、路线或存档。

验证命令：`npm run test:target -- tests/map-drag-motion.test.js tests/camera-interaction.test.js tests/map-travel-motion.test.js tests/global-boot-pointer-lifecycle.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`。

2026-10-19 本轮结果：6文件中4个直接相关文件通过；总计77项通过、2项失败。两个失败均由共享工作树 `hub/collection-conversion.js:4` 引用尚不存在的 `hub/collection-protection.js` 触发，分别是contracts循环依赖检查与architecture-boundaries依赖方向检查；属当前其他会话局外成长编辑域，本轮未改动。新增覆盖全景禁止滑空、放大边缘留白、详情侧栏、换层/窗口重新钳位及三档缩放惯性回归。

两份实现与两份交互测试的定向ESLint通过，相关已跟踪文件的diff空白检查通过。没有可用的当前平台内置浏览器工具，实页拖动、HUD/标签视觉验收仍阻塞，未用外部浏览器代替。未build、提交、推送或修改玩家存档；未创建服务。保留原地图拖动任务及共享文件的既有未提交改动。
