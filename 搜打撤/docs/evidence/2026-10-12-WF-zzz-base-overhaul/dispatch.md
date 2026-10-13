# 绝区零参考驱动的基地改造：三线派工

老板于2026-10-12授权：三个Sol、中等推理子代理执行上一轮基地改造计划。模型统一GPT-6.1-sol / medium。主会话Friday协调、集成与当前窗口验收；子代理实际实施，不只写建议。

依据：[图文参考板](../2026-10-12-zzz-base-reference/reference-board.html)、[完整文字稿](../2026-10-12-zzz-base-reference/reference-notes.md)。以现有冬日科幻城市、现代材料、块面厚涂和人物为基准。借鉴层级、布局与反馈，不改玩法、奖励数值、存档、经济或人设，不新增示例事件、签到、抽取与付费内容。

## 设计约定

- 场景给气氛，文字给明确阅读面；保留已确认背景、玻璃要求与人物比例，避免把全基地套成荧光绿商城。
- 底部七入口固定、当前房间明确、主要动作突出；事务只用现有真实状态。
- 浏览选择、实际应用、执行结果分开；返回恢复分类、选中、滚动与焦点。
- 名称、数量、价格、条件、去向可读；锁定、未达成、可领取、已领取、使用中分别表达。
- 动效局部、可中断、减少动态可用；不得扩大背景模糊和全屏遮罩开销。

## 属地与结果

| 线 | 可写范围 | 预期结果与出口 |
| --- | --- | --- |
| A：首页与导航、空间展示 | `game/src/hub/{hub.home-v3,hub.navigation-v7,hub.courtyard-v3,photo-studio-navigation,photo-studio-tabs}.js`；`game/css/{base-home-v7,base-framework-v7,base-courtyard-v3,photo-studio-room-effects}.css`；可新增`game/css/base-zzz-shell.css`与独立`hub.zzz-shell.js`；自有`a-*.md/json`证据 | 首页大场景/紧凑事务/单一主动作，七入口和返回含义清楚；庭院与照相馆中心展示、边缘工具；不覆盖照片装裱、既有画幅和皮肤。提供需要主会话接入的导出与确切调用点。 |
| B：人物、后勤、交易 | `game/src/hub/{hub.personnel,hub.warehouse,hub.trade-shop-v5,hub.warehouse-categories-v7}.js`；`game/css/{base-personnel-v12,base-logistics-trade-v12}.css`；可新增`game/css/base-zzz-rooms.css`；自有`b-*.md/json`证据 | 浏览与详情稳定分区，人物完整且身份明确，选中/应用分开；仓库数量与名称可读；买卖模式、数量、总价、余额与禁用原因同区域可见。保持现有大卡单排、透明卡池及立绘校准。 |
| C：收藏、领奖与建设 | `game/src/hub/{hub.archive,hub.archive-v3,hub.collection-v4,hub.facilities}.js`；`game/css/{base-archive-facilities-v12,base-collection-v4}.css`；可新增`hub.reward-feedback.js`与`game/css/base-reward-feedback.css`；自有`c-*.md/json`证据 | 奖励预览/状态/执行入口/去向明确，已有成功后才显示成功；失败不改待领取；卡背预览/使用分开；建设前后变化与材料条件邻接。真实命令与保存语义沿现状。跨壳钩子交主会话接入。 |
| 主会话 | `game/src/hub/hub.presentation.js`仅公共接入/浏览上下文/反馈钩子；必要的`hub.materials.js`仅呈现；任务目录、REGISTRY自有行、VISUAL-BIBLE实际描述 | 三线合同、样板与集成；统一当前窗口内置浏览器和最小定向验证。共享依赖需先协调，子代理不写本行和task.json。 |

## 保护边界

`game.hub.js`、`game.hub.pages.js`、仓库`footerHTML`、`base-camp.css`的特写操作区只读；保留其活跃/待验收归属。战斗改造、整备与地图链、全局卡框、职业框、卡牌解释器、skin/原画、存档命令、meta.js、规则/数据均不改。旧样式只在自有任务范围最小修订，不删文件，不新增全页层叠覆盖。

## 验证与回报

子代理可跑相关现有定向测试与语法/CSS检查；不build、不全量、不安装、不起服务、不控制浏览器、不提交。每线先核对自己的当前代码与已有未提交差异，保留既有改动；超过300行先rg定位再读片段。共享文件、接入点或保护边界有依赖时发REQ编号给主会话，不能越界解决。

回报：用户可见结果、精确改动路径、实际检查与退出码、未测项、需要接入的合同、残留问题。主会话负责真实输入的当前窗口视觉/交互验收；不能把单元测试通过当作美术通过。停止/暂停立即保留现场。

老板追加验收要求（2026-10-12）：三线首轮全部完成后，主会话统一做一次当前窗口视觉检查，对照参考板提出有图据的具体意见，再交原三个子代理返工；返工后复核修改点。首轮代码交付和单元测试不作为最终完成。

当前状态：A/B/C首轮文件已稳定，主会话开始上述视觉检查。独立副本`.tmp/zzz-base-observe-1012`，Vite5335/PID26004/exec5421，主会话创建；现有5200为他会话服务，5319为上一轮只读参考板，不停止或改变它们。
