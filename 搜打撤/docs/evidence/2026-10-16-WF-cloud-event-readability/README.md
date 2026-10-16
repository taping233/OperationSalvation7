# 事件共用场景阅读层修正

当前增量是[终局结算R3](README-R3.md)：失败结算宽壳/正文和独立操作槽、成功整理页双滚动区/独立完成操作槽已落地，14文件94项通过，等待主协调当前窗口验收。前序[非themed节点R2](README-R2.md)已补祭坛、层间闸门、撤离共用阅读层，11文件122项通过。R1已收到主协调实机反馈：火堆、实验室、污染空投可读。下文保留R1修正时的范围与验证记录，未核项以分轮记录及主协调后续实页为准。

2026-10-15 UTC，基线 `f0e84c5dc3`。本轮只调整 `game/css/entry-events.css` 的 `.event-themed` 共用段，新增 `tests/event-scene-readability.test.js`。源码与8文件105项定向验证通过；当前窗口视觉、真实输入与长内容裁切由主协调在既有5300页面集中核验，本记录不把静态测试写成实页通过。

## 修正结果

- 右侧操作区增加随内容高度收拢的局部深色阅读底，与左叙事区使用同一冷暗基调和细青色左缘；没有给全屏铺实心遮罩
- 叙事、选项后果和裸 `p.reward-notice` 统一22逻辑像素；原有场景标题26保留，选项标题从19提高到26
- 选项标题带、确认、取消和页脚按钮至少60逻辑像素高；主要行动保留明底深字，整理/离开等次要行动使用暗底浅字，页脚支持换行
- 右区最多使用可用网格高度，长内容只在正文区滚动，页脚不参与收缩；空容量通知不占可见空间
- 保留两栏比例、场景图、公共退出、真实资源HUD、卡牌放大入口和既有选择/取消/确认行为

没有修改玩法调用者、奖励/概率、入城补给条列、非themed节点、战斗、基地或背包。没有操作浏览器、服务、构建、暂存、提交或推送；共享登记由主协调维护。

## 实际查看的证据与根因

本轮用图片查看工具实际看过以下原图：

1. [火堆修改前](../2026-10-16-WF-cloud-play-eight-hours/screenshots/22-camp-before.png)：右侧长规则直接落在蓝色城市背景，细字与底图明暗相互干扰；整理与离开按钮体量接近小工具按钮
2. [层间闸门修改前](../2026-10-16-WF-cloud-play-eight-hours/screenshots/26-layer-gate-before.png)：作为相邻页面对照；它使用非themed分支，不在本轮修改范围，不能据本轮结论宣布闸门整改完成
3. [明日方舟集成战略事件原图](../2026-10-13-WF-expedition-experience-1013/reference-images/arknights-is3-event.png)：左场景与左下叙事、右侧动作与紧邻后果形成固定阅读序列。借鉴的是局部阅读底、稳定层级与主次关系，不复制它的资源/玩法或整套UI。来源沿用既有[原图登记](../2026-10-13-WF-expedition-experience-1013/reference-board-sources.json)，本轮未重新联网核验来源页面

根因有两处：themed右侧 `.event-decisions` 原来没有阅读底；火堆裸 `reward-notice` 未接入场景正文尺度。与此同时，共用叙事18、后果15在1920基准统一缩放到1188宽时只剩约11.14/9.28显示像素。22正文约13.61、26标题约16.09、60按钮约37.13；这些是源代码和名义缩放公式的静态推导，不是浏览器计算样式。

## 验证

实际命令与完整结果见 [targeted-tests.log](targeted-tests.log)：

`npx vitest run tests/event-scene-readability.test.js tests/event-scene-selection.test.js tests/event-callback-lifecycle-audit.test.js tests/sys03-altar-restore-txn.test.js tests/node-flow-confirmation.test.js tests/entry-supply-presentation.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`

- 8文件105项通过，含新阅读层5项、既有选择/执行、回调生命周期、火堆事务、节点确认、入城专属边界与架构哨兵
- `npx eslint tests/event-scene-readability.test.js` 通过
- 新专测实际执行PostCSS解析与DOM作用域检查；`git diff --check -- game/css/entry-events.css` 通过
- 初次专测读取路径遇到Vite在jsdom中转换URL的问题，已改成项目工作目录的本地绝对路径；修正后重跑两文件8项及以上完整定向集合均通过
- 本轮没有全库测试和build；结果不是冻结index的门禁回执

源文件与所看图片的SHA256见 [verification-summary.json](verification-summary.json)。

## 主协调待补的当前窗口核验

既有服务HMR关闭，刷新前须确保新CSS已被载入。

1. 火堆休整前：长容量说明不再裸压亮图；主行动、规则、整理与离开无重叠，正文可读且大部分人物/场景仍可见
2. 多选事件：选择、取消、确认及禁用态依旧准确；确认区与整理背包入口不会互相挤压，长选项正文可以滚动，页脚始终可达
3. 单项事件/物资点与火堆结果页：局部底不会无意义拉满；卡牌放大入口、继续与退出仍正常
4. 读计算样式/矩形：正文22、标题26、主要操作至少60逻辑像素；1188宽名义显示正文至少13、主要按钮至少36像素
5. 入城场景可继承本轮阅读层，入城补给条列继续保持其独占呈现；闸门/祭坛/撤离仍走原分支
