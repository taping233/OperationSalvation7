# 退出节点返回探索的插画动画

2026-10-21，Friday，聊天01a15da0。老板反馈插画直接出现、直接消失，明确要求补动画；沿用“不用验证”。

老板随后纠正范围：撤回上一轮对通用入场、基地、照相馆、撤退及跨层插画的动画修改，恢复原编排。本轮最终只给退出节点界面时的“返回探索”插画补动画，完成未提交。

最终修改：`game/src/ui/transition-handoff.js`、`game/css/transition-handoff.css`、`game/css/page-visual-ready.css`。仅 `node-map-return` 使用420ms淡入、轻微横移/缩放、至少560ms展示和420ms淡出；图片保留至离场结束。其他切幕的时长与动画恢复前版，`map-passage.js` 与 `transition-illustrations.css` 本轮动画增量已撤回。等待目标地图就绪、取消与失效清理、减少动态效果分支保留，未改变结算或存档写入。

按老板要求未执行测试、静态检查、build或实页验证，因此这里只记录已实现内容，不声明动画效果验收通过。未新建服务、提交或推送。
