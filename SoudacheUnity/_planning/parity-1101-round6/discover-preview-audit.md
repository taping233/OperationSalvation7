# 发现首轮预览：支付前取消审计

2026-11-01，只读对照Vite现行调用链及Unity现行Core/Bridge/UI。没有修改生产、检查源，未编译、测试或启动Unity。Battle代理正在收口已支付发现取消；本文将其与尚未实现的首轮预览分开，不要求退款。

## 结论与最小边界

Unity缺少Vite的支付前首轮预览。当前Unity `BattleSession.PlayCard/ConfirmInfusion → ExecPlay` 在能量、源牌、注能/手牌代价写入后才执行发现；`BattleItems.UseItem`也先从hand移除并加入played。Vite预览发生在这些写入前；首次取消保持全部原状态，首次确认后重新校验并走正式支付。第二轮及其他已支付发现取消只放弃未确认部分，保留已支付代价和此前奖励。

最小闭包是Core内一个短生命周期预览状态/一次性首轮票、同回合候选缓存，以及既有发现Snapshot的预览文案。保留已修token+selectionId+renderRevision和350ms入场门；Bridge的现有PickDiscover/CancelDiscover足够，不需改App、SaveSystem或另造退款/保存框架。

## Source实际准入

`game/src/battle/effects/battle.discover-preview.js:14–48`：

| 来源 | 支付前预览条件 |
| --- | --- |
| 普通onPlay | 非空数组、非装备；**全部**op无when/schedule/pick，且为正整数count的discover，或正整数n、dest缺省/discover、非牌库底池的acquire。不是仅检查首op。 |
| bag.use | 道具且bag.use为数组时优先此数组；全部op无when/schedule，且为discover或acquire；acquire的classAbility/legendary直接授予分支不预览。首job次数按整数amount，否则n或1；pool缺省随机；不是discover.count。 |
| castStored | 非bag且onPlay恰好一个无when的castStored、有实际存入法术时，可预览实际已有实体。此特判在普通op检查前。 |
| 排除 | 混合伤害等非发现op、条件/排期/带pick、装备、旧文本路径、牌库底以及历史搜刮宝箱专用分支仍已支付。无候选则不显示预览，继续既有正式执行的空池语义。 |

`battle.selection-flow.domain.js:97–107`额外拒绝已有discovering/待发现队列；非bag且未ignoresSilence的沉默卡不预览。`battle.exec-play.domain.js:225–235`仅当源UID仍在hand且不是directRelease才尝试；**freeCost自身不排除**，因此不能仅在玩家鼠标入口挂预览而漏同一正式Exec入口。道具快捷使用有独立正式调用，见下文。

acquire首job调用实际`createAcquireOperation`规划器，保持pool/filter/命名池语义，禁止预览调用任何addCard/random授予/洗牌等执行口。Unity也应复用当前CurrentBattlePools及统一候选采样，不把ApplyRuleOperation当预览器。正式定版数据`cards-sync.json`中的神秘召唤`cmtn125e1nk0`已是纯acquire/discover例；不能当仅测试构造功能。

## 首次确认、候选与取消

1. `battle.exec-play.domain.js:186–235`先重新取得有效卡面，核规则能力、注能/材料、能量及目标；之后await preview；尚未写hand payment、freeCast、energy、played、源UID或燃料。手牌支付UI本身可已选完草稿，但到execPlay:237–267才实际消耗。
2. `battle.selection-flow.domain.js:90–171`用正式discoverFlow生成首批。缓存scope为battleToken+turn，key为sourceUID+JSON(id,type,desc,rules)。首次生成正常前进generation RNG；取消不回退RNG，同回合同源计划重开复用options、不再次抽样。新回合/新token/重置/abort清缓存，计划变化换key；printed cost不在计划key中，费用留给正式确认时复核。
3. 预览state带`sourceCommit=preview`、sourceUID、独立roundID、`cancelLabel=取消使用`。valid要求同battle/turn、来源仍可用、当前有效计划相同；stored候选另外核真实owned UID+cardID。abort只清自己拥有的state，不清后来替换的交互。
4. 首次pick只返回`{options,index,claimed:false}`并清预览，不加卡、不扣费。execPlay携票递归一次，重验等待期间可能变化的规则/有效卡面、材料、费用、目标与手牌支付，然后才正式扣款/移牌。
5. `withPreparedDiscovery/claimPreparedDiscovery`是仅跟随该源执行视图的私有标记，首个实际job消费一次，追加fixedOptions+confirmedIndex。`discover-flow.js:78–96`用同批候选自动应用已确认项，不再弹首轮、不再抽样；后续n-1或后续纯op照正式committed发现生成。不可把票放成可被燃料onConsume/获得触发/后继释放卡抢走的共享全局开关。
6. 首轮cancel只结束等待，源牌、能量、注能材料、手牌代价与完成附赠均不变。已支付取消走`discover-flow.js:310–322`，只清当前轮；牌库底UID原序归还、此前临时奖励的到期仍保留，其他排队job照常处理。n>1首奖保留，源牌/费用不返还。不要把cancel实现成取消整条规则队列。

## 道具与锦囊

`battle.bag.domain.js:340–381`在正式物品marker保留后、consumeBattleItem前preview；sourceAvailable核同battle、同pending marker且当前bagItems仍有该UID。确认后再从真实列表取源，携票进入原useStructuredBattleBag或onPlay；finally释放物品marker。Unity应在UseItem的hand.Remove/played.Add前设置同等发现gate，确认后复核可用item/目标，再调用共同私有正式执行核，不通过公共UseItem再次开一轮预览。

锦囊job来自当前owned里`pouchOf=tt7-stratagem`且type=法术的实际卡，option附stored母本UID；预览不耗随机数、不删母本。Source的正式queuePouchCast再读取当前背包，票在正常队列drain时消费；实际pick才消耗所选母本并免费直接释放。Unity应复用现役CastStoredRuleCard/ConsumeStoredCard与正式候选UID映射，取消不删任何未确认母本，不能只按cardID找同名实例。

## Unity建议落点与必要检查源

- `BattleSession.ExecPlay`：手牌草稿门保持原有顺序；在paymentUids/energy/source/fuel任何写入前TryOpenPreview，携捕获fuel/payment/target/freeCost/directRelease，确认后重验并重入共同执行核一次。预览取消恢复可操作phase，不执行CompleteRuleCast/完成回调。
- `BattleItems.UseItem`：写入played/hand前同等gate；保留物品真正消耗的原规则与G来源检查。
- `StructuredRules.StartStructuredDiscover/AcquireRuleCards/CastStoredRuleCard`：统一首job规划/采样，首个匹配源job一次消费prepared；n>1继续已支付流程。Battle已在提取DiscoverOptions，可直接复用，避免两套RNG/过滤循环。
- `DiscoveringSnapshot/DiscoverPanel`：最小增加preview/sourceCommit与cancelLabel/sourceUID投影，说明“取消使用未支付”或“结束发现保留已结算”；继续用现有owner守卫。不要只用kind判定是否退款。

建议新增回归直接测实际处理入口：

1. 纯n=2发现，同时有2能量、1注能和1手牌代价：首次取消后energy/hand/played/consumed/源owned及完成附赠严格不变。
2. 同回合取消重开固定相同候选/顺序且RNG次数不增；计划变更、新回合、终局/Reset后不复用旧scope；旧token/selectionID/页面事件无效。
3. 首次确认只支付一次并取得初始选中候选、不二次抽首轮；第二轮取消保留首张、原代价与其费用衰减/到期语义，后续其他job/续接执行一次。
4. 等待中移除/替换源、变更有效计划/目标/能量/燃料/手牌支付后，确认不得支付或发奖励；abort不得清替换交互。printed cost变化按现行正式校验处理，不强行回滚整个状态。
5. 纯bag发现物品首次取消保留实际owned源；确认只消耗一次；classAbility/legendary直授及混合/条件/排期/装备/牌库底继续现役committed语义。directRelease不加新的预览中断。
6. 锦囊取消无RNG/母本变更；确认只消耗真实选中UID、同ID不同UID不串卡，未选母本保留。

现有Vite `tests/battle-discovery-cancellation.test.js:33–146`提供首轮取消、快捷道具、锦囊、候选缓存、首票一次消费、过期round、abort、混合准入和已支付取消的来源断言。本文只读取，未重复运行，也未将这些源码断言视作本轮Unity通过证据。

## 追加：Battle新实现独立静态复核

Root授权后只读核Battle代理新增 `BattleDiscoveryPreview.cs`（读取时原字节SHA `639b5f0128dae077bfd1f2c391fa99e54e91649f5c576805dc0029d06dc3eacf`）、Session ExecPlay/Pick/Cancel、Items及StructuredRules的调用。作者回归源仍在编写；不改生产、不执行，也不把在途文件当最终冻结指纹。

当前所核闭包未见确定阻断：

- gate位于ExecPlay的payment/energy/source/fuel写入前；道具位于hand.Remove/played.Add前，通过同一私有UseItemCore复用正式消费路径，确认再次查真实来源/目标。
- PreparedDiscovery仅通过源RuleContext及源ResolveStructuredCard→RunRuleOps显式参数传递；onConsume/onAcquire/已登记时点/重放的RunRuleOps默认不带票。首个源job Claim后只使用初选options/index一次，后继轮正常采样。
- 计划序列包括id/type/desc/rules，不包含printed cost；PreviewCurrent核token/turn/来源/计划，正式commit按当前费用、fuel/payment与目标再验。Reset初始化、新回合、终局均ClearDiscoveryPreviews；同回合取消不回退RNG、同计划复用候选。
- bag整数amount或n默认次数、多个op遇选择暂停续接、捕获敌人目标失效拒绝，已核作者消息所称修正，没有将其在途旧版本再报缺口。bag.use原正式随机池能力比Source的未知pool拒绝更完整，此轮没有为了复刻Source缺陷删掉现役能力。
- 主牌在材料触发前记录consumptionBase；材料产生RuleInputPending后，ResolvePlayedCard由DeferRuleBatch插入该边界并捕获主牌context。材料选择先结算，源prepared仍只交主onPlay。首奖AddTemp触发onAcquire待选后，n-1也压入相应边界；后续源op续接插在更低位置，保持先内层、再n-1、再后续op的现有栈顺序。
- stored候选另存真实母本UID；确认前核原UID仍存于锦囊，实际CastStoredRuleCard用选中index对应UID向ConsumeStoredCard提交，避免同ID实例串用。

首轮preview和committed取消通过同一token/selectionId入口区分；已付分支保留专用cancel动作、ResumeRules与原有母本/底牌处理。这里只静态核本次新增边界，不扩到其他旧战斗链，不声称领域或原生回归已经通过。

另按Battle请求只读复核 `Assets/Editor/CurrentDiscoverRound6Checks.cs` 的真实神秘召唤/锦囊/终局旧回调片段，未见限定范围内的确定夹具/API阻断。Fixture通过正式GameRuntime新局、BattleRequested与BattleCommands获得当前GameBattleHost；同ID锦囊母本有独立UID/variant/cost及正式pouchOf，正式ConsumeStoredCard只核选中UID。神秘召唤核首轮零支付、取消和候选/RNG复用、最终只支付一次且真实首选入手；锦囊核未选母本保留、仅选中UID消费及源扣1费。组件级Submit在0.4秒后选择再确认，仍执行当前Button可用与EventSystem Submit检查；它与Player的真实Raycast布局周期验证分工明确。旧事件覆盖同标签下一轮、新session、正式Escape以及Finish后的回放；最后恢复ReducedMotion。这里只审检查源可用性，没有运行或把组件Submit当OS输入。
