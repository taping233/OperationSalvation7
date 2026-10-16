# 非宝箱发卡入口与恢复盘点

结论：当前标准卡库下，装备征用已在第三小批适配，宝箱、战斗宝箱、黑市命中与其他 openFixedRewardsOnCell 来源也已承接附赠。工具入口与自定义卡配置下的其他类型仍保留旧语义。以下为调用点静态盘点，除明确列出探针/回归的路径外，不等于真实 UI 通过。

## 仍直接使用 grantEventCard 的玩家路径

- event-card-choice.js：药摊/装备征用选中主卡。nodeRewards 保存 event-choice 的 cardIds、付款、taken；当前 only taken=null 才恢复。标准装备池可包含史诗装备阿猫，药水池不含当前阿猫。第三小批已让所选阿猫整体转入固定领奖页，taken 先锁选择，主卡和附赠的实际领取均走同一 chestReward；正常其他卡仍即时领取/关闭。真实 loadGame、付款与双重保存失败已回归
- game.run.flow.js / openResourcePick：二选一资源，resource 记录冻结候选和 taken，原节点可恢复；标准资源池排除装备阿猫
- game.run.flow.js / runInstant 的 wood/rations/key：固定 tt-wood / tt-rations / tt-key，既有旧型节点拾取，普通 visited 检查点，无独立待领记录。这些固定 ID 不会成为阿猫；原满包吞基础奖励已由先前审查记录，本次不重复定性
- game.run.flow.js / tt6-systemsupply：固定木材卡 + 碎片，由 settle 保存并结束；阿猫 ID 不可达
- game.run.flow.js / narrative demondeal_trade：随机传说装备/武术/法术，由 settle 保存并结束，无独立失败待领记录。当前阿猫是史诗，且标准 tt6-demondeal 由 V2 分支优先走大宝箱；这个旧叙事分支的正常新局可达性未证实
- game.run.altar.js / fireRestGo：额外本职业卡，由 fire 节点记录 classCardId/bonusReceived，容量失败规则与提示已明确不获得；当前阿猫不在职业池
- game.run.altar.js / altarFragHero：以 2 碎片兑换本职业能力卡，发卡成功才扣碎片/激活；普通存档保存，未领取无消费。当前阿猫不是能力卡，不可达
- game.bag.settle.js / settle：首脑保证额外传说、巨兽概率额外传说，经 game.grantCard 调同一 grantEventCard。标准阿猫稀有度不匹配，不会触发赠卡；但该额外传说自身满包拒收后仍终结，另有 2 项真实控制器探针。战后 journal/requestId 与 rewardsApplied 能防重复提交，却不补救本次被拒的奖励

## 工具与旁路

- game.run.dev.js / devcCard：开发控制台可显式指定阿猫，普通内存/Run 检查点，没有附赠待领记录。不是当前自然玩法抽取入口
- game.run.js / bindRunMixins：只是把 game.grantCard 挂到 grantEventCard，不独立发卡；全量 .grantCard 调用检索除 Chests 仅见上述战后额外传说与开发控制台
- 故障重编直接替换 entry.card，不经 grantEventCard；可以在同稀有度装备池内转为阿猫，但“转换是否应触发随机获取”属于玩法口径，当前没有把它认定为已确认缺陷
- 普通商店直接向 ownedCards push；研究所向 cardBox push；基地向 stash 事务入库。它们不经过本地图随机获取触发器，本次没有擅自改变购买、转换、回收或基地奖励的 onAcquire 语义
- 卡牌编辑器允许改卡配置。若把阿猫改成传说、资源或职业卡，上述可达性可能改变；本清单的排除结论只对当前标准配置成立

## 已实施的第三小批：装备征用复用现有待领奖框架

最终采用不扩 node schema 的整体移交，替代先直接发主卡再转交附赠：

1. 所选卡是阿猫时先核对 restore/serialize 与固定领奖端口；端口缺失不发卡、不掷附赠
2. 先锁定 event-choice.taken 并消费节点，再同步把所选主卡交给 openFixedRewardsOnCell。主卡没有直接入包，因此接收失败可恢复原选择而不回滚已发物品
3. 两次内部/外部 Run 保存都同时含付款、锁定、visited 和主卡待领。若前一次成功后一次失败，已成功快照也完整；两次失败时仍保留原持久选择与当前内存待领，不存在复制发卡
4. 实际主卡在固定页领取后，已修复的 Chests 把附赠追加为独立待领；现有 loadGame 先恢复 chestReward，背包返回也走原 Chests 流程
5. 13 项专测包含真实 loadGame/RunStorage、缺端口、false/异常接收器、保存失败、满包、旧页面回调、正常非阿猫保持原行为。没有为该路径新增存档 schema 字段

首脑/巨兽额外传说自身的满包拒收仍需另批处理；其 journal 完成不能替代独立待领奖。开发控制台与自定义配置下的更广泛 onAcquire 语义没有在本轮扩展。
