# 战斗手牌悬停起落放缓

2026-10-25，老板反馈卡牌悬停起落太快、不自然；按上下文修改战斗手牌。

原定义为160ms、`cubic-bezier(.22,.75,.3,1)`，上下起落共用；相邻卡牌使用独立translate让位，却没有对应过渡。本轮在原定义中改为抬起300ms、回落420ms，缓动为 `cubic-bezier(.25,.1,.25,1)`；transform与translate同受过渡控制。新增专用时长进入现有Motion参数表，不改变其他页面的hover时长。保留拖牌 `.aim-lift` 的 `transition:none`、抬起高度、固定命中区和键盘阅读入口。

涉及 `game/src/ui/motion-presets.js`、`game/css/battle-stage.css`，同步 `docs/modules/secondary-ui-style.md`；保留既有增量。仅回读参数、CSS接线与拖牌边界，沿本会话未跑测试/lint/类型/实页/build，实际观感、快速反向及减少动态效果未核；未改资源选择。完成未提交，无新服务/提交推送。
