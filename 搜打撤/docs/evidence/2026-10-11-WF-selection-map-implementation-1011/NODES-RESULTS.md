# 节点与结果切片

状态：P1骨架已实现，P2当前窗口样板由根代理复核；未宣称实页通过。

## 已实现与来源

- F11：奖励内容与操作区分离，滚动只作用于 `.loot-scroll`；主动作位于独立 `.loot-actions`。战斗横图降为90px，已开宝箱重复图隐藏。卡牌角标改为“估值”，避免与本次金币混读。依据 E1-A01/A14/A16、R08、G1。
- F12候选：卡面原生按钮只查看，购买另设原生按钮；显示持有同名卡数、价格与金币不足状态。神秘货箱查看只解释规则，随机卡仍在购买后揭晓；保留原购买结算、容量判断、金币/货位更新和购买演出。依据 E1-A15、R02、G1。真实操作改善待根窗口样板判断。
- F09：节点壳无含义 FIELD ENCOUNTER 01/04 改为当前区域名与实际层数。依据 E1-A16、R08/G1。已核对现有过场修改并保留。
- F16局部：逐张收取不再调用 `showOverlay` 重播胜利外壳，保留滚动与键盘焦点；延迟揭晓音效检查宝箱代次、对象与已收状态，避免快速离开后误作用下一面板。依据 E1-A14、G3/G4/G7。

## 路径归属

本切片：`game/src/run/chests.js`、`game/src/run/game.run.shop.js`、`game/src/run/game.run.scenes.js`仅nodeShell行、`game/css/expedition-rewards.css`仅新增奖励骨架、`game/css/expedition-shop.css`仅新增查看/购买控件、`tests/sys03-loot-shop-txn.test.js`仅对应回归。

已有他人 game.run.scenes.js 过场改动保留。本切片未改人物、整备、地图、战斗播放器或卡牌数值，没有新素材、服务、build、提交。

## 本轮验证

- `test:target` 六文件57项通过：sys03-loot-shop-txn、chest-click-flow、r7a-scenes-integration、run-architecture、contracts、architecture-boundaries。
- 另 shop-sell-stored-guard 与首轮四文件50项通过。
- 目标JS/测试ESLint通过；两个目标CSS使用PostCSS解析通过。
- 新增普通查看不消费与神秘货箱查看不揭晓两项；既有逐张收取测试追加无整层重播、滚动及焦点保持断言。
- 迭代中一次定向测试因本切片模板字符串替换匹配到搜索页而语法失败，已准确定位并修正；修正后六文件57项通过。失败未作为通过证据。

## 实页与缺口

Codex子代理可发现内置浏览器，`visible:true` 返回 `IAB visibility is not supported in a subagent thread`；`visible:false`连接5200首页成功。根代理承担当前可见窗口真实流程及截图，本切片不以隐藏页替代实页。

F10由roster代理统一修改altar/openFireRest并以sdt:expedition-feedback临时事件提交实际生命差/复原结果；节点切片新增满血、复原和重入回归。F11已获根明确授权在game.bag.settle.js的既有真实结算处分组记名，未改变业务操作。F09祭坛/叙事/闸门与F12的当前窗口滚动/查看/购买/退出仍待真实样板覆盖。
## 后续实际结算与跨切片验证

- 根已批准 `game/src/hub/game.bag.settle.js` 的展示采样。`cardOutcome` 只存在 `bindBagMixins` 闭包内的 WeakMap settlement；首次new阶段采样已移除/入口袋/剩余的真实卡名，重试跳过采样。createAttempt仍只显式接收slotId/node/afterRun/elapsedDelta/victoryProgress，未传展示字段；game也没有展示字段。奖励折叠行先显示三组数量，按需展开真实卡名，新增战利品仍由原卡牌与金币行展示。
- F09闸门文案由roster统一写altar，使用“层间闸门”，reverse分支显示返回已探索区域，正向显示深入下一层。此切片不直接写同文件。
- 新增 `tests/full-review-regressions-world.test.js` 一项验证：满血实际回复0、实际复原一张，存档无nodeFeedback字段，真实重入不重复反馈。
- 新增 `tests/battle-settlement-retry.test.js` 一项验证：过场失败后重试，普通卡入口袋/职业卡消散/未用卡保留各一次，重复结束不重复开宝箱，展示字段不进入game/afterRun/attempt。
- 最终六文件91项通过：battle-settlement-retry、battle-settlement-recovery、sys03-loot-shop-txn、full-review-regressions-world、contracts、architecture-boundaries。七文件72项的火堆/商店/收取测试亦通过。
- 最终七个目标JS/测试ESLint及目标diff-check通过。CSS最终新增结算折叠行后尚待根当前窗口复核。重试测试故意构造的transition/write/journal错误日志为预期路径，测试通过；新增测试首次因跨测试spy历史累计而断言失败，改为本次调用差值后通过，未改游戏实现逃避失败。
- 额外归属：game/src/hub/game.bag.settle.js仅展示采样与battleSummary；tests/full-review-regressions-world.test.js仅新增火堆事件回归；tests/battle-settlement-retry.test.js仅新增展示采样回归。