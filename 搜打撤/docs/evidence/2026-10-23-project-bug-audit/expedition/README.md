# 远征、房间事件、商店与奖励审查

2026-10-23；只读业务审查，未改源码、未 build、未提交。已与当日 `backend-audit`（含 phase2）及 PENDING 对照；下面六项不在这两处已有问题清单中。本报告称“新发现”仅指本次对照范围，未声称项目历史从未记录。

确认 6 项 P2，其中 2 项是正常商店操作即可触发，2 项需要异步保存期间换页，2 项需要授予/承接端口失败。常规回归 19 文件、288 测试通过；另有 7 个独立缺陷证明用例通过。证明用例断言当前错误现象，绿色代表复现成功，不代表缺陷已修。

## E4 · P2 · 神秘货箱绕过当前职业牌随机池禁令

- 位置：`game/src/run/game.run.shop.js:109`、`:152-155`。
- 最小复现：用真实 `Cards.ensureStarters/ensureSha/ensureTabletop/ensureDmgTypes/ensureEffectFields` 产生 fresh 卡库；使用真实 `SeededRandomService(24)`，首次打开有名称的商店，再购买最后的神秘货箱。独立证明：`shop-pools.audit.test.js` 第一个用例。
- 实际：神秘货箱是职业装备 `tt7-darkfort`「黑暗吊坠」，支付 3 币后进入背包。
- 期望：遵循 `cards.rules.js:248-257`，职业稀有度及任何带 cls 的牌均不应进入一般随机获取池。
- 原因：普通货位的正常抽取用 `Cards.pickOfRarity`，但共享 fallback / 神秘货箱直接从只排除了“衍生、unrandom、通行证A”的 lib 中取牌，漏掉 cls、职业、能力卡、生物和棱彩判定。
- 真实 fresh 卡库中有 8 项通过该 lib 条件却被 `isRandomObtainable` 拒绝，包括黑暗吊坠、奥术残卷、法力补给、充能火山、天国之门等。初始攻击另有商店历史注释例外，故不以它作为本条定性案例。
- 建议修复：fallback 和 mystery 共用当前随机准入规则；固定初始攻击/饮料货位仍走各自显式固定供给规则。

## E5 · P2 · 神秘货箱开出阿猫的礼物时漏发附赠卡

- 位置：`game/src/run/shop-commands.js:30-44`，调用入口 `game.run.shop.js:667`。
- 最小复现：货架最后一格为 `{ card:tt2-apollo, mystery:true, price:3, sold:false }`，金币和容量足够，点击购买。
- 实际：扣 3 币、货位售出、只增加阿猫的礼物 1 张；`game.grantCard` 未被调用，未保存任何附赠待领。
- 期望：神秘货箱明示随机获得卡牌，随机获得阿猫时应再随机获得 1 张卡。现行 `cards.sync.m7.js:39-42` 记录 onAcquire；地图入口 `game.run.scenes.js:545-555` 也明确实现附赠。
- 原因：购买直接 `createCardInstance` + `owned.push`，没有执行随机获取的附赠逻辑。普通明牌购买是否触发不在本条结论范围。
- 建议修复：神秘货箱的随机获取完成后，按同次交易持久化主卡与附赠；容量不足的附赠按现有待领奖励协议保留。

## E1 · P2 · 入城补给的迟到保存覆盖新对局/标题页

- 位置：`game/src/run/game.run.altar.js:181`、`:223-229`。
- 最小复现有两条：① `openEntrySupply()` 的首次保存挂起；②打开补给后点击收下，使领取保存挂起。挂起期间切换新 run / 标题，替换 `entrySupply`、`discoveredPairs` 并显示新页面，然后完成旧保存 Promise。
- 实际：两条路径都会再次调用旧 `showResult()`，移除新页面并显示旧补给；`game.state` 仍可以是 title，新补给的 taken 也未改变，因此用户看到的是无法操作的旧奖励页。
- 期望：旧保存完成只能更新自己仍拥有的同次 run、同个补给、同个页面；失去所有权后停止渲染。
- 原因：`isCurrent()` 只用于后续按钮，两个 await 之后和底部 `showResult()` 之前均未检查。独立证明覆盖首次打开与领取两个分支。

## E2 · P2 · 营火保存完成后抢回已被其他页面接管的弹层

- 位置：`game/src/run/game.run.altar.js:75-76`、`:157-164`；离开分支也用同一 currentFire 判定（`:81-85`）。
- 最小复现：打开营火，点击回复生命，保存返回待完成 Promise；同局、同坐标、modal 状态下将弹层换成另一个页面（如设置），再完成旧保存。
- 实际：旧营火的 `currentFire()` 仍为 true，继续 refresh/render，替换刚打开的新页。
- 期望：同局新页面接管后，旧营火只能保留已生效的回血事实，不能重新渲染营火。
- 原因：判定包含坐标、run token、档位、modal，但没有页面 surface / overlay revision。设置页入口 `ui/menu-settings.js:17-20` 也会使用 modal 状态，因此 modal 不能证明当前弹层属于营火。

## E3 · P2（条件性）· 祭坛奖励承接失败时待领标记已永久清除

- 位置：`game/src/run/game.run.altar.js:414-415`。
- 最小复现：祭坛已激活、`altarRewardPending=true`，让 `Chests.restore` 在接管前返回 false，然后点击“传说卡 + 装备卡”；关闭当前页面再重入祭坛。
- 实际：`altarRewardPending=false`、背包没有奖励、`nodeChestRewards` 也没有待领快照；重入进入“仪式已完成”分支，无法重试领取。
- 期望：承接拒绝且未生成待领奖励时保留 pending；只有确认奖励已经接管才释放原待领状态。
- 证据边界：这是对已声明可返回 false 的奖励恢复端口做故障注入；没有声称正常有效卡库中每次领取都会失败。`game.run.scenes.js:513-523` 返回承接结果，但此调用方忽略它。事件路径已通过 `settleEventCommand` 做类似失败保留，祭坛路径缺少这一层。

## E6 · P2（条件性）· 资源二选一在授予后的通知异常下可重复发卡

- 位置：`game/src/run/node-reward-state.js:111-112`，接入 `game.run.resources.js:45-46`；实际授予顺序在 `game.run.scenes.js:538-539`。
- 最小复现：打开资源二选一；让实际 `grantEventCard` 入包后的 `UI.log` 首次抛异常，领取第 0 张；恢复日志再点同一张。
- 实际：首次卡已进包，但 taken 仍为 null、resTake Promise 拒绝；再次领取使同一份候选增加第二张，之后 taken 才变为 0。
- 期望：已经授予的卡必须与 taken 一致，通知失败不能把已发事实重新开放。
- 原因：claimResourceReward 在 `receive` 完整返回后才写 taken，异常分支只释放 WeakSet，未核对是否已经入包。事件选择路径 `event-commands.js:27-34` 已有授予后异常识别，资源二选一尚未采用。
- 证据边界：本条依赖通知端口在实际入包后抛错，不是普通存储失败；没有把“授予前抛错且没有入包”的正常可重试情形误判为重复奖励。

## 验证与退出码

1. `node_modules/.bin/vitest.cmd run tests/event-settlement-unification.test.js tests/event-choice-recovery-cloud.test.js tests/event-choice-session-resume-cloud.test.js tests/event-callback-lifecycle-audit.test.js tests/shop-settlement-unification.test.js tests/shop-transaction-lifecycle.test.js tests/node-reward-state.test.js tests/narrative.test.js tests/r6-story-flow.repro.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot` → **0**，9 文件 / 179 测试通过，39.14 秒。
2. `node_modules/.bin/vitest.cmd run tests/map-generator-v4.test.js tests/map-route-v2.test.js tests/map-connectivity.test.js tests/map-travel-path.test.js tests/map-travel-motion.test.js tests/sys03-altar-restore-txn.test.js tests/altar-sacrifice-zones-cloud.test.js tests/reward-settlement-unification.test.js tests/fresh-run-map-encounters.test.js tests/r6-story.test.js --maxWorkers=1 --minWorkers=1 --reporter=dot` → **0**，10 文件 / 109 测试通过，52.89 秒。
3. `node_modules/.bin/vitest.cmd run --config docs/evidence/2026-10-23-project-bug-audit/expedition/vitest.audit.config.mjs --reporter=verbose` → **0**，2 文件 / 7 缺陷证明通过，10.85 秒。随后为避开“初始攻击”历史注释歧义，将 E4 收紧为实际职业牌、使用普通 seed=24，再定向运行 shop-pools 2 用例 → **0**，4.05 秒；其余 5 用例未修改。

首个独立测试尝试被项目默认 include 限制拒绝（No test files found，退出 1），随后使用本目录的隔离配置。用例调试阶段的失败来自额外 DOM 清空假设及常量 RNG 先被普通货位消耗，已修正夹具；不计作项目缺陷。

## 覆盖边界

- 定向阅读：event commands/runtime/lifecycle/card-choice、run event controller 各主要内置分支、资源二选一、shop commands/commission/browse/购买与售出动作、altar 的营火/补给/门/献祭/回赠/首脑/撤离入口、node reward/restore state、chest reward save/restore 与授予交接、story commands/last-lamp/narrative、地图移动路径和移动流程。
- 已跑地图生成 v4、路线 v2、连通性与 travel 的现行定向测试；没有穷举所有地图种子或逐分支证明生成器正确。PENDING #44 的布局软回退语义未重复上报为新 bug。
- 未跑全量测试、构建、浏览器实页、网络；没有修改业务代码、共享台账或他人工作树。未覆盖 battle/core/hub/持久化主要属地，也未把未读模块声称为无缺陷。
