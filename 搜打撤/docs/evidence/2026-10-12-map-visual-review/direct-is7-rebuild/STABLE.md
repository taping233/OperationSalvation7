# 直接参考IS7的地图重做稳态

2026-10-12。老板否定19-final-map.png后重开；16的局部改进不代表用户美术认可。最新要求是借鉴参考层叠、细节与光线，冬境冷蓝/青白加少量琥珀，不照抄紫绿。未浏览器/测试/build/提交/删除，实页由root唯一IAB集成后看。

稳定3源码：game/src/core/renderer.js、game/src/core/map-node-art.js、game/src/core/camera.js。未动root统一HUD的CSS、expedition.view、boot/index、背包及游戏规则。

6个纯主体sprite均512px无损WebP，已实际helper引用：passage/fire/supply/battle/shop/event-symbol-foreground-1012-v5.webp，位于game/assets/scenes/map-nodes。通行映射door/entrance/extraction/emergencyExit，物资映射chest，首脑沿战斗主体；原箱帧/批准商店不重画。原产品节点已从绘画桥换掉。bounds依序为passage[105,61,405,447]、fire[82,120,428,410]、supply[86,82,432,433]、battle[75,32,429,477]、shop[106,69,440,478]、event[95,53,448,482]。

主体、盘、后期侧光、颗粒簇/纵痕、白选择环均分开，6sprite不是烘焙整张节点盘。前白矩形是alpha0隐藏RGB的工具显示；true-alpha-source-runtime.png以真实alpha合成原PNG/运行WebP均无矩形残留，未阈值去底或改alpha。阈值224仅测bounds，来源/alpha收据各有记录。

camera所有呈现zoom上限统一2.45，frameExploration仍只使用原seen+next集合，减少留白让已知局部分支居中。screen/world转换和nodeHitRadius34world/28screen未改；盘约1.04r、主体最长边1.56r均在34world命中范围内，选择环约1.68r为装饰。地图坐标、生成、迷雾和真实next未改。

白字地点名直接贴节点下，去前缀/黑牌。白选中环用缓存柔雾带与亮边，旧青入口环停绘。道路在原next/已知端点间画缓存有机曲线灰带（7/3.6/.9设计px三层），不改真实邻接。人物锚使用实际角色既有全身原图的eager缓存，未改原画。

背景实际引用root的map-atmosphere-is7-1012.webp：cover、grayscale(1) brightness(.38) contrast(.9) blur(6px)，绘完还原filter；独立局部方向冷蓝/青白雾光与淡琥珀，避免平均灰雾和全黑。按真实layer只旋转盘边侧光方向、颗粒簇，触点暗影独立在主体下方。缩放/换层缓存生命周期保留。

此为源与素材稳态，不称视觉通过；root须在完整同版本独立snapshot实页检查实际盘径、层次与点击，避免5337旧脚本混新CSS的假验收。
