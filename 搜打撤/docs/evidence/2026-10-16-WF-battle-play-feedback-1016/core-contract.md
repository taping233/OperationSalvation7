# 出牌可用性与提交回执合同

2026-10-16，本分工只实现出牌核心接收/结果链。根会话负责 `battle.aim.js` 的拒绝归位与回执消费，其他分工负责卡牌阅读焦点。规则数值、装备上限、费用、支付及选择流程沿现有实现。

## 新公开接口

`commands.getCardPlayAvailability(uid, side?, forceDirect = false)` 是只读查询，无日志、动作入队、选择状态写入或 receipt 分配。它复用核心当前手牌/输入/回合收尾/规则/可用性/费用/装备检查，以及执行入口的转换、注能门和手牌支付检查。返回：

- `{ status:'ready', uid, battleToken }`：核心可以接收该命令；不表示牌已施放，命令仍可能进入选择页。
- `{ status:'rejected', uid, battleToken, reason:{ code, message } }`。

`commands.submitCardPlay(uid, side?, forceDirect = false)` 重新核对最新状态后提交，返回以下一种：

- `rejected`：与可用性查询相同形状，源牌没有进入本次执行队列。
- `{ status:'needs-input', kind:'target'|'infusion'|'payment', uid, battleToken }`：核心已建立原目标、注能或手牌支付状态，原界面接管。这个结果不带悬挂 Promise；视图不能据此调用 `cancelPendingTarget`。
- `{ status:'queued', uid, battleToken, receipt, settled }`。`receipt = { battleToken, actionSeq, uid }`，沿原执行入口的场次及动作序号生成。`settled` 是只兑现一次、不会以 rejection 方式抛给调用方的 Promise。

`settled` 返回：

- `{ status:'committed', uid, battleToken, receipt }`：源牌已经按原规则扣费并移出当前手牌。这是提交事实，不等待整段效果/动画/发现流程结束。
- `{ status:'rejected', uid, battleToken, receipt, reason:{code,message} }`：入队后、源牌提交前拒绝，例如转换、规则、注能材料、能量或支付失效。
- `{ status:'cancelled', uid, battleToken, receipt, reason:{code,message} }`：动作取消或场次/准备阶段被替换。

所有结构化结果及 reason/receipt 冻结。异步结果始终携带当次场次、UID 和 receipt；同名卡、同 UID 的后续使用不能凭 UID 单独接收旧结果。

## 兼容及结果时点

- 原 `commands.playCard` 仍沿旧 `undefined` / unsupported-rule `false` 返回语义。内部自动释放、选牌和注能完成的既有调用仍走原 `queueCardExecution`；没有把原 `false` 统一解释为失败。
- 原支付候选、能量检查顺序、装备容量计算、目标选择与资源写入顺序保留。可用性和实际提交共用核心检查，没有在视图复制装备上限或卡牌数值。
- 执行前创建结构化 `queued` 结果，随后沿原动作队列执行。队列可能同步推进，所以视图须先建立本地 pending pose ticket、脱开 active pointer，再调用提交；不要用 active aim 等待 `settled`，以免阻挡 stage-ready 或选择页呈现。
- `committed` 在源牌扣费及 `removeUid(hand, uid)` 后发布。之后的击杀终局、效果异常、取消或旧执行返回 `false` 都不能改写该提交事实。
- 队列取消/准备失败沿新增的可选 `queueBattleAction` 第三个错误观察参数报告；该调度器和所有旧调用的返回语义保持原样。
- 仅支付前拒绝回到源牌的呈现目标，不为视图回执新增资源退款或改写原支付效果。多段效果后的胜利 `false` 不会被错判为未提交。

## 实现路径

- `game/src/battle/core/battle.engine.js`：共享同步检查、只读 availability、结构化 submit、旧 play 兼容。
- `game/src/battle/core/battle.core.js`：公开 commands 增加两个接口。
- `game/src/battle/core/battle.exec-play.js`：执行预检、payment needs-input、排队 tracker、支付前拒绝与实际提交点。
- `game/src/battle/runtime/battle.action-runner.js`：可选错误观察回调，覆盖排队取消与舞台准备取消。
- `game/src/battle/battle.play-submission.types.d.ts`：查询、提交、receipt 和异步结果类型。

人工逐分支阅读了同步拒绝、注能/目标/支付接管、正常入队、等待准备时取消、入队后拒绝、源牌已提交后胜利/abort、旧调用返回及手牌支付恢复链。本阶段未运行测试、lint、类型/语法检查、build 或浏览器；最后由根统一验证，当前不宣称运行验收通过。
