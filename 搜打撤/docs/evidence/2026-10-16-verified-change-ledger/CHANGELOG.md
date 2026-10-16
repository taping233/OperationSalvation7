# 八小时云端改进：可核对改动总表

截至 2026-10-16 00:32 UTC，任务仍在进行。基线为 `f0e84c5dc34afcbc1176b1519258d2c3010c62cb`；本轮改动尚未暂存、提交或推送。本文只整理已有源码和证据，没有执行测试、构建、浏览器或生产修改。

## 先看结论

- 实际修复了事件/奖励刷新丢失、受保护卡献祭、胜场跨刷新丢失、重复战斗工具栏等问题；改善了战斗、背包、基地、指南、事件和珍珠盒等真实操作
- 巨兽额外传说、药摊二级选卡、黑市成功奖励及阿猫附赠已有自然刷新恢复证据；首脑不朽斩已由当前实页确认5伤且同UID回手，寻宝图主动也已真实成功
- 第三轮已完成12战全胜及7回合首脑击杀，正常终局并从设置导出JSON：胜场/次数、末10场回合数及23入库/16消耗回收/3损失/34散失相符；carried29/value84仍错误包含未最终入库卡，应为最终23/value77，暂未修
- 复杂边界仍需分开看：模块/存储集成通过不等于真实键盘、像素、堆内存或完整通关通过。每项下方写清覆盖和缺口
- 最新R7第二遍同参数普通全量已通过：492文件、4695通过、2既有skip、0 unhandled，exit 0。首遍4692过/3败原样保留，其中两项明确20秒超时，workflow返回status=null仅疑似负载，原配置定向78项也通过
- R7构建真实产物为119.595 MiB，entry gzip289.943 KiB、initial JS gzip335.356 KiB、全部CSS gzip196.730 KiB；原阈值112 MiB/270/310/136 KiB，四项仍红，不能称全部质量门通过。R7后摘要/预览141项、牌堆CSS48项、四源呈现142项分别定向通过，互不冒充同一完整覆盖；新牌堆CSS已载入服务但实页待下一战，最新呈现批实页待载

## 阅读和计数口径

按独立玩家问题或改进目标归并，同根因的R1/R2/R3返修只列一项。文件、规则、测试、图片数量只用于核对范围，不作为“修复数”；以下也不是一张“全是bug”的计数清单。

“实页”指本轮当前内置浏览器、当前窗口的真实鼠标/键盘及正常刷新读档；图片只证明外观，动作与数值以主PLAYLOG为准。CSS/DOM契约、jsdom合成输入、受控时钟和模块夹具均单独标注。路径从`搜打撤/`起，点击可定位源码或证据。

主时间线：[PLAYLOG](../2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)。R7终态已与本轮落盘报告核对；本文件不推定后续新结果。

## 代码与数据可靠性

### C01 · 同一地图事件退出或刷新后变成另一事件

**状态：实页已验证**

首次抽到的普通事件绑定当前节点；再进或读档使用同一事件ID。实际黑箱调拨刷新后保持标题、叙述和职业密封箱选项。

- 源码：[game/src/run/node-reward-state.js](../../../game/src/run/node-reward-state.js)；[game/src/run/game.run.flow.js](../../../game/src/run/game.run.flow.js)
- 证据：[docs/evidence/2026-10-16-run-lifecycle-audit/README.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/45-blackbox-refresh-retained.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/45-blackbox-refresh-retained.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：固定的是事件身份，不承诺每一种旧事件一级页的所有随机预览都已冻结。

### C02 · 药摊、装备征用的二级选卡丢失

**状态：部分实页已验证**

二级候选、已付费用和领取索引进入节点快照；普通选择成功收卡后才结束节点，支持整理背包、退出和正常读档。阿猫锁定后转独立待领奖的安全续流另见C04。自然药摊刷新后恢复相同三候选并成功领取。

- 源码：[game/src/run/event-card-choice.js](../../../game/src/run/event-card-choice.js)；[game/src/run/game.run.flow.js](../../../game/src/run/game.run.flow.js)；[game/src/run/node-reward-state.js](../../../game/src/run/node-reward-state.js)；[game/src/run/game.session.js](../../../game/src/run/game.session.js)；[game/src/run/game.session.kernel.js](../../../game/src/run/game.session.kernel.js)
- 证据：[docs/evidence/2026-10-16-run-lifecycle-audit/README.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/31-potion-full-bag-no-recovery-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/31-potion-full-bag-no-recovery-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/56-potion-choice-before-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/56-potion-choice-before-reload.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/57-potion-choice-restored-after-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/57-potion-choice-restored-after-reload.png)
- 边界：修后自然药摊现场并未满包；满包拒收、装备征用收费一次和跨局旧回调由模块回归覆盖，未全部实页复演。

### C03 · 黑市成功后满包奖品被吞

**状态：实页已验证**

命中的三张固定奖品进入现有待领奖控制器；满包或部分领取时可保留并刷新恢复，无需重新投币或重掷。自然黑市第三次投入成功后，两张已领、一张待领跨刷新保持。

- 源码：[game/src/run/game.run.flow.js](../../../game/src/run/game.run.flow.js)
- 证据：[docs/evidence/2026-10-16-run-lifecycle-audit/README.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/66-black-market-full-bag-pending.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/66-black-market-full-bag-pending.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/67-black-market-pending-after-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/67-black-market-pending-after-reload.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：费用、中奖率和第五次保底规则保持；后续卡牌放大入口单列为界面改进。

### C04 · 阿猫本体入包后附赠卡丢失

**状态：部分实页已验证**

本体与已掷定附赠分成可保存的待领项，三选一只放弃原候选；装备征用来源也接入相同待领流程。实际17/18格领取阿猫后，独立影噬待领跨刷新保持，最终同名叠放得到阿猫1、影噬2。

- 源码：[game/src/run/chests.js](../../../game/src/run/chests.js)；[game/src/run/chest-reward-save.js](../../../game/src/run/chest-reward-save.js)；[game/src/run/game.run.scenes.js](../../../game/src/run/game.run.scenes.js)；[game/src/run/event-card-choice.js](../../../game/src/run/event-card-choice.js)
- 证据：[docs/evidence/2026-10-16-reward-atomicity-audit/README.md](../../../docs/evidence/2026-10-16-reward-atomicity-audit/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/58-apollo-one-free-slot-before-claim.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/58-apollo-one-free-slot-before-claim.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/59-apollo-gift-independent-pending.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/59-apollo-gift-independent-pending.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/60-apollo-pending-restored-after-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/60-apollo-pending-restored-after-reload.png)
- 边界：本次附赠恰可同名叠放；无法叠放、保存失败重试及装备征用阿猫来源仍为模块/存储集成验证。

### C05 · 首脑、巨兽额外传说满包后没有待领记录

**状态：首脑及巨兽主路径实页已验证**

普通奖励后先保存已确定的额外传说，再进入固定待领；领取或明确放弃后才完成胜利事务。自然巨兽战后骷髅王剑满包保留，刷新同卡，再腾格领取。 第三轮首脑普通7项领完后独立传说斩杀满包待领，正常刷新仍同斩杀、无普通奖重发；使用恢复药水腾格后收妥。

- 源码：[game/src/hub/game.bag.settle.js](../../../game/src/hub/game.bag.settle.js)
- 证据：[docs/evidence/2026-10-16-extra-legend-rewards/README.md](../../../docs/evidence/2026-10-16-extra-legend-rewards/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/70-beast-extra-legend-full-pending.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/70-beast-extra-legend-full-pending.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/71-extra-legend-pending-after-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/71-extra-legend-pending-after-reload.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/72-extra-legend-claimed-after-space.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/72-extra-legend-claimed-after-space.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/85-boss-extra-legend-full-before-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/85-boss-extra-legend-full-before-reload.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/86-boss-extra-legend-after-reload.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/86-boss-extra-legend-after-reload.png)
- 边界：首脑保底与自然巨兽分支的满包待领/刷新续领均已实页闭环；保存失败恢复及延时旧关闭回调仍由真实存储/overlay测试覆盖。不会猜造旧历史丢卡补偿。

### C06 · 献祭会选到安全格或容器内的受保护卡

**状态：实页已验证**

祭坛与紧急撤离统一只列普通随身背包卡；每次重画和最终确认复核位置，跨区选项失效。紧急撤离实页安全钥匙不在候选；后续祭坛也排除安全珍珠盒、命运钟表及盒内钥匙。

- 源码：[game/src/run/game.run.altar.js](../../../game/src/run/game.run.altar.js)；[docs/rules.md](../../../docs/rules.md)
- 证据：[docs/evidence/2026-10-16-run-lifecycle-audit/aria-and-sacrifice-review.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/aria-and-sacrifice-review.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/50-emergency-sacrifice-candidates.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/50-emergency-sacrifice-candidates.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：这是本轮明确采用的保护规则；献祭张数、费用及受保护卡先主动移回的流程不变。

### C07 · 刷新后胜场丢失，终局最后一战计数顺序错误

**状态：实页已验证**

战斗计数和末场快照按runId随局保存，读档替换恢复；先记本场再广播终局，阻止重复finish。第二轮6场全胜经历多次正常刷新，成功撤离后UI导出fought6/won6，真实六场记录与游玩一致。 第三轮正式UI导出再核对12战/12胜、bossKilled=true及outcome=clear，终局记录存在。

- 源码：[game/src/agent/agent.battle-stats.js](../../../game/src/agent/agent.battle-stats.js)；[game/src/agent/agent.recorder.js](../../../game/src/agent/agent.recorder.js)；[game/src/run/game.session.js](../../../game/src/run/game.session.js)；[game/src/run/game.session.kernel.js](../../../game/src/run/game.session.kernel.js)；[game/src/battle/core/battle.lifecycle.js](../../../game/src/battle/core/battle.lifecycle.js)
- 证据：[docs/evidence/2026-10-16-run-lifecycle-audit/battle-stats-fix.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/battle-stats-fix.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-213829.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-213829.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json)
- 边界：首轮已丢胜场不补造。战斗次数、胜场与结算回执计数已核；另发现clear.carried及carriedValue包含未最终入库卡，仍未解决，不能说统计全字段准确。

### C08 · 多回合战斗记录始终写第1回合

**状态：实页终局导出已验证（末10场）**

终局record.round改读实际战斗turn，不再读从未推进的阶段机初值。第三轮从真实战斗到成功结算再经设置正常导出的JSON，lastBattles末10场round依次为1、2、2、1、1、1、3、3、3、7；巨兽3回合与首脑7回合均与实机日志匹配。

- 源码：[game/src/battle/core/battle.lifecycle.js](../../../game/src/battle/core/battle.lifecycle.js)
- 证据：[docs/evidence/2026-10-16-battle-round-record-audit/README.md](../../../docs/evidence/2026-10-16-battle-round-record-audit/README.md)；[docs/evidence/2026-10-16-battle-round-record-audit/final-targeted-test.log](../../../docs/evidence/2026-10-16-battle-round-record-audit/final-targeted-test.log)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/55-round-three-before-victory.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/55-round-three-before-victory.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/88-run3-terminal-success-summary.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/88-run3-terminal-success-summary.png)
- 边界：导出只保留末10场，本次不声称第一场3回合已获该导出覆盖。模块仍覆盖普通/额外回合、死亡、撤退及重开边界，历史行不改写；不由round正确推定其他统计字段正确。

### C09 · 寻宝图主动空耗次数却不抽牌

**状态：实页已验证**

装备主动在共用合成边界转成合法规则，结算成功后才耗次数；异常保留次数并提示。四张正式结构化主动装备的合成契约均已检查。 第三轮首脑第2回合0费装备寻宝图后，主动真实洗入搜索大宝箱、抽到邪能护体，按钮变本场已使用；牌库14保持与先加1再抽1相符。

- 源码：[game/src/battle/bag/battle.equipment.js](../../../game/src/battle/bag/battle.equipment.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-battle-card-effects/README.md](../../../docs/evidence/2026-10-16-WF-cloud-battle-card-effects/README.md)；[docs/evidence/2026-10-16-WF-cloud-battle-card-effects/verification.json](../../../docs/evidence/2026-10-16-WF-cloud-battle-card-effects/verification.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：修后自然首脑主动成功已闭环；其他主动合成合法性与异常次数保留仍由模块验证。同名牌叠堆可能不新增卡面，不能只看分组数判断。

### C10 · 未变形的不变应万变原卡可空耗1费

**状态：模块通过，实页待验**

统一不可用判定拒绝未变形原卡，明确提示先打出武术；普通战与首脑战均验证拒绝不扣费、不移牌，满足前置后正常变形打出。

- 源码：[game/src/battle/effects/battle.target-rules.js](../../../game/src/battle/effects/battle.target-rules.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-battle-card-effects/README.md](../../../docs/evidence/2026-10-16-WF-cloud-battle-card-effects/README.md)；[docs/evidence/2026-10-16-run-lifecycle-audit/r2-integration-fixes.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/r2-integration-fixes.md)
- 边界：保留“在手后响应新武术”机制，没有新增抽入时追溯上一回合的规则；修后自然卡牌实页仍待遇到。

### C11 · 伤害预览漏算却标成精确

**状态：部分实页已验证**

完整扫描伤害流程并收紧支持范围；动态注能、多独立伤害和未建模命中修正显示无法精算。奥术弹普通战显示直接伤害及抽牌替代说明，实页预览1与目标6→5一致；充能射线实页明确无法精算。

- 源码：[game/src/battle/view/battle.preview.js](../../../game/src/battle/view/battle.preview.js)；[game/src/battle/core/battle.core.js](../../../game/src/battle/core/battle.core.js)；[game/src/battle/view/battle.hover.js](../../../game/src/battle/view/battle.hover.js)；[game/src/battle/battle.snapshot.types.d.ts](../../../game/src/battle/battle.snapshot.types.d.ts)
- 证据：[docs/evidence/2026-10-16-damage-preview-audit/IMPLEMENTATION.md](../../../docs/evidence/2026-10-16-damage-preview-audit/IMPLEMENTATION.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/63-arcane-bolt-direct-preview-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/63-arcane-bolt-direct-preview-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/65-charge-ray-preview-honest-boundary.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/65-charge-ray-preview-honest-boundary.png)
- 边界：未扩写这些卡的真实结算，也未实现全卡预演；爆燃火球、暗影射击及复杂修正的安全降级由模块对照覆盖。

### C12 · 骷髅王剑变形卡显示、支付和内部释放不一致

**状态：部分实页已验证**

卡面、规则、ARIA、拖拽、牌区与执行统一查当前有效卡；内部免费释放、抽到即放和支付前再次核验，保留同UID回手。补齐变形后的禁注能、缺模板拒绝及实际费用守卫。首脑实页已确认不朽斩5伤、同UID回手。 实际牌库内部列表也显示不朽斩；按钮摘要旧名在R7后追加两行小补，独立141项通过，现已随服务载入，新的按钮摘要实页待下一战。 第三轮首脑已重复打出同UID不朽斩并回手；实际禁注能候选灰态、选择数0/2且未绕过。挖宝牌库底发现的候选有效脸、owned/临时来源与本场临时副本说明已纳四源142项呈现补修，尚待载入。

- 源码：[game/src/battle/effects/battle.card-inspection.js](../../../game/src/battle/effects/battle.card-inspection.js)；[game/src/battle/core/battle.exec-play.js](../../../game/src/battle/core/battle.exec-play.js)；[game/src/battle/core/battle.draw.js](../../../game/src/battle/core/battle.draw.js)；[game/src/battle/core/battle.enemy-phase.js](../../../game/src/battle/core/battle.enemy-phase.js)；[game/src/battle/core/battle.engine.js](../../../game/src/battle/core/battle.engine.js)；[game/src/battle/view/battle.view.js](../../../game/src/battle/view/battle.view.js)；[game/src/battle/view/battle.layers.js](../../../game/src/battle/view/battle.layers.js)；[game/src/cards/card-battle-start-explanation.js](../../../game/src/cards/card-battle-start-explanation.js)；[game/src/battle/core/battle.core.js](../../../game/src/battle/core/battle.core.js)；[game/src/battle/view/battle.preview.js](../../../game/src/battle/view/battle.preview.js)；[game/src/battle/view/battle.piles.view.js](../../../game/src/battle/view/battle.piles.view.js)
- 证据：[docs/evidence/2026-10-16-skull-sword-start-audit/REPAIR.md](../../../docs/evidence/2026-10-16-skull-sword-start-audit/REPAIR.md)；[docs/evidence/2026-10-16-skull-sword-start-audit/internal-release-r2/README.md](../../../docs/evidence/2026-10-16-skull-sword-start-audit/internal-release-r2/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/80-boss-immortal-hand-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/80-boss-immortal-hand-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)；[docs/evidence/2026-10-16-skull-sword-start-audit/pile-summary-r3/README.md](../../../docs/evidence/2026-10-16-skull-sword-start-audit/pile-summary-r3/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/81-boss-effective-deck-details.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/81-boss-effective-deck-details.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/82-boss-immortal-infusion-disabled.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/82-boss-immortal-infusion-disabled.png)；[docs/evidence/2026-10-16-WF-verified-ui-copy/README.md](../../../docs/evidence/2026-10-16-WF-verified-ui-copy/README.md)
- 边界：普通战不自动启开战装备是既有规则。主要补丁纳R7第二遍full；摘要/预览两行小补仅141项定向。后续牌库CSS已服务载入，实际新大牌库待下一战；发现有效脸/来源142项呈现补修实页待载。内部剑荡、灰烬9手、极速欠费等复杂边界仍为模块验证。

### C13 · 基地奖励缺模板时仍消费领取资格

**状态：模块通过，实页待验**

指定奖励卡/宠物蛋缺失或两种独立传说不足时，整份奖励准备失败，资源与资格均不提交；恢复卡库后可正常领一次。

- 源码：[game/src/hub/meta.js](../../../game/src/hub/meta.js)
- 证据：[docs/evidence/2026-10-16-reward-atomicity-audit/README.md](../../../docs/evidence/2026-10-16-reward-atomicity-audit/README.md)；[docs/evidence/2026-10-16-reward-atomicity-audit/fix-target-tests.txt](../../../docs/evidence/2026-10-16-reward-atomicity-audit/fix-target-tests.txt)
- 边界：使用真实Cards/Base/Meta隔离存储复现；异常卡库不是正常玩家实页已自然遇到的故障。

### C14 · 旧坏档把领取字典存成数组等类型导致重复领奖

**状态：模块通过，兼容边界**

收藏、领取、经验、卡背逐字段校验字典类型，坏字段回落各自默认并告警，其他有效库存/资源/统计保留；只读预览不改原档。

- 源码：[game/src/hub/base-state.js](../../../game/src/hub/base-state.js)
- 证据：[docs/evidence/2026-10-16-reward-atomicity-audit/README.md](../../../docs/evidence/2026-10-16-reward-atomicity-audit/README.md)；[docs/evidence/2026-10-16-reward-atomicity-audit/reproduction.json](../../../docs/evidence/2026-10-16-reward-atomicity-audit/reproduction.json)
- 边界：旧collClaimed=[]由异常输入构造，没有正常新档自然产生该数组的证据；不猜数组索引到稳定卡ID的映射。

### C15 · 神灯抉择或发现返回后出现两套职业/分页工具栏

**状态：实页已验证**

重建舞台时明确用新HUD模板替换常驻玩家上的旧工具栏，普通局部更新保留一份绑定。自然发现选择黑暗吊坠返回后，仅#btSelf一组工具栏，后续药水和出牌正常。

- 源码：[game/src/battle/view/battle.layers.js](../../../game/src/battle/view/battle.layers.js)
- 证据：[docs/evidence/2026-10-16-battle-tools-duplication/README.md](../../../docs/evidence/2026-10-16-battle-tools-duplication/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/61-battle-tools-duplicated-after-choice.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/61-battle-tools-duplicated-after-choice.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/62-battle-tools-single-after-discover.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/62-battle-tools-single-after-discover.png)
- 边界：旧故障已由实际DOM确认，并非AX缓存；修复没有靠CSS隐藏或禁用动作绕过。

### C16 · 慢启动完成后仍残留加载失败条

**状态：模块通过，快路径实页已验证**

12秒改为耗时较长并继续唯一就绪检查；真正就绪撤条停表，真实SCRIPT/LINK错误保留明确失败，收起和离页释放监听。修后正常刷新读档未再出现慢失败条。

- 源码：[game/index.html](../../../game/index.html)
- 证据：[docs/evidence/2026-10-16-late-startup-guard/README.md](../../../docs/evidence/2026-10-16-late-startup-guard/README.md)；[docs/evidence/2026-10-16-late-startup-guard/focused-test.log](../../../docs/evidence/2026-10-16-late-startup-guard/focused-test.log)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：超过12秒晚ready由真实内联guard+可控时钟测试，未在实页人为拖慢或制造404；不把普通快速刷新当晚启动分支已实测。

### C17 · 奖励容量预估和整理后提示与真实收卡不一致

**状态：代表容量及notice回流实页已验证**

共享纯容量规则按真实批量顺序逐张投影，正确处理叠放上限、安全格/盒内卡排除、资源专用格及新珍珠盒扩容。整理返回只读更新旧容量失败文字；实际grant拒收优先保留，只有同箱整理后容量状态确实变化才校准。 首脑普通保险柜7项显示预估可收6、剩1，实际批量6后通行证B保留；珍珠盒存铜币腾格回原领奖页时旧“1张放不下”已清除，仅保留“已入背包6张”，随后收B成功。

- 源码：[game/src/core/card-capacity.js](../../../game/src/core/card-capacity.js)；[game/src/run/chests.js](../../../game/src/run/chests.js)；[game/src/run/game.session.js](../../../game/src/run/game.session.js)；[game/src/run/game.session.bag.js](../../../game/src/run/game.session.bag.js)
- 证据：[docs/evidence/2026-10-16-reward-capacity-preview/README.md](../../../docs/evidence/2026-10-16-reward-capacity-preview/README.md)；[docs/evidence/2026-10-16-reward-capacity-notice/README.md](../../../docs/evidence/2026-10-16-reward-capacity-notice/README.md)；[docs/evidence/2026-10-16-reward-capacity-notice-r6/README.md](../../../docs/evidence/2026-10-16-reward-capacity-notice-r6/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/68-capacity-notice-stale-after-space.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/68-capacity-notice-stale-after-space.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R7-verification/REPORT.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R7-verification/REPORT.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/84-reward-notice-after-pearl-storage.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/84-reward-notice-after-pearl-storage.png)
- 边界：顶部顺序容量与整理后notice已有代表实页闭环；1215组规则对照、实际grant拒收反馈优先及原SYS03边界仍为模块验证。三个迭代合并一项，不另算三次修复。

## 界面与交互

### U01 · 基地跨房间阅读与当前位置提示

**状态：实页已验证**

提高公共正文/标签字号和深色阅读底；修复后勤亮窗透字、人物hover对比与招式浅底，统一青色选中；交易详情卡放大并去重复钱包。七房间顶栏随所在页变化，首局说明交代撤离→后勤使用→扩建。

- 源码：[game/css/base-framework-v7.css](../../../game/css/base-framework-v7.css)；[game/css/base-home-v7.css](../../../game/css/base-home-v7.css)；[game/css/base-personnel-v12.css](../../../game/css/base-personnel-v12.css)；[game/css/base-logistics-trade-v12.css](../../../game/css/base-logistics-trade-v12.css)；[game/src/hub/hub.home-v3.js](../../../game/src/hub/hub.home-v3.js)；[game/src/hub/game.hub.runtime.js](../../../game/src/hub/game.hub.runtime.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-base-ui-review/IMPLEMENTATION.md](../../../docs/evidence/2026-10-16-WF-cloud-base-ui-review/IMPLEMENTATION.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/37-base-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/37-base-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/38-logistics-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/38-logistics-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/39-config-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/39-config-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/40-trade-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/40-trade-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：本轮真实打开基地、配置、招式、后勤、交易、收藏、建设和庭院；没有宣称所有细字、WCAG采样或其他窗口均验收。伙伴标题暗底补修并入本项。

### U02 · 背包再次缩放成左上小窗、详情缺全文栏

**状态：实页已验证**

背包使用游戏逻辑画布尺寸，只进行一次统一缩放；三分区有可见名称。详情接回库存共用装饰器，完整规则、滚动栏和操作页脚归位。多轮实玩已从奖励进背包、移安全格再回原奖励续领。

- 源码：[game/css/expedition-inventory.css](../../../game/css/expedition-inventory.css)；[game/src/hub/game.bag.js](../../../game/src/hub/game.bag.js)；[game/src/hub/game.bag.view2.js](../../../game/src/hub/game.bag.view2.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-backpack-layout/README.md](../../../docs/evidence/2026-10-16-WF-cloud-backpack-layout/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/20-backpack-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/20-backpack-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/21-inventory-detail-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/21-inventory-detail-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/23-backpack-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/23-backpack-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/24-inventory-detail-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/24-inventory-detail-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)

### U03 · 入城补给说任选但实际必须全领，条列过小

**状态：实页已验证**

文案明确共N张、全部领取后继续，显示0/2→1/2→2/2；统一左靠条宽、放大收下/整理与继续按钮，剩一张不突然拉宽。第二轮真实逐项领取后才放行。

- 源码：[game/src/run/game.run.altar.js](../../../game/src/run/game.run.altar.js)；[game/css/expedition-rewards.css](../../../game/css/expedition-rewards.css)
- 证据：[docs/evidence/2026-10-16-WF-cloud-expedition-ui-review/README.md](../../../docs/evidence/2026-10-16-WF-cloud-expedition-ui-review/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/43-entry-supply-zero-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/43-entry-supply-zero-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：规则闸门未放宽；满包本地保留及旧回调由定向模块测试覆盖。

### U04 · 战斗手牌抢舞台、目标信息离散、危险预告遮挡

**状态：部分实页已验证**

常态手牌下沉、焦点牌完整抬起；底缘桥共用唯一UID输入链，首次点击与拖动可用。姓名/生命/意图合并局部阅读底，技能费用/可用原因、承伤与剩余生命更清楚；长首脑意图和牌堆按实际高度排布。

- 源码：[game/css/battle-stage.css](../../../game/css/battle-stage.css)；[game/src/battle/view/battle.hand-layout.js](../../../game/src/battle/view/battle.hand-layout.js)；[game/src/battle/view/battle.layers.js](../../../game/src/battle/view/battle.layers.js)；[game/src/battle/view/battle.view.js](../../../game/src/battle/view/battle.view.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-battle-redesign/README.md](../../../docs/evidence/2026-10-16-WF-cloud-battle-redesign/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/27-battle-default-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/27-battle-default-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/28-battle-hover-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/28-battle-hover-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/34-boss-battle-after-r3.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/34-boss-battle-after-r3.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/35-boss-lethal-forecast-r3.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/35-boss-lethal-forecast-r3.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：普通战已真实鼠标点牌、敌/自身拖动、翻栏和结算；首脑技能/意图有实页反馈。末版所有复合意图、致死排版及未覆盖窗口不能统称全过；未改共享卡面或战斗规则。

### U05 · 注能按钮被长文挤成竖条，承伤数字承诺过强

**状态：实页主路径已验证**

说明与动作独立分组，直打按钮禁止收缩/拆字；注能期间隐藏完整道具栏，取消恢复。预告改称估算承伤，常驻说明未计随从攻击与回合末触发。实页按钮宽7.84→108.30显示px，鼠标取消、选材料发动及胜利通过。 后续仅呈现补修进一步明确道具、装备不可在火堆复原，覆盖注能栏、墓地提示与相关日志。

- 源码：[game/css/battle-stage.css](../../../game/css/battle-stage.css)；[game/src/battle/view/battle.view.js](../../../game/src/battle/view/battle.view.js)；[game/src/battle/view/battle.piles.view.js](../../../game/src/battle/view/battle.piles.view.js)；[game/src/battle/core/battle.exec-play.js](../../../game/src/battle/core/battle.exec-play.js)
- 证据：[docs/evidence/2026-10-16-infusion-action-layout/README.md](../../../docs/evidence/2026-10-16-infusion-action-layout/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/46-infusion-actions-crushed-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/46-infusion-actions-crushed-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/49-infusion-actions-readable-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/49-infusion-actions-readable-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/54-battle-estimate-note-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/54-battle-estimate-note-after.png)；[docs/evidence/2026-10-16-WF-verified-ui-copy/README.md](../../../docs/evidence/2026-10-16-WF-verified-ui-copy/README.md)
- 边界：估算公式未改，不保证严格上界；注能主路径和禁用不朽材料已实页，材料复原限制的最新文字仅属R7后142项定向批，未改变消费或复原资格，实页待载。

### U06 · 道具栏和说明框向左裁切

**状态：部分实页已验证**

左锚布局显式清除旧居中translateX；实页道具栏完整，矩形左38.36、右146.97显示px，计算transform平移为0。真实剧毒/恢复药水使用有效。

- 源码：[game/css/battle-stage.css](../../../game/css/battle-stage.css)
- 证据：[docs/evidence/2026-10-16-potion-bar-clipping/README.md](../../../docs/evidence/2026-10-16-potion-bar-clipping/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/64-potion-bar-left-anchor-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/64-potion-bar-left-anchor-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：药水说明框展开后的最终视觉对齐仍需单独实页观察，不能由隐藏状态矩形推定。

### U07 · 生存指南正文太小、折叠标题挤入32px窄列

**状态：实页已验证**

扩大阅读壳、正文与分页按钮，details改为独立阅读列。实页首章、普通战、撤离章节及首脑前准备展开到底完整可读，分页固定可见。

- 源码：[game/css/beginner-guide.css](../../../game/css/beginner-guide.css)；[tests/beginner-guide-readability.test.js](../../../tests/beginner-guide-readability.test.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/41-guide-small-text-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/41-guide-small-text-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/47-guide-readable-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/47-guide-readable-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/48-guide-expanded-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/48-guide-expanded-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)

### U08 · 事件、火堆、层门、祭坛长说明压亮背景

**状态：实页代表场景已验证**

共用叙事/操作区统一深色阅读承托、22px逻辑正文、较大按钮；长内容区滚动、页脚不收缩。火堆、实验室余粮、污染空投、四选一事件及层间闸门已自然操作。

- 源码：[game/css/entry-events.css](../../../game/css/entry-events.css)
- 证据：[docs/evidence/2026-10-16-WF-cloud-event-readability/README.md](../../../docs/evidence/2026-10-16-WF-cloud-event-readability/README.md)；[docs/evidence/2026-10-16-WF-cloud-event-readability/README-R2.md](../../../docs/evidence/2026-10-16-WF-cloud-event-readability/README-R2.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/29-event-readability-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/29-event-readability-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/30-event-choice-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/30-event-choice-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/32-camp-after-r1.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/32-camp-after-r1.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/44-layer-gate-after-r2.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/44-layer-gate-after-r2.png)
- 边界：代表页通过不等于每一种极长选项或所有禁用组合逐一实页通过；规则说明与费用保留。

### U09 · 失败结算窄小裁按钮，成功整理操作随内容滚走

**状态：成功实页已验证，失败待验**

失败页宽壳、分栏阅读和独立操作槽；成功整理两栏各自滚动，完成整理固定可达，账目标签禁止拆字。第二轮成功撤离14张全部入库、完成整理和结果页通过。 第三轮首脑clear终局仓库仅23空格，智能整理按价值实际入库23、确认丢3，消耗区回收16/散失34、10HP返回基地；正式导出回执一致。智能按钮缩为“优先入库高价值卡”，损失括号明确“其中传说/史诗包括”，两处最新文案已定向通过、实页待载。

- 源码：[game/css/expedition-rewards.css](../../../game/css/expedition-rewards.css)；[game/src/run/game.run.altar.js](../../../game/src/run/game.run.altar.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-event-readability/README-R3.md](../../../docs/evidence/2026-10-16-WF-cloud-event-readability/README-R3.md)；[docs/evidence/2026-10-16-sacrifice-modal-layout/README.md](../../../docs/evidence/2026-10-16-sacrifice-modal-layout/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/36-failure-result-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/36-failure-result-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/51-success-settlement-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/51-success-settlement-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/52-success-run-summary.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/52-success-run-summary.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/87-terminal-extraction-overcapacity.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/87-terminal-extraction-overcapacity.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/88-run3-terminal-success-summary.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/88-run3-terminal-success-summary.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json)；[docs/evidence/2026-10-16-WF-verified-ui-copy/README.md](../../../docs/evidence/2026-10-16-WF-verified-ui-copy/README.md)
- 边界：成功终局与实际入库/损失计数已实页闭环；失败页新版仍缺自然死亡复验。最新短按钮与重点损失子集范围词仅R7后142项定向，不改变排序、丢失确认、回执或存档；carried/value明细另有未解决失真。

### U10 · 献祭选择框过小，第二屏选卡后跳回顶部

**状态：实页已验证**

统一五列大卡、可滚动候选和固定确认条；每次重画保留当前滚动与焦点。真实鼠标下排选冰刺、Space取消均保持scrollTop1360.808，Enter/Space多选并完成祭坛献祭。

- 源码：[game/css/expedition-rewards.css](../../../game/css/expedition-rewards.css)；[game/src/run/game.run.altar.js](../../../game/src/run/game.run.altar.js)
- 证据：[docs/evidence/2026-10-16-sacrifice-modal-layout/README.md](../../../docs/evidence/2026-10-16-sacrifice-modal-layout/README.md)；[docs/evidence/2026-10-16-sacrifice-scroll-stability/README.md](../../../docs/evidence/2026-10-16-sacrifice-scroll-stability/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/73-sacrifice-five-column-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/73-sacrifice-five-column-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/74-sacrifice-selection-scroll-reset-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/74-sacrifice-selection-scroll-reset-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/76-sacrifice-scroll-preserved-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/76-sacrifice-scroll-preserved-after.png)

### U11 · 复原消耗卡的共用选择页窄小且无原生键盘按钮

**状态：模块通过，实页待验**

祭坛道具/回赠和修鞋铺共用五列选择壳、固定继续操作；候选为原生按钮，重画保滚动/焦点。显式排除候选被Esc取消启发式误认，防卡名含返回/取消时误复原。

- 源码：[game/src/run/game.run.scenes.js](../../../game/src/run/game.run.scenes.js)；[game/src/ui/overlay.js](../../../game/src/ui/overlay.js)；[game/css/expedition-rewards.css](../../../game/css/expedition-rewards.css)
- 证据：[docs/evidence/2026-10-16-restore-selection-ui/README.md](../../../docs/evidence/2026-10-16-restore-selection-ui/README.md)；[docs/evidence/2026-10-16-restore-selection-ui/regression-final.log](../../../docs/evidence/2026-10-16-restore-selection-ui/regression-final.log)
- 边界：旧页复原业务已实页通过，但新版renderer尚无自然可用入口；已完成祭坛不能再追加，未回滚存档凑验收。JSdom键盘默认激活是构造click，不是真键盘证据。

### U12 · 珍珠盒字小、存取无按钮语义，安全格不能直接开盒

**状态：实页已验证**

两栏大卡和清楚的整叠存取按钮，重画保持同方向焦点；普通背包或安全格都可直接开盒。实页安全格Enter存入、Space取回再存入、Esc回原安全格通过，盒仍安全且背包19→18/27。

- 源码：[game/src/hub/game.bag.js](../../../game/src/hub/game.bag.js)；[game/css/expedition-inventory.css](../../../game/css/expedition-inventory.css)；[docs/rules.md](../../../docs/rules.md)
- 证据：[docs/evidence/2026-10-16-pearl-storage-ui/README.md](../../../docs/evidence/2026-10-16-pearl-storage-ui/README.md)；[docs/evidence/2026-10-16-safe-pearl-access/README.md](../../../docs/evidence/2026-10-16-safe-pearl-access/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/75-pearl-storage-tiny-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/75-pearl-storage-tiny-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/78-pearl-store-keyboard-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/78-pearl-store-keyboard-after.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：整叠容量、保护与存储规则不变；一次存入不保证所有普通奖励可收，不自动重排资源到专用格。

### U13 · 完成祭坛仍提示选择能力，查看只空转

**状态：实页已验证**

地图按真实激活/待领奖状态显示祭坛已完成和勾标；脚下预览说明内容已消耗，查看禁用，远处节点仍可通行。实页显示与后续经完成节点前往首脑都通过。

- 源码：[game/src/core/map-node-state.js](../../../game/src/core/map-node-state.js)；[game/src/core/node-info.js](../../../game/src/core/node-info.js)；[game/src/run/expedition.view.js](../../../game/src/run/expedition.view.js)；[game/src/core/renderer.js](../../../game/src/core/renderer.js)
- 证据：[docs/evidence/2026-10-16-altar-completion-ui/README.md](../../../docs/evidence/2026-10-16-altar-completion-ui/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/77-altar-completed-preview-before.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/77-altar-completed-preview-before.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/79-altar-completed-preview-after.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/79-altar-completed-preview-after.png)
- 边界：完成指祭坛仪式不再有选项，不承诺独立奖励页所有卡已领取；一次性规则和发奖未改。

### U14 · 无的人物页白底立绘与暗色基地割裂

**状态：实页已验证**

仅配置页默认无使用版本化透明新图，舞台透明、混合normal；保留DOM切换时图源、边界和alpha标记同步。真实正式页头发、剑、鞋完整，切黑像恢复原图与舞台方式。

- 源码：[game/assets/portraits/personnel/wu-default-cutout-v1.webp](../../../game/assets/portraits/personnel/wu-default-cutout-v1.webp)；[game/src/hub/hub.personnel.js](../../../game/src/hub/hub.personnel.js)；[game/src/hub/hub.presentation.js](../../../game/src/hub/hub.presentation.js)；[game/css/base-personnel-v12.css](../../../game/css/base-personnel-v12.css)
- 证据：[docs/evidence/2026-10-16-wu-personnel-cutout/README.md](../../../docs/evidence/2026-10-16-wu-personnel-cutout/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/42-wu-transparent-in-game.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/42-wu-transparent-in-game.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：生成式去底相对原画是人工视觉认可，不是像素相同。只有该新PNG→WebP编码像素一致；其余四人未一并替换。

### U15 · 黑市投入前只能看三张小卡，缺少大图阅读入口

**状态：模块通过，实页待验**

候选改原生按钮，点击复用真实卡牌大图；关闭回原按钮焦点，不重画候选、不收费、不保存、不调用随机。成功转待领奖后旧详情回调失效。

- 源码：[game/src/run/game.run.flow.js](../../../game/src/run/game.run.flow.js)
- 证据：[docs/evidence/2026-10-16-blackmarket-card-preview/README.md](../../../docs/evidence/2026-10-16-blackmarket-card-preview/README.md)；[docs/evidence/2026-10-16-blackmarket-card-preview/test-targeted.log](../../../docs/evidence/2026-10-16-blackmarket-card-preview/test-targeted.log)
- 边界：实际UI.showCardZoom集成测试覆盖反复查看、Esc/关闭/背景回焦、第五次保底和旧回调；当前成功黑市现场未倒退，新的Enter/Space、hover和视觉待下一自然黑市。

### U16 · 牌库与消耗牌查看页卡格、规则和返回操作过小

**状态：定向通过，已载入服务，实页待下一战**

牌堆专属壳扩大，当前逻辑画布提供三列320px卡格、24px规则、独立标题及返回页脚；中部内容与长规则有界滚动，保留原卡面和动作。该CSS已随正常服务重载接入，但尚未实际打开新大牌库。

- 源码：[game/css/battle-hand-overhaul.css](../../../game/css/battle-hand-overhaul.css)；[tests/battle-pile-readability.test.js](../../../tests/battle-pile-readability.test.js)
- 证据：[docs/evidence/2026-10-16-WF-battle-pile-readability/README.md](../../../docs/evidence/2026-10-16-WF-battle-pile-readability/README.md)；[docs/evidence/2026-10-16-WF-battle-pile-readability/targeted-tests.log](../../../docs/evidence/2026-10-16-WF-battle-pile-readability/targeted-tests.log)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/81-boss-effective-deck-details.png](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/81-boss-effective-deck-details.png)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：R7后5文件48项定向通过；静态尺寸、DOM及模块契约不等于像素/滚动/原生Tab实页验收。截图81为旧页基线，不能冒充新版效果；未做多尺寸浏览器验收。

## 性能与资源

### P01 · 已退役图片仍被发布并全量预取

**状态：独立构建/发布验证通过**

按精确清单省略旧宝箱rig、19项退役场景和30项被现役图覆盖的旧卡图/缩略图；源码原件保留。生成双manifest与最终复制共用排除集，新增引用或未知动态消费者会保守恢复，当前195项排除、0警告。

- 源码：[scripts/runtime-asset-redundancy-review.mjs](../../../scripts/runtime-asset-redundancy-review.mjs)；[scripts/runtime-asset-redundancy.mjs](../../../scripts/runtime-asset-redundancy.mjs)；[vite.config.js](../../../vite.config.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-performance-review/README.md](../../../docs/evidence/2026-10-16-WF-cloud-performance-review/README.md)；[docs/evidence/2026-10-16-WF-cloud-retired-scenes/README.md](../../../docs/evidence/2026-10-16-WF-cloud-retired-scenes/README.md)；[docs/evidence/2026-10-16-shadowed-card-audit/README.md](../../../docs/evidence/2026-10-16-shadowed-card-audit/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/shadowed-card-publication-verification.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/shadowed-card-publication-verification.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/required-formal-assets-verification.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/required-formal-assets-verification.json)
- 边界：三批属于同一过度发布问题，不按195个文件算195个修复。旧rig确定新增省略实体16,905,604B、场景3,428,566B、旧卡图1,291,352B；总包实际结果以冻结构建为准，仍超预算。

### P02 · 现役角色动画与房间背景可无损减重

**状态：像素/发布核验通过**

263张现役角色帧原路径重新无损编码，尺寸/RGBA/alpha逐字节一致，省5,160,770B；房间PNG派生等像素WebP省424,413B，原PNG保留。动画映射与来源许可不改。

- 源码：[game/assets/portraits/frames/](../../../game/assets/portraits/frames/)；[game/assets/home-prototype/room-direction-candidate.webp](../../../game/assets/home-prototype/room-direction-candidate.webp)；[game/src/home/home.visuals.js](../../../game/src/home/home.visuals.js)；[game/assets/asset-manifest.json](../../../game/assets/asset-manifest.json)
- 证据：[docs/evidence/2026-10-16-WF-cloud-sprite-lossless/receipt.json](../../../docs/evidence/2026-10-16-WF-cloud-sprite-lossless/receipt.json)；[docs/evidence/2026-10-16-WF-cloud-sprite-lossless/verification.json](../../../docs/evidence/2026-10-16-WF-cloud-sprite-lossless/verification.json)；[docs/evidence/2026-10-16-WF-cloud-room-lossless/receipt.json](../../../docs/evidence/2026-10-16-WF-cloud-room-lossless/receipt.json)；[docs/evidence/2026-10-16-WF-cloud-room-lossless/verification.json](../../../docs/evidence/2026-10-16-WF-cloud-room-lossless/verification.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/required-formal-assets-verification.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/required-formal-assets-verification.json)
- 边界：字节收益与像素相等已核，不推导FPS或时延；新透明无立绘是新增资产，不能从此省字节里隐藏其增量。

### P03 · 标题首屏提前解析整备和菜单全部页面

**状态：模块/构建已验，入口实页部分覆盖**

整备共享选择状态抽到无依赖叶模块，解除轻门面对整备静态反穿；选档/指南/设置等按首次入口加载，保留取消、去重、失败重试和热入口。整备静态图退出11个模块、加入1个纯状态模块。

- 源码：[game/src/hub/departure.selection-state.js](../../../game/src/hub/departure.selection-state.js)；[game/src/hub/game.hub.js](../../../game/src/hub/game.hub.js)；[game/src/hub/game.hub.depart.js](../../../game/src/hub/game.hub.depart.js)；[game/src/ui/game.menu.js](../../../game/src/ui/game.menu.js)；[game/src/ui/game.menu.pages.js](../../../game/src/ui/game.menu.pages.js)；[game/src/game.boot.js](../../../game/src/game.boot.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-performance-review/deploy-selection/README.md](../../../docs/evidence/2026-10-16-WF-cloud-performance-review/deploy-selection/README.md)；[docs/evidence/2026-10-16-menu-pages-lazy/README.md](../../../docs/evidence/2026-10-16-menu-pages-lazy/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/ADDENDUM-R3-MENU-CONTRACT.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/ADDENDUM-R3-MENU-CONTRACT.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：多次正常标题→选档→基地、指南、设置及出征已实页；不能把“退出静态图的源码gzip”写成实际产物收益，整轮entry实测见综合验收。基地CSS仍静态。

### P04 · 后台全量预取与前台图片、回退字体争抢

**状态：模块通过，性能收益未实测**

当前人物和卡框先于完整缩略目录；后台批次低优先级fetch，遇前台可见未完成图短暂让路，单页最多1.5秒后继续。删除两条Noto回退字体强制preload，字体声明/文件与按需回退保留。

- 源码：[game/src/core/art-preload-plan.js](../../../game/src/core/art-preload-plan.js)；[game/src/core/art.js](../../../game/src/core/art.js)；[game/src/game.boot.js](../../../game/src/game.boot.js)；[game/index.html](../../../game/index.html)；[tests/art-preload-scheduling.test.js](../../../tests/art-preload-scheduling.test.js)
- 证据：[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/asset-consumer-reaudit-preload.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/asset-consumer-reaudit-preload.json)；[docs/evidence/2026-10-16-WF-cloud-performance-review/README.md](../../../docs/evidence/2026-10-16-WF-cloud-performance-review/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/REPORT.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/REPORT.md)
- 边界：不删完整预取集合、不提前解码全部图库；字体两文件509,372B是避免无条件预载的量，不是发布包减少量。没有真实首屏时延、FPS或下载量A/B。

### P05 · 未使用的调度端口和通讯演示随首屏初始化

**状态：模块通过，专用实页待验**

Agent首次真实让位才创建MessageChannel，Node优先setImmediate时不再多建端口；通讯演示仅commDemo参数入口动态加载，冷加载跨战斗仍隐藏，失败可重试。

- 源码：[game/src/agent/agent.runner.js](../../../game/src/agent/agent.runner.js)；[game/src/ui/transitions-director.js](../../../game/src/ui/transitions-director.js)
- 证据：[docs/evidence/2026-10-16-entry-cost-deep-audit/IMPLEMENTATION.md](../../../docs/evidence/2026-10-16-entry-cost-deep-audit/IMPLEMENTATION.md)；[docs/evidence/2026-10-16-entry-cost-deep-audit/implementation-tests.log](../../../docs/evidence/2026-10-16-entry-cost-deep-audit/implementation-tests.log)
- 边界：未用Agent前1个Channel/2端口变0由测试验证，不是FPS测量。demo压缩AST移除诊断差约1.21KiB，不是本批正常构建实测收益。

### P06 · 现行CSS仍包含只匹配退役DOM的大量旧规则

**状态：模块/冻结构建已覆盖**

限定旧DOM白名单，清退18个现行样式表中425条完整旧规则、468个选择器分支，源文本减少55,487B；混合选择器只删旧分支，幸存声明及顺序保留，未删文件。

- 源码：[game/css/](../../../game/css/)；[tests/css-dead-dom-budget.test.js](../../../tests/css-dead-dom-budget.test.js)
- 证据：[docs/evidence/2026-10-16-css-dead-dom-prune/README.md](../../../docs/evidence/2026-10-16-css-dead-dom-prune/README.md)；[docs/evidence/2026-10-16-css-dead-dom-prune/prune-receipt.json](../../../docs/evidence/2026-10-16-css-dead-dom-prune/prune-receipt.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/build-metrics-comparison.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R6-verification/build-metrics-comparison.json)
- 边界：规则/字节数量用于核对清退范围，不是修复个数。旧产物模拟7.94KiB只作诊断，新增可读性CSS会抵消部分；当前全部异步CSS仍计入原预算且仍超限。

### P07 · 暂停或静态庭院经快捷入口离场后未及时释放

**状态：模块通过，实页资源待验**

离场判断覆盖宿主断连、overlay换页/隐藏/关闭；复用原观察器及时触发幂等dispose，释放RAF、document/media监听、画布和雨声上下文。

- 源码：[game/src/hub/hub.courtyard-runtime.js](../../../game/src/hub/hub.courtyard-runtime.js)
- 证据：[docs/evidence/2026-10-16-ui-lifecycle-deep-audit/COURTYARD.md](../../../docs/evidence/2026-10-16-ui-lifecycle-deep-audit/COURTYARD.md)；[docs/evidence/2026-10-16-ui-lifecycle-deep-audit/courtyard-regression.log](../../../docs/evidence/2026-10-16-ui-lifecycle-deep-audit/courtyard-regression.log)
- 边界：验证使用真实runtime与浏览器API替身；不是已证明每次重进都线性累积，也没有浏览器堆/音频资源实测。

### P08 · 照片大图关闭后原图升级探针继续持有引用

**状态：模块通过，实页资源待验**

关闭时清空探针持有的DOM引用、解绑事件并尽力取消src；迟到解码不串新图，成功升级和失败低清回退保留。

- 源码：[game/src/ui/ui.js](../../../game/src/ui/ui.js)
- 证据：[docs/evidence/2026-10-16-ui-lifecycle-deep-audit/PHOTO-PROBE.md](../../../docs/evidence/2026-10-16-ui-lifecycle-deep-audit/PHOTO-PROBE.md)；[docs/evidence/2026-10-16-ui-lifecycle-deep-audit/photo-regression.log](../../../docs/evidence/2026-10-16-ui-lifecycle-deep-audit/photo-regression.log)
- 边界：Image.decode没有标准abort；不承诺底层解码立即中止，不把12个隔离探针当实际网络并发或永久泄漏数量。

### P09 · 药水提示pointerup后仍残留pointercancel闭包

**状态：模块通过，实页提示待验**

任一结束、移开、换栏、重建或离页都同时移除两种终止监听并释放当前提示；脱离DOM旧节点不能重新注册。修前100次重建后的cancel会触发100个旧节点写入，修后持久回归防止残留。

- 源码：[game/src/battle/view/battle.view.js](../../../game/src/battle/view/battle.view.js)
- 证据：[docs/evidence/2026-10-15-potion-tip-lifecycle/README.md](../../../docs/evidence/2026-10-15-potion-tip-lifecycle/README.md)；[docs/evidence/2026-10-15-potion-tip-lifecycle/selfdelta.patch](../../../docs/evidence/2026-10-15-potion-tip-lifecycle/selfdelta.patch)；[tests/potion-tip-lifecycle.test.js](../../../tests/potion-tip-lifecycle.test.js)
- 边界：证实监听/DOM保留；未新增观察器或常驻轮询，不宣称FPS提升。原微探针仅存在当时临时环境，持久证据为README、独立delta与正式专测。

## 自动化与验证效率

### A01 · 反复开箱和旅行需要手动等动画，旧按钮消失被误报

**状态：实页局部流程已验证**

新增当前内置tab的可见DOM辅助工具，仅对白名单低风险动作真实点击，开箱/旅行/关闭使用有界条件等待；选卡、满包、多奖励、未知事件、战斗和错误均交还控制。已真实开箱后停在三选一、继续回图、旅行等待后停在未知落点。

- 源码：[scripts/visible-playback.mjs](../../../scripts/visible-playback.mjs)；[scripts/gate-plan.mjs](../../../scripts/gate-plan.mjs)；[tests/visible-playback.test.js](../../../tests/visible-playback.test.js)
- 证据：[docs/evidence/2026-10-16-WF-visible-playback/README.md](../../../docs/evidence/2026-10-16-WF-visible-playback/README.md)；[docs/evidence/2026-10-16-visible-playback-waits/README.md](../../../docs/evidence/2026-10-16-visible-playback-waits/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/auto-first-reward.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/auto-first-reward.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/auto-second-reward.json](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/screenshots/auto-second-reward.json)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/PLAYLOG.md)
- 边界：R2.2到R2.3合并为一项改进。没有隐藏游戏状态/存档注入、外部浏览器或自动战斗；新关闭动效等待的全部分支仍以假tab契约为主，不等于全局通关。

### A02 · 模块拆分后旧mock和文字匹配自测误报

**状态：定向/相应冻结补验通过**

按正式导出补齐事件、预热、有效卡等测试mock；CLI自测纳入菜单新属地，并将注释/空格匹配改为AST验证保存阶段、return await和settle顺序。变异验证证明改注释可过、破坏真实续流仍失败。

- 源码：[game/selftest.js](../../../game/selftest.js)；[tests/agent-console-jump.test.js](../../../tests/agent-console-jump.test.js)；[tests/map-travel-motion.test.js](../../../tests/map-travel-motion.test.js)；[tests/node-flow-confirmation.test.js](../../../tests/node-flow-confirmation.test.js)；[tests/r6-story-flow.repro.test.js](../../../tests/r6-story-flow.repro.test.js)；[tests/battle-drag-reference.test.js](../../../tests/battle-drag-reference.test.js)
- 证据：[docs/evidence/2026-10-16-r5-contract-repair/README.md](../../../docs/evidence/2026-10-16-r5-contract-repair/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/ADDENDUM-R3-MENU-CONTRACT.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/ADDENDUM-R3-MENU-CONTRACT.md)；[docs/evidence/2026-10-16-run-lifecycle-audit/r2-integration-fixes.md](../../../docs/evidence/2026-10-16-run-lifecycle-audit/r2-integration-fixes.md)；[docs/evidence/2026-10-16-skull-sword-start-audit/internal-release-r2/README.md](../../../docs/evidence/2026-10-16-skull-sword-start-audit/internal-release-r2/README.md)；[docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R5-verification/contract-supplement/REPORT.md](../../../docs/evidence/2026-10-16-WF-cloud-play-eight-hours/R5-verification/contract-supplement/REPORT.md)
- 边界：这是测试基础设施维护，不计玩家bug。原失败日志保留，没有改预算、增skip或删业务断言；补验覆盖只限对应输入，不替代R7最新全量。

## 尚未解决、待验和未实施事项

1. 四项性能预算仍超限；CSS按需加载只做了审查方案，未实施，且其本身不能降低“全部CSS”预算。`docs/evidence/2026-10-16-css-delivery-audit/README.md` 的24.2 KiB是旧产物静态拆分模拟，不是已实现收益
2. R7第二遍同参数普通全量已通过，首遍3红和定向78过独立保留。两项20秒超时原失败不改写，workflow的status=null原因仍未证实；该full不包含之后摘要/预览、牌堆CSS、四源呈现小批，也不包含原四项预算
3. 首脑牌堆摘要旧卡名已在R7后改为有效卡查询，同时准确化预览无法精算的理由；独立7文件141项通过。实页已确认实际牌库内部为不朽斩，但新按钮摘要载入后的实页仍待下一战；不把C12夸成所有显示入口最新实页都已通过。证据`docs/evidence/2026-10-16-skull-sword-start-audit/pile-summary-r3/README.md`
4. 新公共复原选择页、失败结算新版、不变应万变自然实页，以及黑市投入前新放大按钮的真实键盘/视觉仍待自然场景。round已有末10场终局导出，寻宝图主动和首脑额外传说已自然实页闭环；不再列为全项待验。黑市源码`game/src/run/game.run.flow.js`，证据`docs/evidence/2026-10-16-blackmarket-card-preview/README.md`
5. 珍珠盒提示“可存资源腾格”仅形成有条件方案，未加到奖励页；自动按资源专用格重排是新玩法，未实施。跨区移出安全格只查总容量的既有口径差异仍独立保留；没有把普通卡在19/27被拒收误当新回归
6. 旧存档wood/rations/key路径容量失败仍可能done；当前新局可达范围未定，不计已修。来源见`docs/evidence/2026-10-16-run-lifecycle-audit/README.md`
7. 黑像、星月透明候选无损WebP均超过单文件1 MiB门槛，未正式接入；白塔法阵重描、常无欲烟雾白亮边仍候选。不算四人已完成去底，来源`docs/evidence/2026-10-16-roster-cutout-integration/README.md`
8. 目标/人物alt的辅助树旧名曾与直接DOM属性不一致；已核实的DOM名称正确时未盲改游戏。刷新/输入工具超时、扩展metadata报错、截图07热重载过渡都未直接计为游戏bug
9. 第三轮已12战12胜、首脑7回合并完成成功终局，正常设置导出证实clear/bossKilled与10HP。lastBattles仅末10场，不声称第一场3回合有该导出覆盖；完整一局不等于全卡全场景均已验收
10. 新发现终局统计明细仍误把全部owned作为carried：正式导出clear.carried共29、carriedValue84，含3张不可入库初始攻击及3张未入库牌；最终应为实际入库23、价值77。receipt中的23入库、16消耗回收、损失3及散失34正确不能抵消这项失真。当前仅只读定性并准备真实复现/修法，尚未修复。相关源码`game/src/run/game.run.altar.js`的recordRun carriedCards输入与`game/src/agent/agent.recorder.js`的carriedValue计算；主证据为0028正式UI导出

## 综合验收按冻结输入解释

| 冻结轮次 | 已知结果 | 可复用范围 |
| --- | --- | --- |
| R5原始 | 4509过/14败/2skip，1 unhandled；正常build四预算红 | 仅22:24 UTC稳定输入；原红保留 |
| R5四文件契约补验 | 4523过/0败/2skip，0 unhandled | R5生产输入加明确四文件测试/自测修补；不覆盖后续药水CSS与玩法补丁 |
| R6 | 4604过/2败/2skip，0 unhandled；静态过，正常build四预算红 | 23:21 UTC稳定输入；planner超时定向2.639秒通过不覆盖原全量红；SYS03拒收提示问题后续已修 |
| R7 | 首遍4692过/3败/2skip保留；第二遍4695过/0败/2skip、0 unhandled、exit0；正常build四预算红 | 稳定源manifest54344d79…b102；冻结后摘要/预览141项、牌堆CSS48项、四源呈现142项各限对应定向输入 |

核对入口：
- [R5原始报告](../2026-10-16-WF-cloud-play-eight-hours/R5-verification/REPORT.md)
- [R5契约补验报告](../2026-10-16-WF-cloud-play-eight-hours/R5-verification/contract-supplement/REPORT.md)
- [R6报告](../2026-10-16-WF-cloud-play-eight-hours/R6-verification/REPORT.md)
- [R7正式报告](../2026-10-16-WF-cloud-play-eight-hours/R7-verification/REPORT.md)
- [R7实际体积](../2026-10-16-WF-cloud-play-eight-hours/R7-verification/build-metrics-comparison.json)
- [R6实际体积](../2026-10-16-WF-cloud-play-eight-hours/R6-verification/build-metrics-comparison.json)

R4比较文件保留了任务给定的原始四舍五入参考值144.58 MiB/329.6/375.0/200.1 KiB，并明确未在该轮重建其来源。因此若引用本轮累计减重，应称“相对任务提供的原参考”，不可当作本报告重新跑出的严格同输入A/B；各小项确定资产字节及R5/R6真实产物更便于核验。

## 00:28正式导出与R7后小批覆盖补记

- [0028正式UI导出](../2026-10-16-WF-cloud-play-eight-hours/run-data-ui-export-20261016-0028.json)：第三run fought12/won12，bossKilled=true、outcome=clear；末10场round为1/2/2/1/1/1/3/3/3/7，巨兽3、首脑7匹配实机。netTake=23入库+16消耗回收，losses=3未入库+34消耗散失，终局hpLeft10
- [新牌堆阅读CSS](../2026-10-16-WF-battle-pile-readability/README.md)：48项定向，已载入服务，实际新大牌库待下一战；旧截图81仅作基线
- [四源呈现补修](../2026-10-16-WF-verified-ui-copy/README.md)：142项定向，deckBottom有效卡面、owned/临时来源和临时副本说明、道具/装备复原例外、短智能按钮、损失高稀有子集范围词。没有更改消费、排序、复制规则、回执或存档，最新实页待载；父任务审定195项排除/0警告
- 这三份新证据不能被R7冻结全量自动覆盖；carried29/value84错误仍按上节未解决处理

## 同日历史成果不重复记入本轮新增

`2026-10-16-runtime-perf`的无图标快速路径、DOM扫描合并和图片重复解码优化，早前`WF-battle-play-rewrite`的战斗V1–V3，以及`home-city-glow`的首页光束隐藏，都可作为已存在基础和历史证据。只读对照当前f0e84c5d差分后，未将这些同日旧成果再次认领为本轮新增；更不能把其中合成微基准82.9%当作本轮整局FPS改善。

本总表只写入自有目录；未改共享registry、其他报告或任何游戏源码。

## 00:58 UTC 更新：R8与交付边界
最新独立R8覆盖全部上述后补及撤离记录savedCards修复：494文件4720项通过、2项原有跳过；语法/数据/类型/lint/文档全部通过。build编译完成而四预算仍失败：119.60MiB包、290.1KiB入口gzip、335.5KiB首屏JS gzip、197.2KiB CSS gzip。

原第三轮真实导出29/84的问题已经在生产代码修复并有149项定向验证；隔离事务复现新输出23/77，旧记录不重写。新一局实页最终导出仍待核，平台审批受阻；不能把单测当实机证明。详见[修复报告](../2026-10-16-WF-extraction-record-audit/REPORT.md)和[R8报告](../2026-10-16-WF-cloud-play-eight-hours/R8-verification/REPORT.md)。

GitHub首个Wu blob调用在审批等待中被中断，零成功回执，执行不确定；其余264项未开始。父只读核对预期Wu SHA返回404，仍不得称已上传或已推送。没有远端提交/分支更新。
