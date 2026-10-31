# 文案与实际执行的独立核对

2026-10-30；只读源与 Unity 生产文件，未启动 Unity、构建、前台或修改生产。以本轮实际分支为依据，不从旧 passed 推断。范围为新指南六章的关键事实与职业技能提示，非所有卡牌/界面的穷举。

## 明确 P2：把倒下、普通战撤退与主动放弃写成相同带入牌损失

源 `game/data/beginner-guide.json:67`（Unity 迁入同字段）写“死亡或放弃会失去带入本局的全部卡牌”；`:86`又把“撤退或放弃”都说成带入牌丢失。实际规则区分三者，这两条原文不能作为迁移权威。

- 源 `game/src/run/game.session.death.js:141` 调用 `collectRescueCards(game.ownedCards,{pearlBoxId})`。`game/src/hub/run-rescue-cards.js:2-6` 的 `includeBrought` 默认 true：安全格卡、由安全格珍珠盒保护的盒内资源均按保护条件选择，带入标记本身不排除。
- 源 `game/src/ui/menu-leave.js:190` 主动放弃明确传 `includeBrought:false`，先排除带入牌，再按相同保护条件选卡。
- 源 `game/src/battle/core/battle.enemy-phase.domain.js:495-500` 的界面普通战撤退设置 surrenderedRun、走 `finish(false)` 的失败结算，不是主动放弃命令。
- Unity `GameRuntime.Settlement.cs:104-105,116,128` 对应 `RescueTerminal(...,true)`（倒下）与 false（放弃）；`BattleBridge.cs:77` 普通战撤退也进入 DoDeath。实现方向与源一致，无须更改结算规则。
- 可执行证据：本目录 `rescue.mjs` 直接导入真实源纯函数，死亡选择包含带入安全牌、带入安全盒和盒内带入资源；放弃仅保留新获安全牌与盒内新获资源。2026-10-30 运行退出 0、断言通过。该检查只证明选择规则，不代替终局持久化或原生操作验收。

建议只改 Unity 指南两条并保留源只读。loot 条标题“看清不同失败方式”，正文“倒下时，安全格中的卡牌和安全格珍珠盒保护的资源会被抢运，带入牌也按此规则处理；主动放弃会排除带入牌，只抢运符合条件的本局所得。未受保护的随身牌与消耗区卡牌会散失。” extract 对应条正文“点击普通战斗的撤退会结束本局，按倒下时的安全格抢运规则结算；主动放弃则不保留带入牌。烟雾弹等卡牌逃跑按各自效果处理。”

## 已对实际执行核实的事实

1. **普通战与首脑战的基线费/抽牌口径一致。** 源 rule-config.js:5 规定基础能量2、首脑起手5/回合1/手限8、编组15、初始攻击5；lifecycle.domain.js:339-356 普通战直接把随身可用战斗牌入手，只另建5张临时初始攻击牌库；enemy-phase.domain.js:127 对 boss 才固定抽回合牌。Unity GameRules.cs:12-17、BattleSession.cs:442-456/536-549/1186 对应。指南“基础能量”避免把装备/状态加成写成固定最终值，当前该表述可保留。
2. **紧急撤离、祭坛和终点条件一致。** Unity GameRuntime.Map.cs:94-110 明确献祭3张普通背包卡，排除safe、stored和pouchOf；紧急撤离只第三层。TryFinalExtract:112-115 要求第四层 extraction 与 bossDefeated。源 game.run.altar.js 的献祭/撤离业务及第四层拓扑按该链执行，指南有关三张、第三/四层叙述未见明确数值错误。
3. **“能原路返回”不能因为只有前向 door 描述就判错。** 源 map-generator.js:307 只建前进 door action，但跨层 next 双向；map-travel-path.js:46-48 直接返回真实相邻跨层边。Unity GameRuntime.Map.cs:32 的直接 next 判断也保留深层入口返回上一层闸门。因此指南地图 tip 可保留，无须生成额外 reverse door。
4. **成功撤离消耗区概率/排除规则一致。** 源 extraction.commands.js:193 对每张按 rule-config.extraction.pocketKeepChance=1/3 独立抽取，:130-136 再排除初始攻击与职业卡进入基地消耗区。Unity GameRuntime.Settlement.cs:39 使用同1/3，BaseData.cs:305 对 toPocket 排除职业/初始攻击；指南此条已区分概率和规则损失，可保留。基地背包16→30、每次2木材+1格；仓库25→100、每次2木材+3、当前容量达到50后再耗2符文；pet口粮2/3/4/5和安全格2→6(+咕嘎2)也与源 base.js:481-525、rule-config 和 Unity BaseData 属性/升级分支对应。

## 职业技能提示边界

`CurrentHeroSkillPresentation` 的费用使用当前 snapshot，效果基础数值（刺击2 fixed、圣疗3、惩戒3 spell、火球4 spell）、牧师翻面与搜刮 normal→手牌/道具栏、boss→排除道具后洗入牌库，与源 battle.bag.domain.js:420-438/515-590 及 Unity StructuredRules.cs:1007-1044 一致，未发现应更改技能结算的差异。

但3/4法伤是**基础值**：源该结算明确走法伤加成，Unity CombatResolver.cs:279-286 加 attacker.spellPower 与 spellUp；圣疗受禁疗与生命上限影响。当前提示沿源写“3/4点法伤”“回复3点生命”，不能把它当最终实际承伤/实际回血的证明。若后续校正文案，补“基础”即可避免误导，不应改实际规则；此次未擅自作此呈现变更。

此审查没有运行 Unity 或完整游戏，仅源纯函数选择检查实际执行；画面、持久化事务与输入仍由主会话新原生证据承担。
