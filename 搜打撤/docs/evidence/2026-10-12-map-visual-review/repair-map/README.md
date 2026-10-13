# 地图节点可见问题返修

以root当前窗口1523×956的01-entry-map.png和review.json为失败证据：箱图约30px、节点像缩小商品图，黑盘/局部光/颗粒不显。上一轮源码接入不等于视觉达标。

本轮实际改动：map-node-art.js按alpha≥224可见边界归一化，主体最长边为1.94r；黑盘半径约1.23r，因此可见边界占盘径约79%。箱首帧用独立bounds[42,286,608,613]居中归一，冻结箱帧原像素未改。其他5幅未批准节点以原图为编辑目标、实际珍珠盒为画法、IS7黑底gallery为构图/颗粒参考完成style-transfer并接新版URL。大片不透明笔触、少明暗面、偏侧颗粒/纵痕取代部分产品式细高光；原主体身份保持，不复制方舟器官/动物，不把只缩图当画法完成。

圆盘与主体分离：专属helper按类型/状态烘焙略不规则的深色盘、偏右局部辉光、有限颗粒与下垂细痕；有色光渐隐到透明，没有全圈高亮霓虹。已探索继续降亮/勾标，可达局部亮，选中短暖弧；未知/迷雾规则未改。路线和坐标未改。

人物标记加大并加落点连线，移到节点主体之后绘制，避免被主体盖住。root底栏隐藏charPanel后，现按已有DOMimg.src独立创建eager缓存Image，加载后invalidate，不再等待隐藏lazy DOM图片；没有换人物身份或画新头像。

稳定源码：game/src/core/renderer.js（纯绘画）；game/src/core/map-node-art.js。未改root的expedition.view.js/page-expedition-hud.css、全局缩放、geo、四层、邻接、迷雾、坐标或保存。未改冻结商店/五箱，也未删除旧节点图。

新实际引用：game/assets/scenes/map-nodes/下rest-heat-cell、battle-security-shard、shop-exchange-token、event-record-fragments、passage-transit-core的-style-1012-v2.webp。原PNG保留source并精确ignore，SHA/可见边界见assets.json；完整提示词与输入角色见prompts.json。

本轮5张新图已实际看源；2源码Acorn解析通过，只是必要源检查。尚待root当前窗口after图判断主体尺度、圆盘/光层和人物落点；不称美术/实页通过。未全链测试、build、提交、删除、新服务或外部浏览器。

root实际04-map-repair-v2.png确认主体归一化、箱尺度及人物恢复有效，但入口/箱/火堆偏右金团与蓝黑按钮盘同质。第二轮保持尺寸，盘与光按类型分组：通行冷青/灰白、物资中性冷白微青、火堆琥珀、战斗紫红、事件青蓝、商店暖绿；偏侧光位置亦分开。通行与交易绘画本身的外部暖光通过局部编辑改色，实物颜料不整图滤色。仍待同窗口新after检查，不因源码颜色表完成称视觉通过。
