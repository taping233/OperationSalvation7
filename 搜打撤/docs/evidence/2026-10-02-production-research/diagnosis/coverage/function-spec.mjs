// 操作/规则族，按玩家意图划分；每族必须写前提、结果、失败风险、反证与建议。
// id|名称|动作正则|关联界面|前提|结果|失败风险|反证|建议
export const functionRows = `
F01|新建/继续/覆盖/删除档位|^(newSlot|enterSlot|overwriteSlot|delSlot|slotBack)$|SLOTS,SLOT-RECOVERY|玩家要进入指定档；档位、Base/Run版本与恢复配对须有效|空档新建；已有档恢复基地或Run；覆盖/删除经确认|跨档旧回调、损坏Run、读档期间连点可错入档；不能以文件存在推有效|enteringSlot锁及验证/恢复分支已有|逐档空/旧/损坏/待整理定向验，不重做全游戏
F02|标题与通用返回入口|^(toTitle|achBack|guideBack|helpBack|closeSettings|closeBase|openInbox|openDataPageUi)$|TITLE,GUIDE,TITLE-ACH,SETTINGS,HUB-HELP|玩家想退出阅读并回原任务；战斗/Run状态应保留|按来源关闭/返回设置或标题|同一返回函数被dataset误当布尔参数；modal回idle会丢战场|数据/留言包装器及手册战斗守卫已有|以来源页矩阵对账返回，复用已证普通战
F03|保存退出/放弃行动|^leave(Save|Cancel|Abandon)$|LEAVE,ABANDON-DONE,TERMINAL-RETRY|玩家要保留进度或承担放弃损失；当前Run身份有效|保存退出留Run；取消回图；放弃走终局命令|保存失败若仍退出可能以为已保存；终局失败不应清原局|runTerminalSettlement保留原局并重试|故障注入仅隔离探针；实页不得覆盖老板存档
F04|留言阅读/导出/删除|^sug(Back|Export|Del)$|INBOX|玩家查反馈；异步缓存加载完成、删除二次确认|按状态陈列/下载；确认后删指定ts|时戳查DOM、异步返旧页、文件后端故障；导出可能不包含未加载记录|renderSugBox与明确两步删除已有|核空/有/失败，区分origin与文件库
F05|右键反馈撰写|^@suggestion$|SUGGESTION|玩家记录具体元素问题；目标、上下文与文本输入|保存正文及复现/期望/实际，失败保持可重试|保存位置/当前页绑定失配，不能把本地保存当邮件发送|已有字段与saveSuggestion错误路径|补一个实际保存回读证据，未授权时只读
F06|跑局统计导出/清空|^data(ExportJSON|ExportCSV|Clear)$|DATA,DEV-DATA|玩家/开发者看已记录局；清空须确认|汇总成功失败与记录，导出文件或清空本地|Agent局可能误解释真人留存；空记录不能证明没有游玩|明确records来源，导出JSON/CSV共存|区分agent/real-input证据，勿拿胜率充完成率
F07|偏好/音频/动态控制|^@settings-controls$|SETTINGS,BATTLE-SETTINGS|玩家调舒适性；当前Sound/DOM存在|即时编号、横幅提示、开发、震动减动态、音乐来源与音量|部分偏好仅内存，持久化失败静默；unknown cue音量再大仍无声|experience已证通用音与静音链存在|优先cue对账，逐控件重载仅必要项
F08|危险区数据清空|^wipe(Notes|Cards|Save)$|SETTINGS|玩家明确要清备注/卡库/五档；2.6秒内二次确认|删除对应数据，不可撤销|按钮误触/全五档范围误认；卡库清空可能改随机池|二次点击文案与分级危险布局已有|只评确认信息，不在评审执行破坏动作
F09|基地与成就子视图导航|^hub(Tab|CollectionView)$|HUB-DEPLOY,HUB-STASH,HUB-SHOP,HUB-UPGRADE,HUB-CLASSES,HUB-ACH|玩家切六页/三子视图；不是战中绕过入口|重绘内容与帮助，成就待领奖点|同一基地截图无法证明其它五页；子视图状态重绘/焦点丢失|quick-nav can禁止战斗/Run进入基地|每页独立图与批注，不做多尺寸
F10|玩法模式与钥匙门预告|^(selMode|gateInfo)$|HUB-DEPLOY|玩家选标准/精英或查钥匙门；模式合法|模式存基地，下局倍率；钥匙门当前只提示制作中|把倍率模式误当新地图，达到钥匙误以为可开新关|selectMode失败提示，gateInfo明确制作中|保留暂缓标识，不扩开发/安装
F11|基地基础商品购买|^shopBuy$|HUB-SHOP|玩家用储备币补充；钱、商品卡、仓库容量有效|材料入资源或牌入仓库，成功才扣币|购买失败半扣/容量误估；储备币和随身币混淆|B.purchase命令失败poor/full并提示|一个满库/缺钱命令对账比增加商品更值
F12|材料卡折入资源|^mat(UseOne|UseAll|ConfirmOk|ConfirmCancel)$|STASH-MATERIAL,MATERIAL-CONFIRM|玩家拿材料建设；末张/全用确认|移除材料卡换真实木材口粮钥匙|同名/堆数量变化导致旧索引；确认后误认为还能带入|最后一张与全用明确不可逆|用版本命令与准确数量提示核对
F13|仓库出售换储备币|^(sellOne|sellAll|stashConfirmOk|stashConfirmCancel)$|STASH-ITEM,STASH-CONFIRM|玩家腾仓/积币；特殊收藏锁、物品存在|卖单/整堆移卡加基地币|误售最后一张、特殊珍藏失去、重复点击|确认框默认保留，special/marked限制已有|最后一张/全售独立核，不把局内卖出混同
F14|职业卡收藏与熟练度|^coll(CollectOne|CollectAll|Toggle)$|STASH-ITEM,HUB-COLLECTION|玩家以牌换人物XP或锁珍藏；收藏池资格|职业卡+10/能力+50、牌消耗；重复给XP首次推进图鉴；特殊卡可标记|把收藏理解为无损标记；重复XP与首次进度口径混|收藏室说明明确用掉、重复XP|区分职业消耗与特殊锁收藏，保持两种语义可见
F15|经济包开包|^econpackUse$|STASH-ITEM|玩家使用经济包；tt-econpack存在、仓库至少5空位且随机池非空|消耗包获得5张随机可获取卡，入卡牌仓库|末张需确认；空间预检偏保守、旧堆变化或保存失败须拒绝|B.openCardPack独立命令，末包确认与失败日志已有|核开包前后仓库数量与包消耗，不把收益写成储备币
F16|仓库物资/物品查看与返回|^(stashItem|rawItem|stashBack|stashBack2)$|HUB-STASH,STASH-RAW,STASH-ITEM|玩家了解用途；索引对应当前堆|材料/蛋/普通/特殊分支，失效索引回仓|旧索引查看错堆；真实资源不可售应明示|openStashItem分支和空堆返回已有|卡类型与操作按钮逐分支核
F17|宠物孵化|^hatchEgg$|STASH-EGG|玩家要未拥有宠物；蛋+50储备币且未全齐|随机未拥有宠物，蛋币同时消耗|全齐/贫穷/存档失败误扣；随机结果不是每只可达实证|hatchPet失败save明确原蛋币不耗|核原子性及未拥有池，不新增宠物
F18|宠物携带与升级|^(selPet|depPet|upPet)$|HUB-PETS,HUB-UPGRADE,PREP|玩家选择安全格与宠物效益；拥有、口粮、未满级|一只携带、逐宠等级、2-3-4-5成本，安全格改变|切宠使安全格不足、整备与仓库选择不一致|独立等级/MAX禁用和能力说明已有|核切换后安全卡保留规则，六宠效果不虚称逐验
F19|背包/仓库扩建|^up(Bag|Stash)$|HUB-UPGRADE|玩家扩大容量；木材足且未MAX|消耗木材扩建，Meta解锁|上限/扣材保存失败、展示cap口径不同|canUpgrade和MAX按钮禁用|核边界命令，不用截图证明资源原子性
F20|基地口袋用钥匙复原|^restoreCard$|HUB-STASH|玩家救回消耗牌；键数按稀有与整堆、仓库空间|普通卡回仓库；初攻不入库直接消耗；下次出发前处理|误认1/3为整堆概率、钥匙材料未转储备、下局清口袋|错误nokey/full/sha有专门提示|将概率/钥匙成本/下局清空并列验
F21|成就奖励领取|^claimAch$|HUB-ACHIEVEMENTS,TITLE-ACH|玩家兑现已解锁未领成就|物资/卡/卡背奖励一次性|卡满库、重复领、标题总览误以为已领|M.claim门控；标题只读与基地领奖分离|每奖励类型定向测；不宣称26条全部触发
F22|卡背解锁选用|^selBack$|HUB-BACKS|玩家换牌背；对应成就已领解锁|选中立即用于牌堆/背包，每档独立|未解锁或同选，误以为单纯达成即可用|isBackUnlocked及同选直接返回|核解锁-领取-选用的关联
F23|收藏里程碑与查看|^(claimColl|collZoom)$|HUB-COLLECTION|玩家领首次不同收藏阶段奖励/查看已有牌|一次奖励或只读详情；满仓拒奖保留|全收集分母池变化、重复XP误推进|collectPool仅职业/能力，claimColl满库反馈|以池过滤作分母，避免原始卡库数代替
F24|人物熟练度与皮肤|^selectCharacterSkin$|HUB-CLASSES,CLASS-CHOICE|玩家查成长/换已开放皮肤；readBase/revision有效|皮肤落库/素材缺失默认立绘；熟练度下局加成|选人临时皮肤与基地持久化皮肤混淆|selectSkin命令及assetFallback明确|分别核会话预览与持久选择
F25|下一局目标追踪|^@goal-(add|remove)$|PREP-GOALS|玩家追收藏目标；上限3/卡ID有效|保存追踪、显示已知条件或来源未确认|来源不明误成保证获取；重复/满3|getSources certainty判定、按钮上限|保持未知来源明示，不编掉率
F26|两套出征预设|^@(preset-|openPreparation)|^(openPreparation|preparationBack)$|PREP-GOALS|玩家复用准备；仓库、角色宠物与容量当前有效|愿望清单保存，预览ready/missing/forbidden；应用到整备，人物仍出发后选|误以为保存即扣牌/直接出征；旧revision申请|previewDeployment不扣资源、缺牌禁应用|逐意图对账版本命令，不把两套预设当两次实战
F27|整备带入卡与确认出发|^(deploy|pickAdd|bagZoom|bagZoomRemove|confirmDeploy|depBack)$|PREP,CARD-ZOOM|玩家选择有用卡带入；仓库存在/禁带/容量/忙碌|增减勾选、详情/移出，出发成功扣仓清上局口袋|小卡读不清；点击确认失败仍误扣；初始攻击固定不可带回|详情可访问，preparation/departure命令守卫|相关风险优先已有长牌详情与命令证据
F28|出征人物/皮肤/卡池/补给|^(selClass|clsPool|clsBack|clsSkin|cls2Quit|pickClass|poolZoom|poolPrev|poolNext|clsGrantGo)$|CLASS-CHOICE,CLASS-POOL,CLASS-GRANT|玩家选本局人物并了解牌池；可退整备|职业选择加熟练度，补给进入图；皮肤只是选页会话记忆|卡池预览不等于实际获取率；补给与容量|牌池分页/详情与返回来源已有|五人物不虚称全胜率，核出发流程真实闭环
F29|照相馆检索/筛选/排序/翻页|^lib(Tab|ClearFilter|RemoveFilter|Prev|Next)$|STUDIO|玩家找到某牌；按当前过滤集|只重绘网格、保留输入焦点/选择，空结果告知|中文IME被整页重建打断、分页选择漂移|renderLibGrid与窗口化已解决部分性能|核一个中文长牌搜索与详情，保留有效结构
F30|照片详情/馆方记录|^(libInspect|exportNotes|closeCardPage)$|PHOTO-ZOOM,STUDIO,CARD-ZOOM|玩家读规则与写自有记录；有效cardID|照片大图/背签/完整规则、备注限240、关闭回焦点/导出记录|便签保存失败虚报已存、图片加载fallback、旧回调|通用showCardZoom返回焦点/背景inert已有|实页图与输入回读分开核
F31|卡制作/编辑/删除|^(libEditMode|newCard|editCard|delCard|mech|pickType|pickDmgType|pickCost|pickDraw|pickInfuse|pickRar|dmgAdj|valAdj|saveCard|closeDesigner)$|CARD-DESIGNER,STUDIO|开发者写开关实际为false；源码UI存在不代表当前可写|当前导出工具可开，写入口被拒；若启用才制作自定义卡|将冻写入口误报正常功能；文本机制不等于效果已实现|CARD_DESIGNER_WRITES_ENABLED守卫|按guarded列存在，不解冻、不实施
F32|卡库导入导出|^(exportCards|importCards|copyCards|downloadCards|backLib|doImportCards|backLib2)$|CARDS-EXPORT,CARDS-IMPORT|玩家/开发者复制文件；导入写开关false、JSON合法|导出当前库；导入当前受控|复制权限、非法结构、误认为导入有战斗语义保证|导入parse/失败提示与总开关|只评文件接口，不写cards-sync.json
F33|探索合法移动/重复节点/HUD|^@map-|^@hud-|^flowContinue$|MAP,RUN-TRANSITION|玩家选邻接路线；idle、Run活跃、相邻；过场身份正确|turn增加、揭图，已结算节点不重刷，目标/闸门方向更新|安全往返turn仍计撤离XP（GP-01已证）；直线距离不是路径代价|visited防重复奖励，地图能合法回退|先定奖励规则，保留回头路；不从早期2路线断言无分岔
F34|拾取与空安全节点|^(pickupGo|blankSafeDone)$|PICKUP,NODE-SAFE|玩家收资源/确认无事；单次当前节点|币入账或资源卡入包，finishInstant回图|找不到卡/满包时是否仍消费节点；这与物资二选一不同|grantEventCard会拒满；空白明确提示已有|核发放返回值与consume顺序，别混用图
F35|资源卡二选一|^(resPick|resSkip)$|RESOURCE-PICK|玩家择一资源；随机池非空、包能接收|成功发牌才consume；跳过done(false)保留节点|动态按钮忽略扫描、同名容量误估|代码先grant成功再done(true)|动态resPick{0,1}按池数量对账
F36|宝箱搜寻/揭晓|^chestReveal$|CHEST-SEARCH|玩家开启当前箱；queue有效|揭晓库存与货币，按idx推进|揭晓并不表示已收卡；随机/蛋保底跨箱误读|renderSearch与render领取分离|分别审查未开/已开，复用多箱证据
F37|宝箱逐收/全收/三选一/跳过|^chest(Take|Take1|Skip|Pick)$|CHEST-PICK,CHEST-ALL,BATTLE-REWARD|玩家最大化收益或腾格；满包卡型容量、taken状态|单收保留、全收放不下散落、选一失败留页、跳过币照收|全收丢牌、金币重复、满包3选1吞卡；当前遮标题E03已证|taken与grant拒收留页，容量预检和散落提示已有|优先修安全区；收益行为据真实回包对账
F38|普通/职业/首脑战后奖励与消耗教学|^(ammoTeachOk|battleSettleRetry)$|BATTLE-REWARD,AMMO-TUTORIAL,BATTLE-SETTLE-RETRY|玩家理解牌为何消失；战后命令成功才发奖励|普通卡usedPocket、职业卡消散，首次教学、奖励与XP/胜利进度|重复保存奖励、教学写失败、首脑第五层文案（GP-02已证）|幂等command、当前普通战闭环与辅助首脑证据|修层数口径，普通战证据不能替代全规则
F39|跨层闸门/门店|^(goDoor|doorShop)$|DOOR|玩家推进层级或补给；door配对存在|切层目标位置、独立door库存|旧档配对、连续切门、门店重开库存|既有pair与stockKey|单条跨层证据复用，别大采种子
F40|探索商店购牌/初攻/谜货|^(buyCard|buySha|shopOpenBag)$|RUN-SHOP|玩家用随身币备战；库存未售、钱足、容量|扣币授卡/初攻，谜货揭晓；打开背包腾格|买卖动画未完成重复点、满包扣钱、stockKey持久化|denySlotFeedback与真实grant容量判定|核买前后钱牌和存档，不先扩货池
F41|探索商店卖牌与返回|^(sellCard|openSell|backShop|closeShop)$|RUN-SELL,RUN-SHOP|玩家兑现多余牌；符合出售筛选|移除卡增随身币、回购买/来源|安全格/容器/装备售出后状态残留，离店写visited不等于不能浏览|单点事务与来源onClose已有|与基地卖币分开，不把储备/随身混算
F42|火堆回血与口袋复原|^(restoreOne|fireDone)$|FIRE,POCKET-RESTORE|玩家救牌回血；FIRE_RESTORABLE过滤、背包容量|火堆回血上限、2张；祭坛3/道具2、修鞋铺来源回调|看似卡在口袋但不可复原；满包/无牌次数|候选过滤与finish回调明确|逐来源成本/次数对账，复用无牌空态
F43|事件正文选择与历史|^(evtChoice|evtNext)$|EVENT|玩家权衡叙事效果；事件卡池或旧表、modal锁|所选效果/日志历史，closeEventFlow回图|卡库没事件走旧表；只读文案与真效果漂移|modal保留直到完成，generated narrative存在|规则族分析不等于每事件/全部剧情已可达
F44|事件卡奖励与付费军需|^eventCardPick$|EVENT-CHOICE|玩家选药水/装备；候选非空、军需3币|选中卡发包后收尾|军需先spendEventCoins后开选页，满包会已付费但留选择；不是已证永久丢失|grant失败留页可腾格|廉价隔离核付费-授牌-取消，不直接判经济漏洞
F45|故障重编/赌局|^event(RecodePick|RecodeLeave|RecodeGo|GambleLeave|GambleTry)$|EVENT-RECODE,EVENT-GAMBLE|玩家冒险换牌/收益；变牌同型同稀有、赌币足|确认选满后变牌；赌局随机结果，settled防重复|改变装备引用/旧UID、赌局预扣/连点|重编safe/stored排除、无候选退出|定向身份/实际收益核，未做概率可靠性测试
F46|最后一盏灯故事提交/恢复|^lastLamp(Choice|Finish|Retry|ChoiceRetry)$|LAST-LAMP,LAST-LAMP-RESULT|玩家做长期叙事选择；slot/run/revision绑定当前|story命令保存已选结果，错误可重试|异步换档回写他局、提交成功重试重复效果|currentLastLampPage身份守卫|静态有守卫不等于全剧情已通读，保留边界
F47|祭坛三牌激活/碎片兑换/道具复原|^altar(On3|FragHero|FragBack|ItemRestore|Leave)$|ALTAR,ALTAR-FRAGMENT-FAIL|玩家用资源换收益；3牌/2碎片/道具+可复原池|激活一次、碎片先授牌后扣、道具一次锁再复原|全局altarActivated是否按祭坛归属；能力池空/满包拒收|无职业池明确保留碎片、道具取消不锁|逐代价边界，先验已有一次性语义不扩祭坛种类
F48|祭坛回赠二选一|^altarReward(Restore|Loot|Leave)$|ALTAR-REWARD|玩家已付3牌；pending待领|回3牌+10HP或随机传说+装备，离开可回来|loot分支先清pending，再发牌可能满包；需确认散落是规则还是缺陷|两池去重、无可复原禁第一项|先做满包廉价探针再拍设计，不将静态疑点写已证丢奖
F49|献祭选牌/取消/确认|^sac(Pick|Cancel|Confirm)$|SACRIFICE|玩家明确付n牌；类型/UID/数量合法|可切选择、取消回来源、确认移牌done|全部牌被献祭、掉线存档、stale UID；n不足不能确认|selected.size数量和过滤约束|分别对紧急3/祭坛3/道具1验证，不只写献祭已分析
F50|首脑挑战与战前编组|^(fightBoss|bossLeave|bossBounce|bossSel|bossGo|bossCancel)$|BOSS-GATE,BOSS-DECK|玩家选择决战；首脑未死、包中合法牌/装备、数量达标|编组开bossBattle、取消回首脑门|取消错误consume节点、装备技能/选牌实际不一致|bossKilled拦重战，编组前不锁节点|辅助实战标清输入；正常四层路径与分支分开
F51|紧急/终局撤离成本与放行|^(payExit|stayHere)$|EXIT-PAY,EXIT-FINAL|玩家保本/通关带回；紧急第三层且3牌，终局首脑死|紧急先献祭、终局无条件，随身币离局清零|注册payExit存在不表示锁页按钮可达；旧档出口层错误|停用提示/卡不足禁用/首脑门控|保留静态与实际点击边界；不改存档造出口
F52|撤离整理/全收/智能/完成/重试|^ex(Stash|All|Smart|Finish)$|EXTRACT-STASH|玩家带回最有价值牌；pending revision与仓容量有效|逐堆/全部/价值智能部分入库，确认剩余散失|满库丢牌、保存失败误清、并发旧页；1/3逐张只在begin抽一次|pendingExtraction命令有恢复/幂等|复用真实辅助整理证据，必要失效revision探针
F53|撤离/死亡终局持久化与再来|^(extractRetry|goBase|again|retryAct)$|EXTRACT-RETRY,EXTRACT-DONE,DEATH,TERMINAL-RETRY|玩家从结算继续；Base/Run成对提交有效|成功/失败统计、XP及安全格规则，回基地而非直接新局|死亡与撤离保留差异、失败重复XP；GP-01/02当前已证|terminal/extraction命令保留原局与重试|终局规则与叙事分开验，不拿research ending冒主图结尾
F54|探索背包详情/使用/排序/丢弃|^(inspectStack|useDetailCard|bagSortRarity|bagSortType|closeBag|detailDiscard|confirmDragDiscard|cancelDragDiscard)$|BAG,BAG-DISCARD,CARD-ZOOM|玩家管理带出牌；现有卡、非战斗、用途适用|同名堆详情、治疗满血保留、排序与确认丢弃，来源hook返回|拖动删整堆、道具错用、背包回地图顶掉商店箱页|用途过滤、丢弃确认、returnHook已有|核真实来源返回和治疗边界，源码旧showBagCardDetail不可冒现行入口
F55|安全格/容器/通行证合成|^(detailFromSafe|detailToSafe|zoomMoveToBag|zoomMoveToSafe|pearlStore|pouchStore|pearlStoreZoom|pouchStoreZoom|pearlPut|pearlTake|pearlBack|pouchPut|pouchTake|pouchBack|craftColorToken|craftColorTokenByFragments)$|BAG,BAG-PEARL,BAG-POUCH|玩家保全/扩格/合成；普通与安全容量、资源/法术筛选|转safe、珍珠资源/锦囊法术存取、旧详情合成定义|stored不能普通容量算、取出满包、旧合成入口现行未接|容量/type与UID守卫，旧函数源码注释明示历史保留|旧合成列source-only，不用存放按钮存在证明可用全部扩展
F56|手牌点击/拖拽/键盘出牌与目标|^(btPlay|btPickCancel|btHandPage)$|BATTLE,BATTLE-TARGET|玩家发动牌；玩家阶段/非busy/费用够/合法UID与目标|费用与卡消耗，单敌自动目标、多敌点选，Enter/Esc与拖放|不支持预览误算、卡叠UID、选择取消却已扣费、手牌遮挡|preview未知降级/targetSide过滤、普通战点击闭环已证|其它输入未实际操作别外推；卡组合不穷举
F57|注能燃料/直打/取消|^btInfuse(Start|Direct|Go|Cancel)$|BATTLE-INFUSE|玩家强化牌或不注能；主牌/燃料UID、n张手牌、费用|燃料选满确认，主牌不作燃料，同名叠轮转；取消不耗|燃料重复/同叠选择不了、结算阶段突变|N1同叠轮转与取消Esc已有测试/实现|核强制燃料和直打两条，不能单一出牌代表注能
F58|回合结束/敌方意图/状态结算|^btEnd$|BATTLE,BOSS-BATTLE|玩家决定承伤；玩家phase非busy|弃/抽/能量、敌行动/多段/元素状态与死亡|意图显示与实际傷害差、冻结/流血顺序、忙碌连点|calculateEnemyIntent共用实算与预览|对账一次多段/冻结边界；不宣称全卡搭配
F59|发现/抉择/强制手牌支付|^bt(Discover|ChoicePick|PickHand|PickHandSkip)$|BATTLE-DISCOVER,BATTLE-CHOICE,BATTLE-PAYMENT|玩家完成牌效分支；候选池/剩余数量/mandatory|发现一张临时牌战后散；抉择仅一项；强制付满或可选跳过|空候选死锁、支付主牌重复、效果续接丢失|hand payment排除已选/主牌/燃料，发现flow处理空池|分三种流程取证，不能发现图替强制支付
F60|装备技能/重击/道具|^(btEquipSkill|btSlam|btPotion|btUseItem)$|BATTLE,BATTLE-BAG,BATTLE-TARGET|玩家用战中资源；装备技能条件/道具类型与目标合法|技能或特殊攻击、治疗/伤害道具入指定流程|限次不锁、自己道具高亮敌人、两段镖断连|targetSide过滤、slam/dart独立pending|规则族列存在；复杂技能与全部道具未逐验
F61|战斗背包/安全格/墓地/牌库/设置返回|^bt(Bag|BagBack|SafeMove|Grave|GraveBack|Deck|DeckBack|Settings|SettingsBack)$|BATTLE-BAG,BATTLE-GRAVE,BATTLE-DECK,BATTLE-SETTINGS|玩家查实际牌/保全物品/调速度；当前场次|读状态/安全移动、回战斗重新attach帧层|普通hideOverlay丢战场、旧sprite浮弹层、空堆误当无卡|renderBattleBag与view恢复入口/隐藏帧已有|每重要弹层独立视觉批注，不重复普通战入口
F62|战斗撤离判负|^btFlee$|BATTLE,DEATH|普通战玩家主动退出；首脑战明确不可撤离；2.6秒内二次确认|普通战surrender判负；烟雾弹另走flee豁免|“撤离”词误当地图成功带回或烟雾弹效果|按钮明确判负、boss日志deny、烟雾弹注释区分|保留三种成本语义，核终局失败接口
F63|开发调试/Agent/快捷导航|^devc|^@dev-|^@quick-nav|^@agent-|^@turbo$|DEV-DEBUG,DEV-AGENT,DEV-KEYS|开发者明知辅助写存档；运行/战斗守卫、LLM设置合法|调资源/发牌/战斗、策略启动停止turbo/观察、受can跳转|辅助结果冒真人、LLM失败/停止未收口、配置敏感信息|界面写即时存档提示、quick-nav busy门控|本轮只静态，父会话辅助证据必须标注；不替老板配置
F64|研究所独立规则族|^(lab|nest|rc|na|ns)|^@lab-|^@runes$|LAB-DOOR,LAB-PREP,LAB-MAP,LAB-RUNES,LAB-ALTAR,LAB-SHOP,LAB-ENDING,LAB-DONE|暂缓系统存在；独立解锁/牌/符文/资金与nest身份|大门、备战、顺序地图、法阵、祭坛、商店、首脑、计分与结局|误把主图覆盖算研究所全验，元素盒子动态动作未实例化|源码独立命令与结算存在|仅盘存在和边界，不扩开发/实页走线
F65|术语/帮助/HUD镜头/日志/音效试听|^@term-|^@audio-|^@camera-|^@log-|^@hud-control$|TERM-TIP,HUB-HELP,MAP,SFX-AUDITION|玩家读提示或开发者试听；有效词、DOM、音频库|词义浮层、镜头定位/缩放、日志折叠、播放方案/序列/循环|tip遮重要区，外链库失败，资源存在误等同cue已接|unknown词不显示、试听fetch/Audio失败提示|声音接线优先；当前窗口实听未核不评价混音
F66|基地家具布置与陈列|^@home-|^@furniture$|HOME-SCENE|source-only：renderHomeScene未被主renderHub调用；revision有效|买家具/布局/陈列命令存在，静态可看意图|无现行入口却写已交付；并发revision冲突|home command与background fallback存在|列已存在未接，不主动接入口
F67|结点备注编辑/清空/取消|^(saveNote|clearNote|closeNote)$|NODE-NOTE|开发者想留结点设计备注；坐标存在、文本有效|写备注/清该格/取消；失败保留弹层输入|旧坐标迁移与当前种子定位不一致、存储满|save返回false保留输入已有|区分备注与实际事件配置，不执行清空
F68|结点备注导入导出/全清|^(copyNotes|downloadNotes|closeTools|doImport|doClear)$|NOTES-EXPORT,NOTES-IMPORT,NOTES-CLEAR|开发者交换设计记录；idle与JSON合法，全清明确确认|v3节点导出、v2迁移合并、统计部分失败、全清取消优先|导入部分写成功不原子、旧字典混board；外发文案不等于已发送|clipboard失败可手拷、部分写失败明示、确认初焦取消|只读诊断接口；不触老板数据
R01|伤害类型/多目标/多段/击杀|^@rule-damage$|BATTLE,BOSS-BATTLE,BATTLE-TARGET|玩家按伤害/目标选牌；费用合法、伤害类型与目标有效|攻击/法术/固定/真实、全体/随机、多段、击杀进度；实际由combat与effects解释|护甲/法伤/冻结/死亡时序影响预览，文本注册识别非执行正确性|calculateEnemyIntent与damage预览共实算，unknown降级；普通战3击杀已证|优先一个类型边界及击杀奖励，复杂组合未验
R02|生命/护甲/伤害规避/潜行/斩杀|^@rule-survival$|BATTLE,BAG,DEATH|玩家以回复/护甲/免疫保命；状态和目标条件有效|HP上限、护甲吸收/减伤、隐身、条件斩杀与复原|禁疗与死亡边界、自伤触发、复活牌身份；回复牌满血是否消耗|背包满血保牌已有实现；effects支持谓词不保证全组合|定向HP0/满血/禁疗与护甲序列，不虚称所有防御搭配
R03|元素/诅咒/净化/时长|^@rule-status$|BATTLE,BATTLE-TARGET,TERM-TIP|玩家控制/持续伤害；元素/诅咒规则与合法目标|水火草光暗及流血中毒冻结沉默破甲禁疗灼烧、复制/净化、时长|重复叠加/立即触毒/冻结到期、同阶段顺序影响实际|curse resolver与状态意图存在，音频动态cue缺口E01|按状态族选最便宜探针，元素视觉与听觉单独核
R04|抽牌/牌堆/弃置/墓地/保留|^@rule-piles$|BATTLE,BATTLE-DECK,BATTLE-GRAVE|玩家管理可用牌；普通战全可用牌与boss抽牌模式分开|抽到数量/定向抽、禁抽、洗入手/牌库、弃置/消耗/保留、墓地加成|墓地/弃牌/usedPocket混同、空牌堆或无限补牌、临时牌战后残留|核心注释明确普通战无需抽牌；boss牌库入口门控|两模式分别分析、堆身份优先，不拿图库数量代替可用牌
R05|能量/费用/法伤/上限与条件|^@rule-cost$|BATTLE,BATTLE-INFUSE|玩家排费用收益；当前规则、成本与条件满足|改费/能量/上限/法伤/前一牌条件/注能价值/定价缩放|负费或条件前后切换、重放多次扣/少扣、unsupported操作先付成本|capability预检before pay与effCostOf已有|先核成本拒绝不耗牌，卡面摘要与实算对账
R06|发现/获取/复制/自动施放|^@rule-acquire$|BATTLE-DISCOVER,BATTLE-PAYMENT|玩家拿特定池牌/利用续接；候选池、dest/act合法|获取手/牌库/发现、复制/免注能/零费/直接施放、选择后队列续接|空池/成本过滤/派生牌获取资格、免注能跳过支付、临时牌丢失|ACQUIRE_ACTIONS与支持filter(cost/costMax/exceptIds)门控|支持表完整扫描不等于单卡组合穷尽；候选为空优先
R07|召唤/随从/互攻/偷攻|^@rule-creatures$|BATTLE,BOSS-BATTLE|玩家用召唤/操控效果改变战场；召唤池/敌人状态有效；图鉴类型生物牌本身不可打出|随从、额外回合、敌互攻、偷攻/降攻、战斗开始被动|单位死亡生命周期/队友目标/重复触发、意图残留|execute/summon/foeFight/copyRandom有结构键与resolver|按生命周期核，区分召唤单位与不可出牌的生物图鉴
R08|装备/时点触发/持续规则/祝福|^@rule-triggers$|PREP,BOSS-DECK,BATTLE,BATTLE-BAG|玩家利用穿戴和连锁；已穿戴装备、触发时点和限次有效|onEquip/battleStart/passive/skill、七时点runner、持续注册规则、祝福|同装重复、技能次数、嵌套触发链/局外资源、structured与legacy重复结算|equip container结构域仍拒；其它装备/trigger接线但未逐件验|区分已穿戴技能与规则留白，先复用测试证据
R09|变形/形态/随机特殊规则|^@rule-transform$|BATTLE,BATTLE-CHOICE|玩家追职业特殊玩法；legacy或hosted规则命中|初攻转化/模仿前牌/形态/随机神秘效果/累计注能解锁|文本与structured混用、旧id映射、随机结果/长链未证|capability明确structured transform没有resolver而拒，legacy注册识别保留|拒绝族列禁用独立项；不把文本识别等同支持全部schema
R10|容器/地图背包/逃跑边界|^@rule-container$|BAG,BAG-PEARL,BAG-POUCH,BATTLE|玩家扩大空间、特殊背包使用或免判负脱战；类型/容器身份有效|资源扩格/锦囊法术/背包复原，烟雾弹flee与surrender不同|structured equip.container未接、旧详情操作未现行公开、stored结算|能力预检拒未接容器，bag.has/type过滤|保留当前legacy功能，不为静态覆盖解冻结构域
R11|结构规则预检与设计留白|^@rule-capability$|CARD-DESIGNER,BATTLE|玩家期待牌面可执行；schema合法且capability消费者支持|无rules走legacy；有rules整卡预检，未知op/target/filter/transform/hits.perFoe拒绝|配置/注册数量不代表执行/全类型支持，DESIGNER_BLANKS合法留白非新增bug|card-rules.capability返回invalid/unsupported，按源支持表|明确禁用/暂缓，审查而不补代码；全组合覆盖未成立
`.trim().split('\n').map(line => {
  const m = line.match(/^([^|]+)\|([^|]+)\|(.*?)\|([A-Z][A-Z0-9-]*(?:,[A-Z][A-Z0-9-]*)*)\|(.+)$/);
  if (!m) throw new Error('无法解析功能行: ' + line);
  return [m[1],m[2],m[3],m[4],...m[5].split('|')];
});
