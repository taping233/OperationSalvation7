# 实际牌堆统一：定向库存

老板已确认“不自动洗回，仅卡牌效果取回”。本次只盘点，不改生产、不加测试。UI线承接抽牌不洗回、命名和解析兼容；root承接真实集合与取回。

现行 `played`、`consumed` 同时承担战后账本，`discard`、`grave` 有物理区域作用；同一UID本来可跨这些数组登记。最小方案沿root接口：`readConsumedPile(played+consumed+discard+grave)`按UID去重并排除hand/draw及当前结算源UID；取回成功后移除各旧数组内该UID，再放回目标区域。未取回牌保留原played/consumed类别，不把普通打出追加为消耗事件。装备不新增排除条件，维持现行取回边界。

| 已核实入口 | 当前动作与账本 | 统一接点 |
| --- | --- | --- |
| [runtime.piles:2](/D:/素材/代号柒/搜打撤/game/src/battle/runtime/battle.runtime.piles.js:2)、[restore:32](/D:/素材/代号柒/搜打撤/game/src/battle/runtime/battle.runtime.piles.js:32) | 四数组分别保存/恢复，旧档可重叠 | 纯投影适配旧数据，不直接把数组互设同一引用 |
| [exec-play:229](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.exec-play.js:229)、[250](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.exec-play.js:250)、[262](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.exec-play.js:262)、[280](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.exec-play.js:280) | 手牌代价进consumed；源牌进played；注能进consumed并在boss进grave；boss源牌再进discard。均为原UID | active源UID在onBegin/onEnd闭包排除；保留各类onConsume触发时点 |
| [exec-play:390](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.exec-play.js:390) | keepInHand是原UID自返：删除一次discard和played记录再回手；手满回discard | 属于特殊自返，不是从消耗集合选取的通用消费者 |
| [bag.restoreConsumed:24](/D:/素材/代号柒/搜打撤/game/src/battle/bag/battle.bag.js:24) | **本轮已查范围内唯一现成“消耗/墓地取回”的move端口**：consumed.pop→removeUid(grave)→hand.push；会清consumed，原本不清played | 本轮优先只接此端口：改读统一源，原UID取回，集中删旧数组UID；不调用addTempCard |
| [bag:61](/D:/素材/代号柒/搜打撤/game/src/battle/bag/battle.bag.js:61)、[171](/D:/素材/代号柒/搜打撤/game/src/battle/bag/battle.bag.js:171)、[recovery:20](/D:/素材/代号柒/搜打撤/game/src/battle/effects/effect-steps.recovery.js:20) | 水晶/复原药水可用性、结构化bag.restoreConsumed、文本“复原/复活N张”共同走上述端口；是move不是复制 | 可用性也读统一集合，避免页面说空而执行可取回 |
| [engine.factory:330](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.engine.factory.js:330)、[873](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.engine.factory.js:873)、[1074](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.engine.factory.js:1074)、[selection:206](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.selection-flow.js:206) | 弃尽/消耗手牌、定时临时牌回收、封印自耗和手选消耗写consumed，部分boss再写grave | 写入沿原原因/触发语义；合并位置不等于把所有弃牌事件变成onConsume |
| [enemy-phase:257](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.enemy-phase.js:257)、[398](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.enemy-phase.js:398)、[equipment:264](/D:/素材/代号柒/搜打撤/game/src/battle/bag/battle.equipment.js:264)、[m2:396](/D:/素材/代号柒/搜打撤/game/src/battle/effects/effect-steps.m2.js:396) | 敌方消耗手牌进consumed+grave；火球符文只进grave；开战装配进consumed+grave；装备支付进consumed并按boss进grave | 纯并集能覆盖现有漏在单一源外的UID；不补造原来没有的消耗触发或账本类别 |
| [m1:110](/D:/素材/代号柒/搜打撤/game/src/battle/effects/effect-steps.m1.js:110)、[foe-lifecycle:98](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.foe-lifecycle.js:98)、[requested:111](/D:/素材/代号柒/搜打撤/game/src/battle/effects/requested-card-runtime.js:111) | boss dumpHand、龙尊丢手牌、混沌牌库丢手牌进discard，不因移动而追加played/consumed；普通consumeHand另进consumed | 必须纳入可取回集合，但保留战后未使用牌原有归属 |
| [draw:55](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.draw.js:55)、[draw:87](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.draw.js:87)、[deck:19](/D:/素材/代号柒/搜打撤/game/src/battle/bag/battle.deck.js:19)、[m1:58](/D:/素材/代号柒/搜打撤/game/src/battle/effects/effect-steps.m1.js:58) | 目前空库自动把discard洗回；抽到即结算/灰烬直释写discard；抽至N张按drawPile+discard防循环 | UI线删除自动洗回；效果显式取回才重新进hand/deck。不能保留旧refill消费绕过新决定 |
| [inspection:100](/D:/素材/代号柒/搜打撤/game/src/battle/effects/battle.card-inspection.js:100)、[resolution:654](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.resolution.js:654)、[806](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.resolution.js:806) | 消耗区法术减费读consumed；结构化及文本墓地增伤读grave并有boss条件 | root另派改读统一源；是否同时撤掉boss限定属于规则适用范围，不能仅改词 |
| [lifecycle:149](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.lifecycle.js:149)、[settle:125](/D:/素材/代号柒/搜打撤/game/src/hub/game.bag.settle.js:125) | 战后分别发送played/consumed；现行结算对二者都按UID去重进usedPocket。usedPocket是局内`{card,count}`聚合，不是战斗UID堆 | 不把未用discard/grave自动补进战后账本；取回清UID后避免后续再次结算已取回但未再使用的卡 |

发现的copy/move边界：现行[discover-flow:182](/D:/素材/代号柒/搜打撤/game/src/battle/effects/battle.discover-flow.js:182)只把牌库底未选UID放回，选中项随后仍走[232](/D:/素材/代号柒/搜打撤/game/src/battle/effects/battle.discover-flow.js:232)的`addTempCard`新UID；普通发现、直接施放、dup也生成新实例，不能当作原UID取回复用。此轮定向查阅未核实到独立墓地源发现的实际move接线；不因未找到就声明全库没有。若新增该取回方式，必须携带source UID并复用统一move端口。

框架协同：当前原模块旁已出现同名`.domain.js`及`battle.runtime.factory.js`副本；[engine.factory.domain:27](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.engine.factory.domain.js:27)装配这些域，而[engine.js:2](/D:/素材/代号柒/搜打撤/game/src/battle/core/battle.engine.js:2)此刻仍引原factory。统一端口合同先冻结，再由框架会话同步多实例域，不能只改旧门面得到两套牌堆语义。

无需再等洗回决策；已明确禁止自动洗回。建议本轮落地严格限定：纯投影/集中取回＋restoreConsumed的真实消费者，费用/墓地增伤由root另派，UI/解析归UI线；不顺带新增墓地发现玩法或改变装备可取回边界。
