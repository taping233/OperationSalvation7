# 第七轮 Battle 独立只读审查

结论：初次冻结版本的两项来源呈现/合堆问题已由作者修正，末节记录了新版三处生产差异和对应检查源的限定复核；未发现这两项闭包的新确定阻断。初审依据和具体问题仍保留，未将源码复核记为运行通过。本审查未编辑生产/检查源，未测试、编译或启动 Unity；初审当时Bag自有冻结清单保持一致。

## 版本与范围

- 输入：`battle-freeze.json` SHA256 `422dcd85eefbcbe5f99249aa1bc66af40e8ad4e66b79d46874fdd8d959ea6079`；审查开始时23/23文件的实际SHA与清单一致。
- 基线：第六轮已发布 `d8a8a2eb` / GUID `c3ee3347a03149de80bbb7fe3f0bb5c2`。已读本轮battle-audit的最终实现说明；现行Vite用于下面正式调用对照，未读/转译四个动作帧/idle在途路径。
- 核对CardDef、只读BattleCardPresentation、正式zeroCost/decay/transform/Mist写点、Boot/UI端口、卡面状态与原费、普通手牌/注能投影、编组和正式牌堆/阅读器/返回入口。领域18项与Native55项只读检查其构造与覆盖，不作为已执行通过。

## P2-1：迷之匣同面同费两次选择被实现元数据拆成两堆

**确定生产呈现差异。** `StructuredRules.cs:1000–1012` 的两轮共用同pool，第二轮未排除第一轮选择，因此真实迷之匣可以两次选同一ID、同一费用。第一张以原始granted实体＋费用override表示；第二张在发放前写入 `_baseCost` 以保留其原费。

此时两张卡的ID/名称/描述/当前费、有效费和 `CardPresentation` 的 Temporary、Transforming、Transformed、OriginName、BaseCost完全相同；第一张 `_baseCost` 为空，第二张有值。`CurrentBattlePileData.EffectiveKey:59–62` 在标准JSON已忽略该字段后，手动将它加回card key，使本来相同的两张生成牌分堆。

源 `battle.card-inspection.domain.js:180–191,194–201` 独立排两轮发现，`swapCardCosts` 只修改两个override的cost，未写该额外字段；`findEffectiveCard` 为两张相同原实体定义派生同一原费。源 `battle.pile-view.js:10–15,23–31` 在排除presentation.uid后应合为一堆。

最小建议：实际有 `Entry.State` 时，由 `State.BaseCost` 承担唯一的原费分组事实，不再将仅为Native实现原费而新增的 `_baseCost` 作为另一个不同字段。State为空的纯工具入口仍需保留该字段，确保现有“同有效费、不同原费分堆”断言不弱化。补真实两轮同ID选择后的source状态与pile key/UID完整性检查。未建议改变任何发牌顺序、实体UID或RNG。

## P2-2：普通手牌仍忽略来源状态合堆，新增标签只代表首个UID

**确定的当前遗漏。** `HandPanel.Group:155–168` 继续使用 `FindCard` 和 `BattleHandProjection.StackKey`，key只有id/费用/描述/有效费；`Sync:215–220`才读取首个UID的CardPresentation。因此普通手牌同时有永久火球和生成同面同费火球时，仍合并为×2，只显示首UID的来源标签。若首张是永久牌，生成牌来源标签被吞掉；若首张是生成牌，则整叠被标为临时。

当前Source实际链为 `battle.view.js:39,413,429`：hand经findEffectiveCard投影，再进入groupHandCards。`battle.hand.js:12–16` 明确把有效费/原费、temporary、transforming、transformed、originName加入key；上述两张牌应分开。这与本轮audit中“保持Source原合堆契约”的说明不符。

实际注能材料和数字键也复用该来源分组：Source `battle.infusion-material-state.js:5–10` 使用同一groupHandCards后展开物理UID；Native `HandPanel.cs:153–154,199–202` / `BattleHandProjection.InfusionShortcuts` 仍沿旧key。若统一状态key，应让普通可见组、实际注能可见组和数字UID序列用同一事实，保留物理UID顺序与原位选择合同，不能只改标签或只改快捷键。

已有R7 Native Piles夹具实际上创建了永久/生成/零费实体，但在打开牌堆前用正式命令逐UID打出，没有先断言手牌的两组可见状态，因此当前检查未捕获此项。建议在该真实夹具发牌后直接补手牌组/标签和逐UID归属，再继续原牌堆检查。范围是否纳入本片由Root协调，审查者未改Core或UI。

## 其余已核对结果

- `Cards.cs:40–45` 的 `[NonSerialized] int? _baseCost` 只存在CardDef运行时对象，MemberwiseClone保留。SaveJson的Stringify/Token仍用既有Newtonsoft默认成员契约＋RuleValue转换器，没有额外ContractResolver将非序列化字段重新纳入持久化。当前PhotoStudioExport通过SaveJson.Token和CardLibrary.All，变费写点均先Clone/override，不写目录。已有Native检查含真实Stringify不含字段断言，仍待Root执行。
- `GetCardPresentation` 从实际owned/granted查来源，未以UID前缀推断临时性；原实体名、实际override、变形标志和有效费均为只读查询，不创建整场Snapshot，不增加RNG。新变形写点一次捕获权威目标印刷费，避免UI查询时重复扫描目录。
- zeroCost发现设置所选当时费用，decay保留第一次记录，MemberwiseClone链保留它；显式ids/types/expire直发分支对应Source card-semantic-operations的实际门，未把该分支扩至源未记录历史的其它acquire路径。对Mist第二张元数据的分组副作用另见P2-1。
- 正式pile按每UID一次CardPresentation/描述Context，缓存供网格与阅读器；deck不造无消费JSON、不合实体UID，grave规范化复制数据，不排序/覆盖实际drawPile或丢UID。来源key除P2-1冗余字段外保留完整卡面/规则、有效费、原费和UID-free来源状态。
- `BattlePileScreen.SourceCurrent/OnClose` 约束实际BattleScreen、battle token、非终局和在栈状态，返场还要求Top为原战场、opener活跃可交互；旧会话不会把焦点交给新战场。阅读器由同一源守卫限制。关闭/销毁均恢复原前景，旧Close在UiStack不再持有该页时无效。
- 编组页保留当前池完整内容比较；候选版本/新battle使旧选择和阅读器过期。几何只在父尺寸、内容或确认文案变化后写，稳定帧保留必要尺寸比较；规则展开由既有布局组处理。未发现需要重开每帧全局Canvas强刷的依据。

## 限制

本报告是针对上述冻结版本的源码审查，不代表领域/原生/正常播放器通过；没有新截图或物理输入证据。来源静态标签不等于Source呼吸光晕已实现。上报后作者若修改清单或实现，必须按新版本补一次有界复核，不能用本报告原SHA替代。

## 两项修复的新版限定复核

作者已停源，新`battle-freeze.json` SHA256 `efbfa194efe2e117fdc07020d39400fff5c76ec516561f940b264180a18a44ed`（27项）。本次只追踪原两项P2的三处闭包，未把初审23项的结论扩写为对新27项的完整重审；Root持有的deckBottom候选UI消费不在此新增复核范围。

- `CurrentBattlePileData.cs` SHA `2c13b3063e93484cc3ef7de985efaeef15b7dc3c3c4f37281b447b69ade1828b`：有真实State时，key去除实现字段`_baseCost`，统一以`State.BaseCost`等实际来源事实分组；无State的纯工具仍保留该字段。原P2-1闭合。新Native源用真实迷之匣两轮同ID选择，检查两张实际生成卡合为一组且保留两个UID，并在finally恢复受控卡库。
- `BattleHandProjection.cs` SHA `0618c6f764c557d0497c7f460915b1465d0d6faf11e6636ab83c383bd6e2ffac`、`HandPanel.cs` SHA `6a9e83506ae601ebb45248f73b474541cc541ffa21100d0c11b995cd710d4cfc`：普通组使用每UID的CardPresentation状态key，原费/临时/变形/原名进入同一身份。真实注能候选和数字快捷键复用该状态key；先形成完整来源组，再过滤picked，剩余代表同步取其真实State，保留同组物理UID顺序。原P2-2闭合。
- 新领域/原生检查源直接覆盖正式生成后同面永久/临时组、注能实源拒绝、逐UID键序、选走首代表后同组剩余项位置及原键撤回。仍是待集中执行的构造命令/UI验收，不声称已运行或物理输入通过。未发现需要改动UID、规则消费或RNG的附加理由。
