# 复原与药摊返回链：只读定位

2026-10-12。按主控要求，完成 C/report.md 后定向读取当前源码。未修改游戏、未运行构建或测试。此页区分实页事实与源码推断；服务使用共享源码，源码定位不构成隔离版本的追溯保证。

## 祭坛手动复原

- `game/src/run/game.run.altar.js:666` 的 `altarRewardRestore` 先设 `altarRewardPending=false`，回复生命，然后 `UI.hideOverlay()`，在 672 行调用 `openPocketRestore(3, done, {tone:'altar'})`。`done` 才保存并 `finishInstant()`。这解释了为什么本次卡死后刷新仍保留回血与奖励已选，但无法重领未完成的三次复原。
- 共用选择页位于 `game/src/run/game.run.scenes.js:404`。409 行挂背包返回钩子；416 行卡片 `data-act="restoreOne"`，429 行继续按钮 `data-act="fireDone"`；433–447 行注册动作后，448 行才 `render()`。
- `restoreOne` 正常应查同名口袋卡、检查容量，再移回背包并扣次数；`fireDone` 正常应直接执行 finish。实页同时两种动作都无响应，且 12/16、有 7 张可复原，不能用满包或无候选解释。
- 同一共用页也被修鞋铺 `game.run.flow.js:841` 与祭坛献祭道具 `game.run.altar.js:605` 调用。旧 B 的修鞋铺线索与本次祭坛可以按同一手动选择页归类；其他调用点仅源码涉及，未全部实页复测。
- 动作分发是 `game/src/ui/ui.js:44` 从最近的 `data-act` 查 `_acts`；`hideOverlay` 在 `game/src/ui/overlay.js:202` 清空动作表。首次只读定位未定失联原因；后续沿 D 紧急撤离取消无效的同类证据补查，已定位到下文的动效包装器顺序问题。
- 共用页 `finish`（scenes.js:432）只 hide 与 done，未清 `setBagReturnHook`。这还可能留下一次已结束复原页的返回钩子；属于源码风险，C 没有在完成复原后复测这一支。

## 药摊领取后开关背包重现旧三选一

- `game/src/run/game.run.flow.js:619` 药摊调用共用 `openEventCardChoice`，传入固定三候选 args。
- 共用选牌页在 539 行登记 `setBagReturnHook(() => openEventCardChoice(args))`。
- 549 行 `picked=false` 是每次重新开页的新闭包；550–555 行仅用该局部变量防重复，成功后走 `closeEventFlow()`。
- `closeEventFlow`（509–514 行）hide、改 idle、save、refresh，**未清背包来源钩子**。
- `game/src/hub/game.bag.js:255` 关闭背包 `takeBagReturnHook()`，有钩子就执行；因此先前成功领取后遗留的钩子仍会重新开原 args，局部 picked 又回 false。这条代码路径与 D 实页重复领奖证据一致。
- 影响范围不仅药摊：同样调用 `openEventCardChoice` 的事件选牌奖励可能在成功结算后保留旧选择页。具体其他入口仍需各自复测；不把所有事件都判为已证实可重复领取。

## 最小后续核查建议

1. 手动复原页首次显示、每次重绘、关闭/开背包返回后，`restoreOne` 与 `fireDone` 都能执行，且页完成后旧钩子不再回到复原。
2. 事件选牌领取前开关背包保留原候选；领取成功后开关背包回地图，不重开候选、不再发奖。
3. 自动复原药水另走可用路径，不据手动页故障删除或改其规则。

## 击杀后诅咒／冻结转到存活敌人：D 线追加核对

主控提供 D 实页观察：三只甲壳变异体均 2/7；诅咒之刃造成 7 伤击杀第一只后，第一名存活者出现攻击 4→2、流血 1 与攻击降低 3 回合。旧 `D/10-frost-kill-status-transfer.png` 亦有击杀后冻结转移线索。本段仅只读当前源码，没有操纵 D 存档或再次运行复现。

**找到的是显式重选存活敌人，不是旧 idx 随数组删除而错指。**

- `game/src/cards/cards.sync.m3.js:75` 给诅咒之刃编排 damage 后 curse；78 行为 `{op:'curse', source:'handMoves', target:'chosenEnemy'}`，没有 `bindTarget:'prevDamage'`。
- `game/src/battle/core/battle.resolution.js:594` 明确先伤害后诅咒；913 行把原目标对象传给 `resolveCurseOperation`。
- `resolveCurseOperation` 的 129–139 行解析目标：原 `preferredTarget.dead` 后显式改取 `getAliveFoes()[0]`。135–136 行另有 `bindTarget:'prevDamage'` 分支，会过滤已死的原命中对象，不作该回退。
- 因此，在仍有其他敌人存活时，伤害击杀原目标后，诅咒之刃的附加诅咒会落给首名存活敌人。这条执行路径与 D 观察一致；证据不是仅凭截图猜测。
- `game/src/cards/cards.sync.js:951` 的霜月斩规则也是 damage 后两个 `chosenEnemy` curse（freeze、healban，952–953 行），没有绑定前段目标；冰刺等相同形态规则也有同类风险，其他牌未逐张实页复测。
- 文本兜底亦有同样行为：`effect-steps.js:85` 的 `curseTarget` 与 `effect-steps.curse.js:65` 的诅咒之刃分支，都在原对象已死时改取第一名存活者。不是只改某一个卡 ID 的索引就能完整覆盖。
- 多敌存活是关键条件；`battle.resolution.js:887` 终局守卫在敌人全灭时跳过后续效果。C 的最后一击首脑战不构成该问题的反例。

现行显示文案 `card-description-text.js:193`（诅咒之刃）和 28 行（霜月斩）均说“对目标附加”，没有说明击杀后重新选择存活者。可将其报告为 **P2 目标语义与实际重选不一致**；若产品明确决定采用击杀后的自动顺延，应同步牌面与目标反馈，若保持原目标语义则需要绑定同一卡的原命中对象。此审查没有替老板选择或修改玩法规则。

## 手动弹层动作失联：动效包装器清掉新页动作表

追加依据：D 第三层紧急撤离点点击献祭三牌后，`sacCancel` 取消与右上关闭均无效，证据见 D/20 图文；正常刷新续档恢复地图。本段没有重复跑局或执行浏览器状态脚本，仅核对现行初始化与同步调用顺序。

**当前源码存在确定的清表顺序问题：旧页关闭被延迟，新页在渲染前先注册的动作，会被渲染包装器补做旧页清理时清掉。**

1. 动效模块确实包装 UI 方法，而不是只有 CSS：`game.menu.js:8` 导入 settings-navigation，后者 4 行导入 settings-transition，后者 2 行导入 interface-motion。`interface-motion.js:200` 直接尝试 install，若 UI 尚未就绪则观察 DOM / DOMContentLoaded；64–78 行保存原方法并替换 `ui.showOverlay`，132 行替换 `ui.hideOverlay`。
2. 节点进入 `game.run.flow.js:137` 先 `UI.beginRoom()`；modal 中不会走 `hud.js:63` 的 idle 退出 room。包装器 `interface-motion.js:142–157` 在 room-view 且无 `.bt-settings/.bt-gy-list/.glass-panel`、未要求 immediate、未开启减少动态且没有原生关闭计时器时，挂 `pendingClose` 等待 140ms，不先调用原 hide。
3. D 的 `game.run.altar.js:828` 在 payExit 动作中调用 hide，再立即 `openBagSacrifice`。献祭页 765–779 行先注册 sacPick/sacCancel/sacConfirm，780 行才 render/showOverlay。
4. 新页 show 的动效包装器 `interface-motion.js:73–78` 发现 pendingClose，清计时器并调用保存的原 `hideOverlay({immediate:true})`。原 `overlay.js:202` 同步设 `_acts={}`，把上一步刚登记的新页动作一起清空。包装器 96 行再调用原 show，只重建 DOM；献祭页没有在 render 后重新登记动作。
5. C 的祭坛复原同链：altar.js:671 先 hide；scenes.js:433 与 447 注册 restoreOne/fireDone；448 render。首次 show 清掉注册表，于是卡片与继续按钮都看似可用而无处理函数。
6. 右上关闭没有独立绕过：`overlay.js:283–284` 找取消按钮并代点。sacCancel 同样已被清掉，所以 D 右上关闭无效与这条链一致。

这也解释了 C 为什么“献祭三牌可成功、回赠复原却卡住”：祭坛最初 `altarOn3`（altar.js:610–617）直接打开献祭页，没有先 hide 的这一步；后面的回赠复原却显式先 hide。不能把所有“先注册后 render”的页面一律判坏，触发条件是其间存在 pendingClose。

影响范围：已实证 C 祭坛手动复原与 D 紧急撤离献祭选择；手动复原返回背包链、其他先 hide 后打开同类手动页属于需要定向回归的源码风险。减少动态或同步 immediate 关闭分支不进入上述 pendingClose；本轮未实页切换这些偏好，不标复测通过。旧 B 修鞋铺使用共用复原页，但是否从同一关闭条件进入仍需对其原入口证据核对。

后续修复应保证旧页清理发生在新页动作注册之前，或让新页在实际完成 show 后登记本页动作；仅延长点击等待不能恢复已经被清掉的处理函数。这里只给定位与验收边界，没有改代码。
