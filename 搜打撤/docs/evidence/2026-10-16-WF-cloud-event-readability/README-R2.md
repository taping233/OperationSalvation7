# 非themed节点阅读层 R2

2026-10-15 UTC。R2源码和定向验证已完成，11文件122项通过；当前窗口视觉与输入交给主协调统一验收。只在原有 `game/css/entry-events.css` 非themed共用段追加增量，并扩展 `tests/event-scene-readability.test.js`；R1和其他会话的已完成改动保留。

## 实际查看与修正

本轮实际用图片查看工具看过[污染祭坛修改前33](../2026-10-16-WF-cloud-play-eight-hours/screenshots/33-altar-before.png)，前轮也已看过[层间闸门修改前26](../2026-10-16-WF-cloud-play-eight-hours/screenshots/26-layer-gate-before.png)。33里四个长选项反复叠同级暗带，正文与后果在1188窗口偏细；碎片兑换的容量限制、弃牌奖励、每座祭坛限次均是需要保留的有效规则。

- 右侧改成内容高度的单一局部暗底，使用与R1一致的冷暗底色和细青色左缘；普通选项不再逐条铺厚底，以细线分隔
- 正文、选项后果、裸通知与结算嵌套提示统一22逻辑像素；场景/选项标题26，操作及页脚按钮至少60高
- `ok`选项标题使用明底深字；普通/离开与整理背包使用暗底浅字；禁用原因继续完整显示，不靠降低整行透明度隐藏内容
- 四选项组间距从22降至14。标题与说明按可用宽度换行，无单行省略或固定说明高度；主区 `min-height:0; overflow:auto`，页脚不参与收缩并允许按钮换行
- 左侧叙事补与R1协调的局部暗底；不改变场景图、两栏比例或玩法步骤

没有删改说明、消耗条件、容量提示或玩法JS。非themed共用壳也包含现有安全/战前介绍/撤离结果等消费者，本轮不触及实际战斗舞台、基地、背包和入城补给条列；没有扩展到其他CSS文件。

## 定向验证

完整命令输出：[r2-targeted-tests.log](r2-targeted-tests.log)。本轮执行：

`npx vitest run tests/event-scene-readability.test.js tests/event-scene-selection.test.js tests/event-callback-lifecycle-audit.test.js tests/sys03-altar-restore-txn.test.js tests/node-flow-confirmation.test.js tests/entry-supply-presentation.test.js tests/extraction-flow.test.js tests/extraction-preview.test.js tests/exp003-extraction-pocket-copy.test.js tests/contracts.test.js tests/architecture-boundaries.test.js --reporter=dot`

- 11文件122项通过，包含原有R1与其他已完成改动的现行测试
- 阅读层专测新增5项：非themed字号、长内容限高/滚动/固定页脚、祭坛四项完整规则、长目的地闸门、紧急撤离不足条件和长结算
- 祭坛fixture保留“3张激活”“2枚碎片”“放不下不扣碎片”“16/16格”“道具1张复原2张”“每处一次”等完整文本；闸门保留整理/返回当前层；撤离保留不足条件和不带回随身币提醒
- 既有祭坛事务、闸门旧回调、紧急撤离取消/确认、带出预估/提示、入城专属边界及contracts/architecture哨兵通过
- 新专测ESLint、PostCSS解析及 `git diff --check` 通过；没有全库测试、build、浏览器/服务操作、暂存/提交/推送

这些测试证明CSS和DOM约束，jsdom不计算真实排版，不能单凭通过就称“四选项绝无溢出”。输入指纹见[r2-verification-summary.json](r2-verification-summary.json)。

## 主协调当前窗口待核

1. 5300载入新CSS后，在祭坛四项全部可用与部分禁用两态看长标题/说明：首末选项、容量提示、整理背包不重叠；超长内容可滚动，页脚始终可达，晶体与主体场景仍可见
2. 祭坛选择仍按原调用直接进入对应献祭/奖励步骤，没有新增事件确认；整理背包返回后状态连续，不提前扣牌或碎片
3. 层间闸门的进入与整理/返回主次清晰，长目的地正常换行；返回当前层不换层
4. 紧急撤离卡不足时原因可读，继续深入可用；满足条件仍进入原献祭确认，取消不扣牌；长结算页两行动可达
5. 检查R1火堆/普通事件未退化；此轮不把其他非themed消费者或多尺寸视为已实测
