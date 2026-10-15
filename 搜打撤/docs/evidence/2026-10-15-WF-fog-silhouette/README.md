# WF-fog-silhouette-1015 · 迷雾光晕剪影与节点色环/路径迭代

## 任务

老板批准地图呈现两连改（2026-10-15，源自我方对二游对比的不足清单）：

1. **迷雾改「剪影可见」**：未揭示节点不再完全隐藏，改为「黑色模糊+微光晕」——结构可见、类型未知。修订 2026-09-09 的「迷雾完全不可见」政策。中间版「暗剪影+?」被老板否（不要问号），定稿为光晕+黑色模糊并获老板验收（「可以，就这样挺好看的」）。
2. **节点类型色环+路径加粗**：非空节点常驻类型色环（颜色即类型）；道路加粗提亮。路径历经三轮老板反馈迭代：首版「不好看」→二版光刻线族「太简单」→三版定稿：亮芯沿路渐变（光向目的地汇聚）+可达/选中路线细密点划能量节奏+双层辉光+箭头放大。

## 改动清单（均叠加于 WF-map-node-glow-1015 在途未提交改动之上）

- `game/src/core/renderer.js`
  - `nodeGeo`：几何缓存新增 `fogNodes`（当前层未揭示节点副本，带 `fog` 标记）与 `fogLinks`（至少一端未揭示的同层边 Path2D）；缓存键加入 `seenCount` 防揭示后 stale。
  - `drawIcons`：先画迷雾剪影（不可交互、无标签、不泄露类型），再画真实节点。
  - `drawLinks`：迷雾结构边画连续发丝线 rgba(150,178,190,.13)；道路三版定稿——暗底 6px + 亮芯沿路渐变（`hexA` 三段色标，光向目的地汇聚）+ 可达/选中路线双层宽晕（16px 外扩 @.07 + 9px 主晕）+ 细密点划叠芯（[2,6] 静态纹理）+ 箭头放大 15px；行进高亮 3px。
  - `drawIndexes`：跳过 fog 节点，不泄露序号。
- `game/src/core/map-node-art.js`
  - 新增 `TYPE_RING_TONE`（色值锚点：紫=祭坛引导线、金=金币、暖=火堆底座、红=战斗、青绿=撤离/入口）与 `drawMapFogBadge`（烘焙一次的光晕+黑色模糊底座，无问号无图形语义）。
  - `drawMapNodeBadge` 非空节点绘制类型色环（r40 @.5，随状态透明度淡出）。

## 边界

- 纯渲染层：命中检测（`game.boot.js` pickNode 的 seen 过滤）、run 域揭示逻辑、共享曲线 `mapTravelCurve` 均未动。
- 实页确认：点击剪影节点无预览面板、无日志、无移动（previewHidden=true, lastLog 空）。

## 验证

| 项 | 结果 |
|---|---|
| `npm run check:syntax` | 通过（412 文件） |
| ESLint（改动文件） | renderer.js / map-node-art.js 零告警；全量 lint 的 4 个 error 全在 `game/src/hub/game.bag.js`（他人属地未提交改动，未动） |
| 定向 vitest | map-node-glow / renderer-resource-lifecycle / map-node-state / map-travel-path 4 文件 39 项全绿 |
| 实页 | ZCode 内置浏览器 localhost:5200 节点测试局（不写存档）：剪影光晕、类型色环、光刻线路径、迷雾发丝线均生效；HMR 与整页刷新后行为一致；总览视图正常 |
| node_modules | 发现共享树缺件（eslint 的 @cacheable/memory、vitest 链 cssstyle generated），`npm install` 增量补齐（+8 包），5200 服务复验 HTTP 200 |

## 未核项

- 节点揭示瞬间「光晕→实体节点」的 popIn 过渡未实页走查（机制复用既有 revealProgress 与 geo 重建，seenCount 已入缓存键，风险低）。
- 首脑/祭坛大节点的色环观感未在实页确认（色环逻辑同普通节点）。

## 截图

- `v1-silhouette-question-superseded.png` — 首版「暗剪影+?」+色环+加粗路径（问号版已被老板否决）
- `v2-halo-blob-approved.png` — 定稿光晕+黑色模糊（老板验收通过）
- `v3-path-restyle.png` — 路径二版：光刻线+连续迷雾发丝线（被老板评「太简单」）
- `v4-path-gradient-selected.png` — 路径三版选中态：青色渐变光轨+点划节奏+双层辉光
