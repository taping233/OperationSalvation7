# 远征界面审查与入城补给首轮修正

2026-10-15 UTC，基线 `f0e84c5dc3`。入城补给文案与版式已按主协调追加授权修改，出征选人、整备、地图只作分析。当前结果是源码与定向测试通过，视觉是否通过须由主协调在既有 5300 页面核验。本子任务没有操作浏览器、启动或重启服务、build、提交或改动全局卡牌。

## 结论与本轮完成范围

优先问题是规则说明与实际闸门相反，以及入城补给的小字、小按钮和被强制拉长的奖励条。本轮保留老板已经选定的靠左条列、绿色逐项收下、领取后消失、领完再确认规则，只改此界面的呈现。

- `game/src/run/game.run.altar.js:123`：入口说明改成“共 N 张、全部领取后才能继续探索”，不再暗示任选；领奖页加入实际 `taken / cardIds` 进度，0、1、2 张均按真实总数显示；满包失败在页脚明确“仍保留在入口”，不再只依赖被覆盖的地图日志；最后确认继续保留勾选并补可见文字“继续探索”
- `game/css/expedition-rewards.css:182`：仅调整 `.entry-supply-strips` 及包含它的补给壳；条宽统一 360 逻辑像素，卡面 272，绿色收下/整理背包按钮至少 60 高，主要提示/来源/规则 22，标题 34；右侧仅展示“入城准备”和真实领取进度，不增加游戏资源、操作或功能
- 条列不再继承通用 `min-height:100%` 拉满；显式覆盖通用单张/双张宽度选择器，剩余一张时不再突然换宽；完成页仍只在全领后出现确认
- `tests/sys03-altar-restore-txn.test.js` 增加实际入口文案、0/1/2 领取进度、满包原地保留、旧回调失效、逐张消失和最后确认断言
- 新增 `tests/entry-supply-presentation.test.js`，用 PostCSS 核对补给专属选择器、计数宽度/高度覆盖和名义缩放尺寸；这不是浏览器计算样式或视觉验收

交易、发卡、持久化字段、全部领取闸门、普通宝箱/战后奖励规则与共享奖励 HTML 组件未改。地图、基地、其他出征源码和全局卡面未改。

## 已查明的根因

### P0：入口表达“任选”，实际要求全部领取

修改前 `game.run.altar.js:164–165` 写“收下所需的卡牌”“可领取最多 2 张”。同文件页脚却写“领完全部入城补给后才能前往其他地点”；`node-reward-state.js:22–25` 以 `taken.length < cardIds.length` 作为闸门。`node-reward-state.test.js` 与 `map-travel-path.test.js` 明确要求打开过、部分领取、旧档缺 entered 都不能提前放行。

这是文案错误，不是需要放宽的玩法。本轮已修入口文案，闸门保持原样。

### P1：补给条的实际宽高不由 entry 的 216px 声明控制

修改前 `expedition-rewards.css:139–141` 的通用 `[data-reward-count="1"]` / `[data-reward-count="2"]` 选择器比 entry 的普通 class 选择器更具体，因此单张/双张仍会取得 322/302 逻辑像素宽。末段通用 `.reward-objects` 又写 `flex:1 0 auto; min-height:100%`，覆盖 entry 前段同特异性声明，造成窄而长的绿色条。

不能只把 entry 的 216 改大。本轮使用 `.entry-supply-strips.reward-replica[data-reward-count]` 明确拥有条宽和条组尺寸，普通奖励选择器与其行为不变。

### P1：字号在统一缩放后过小

`ui-scale.js` 以 1920×1080 为基准统一缩放。当前来源截图为 1188×761，其中游戏区约 1188×668，名义缩放为 0.61875。旧页脚 14 对应约 8.66 显示像素，收下按钮 38 高对应约 23.51。新主要提示 22 对应约 13.61，60 高按钮对应约 37.13；完成按钮 64 对应约 39.6。

以上是源代码尺寸与统一缩放公式的静态推导，不是本子任务读取浏览器计算样式的结果。缩略卡面继续复用正式卡牌，并保留点击大卡阅读，不改全局卡面字号；长卡规则的大卡可读性应在主协调实页检查。

## 实际查看的图与参考边界

已用本地图片查看工具逐张看过主协调提供的 [11 选人](../2026-10-16-WF-cloud-play-eight-hours/screenshots/11-depart-character-before.png)、[12 整备](../2026-10-16-WF-cloud-play-eight-hours/screenshots/12-loadout-before.png)、[13 地图](../2026-10-16-WF-cloud-play-eight-hours/screenshots/13-map-before.png)、[14 入城场景](../2026-10-16-WF-cloud-play-eight-hours/screenshots/14-entry-scene-before.png)、[15 补给条列](../2026-10-16-WF-cloud-play-eight-hours/screenshots/15-entry-claim-before.png)。这些是修改前实机图，本子任务没有自行构造其交互。

同时实际看过仓库保存的明日方舟 [奖励原图](../2026-10-13-WF-expedition-experience-1013/reference-images/arknights-is6-reward.jpg)、[事件原图](../2026-10-13-WF-expedition-experience-1013/reference-images/arknights-is3-event.png)、[地图原图](../2026-10-13-WF-expedition-experience-1013/reference-images/arknights-is3-map.png)。来源与限制沿用 [来源登记](../2026-10-13-WF-expedition-experience-1013/reference-board-sources.json)。参考的有效部分是固定层级、物品图/说明/收下顺序、稳定操作区与主次关系；奖励原图里的“直接离开”不能移植到本作必须全领的补给页。

选人/整备旧来源登记中的 HSR、ZZZ 两张本地原图本轮路径不存在，因此本轮没有声称重新看过这两张原图，也不据其历史描述宣布当前页面达标。全部实际查看图片的 SHA256 见 [核验摘要](verification-summary.json)。

## 留给下一步的具体建议：尚未实施

以下均为后续候选，须等本轮补给实页过关、确认属地后再动手，不与其他活跃地图/基地工作混写。

### P1：出征选人到整备的视觉跳变

- 证据：11 为大面积近白背景，12 与基地为冷暗玻璃，连续步骤 02→03 看起来像换了产品；11 的主角框、信息框和候选头像已经统一，应该保留人物展示边界
- 文件：`game/css/roster-departure-v2.css:3–22`，仅以 `.cls2-page.roster-reference[data-base-departure="true"]` 约束基地出征变体；整备现行样式在 `departure-selected.css:2–27`
- 具体改法：让选人根背景、页头文字、步骤条、返回/下一步按钮接近整备的冷暗基底；人物原图保留独立中性承托和现有 contain/皮肤边界，不把立绘或整块内容模糊。先看五人物和横幅皮肤再决定是否细调比例
- 验证：`departure-class-confirmation.test.js`、`e4-async-entry.test.js`、`class-choice-lazy-entry.test.js`；主协调当前窗口真实往返选人/皮肤/卡池/整备，确认选择与取消均不扣仓、不覆盖草稿

### P1：推荐装配的三按钮占首屏，但安全事务必须保留

- 证据：12 的仓库区顶端三个同级按钮加一整行小字，再叠三筛选器，使牌池实际可见高度被压缩。当前默认同时显示禁用的“应用预览”“撤销推荐”
- 文件：`game/src/hub/game.hub.depart.js:216,247–274,429–433`；呈现 `departure-selected.css:28–38`
- 具体改法：保留一个显著“预览推荐”入口；预览后就近显示推荐卡名、占格与“应用”，应用后才把“撤销”作为次级动作显示。可以使用状态相关可见性，不合并成自动装备，也不把预览改成直接应用
- 必须保留：预览不改已选/不扣仓；应用只是更改草稿；库存或宠物等签名变化必须重预览；继续手调后撤销不得覆盖用户手选；最终出发才扣所选稳定卡堆
- 验证：`departure-stack-lifecycle-review.test.js`、`departure-summary.test.js`、`base-departure.test.js`、`departure-real-session-review.test.js`；真实手选→预览→应用→撤销→再手调，取消整备后核对仓库

### P1：携带区缺少就近操作说明与关键摘要

- 证据：12 的“本次携带”只有卡牌，如何移出只在拖拽或大卡等路径中才能发现。`departure-selected.css` 当前把 `#depSummary,.camp-pack-note` 整体隐藏；源码摘要实际含模式、固定初始卡、额外携带数、入城职业卡与特殊容量
- 文件：`game/src/hub/game.hub.depart.js:181–182,227–231`，`game/css/departure-selected.css:57–65`，动态更新在 `game/src/hub/departure.view-updates.js`
- 具体改法：在右栏标题旁放“点卡看规则 · 拖回仓库移出”短说明；将模式/额外携带/容量相关警告提炼成单行摘要，避免直接恢复整段长文本压住牌池。宠物和消耗区新手说明保留真实当前数据
- 验证：`departure-browse-state.test.js`、`departure-stack-lifecycle-review.test.js`、`departure-drag.test.js`；同名异 ID/变体、切筛选、拖动取消、换宠物与返回后草稿连续性

### P2：步骤文案与位置还可以收敛

- 文件：`game.run.class-choice.page.js:34,80–81,119–120` 与 `game.hub.depart.js:204–206`
- 具体改法：选人确认“下一步：选择卡牌”可统一成“下一步：出征整备”，与 03 整备/页面标题一致；两页保持同一页头基线、步骤条位置、返回和主行动位置。只修文案与布局，不新增一步确认
- 验证：上面的选人确认、异步入口和整备流程专测，另查键盘焦点与 Esc 的返回目标

### P2：入城场景中的细字仍需后续单独看

- 14 的叙事区与选项均靠底部，画面完整但正文与选项说明较小。`entry-events.css:77–93` 的通用 event-themed 叙事 18、选项说明 15 在当前窗口约 11.14/9.28 显示像素
- 若继续修，只对入城 `.event-themed.sc-entry` 变体处理，不在本轮顺手改全部事件、火堆、物资。先确认长规则可在当前窗口一屏读完，操作块始终可见，叙事与选项不重复写同一段规则

### 地图：当前截图不足以判定“路线太暗”是 bug

- 13 的下一节点变暗与未领取补给的通行闸门一致，不能看到暗节点就恢复全部高亮或绕过闸门。当前入口头像和青色定位已经明确
- 可交地图属地后续评估的最小项：未领完时在当前入口/已有预览区显示“待领职业补给 N 张”及当前行动，避免靠日志解释；位置依据现有 `expedition.view.js:158` 的入城状态分支，不新造引导资源或改可达性
- 需结合领取前→领一张→领完→确认回图的连续截图和 `map-travel-path.test.js` 再判断，不以单张 13 决定整图返工

## 本轮验证与待实页清单

- 定向第一组：5 文件 62/62，通过；详见 [targeted-tests.json](targeted-tests.json)
- 相邻/契约第二组：5 文件 75/75，通过；详见 [adjacent-tests.json](adjacent-tests.json)。两组文件不重叠，共 10 文件 137 项；不表示全库通过
- 定向 ESLint：`game.run.altar.js`、扩展的 SYS03 专测、新 CSS 专测通过；`git diff --check` 通过
- PostCSS 解析由新专测实际执行通过；文档守卫通过，见 [docs-check.json](docs-check.json)，该守卫按现行规则不扫描 evidence 正文
- 没有运行 `npm test` 全库、build、浏览器、服务操作、git stage/commit/push；本轮修改不是已冻结 index 的门禁回执

主协调在既有 5300 统一补验：

1. 入口文案与规则一致，查看前不发卡；两张初始显示宽度一致、左靠排列、卡面按钮可打开大卡
2. 正常收一张后对应条消失，剩余条不改宽、不拉满高度，进度变 1/2，无继续按钮
3. 满包时收下不发卡、不消耗奖励，页内反馈可见；整理背包→返回后可继续领取
4. 最后一张领取后显示 2/2 和勾选/继续探索，确认回地图后才能前进；重复点击、刷新不重领
5. 当前窗口读取计算样式/矩形，核对主要提示显示至少 13px、收下/整理/继续按钮显示至少 36px 高；检查页脚、进度与两张卡没有重叠和不必要横向滚动
6. 普通宝箱/战后奖励仍走既有独立离开区与规则，不出现入城状态锚点；大卡长规则在放大层可读

当前主协调已关闭服务 HMR，源代码完成不代表 5300 已同步本轮字节。后续报告应以主协调同步后的实页和新截图为准。
