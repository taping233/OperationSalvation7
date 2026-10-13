# 按IS7主参考整改地图整体

2026-10-13，Friday / Codex，聊天01a133b8。老板在看过IS7对照和新空白节点后明确“那你对着改吧”，授权继续整体地图视觉整改。状态：本轮整体样式实现、定向回归与构造页复核完成；完整真实对局待主协调同步。源码属地仍沿原地图分工；根REGISTRY/PENDING由主协调01a133c4维护。保持所有既有未提交成果，不build/安装/删除/提交/推送，不操作主协调5372/5373游戏tabs，不开停服务。

## 本轮设计与实施

主参考为此前保留的IS7黑流树海实机图及原节点参考板，已在上一轮实际查看；本轮不重搜或以生成图冒充参考。冬境城市资产、六类旧手绘主体、新空白空壳与原头像保持。

- 背景：现行源码已含14:03的较细道路/较亮背景增量；以该现场为基线，压低大面积灰雾，保留冷蓝环境层和外围城市残影。背景仍按视口/层烘焙缓存。
- 内容节点：小暗圆承托、单侧局部光、少量边缘拖痕，按类型缓存；不恢复大灰黑矩形。选中白环、当前细青弧与原头像指示分工；名称白/浅青，无实心长标签。空白保持小主体、仅当前/选中有名称。
- 路线：低亮灰带托住细白/青路线，共用轻微弯曲的确定性路径；头像、逐段点亮与反向通行共享同一曲线。改变的是呈现，不改变next、迷雾、可达性、每格计数和结算。
- 详情：减弱常驻实心黑板，缩短少内容时的空白高度；同手绘图源、唯一进入动作和清楚的风险/受限状态保留。

## 验证与交付

最终定向命令：`npm run test:target -- tests/map-travel-path.test.js tests/map-travel-motion.test.js tests/expedition-view.test.js tests/map-node-state.test.js tests/camera-interaction.test.js tests/contracts.test.js tests/architecture-boundaries.test.js`。最后的名称/下划线避让补丁后再验，14:27起7文件98项全部通过，无skip。覆盖新曲线的端点/正反路径/有界弯曲、原寻路约束、逐格计数/稳定保存、中断旧回调/看门狗/移动锁、减动效、预览与身份。三份JS的node --check、目标diff --check通过，仅原有CRLF提示。

本轮浏览器会话句柄重置，上轮自建tab未找到；从同一Codex IAB新建独立构造tab，标准1920×1080。复用5372/@fs/读取现行源码，未导入Game、操作音频或存档。只真实点击构造页控件：选中商店、关闭详情、低生命遭遇战、不可达节点、中段截帧与通行演示；未进行正式游戏输入。风险文本出现、受限终点禁用；中段头像与共享曲线对应、已行段点亮；演示结束“已抵达”、动作恢复“查看本地内容”、工具可用。中段静帧由fixture明确构造，不冒充真实移动事务。

最终商店详情530×300，x1354/y152.8；viewport与scroll均1920×1080，原shop手绘图片已解码；浏览器error/warn为空。节点主体、承托、当前/选中及远端层级按原图对照检查；最后下方道路留白扩大，避开节点名和当前下划线。

改动5份：game/src/core/renderer.js、map-node-art.js；game/src/run/map-travel-path.js；game/css/page-expedition-hud.css；tests/map-travel-path.test.js。没有改节点图源、map-node-state、camera、expedition.view、game.boot、moveTo或resolveCell逻辑。地图背景与节点侧光保持烘焙/按类型缓存；未做有效前后性能采样，不宣称性能改善或无回退。

对照板：[map-is7-overhaul-comparison.html](map-is7-overhaul-comparison.html)。源码、截图及检查摘要：[map-is7-overhaul-receipt.json](map-is7-overhaul-receipt.json)。截图原图未经图像加工、均小于1MB；本轮无新游戏图片，复用既有六类和上一轮blank。前轮整库素材门的范围外登记错误未在此轮修复或重跑，不宣称整库素材门通过。

完整真实对局/冻结副本由主协调同步复核；未覆盖四层真实点击/节点进入/读档链、长期性能及远端CI。这里只完成本轮地图视觉实现与所列构造页检查，不以静图证明整体对局。完成未提交，自有编辑结束，根登记销账由主协调维护。
