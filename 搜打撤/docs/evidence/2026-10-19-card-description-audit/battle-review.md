# 武术、法术、装备描述语义审查

177 张逐 ID 已落状态：武术64、法术79、装备34。确认 16 张存在差异（9组机制）；141 张在所列源码/场景范围内未见冲突；8 张待定口径；12 张证据未闭合。

本轮只读审查，不改生产效果。以卡面实际显示文字为准，包含 displayCardDescription 展开，不按原始简写或卡名猜机制。

最终集中探针 **75/75**，结果见 [battle-probes-final.json](battle-probes-final.json)，原始数值见 [battle-observations.json](battle-observations.json)。探针断言当前现状，含已确认错误；通过不能解释成效果正确。测试用真实 resolver、Combat、发现流程和受控内存 BattleSession，没有浏览器实页、玩家存档、build 或全量测试。第一轮13/14的夹具错误报告保留。

## 已确认差异

- **B01 铁甲阵把减1费执行成0费**（铁甲阵/tt7-ironphalanx）：固定真实2费风暴火球模板的5张获取，实际全部0费；卡面应全部1费。 建议：新增/复用实例费用减1的动作，最低0，保留模板和牌库去向。
- **B02 5张“招式”获取/发现池漏法术**（基础开发/tt12-basicdev、突破进展/tt12-breakthrough、魔法新发现/tt12-magicfind、高端研发/tt12-hitechrd、厄运/cmtn1gfhczzj）：现行术语招式=武术+法术；0/1/2费及诅咒招式的实际谓词只允许武术。高端研发独立structured moves池也只允许武术。二刀流可见说明本来只武术，不列入。 建议：统一招式池为武术+法术，同时保留费用/诅咒限制；不要改变明确只写武术的二刀流。
- **B03 充能射线计入未在手时的注能**（充能射线/tt12-chargeray）：先将本场计数设3，再新入手本牌，期间不再注能，真实出牌造成11而非5。 建议：按实例在手窗口累积注能数，保存/恢复时保持该实例计数。
- **B04 寒冰剑装配后没有冰冻增伤**（寒冰剑/tt2-frostsword）：真实装配后攻5初始攻击命中冰冻敌人仅5而非7；卡库hosted声明没有伤害入口读取的equip.passive.cond.vsFreeze。 建议：把既有冰冻被动与本卡声明接通，单一路径保证任意合法伤害只加2一次。
- **B05 飞身劈当次不翻倍，后续反而持久翻倍**（飞身劈/tt3-fly-arrowhawk）：攻5、目标流血2：飞身劈实际10而非12；随后初始攻击实际9而非7。 建议：将加成绑定本次攻击的流血部分，移除本卡持久规则登记，保留其他来源旗标。
- **B06 充能火球首次打出前不成长**（充能火球/cmtn1lbhbqi4）：本牌由第1回合持有到第2回合开始，首次施放仍4而非5；成长名称仅打出时登记。 建议：在有效进入战斗牌区时登记成长副本/机制，避免要求先打出一次。
- **B07 正午决战延迟后丢失原目标**（正午决战/tt3-noon-duel）：选择第二名且其一直存活，下回合四枪打第一名：血量从[1000,1000]变[992,1000]，应[1000,992]。 建议：延迟任务保存稳定目标标识；目标仍存活时保留，失效时再沿明确公共回退规则处理。
- **B08 临时卡到期消耗漏4张装备的消耗触发**（沉船宝盒/tt2-wreck、百炼青虹剑/tt3-azure-sword、矿工炸药/tt3-sapper-bomb、奥术残卷/tt7-arcanescroll）：真实addTempCard后经consumeTemps回收，UID确实进入consumed，四种奖励均0；相同卡走正常消耗钩，分别随机2、攻击5、固定4、抽3，正对照有效。 建议：让到期消耗复用统一消耗钩，每张仅一次，保留原注能侧效果和终局取消守卫。
- **B09 闪避卡面第1段伤害，实际仅攻击**（闪避/tt3sp-dodge）：有1层闪避时先受固定3，实际扣3且闪避仍1；与当前可见卡面“避开第1段伤害”不符。旧代码注释记载09-20攻击型裁决，保留此历史冲突供后续按本轮卡面准则处理。 建议：按本轮“效果以描述为准”接通第一段合法伤害；若仍沿旧攻击型规则，则须老板明确改卡面，本次审查不自行选择。

## 待定口径

- 连续射击（cc-rapid-fire）：此前N张招式是总段数N，还是首句2点之外再追加N段？已重现0张为0伤、2张为4固定。
- 惩击（tt7-smite）：“本次伤害+50%”是否包含法伤？已重现半血、法伤2时17；完整伤害乘1.5则18。
- 冷冻射线（tt12-freezeray）：“未受伤”是否表示当前满血？实现只比较本次伤害前hp与maxHp，没有历史受伤状态；受伤后回满的分歧未实跑。
- 坚冰结界（tt3-firm-barrier）：“1名角色”是否允许玩家/友军？实现只敌方，本轮不把语义范围推测报为bug。
- 花鸩（tt3sp-flowerzhen）：“1名角色”是否允许玩家/友军？实现只敌方。
- 禁言术（tt7-silence）：“1名角色”是否允许玩家/友军？实现只敌方。
- 诛魔剑（tt8-demonslay）：玩家可见描述明确合成效果尚未定稿；只读确认抽到群攻，合成不能标完成。
- 天启剑（tt8-heavensword）：玩家可见描述明确合成效果尚未定稿；只读确认抽到额外抽1，合成不能标完成。

## 未闭合证据

- 不朽斩（cmtn233trmeg）：主体攻击/回手/禁注能已读；满手时兜底进弃牌与“始终保留”有条件差异，未构造真实满手来源链，不先报确定bug。
- 搜索大宝箱（cmtn28jv33wx）：普通随机3、首脑有牌底部发现已读；首脑空库会回落随机3，与卡面分支可能冲突，未实跑空库，不先报确定bug。
- 法力奔涌（cc-mana-surge）：随机法术池含时点容器/发现/抉择等复杂法术，未逐机制实跑四发及嵌套队列。
- 腐化之种（cc-rot-seed）：未复造标记死亡的完整触发链；不能只凭标记赋值证明全体真伤与死亡时毒层一致。
- 剑荡妖邪（tt3-frostfall）：未实跑选择武术、取消及第二张牌目标/消耗的完整链。
- 血毒双镖（tt7-bloodpoison）：未实跑完整两次指向、重复目标与首段击杀后第二段。
- 神灯（tt3-magic-lamp）：未完整复核三分支的输入、目标合法性与取消。
- 扰敌（tt7-provoke）：未实跑前者击杀后反击取消、两次选择顺序。
- 法师锦囊（tt7-stratagem）：未在本批走存入3牌→普通/首脑使用→母本移除→回库全链。
- 永恒绽放（tt7-bladebloom）：发现扩大到4候选时，当前循环把其余全部入手，而卡面固定其余2张；未实跑黑暗形态组合，不先报确定bug。
- 迷之匣（tt3eq-mistbox）：已读真实双发现武术+法术与费用交换；未实跑两个面板的选择结果绑定。
- 自然法杖（tt7-naturestaff）：未实跑选中卡在下回合前离开手牌/再入手的零费绑定。

## 逐卡覆盖

每行完整可见描述、普通/首脑入口、目标、成本、触发、去向、精确源码引用与缺口均在 [battle-review.json](battle-review.json)。consistent 表示本行范围内核对未见冲突，不能读作每张都已逐场实战。

| ID | 名称 | 状态 | 核对结论 |
| --- | --- | --- | --- |
| cc-chase-slash | 追斩 | consistent | 攻击力等值；费用只按此前其他武术数减1，不把法术或本牌计入。 |
| cc-cursed-blade | 诅咒之刃 | consistent | 攻击力+3；伤害后扫描当前手牌的武术和法术，叠层诅咒求和、计时诅咒取最大；原目标死亡不串给其他敌人。 |
| cc-demon | 恶魔之力 | consistent | 7法术与2自伤；击杀末敌后自伤被已有终局守卫中止，属于明确现行公共规则，不作为新差异。 |
| cc-double-boom | 二次爆炸 | consistent | 对全部活敌基值3法术伤害。 |
| cc-dual-wield | 二刀流 | consistent | 当前可见文案明确写武术；发现后本体与复制共2张入手，不能因内部池名“招式”把此牌误报为法术池错误。 |
| cc-ember-burst | 余烬爆裂 | consistent | 全体基值2法术；本次杀敌则对剩余敌人额外重放伤害1次，不无限递归追杀。 |
| cc-last-stand | 破釜沉舟 | consistent | 攻击力+3；末手追加同一伤害段1次；常驻保留手牌不计末手条件，沿既有战斗约定。 |
| cc-lava-blast | 熔岩爆破 | consistent | 单体9法术，随后获得具名二次爆炸1张；末敌全灭会按公共守卫中止后续获取。 |
| cc-mana-surge | 法力奔涌 | not-verified | 宿主按4次从可随机法术池抽取并给随机活敌，以infused=true结算；复杂随机法术的嵌套选择/时点容器本轮没有逐种实跑。 |
| cc-poison-burst | 毒爆 | consistent | 读取目标当前中毒，连续触发2次毒伤；不额外先施毒。 |
| cc-rapid-fire | 连续射击 | needs-decision | 执行器总段数取此前招式数N；此前0张时0伤害，2张时2×2固定伤害。是否还含卡面首句的基础1段未定。 |
| cc-rot-seed | 腐化之种 | not-verified | 给原目标2毒并标记，死亡钩按死亡时毒层全体真伤；本轮仅读标记与死亡宿主入口，死亡触发实际链未复造。 |
| cc-unmoved | 不变应万变 | consistent | 当回合格挡并获得4甲；真实伤害与破甲按现行战斗公共防御顺序绕过格挡。 |
| cmtn0pbkmnvc | 流光照影 | consistent | 读取目标全部诅咒值之和，逐次施放初始攻击，原目标死亡即停止；计时诅咒当前也按剩余值计数。 |
| cmtn0xt0zr7 | 闪金之锤 | consistent | 固定5伤害；仅本段实际击杀时原子结算2币，不靠后续泛用击杀重复发放。 |
| cmtn125e1nk0 | 神秘召唤 | consistent | 现行可见卡面只写传说，池谓词也只传说；没有旧版“或能力卡”文案的误报。 |
| cmtn1epgt20j | 灵能召唤 | consistent | 发现注能牌，只有选中实例附_noInfuse；燃料不消费，主效果按已注能结算，不改模板。 |
| cmtn1gfhczzj | 厄运 | mismatch | 能施咒的招式池追加仅武术谓词，排除了满足条件的法术。 |
| cmtn1i64j7y7 | 盗宝 | consistent | 发现1张装备；过滤装备类型，选中后临时入手。 |
| cmtn1lbhbqi4 | 充能火球 | mismatch | 成长名只有打出时才登记；首次持有经过回合开始没有+1。 |
| cmtn1ntxzoc4 | 火焰形态 | consistent | 自身法伤增益1，持续本场，重叠按值相加。 |
| cmtn1p9vb5au | 千变万化 | consistent | 发现形态名池并免费直接施放；不是随机立刻发卡。 |
| cmtn1r10xnl1 | 黑暗形态 | consistent | 注册discoverPlus，使后续每次发现候选数3+N，增加候选不增加可选次数。 |
| cmtn1wnhhym | 江湖救急-改 | consistent | 固定身份直接随机入手3张临时卡，下一回合开始消耗尚未使用的这些UID；不是旧江湖救急的发现施放。 |
| cmtn233trmeg | 不朽斩 | not-verified | 攻击力+1；出牌后回手并禁止注能。满手兜底会进入弃牌堆，本轮未复造这一边界。 |
| cmtn28jv33wx | 搜索大宝箱 | not-verified | 首脑有牌库时从底3选1、其余原序放回；普通战走随机获取3；空牌库时首脑退回随机分支，本轮未定性这一空库口径。 |
| cmtn2jc142dj | 刀剑形态 | consistent | 打出后登记回合开始复制随机手牌；空手不复制；复制对象以真实手牌UID抽取。 |
| cmtna0nb1yxt | 法力光波 | consistent | 单体基值5法术。 |
| starter-attack | 初始攻击 | consistent | 攻击伤害基值0，由Combat统一加攻击力；没有额外固定5伤害。 |
| tt12-backupcell | 后备能源 | consistent | 抽2并回满能量；只按本场consumed中的法术降费，普通discard/单独grave/旧usedPocket不计，可见文字已明确。 |
| tt12-barriermend | 屏障修复 | consistent | 自身6甲；费用在打出前按当前0甲判断，非结算后判断。 |
| tt12-basicdev | 基础开发 | mismatch | 0费招式池仅武术，未覆盖法术。 |
| tt12-breakthrough | 突破进展 | mismatch | 分别0/1/2费各1张数量正确，三池均只武术。 |
| tt12-chargeray | 充能射线 | mismatch | 读取本场全局infuseFuels，没有记录该副本何时在手；迟入手错误吃到此前注能。 |
| tt12-elemburst | 元素爆裂 | consistent | 4或5段，每段基值2法术且每段随机重新选活敌；随机区间含端点。 |
| tt12-felguard | 邪能护体 | consistent | 必须支付2燃料；抽3、当回合immune与诅咒免疫；恢复窗口保留此前永久免疫来源。 |
| tt12-firecracker | 违禁烟火 | consistent | 全体1固定，法伤不加成。 |
| tt12-freezeray | 冷冻射线 | needs-decision | 用本次伤害前当前满血判定，不记历史受伤；“未受伤”究竟当前满血还是从未受伤需语义裁定。 |
| tt12-hitechrd | 高端研发 | mismatch | 真实发现structured moves/cost2只匹配武术；所选实例以后每回合-1的延迟绑定本身已读。 |
| tt12-infectray | 感染射线 | consistent | 4法术、1个随机诅咒；候选来自公共CURSES中实现支持列表，计时型默认1回合。 |
| tt12-magicfind | 魔法新发现 | mismatch | 发现所选0费修饰正确；1费招式池漏法术。 |
| tt12-raydragon | 龙焰射线 | consistent | 必须1张燃料才可打出，基值11法术；取消注能不扣费不烧牌。 |
| tt12-raygun | 射线枪 | consistent | 装备后主动技能每场一次，发现射线法术并免费直接施放；发现池排除射线枪及unrandom职业版。 |
| tt12-saturate | 饱和打击 | consistent | 基值7法术，击杀时额外重放1次给剩余活敌，不无限连锁。 |
| tt12-sporewall | 孢子城墙 | consistent | 目标2毒、自己6甲。 |
| tt12-unstableray | 不稳定射线 | consistent | 每次施放从4/5/6等距随机基值，之后加法伤。 |
| tt2-apollo | 阿猫的礼物 | consistent | 战斗获取时能量+1且额外随机1张，排除自身递归；战外没有战斗能量，只额外发卡，本支未重新实跑战外入口。 |
| tt2-block | 格挡 | consistent | 本回合格挡；真实伤害/破甲的公共穿透规则仍适用。 |
| tt2-bloodblade | 嗜血刃 | consistent | 攻击力+2，按结算伤害回复，包含过量；可见描述已明确这一口径，禁疗时回复失效。 |
| tt2-comboarrow | 连击箭 | consistent | 攻击力-1；上一张打出牌类型是武术时本实例出牌0费，其他类型不会触发。 |
| tt2-forestarrow | 回音箭 | consistent | 攻击力-1，随后获得3甲。 |
| tt2-frostsword | 寒冰剑 | mismatch | hosted保留卡面，但伤害入口只认rules.equip.passive.cond.vsFreeze；本卡缺该结构，穿戴无+2。 |
| tt2-jianghu | 江湖救急 | consistent | 发现其他职业非能力卡，直接施放选中实例并免其正常费用；仍走对应玩法合法性与注能守卫。 |
| tt2-pearlbox | 珍珠盒 | consistent | 背包资源容量每盒9张且只收资源，所有资源种类可放；不要求装备后才扩容。 |
| tt2-piercearrow | 破甲箭 | consistent | 玩家现行描述是攻击力-1与自己获得3甲；并非给敌方破甲，不按卡名推导额外效果。 |
| tt2-shoot | 射击 | consistent | 固定2伤害，不加攻击力或法伤。 |
| tt2-swiftarrow | 迅疾箭 | consistent | 攻击力-1，随后抽1；普通战依规则改发初始攻击。 |
| tt2-treasuremap | 寻宝图 | consistent | 主动技能洗入具名搜索大宝箱，再抽1；装备卡本身因“洗入”普通战门禁，首脑可用。 |
| tt2-turtlearmor | 铸甲 | consistent | 预检与真正提交均要求另外1张装备手牌；支付整组完成后才付费并得10甲，取消不支付。 |
| tt2-venomstaff | 毒杖 | consistent | 穿戴不立即施毒；随后每张法术结算后对随机活敌加1毒，武术不触发。 |
| tt2-wreck | 沉船宝盒 | mismatch | 正常显式消耗得2随机卡；到期临时卡消耗漏同一钩。 |
| tt3-armor-rush | 破甲急袭 | consistent | 攻击力+4，原目标存活才加2层流血；死亡后不转移附加。 |
| tt3-arrow-rain | 箭雨 | consistent | 同一段覆盖全部存活敌人，每个按攻击力-1结算。 |
| tt3-azure-sword | 百炼青虹剑 | mismatch | 正常显式消耗排队施放一次初始攻击；到期消耗不触发。 |
| tt3-bandage | 包扎 | consistent | 回复3生命并得3甲；禁疗只阻断回复。 |
| tt3-blood-arrow | 血箭 | consistent | 攻击力-1，随后给原目标1层流血。 |
| tt3-blooddrinker | 饮血剑 | consistent | 穿戴登记击杀监听，每真实击杀一次+1攻，群杀按数量，持续本场。 |
| tt3-chain-lightning | 闪电链 | consistent | 2段，各3基值法术，不是自动群体；目标死亡时沿公共规则顺延。 |
| tt3-chaos-eye | 混沌之眼 | consistent | 仅首脑编组勾选生效，牌库上限+5，开战生命上限及当前生命+10；普通战不自动生效。 |
| tt3-crimson-pouch | 深红丝袋 | consistent | 装备后主动选择1张手牌复制，原牌保留；无手牌不耗主动次数。 |
| tt3-deep-diary | 深海咒印 | consistent | 穿戴期间根据自己是否诅咒动态增减攻2/法伤2，净化后回收差值，不是一次性永久加成。 |
| tt3-dig-treasure | 挖宝 | consistent | 普通战被牌库门禁；首脑从真实牌库底取候选，选中后才按价格加甲，不沿用前一次抽牌价格。 |
| tt3-double-shot | 连射 | consistent | 3段，每段固定2；有其他敌人时可沿公共分段规则继续。 |
| tt3-element-seal | 元素符印 | consistent | 穿戴后检查本场累计真实注能燃料>=3，一次解锁法伤2与抽2；免注能标志不虚增燃料数。 |
| tt3-execute | 斩杀 | consistent | 可见描述“不超过9”与实际<=9一致；是9点真实伤害，不是无条件移除或秒杀。 |
| tt3-fatal-pierce | 致命穿刺 | consistent | 攻击力+1；目标原有流血才加2并附1回合破甲；门槛在本次伤害前读取。 |
| tt3-fate-wheel | 命运钟表 | consistent | 主动消耗全部手牌并逐张触发消耗，设置额外回合；下一次结束回合跳敌方但仍走回合开始成长/抽牌。 |
| tt3-fireball | 火球 | consistent | 单体4基值法术。 |
| tt3-firm-barrier | 坚冰结界 | needs-decision | 只能指向敌人并只延长已有冰冻，不创造新冰冻；“1名角色”是否含玩家/友军未明。 |
| tt3-flame-storm | 风暴火球 | consistent | 每名活敌各一次4基值法术，采用火球的数值效果。 |
| tt3-flux-slash | 流光斩 | consistent | 攻击力-1、流血2、具名流光照影洗入牌库；普通战牌库词条禁止打出。 |
| tt3-fly-arrowhawk | 飞身劈 | mismatch | 结构化伤害清空desc使本次流血翻倍未命中；之后注册永久bleedAmp，影响后续攻击，时机和范围都不符。 |
| tt3-frost-slash | 霜月斩 | consistent | 攻击力+2，原目标附冰冻与禁疗各1回合，不把死亡目标的诅咒转交其他敌人。 |
| tt3-frostfall | 剑荡妖邪 | not-verified | 宿主先攻击力+5，再手选武术免费施放；尚未完整实跑选择/取消/目标递交。 |
| tt3-grass-armor | 草甲 | consistent | 穿戴时只结算一次5甲；结构化装备抑制旧文字避免双发。 |
| tt3-grope | 摸索 | consistent | 随机抽2或3；普通战改发对应数量初始攻击。 |
| tt3-hold-fast | 坚守 | consistent | 5甲、抽1。 |
| tt3-holy-shield | 圣盾 | consistent | 6甲，打出前0甲时0费。 |
| tt3-holy-staff | 圣杖 | consistent | 主动先净化自己再回5，因而当次可以解除禁疗后治疗；每场一次。 |
| tt3-holy-water | 治愈 | consistent | 先回复5后净化自己，禁疗时本次回复不会因后续净化倒补。 |
| tt3-ice-spike | 冰刺 | consistent | 2法术后冰冻原目标1回合，原目标死亡不转冻其他敌人。 |
| tt3-immortal-blade | 骷髅王剑 | consistent | 首脑编组勾选，令每张初始攻击以不朽斩形态发出；可见说明已改“每张”，不误报为全部合并1张。 |
| tt3-life-arrow | 生命箭 | consistent | 攻击力-1，随后通用随机池临时获得1张；未击杀末敌的探针覆核了伤害。 |
| tt3-light-mail | 急速跑鞋 | consistent | 穿戴本身不抽；发动主动抽3，每场一次。 |
| tt3-longsword | 长剑 | consistent | 穿戴光环攻+1，结构化路径单次叠加。 |
| tt3-magic-lamp | 神灯 | not-verified | 三分支分别发现施放/处决受伤非BOSS/冻2加5甲；未逐分支实跑选择与取消守卫。 |
| tt3-master-staff | 大法师之杖 | consistent | 穿戴登记每回合开始法伤+1，持续本场。 |
| tt3-nature-form | 满月形态 | consistent | 自身能量上限+1；引擎当前也补当前能量1，沿公共增加上限规则。 |
| tt3-noon-duel | 正午决战 | mismatch | 确实延迟下回合4×2固定；队列没有保留选中目标，实际打首个活敌。 |
| tt3-nuke-ray | 致命射线 | consistent | 8法术后随机3种不重复诅咒，数量不足按公共候选数限，不复制同一种冒充3种。 |
| tt3-petal | 花瓣法阵 | consistent | 打出登记回合开始抽1回复3，容器计数3次后移除；不是当场先触发一次。 |
| tt3-purify-arrow | 净化箭 | consistent | 攻击力-1，随后净化自身全部诅咒，增益不属于净化清除范围。 |
| tt3-qi-wave | 气功波 | consistent | 先抽1，取本次真实lastDrawn价格，独立固定伤害路径对全体结算；无可折算新牌则0，不附加攻击/法伤。 |
| tt3-reshot | 重斩 | consistent | 攻击力+2。 |
| tt3-reverse-bow | 连弩 | consistent | 主动扫描所有名称含箭的手牌逐张免费施放，每实际施放抽1；本轮只读自动出牌队列，未重跑多箭与抽到新箭组合。 |
| tt3-sapper-bomb | 矿工炸药 | mismatch | 正常显式消耗向目标固定4，未指定时首个活敌；到期消耗漏钩。 |
| tt3-silver-runesword | 诅咒之剑 | consistent | 穿戴即时攻+2，并注册每次回合开始自伤2；自伤过死亡保险入口。 |
| tt3-skewer | 穿刺 | consistent | 攻击力+2，原目标破甲1回合。 |
| tt3-staff | 法杖 | consistent | 穿戴法伤+1，结构化光环避免文字双算。 |
| tt3-thornfield | 棘刺之地 | consistent | 每个活敌先加2毒，再立刻引爆其全部当前毒1次；不是只有新增2毒。 |
| tt3-thunderblast | 雷殛 | consistent | 基值7；首脑墓地法术每张+1；普通战墓地加成为0，公共模式规则。 |
| tt3-toxin | 毒药 | consistent | 目标1毒、抽1。 |
| tt3-treasure-hunt | 寻宝 | consistent | 4法术，随后通用发现1；末敌全灭后不再开选择。 |
| tt3-twinwater-mail | 冰甲 | consistent | 我方成功施加freeze事件后获得3甲；对多个敌人逐个冻结逐个触发。 |
| tt3-venom-arrow | 毒箭 | consistent | 攻击力-1，原目标中毒1层。 |
| tt3-wave-slash | 破浪斩 | consistent | 攻击力+3；设置下次回合开始禁抽，兑现后清除。 |
| tt3-wolf-bow | 天狼长弓 | consistent | 穿戴登记回合开始从箭系列名池随机1张并将其模板实例置0费，不生成名称不存在的随机空卡。 |
| tt3eq-mistbox | 迷之匣 | not-verified | 实际双发现谓词包含武术和法术，选2实例共用pair再交换费用；未实跑完整双面板输入。 |
| tt3sp-bloodstorm | 血蝠风暴 | consistent | 全体3基值法术按结算总伤吸血含过量；可直接打，选择注能2后伤害/回复共2轮。 |
| tt3sp-devour | 吞噬 | consistent | 只可选基础攻击<=4的非BOSS敌人；预检拒绝非法目标不烧卡；消灭经真实伤害公共免疫规则。 |
| tt3sp-dodge | 闪避 | mismatch | 文案第1段伤害没有类型限制；Combat只免下一次攻击，固定/法术/真实均命中且不耗闪避。 |
| tt3sp-flowerzhen | 花鸩 | needs-decision | 翻倍再引爆目标全部毒1次；实际只敌方，“1名角色”是否包含自己/友军待明。 |
| tt3sp-magicoil | 药水魔法 | consistent | 只从道具且名称药水的池发现，排除法术药水魔法自身；选中免费直接施放。 |
| tt3sp-shadowbug | 影噬 | consistent | 取选中敌人基础攻击至1的差额，给玩家同期临时攻击；回合管线归还，低于阈值不反向增加。 |
| tt3sp-shadowshot | 暗影射击 | consistent | 先3法术；目标有任意诅咒时再3一次，公共终局守卫可中止。 |
| tt3sp-silverthorn | 镭射 | consistent | 可直接5法术；可选注能1后8法术，并非强制注能才能打。 |
| tt3wu-shike | 割蚀 | consistent | 攻击降低量2、持续3回合并附流血1；到期按真实扣减量归还。 |
| tt5-galaxy-voyage | 银河之旅 | consistent | 同时设置武术和法术1费；不把装备/道具纳入“招式”。 |
| tt7-abysscurse | 深渊诅咒 | consistent | 7法术、禁疗1回合，再按此时目标诅咒种类抽牌；包含刚施加的禁疗。 |
| tt7-arcanebolt | 奥术弹 | consistent | 宿主1基值法术、抽1。 |
| tt7-arcanescroll | 奥术残卷 | mismatch | 正常显式消耗抽3；到期消耗漏钩。 |
| tt7-armup | 武装 | consistent | 首脑从牌库定向抽2装备；普通战无牌库，沿现行公共抽牌约定改发初始攻击，属于规则边界。 |
| tt7-bladebloom | 永恒绽放 | not-verified | 发现选1免费施放，其余实际候选全部入手；黑暗形态扩大候选后可能多于2张，本轮未实跑组合。 |
| tt7-bloodpoison | 血毒双镖 | not-verified | 两段分别血/毒，可重复选敌；已读首段与第二次点选挂点，未实跑完整双指向输入。 |
| tt7-bloodpotion | 噬血术 | consistent | 3法术，按结算伤害吸血含过量，禁疗时回复失效。 |
| tt7-bulwark | 坚盾 | consistent | 8甲；虽然DSL字段名decayAtTurnEnd，真实任务在下回合开始减4，可见描述已对齐，不误报字段名。 |
| tt7-burnharvest | 爆燃火球 | consistent | 5基值法术，额外补一份当前法伤使总加成为2倍，不放大基础值。 |
| tt7-darkfort | 黑暗吊坠 | consistent | 一次致死保险保留生命并在该回合给immune；普通受伤/自伤都使用该保险入口，随战斗重置。 |
| tt7-demonbreaker | 破甲重斩 | consistent | 攻击力+5、破甲2回合；实际本段击杀时原子得4甲。 |
| tt7-elementstorm | 元素风暴 | consistent | 设置下张法术重放1次；代码会在本牌收尾自重放并重新登记旗标，最终保留给下一张；叠加多张的细节未实跑。 |
| tt7-energize | 聚能 | consistent | 当前能量+1，不强制钳制能量上限。 |
| tt7-frozenight | 冰封千里 | consistent | 全体活敌附冰冻1回合，无需指定单体。 |
| tt7-fullstrike | 全力一击 | consistent | 攻击力+5、抽1。 |
| tt7-ghostblade | 鬼魅之刃 | consistent | 攻击力+1；只在本牌实际破除自己的潜行且伤害成功时+2并抽2，敌方潜行不算。 |
| tt7-goldencicada | 金蝉脱壳 | consistent | 先消耗除已出牌自身外全部手牌，逐张触发消耗钩，再抽3；不混用首脑弃牌循环。 |
| tt7-holyglow | 沐愈光辉 | consistent | 生命低于12才补到min(12,maxHp)，不把高于12的生命降下来；禁疗仍拦截。 |
| tt7-holyheal | 圣光治愈 | consistent | 强制1燃料，按燃料价格sellPrice的2倍回复，不按费用字段，0价可0回复。 |
| tt7-imitate | 不变应万变-改 | consistent | 原始形态不可直接打出；持有期间打出武术后，本实例被override成其1费复制，不污染收藏母本。 |
| tt7-ironcharge | 厉兵秣马 | consistent | 12甲、抽2。 |
| tt7-ironphalanx | 铁甲阵 | mismatch | 实际act=zeroCost把所有随机模板改成0费，而卡面是均减1费。 |
| tt7-livingwater | 圣光之源 | consistent | 抽5，普通战发5张初始攻击。 |
| tt7-marchrush | 急行军 | consistent | 抽2、甲2；末手整卡额外重跑1次，普通战抽牌替代及常驻牌末手口径适用。 |
| tt7-maxsupply | 法力补给 | consistent | 以打出后真实手牌数补齐到4，首脑库空/满手停止；不是固定抽4。 |
| tt7-meteorrain | 流星箭雨 | consistent | 两段攻击力-1，原目标死亡时后续段可改选活敌；非群体。 |
| tt7-meteorstrong | 星陨之力 | consistent | 强制2燃料后施放3次火球，每次基值4法术并加当前法伤。 |
| tt7-naturestaff | 自然法杖 | not-verified | 主动先选手牌，再下回合将所选实例置0费；未实跑选择对象在到期前出牌/移区等边界。 |
| tt7-provoke | 扰敌 | not-verified | 宿主交给两次敌方点选并按先后互殴；未实跑选择顺序、首击死亡时反击抑制。 |
| tt7-recruit | 征召 | consistent | 召唤2个攻4血4有实体随从，随从位默认优先承伤、敌方阶段自动攻击；不是给玩家+4攻。 |
| tt7-silence | 禁言术 | needs-decision | 敌方沉默1回合、抽1；卡面“1名角色”是否允许自己/友军未明确。 |
| tt7-smite | 惩击 | needs-decision | 半血门含等于一半；当前只放大10基础值，随后叠法伤，是否应放大本次完整伤害待裁定。 |
| tt7-sneak | 偷袭 | consistent | 攻击力-1，无额外穿甲或潜行效果。 |
| tt7-stealth | 潜匿 | consistent | 潜行1回合、抽1；成功造成伤害会按公共潜行规则破隐。 |
| tt7-stratagem | 法师锦囊 | not-verified | 背包最多3张法术，战斗从实时pouchOf重建选择；选中删除收藏母本并排队直施；未走完整存入到战斗再回库端到端。 |
| tt7-swordimmortal | 剑仙形态 | consistent | 打出登记本场每次回合开始抽1；没有容器duration，因此持续本场。 |
| tt7-talisman | 灵符 | consistent | 仅首脑勾选开战抽2，先把本牌移入consumed/grave并从可用牌堆移除，避免抽到自己；普通战不入手。 |
| tt7-throwblade | 飞刃偷袭 | consistent | 攻击力-3、流血1、抽1。 |
| tt7-thundergrudge | 快意恩仇 | consistent | 提交前必须真付2张初始攻击，随后3次攻击；取消未支付。 |
| tt7-twinfireball | 三重火球 | consistent | 4法术并把具名火球2张入手。 |
| tt7-whirlwind | 旋风斩 | consistent | 对每个活敌攻击力+1一段。 |
| tt8-archdemon | 天启诛魔剑 | consistent | 穿戴攻+1，并获得3张具名重斩；不是3次当场伤害。 |
| tt8-curse1 | 禁咒I | consistent | 抽到不入手即对首个活敌夺1攻；基础攻击转移与归还沿偷取管线，卡面未写持续期，记录这一边界。 |
| tt8-curse2 | 禁咒II | consistent | 抽到不入手即冰冻首个活敌1回合。 |
| tt8-curse3 | 禁咒III | consistent | 抽到不入手即给首个活敌1毒1血。 |
| tt8-curse4 | 禁咒IV | consistent | 抽到不入手即沉默首个活敌1回合。 |
| tt8-demonslay | 诛魔剑 | needs-decision | 抽到时对所有敌人按玩家攻击力攻击；可见描述明确合成效果尚未定稿，因此合成部分不能验成已完成。 |
| tt8-dragonblade | 青龙偃月斩 | consistent | 攻击力+6、破甲2回合与流血1；卡面没有写破甲时长，当前按公共默认/本卡DSL2回合，记录未独立裁定。 |
| tt8-heavensword | 天启剑 | needs-decision | 抽到时额外抽1、不占手牌；可见描述明确合成效果尚未定稿。 |

## 公共边界

- 描述取displayCardDescription实际卡面，rawDescription只用于追溯。
- 普通战抽牌改发初始攻击；牌库插入/底部/上限词条普通战门禁；首脑迎战装备需编组勾选。
- 真实伤害的防御穿透、沉默封技能、终局停止余下操作按现行公共战斗规则；恶魔之力末敌自伤不作新缺陷。
- 通行证C归workflow_lane独占，不在177张范围；不修改卡库/战斗生产逻辑。

实现源码 SHA256 留在 JSON，便于后续修复辨认证据时点。审查源清单和状态生成器为本目录 battle-review-generate.mjs；专属测试仅 tests/card-description-audit-battle.test.js。
