// 稳定 ID 是本次评审的对账键，非游戏路由。字段：ID|中文名|父域|源码|入口锚点|正常/空态/失败|返回|持久化|可达状态
export const interfaceRows = `
TITLE|标题与主页|menu|ui/game.menu.js|function showTitle|开始、继续及副入口；无档显示新建；最新档损坏须走档位恢复|顶层|最新档摘要来自存储|current
SLOTS|五档存档选择|menu|ui/game.menu.js|function openSlotPicker|空档新建、已有档进入；损坏/旧版/撤离待整理分别处理；覆盖删除需确认|标题|Base与Run按档隔离|current
SLOT-RECOVERY|读档恢复与进局过场|SLOTS|ui/game.menu.js|UI.act('enterSlot'|读取并校验基地/Run配对；不合法Run不得直接恢复；旧档进入告知|失败回档位|恢复须核档位与runId|current
SETTINGS|全局设置|menu|ui/game.menu.js|function openSettings|编号、提示、横幅、开发、震动、减动态、音源/音量；危险区二次点击|原状态；从子页回设置|多数偏好localStorage，编号内存/Run口径另核|current
GUIDE|远征手册|menu|ui/game.menu.js|function openTitleGuide|说明探索、战斗、消耗、撤离；战斗modal返回须保留battle|来源页|只读|current
TITLE-ACH|标题成就总览|menu|ui/game.menu.js|function openTitleAchievements|汇总达成与未达成；与基地领奖不同入口|标题|读取成就|current
INBOX|留言信箱|menu|ui/game.menu.js|function openSuggestionInbox|异步载入/空信箱、导出、两步删除；失败须保留当前列表|标题或设置|本地留言并有文件后端；浏览器origin限定|current
SUGGESTION|右键留言编辑|menu|ui/game.menu.js|function openSuggestionBox|目标、页面上下文、文本；保存中/失败信息|关闭回当前页|本地/文件留言，不等于外部发送|current
DATA|跑局数据|menu|agent/agent.data.js|function openDataPage|无记录空态、统计与逐局、JSON/CSV导出、清空确认|包装器回设置或隐藏|本地跑局记录，非人类留存|current
LEAVE|离开对局选择|menu|ui/game.menu.js|function openLeaveMenu|保存退出、继续、放弃；放弃走终局命令|继续回地图|Run保存或放弃结算|current
ABANDON-DONE|放弃行动结算|LEAVE|ui/game.menu.js|已放弃对局|损失提示、回基地/标题；保存失败不能显示已完成|基地/标题|基地与Run终局成对提交|current
TERMINAL-RETRY|死亡或放弃保存失败|menu|ui/terminal-settlement.js|终局结算未保存|明确失败且保留原局，重试受token与busy守卫|重试后相应结算|终局命令幂等|current
EXIT-SCREEN|退出游戏屏|menu|ui/game.menu.js|function quitGame|浏览器退出提示；不是原生EXE关闭|浏览器导航语义|无新玩法结算|current
HUB-DEPLOY|基地·出发|hub|hub/game.hub.depart.js|function hubDeployHTML|标准/精英、出征、目标预设、钥匙门预告；未选档由外层处理|标题/其它页签|模式与基地资源|current
HUB-STASH|基地·仓库|hub|hub/game.hub.pages.js|function hubStashHTML|卡库、材料、口袋、宠物；空仓/空口袋有说明|标题/其它页签|每档基地|current
HUB-SHOP|基地·商店|hub|hub/game.hub.pages.js|function hubShopHTML|储备币买基础货物；钱不足、卡缺失、仓库满拒购|标题/其它页签|purchase成功才落库|current
HUB-UPGRADE|基地·升级|hub|hub/game.hub.pages.js|function hubUpgradeHTML|背包/仓库扩容、逐宠升级；不足/MAX禁用|标题/其它页签|木材/口粮/等级|current
HUB-CLASSES|基地·人物|hub|hub/game.hub.pages.js|function hubClassesHTML|人物熟练度、卡池、可用皮肤；默认与素材缺失降级|标题/其它页签|皮肤版本命令；熟练度跨局|current
HUB-ACH|基地·成就收藏壳|hub|hub/game.hub.pages.js|function hubAchHTML|卡背/成就/职业收藏三子视图|标题/其它页签|选中子视图会话内|current
HUB-BACKS|卡背图鉴|HUB-ACH|hub/game.hub.pages.js|const equipped = B.backSel|锁定条件、解锁、选中卡背|成就/收藏子视图|每档卡背选用|current
HUB-ACHIEVEMENTS|基地成就列表|HUB-ACH|hub/game.hub.pages.js|const rows = M.ACHIEVEMENTS|未达成、可领、已领；卡奖励容量受命令控制|卡背/收藏子视图|一次性领取|current
HUB-COLLECTION|职业收藏室|HUB-ACH|hub/game.hub.pages.js|function collRoomHTML|已收藏陈列、未收藏问号、5/15/30/45/全收集；领奖满库提示|成就/卡背子视图|首次推进，重复收藏给XP|current
HUB-PETS|仓库宠物区域|HUB-STASH|hub/game.hub.pages.js|function hubPetsHTML|已拥有/携带及未孵化摘要；只能携一只|仓库|逐宠拥有、携带、等级|current
STASH-EGG|宠物蛋孵化弹层|HUB-STASH|hub/game.hub.pages.js|宠物蛋 + 50 币|未拥有随机宠物；贫穷/全齐/无蛋/保存失败拒绝|仓库按钮|蛋币宠物原子写入|current
STASH-MATERIAL|材料使用弹层|HUB-STASH|hub/game.hub.pages.js|仓库材料|单张/全部折入真实物资，不能卖；末张/全用再确认|仓库按钮|消耗卡换资源|current
STASH-ITEM|仓库物品操作弹层|HUB-STASH|hub/game.hub.pages.js|已收藏' : '[[icon:archive]] 仓库物品|卖单/卖全、职业收藏、特殊收藏锁、经济包；缺物回仓库|仓库按钮|卡/币/收藏/XP命令|current
STASH-RAW|仓库真实物资说明|HUB-STASH|hub/game.hub.pages.js|function openRawItem|木材/口粮/钥匙用途，只读不能卖|仓库|只读|current
STASH-CONFIRM|仓库消耗与出售确认|HUB-STASH|hub/game.hub.pages.js|const confirmStashAction|明确消耗/出售数量，默认焦点保留；取消不耗物|原物品|确认后命令落库|current
MATERIAL-CONFIRM|材料最后一张/全部使用确认|STASH-MATERIAL|hub/game.hub.pages.js|const confirmMaterial|消耗后卡消失的明示，取消不换资源|材料弹层|确认后才换资源|current
HUB-HELP|基地六页签帮助弹层|hub|hub/game.hub.js|function registerHubHelp|六套独立内容；缺主题无入口；说明与实际规则应对账|所在页签|只读|current
PREP-GOALS|下一局收藏目标与两套预设|HUB-DEPLOY|hub/preparation.view.js|function render(model)|最多3目标、来源未知、两套愿望清单；缺牌/禁带/数量不足/错误告知|基地出发|preparation命令保存；预览不扣资源|current
PREP|出发整备|HUB-DEPLOY|hub/game.hub.depart.js|function renderDepartPrep|选择仓库卡/宠物、容量；职业禁带、缺卡/忙碌/保存失败拒出发|基地出发|成功出发才扣仓库与清前口袋|current
CLASS-CHOICE|出征人物选择|PREP|run/game.run.altar.js|export function openClassChoice|人物、熟练度、立绘预览；局外入口与整备来源不同|整备或标题|本局人物，选人页皮肤会话记忆|current
CLASS-POOL|人物牌池预览|CLASS-CHOICE|run/game.run.altar.js|const renderPool|分页、选择、放大；无池空态|人物选择|只读|current
CLASS-GRANT|职业初始补给|CLASS-CHOICE|run/game.run.altar.js|clsGrantGo|确认人物后职业牌/补给，继续落到探索；容量语义须保留初始配置|探索地图|Run持久化|current
STUDIO|照相馆|menu|hub/game.cardslib.page.js|function renderCardLibrary|类型/稀有/职业/搜索/排序/分页、无结果、预览、编辑入口开关|原卡页导航hook|筛选会话内，馆方记录保存|current
CARD-ZOOM|通用卡牌详情|shared|ui/ui.js|showCardZoom(card|放大规则/备注，来源可加带入/移出/使用；无卡不打开|原焦点/来源页|备注按来源保存；查看只读|current
PHOTO-ZOOM|照相馆照片详情|STUDIO|ui/ui.js|const photoMode|照片正面与背签、馆方记录、图失效降级；独立于普通卡面|照相馆焦点|编辑备注按库保存|current
CARD-DESIGNER|卡牌制作器|STUDIO|hub/game.cardslib.designer.js|function renderDesigner|类型、元素、数值、机制、预览；写入口受总开关限制|照相馆|自定义卡库；非现行战斗牌验收|guarded
CARDS-EXPORT|卡牌导出|STUDIO|hub/game.cardslib.designer.js|function showCardsExportOverlay|复制/下载；Clipboard失败须反馈|照相馆|文件导出不改Run|current
CARDS-IMPORT|卡牌导入|STUDIO|hub/game.cardslib.designer.js|function showCardsImportOverlay|JSON校验/失败提示；写入口受开关限制|照相馆|自定义库写入|guarded
MAP|探索地图与HUD|run|run/expedition.view.js|export function renderExpeditionPanel|合法邻边、迷雾、路线卡、目标、闸门方向；忙碌/不邻接拒移|节点结算后回图|turn/visited/种子/版本持久化|current
RUN-TRANSITION|接敌/进节点/读档过场|run|run/game.run.scenes.js|export function showRunTransition|短过场可继续；身份/状态变更不得旧页覆盖新局|目标节点|只读演出|current
NODE-SAFE|空白安全节点页|run|run/game.run.scenes.js|export function openBlankSafePage|无事件明示，继续前行|地图|节点结束保存|current
PICKUP|币/木材/口粮/钥匙拾取|run|run/game.run.scenes.js|export function openPickupPage|搜寻/收取演出；卡缺失或容量不足须核发放结果|地图/后续节点|收取时发物并保存|current
RESOURCE-PICK|物资投放资源二选一|run|run/game.run.flow.js|function openResourcePick|池空离开不耗节点，满包拒收保留可选，暂不领取|地图|成功领取才消耗节点|current
CHEST-SEARCH|宝箱搜寻揭晓|run|run/chests.js|function renderSearch|箱队列序号、搜寻按钮；揭晓前后状态分离|揭晓页|队列恢复范围待实页核|current
CHEST-PICK|中型宝箱三选一|run|run/chests.js|function render()|选一/跳过；满包腾格后重选；跳过收币卡散落|下一箱/地图|发牌与节点结算|current
CHEST-ALL|小/大箱与多物搜刮|run|run/chests.js|function takeAll|单收/全收/跳过；全收容量不足会散落，空卡库明示|下一箱/地图|taken追踪防重复，币结算|current
BATTLE-REWARD|战后搜刮|battle|run/chests.js|cur.battleSummary|战胜人数、剩余HP、战利品；与普通箱共壳但多战果|后续箱/消耗教程/地图|战后命令后开箱，非箱图证明胜利|current
AMMO-TUTORIAL|卡牌消耗教学|BATTLE-REWARD|hub/game.bag.settle.js|卡牌是消耗品|首次普通卡消耗说明，职业卡不同命运|战后流程|教学标记写Run|current
BATTLE-SETTLE-RETRY|战后保存失败恢复|battle|hub/game.bag.settle.js|战后结算未完成|失败留场景、重试保存奖励，不可重复领奖|成功再奖励链|战后命令幂等/身份守卫|current
DOOR|跨层闸门|run|run/game.run.altar.js|export function openDoorModal|进入下一层/门店，可取消；旧配对和合法去向检查|地图|层/位置/已访保存|current
RUN-SHOP|探索商店购买|run|run/game.run.shop.js|function renderShop|固定节点库存、牌/初攻/谜货；钱不足/满包/售罄反馈|地图或闸门|库存按stockKey写Run|current
RUN-SELL|探索商店出售|RUN-SHOP|run/game.run.shop.js|function renderSellPage|可售卡及报价；空包、安全卡/特殊存储筛选；卖后刷新|商店|卖币与移除卡Run保存|current
FIRE|火堆休息|run|run/game.run.altar.js|export function openFireRest|回10血、复原2张、概率职业卡；HP封顶/无可复原|复原页/地图|一次节点消费与Run保存|current
POCKET-RESTORE|消耗口袋复原选择|run|run/game.run.scenes.js|export function openPocketRestore|火堆/祭坛/修鞋铺来源，候选过滤/容量/剩余次数|来源回调|移出usedPocket回ownedCards|current
EVENT|事件正文与选择|run|run/game.run.flow.js|async function triggerEventCard|事件卡或旧表兜底、选择/下一步；选择完成才恢复idle|地图或事件子页|事件历史/效果Run保存|current
EVENT-CHOICE|事件药摊/军需选牌|EVENT|run/game.run.flow.js|function openEventCardChoice|药水/装备候选、空池、满包；军需先扣3币的风险独立核|事件收尾|支付与授牌顺序需对账|current
EVENT-RECODE|故障重编|EVENT|run/game.run.flow.js|function openEventRecode|非安全非stored同类型同稀有卡，最多选2；无可变卡退出|地图|确认变牌，取消不变|current
EVENT-GAMBLE|赌局抉择|EVENT|run/game.run.flow.js|function openEventGamble|付费尝试/离开、settled防重复；缺币不扣|地图|随机结果与币Run保存|current
LAST-LAMP|最后一盏灯故事选择|EVENT|run/game.run.flow.js|async function tryLastLampEvent|故事段落、身份绑定、选择结果；读/写失败重试不吞选择|结果页|story命令expectedRevision/runId|current
LAST-LAMP-RESULT|最后一盏灯结果/保存失败|LAST-LAMP|run/game.run.flow.js|function renderLastLampResult|结果文本、存档提示、完成/重试，旧身份不继续|地图|已提交记录防重复|current
ALTAR|污染祭坛|run|run/game.run.altar.js|export function openAltarRitual|弃3激活/碎片兑换/道具复原；不足说明、一次道具锁|地图/献祭/奖励|activated/pending/sacrificed保存|current
ALTAR-REWARD|祭坛二选一回赠|ALTAR|run/game.run.altar.js|function openAltarReward|复原3+10血或传说+装备；无口袋禁用、离开保留奖励|地图/复原页|先消耗pending后发牌，满包风险另核|current
ALTAR-FRAGMENT-FAIL|碎片兑换不可用说明|ALTAR|run/game.run.altar.js|碎片兑换 · 暂不可用|无职业/无能力池明确告知且碎片保留|祭坛|失败不扣碎片|current
SACRIFICE|献祭选牌|ALTAR/EXIT-PAY|run/game.run.altar.js|function openBagSacrifice|选满n才确认、类型筛选、UID去重；不足禁确认|来源取消回调|确认移除后done；非事务存档风险需核|current
BOSS-GATE|首脑入口|run|run/game.run.altar.js|export function openBossGate|介绍/挑战/离开，击破后拦再次战斗|地图/首脑编组|bossKilled守卫|current
EXIT-PAY|第三层紧急撤离|run|run/game.run.altar.js|export function openEmergencyModal|弃3成本、币不带回；卡不足禁用；旧档其它层停用|地图/献祭|确认进入extraction命令|current
EXIT-FINAL|第四层终局撤离|run|run/game.run.altar.js|终局撤离点|首脑未死锁、已死放行；币提示|地图/整理|成功结算与紧急撤离同命令|current
EXTRACT-STASH|撤离整理入库|run|run/game.run.altar.js|function renderExtractStash|逐堆、全收、智能、高价值优先；满库部分入库、未存会丢|最终确认到结算|pendingExtraction快照及revision|current
EXTRACT-RETRY|撤离快照保存失败|run|run/game.run.altar.js|function showExtractionRetry|重试保存，原局与整理身份保留，不能空称已落库|重试到整理|命令begin幂等|current
EXTRACT-DONE|撤离/通关成功结算|run|run/game.run.altar.js|function showExtractDone|带回/损失/XP、回基地/再出发；clear与extract统计不同共用页|基地出发|终结Run与记录|current
DEATH|死亡撤离失败结算|run|run/game.session.death.js|撤离失败|HP归零，安全格与损失表达，回基地/再来|基地|终局命令，失败走TERMINAL-RETRY|current
BAG|探索背包|run|hub/game.bag.js|function showBackpack|普通/安全格、口袋、排序、详情、拖放；空态/满格受守卫|来源hook或地图|Owned/safe/order随Run保存|current
BAG-DISCARD|背包丢弃确认|BAG|hub/game.bag.js|function showDiscardConfirm|明确单堆数量，取消保留|背包|确认才丢弃并保存|current
BAG-PEARL|珍珠盒资源存取|BAG|hub/game.bag.js|function openPearlStore|仅资源、容量、空候选；取出满包拒绝|背包|stored容器与Run|current
BAG-POUCH|法师锦囊法术存取|BAG|hub/game.bag.js|function openPouchStore|法术筛选、容量、空态、取出空间|背包|stored容器与Run|current
BATTLE|普通战斗主场|battle|battle/view/battle.view.js|function render(snapshot|费用/意图/手牌/元素/状态、出牌、拖拽、键盘；busy/敌方阶段禁动作|胜奖励/负死亡|战前Run与战后提交；不声称逐帧存档|current
BOSS-BATTLE|首脑战场|battle|battle/view/battle.view.js|opts.isBoss|首脑命名/血量/意图/编组牌；判负与首脑胜利不同结算|胜奖励/负死亡|bossKilled与专属奖励|current
BOSS-DECK|首脑战前编组|battle|battle/view/battle.overlays.js|function renderDeckSelection|牌库+装备选择，数量约束；不足/未选不发动，取消可重进|首脑门/开战|UID身份；战前不消耗首脑格|current
BATTLE-GRAVE|战斗墓地|BATTLE|battle/view/battle.overlays.js|function renderGrave|已打出消耗牌、空墓；不是普通弃牌堆|重绘战场|只读战中状态|current
BATTLE-DECK|首脑战牌库|BOSS-BATTLE|battle/view/battle.overlays.js|function renderDeckPileView|仅boss模式可开抽牌堆/弃牌堆与空态；不能用图库代替实际牌库|重绘战场|只读|current
BATTLE-BAG|战斗背包与安全格|BATTLE|battle/view/battle.overlays.js|function renderBattleBag|道具使用/安全移动；空态/满格/忙碌拒绝|重绘战场|战中状态后结算|current
BATTLE-CHOICE|战斗牌效抉择|BATTLE|battle/view/battle.view.js|if (choosing)|N选一只结算一项，无普遍跳过|战斗/下一效果|临时resolution续接|current
BATTLE-PAYMENT|战斗强制支付/手牌选择|BATTLE|battle/view/battle.view.js|if (handSelecting)|排除主牌/燃料/已选；强制选满才发动，可选效果可跳过；空候选|战斗/下一效果|费用和UID结算顺序|current
BATTLE-DISCOVER|战斗发现选牌|BATTLE|battle/view/battle.view.js|if (discovering)|候选选一入手，战后消散；空池由flow处理|战斗/下一队列|仅当场临时牌|current
BATTLE-INFUSE|战斗注能交互条|BATTLE|battle/view/battle.view.js|UI.act('btInfuseStart'|选燃料/确认/取消/直接打；同名叠UID轮转、主牌禁燃料|取消回手牌/发动选目标|燃料确认消耗，本牌结算|current
BATTLE-TARGET|目标选择与预览层|BATTLE|battle/view/battle.layers.js|setTargetable(selfUnit|单敌自选、多敌选择、自用/敌用过滤、Enter/Esc、伤害未知降级|取消回手牌|合法目标后才执行|current
BATTLE-SETTINGS|战斗设置|BATTLE|battle/view/battle.view.js|战斗设置|速度/音量等战场设置，返回重绘战场|战斗|偏好与实时节奏|current
TERM-TIP|术语说明浮层|shared|ui/term-tips.js|function show(el)|元素/消耗等词提示，未知词无tip，悬停/焦点/关闭|原页|只读|current
NODE-NOTE|结点备注编辑|dev|hub/game.notes.js|function openCellEditor|现有备注/空文、保存/清空/取消；保存失败保留输入|地图idle|按board与li/idx保存，旧坐标迁移|developer
NOTES-EXPORT|结点备注导出|dev|hub/game.notes.js|function showExportOverlay|JSON只读、复制失败可手选、下载；idle才能打开|地图|v3节点坐标文件，不等于馆方记录|developer
NOTES-IMPORT|结点备注导入|dev|hub/game.notes.js|function showImportOverlay|v3/v2/旧字典、JSON失败/部分写入失败明示|地图|合并覆盖同格备注；不改地图事件数据|developer
NOTES-CLEAR|清空结点备注确认|dev|hub/game.notes.js|function showClearOverlay|不可恢复明示，取消初始焦点|地图|确认才删除备注，评审不执行|developer
DEV-DEBUG|开发台·调试|dev|run/game.run.dev.js|function openDevConsole|资源/发卡/战斗修改仅Run/战中；显式影响存档|原地图/重绘战斗|调试写Run，证据必须标辅助|developer
DEV-AGENT|开发台·Agent|dev|agent/agent.console.js|function agentTabHTML|greedy/random/LLM、停机、turbo、观察；LLM配置/失败|开发台其它页签|策略配置/运行记录，不证明真人|developer
DEV-DATA|开发台·数据|dev|agent/agent.data.js|function dataPanelHTML|与跑局数据共内容，置于不同壳；导出/清空|开发台其它页签|本地records|developer
DEV-KEYS|开发台·快捷键|dev|agent/agent.console.js|function keysTabHTML|各路由can守卫和跳转，战中/Run禁基地|目标页或开发台|只读路由表|developer
SFX-AUDITION|独立音效试听页|tools|audio/sfx-audition.js|async function loadLibrary|库/方案/搜索/类别/播放暂停/进度音量/循环/连续；fetch/播放失败提示|独立tab|会话选择；音源存在非游戏cue接通|tool
HOME-SCENE|基地布置场景|deferred|hub/game.hub.js|function renderHomeScene|家具/布局/陈列/拖放、素材fallback、revision冲突；renderHub未调用该入口|基地页签|home命令保存，但入口未接不宣称已上线|source-only
LAB-DOOR|研究所大门|deferred|run/game.nest.js|export function openNestPrep|解锁钥匙/旧档入口，缺钥匙拒绝|标题|独立研究所解锁|deferred
LAB-PREP|研究所备战|deferred|run/game.nest.js|function enterNestPrep|箱牌/符文选择与开始，按候选容量|标题|独立nestRun|deferred
LAB-MAP|研究所地图|deferred|run/game.nest.js|export function renderNestMap|顺序节点/符文选择/元素盒子|研究所节点|独立nest状态|deferred
LAB-RUNES|研究所符文法阵|deferred|run/game.nest.js|function openRuneCircle|符文/开盒/继续，池空边界需后续验证|研究所推进|符文与独立Run|deferred
LAB-ALTAR|研究所祭坛|deferred|run/game.nest.js|function openNestAltar|能力/重掷/继续，资源与候选条件|研究所推进|独立nest状态|deferred
LAB-SHOP|研究所神秘商店|deferred|run/game.nest.js|function openNestShop|牌/职业/符文货，钱不足与售罄|研究所推进|独立nest购买|deferred
LAB-RETRY|研究所撤离失败重试|deferred|run/game.nest.js|function showNestExtractRetry|保存失败重试，pending身份检查|重试到结局/结算|nest结算命令|deferred
LAB-ENDING|研究所结局演出|deferred|run/lab.ending.js|playLabEnding|研究所专属演出，不能作为主图终局反证|研究所结算|独立终局|deferred
LAB-DONE|研究所行动结算|deferred|run/game.nest.js|function showLabSettlement|计分/符文/回标题|标题|独立nest结算记录|deferred
`.trim().split('\n').map(line => line.split('|'));
