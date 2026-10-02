# 当前 Vite 界面全覆盖清单

日期：2026-10-02。写属地仅本 coverage 目录。复用同轮根会话 handoff、gameplay/engineering/experience 报告；本代理只读源码与已有证据，未操作游戏、浏览器或存档，未 build/安装/提交。静态基线为 inventory.json 的 generatedAt=2026-10-02T13:22:48.020Z；249 个源码文件逐项 SHA256 已保存在 sourceFiles，接续收官未重新扫描或重新声称实时匹配。

目录按独立任务、决策、弹层和关键恢复状态拆分，现有 **110 个基本界面条目**；另列 **55 个真实数据/说明/层级变体**。这些不是 165 套独立布局，也不是完成率。职业卡池、六份帮助、三种成就视图、备注工具均有独立对账键；图库筛选的笛卡尔积、每张卡详情、随机候选池不人为乘成新页。

**证据口径：S只证明当前代码定义/接线/守卫，P探针只证明被测规则，B/H/A图与输入分别遵循根会话/美术报告来源。** 此目录不声称所有条目均正常点击可达；逐界面画面与美术批注由 art_annotations 按相同 ID 对账。有图/无图、真人/辅助、现行/冻结/暂缓必须分列。某条没有单独空态或失败页描述，表示静态目录未给独立状态，运行失败仍待核，不能写成不存在。

## 独立界面与状态

| ID / 中文名 | 父域 / 入口 | 正常、空态、失败边界 | 返回 / 持久化 | 功能分析 / 状态 |
| --- | --- | --- | --- | --- |
| TITLE · 标题与主页 | menu<br>`game/src/ui/game.menu.js:25`<br>function showTitle | 开始、继续及副入口；无档显示新建；最新档损坏须走档位恢复 | 返回：顶层<br>持久化：最新档摘要来自存储 | F02<br>现行入口/状态定义 |
| SLOTS · 五档存档选择 | menu<br>`game/src/ui/game.menu.js:586`<br>function openSlotPicker | 空档新建、已有档进入；损坏/旧版/撤离待整理分别处理；覆盖删除需确认 | 返回：标题<br>持久化：Base与Run按档隔离 | F01<br>现行入口/状态定义 |
| SLOT-RECOVERY · 读档恢复与进局过场 | SLOTS<br>`game/src/ui/game.menu.js:710`<br>UI.act('enterSlot' | 读取并校验基地/Run配对；不合法Run不得直接恢复；旧档进入告知 | 返回：失败回档位<br>持久化：恢复须核档位与runId | F01<br>现行入口/状态定义 |
| SETTINGS · 全局设置 | menu<br>`game/src/ui/game.menu.js:962`<br>function openSettings | 编号、提示、横幅、开发、震动、减动态、音源/音量；危险区二次点击 | 返回：原状态；从子页回设置<br>持久化：多数偏好localStorage，编号内存/Run口径另核 | F02、F07、F08<br>现行入口/状态定义 |
| GUIDE · 远征手册 | menu<br>`game/src/ui/game.menu.js:396`<br>function openTitleGuide | 说明探索、战斗、消耗、撤离；战斗modal返回须保留battle | 返回：来源页<br>持久化：只读 | F02<br>现行入口/状态定义 |
| TITLE-ACH · 标题成就总览 | menu<br>`game/src/ui/game.menu.js:433`<br>function openTitleAchievements | 汇总达成与未达成；与基地领奖不同入口 | 返回：标题<br>持久化：读取成就 | F02、F21<br>现行入口/状态定义 |
| INBOX · 留言信箱 | menu<br>`game/src/ui/game.menu.js:342`<br>function openSuggestionInbox | 异步载入/空信箱、导出、两步删除；失败须保留当前列表 | 返回：标题或设置<br>持久化：本地留言并有文件后端；浏览器origin限定 | F04<br>现行入口/状态定义 |
| SUGGESTION · 右键留言编辑 | menu<br>`game/src/ui/game.menu.js:228`<br>function openSuggestionBox | 目标、页面上下文、文本；保存中/失败信息 | 返回：关闭回当前页<br>持久化：本地/文件留言，不等于外部发送 | F05<br>现行入口/状态定义 |
| DATA · 跑局数据 | menu<br>`game/src/agent/agent.data.js:98`<br>function openDataPage | 无记录空态、统计与逐局、JSON/CSV导出、清空确认 | 返回：包装器回设置或隐藏<br>持久化：本地跑局记录，非人类留存 | F06<br>现行入口/状态定义 |
| LEAVE · 离开对局选择 | menu<br>`game/src/ui/game.menu.js:816`<br>function openLeaveMenu | 保存退出、继续、放弃；放弃走终局命令 | 返回：继续回地图<br>持久化：Run保存或放弃结算 | F03<br>现行入口/状态定义 |
| ABANDON-DONE · 放弃行动结算 | LEAVE<br>`game/src/ui/game.menu.js:869`<br>已放弃对局 | 损失提示、回基地/标题；保存失败不能显示已完成 | 返回：基地/标题<br>持久化：基地与Run终局成对提交 | F03<br>现行入口/状态定义 |
| TERMINAL-RETRY · 死亡或放弃保存失败 | menu<br>`game/src/ui/terminal-settlement.js:5`<br>终局结算未保存 | 明确失败且保留原局，重试受token与busy守卫 | 返回：重试后相应结算<br>持久化：终局命令幂等 | F03、F53<br>现行入口/状态定义 |
| EXIT-SCREEN · 退出游戏屏 | menu<br>`game/src/ui/game.menu.js:895`<br>function quitGame | 浏览器退出提示；不是原生EXE关闭 | 返回：浏览器导航语义<br>持久化：无新玩法结算 | 父域对应操作族；只读/演出不单独改变规则<br>现行入口/状态定义 |
| HUB-DEPLOY · 基地·出发 | hub<br>`game/src/hub/game.hub.depart.js:14`<br>function hubDeployHTML | 标准/精英、出征、目标预设、钥匙门预告；未选档由外层处理 | 返回：标题/其它页签<br>持久化：模式与基地资源 | F09、F10<br>现行入口/状态定义 |
| HUB-STASH · 基地·仓库 | hub<br>`game/src/hub/game.hub.pages.js:87`<br>function hubStashHTML | 卡库、材料、口袋、宠物；空仓/空口袋有说明 | 返回：标题/其它页签<br>持久化：每档基地 | F09、F16、F20<br>现行入口/状态定义 |
| HUB-SHOP · 基地·商店 | hub<br>`game/src/hub/game.hub.pages.js:40`<br>function hubShopHTML | 储备币买基础货物；钱不足、卡缺失、仓库满拒购 | 返回：标题/其它页签<br>持久化：purchase成功才落库 | F09、F11<br>现行入口/状态定义 |
| HUB-UPGRADE · 基地·升级 | hub<br>`game/src/hub/game.hub.pages.js:419`<br>function hubUpgradeHTML | 背包/仓库扩容、逐宠升级；不足/MAX禁用 | 返回：标题/其它页签<br>持久化：木材/口粮/等级 | F09、F18、F19<br>现行入口/状态定义 |
| HUB-CLASSES · 基地·人物 | hub<br>`game/src/hub/game.hub.pages.js:473`<br>function hubClassesHTML | 人物熟练度、卡池、可用皮肤；默认与素材缺失降级 | 返回：标题/其它页签<br>持久化：皮肤版本命令；熟练度跨局 | F09、F24<br>现行入口/状态定义 |
| HUB-ACH · 基地·成就收藏壳 | hub<br>`game/src/hub/game.hub.pages.js:564`<br>function hubAchHTML | 卡背/成就/职业收藏三子视图 | 返回：标题/其它页签<br>持久化：选中子视图会话内 | F09<br>现行入口/状态定义 |
| HUB-BACKS · 卡背图鉴 | HUB-ACH<br>`game/src/hub/game.hub.pages.js:593`<br>const equipped = B.backSel | 锁定条件、解锁、选中卡背 | 返回：成就/收藏子视图<br>持久化：每档卡背选用 | F22<br>现行入口/状态定义 |
| HUB-ACHIEVEMENTS · 基地成就列表 | HUB-ACH<br>`game/src/hub/game.hub.pages.js:569`<br>const rows = M.ACHIEVEMENTS | 未达成、可领、已领；卡奖励容量受命令控制 | 返回：卡背/收藏子视图<br>持久化：一次性领取 | F21<br>现行入口/状态定义 |
| HUB-COLLECTION · 职业收藏室 | HUB-ACH<br>`game/src/hub/game.hub.pages.js:517`<br>function collRoomHTML | 已收藏陈列、未收藏问号、5/15/30/45/全收集；领奖满库提示 | 返回：成就/卡背子视图<br>持久化：首次推进，重复收藏给XP | F14、F23<br>现行入口/状态定义 |
| HUB-PETS · 仓库宠物区域 | HUB-STASH<br>`game/src/hub/game.hub.pages.js:157`<br>function hubPetsHTML | 已拥有/携带及未孵化摘要；只能携一只 | 返回：仓库<br>持久化：逐宠拥有、携带、等级 | F18<br>现行入口/状态定义 |
| STASH-EGG · 宠物蛋孵化弹层 | HUB-STASH<br>`game/src/hub/game.hub.pages.js:180`<br>宠物蛋 + 50 币 | 未拥有随机宠物；贫穷/全齐/无蛋/保存失败拒绝 | 返回：仓库按钮<br>持久化：蛋币宠物原子写入 | F17<br>现行入口/状态定义 |
| STASH-MATERIAL · 材料使用弹层 | HUB-STASH<br>`game/src/hub/game.hub.pages.js:237`<br>仓库材料 | 单张/全部折入真实物资，不能卖；末张/全用再确认 | 返回：仓库按钮<br>持久化：消耗卡换资源 | F12<br>现行入口/状态定义 |
| STASH-ITEM · 仓库物品操作弹层 | HUB-STASH<br>`game/src/hub/game.hub.pages.js:293`<br>已收藏' : '[[icon:archive]] 仓库物品 | 卖单/卖全、职业收藏、特殊收藏锁、经济包；缺物回仓库 | 返回：仓库按钮<br>持久化：卡/币/收藏/XP命令 | F13、F14、F15、F16<br>现行入口/状态定义 |
| STASH-RAW · 仓库真实物资说明 | HUB-STASH<br>`game/src/hub/game.hub.pages.js:403`<br>function openRawItem | 木材/口粮/钥匙用途，只读不能卖 | 返回：仓库<br>持久化：只读 | F16<br>现行入口/状态定义 |
| STASH-CONFIRM · 仓库消耗与出售确认 | HUB-STASH<br>`game/src/hub/game.hub.pages.js:277`<br>const confirmStashAction | 明确消耗/出售数量，默认焦点保留；取消不耗物 | 返回：原物品<br>持久化：确认后命令落库 | F13<br>现行入口/状态定义 |
| MATERIAL-CONFIRM · 材料最后一张/全部使用确认 | STASH-MATERIAL<br>`game/src/hub/game.hub.pages.js:256`<br>const confirmMaterial | 消耗后卡消失的明示，取消不换资源 | 返回：材料弹层<br>持久化：确认后才换资源 | F12<br>现行入口/状态定义 |
| HUB-HELP · 基地六页签帮助弹层 | hub<br>`game/src/hub/game.hub.js:323`<br>function registerHubHelp | 六套独立内容；缺主题无入口；说明与实际规则应对账 | 返回：所在页签<br>持久化：只读 | F02、F65<br>现行入口/状态定义 |
| PREP-GOALS · 下一局收藏目标与两套预设 | HUB-DEPLOY<br>`game/src/hub/preparation.view.js:24`<br>function render(model) | 最多3目标、来源未知、两套愿望清单；缺牌/禁带/数量不足/错误告知 | 返回：基地出发<br>持久化：preparation命令保存；预览不扣资源 | F25、F26<br>现行入口/状态定义 |
| PREP · 出发整备 | HUB-DEPLOY<br>`game/src/hub/game.hub.depart.js:126`<br>function renderDepartPrep | 选择仓库卡/宠物、容量；职业禁带、缺卡/忙碌/保存失败拒出发 | 返回：基地出发<br>持久化：成功出发才扣仓库与清前口袋 | F18、F27、R08<br>现行入口/状态定义 |
| CLASS-CHOICE · 出征人物选择 | PREP<br>`game/src/run/game.run.altar.js:78`<br>export function openClassChoice | 人物、熟练度、立绘预览；局外入口与整备来源不同 | 返回：整备或标题<br>持久化：本局人物，选人页皮肤会话记忆 | F24、F28<br>现行入口/状态定义 |
| CLASS-POOL · 人物牌池预览 | CLASS-CHOICE<br>`game/src/run/game.run.altar.js:220`<br>const renderPool | 分页、选择、放大；无池空态 | 返回：人物选择<br>持久化：只读 | F28<br>现行入口/状态定义 |
| CLASS-GRANT · 职业初始补给 | CLASS-CHOICE<br>`game/src/run/game.run.altar.js:400`<br>clsGrantGo | 确认人物后职业牌/补给，继续落到探索；容量语义须保留初始配置 | 返回：探索地图<br>持久化：Run持久化 | F28<br>现行入口/状态定义 |
| STUDIO · 照相馆 | menu<br>`game/src/hub/game.cardslib.page.js:463`<br>function renderCardLibrary | 类型/稀有/职业/搜索/排序/分页、无结果、预览、编辑入口开关 | 返回：原卡页导航hook<br>持久化：筛选会话内，馆方记录保存 | F29、F30、F31<br>现行入口/状态定义 |
| CARD-ZOOM · 通用卡牌详情 | shared<br>`game/src/ui/ui.js:108`<br>showCardZoom(card | 放大规则/备注，来源可加带入/移出/使用；无卡不打开 | 返回：原焦点/来源页<br>持久化：备注按来源保存；查看只读 | F27、F30、F54<br>现行入口/状态定义 |
| PHOTO-ZOOM · 照相馆照片详情 | STUDIO<br>`game/src/ui/ui.js:135`<br>const photoMode | 照片正面与背签、馆方记录、图失效降级；独立于普通卡面 | 返回：照相馆焦点<br>持久化：编辑备注按库保存 | F30<br>现行入口/状态定义 |
| CARD-DESIGNER · 卡牌制作器 | STUDIO<br>`game/src/hub/game.cardslib.designer.js:102`<br>function renderDesigner | 类型、元素、数值、机制、预览；写入口受总开关限制 | 返回：照相馆<br>持久化：自定义卡库；非现行战斗牌验收 | F31、R11<br>制作器写总开关冻结 |
| CARDS-EXPORT · 卡牌导出 | STUDIO<br>`game/src/hub/game.cardslib.designer.js:304`<br>function showCardsExportOverlay | 复制/下载；Clipboard失败须反馈 | 返回：照相馆<br>持久化：文件导出不改Run | F32<br>现行入口/状态定义 |
| CARDS-IMPORT · 卡牌导入 | STUDIO<br>`game/src/hub/game.cardslib.designer.js:330`<br>function showCardsImportOverlay | JSON校验/失败提示；写入口受开关限制 | 返回：照相馆<br>持久化：自定义库写入 | F32<br>制作器写总开关冻结 |
| MAP · 探索地图与HUD | run<br>`game/src/run/expedition.view.js:72`<br>export function renderExpeditionPanel | 合法邻边、迷雾、路线卡、目标、闸门方向；忙碌/不邻接拒移 | 返回：节点结算后回图<br>持久化：turn/visited/种子/版本持久化 | F33、F65<br>现行入口/状态定义 |
| RUN-TRANSITION · 接敌/进节点/读档过场 | run<br>`game/src/run/game.run.scenes.js:113`<br>export function showRunTransition | 短过场可继续；身份/状态变更不得旧页覆盖新局 | 返回：目标节点<br>持久化：只读演出 | F33<br>现行入口/状态定义 |
| NODE-SAFE · 空白安全节点页 | run<br>`game/src/run/game.run.scenes.js:233`<br>export function openBlankSafePage | 无事件明示，继续前行 | 返回：地图<br>持久化：节点结束保存 | F34<br>现行入口/状态定义 |
| PICKUP · 币/木材/口粮/钥匙拾取 | run<br>`game/src/run/game.run.scenes.js:177`<br>export function openPickupPage | 搜寻/收取演出；卡缺失或容量不足须核发放结果 | 返回：地图/后续节点<br>持久化：收取时发物并保存 | F34<br>现行入口/状态定义 |
| RESOURCE-PICK · 物资投放资源二选一 | run<br>`game/src/run/game.run.flow.js:176`<br>function openResourcePick | 池空离开不耗节点，满包拒收保留可选，暂不领取 | 返回：地图<br>持久化：成功领取才消耗节点 | F35<br>现行入口/状态定义 |
| CHEST-SEARCH · 宝箱搜寻揭晓 | run<br>`game/src/run/chests.js:240`<br>function renderSearch | 箱队列序号、搜寻按钮；揭晓前后状态分离 | 返回：揭晓页<br>持久化：队列恢复范围待实页核 | F36<br>现行入口/状态定义 |
| CHEST-PICK · 中型宝箱三选一 | run<br>`game/src/run/chests.js:277`<br>function render() | 选一/跳过；满包腾格后重选；跳过收币卡散落 | 返回：下一箱/地图<br>持久化：发牌与节点结算 | F37<br>现行入口/状态定义 |
| CHEST-ALL · 小/大箱与多物搜刮 | run<br>`game/src/run/chests.js:404`<br>function takeAll | 单收/全收/跳过；全收容量不足会散落，空卡库明示 | 返回：下一箱/地图<br>持久化：taken追踪防重复，币结算 | F37<br>现行入口/状态定义 |
| BATTLE-REWARD · 战后搜刮 | battle<br>`game/src/run/chests.js:230`<br>cur.battleSummary | 战胜人数、剩余HP、战利品；与普通箱共壳但多战果 | 返回：后续箱/消耗教程/地图<br>持久化：战后命令后开箱，非箱图证明胜利 | F37、F38<br>现行入口/状态定义 |
| AMMO-TUTORIAL · 卡牌消耗教学 | BATTLE-REWARD<br>`game/src/hub/game.bag.settle.js:127`<br>卡牌是消耗品 | 首次普通卡消耗说明，职业卡不同命运 | 返回：战后流程<br>持久化：教学标记写Run | F38<br>现行入口/状态定义 |
| BATTLE-SETTLE-RETRY · 战后保存失败恢复 | battle<br>`game/src/hub/game.bag.settle.js:64`<br>战后结算未完成 | 失败留场景、重试保存奖励，不可重复领奖 | 返回：成功再奖励链<br>持久化：战后命令幂等/身份守卫 | F38<br>现行入口/状态定义 |
| DOOR · 跨层闸门 | run<br>`game/src/run/game.run.altar.js:414`<br>export function openDoorModal | 进入下一层/门店，可取消；旧配对和合法去向检查 | 返回：地图<br>持久化：层/位置/已访保存 | F39<br>现行入口/状态定义 |
| RUN-SHOP · 探索商店购买 | run<br>`game/src/run/game.run.shop.js:237`<br>function renderShop | 固定节点库存、牌/初攻/谜货；钱不足/满包/售罄反馈 | 返回：地图或闸门<br>持久化：库存按stockKey写Run | F40、F41<br>现行入口/状态定义 |
| RUN-SELL · 探索商店出售 | RUN-SHOP<br>`game/src/run/game.run.shop.js:274`<br>function renderSellPage | 可售卡及报价；空包、安全卡/特殊存储筛选；卖后刷新 | 返回：商店<br>持久化：卖币与移除卡Run保存 | F41<br>现行入口/状态定义 |
| FIRE · 火堆休息 | run<br>`game/src/run/game.run.altar.js:45`<br>export function openFireRest | 回10血、复原2张、概率职业卡；HP封顶/无可复原 | 返回：复原页/地图<br>持久化：一次节点消费与Run保存 | F42<br>现行入口/状态定义 |
| POCKET-RESTORE · 消耗口袋复原选择 | run<br>`game/src/run/game.run.scenes.js:303`<br>export function openPocketRestore | 火堆/祭坛/修鞋铺来源，候选过滤/容量/剩余次数 | 返回：来源回调<br>持久化：移出usedPocket回ownedCards | F42<br>现行入口/状态定义 |
| EVENT · 事件正文与选择 | run<br>`game/src/run/game.run.flow.js:423`<br>async function triggerEventCard | 事件卡或旧表兜底、选择/下一步；选择完成才恢复idle | 返回：地图或事件子页<br>持久化：事件历史/效果Run保存 | F43<br>现行入口/状态定义 |
| EVENT-CHOICE · 事件药摊/军需选牌 | EVENT<br>`game/src/run/game.run.flow.js:524`<br>function openEventCardChoice | 药水/装备候选、空池、满包；军需先扣3币的风险独立核 | 返回：事件收尾<br>持久化：支付与授牌顺序需对账 | F44<br>现行入口/状态定义 |
| EVENT-RECODE · 故障重编 | EVENT<br>`game/src/run/game.run.flow.js:565`<br>function openEventRecode | 非安全非stored同类型同稀有卡，最多选2；无可变卡退出 | 返回：地图<br>持久化：确认变牌，取消不变 | F45<br>现行入口/状态定义 |
| EVENT-GAMBLE · 赌局抉择 | EVENT<br>`game/src/run/game.run.flow.js:633`<br>function openEventGamble | 付费尝试/离开、settled防重复；缺币不扣 | 返回：地图<br>持久化：随机结果与币Run保存 | F45<br>现行入口/状态定义 |
| LAST-LAMP · 最后一盏灯故事选择 | EVENT<br>`game/src/run/game.run.flow.js:339`<br>async function tryLastLampEvent | 故事段落、身份绑定、选择结果；读/写失败重试不吞选择 | 返回：结果页<br>持久化：story命令expectedRevision/runId | F46<br>现行入口/状态定义 |
| LAST-LAMP-RESULT · 最后一盏灯结果/保存失败 | LAST-LAMP<br>`game/src/run/game.run.flow.js:309`<br>function renderLastLampResult | 结果文本、存档提示、完成/重试，旧身份不继续 | 返回：地图<br>持久化：已提交记录防重复 | F46<br>现行入口/状态定义 |
| ALTAR · 污染祭坛 | run<br>`game/src/run/game.run.altar.js:441`<br>export function openAltarRitual | 弃3激活/碎片兑换/道具复原；不足说明、一次道具锁 | 返回：地图/献祭/奖励<br>持久化：activated/pending/sacrificed保存 | F47<br>现行入口/状态定义 |
| ALTAR-REWARD · 祭坛二选一回赠 | ALTAR<br>`game/src/run/game.run.altar.js:529`<br>function openAltarReward | 复原3+10血或传说+装备；无口袋禁用、离开保留奖励 | 返回：地图/复原页<br>持久化：先消耗pending后发牌，满包风险另核 | F48<br>现行入口/状态定义 |
| ALTAR-FRAGMENT-FAIL · 碎片兑换不可用说明 | ALTAR<br>`game/src/run/game.run.altar.js:506`<br>碎片兑换 · 暂不可用 | 无职业/无能力池明确告知且碎片保留 | 返回：祭坛<br>持久化：失败不扣碎片 | F47<br>现行入口/状态定义 |
| SACRIFICE · 献祭选牌 | ALTAR/EXIT-PAY<br>`game/src/run/game.run.altar.js:622`<br>function openBagSacrifice | 选满n才确认、类型筛选、UID去重；不足禁确认 | 返回：来源取消回调<br>持久化：确认移除后done；非事务存档风险需核 | F49<br>现行入口/状态定义 |
| BOSS-GATE · 首脑入口 | run<br>`game/src/run/game.run.altar.js:574`<br>export function openBossGate | 介绍/挑战/离开，击破后拦再次战斗 | 返回：地图/首脑编组<br>持久化：bossKilled守卫 | F50<br>现行入口/状态定义 |
| EXIT-PAY · 第三层紧急撤离 | run<br>`game/src/run/game.run.altar.js:670`<br>export function openEmergencyModal | 弃3成本、币不带回；卡不足禁用；旧档其它层停用 | 返回：地图/献祭<br>持久化：确认进入extraction命令 | F51<br>现行入口/状态定义 |
| EXIT-FINAL · 第四层终局撤离 | run<br>`game/src/run/game.run.altar.js:418`<br>终局撤离点 | 首脑未死锁、已死放行；币提示 | 返回：地图/整理<br>持久化：成功结算与紧急撤离同命令 | F51<br>现行入口/状态定义 |
| EXTRACT-STASH · 撤离整理入库 | run<br>`game/src/run/game.run.altar.js:821`<br>function renderExtractStash | 逐堆、全收、智能、高价值优先；满库部分入库、未存会丢 | 返回：最终确认到结算<br>持久化：pendingExtraction快照及revision | F52<br>现行入口/状态定义 |
| EXTRACT-RETRY · 撤离快照保存失败 | run<br>`game/src/run/game.run.altar.js:815`<br>function showExtractionRetry | 重试保存，原局与整理身份保留，不能空称已落库 | 返回：重试到整理<br>持久化：命令begin幂等 | F53<br>现行入口/状态定义 |
| EXTRACT-DONE · 撤离/通关成功结算 | run<br>`game/src/run/game.run.altar.js:952`<br>function showExtractDone | 带回/损失/XP、回基地/再出发；clear与extract统计不同共用页 | 返回：基地出发<br>持久化：终结Run与记录 | F53<br>现行入口/状态定义 |
| DEATH · 死亡撤离失败结算 | run<br>`game/src/run/game.session.death.js:11`<br>撤离失败 | HP归零，安全格与损失表达，回基地/再来 | 返回：基地<br>持久化：终局命令，失败走TERMINAL-RETRY | F53、F62、R02<br>现行入口/状态定义 |
| BAG · 探索背包 | run<br>`game/src/hub/game.bag.js:520`<br>function showBackpack | 普通/安全格、口袋、排序、详情、拖放；空态/满格受守卫 | 返回：来源hook或地图<br>持久化：Owned/safe/order随Run保存 | F54、F55、R02、R10<br>现行入口/状态定义 |
| BAG-DISCARD · 背包丢弃确认 | BAG<br>`game/src/hub/game.bag.js:275`<br>function showDiscardConfirm | 明确单堆数量，取消保留 | 返回：背包<br>持久化：确认才丢弃并保存 | F54<br>现行入口/状态定义 |
| BAG-PEARL · 珍珠盒资源存取 | BAG<br>`game/src/hub/game.bag.js:419`<br>function openPearlStore | 仅资源、容量、空候选；取出满包拒绝 | 返回：背包<br>持久化：stored容器与Run | F55、R10<br>现行入口/状态定义 |
| BAG-POUCH · 法师锦囊法术存取 | BAG<br>`game/src/hub/game.bag.js:352`<br>function openPouchStore | 法术筛选、容量、空态、取出空间 | 返回：背包<br>持久化：stored容器与Run | F55、R10<br>现行入口/状态定义 |
| BATTLE · 普通战斗主场 | battle<br>`game/src/battle/view/battle.view.js:203`<br>function render(snapshot | 费用/意图/手牌/元素/状态、出牌、拖拽、键盘；busy/敌方阶段禁动作 | 返回：胜奖励/负死亡<br>持久化：战前Run与战后提交；不声称逐帧存档 | F56、F58、F60、F62、R01、R02、R03、R04、R05、R07、R08、R09、R10、R11<br>现行入口/状态定义 |
| BOSS-BATTLE · 首脑战场 | battle<br>`game/src/battle/view/battle.view.js:233`<br>opts.isBoss | 首脑命名/血量/意图/编组牌；判负与首脑胜利不同结算 | 返回：胜奖励/负死亡<br>持久化：bossKilled与专属奖励 | F58、R01、R07<br>现行入口/状态定义 |
| BOSS-DECK · 首脑战前编组 | battle<br>`game/src/battle/view/battle.overlays.js:19`<br>function renderDeckSelection | 牌库+装备选择，数量约束；不足/未选不发动，取消可重进 | 返回：首脑门/开战<br>持久化：UID身份；战前不消耗首脑格 | F50、R08<br>现行入口/状态定义 |
| BATTLE-GRAVE · 战斗墓地 | BATTLE<br>`game/src/battle/view/battle.overlays.js:58`<br>function renderGrave | 已打出消耗牌、空墓；不是普通弃牌堆 | 返回：重绘战场<br>持久化：只读战中状态 | F61、R04<br>现行入口/状态定义 |
| BATTLE-DECK · 首脑战牌库 | BOSS-BATTLE<br>`game/src/battle/view/battle.overlays.js:89`<br>function renderDeckPileView | 仅boss模式可开抽牌堆/弃牌堆与空态；不能用图库代替实际牌库 | 返回：重绘战场<br>持久化：只读 | F61、R04<br>现行入口/状态定义 |
| BATTLE-BAG · 战斗背包与安全格 | BATTLE<br>`game/src/battle/view/battle.overlays.js:118`<br>function renderBattleBag | 道具使用/安全移动；空态/满格/忙碌拒绝 | 返回：重绘战场<br>持久化：战中状态后结算 | F60、F61、R08<br>现行入口/状态定义 |
| BATTLE-CHOICE · 战斗牌效抉择 | BATTLE<br>`game/src/battle/view/battle.view.js:227`<br>if (choosing) | N选一只结算一项，无普遍跳过 | 返回：战斗/下一效果<br>持久化：临时resolution续接 | F59、R09<br>现行入口/状态定义 |
| BATTLE-PAYMENT · 战斗强制支付/手牌选择 | BATTLE<br>`game/src/battle/view/battle.view.js:240`<br>if (handSelecting) | 排除主牌/燃料/已选；强制选满才发动，可选效果可跳过；空候选 | 返回：战斗/下一效果<br>持久化：费用和UID结算顺序 | F59、R06<br>现行入口/状态定义 |
| BATTLE-DISCOVER · 战斗发现选牌 | BATTLE<br>`game/src/battle/view/battle.view.js:274`<br>if (discovering) | 候选选一入手，战后消散；空池由flow处理 | 返回：战斗/下一队列<br>持久化：仅当场临时牌 | F59、R06<br>现行入口/状态定义 |
| BATTLE-INFUSE · 战斗注能交互条 | BATTLE<br>`game/src/battle/view/battle.view.js:504`<br>UI.act('btInfuseStart' | 选燃料/确认/取消/直接打；同名叠UID轮转、主牌禁燃料 | 返回：取消回手牌/发动选目标<br>持久化：燃料确认消耗，本牌结算 | F57、R05<br>现行入口/状态定义 |
| BATTLE-TARGET · 目标选择与预览层 | BATTLE<br>`game/src/battle/view/battle.layers.js:562`<br>setTargetable(selfUnit | 单敌自选、多敌选择、自用/敌用过滤、Enter/Esc、伤害未知降级 | 返回：取消回手牌<br>持久化：合法目标后才执行 | F56、F60、R01、R03<br>现行入口/状态定义 |
| BATTLE-SETTINGS · 战斗设置 | BATTLE<br>`game/src/battle/view/battle.view.js:414`<br>战斗设置 | 速度/音量等战场设置，返回重绘战场 | 返回：战斗<br>持久化：偏好与实时节奏 | F07、F61<br>现行入口/状态定义 |
| TERM-TIP · 术语说明浮层 | shared<br>`game/src/ui/term-tips.js:93`<br>function show(el) | 元素/消耗等词提示，未知词无tip，悬停/焦点/关闭 | 返回：原页<br>持久化：只读 | F65、R03<br>现行入口/状态定义 |
| NODE-NOTE · 结点备注编辑 | dev<br>`game/src/hub/game.notes.js:43`<br>function openCellEditor | 现有备注/空文、保存/清空/取消；保存失败保留输入 | 返回：地图idle<br>持久化：按board与li/idx保存，旧坐标迁移 | F67<br>开发工具 |
| NOTES-EXPORT · 结点备注导出 | dev<br>`game/src/hub/game.notes.js:113`<br>function showExportOverlay | JSON只读、复制失败可手选、下载；idle才能打开 | 返回：地图<br>持久化：v3节点坐标文件，不等于馆方记录 | F68<br>开发工具 |
| NOTES-IMPORT · 结点备注导入 | dev<br>`game/src/hub/game.notes.js:140`<br>function showImportOverlay | v3/v2/旧字典、JSON失败/部分写入失败明示 | 返回：地图<br>持久化：合并覆盖同格备注；不改地图事件数据 | F68<br>开发工具 |
| NOTES-CLEAR · 清空结点备注确认 | dev<br>`game/src/hub/game.notes.js:184`<br>function showClearOverlay | 不可恢复明示，取消初始焦点 | 返回：地图<br>持久化：确认才删除备注，评审不执行 | F68<br>开发工具 |
| DEV-DEBUG · 开发台·调试 | dev<br>`game/src/run/game.run.dev.js:84`<br>function openDevConsole | 资源/发卡/战斗修改仅Run/战中；显式影响存档 | 返回：原地图/重绘战斗<br>持久化：调试写Run，证据必须标辅助 | F63<br>开发工具 |
| DEV-AGENT · 开发台·Agent | dev<br>`game/src/agent/agent.console.js:38`<br>function agentTabHTML | greedy/random/LLM、停机、turbo、观察；LLM配置/失败 | 返回：开发台其它页签<br>持久化：策略配置/运行记录，不证明真人 | F63<br>开发工具 |
| DEV-DATA · 开发台·数据 | dev<br>`game/src/agent/agent.data.js:35`<br>function dataPanelHTML | 与跑局数据共内容，置于不同壳；导出/清空 | 返回：开发台其它页签<br>持久化：本地records | F06<br>开发工具 |
| DEV-KEYS · 开发台·快捷键 | dev<br>`game/src/agent/agent.console.js:96`<br>function keysTabHTML | 各路由can守卫和跳转，战中/Run禁基地 | 返回：目标页或开发台<br>持久化：只读路由表 | F63<br>开发工具 |
| SFX-AUDITION · 独立音效试听页 | tools<br>`game/src/audio/sfx-audition.js:66`<br>async function loadLibrary | 库/方案/搜索/类别/播放暂停/进度音量/循环/连续；fetch/播放失败提示 | 返回：独立tab<br>持久化：会话选择；音源存在非游戏cue接通 | F65<br>独立工具页 |
| HOME-SCENE · 基地布置场景 | deferred<br>`game/src/hub/game.hub.js:80`<br>function renderHomeScene | 家具/布局/陈列/拖放、素材fallback、revision冲突；renderHub未调用该入口 | 返回：基地页签<br>持久化：home命令保存，但入口未接不宣称已上线 | F66<br>源码存在、主入口未接 |
| LAB-DOOR · 研究所大门 | deferred<br>`game/src/run/game.nest.js:102`<br>export function openNestPrep | 解锁钥匙/旧档入口，缺钥匙拒绝 | 返回：标题<br>持久化：独立研究所解锁 | F64<br>研究所暂缓 |
| LAB-PREP · 研究所备战 | deferred<br>`game/src/run/game.nest.js:142`<br>function enterNestPrep | 箱牌/符文选择与开始，按候选容量 | 返回：标题<br>持久化：独立nestRun | F64<br>研究所暂缓 |
| LAB-MAP · 研究所地图 | deferred<br>`game/src/run/game.nest.js:228`<br>export function renderNestMap | 顺序节点/符文选择/元素盒子 | 返回：研究所节点<br>持久化：独立nest状态 | F64<br>研究所暂缓 |
| LAB-RUNES · 研究所符文法阵 | deferred<br>`game/src/run/game.nest.js:391`<br>function openRuneCircle | 符文/开盒/继续，池空边界需后续验证 | 返回：研究所推进<br>持久化：符文与独立Run | F64<br>研究所暂缓 |
| LAB-ALTAR · 研究所祭坛 | deferred<br>`game/src/run/game.nest.js:417`<br>function openNestAltar | 能力/重掷/继续，资源与候选条件 | 返回：研究所推进<br>持久化：独立nest状态 | F64<br>研究所暂缓 |
| LAB-SHOP · 研究所神秘商店 | deferred<br>`game/src/run/game.nest.js:451`<br>function openNestShop | 牌/职业/符文货，钱不足与售罄 | 返回：研究所推进<br>持久化：独立nest购买 | F64<br>研究所暂缓 |
| LAB-RETRY · 研究所撤离失败重试 | deferred<br>`game/src/run/game.nest.js:519`<br>function showNestExtractRetry | 保存失败重试，pending身份检查 | 返回：重试到结局/结算<br>持久化：nest结算命令 | 父域对应操作族；只读/演出不单独改变规则<br>研究所暂缓 |
| LAB-ENDING · 研究所结局演出 | deferred<br>`game/src/run/lab.ending.js:31`<br>playLabEnding | 研究所专属演出，不能作为主图终局反证 | 返回：研究所结算<br>持久化：独立终局 | F64<br>研究所暂缓 |
| LAB-DONE · 研究所行动结算 | deferred<br>`game/src/run/game.nest.js:633`<br>function showLabSettlement | 计分/符文/回标题 | 返回：标题<br>持久化：独立nest结算记录 | F64<br>研究所暂缓 |

## 二/三级内容与共享模板变体

五个人物分别是无·侠客、常无欲·降临者、白塔·法师、黑像·战士、星月·牧师。CLASS-POOL 各变体由同一 renderPool(sel) 模板绘制，池内容/职业配色/卡牌详情不同；页数由实际池长和每页最多10张均衡算法决定。人物详情也在 CLASS-CHOICE 共享舞台内切换，HUB-CLASSES 是熟练度档案网格，不冒称另有五个独立弹窗。

| 变体 ID | 共享模板 / 名称 | 来源与范围 |
| --- | --- | --- |
| CLASS-CHOICE-WU | CLASS-CHOICE · 无·侠客 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| CLASS-CHOICE-CHANGWUYU | CLASS-CHOICE · 常无欲·降临者 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| CLASS-CHOICE-BAITA | CLASS-CHOICE · 白塔·法师 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| CLASS-CHOICE-HEIXIANG | CLASS-CHOICE · 黑像·战士 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| CLASS-CHOICE-XINGYUE | CLASS-CHOICE · 星月·牧师 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| CLASS-POOL-WU | CLASS-POOL · 无·侠客 | game/src/core/characters.js:3<br>sel改变数据，10张上限均衡分页，完整池和详情；不是五套独立模板。 |
| CLASS-POOL-CHANGWUYU | CLASS-POOL · 常无欲·降临者 | game/src/core/characters.js:3<br>sel改变数据，10张上限均衡分页，完整池和详情；不是五套独立模板。 |
| CLASS-POOL-BAITA | CLASS-POOL · 白塔·法师 | game/src/core/characters.js:3<br>sel改变数据，10张上限均衡分页，完整池和详情；不是五套独立模板。 |
| CLASS-POOL-HEIXIANG | CLASS-POOL · 黑像·战士 | game/src/core/characters.js:3<br>sel改变数据，10张上限均衡分页，完整池和详情；不是五套独立模板。 |
| CLASS-POOL-XINGYUE | CLASS-POOL · 星月·牧师 | game/src/core/characters.js:3<br>sel改变数据，10张上限均衡分页，完整池和详情；不是五套独立模板。 |
| HUB-CLASSES-WU | HUB-CLASSES · 无·侠客 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-CLASSES-CHANGWUYU | HUB-CLASSES · 常无欲·降临者 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-CLASSES-BAITA | HUB-CLASSES · 白塔·法师 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-CLASSES-HEIXIANG | HUB-CLASSES · 黑像·战士 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-CLASSES-XINGYUE | HUB-CLASSES · 星月·牧师 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-COLLECTION-WU | HUB-COLLECTION · 无·侠客 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-COLLECTION-CHANGWUYU | HUB-COLLECTION · 常无欲·降临者 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-COLLECTION-BAITA | HUB-COLLECTION · 白塔·法师 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-COLLECTION-HEIXIANG | HUB-COLLECTION · 黑像·战士 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-COLLECTION-XINGYUE | HUB-COLLECTION · 星月·牧师 | game/src/core/characters.js:3<br>数据/立绘/规则变体；不是独立导航壳。 |
| HUB-HELP-DEPLOY | HUB-HELP · deploy | game/src/hub/game.hub.js:323<br>六份独立说明内容与返回回调。 |
| HUB-HELP-STASH | HUB-HELP · stash | game/src/hub/game.hub.js:323<br>六份独立说明内容与返回回调。 |
| HUB-HELP-SHOP | HUB-HELP · shop | game/src/hub/game.hub.js:323<br>六份独立说明内容与返回回调。 |
| HUB-HELP-UPGRADE | HUB-HELP · upgrade | game/src/hub/game.hub.js:323<br>六份独立说明内容与返回回调。 |
| HUB-HELP-CLASSES | HUB-HELP · classes | game/src/hub/game.hub.js:323<br>六份独立说明内容与返回回调。 |
| HUB-HELP-ACH | HUB-HELP · ach | game/src/hub/game.hub.js:323<br>六份独立说明内容与返回回调。 |
| HUB-DEPLOY-STANDARD | HUB-DEPLOY · standard | game/src/run/game.session.modes.js:9<br>同地图倍率变体，不是额外地图。 |
| HUB-DEPLOY-ELITE | HUB-DEPLOY · elite | game/src/run/game.session.modes.js:9<br>同地图倍率变体，不是额外地图。 |
| CHEST-SMALL | CHEST-ALL · small | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-MEDIUM | CHEST-PICK · medium | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-BIG | CHEST-ALL · big | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-CLASS | CHEST-ALL · class | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-BOSSREWARD | CHEST-ALL · bossReward | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-MULTIQUEUE | CHEST-ALL · multiQueue | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-FULLBAG | CHEST-ALL · fullBag | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| CHEST-EMPTYCATALOG | CHEST-ALL · emptyCatalog | game/src/run/chests.js:277<br>箱级/奖励/满包/队列状态变体，规则分别见F36/F37/F38。 |
| MAP-LAYER1 | MAP · 第1层 | game/src/run/layeredMap.js<br>不同地图内容/节点，非重复独立壳。 |
| MAP-LAYER2 | MAP · 第2层 | game/src/run/layeredMap.js<br>不同地图内容/节点，非重复独立壳。 |
| MAP-LAYER3 | MAP · 第3层 | game/src/run/layeredMap.js<br>不同地图内容/节点，非重复独立壳。 |
| MAP-LAYER4 | MAP · 第4层 | game/src/run/layeredMap.js<br>不同地图内容/节点，非重复独立壳。 |
| HUB-ACH-VIEW-BACKS | HUB-BACKS · backs | game/src/hub/game.hub.js:214<br>三项在interface目录已各自单列。 |
| HUB-ACH-VIEW-ACHIEVEMENTS | HUB-ACHIEVEMENTS · achievements | game/src/hub/game.hub.js:214<br>三项在interface目录已各自单列。 |
| HUB-ACH-VIEW-CLASSES | HUB-COLLECTION · classes | game/src/hub/game.hub.js:214<br>三项在interface目录已各自单列。 |
| STUDIO-TYPE-全部 | STUDIO · 全部 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-武术 | STUDIO · 武术 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-法术 | STUDIO · 法术 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-生物 | STUDIO · 生物 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-道具 | STUDIO · 道具 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-装备 | STUDIO · 装备 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-事件 | STUDIO · 事件 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-能力卡 | STUDIO · 能力卡 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| STUDIO-TYPE-资源 | STUDIO · 资源 | game/src/hub/game.cardslib.page.js:485; game/src/cards/cards.rules.js:25<br>真实TYPES数组生成，共享筛选模板；不承诺每类有卡。 |
| LAB-ENDING-1 | LAB-ENDING · crisis | game/src/run/lab.ending.js:14<br>三页独立文本与插画，暂缓研究所；非主图结局。 |
| LAB-ENDING-2 | LAB-ENDING · flight | game/src/run/lab.ending.js:14<br>三页独立文本与插画，暂缓研究所；非主图结局。 |
| LAB-ENDING-3 | LAB-ENDING · abyss | game/src/run/lab.ending.js:14<br>三页独立文本与插画，暂缓研究所；非主图结局。 |

## 完整静态接线与未归类边界

机器使用现有 acorn 对全部 game/src JS 作 AST 解析，忽略注释里的假调用。扫描留下 275 个 UI.act 注册点、106 个渲染/节点壳调用点、204 个直接 DOM 监听点、292 个模板 data-act/data-action 片段及 main index 的 33 个控件标签。注册点保留 path/line/function/handler；同名重复注册和删除handler不折成一条，不从注册存在推按钮可见。parseFailures=0，missingAnchors=0，未归类 UI.act=0。

11处动态注册未求值；循环索引/元素/终局重试名不假报全部实例已运行：

| 动态表达式 | 源码 | 对应操作族 |
| --- | --- | --- |
| 'nestPick' + i | `game/src/run/game.nest.js:168` | F64 |
| 'nestRune' + i | `game/src/run/game.nest.js:173` | F64 |
| 'nestCell' + i | `game/src/run/game.nest.js:245` | F64 |
| 'nestPickRune' + i | `game/src/run/game.nest.js:246` | F64 |
| 'nestBox' + at | `game/src/run/game.nest.js:254` | F64 |
| 'rc' + i | `game/src/run/game.nest.js:400` | F64 |
| 'nsC' + i | `game/src/run/game.nest.js:479` | F64 |
| 'nsK' + i | `game/src/run/game.nest.js:480` | F64 |
| 'nsR' + i | `game/src/run/game.nest.js:481` | F64 |
| 'resPick' + i | `game/src/run/game.run.flow.js:201` | F35 |
| retryAct | `game/src/ui/terminal-settlement.js:34` | F53 |

直接监听器有 17 处没有归到玩家操作族，逐路径行号显式保留。这些底层/QA监听不是漏掉的“可点页面”，但仍属于静态扫描边界：

| 文件 | 行号 / 事件 | 范围解释 |
| --- | --- | --- |
| `game/src/core/art.js` | 80 ('load')、322 ('load') | 图片加载/回退与素材处理，非独立操作页 |
| `game/src/core/diagnostics.local.js` | 124 ('error')、127 ('unhandledrejection') | 错误/性能采集，非玩法动作 |
| `game/src/core/icons-bitmap.js` | 108 ('error') | 图片加载/回退与素材处理，非独立操作页 |
| `game/src/core/motion.js` | 36 ('change') | 动态偏好媒体查询同步 |
| `game/src/core/perf-probe.local.js` | 125 ('click') | 错误/性能采集，非玩法动作 |
| `game/src/e2.snapshot.qa.js` | 14 ('click')、75 ('click')、109 ('click')、110 ('click')、111 ('click') | QA探针触发、非现行玩家任务 |
| `game/src/r7a.qa.js` | 8 ('click')、20 ('click')、21 ('click')、22 ('click') | QA探针触发、非现行玩家任务 |
| `game/src/ui/ui-scale.js` | 51 ('resize') | 尺寸/DPR同步；本轮未多尺寸验证 |

未覆盖：所有卡牌、事件、宠物、成就条件的正常可达性及任意组合；随机生成的全部地图/库存；每种损坏存档与存储失败实页；拖拽/键盘全链、声音实听、自然动画全过程；研究所完整实战与布置入口上线。BATTLE-DECK 仅首脑模式，普通战全部可用牌入手且没有该抽牌堆入口。制作器增删改与导入写开关为 false；旧 showBagCardDetail 为历史保留函数，不把其合成按钮登记为已开放操作。研究所与源码存在的布置仅登记，不扩开发。

复跑入口（仅静态产物；需要重新核源码时才运行扫描）：

```powershell
node docs/evidence/2026-10-02-production-research/diagnosis/coverage/scan-inventory.mjs
node docs/evidence/2026-10-02-production-research/diagnosis/coverage/build-reports.mjs
```
