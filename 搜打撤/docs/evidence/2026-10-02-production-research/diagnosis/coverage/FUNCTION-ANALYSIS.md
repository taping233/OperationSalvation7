# 当前功能与规则族分析

日期：2026-10-02。本报告分析玩家/开发者的操作目的、条件、实际执行结果和失败风险，不以“战斗已分析”覆盖全部战斗动作。68个操作族与11个规则族，对应完整注册清单与独立界面；登记和建议不是实施授权。

证据复用：[gameplay](../gameplay/REPORT.md) 的GP-01安全往返XP、GP-02层数/共用收尾；[experience](../experience/REPORT.md) 的E01/E02专属音接线、E03物资标题遮挡及已证普通战闭环；[engineering](../engineering/REPORT.md) 的工程/契约范围。以上已证事项不重新包装为本代理实测。其余“风险”是由执行顺序/守卫推导的待核项，反证与建议紧随，不据此断言故障已经发生。

## 操作与规则分析

### F01 · 新建/继续/覆盖/删除档位

- 玩家意图与前提：玩家要进入指定档；档位、Base/Run版本与恢复配对须有效
- 实现结果：空档新建；已有档恢复基地或Run；覆盖/删除经确认
- 失败风险/反证：跨档旧回调、损坏Run、读档期间连点可错入档；不能以文件存在推有效。已有反证：enteringSlot锁及验证/恢复分支已有
- 建议与边界：逐档空/旧/损坏/待整理定向验，不重做全游戏
- 独立界面：SLOTS、SLOT-RECOVERY；动作：newSlot、enterSlot、overwriteSlot、delSlot、slotBack
- 来源：`game/src/ui/game.menu.js:586`；`game/src/ui/game.menu.js:710`；`game/src/ui/game.menu.js:709`；`game/src/ui/game.menu.js:784`；`game/src/ui/game.menu.js:790`；`game/src/ui/game.menu.js:797`

### F02 · 标题与通用返回入口

- 玩家意图与前提：玩家想退出阅读并回原任务；战斗/Run状态应保留
- 实现结果：按来源关闭/返回设置或标题
- 失败风险/反证：同一返回函数被dataset误当布尔参数；modal回idle会丢战场。已有反证：数据/留言包装器及手册战斗守卫已有
- 建议与边界：以来源页矩阵对账返回，复用已证普通战
- 独立界面：TITLE、GUIDE、TITLE-ACH、SETTINGS、HUB-HELP；动作：closeBase、guideBack、achBack、toTitle、openInbox、openDataPageUi、closeSettings、helpBack
- 来源：`game/src/ui/game.menu.js:25`；`game/src/ui/game.menu.js:962`；`game/src/ui/game.menu.js:396`；`game/src/ui/game.menu.js:433`；`game/src/hub/game.hub.js:323`；`game/src/hub/game.hub.js:314`；`game/src/ui/game.menu.js:421`；`game/src/ui/game.menu.js:462`；`game/src/ui/game.menu.js:884`；`game/src/ui/game.menu.js:1042`；`game/src/ui/game.menu.js:1043`；`game/src/ui/game.menu.js:1044`；`game/src/ui/overlay.js:27`

### F03 · 保存退出/放弃行动

- 玩家意图与前提：玩家要保留进度或承担放弃损失；当前Run身份有效
- 实现结果：保存退出留Run；取消回图；放弃走终局命令
- 失败风险/反证：保存失败若仍退出可能以为已保存；终局失败不应清原局。已有反证：runTerminalSettlement保留原局并重试
- 建议与边界：故障注入仅隔离探针；实页不得覆盖老板存档
- 独立界面：LEAVE、ABANDON-DONE、TERMINAL-RETRY；动作：leaveSave、leaveCancel、leaveAbandon
- 来源：`game/src/ui/game.menu.js:816`；`game/src/ui/game.menu.js:869`；`game/src/ui/terminal-settlement.js:5`；`game/src/ui/game.menu.js:827`；`game/src/ui/game.menu.js:828`；`game/src/ui/game.menu.js:829`

### F04 · 留言阅读/导出/删除

- 玩家意图与前提：玩家查反馈；异步缓存加载完成、删除二次确认
- 实现结果：按状态陈列/下载；确认后删指定ts
- 失败风险/反证：时戳查DOM、异步返旧页、文件后端故障；导出可能不包含未加载记录。已有反证：renderSugBox与明确两步删除已有
- 建议与边界：核空/有/失败，区分origin与文件库
- 独立界面：INBOX；动作：sugBack、sugExport、sugDel
- 来源：`game/src/ui/game.menu.js:342`；`game/src/ui/game.menu.js:359`；`game/src/ui/game.menu.js:363`；`game/src/ui/game.menu.js:369`

### F05 · 右键反馈撰写

- 玩家意图与前提：玩家记录具体元素问题；目标、上下文与文本输入
- 实现结果：保存正文及复现/期望/实际，失败保持可重试
- 失败风险/反证：保存位置/当前页绑定失配，不能把本地保存当邮件发送。已有反证：已有字段与saveSuggestion错误路径
- 建议与边界：补一个实际保存回读证据，未授权时只读
- 独立界面：SUGGESTION；动作：直接DOM/命令/自动规则，无独立UI.act
- 来源：`game/src/ui/game.menu.js:228`

### F06 · 跑局统计导出/清空

- 玩家意图与前提：玩家/开发者看已记录局；清空须确认
- 实现结果：汇总成功失败与记录，导出文件或清空本地
- 失败风险/反证：Agent局可能误解释真人留存；空记录不能证明没有游玩。已有反证：明确records来源，导出JSON/CSV共存
- 建议与边界：区分agent/real-input证据，勿拿胜率充完成率
- 独立界面：DATA、DEV-DATA；动作：dataExportJSON、dataExportCSV、dataClear
- 来源：`game/src/agent/agent.data.js:98`；`game/src/agent/agent.data.js:35`；`game/src/agent/agent.data.js:83`；`game/src/agent/agent.data.js:84`；`game/src/agent/agent.data.js:85`

### F07 · 偏好/音频/动态控制

- 玩家意图与前提：玩家调舒适性；当前Sound/DOM存在
- 实现结果：即时编号、横幅提示、开发、震动减动态、音乐来源与音量
- 失败风险/反证：部分偏好仅内存，持久化失败静默；unknown cue音量再大仍无声。已有反证：experience已证通用音与静音链存在
- 建议与边界：优先cue对账，逐控件重载仅必要项
- 独立界面：SETTINGS、BATTLE-SETTINGS；动作：直接DOM/命令/自动规则，无独立UI.act
- 来源：`game/src/ui/game.menu.js:962`；`game/src/battle/view/battle.view.js:414`

### F08 · 危险区数据清空

- 玩家意图与前提：玩家明确要清备注/卡库/五档；2.6秒内二次确认
- 实现结果：删除对应数据，不可撤销
- 失败风险/反证：按钮误触/全五档范围误认；卡库清空可能改随机池。已有反证：二次点击文案与分级危险布局已有
- 建议与边界：只评确认信息，不在评审执行破坏动作
- 独立界面：SETTINGS；动作：wipeNotes、wipeCards、wipeSave
- 来源：`game/src/ui/game.menu.js:962`；`game/src/ui/game.menu.js:1028`；`game/src/ui/game.menu.js:1032`；`game/src/ui/game.menu.js:1036`

### F09 · 基地与成就子视图导航

- 玩家意图与前提：玩家切六页/三子视图；不是战中绕过入口
- 实现结果：重绘内容与帮助，成就待领奖点
- 失败风险/反证：同一基地截图无法证明其它五页；子视图状态重绘/焦点丢失。已有反证：quick-nav can禁止战斗/Run进入基地
- 建议与边界：每页独立图与批注，不做多尺寸
- 独立界面：HUB-DEPLOY、HUB-STASH、HUB-SHOP、HUB-UPGRADE、HUB-CLASSES、HUB-ACH；动作：hubTab、hubCollectionView
- 来源：`game/src/hub/game.hub.depart.js:14`；`game/src/hub/game.hub.pages.js:87`；`game/src/hub/game.hub.pages.js:40`；`game/src/hub/game.hub.pages.js:419`；`game/src/hub/game.hub.pages.js:473`；`game/src/hub/game.hub.pages.js:564`；`game/src/hub/game.hub.js:208`；`game/src/hub/game.hub.js:214`

### F10 · 玩法模式与钥匙门预告

- 玩家意图与前提：玩家选标准/精英或查钥匙门；模式合法
- 实现结果：模式存基地，下局倍率；钥匙门当前只提示制作中
- 失败风险/反证：把倍率模式误当新地图，达到钥匙误以为可开新关。已有反证：selectMode失败提示，gateInfo明确制作中
- 建议与边界：保留暂缓标识，不扩开发/安装
- 独立界面：HUB-DEPLOY；动作：selMode、gateInfo
- 来源：`game/src/hub/game.hub.depart.js:14`；`game/src/hub/game.hub.js:228`；`game/src/hub/game.hub.js:239`

### F11 · 基地基础商品购买

- 玩家意图与前提：玩家用储备币补充；钱、商品卡、仓库容量有效
- 实现结果：材料入资源或牌入仓库，成功才扣币
- 失败风险/反证：购买失败半扣/容量误估；储备币和随身币混淆。已有反证：B.purchase命令失败poor/full并提示
- 建议与边界：一个满库/缺钱命令对账比增加商品更值
- 独立界面：HUB-SHOP；动作：shopBuy
- 来源：`game/src/hub/game.hub.pages.js:40`；`game/src/hub/game.hub.js:186`

### F12 · 材料卡折入资源

- 玩家意图与前提：玩家拿材料建设；末张/全用确认
- 实现结果：移除材料卡换真实木材口粮钥匙
- 失败风险/反证：同名/堆数量变化导致旧索引；确认后误认为还能带入。已有反证：最后一张与全用明确不可逆
- 建议与边界：用版本命令与准确数量提示核对
- 独立界面：STASH-MATERIAL、MATERIAL-CONFIRM；动作：matConfirmCancel、matConfirmOk、matUseOne、matUseAll
- 来源：`game/src/hub/game.hub.pages.js:237`；`game/src/hub/game.hub.pages.js:256`；`game/src/hub/game.hub.pages.js:261`；`game/src/hub/game.hub.pages.js:262`；`game/src/hub/game.hub.pages.js:264`；`game/src/hub/game.hub.pages.js:268`

### F13 · 仓库出售换储备币

- 玩家意图与前提：玩家腾仓/积币；特殊收藏锁、物品存在
- 实现结果：卖单/整堆移卡加基地币
- 失败风险/反证：误售最后一张、特殊珍藏失去、重复点击。已有反证：确认框默认保留，special/marked限制已有
- 建议与边界：最后一张/全售独立核，不把局内卖出混同
- 独立界面：STASH-ITEM、STASH-CONFIRM；动作：stashConfirmCancel、stashConfirmOk、sellOne、sellAll
- 来源：`game/src/hub/game.hub.pages.js:293`；`game/src/hub/game.hub.pages.js:277`；`game/src/hub/game.hub.pages.js:284`；`game/src/hub/game.hub.pages.js:285`；`game/src/hub/game.hub.pages.js:384`；`game/src/hub/game.hub.pages.js:392`

### F14 · 职业卡收藏与熟练度

- 玩家意图与前提：玩家以牌换人物XP或锁珍藏；收藏池资格
- 实现结果：职业卡+10/能力+50、牌消耗；重复给XP首次推进图鉴；特殊卡可标记
- 失败风险/反证：把收藏理解为无损标记；重复XP与首次进度口径混。已有反证：收藏室说明明确用掉、重复XP
- 建议与边界：区分职业消耗与特殊锁收藏，保持两种语义可见
- 独立界面：STASH-ITEM、HUB-COLLECTION；动作：collCollectOne、collCollectAll、collToggle
- 来源：`game/src/hub/game.hub.pages.js:517`；`game/src/hub/game.hub.pages.js:293`；`game/src/hub/game.hub.pages.js:350`；`game/src/hub/game.hub.pages.js:358`；`game/src/hub/game.hub.pages.js:362`

### F15 · 经济包开包

- 玩家意图与前提：玩家使用经济包；tt-econpack存在、仓库至少5空位且随机池非空
- 实现结果：消耗包获得5张随机可获取卡，入卡牌仓库
- 失败风险/反证：末张需确认；空间预检偏保守、旧堆变化或保存失败须拒绝。已有反证：B.openCardPack独立命令，末包确认与失败日志已有
- 建议与边界：核开包前后仓库数量与包消耗，不把收益写成储备币
- 独立界面：STASH-ITEM；动作：econpackUse
- 来源：`game/src/hub/game.hub.pages.js:293`；`game/src/hub/game.hub.pages.js:330`

### F16 · 仓库物资/物品查看与返回

- 玩家意图与前提：玩家了解用途；索引对应当前堆
- 实现结果：材料/蛋/普通/特殊分支，失效索引回仓
- 失败风险/反证：旧索引查看错堆；真实资源不可售应明示。已有反证：openStashItem分支和空堆返回已有
- 建议与边界：卡类型与操作按钮逐分支核
- 独立界面：HUB-STASH、STASH-RAW、STASH-ITEM；动作：stashItem、rawItem、stashBack、stashBack2
- 来源：`game/src/hub/game.hub.pages.js:87`；`game/src/hub/game.hub.pages.js:293`；`game/src/hub/game.hub.pages.js:403`；`game/src/hub/game.hub.js:276`；`game/src/hub/game.hub.js:277`；`game/src/hub/game.hub.pages.js:228`；`game/src/hub/game.hub.pages.js:271`；`game/src/hub/game.hub.pages.js:399`；`game/src/hub/game.hub.pages.js:415`

### F17 · 宠物孵化

- 玩家意图与前提：玩家要未拥有宠物；蛋+50储备币且未全齐
- 实现结果：随机未拥有宠物，蛋币同时消耗
- 失败风险/反证：全齐/贫穷/存档失败误扣；随机结果不是每只可达实证。已有反证：hatchPet失败save明确原蛋币不耗
- 建议与边界：核原子性及未拥有池，不新增宠物
- 独立界面：STASH-EGG；动作：hatchEgg
- 来源：`game/src/hub/game.hub.pages.js:180`；`game/src/hub/game.hub.pages.js:216`

### F18 · 宠物携带与升级

- 玩家意图与前提：玩家选择安全格与宠物效益；拥有、口粮、未满级
- 实现结果：一只携带、逐宠等级、2-3-4-5成本，安全格改变
- 失败风险/反证：切宠使安全格不足、整备与仓库选择不一致。已有反证：独立等级/MAX禁用和能力说明已有
- 建议与边界：核切换后安全卡保留规则，六宠效果不虚称逐验
- 独立界面：HUB-PETS、HUB-UPGRADE、PREP；动作：depPet、upPet、selPet
- 来源：`game/src/hub/game.hub.pages.js:419`；`game/src/hub/game.hub.pages.js:157`；`game/src/hub/game.hub.depart.js:126`；`game/src/hub/game.hub.depart.js:244`；`game/src/hub/game.hub.js:255`；`game/src/hub/game.hub.js:263`

### F19 · 背包/仓库扩建

- 玩家意图与前提：玩家扩大容量；木材足且未MAX
- 实现结果：消耗木材扩建，Meta解锁
- 失败风险/反证：上限/扣材保存失败、展示cap口径不同。已有反证：canUpgrade和MAX按钮禁用
- 建议与边界：核边界命令，不用截图证明资源原子性
- 独立界面：HUB-UPGRADE；动作：upBag、upStash
- 来源：`game/src/hub/game.hub.pages.js:419`；`game/src/hub/game.hub.js:248`；`game/src/hub/game.hub.js:270`

### F20 · 基地口袋用钥匙复原

- 玩家意图与前提：玩家救回消耗牌；键数按稀有与整堆、仓库空间
- 实现结果：普通卡回仓库；初攻不入库直接消耗；下次出发前处理
- 失败风险/反证：误认1/3为整堆概率、钥匙材料未转储备、下局清口袋。已有反证：错误nokey/full/sha有专门提示
- 建议与边界：将概率/钥匙成本/下局清空并列验
- 独立界面：HUB-STASH；动作：restoreCard
- 来源：`game/src/hub/game.hub.pages.js:87`；`game/src/hub/game.hub.js:278`

### F21 · 成就奖励领取

- 玩家意图与前提：玩家兑现已解锁未领成就
- 实现结果：物资/卡/卡背奖励一次性
- 失败风险/反证：卡满库、重复领、标题总览误以为已领。已有反证：M.claim门控；标题只读与基地领奖分离
- 建议与边界：每奖励类型定向测；不宣称26条全部触发
- 独立界面：HUB-ACHIEVEMENTS、TITLE-ACH；动作：claimAch
- 来源：`game/src/ui/game.menu.js:433`；`game/src/hub/game.hub.pages.js:569`；`game/src/hub/game.hub.js:287`

### F22 · 卡背解锁选用

- 玩家意图与前提：玩家换牌背；对应成就已领解锁
- 实现结果：选中立即用于牌堆/背包，每档独立
- 失败风险/反证：未解锁或同选，误以为单纯达成即可用。已有反证：isBackUnlocked及同选直接返回
- 建议与边界：核解锁-领取-选用的关联
- 独立界面：HUB-BACKS；动作：selBack
- 来源：`game/src/hub/game.hub.pages.js:593`；`game/src/hub/game.hub.js:291`

### F23 · 收藏里程碑与查看

- 玩家意图与前提：玩家领首次不同收藏阶段奖励/查看已有牌
- 实现结果：一次奖励或只读详情；满仓拒奖保留
- 失败风险/反证：全收集分母池变化、重复XP误推进。已有反证：collectPool仅职业/能力，claimColl满库反馈
- 建议与边界：以池过滤作分母，避免原始卡库数代替
- 独立界面：HUB-COLLECTION；动作：claimColl、collZoom
- 来源：`game/src/hub/game.hub.pages.js:517`；`game/src/hub/game.hub.js:305`；`game/src/hub/game.hub.js:310`

### F24 · 人物熟练度与皮肤

- 玩家意图与前提：玩家查成长/换已开放皮肤；readBase/revision有效
- 实现结果：皮肤落库/素材缺失默认立绘；熟练度下局加成
- 失败风险/反证：选人临时皮肤与基地持久化皮肤混淆。已有反证：selectSkin命令及assetFallback明确
- 建议与边界：分别核会话预览与持久选择
- 独立界面：HUB-CLASSES、CLASS-CHOICE；动作：selectCharacterSkin
- 来源：`game/src/hub/game.hub.pages.js:473`；`game/src/run/game.run.altar.js:78`；`game/src/hub/game.hub.js:220`

### F25 · 下一局目标追踪

- 玩家意图与前提：玩家追收藏目标；上限3/卡ID有效
- 实现结果：保存追踪、显示已知条件或来源未确认
- 失败风险/反证：来源不明误成保证获取；重复/满3。已有反证：getSources certainty判定、按钮上限
- 建议与边界：保持未知来源明示，不编掉率
- 独立界面：PREP-GOALS；动作：直接DOM/命令/自动规则，无独立UI.act
- 来源：`game/src/hub/preparation.view.js:24`

### F26 · 两套出征预设

- 玩家意图与前提：玩家复用准备；仓库、角色宠物与容量当前有效
- 实现结果：愿望清单保存，预览ready/missing/forbidden；应用到整备，人物仍出发后选
- 失败风险/反证：误以为保存即扣牌/直接出征；旧revision申请。已有反证：previewDeployment不扣资源、缺牌禁应用
- 建议与边界：逐意图对账版本命令，不把两套预设当两次实战
- 独立界面：PREP-GOALS；动作：preparationBack、openPreparation
- 来源：`game/src/hub/preparation.view.js:24`；`game/src/hub/game.hub.js:49`；`game/src/hub/game.hub.js:219`

### F27 · 整备带入卡与确认出发

- 玩家意图与前提：玩家选择有用卡带入；仓库存在/禁带/容量/忙碌
- 实现结果：增减勾选、详情/移出，出发成功扣仓清上局口袋
- 失败风险/反证：小卡读不清；点击确认失败仍误扣；初始攻击固定不可带回。已有反证：详情可访问，preparation/departure命令守卫
- 建议与边界：相关风险优先已有长牌详情与命令证据
- 独立界面：PREP、CARD-ZOOM；动作：pickAdd、bagZoom、bagZoomRemove、confirmDeploy、depBack、deploy
- 来源：`game/src/hub/game.hub.depart.js:126`；`game/src/ui/ui.js:108`；`game/src/hub/game.hub.depart.js:242`；`game/src/hub/game.hub.depart.js:252`；`game/src/hub/game.hub.depart.js:264`；`game/src/hub/game.hub.depart.js:332`；`game/src/hub/game.hub.depart.js:363`；`game/src/hub/game.hub.js:238`

### F28 · 出征人物/皮肤/卡池/补给

- 玩家意图与前提：玩家选本局人物并了解牌池；可退整备
- 实现结果：职业选择加熟练度，补给进入图；皮肤只是选页会话记忆
- 失败风险/反证：卡池预览不等于实际获取率；补给与容量。已有反证：牌池分页/详情与返回来源已有
- 建议与边界：五人物不虚称全胜率，核出发流程真实闭环
- 独立界面：CLASS-CHOICE、CLASS-POOL、CLASS-GRANT；动作：poolZoom、poolPrev、poolNext、selClass、clsPool、clsBack、clsSkin、cls2Quit、pickClass、clsGrantGo
- 来源：`game/src/run/game.run.altar.js:78`；`game/src/run/game.run.altar.js:220`；`game/src/run/game.run.altar.js:400`；`game/src/run/game.run.altar.js:297`；`game/src/run/game.run.altar.js:302`；`game/src/run/game.run.altar.js:303`；`game/src/run/game.run.altar.js:307`；`game/src/run/game.run.altar.js:313`；`game/src/run/game.run.altar.js:319`；`game/src/run/game.run.altar.js:324`；`game/src/run/game.run.altar.js:339`；`game/src/run/game.run.altar.js:345`；`game/src/run/game.run.altar.js:402`

### F29 · 照相馆检索/筛选/排序/翻页

- 玩家意图与前提：玩家找到某牌；按当前过滤集
- 实现结果：只重绘网格、保留输入焦点/选择，空结果告知
- 失败风险/反证：中文IME被整页重建打断、分页选择漂移。已有反证：renderLibGrid与窗口化已解决部分性能
- 建议与边界：核一个中文长牌搜索与详情，保留有效结构
- 独立界面：STUDIO；动作：libTab、libClearFilter、libRemoveFilter、libPrev、libNext
- 来源：`game/src/hub/game.cardslib.page.js:463`；`game/src/hub/game.cardslib.page.js:540`；`game/src/hub/game.cardslib.page.js:541`；`game/src/hub/game.cardslib.page.js:542`；`game/src/hub/game.cardslib.page.js:560`；`game/src/hub/game.cardslib.page.js:561`

### F30 · 照片详情/馆方记录

- 玩家意图与前提：玩家读规则与写自有记录；有效cardID
- 实现结果：照片大图/背签/完整规则、备注限240、关闭回焦点/导出记录
- 失败风险/反证：便签保存失败虚报已存、图片加载fallback、旧回调。已有反证：通用showCardZoom返回焦点/背景inert已有
- 建议与边界：实页图与输入回读分开核
- 独立界面：PHOTO-ZOOM、STUDIO、CARD-ZOOM；动作：closeCardPage、libInspect、exportNotes
- 来源：`game/src/hub/game.cardslib.page.js:463`；`game/src/ui/ui.js:108`；`game/src/ui/ui.js:135`；`game/src/hub/game.cardslib.page.js:536`；`game/src/hub/game.cardslib.page.js:567`；`game/src/hub/game.cardslib.page.js:627`

### F31 · 卡制作/编辑/删除

- 玩家意图与前提：开发者写开关实际为false；源码UI存在不代表当前可写
- 实现结果：当前导出工具可开，写入口被拒；若启用才制作自定义卡
- 失败风险/反证：将冻写入口误报正常功能；文本机制不等于效果已实现。已有反证：CARD_DESIGNER_WRITES_ENABLED守卫
- 建议与边界：按guarded列存在，不解冻、不实施
- 独立界面：CARD-DESIGNER、STUDIO；动作：mech、closeDesigner、pickType、pickDmgType、pickCost、pickDraw、pickInfuse、pickRar、dmgAdj、valAdj、saveCard、newCard、libEditMode、editCard、delCard
- 来源：`game/src/hub/game.cardslib.page.js:463`；`game/src/hub/game.cardslib.designer.js:102`；`game/src/hub/game.cardslib.designer.js:206`；`game/src/hub/game.cardslib.designer.js:214`；`game/src/hub/game.cardslib.designer.js:215`；`game/src/hub/game.cardslib.designer.js:221`；`game/src/hub/game.cardslib.designer.js:222`；`game/src/hub/game.cardslib.designer.js:223`；`game/src/hub/game.cardslib.designer.js:224`；`game/src/hub/game.cardslib.designer.js:225`；`game/src/hub/game.cardslib.designer.js:226`；`game/src/hub/game.cardslib.designer.js:227`；`game/src/hub/game.cardslib.designer.js:228`；`game/src/hub/game.cardslib.page.js:537`；`game/src/hub/game.cardslib.page.js:549`；`game/src/hub/game.cardslib.page.js:562`；`game/src/hub/game.cardslib.page.js:607`

### F32 · 卡库导入导出

- 玩家意图与前提：玩家/开发者复制文件；导入写开关false、JSON合法
- 实现结果：导出当前库；导入当前受控
- 失败风险/反证：复制权限、非法结构、误认为导入有战斗语义保证。已有反证：导入parse/失败提示与总开关
- 建议与边界：只评文件接口，不写cards-sync.json
- 独立界面：CARDS-EXPORT、CARDS-IMPORT；动作：copyCards、downloadCards、backLib、doImportCards、backLib2、exportCards、importCards
- 来源：`game/src/hub/game.cardslib.designer.js:304`；`game/src/hub/game.cardslib.designer.js:330`；`game/src/hub/game.cardslib.designer.js:315`；`game/src/hub/game.cardslib.designer.js:319`；`game/src/hub/game.cardslib.designer.js:327`；`game/src/hub/game.cardslib.designer.js:340`；`game/src/hub/game.cardslib.designer.js:369`；`game/src/hub/game.cardslib.page.js:623`；`game/src/hub/game.cardslib.page.js:624`

### F33 · 探索合法移动/重复节点/HUD

- 玩家意图与前提：玩家选邻接路线；idle、Run活跃、相邻；过场身份正确
- 实现结果：turn增加、揭图，已结算节点不重刷，目标/闸门方向更新
- 失败风险/反证：安全往返turn仍计撤离XP（GP-01已证）；直线距离不是路径代价。已有反证：visited防重复奖励，地图能合法回退
- 建议与边界：先定奖励规则，保留回头路；不从早期2路线断言无分岔
- 独立界面：MAP、RUN-TRANSITION；动作：flowContinue
- 来源：`game/src/run/expedition.view.js:72`；`game/src/run/game.run.scenes.js:113`；`game/src/run/game.run.scenes.js:143`

### F34 · 拾取与空安全节点

- 玩家意图与前提：玩家收资源/确认无事；单次当前节点
- 实现结果：币入账或资源卡入包，finishInstant回图
- 失败风险/反证：找不到卡/满包时是否仍消费节点；这与物资二选一不同。已有反证：grantEventCard会拒满；空白明确提示已有
- 建议与边界：核发放返回值与consume顺序，别混用图
- 独立界面：PICKUP、NODE-SAFE；动作：pickupGo、blankSafeDone
- 来源：`game/src/run/game.run.scenes.js:233`；`game/src/run/game.run.scenes.js:177`；`game/src/run/game.run.scenes.js:201`；`game/src/run/game.run.scenes.js:244`

### F35 · 资源卡二选一

- 玩家意图与前提：玩家择一资源；随机池非空、包能接收
- 实现结果：成功发牌才consume；跳过done(false)保留节点
- 失败风险/反证：动态按钮忽略扫描、同名容量误估。已有反证：代码先grant成功再done(true)
- 建议与边界：动态resPick{0,1}按池数量对账
- 独立界面：RESOURCE-PICK；动作：'resPick' + i、resSkip
- 来源：`game/src/run/game.run.flow.js:176`；`game/src/run/game.run.flow.js:201`；`game/src/run/game.run.flow.js:207`

### F36 · 宝箱搜寻/揭晓

- 玩家意图与前提：玩家开启当前箱；queue有效
- 实现结果：揭晓库存与货币，按idx推进
- 失败风险/反证：揭晓并不表示已收卡；随机/蛋保底跨箱误读。已有反证：renderSearch与render领取分离
- 建议与边界：分别审查未开/已开，复用多箱证据
- 独立界面：CHEST-SEARCH；动作：chestReveal
- 来源：`game/src/run/chests.js:240`；`game/src/run/chests.js:261`

### F37 · 宝箱逐收/全收/三选一/跳过

- 玩家意图与前提：玩家最大化收益或腾格；满包卡型容量、taken状态
- 实现结果：单收保留、全收放不下散落、选一失败留页、跳过币照收
- 失败风险/反证：全收丢牌、金币重复、满包3选1吞卡；当前遮标题E03已证。已有反证：taken与grant拒收留页，容量预检和散落提示已有
- 建议与边界：优先修安全区；收益行为据真实回包对账
- 独立界面：CHEST-PICK、CHEST-ALL、BATTLE-REWARD；动作：chestTake、chestTake1、chestSkip、chestPick
- 来源：`game/src/run/chests.js:277`；`game/src/run/chests.js:404`；`game/src/run/chests.js:230`；`game/src/run/chests.js:359`；`game/src/run/chests.js:360`；`game/src/run/chests.js:369`；`game/src/run/chests.js:374`

### F38 · 普通/职业/首脑战后奖励与消耗教学

- 玩家意图与前提：玩家理解牌为何消失；战后命令成功才发奖励
- 实现结果：普通卡usedPocket、职业卡消散，首次教学、奖励与XP/胜利进度
- 失败风险/反证：重复保存奖励、教学写失败、首脑第五层文案（GP-02已证）。已有反证：幂等command、当前普通战闭环与辅助首脑证据
- 建议与边界：修层数口径，普通战证据不能替代全规则
- 独立界面：BATTLE-REWARD、AMMO-TUTORIAL、BATTLE-SETTLE-RETRY；动作：battleSettleRetry、ammoTeachOk
- 来源：`game/src/run/chests.js:230`；`game/src/hub/game.bag.settle.js:127`；`game/src/hub/game.bag.settle.js:64`；`game/src/hub/game.bag.settle.js:70`；`game/src/hub/game.bag.settle.js:165`；`game/src/hub/game.bag.settle.js:253`

### F39 · 跨层闸门/门店

- 玩家意图与前提：玩家推进层级或补给；door配对存在
- 实现结果：切层目标位置、独立door库存
- 失败风险/反证：旧档配对、连续切门、门店重开库存。已有反证：既有pair与stockKey
- 建议与边界：单条跨层证据复用，别大采种子
- 独立界面：DOOR；动作：goDoor、doorShop
- 来源：`game/src/run/game.run.altar.js:414`；`game/src/run/game.run.altar.js:427`；`game/src/run/game.run.altar.js:434`

### F40 · 探索商店购牌/初攻/谜货

- 玩家意图与前提：玩家用随身币备战；库存未售、钱足、容量
- 实现结果：扣币授卡/初攻，谜货揭晓；打开背包腾格
- 失败风险/反证：买卖动画未完成重复点、满包扣钱、stockKey持久化。已有反证：denySlotFeedback与真实grant容量判定
- 建议与边界：核买前后钱牌和存档，不先扩货池
- 独立界面：RUN-SHOP；动作：shopOpenBag、buyCard、buySha
- 来源：`game/src/run/game.run.shop.js:237`；`game/src/run/game.run.shop.js:352`；`game/src/run/game.run.shop.js:358`；`game/src/run/game.run.shop.js:384`

### F41 · 探索商店卖牌与返回

- 玩家意图与前提：玩家兑现多余牌；符合出售筛选
- 实现结果：移除卡增随身币、回购买/来源
- 失败风险/反证：安全格/容器/装备售出后状态残留，离店写visited不等于不能浏览。已有反证：单点事务与来源onClose已有
- 建议与边界：与基地卖币分开，不把储备/随身混算
- 独立界面：RUN-SELL、RUN-SHOP；动作：sellCard、openSell、backShop、closeShop
- 来源：`game/src/run/game.run.shop.js:237`；`game/src/run/game.run.shop.js:274`；`game/src/run/game.run.shop.js:412`；`game/src/run/game.run.shop.js:430`；`game/src/run/game.run.shop.js:431`；`game/src/run/game.run.shop.js:432`

### F42 · 火堆回血与口袋复原

- 玩家意图与前提：玩家救牌回血；FIRE_RESTORABLE过滤、背包容量
- 实现结果：火堆回血上限、2张；祭坛3/道具2、修鞋铺来源回调
- 失败风险/反证：看似卡在口袋但不可复原；满包/无牌次数。已有反证：候选过滤与finish回调明确
- 建议与边界：逐来源成本/次数对账，复用无牌空态
- 独立界面：FIRE、POCKET-RESTORE；动作：restoreOne、fireDone
- 来源：`game/src/run/game.run.altar.js:45`；`game/src/run/game.run.scenes.js:303`；`game/src/run/game.run.scenes.js:332`；`game/src/run/game.run.scenes.js:346`

### F43 · 事件正文选择与历史

- 玩家意图与前提：玩家权衡叙事效果；事件卡池或旧表、modal锁
- 实现结果：所选效果/日志历史，closeEventFlow回图
- 失败风险/反证：卡库没事件走旧表；只读文案与真效果漂移。已有反证：modal保留直到完成，generated narrative存在
- 建议与边界：规则族分析不等于每事件/全部剧情已可达
- 独立界面：EVENT；动作：evtChoice、evtNext
- 来源：`game/src/run/game.run.flow.js:423`；`game/src/run/game.run.flow.js:464`；`game/src/run/game.run.flow.js:475`

### F44 · 事件卡奖励与付费军需

- 玩家意图与前提：玩家选药水/装备；候选非空、军需3币
- 实现结果：选中卡发包后收尾
- 失败风险/反证：军需先spendEventCoins后开选页，满包会已付费但留选择；不是已证永久丢失。已有反证：grant失败留页可腾格
- 建议与边界：廉价隔离核付费-授牌-取消，不直接判经济漏洞
- 独立界面：EVENT-CHOICE；动作：eventCardPick
- 来源：`game/src/run/game.run.flow.js:524`；`game/src/run/game.run.flow.js:546`

### F45 · 故障重编/赌局

- 玩家意图与前提：玩家冒险换牌/收益；变牌同型同稀有、赌币足
- 实现结果：确认选满后变牌；赌局随机结果，settled防重复
- 失败风险/反证：改变装备引用/旧UID、赌局预扣/连点。已有反证：重编safe/stored排除、无候选退出
- 建议与边界：定向身份/实际收益核，未做概率可靠性测试
- 独立界面：EVENT-RECODE、EVENT-GAMBLE；动作：eventRecodePick、eventRecodeLeave、eventRecodeGo、eventGambleLeave、eventGambleTry
- 来源：`game/src/run/game.run.flow.js:565`；`game/src/run/game.run.flow.js:633`；`game/src/run/game.run.flow.js:587`；`game/src/run/game.run.flow.js:594`；`game/src/run/game.run.flow.js:595`；`game/src/run/game.run.flow.js:647`；`game/src/run/game.run.flow.js:648`

### F46 · 最后一盏灯故事提交/恢复

- 玩家意图与前提：玩家做长期叙事选择；slot/run/revision绑定当前
- 实现结果：story命令保存已选结果，错误可重试
- 失败风险/反证：异步换档回写他局、提交成功重试重复效果。已有反证：currentLastLampPage身份守卫
- 建议与边界：静态有守卫不等于全剧情已通读，保留边界
- 独立界面：LAST-LAMP、LAST-LAMP-RESULT；动作：lastLampFinish、lastLampRetry、lastLampChoice、lastLampChoiceRetry
- 来源：`game/src/run/game.run.flow.js:339`；`game/src/run/game.run.flow.js:309`；`game/src/run/game.run.flow.js:320`；`game/src/run/game.run.flow.js:350`；`game/src/run/game.run.flow.js:379`；`game/src/run/game.run.flow.js:415`

### F47 · 祭坛三牌激活/碎片兑换/道具复原

- 玩家意图与前提：玩家用资源换收益；3牌/2碎片/道具+可复原池
- 实现结果：激活一次、碎片先授牌后扣、道具一次锁再复原
- 失败风险/反证：全局altarActivated是否按祭坛归属；能力池空/满包拒收。已有反证：无职业池明确保留碎片、道具取消不锁
- 建议与边界：逐代价边界，先验已有一次性语义不扩祭坛种类
- 独立界面：ALTAR、ALTAR-FRAGMENT-FAIL；动作：altarItemRestore、altarOn3、altarFragHero、altarFragBack、altarLeave
- 来源：`game/src/run/game.run.altar.js:441`；`game/src/run/game.run.altar.js:506`；`game/src/run/game.run.altar.js:478`；`game/src/run/game.run.altar.js:491`；`game/src/run/game.run.altar.js:500`；`game/src/run/game.run.altar.js:510`；`game/src/run/game.run.altar.js:523`

### F48 · 祭坛回赠二选一

- 玩家意图与前提：玩家已付3牌；pending待领
- 实现结果：回3牌+10HP或随机传说+装备，离开可回来
- 失败风险/反证：loot分支先清pending，再发牌可能满包；需确认散落是规则还是缺陷。已有反证：两池去重、无可复原禁第一项
- 建议与边界：先做满包廉价探针再拍设计，不将静态疑点写已证丢奖
- 独立界面：ALTAR-REWARD；动作：altarRewardRestore、altarRewardLoot、altarRewardLeave
- 来源：`game/src/run/game.run.altar.js:529`；`game/src/run/game.run.altar.js:547`；`game/src/run/game.run.altar.js:555`；`game/src/run/game.run.altar.js:569`

### F49 · 献祭选牌/取消/确认

- 玩家意图与前提：玩家明确付n牌；类型/UID/数量合法
- 实现结果：可切选择、取消回来源、确认移牌done
- 失败风险/反证：全部牌被献祭、掉线存档、stale UID；n不足不能确认。已有反证：selected.size数量和过滤约束
- 建议与边界：分别对紧急3/祭坛3/道具1验证，不只写献祭已分析
- 独立界面：SACRIFICE；动作：sacPick、sacCancel、sacConfirm
- 来源：`game/src/run/game.run.altar.js:622`；`game/src/run/game.run.altar.js:644`；`game/src/run/game.run.altar.js:652`；`game/src/run/game.run.altar.js:653`

### F50 · 首脑挑战与战前编组

- 玩家意图与前提：玩家选择决战；首脑未死、包中合法牌/装备、数量达标
- 实现结果：编组开bossBattle、取消回首脑门
- 失败风险/反证：取消错误consume节点、装备技能/选牌实际不一致。已有反证：bossKilled拦重战，编组前不锁节点
- 建议与边界：辅助实战标清输入；正常四层路径与分支分开
- 独立界面：BOSS-GATE、BOSS-DECK；动作：bossSel、bossGo、bossCancel、bossBounce、fightBoss、bossLeave
- 来源：`game/src/run/game.run.altar.js:574`；`game/src/battle/view/battle.overlays.js:19`；`game/src/battle/view/battle.overlays.js:52`；`game/src/battle/view/battle.overlays.js:53`；`game/src/battle/view/battle.overlays.js:54`；`game/src/run/game.run.altar.js:582`；`game/src/run/game.run.altar.js:610`；`game/src/run/game.run.altar.js:616`

### F51 · 紧急/终局撤离成本与放行

- 玩家意图与前提：玩家保本/通关带回；紧急第三层且3牌，终局首脑死
- 实现结果：紧急先献祭、终局无条件，随身币离局清零
- 失败风险/反证：注册payExit存在不表示锁页按钮可达；旧档出口层错误。已有反证：停用提示/卡不足禁用/首脑门控
- 建议与边界：保留静态与实际点击边界；不改存档造出口
- 独立界面：EXIT-PAY、EXIT-FINAL；动作：stayHere、payExit
- 来源：`game/src/run/game.run.altar.js:670`；`game/src/run/game.run.altar.js:418`；`game/src/run/game.run.altar.js:686`；`game/src/run/game.run.altar.js:701`；`game/src/run/game.run.altar.js:713`；`game/src/run/game.run.altar.js:734`；`game/src/run/game.run.altar.js:740`

### F52 · 撤离整理/全收/智能/完成/重试

- 玩家意图与前提：玩家带回最有价值牌；pending revision与仓容量有效
- 实现结果：逐堆/全部/价值智能部分入库，确认剩余散失
- 失败风险/反证：满库丢牌、保存失败误清、并发旧页；1/3逐张只在begin抽一次。已有反证：pendingExtraction命令有恢复/幂等
- 建议与边界：复用真实辅助整理证据，必要失效revision探针
- 独立界面：EXTRACT-STASH；动作：exStash、exAll、exSmart、exFinish
- 来源：`game/src/run/game.run.altar.js:821`；`game/src/run/game.run.altar.js:901`；`game/src/run/game.run.altar.js:916`；`game/src/run/game.run.altar.js:926`；`game/src/run/game.run.altar.js:943`

### F53 · 撤离/死亡终局持久化与再来

- 玩家意图与前提：玩家从结算继续；Base/Run成对提交有效
- 实现结果：成功/失败统计、XP及安全格规则，回基地而非直接新局
- 失败风险/反证：死亡与撤离保留差异、失败重复XP；GP-01/02当前已证。已有反证：terminal/extraction命令保留原局与重试
- 建议与边界：终局规则与叙事分开验，不拿research ending冒主图结尾
- 独立界面：EXTRACT-RETRY、EXTRACT-DONE、DEATH、TERMINAL-RETRY；动作：extractRetry、goBase、again、retryAct
- 来源：`game/src/ui/terminal-settlement.js:5`；`game/src/run/game.run.altar.js:815`；`game/src/run/game.run.altar.js:952`；`game/src/run/game.session.death.js:11`；`game/src/run/game.run.altar.js:818`；`game/src/run/game.run.altar.js:976`；`game/src/run/game.run.altar.js:977`；`game/src/run/game.session.death.js:128`；`game/src/run/game.session.death.js:129`；`game/src/ui/game.menu.js:883`；`game/src/ui/terminal-settlement.js:34`

### F54 · 探索背包详情/使用/排序/丢弃

- 玩家意图与前提：玩家管理带出牌；现有卡、非战斗、用途适用
- 实现结果：同名堆详情、治疗满血保留、排序与确认丢弃，来源hook返回
- 失败风险/反证：拖动删整堆、道具错用、背包回地图顶掉商店箱页。已有反证：用途过滤、丢弃确认、returnHook已有
- 建议与边界：核真实来源返回和治疗边界，源码旧showBagCardDetail不可冒现行入口
- 独立界面：BAG、BAG-DISCARD、CARD-ZOOM；动作：confirmDragDiscard、cancelDragDiscard、useDetailCard、detailDiscard、inspectStack、bagSortRarity、bagSortType、closeBag
- 来源：`game/src/ui/ui.js:108`；`game/src/hub/game.bag.js:520`；`game/src/hub/game.bag.js:275`；`game/src/hub/game.bag.js:287`；`game/src/hub/game.bag.js:288`；`game/src/hub/game.bag.js:317`；`game/src/hub/game.bag.js:345`；`game/src/hub/game.bag.js:680`；`game/src/hub/game.bag.js:716`；`game/src/hub/game.bag.js:721`；`game/src/hub/game.bag.js:722`；`game/src/hub/game.bag.js:723`

### F55 · 安全格/容器/通行证合成

- 玩家意图与前提：玩家保全/扩格/合成；普通与安全容量、资源/法术筛选
- 实现结果：转safe、珍珠资源/锦囊法术存取、旧详情合成定义
- 失败风险/反证：stored不能普通容量算、取出满包、旧合成入口现行未接。已有反证：容量/type与UID守卫，旧函数源码注释明示历史保留
- 建议与边界：旧合成列source-only，不用存放按钮存在证明可用全部扩展
- 独立界面：BAG、BAG-PEARL、BAG-POUCH；动作：craftColorToken、craftColorTokenByFragments、detailFromSafe、detailToSafe、pearlStore、pouchStore、pouchPut、pouchTake、pouchBack、pearlPut、pearlTake、pearlBack、zoomMoveToBag、zoomMoveToSafe、pearlStoreZoom、pouchStoreZoom
- 来源：`game/src/hub/game.bag.js:520`；`game/src/hub/game.bag.js:419`；`game/src/hub/game.bag.js:352`；`game/src/hub/game.bag.js:318`；`game/src/hub/game.bag.js:331`；`game/src/hub/game.bag.js:343`；`game/src/hub/game.bag.js:344`；`game/src/hub/game.bag.js:346`；`game/src/hub/game.bag.js:347`；`game/src/hub/game.bag.js:389`；`game/src/hub/game.bag.js:404`；`game/src/hub/game.bag.js:412`；`game/src/hub/game.bag.js:457`；`game/src/hub/game.bag.js:471`；`game/src/hub/game.bag.js:490`；`game/src/hub/game.bag.js:702`；`game/src/hub/game.bag.js:707`；`game/src/hub/game.bag.js:714`；`game/src/hub/game.bag.js:715`

### F56 · 手牌点击/拖拽/键盘出牌与目标

- 玩家意图与前提：玩家发动牌；玩家阶段/非busy/费用够/合法UID与目标
- 实现结果：费用与卡消耗，单敌自动目标、多敌点选，Enter/Esc与拖放
- 失败风险/反证：不支持预览误算、卡叠UID、选择取消却已扣费、手牌遮挡。已有反证：preview未知降级/targetSide过滤、普通战点击闭环已证
- 建议与边界：其它输入未实际操作别外推；卡组合不穷举
- 独立界面：BATTLE、BATTLE-TARGET；动作：btHandPage、btPlay、btPickCancel
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.layers.js:562`；`game/src/battle/view/battle.view.js:422`；`game/src/battle/view/battle.view.js:424`；`game/src/battle/view/battle.view.js:508`

### F57 · 注能燃料/直打/取消

- 玩家意图与前提：玩家强化牌或不注能；主牌/燃料UID、n张手牌、费用
- 实现结果：燃料选满确认，主牌不作燃料，同名叠轮转；取消不耗
- 失败风险/反证：燃料重复/同叠选择不了、结算阶段突变。已有反证：N1同叠轮转与取消Esc已有测试/实现
- 建议与边界：核强制燃料和直打两条，不能单一出牌代表注能
- 独立界面：BATTLE-INFUSE；动作：btInfuseStart、btInfuseDirect、btInfuseGo、btInfuseCancel
- 来源：`game/src/battle/view/battle.view.js:504`；`game/src/battle/view/battle.view.js:505`；`game/src/battle/view/battle.view.js:506`；`game/src/battle/view/battle.view.js:507`

### F58 · 回合结束/敌方意图/状态结算

- 玩家意图与前提：玩家决定承伤；玩家phase非busy
- 实现结果：弃/抽/能量、敌行动/多段/元素状态与死亡
- 失败风险/反证：意图显示与实际傷害差、冻结/流血顺序、忙碌连点。已有反证：calculateEnemyIntent共用实算与预览
- 建议与边界：对账一次多段/冻结边界；不宣称全卡搭配
- 独立界面：BATTLE、BOSS-BATTLE；动作：btEnd
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.view.js:233`；`game/src/battle/view/battle.view.js:433`

### F59 · 发现/抉择/强制手牌支付

- 玩家意图与前提：玩家完成牌效分支；候选池/剩余数量/mandatory
- 实现结果：发现一张临时牌战后散；抉择仅一项；强制付满或可选跳过
- 失败风险/反证：空候选死锁、支付主牌重复、效果续接丢失。已有反证：hand payment排除已选/主牌/燃料，发现flow处理空池
- 建议与边界：分三种流程取证，不能发现图替强制支付
- 独立界面：BATTLE-DISCOVER、BATTLE-CHOICE、BATTLE-PAYMENT；动作：btChoicePick、btPickHand、btPickHandSkip、btDiscover
- 来源：`game/src/battle/view/battle.view.js:227`；`game/src/battle/view/battle.view.js:240`；`game/src/battle/view/battle.view.js:274`；`game/src/battle/view/battle.view.js:236`；`game/src/battle/view/battle.view.js:269`；`game/src/battle/view/battle.view.js:270`；`game/src/battle/view/battle.view.js:282`

### F60 · 装备技能/重击/道具

- 玩家意图与前提：玩家用战中资源；装备技能条件/道具类型与目标合法
- 实现结果：技能或特殊攻击、治疗/伤害道具入指定流程
- 失败风险/反证：限次不锁、自己道具高亮敌人、两段镖断连。已有反证：targetSide过滤、slam/dart独立pending
- 建议与边界：规则族列存在；复杂技能与全部道具未逐验
- 独立界面：BATTLE、BATTLE-BAG、BATTLE-TARGET；动作：btUseItem、btSlam、btEquipSkill、btPotion
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.overlays.js:118`；`game/src/battle/view/battle.layers.js:562`；`game/src/battle/view/battle.overlays.js:165`；`game/src/battle/view/battle.view.js:500`；`game/src/battle/view/battle.view.js:509`；`game/src/battle/view/battle.view.js:511`

### F61 · 战斗背包/安全格/墓地/牌库/设置返回

- 玩家意图与前提：玩家查实际牌/保全物品/调速度；当前场次
- 实现结果：读状态/安全移动、回战斗重新attach帧层
- 失败风险/反证：普通hideOverlay丢战场、旧sprite浮弹层、空堆误当无卡。已有反证：renderBattleBag与view恢复入口/隐藏帧已有
- 建议与边界：每重要弹层独立视觉批注，不重复普通战入口
- 独立界面：BATTLE-BAG、BATTLE-GRAVE、BATTLE-DECK、BATTLE-SETTINGS；动作：btGraveBack、btDeckBack、btSafeMove、btBagBack、btSettings、btSettingsBack、btGrave、btDeck、btBag
- 来源：`game/src/battle/view/battle.overlays.js:58`；`game/src/battle/view/battle.overlays.js:89`；`game/src/battle/view/battle.overlays.js:118`；`game/src/battle/view/battle.view.js:414`；`game/src/battle/view/battle.overlays.js:81`；`game/src/battle/view/battle.overlays.js:112`；`game/src/battle/view/battle.overlays.js:166`；`game/src/battle/view/battle.overlays.js:178`；`game/src/battle/view/battle.view.js:436`；`game/src/battle/view/battle.view.js:454`；`game/src/battle/view/battle.view.js:489`；`game/src/battle/view/battle.view.js:490`；`game/src/battle/view/battle.view.js:491`；`game/src/battle/view/battle.view.js:492`

### F62 · 战斗撤离判负

- 玩家意图与前提：普通战玩家主动退出；首脑战明确不可撤离；2.6秒内二次确认
- 实现结果：普通战surrender判负；烟雾弹另走flee豁免
- 失败风险/反证：“撤离”词误当地图成功带回或烟雾弹效果。已有反证：按钮明确判负、boss日志deny、烟雾弹注释区分
- 建议与边界：保留三种成本语义，核终局失败接口
- 独立界面：BATTLE、DEATH；动作：btFlee
- 来源：`game/src/run/game.session.death.js:11`；`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.view.js:458`

### F63 · 开发调试/Agent/快捷导航

- 玩家意图与前提：开发者明知辅助写存档；运行/战斗守卫、LLM设置合法
- 实现结果：调资源/发牌/战斗、策略启动停止turbo/观察、受can跳转
- 失败风险/反证：辅助结果冒真人、LLM失败/停止未收口、配置敏感信息。已有反证：界面写即时存档提示、quick-nav busy门控
- 建议与边界：本轮只静态，父会话辅助证据必须标注；不替老板配置
- 独立界面：DEV-DEBUG、DEV-AGENT、DEV-KEYS；动作：devcRunGreedy、devcRunRandom、devcRunLlm、devcRunStop、devcTurbo、devcLlmSave、devcObsRefresh、devcGoto、devcCoin、devcHeal、devcCard、devcB、devcTab、devcClose
- 来源：`game/src/run/game.run.dev.js:84`；`game/src/agent/agent.console.js:38`；`game/src/agent/agent.console.js:96`；`game/src/agent/agent.console.js:78`；`game/src/agent/agent.console.js:79`；`game/src/agent/agent.console.js:80`；`game/src/agent/agent.console.js:81`；`game/src/agent/agent.console.js:82`；`game/src/agent/agent.console.js:83`；`game/src/agent/agent.console.js:89`；`game/src/agent/agent.console.js:110`；`game/src/run/game.run.dev.js:139`；`game/src/run/game.run.dev.js:140`；`game/src/run/game.run.dev.js:141`；`game/src/run/game.run.dev.js:142`；`game/src/run/game.run.dev.js:165`；`game/src/run/game.run.dev.js:168`

### F64 · 研究所独立规则族

- 玩家意图与前提：暂缓系统存在；独立解锁/牌/符文/资金与nest身份
- 实现结果：大门、备战、顺序地图、法阵、祭坛、商店、首脑、计分与结局
- 失败风险/反证：误把主图覆盖算研究所全验，元素盒子动态动作未实例化。已有反证：源码独立命令与结算存在
- 建议与边界：仅盘存在和边界，不扩开发/实页走线
- 独立界面：LAB-DOOR、LAB-PREP、LAB-MAP、LAB-RUNES、LAB-ALTAR、LAB-SHOP、LAB-ENDING、LAB-DONE；动作：nestDeploy、labOpen、labBack、'nestPick' + i、'nestRune' + i、nestBack、nestGo、'nestCell' + i、'nestPickRune' + i、'nestBox' + at、'rc' + i、rcBox、rcBack、naHero、naReroll、naBack、'nsC' + i、'nsK' + i、'nsR' + i、nsBack、nestExtractRetry、labScoreBack
- 来源：`game/src/run/game.nest.js:102`；`game/src/run/game.nest.js:142`；`game/src/run/game.nest.js:228`；`game/src/run/game.nest.js:391`；`game/src/run/game.nest.js:417`；`game/src/run/game.nest.js:451`；`game/src/run/lab.ending.js:31`；`game/src/run/game.nest.js:633`；`game/src/hub/game.hub.js:237`；`game/src/run/game.nest.js:119`；`game/src/run/game.nest.js:136`；`game/src/run/game.nest.js:168`；`game/src/run/game.nest.js:173`；`game/src/run/game.nest.js:180`；`game/src/run/game.nest.js:181`；`game/src/run/game.nest.js:245`；`game/src/run/game.nest.js:246`；`game/src/run/game.nest.js:254`；`game/src/run/game.nest.js:400`；`game/src/run/game.nest.js:408`；`game/src/run/game.nest.js:413`；`game/src/run/game.nest.js:427`；`game/src/run/game.nest.js:435`；`game/src/run/game.nest.js:445`；`game/src/run/game.nest.js:479`；`game/src/run/game.nest.js:480`；`game/src/run/game.nest.js:481`；`game/src/run/game.nest.js:482`；`game/src/run/game.nest.js:526`；`game/src/run/game.nest.js:643`

### F65 · 术语/帮助/HUD镜头/日志/音效试听

- 玩家意图与前提：玩家读提示或开发者试听；有效词、DOM、音频库
- 实现结果：词义浮层、镜头定位/缩放、日志折叠、播放方案/序列/循环
- 失败风险/反证：tip遮重要区，外链库失败，资源存在误等同cue已接。已有反证：unknown词不显示、试听fetch/Audio失败提示
- 建议与边界：声音接线优先；当前窗口实听未核不评价混音
- 独立界面：TERM-TIP、HUB-HELP、MAP、SFX-AUDITION；动作：直接DOM/命令/自动规则，无独立UI.act
- 来源：`game/src/hub/game.hub.js:323`；`game/src/run/expedition.view.js:72`；`game/src/ui/term-tips.js:93`；`game/src/audio/sfx-audition.js:66`

### F66 · 基地家具布置与陈列

- 玩家意图与前提：source-only：renderHomeScene未被主renderHub调用；revision有效
- 实现结果：买家具/布局/陈列命令存在，静态可看意图
- 失败风险/反证：无现行入口却写已交付；并发revision冲突。已有反证：home command与background fallback存在
- 建议与边界：列已存在未接，不主动接入口
- 独立界面：HOME-SCENE；动作：直接DOM/命令/自动规则，无独立UI.act
- 来源：`game/src/hub/game.hub.js:80`

### F67 · 结点备注编辑/清空/取消

- 玩家意图与前提：开发者想留结点设计备注；坐标存在、文本有效
- 实现结果：写备注/清该格/取消；失败保留弹层输入
- 失败风险/反证：旧坐标迁移与当前种子定位不一致、存储满。已有反证：save返回false保留输入已有
- 建议与边界：区分备注与实际事件配置，不执行清空
- 独立界面：NODE-NOTE；动作：saveNote、clearNote、closeNote
- 来源：`game/src/hub/game.notes.js:43`；`game/src/hub/game.notes.js:73`；`game/src/hub/game.notes.js:85`；`game/src/hub/game.notes.js:92`

### F68 · 结点备注导入导出/全清

- 玩家意图与前提：开发者交换设计记录；idle与JSON合法，全清明确确认
- 实现结果：v3节点导出、v2迁移合并、统计部分失败、全清取消优先
- 失败风险/反证：导入部分写成功不原子、旧字典混board；外发文案不等于已发送。已有反证：clipboard失败可手拷、部分写失败明示、确认初焦取消
- 建议与边界：只读诊断接口；不触老板数据
- 独立界面：NOTES-EXPORT、NOTES-IMPORT、NOTES-CLEAR；动作：copyNotes、downloadNotes、closeTools、doImport、doClear
- 来源：`game/src/hub/game.notes.js:113`；`game/src/hub/game.notes.js:140`；`game/src/hub/game.notes.js:184`；`game/src/hub/game.notes.js:125`；`game/src/hub/game.notes.js:129`；`game/src/hub/game.notes.js:137`；`game/src/hub/game.notes.js:150`；`game/src/hub/game.notes.js:181`；`game/src/hub/game.notes.js:193`；`game/src/hub/game.notes.js:199`

### R01 · 伤害类型/多目标/多段/击杀

- 玩家意图与前提：玩家按伤害/目标选牌；费用合法、伤害类型与目标有效
- 实现结果：攻击/法术/固定/真实、全体/随机、多段、击杀进度；实际由combat与effects解释
- 失败风险/反证：护甲/法伤/冻结/死亡时序影响预览，文本注册识别非执行正确性。已有反证：calculateEnemyIntent与damage预览共实算，unknown降级；普通战3击杀已证
- 建议与边界：优先一个类型边界及击杀奖励，复杂组合未验
- 独立界面：BATTLE、BOSS-BATTLE、BATTLE-TARGET；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：damage、aoeDamage、aoeFixedByPrice、damageRepeat、doubleDamageNext、damageReduce、multiShot、killReward、onKill、structuredDamage、hpThreshold、hpHalfThreshold、repeatTimes、extraCastTimes、atkEqualToDamage
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.view.js:233`；`game/src/battle/view/battle.layers.js:562`；`game/src/battle/effects/effect-verbs.js:37`；`game/src/battle/effects/effect-verbs.js:38`；`game/src/battle/effects/effect-verbs.js:39`；`game/src/battle/effects/effect-verbs.js:40`；`game/src/battle/effects/effect-verbs.js:78`；`game/src/battle/effects/effect-verbs.js:79`；`game/src/battle/effects/effect-verbs.js:89`；`game/src/battle/effects/effect-verbs.js:90`；`game/src/battle/effects/effect-verbs.js:114`；`game/src/battle/effects/effect-verbs.js:120`；`game/src/battle/effects/effect-verbs.js:123`；`game/src/battle/effects/effect-verbs.js:124`；`game/src/battle/effects/effect-verbs.js:126`；`game/src/battle/effects/effect-verbs.js:127`；`game/src/battle/effects/effect-verbs.js:129`

### R02 · 生命/护甲/伤害规避/潜行/斩杀

- 玩家意图与前提：玩家以回复/护甲/免疫保命；状态和目标条件有效
- 实现结果：HP上限、护甲吸收/减伤、隐身、条件斩杀与复原
- 失败风险/反证：禁疗与死亡边界、自伤触发、复活牌身份；回复牌满血是否消耗。已有反证：背包满血保牌已有实现；effects支持谓词不保证全组合
- 建议与边界：定向HP0/满血/禁疗与护甲序列，不虚称所有防御搭配
- 独立界面：BATTLE、BAG、DEATH；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：selfDamage、heal、armor、maxHpUp、stealth、execute、revive、healEqualToDamage
- 来源：`game/src/run/game.session.death.js:11`；`game/src/hub/game.bag.js:520`；`game/src/battle/view/battle.view.js:203`；`game/src/battle/effects/effect-verbs.js:41`；`game/src/battle/effects/effect-verbs.js:42`；`game/src/battle/effects/effect-verbs.js:43`；`game/src/battle/effects/effect-verbs.js:64`；`game/src/battle/effects/effect-verbs.js:69`；`game/src/battle/effects/effect-verbs.js:72`；`game/src/battle/effects/effect-verbs.js:73`；`game/src/battle/effects/effect-verbs.js:125`

### R03 · 元素/诅咒/净化/时长

- 玩家意图与前提：玩家控制/持续伤害；元素/诅咒规则与合法目标
- 实现结果：水火草光暗及流血中毒冻结沉默破甲禁疗灼烧、复制/净化、时长
- 失败风险/反证：重复叠加/立即触毒/冻结到期、同阶段顺序影响实际。已有反证：curse resolver与状态意图存在，音频动态cue缺口E01
- 建议与边界：按状态族选最便宜探针，元素视觉与听觉单独核
- 独立界面：BATTLE、BATTLE-TARGET、TERM-TIP；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：curseAdd、curseRandom、curseCopyAll、purify、poisonBurst、duration、bleedDouble、bleedTargetBonus、vsFreezeBonus、poisonLegacy、curseImmune
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.layers.js:562`；`game/src/ui/term-tips.js:93`；`game/src/battle/effects/effect-verbs.js:47`；`game/src/battle/effects/effect-verbs.js:48`；`game/src/battle/effects/effect-verbs.js:49`；`game/src/battle/effects/effect-verbs.js:50`；`game/src/battle/effects/effect-verbs.js:51`；`game/src/battle/effects/effect-verbs.js:83`；`game/src/battle/effects/effect-verbs.js:109`；`game/src/battle/effects/effect-verbs.js:110`；`game/src/battle/effects/effect-verbs.js:113`；`game/src/battle/effects/effect-verbs.js:130`；`game/src/battle/effects/effect-verbs.js:131`

### R04 · 抽牌/牌堆/弃置/墓地/保留

- 玩家意图与前提：玩家管理可用牌；普通战全可用牌与boss抽牌模式分开
- 实现结果：抽到数量/定向抽、禁抽、洗入手/牌库、弃置/消耗/保留、墓地加成
- 失败风险/反证：墓地/弃牌/usedPocket混同、空牌堆或无限补牌、临时牌战后残留。已有反证：核心注释明确普通战无需抽牌；boss牌库入口门控
- 建议与边界：两模式分别分析、堆身份优先，不拿图库数量代替可用牌
- 独立界面：BATTLE、BATTLE-DECK、BATTLE-GRAVE；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：draw、drawUntil、noDraw、deckInsert、handInsert、handSelect、discardOrConsumeHand、graveScale、keepInHand
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.overlays.js:58`；`game/src/battle/view/battle.overlays.js:89`；`game/src/battle/effects/effect-verbs.js:44`；`game/src/battle/effects/effect-verbs.js:45`；`game/src/battle/effects/effect-verbs.js:46`；`game/src/battle/effects/effect-verbs.js:59`；`game/src/battle/effects/effect-verbs.js:60`；`game/src/battle/effects/effect-verbs.js:74`；`game/src/battle/effects/effect-verbs.js:75`；`game/src/battle/effects/effect-verbs.js:103`；`game/src/battle/effects/effect-verbs.js:105`

### R05 · 能量/费用/法伤/上限与条件

- 玩家意图与前提：玩家排费用收益；当前规则、成本与条件满足
- 实现结果：改费/能量/上限/法伤/前一牌条件/注能价值/定价缩放
- 失败风险/反证：负费或条件前后切换、重放多次扣/少扣、unsupported操作先付成本。已有反证：capability预检before pay与effCostOf已有
- 建议与边界：先核成本拒绝不耗牌，卡面摘要与实算对账
- 独立界面：BATTLE、BATTLE-INFUSE；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：attackMod、costMod、energyGain、energyCapUp、spellPowerUp、fuelPriceScale、selfCostZero、prevCardBonus、infuseBonusStructured、infuseLeadBonus、spellBonusDouble、spellsInfused
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.view.js:504`；`game/src/battle/effects/effect-verbs.js:36`；`game/src/battle/effects/effect-verbs.js:61`；`game/src/battle/effects/effect-verbs.js:62`；`game/src/battle/effects/effect-verbs.js:63`；`game/src/battle/effects/effect-verbs.js:65`；`game/src/battle/effects/effect-verbs.js:104`；`game/src/battle/effects/effect-verbs.js:107`；`game/src/battle/effects/effect-verbs.js:108`；`game/src/battle/effects/effect-verbs.js:121`；`game/src/battle/effects/effect-verbs.js:122`；`game/src/battle/effects/effect-verbs.js:128`；`game/src/battle/effects/effect-verbs.js:132`

### R06 · 发现/获取/复制/自动施放

- 玩家意图与前提：玩家拿特定池牌/利用续接；候选池、dest/act合法
- 实现结果：获取手/牌库/发现、复制/免注能/零费/直接施放、选择后队列续接
- 失败风险/反证：空池/成本过滤/派生牌获取资格、免注能跳过支付、临时牌丢失。已有反证：ACQUIRE_ACTIONS与支持filter(cost/costMax/exceptIds)门控
- 建议与边界：支持表完整扫描不等于单卡组合穷尽；候选为空优先
- 独立界面：BATTLE-DISCOVER、BATTLE-PAYMENT；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：discover、discoverAndCast、discoverCopy、discoverInfuseFree、potionDiscover、getRandomCard、getSpecificCard、autoPlayHandType、costSwapDiscover、onAcquire
- 来源：`game/src/battle/view/battle.view.js:240`；`game/src/battle/view/battle.view.js:274`；`game/src/battle/effects/effect-verbs.js:52`；`game/src/battle/effects/effect-verbs.js:53`；`game/src/battle/effects/effect-verbs.js:54`；`game/src/battle/effects/effect-verbs.js:55`；`game/src/battle/effects/effect-verbs.js:56`；`game/src/battle/effects/effect-verbs.js:57`；`game/src/battle/effects/effect-verbs.js:58`；`game/src/battle/effects/effect-verbs.js:76`；`game/src/battle/effects/effect-verbs.js:88`；`game/src/battle/effects/effect-verbs.js:112`

### R07 · 召唤/随从/互攻/偷攻

- 玩家意图与前提：玩家用召唤/操控效果改变战场；召唤池/敌人状态有效；图鉴类型生物牌本身不可打出
- 实现结果：随从、额外回合、敌互攻、偷攻/降攻、战斗开始被动
- 失败风险/反证：单位死亡生命周期/队友目标/重复触发、意图残留。已有反证：execute/summon/foeFight/copyRandom有结构键与resolver
- 建议与边界：按生命周期核，区分召唤单位与不可出牌的生物图鉴
- 独立界面：BATTLE、BOSS-BATTLE；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：summonAlly、extraTurn、noDrawOrSkip、tauntOthers、stealAtk、summonStatlessLimbs
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.view.js:233`；`game/src/battle/effects/effect-verbs.js:66`；`game/src/battle/effects/effect-verbs.js:67`；`game/src/battle/effects/effect-verbs.js:68`；`game/src/battle/effects/effect-verbs.js:70`；`game/src/battle/effects/effect-verbs.js:71`；`game/src/battle/effects/effect-verbs.js:135`

### R08 · 装备/时点触发/持续规则/祝福

- 玩家意图与前提：玩家利用穿戴和连锁；已穿戴装备、触发时点和限次有效
- 实现结果：onEquip/battleStart/passive/skill、七时点runner、持续注册规则、祝福
- 失败风险/反证：同装重复、技能次数、嵌套触发链/局外资源、structured与legacy重复结算。已有反证：equip container结构域仍拒；其它装备/trigger接线但未逐件验
- 建议与边界：区分已穿戴技能与规则留白，先复用测试证据
- 独立界面：PREP、BOSS-DECK、BATTLE、BATTLE-BAG；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：nextSpellTwice、blessingChoice、castTimes、combatStartPassive、nextCastTimes、consumeTrigger、delayedGate
- 来源：`game/src/hub/game.hub.depart.js:126`；`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.overlays.js:19`；`game/src/battle/view/battle.overlays.js:118`；`game/src/battle/effects/effect-verbs.js:77`；`game/src/battle/effects/effect-verbs.js:81`；`game/src/battle/effects/effect-verbs.js:84`；`game/src/battle/effects/effect-verbs.js:95`；`game/src/battle/effects/effect-verbs.js:106`；`game/src/battle/effects/effect-verbs.js:111`；`game/src/battle/effects/effect-verbs.js:116`

### R09 · 变形/形态/随机特殊规则

- 玩家意图与前提：玩家追职业特殊玩法；legacy或hosted规则命中
- 实现结果：初攻转化/模仿前牌/形态/随机神秘效果/累计注能解锁
- 失败风险/反证：文本与structured混用、旧id映射、随机结果/长链未证。已有反证：capability明确structured transform没有resolver而拒，legacy注册识别保留
- 建议与边界：拒绝族列禁用独立项；不把文本识别等同支持全部schema
- 独立界面：BATTLE、BATTLE-CHOICE；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：formSwitch、mysteryEffect、choiceBranch、sealUnlock、shaTransform、imitate、imitateInHand、sealTransform
- 来源：`game/src/battle/view/battle.view.js:203`；`game/src/battle/view/battle.view.js:227`；`game/src/battle/effects/effect-verbs.js:85`；`game/src/battle/effects/effect-verbs.js:86`；`game/src/battle/effects/effect-verbs.js:87`；`game/src/battle/effects/effect-verbs.js:92`；`game/src/battle/effects/effect-verbs.js:93`；`game/src/battle/effects/effect-verbs.js:94`；`game/src/battle/effects/effect-verbs.js:118`；`game/src/battle/effects/effect-verbs.js:134`

### R10 · 容器/地图背包/逃跑边界

- 玩家意图与前提：玩家扩大空间、特殊背包使用或免判负脱战；类型/容器身份有效
- 实现结果：资源扩格/锦囊法术/背包复原，烟雾弹flee与surrender不同
- 失败风险/反证：structured equip.container未接、旧详情操作未现行公开、stored结算。已有反证：能力预检拒未接容器，bag.has/type过滤
- 建议与边界：保留当前legacy功能，不为静态覆盖解冻结构域
- 独立界面：BAG、BAG-PEARL、BAG-POUCH、BATTLE；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：escape、pocketUse、container、pouchCast、pocketRestore
- 来源：`game/src/hub/game.bag.js:520`；`game/src/hub/game.bag.js:419`；`game/src/hub/game.bag.js:352`；`game/src/battle/view/battle.view.js:203`；`game/src/battle/effects/effect-verbs.js:80`；`game/src/battle/effects/effect-verbs.js:82`；`game/src/battle/effects/effect-verbs.js:91`；`game/src/battle/effects/effect-verbs.js:115`；`game/src/battle/effects/effect-verbs.js:119`

### R11 · 结构规则预检与设计留白

- 玩家意图与前提：玩家期待牌面可执行；schema合法且capability消费者支持
- 实现结果：无rules走legacy；有rules整卡预检，未知op/target/filter/transform/hits.perFoe拒绝
- 失败风险/反证：配置/注册数量不代表执行/全类型支持，DESIGNER_BLANKS合法留白非新增bug。已有反证：card-rules.capability返回invalid/unsupported，按源支持表
- 建议与边界：明确禁用/暂缓，审查而不补代码；全组合覆盖未成立
- 独立界面：CARD-DESIGNER、BATTLE；动作：直接DOM/命令/自动规则，无独立UI.act；规则注册：designerBlank、unplayableSeal、weaponCover
- 来源：`game/src/hub/game.cardslib.designer.js:102`；`game/src/battle/view/battle.view.js:203`；`game/src/battle/effects/effect-verbs.js:117`；`game/src/battle/effects/effect-verbs.js:133`；`game/src/battle/effects/effect-verbs.js:142`


## 设置项逐项对账

来源 game/src/ui/game.menu.js:962–1091 与 battle/view/battle.view.js:436–454，原文直接监听器全保存在inventory.json。通用静音、音乐来源、音量、减动态、震动、节奏、开发展示各有不同结果；危险区三清空功能见F08，本轮未执行。

| 控件 | 玩家用途 | 真实结果 | 失败/未核边界 |
| --- | --- | --- | --- |
| setIndex | 节点编号 | game.toggles.index，sync侧栏 | 展示而非移动权限；保存/重载口径未实测 |
| setHint | 操作提示条 | sdt-hintbar与no-hintbar | 可关闭提示，键盘输入未因此禁用 |
| setBanner | 环层横幅 | sdt-banner与no-banner | 提示显示，非换图层 |
| setDev | 开发者模式 | sdt-dev、syncDevVisibility | 展示写存档测试工具；制作器写开关仍false |
| setShake | 屏幕震动 | sdt-reduce-shake | 只管震动，不等于关音/飘字/顿帧 |
| setReduceMotion | 减少动态 | sdt-reduce-motion、Motion刷新缓存 | 偏好与媒体查询合并，实际动画未全面观测 |
| setMusic | 背景音乐 | Sound.setMusicMuted | 通用静音存在不反证专属cue漏接 |
| setMusicSource | 音乐来源 | Sound.setMusicSource(scape/original) | 改声景/原曲来源，不是所有节点音已接 |
| setMusicVol | 音乐音量 | input即时数值/音量 | 音量变化没有实听录音证据 |
| setSfx | 音效 | Sound.setSfxMuted与开启ding | 关闭时试听也静音 |
| setSfxVol | 音效音量 | input即时音量，change播ding | 试听ding不证明其他cue注册 |
| btSetMusic / btSetSfx | 战斗音乐/音效 | 同Sound偏好 | 关闭面板需重绘战场 |
| btSetShake | 战斗震动 | 同sdt-reduce-shake | 仅震动 |
| btSetPace | 2×战斗节奏 | setPace(2/1) | 敌方/序列/前摇/飘字倍率，不等于Agent turbo |

## 牌效注册表：完整静态定义而非穷举组合

94个VERBS/ELSEWHERE/DESIGNER_BLANKS定义全保留于JSON，并按下表分到R01–R11；未归类规则=0。impl是历史人类标签，非代码分发器，pattern命中只说明“被识别”，不能证明数值/时序/目标执行正确。生物类型是敌人图鉴且不可打出，与召唤单位功能不同；职业是稀有度/归属，不是照相馆TYPES数组的一项。

| 注册名 / 层 | 识别功能 | 分析族 | 源码 |
| --- | --- | --- | --- |
| attackMod / VERBS | 攻击力增减（攻+N / 攻（-N）/ 获得 N 点攻击力） | R05 | `game/src/battle/effects/effect-verbs.js:36` |
| damage / VERBS | 造成伤害（N 点攻击/法术/固定/真实伤害 / N 点法伤 / 区间 M-N） | R01 | `game/src/battle/effects/effect-verbs.js:37` |
| aoeDamage / VERBS | 对全体/多目标伤害 | R01 | `game/src/battle/effects/effect-verbs.js:38` |
| aoeFixedByPrice / VERBS | 按价格折算的全体固定伤害 | R01 | `game/src/battle/effects/effect-verbs.js:39` |
| damageRepeat / VERBS | 伤害/效果触发 N 次（含区间 M-N） | R01 | `game/src/battle/effects/effect-verbs.js:40` |
| selfDamage / VERBS | 自伤 | R02 | `game/src/battle/effects/effect-verbs.js:41` |
| heal / VERBS | 回复生命 | R02 | `game/src/battle/effects/effect-verbs.js:42` |
| armor / VERBS | 获得护甲 | R02 | `game/src/battle/effects/effect-verbs.js:43` |
| draw / VERBS | 抽牌 | R04 | `game/src/battle/effects/effect-verbs.js:44` |
| drawUntil / VERBS | 抽到指定手牌数 / 从牌库定向抽取 | R04 | `game/src/battle/effects/effect-verbs.js:45` |
| noDraw / VERBS | 下回合无法抽牌 | R04 | `game/src/battle/effects/effect-verbs.js:46` |
| curseAdd / VERBS | 附加诅咒（流血/中毒/冰冻/沉默/破甲/禁疗/灼烧） | R03 | `game/src/battle/effects/effect-verbs.js:47` |
| curseRandom / VERBS | 随机诅咒 | R03 | `game/src/battle/effects/effect-verbs.js:48` |
| curseCopyAll / VERBS | 复制手牌招式上的全部诅咒 | R03 | `game/src/battle/effects/effect-verbs.js:49` |
| purify / VERBS | 净化自身 | R03 | `game/src/battle/effects/effect-verbs.js:50` |
| poisonBurst / VERBS | 立即触发毒伤 | R03 | `game/src/battle/effects/effect-verbs.js:51` |
| discover / VERBS | 发现 N 张牌（可限定卡池） | R06 | `game/src/battle/effects/effect-verbs.js:52` |
| discoverAndCast / VERBS | 发现并直接施放 / 获取剩余 | R06 | `game/src/battle/effects/effect-verbs.js:53` |
| discoverCopy / VERBS | 发现并额外获得复制 | R06 | `game/src/battle/effects/effect-verbs.js:54` |
| discoverInfuseFree / VERBS | 发现注能卡并免注能 | R06 | `game/src/battle/effects/effect-verbs.js:55` |
| potionDiscover / VERBS | 发现药水并直接释放 | R06 | `game/src/battle/effects/effect-verbs.js:56` |
| getRandomCard / VERBS | 随机获取卡牌（可限定数量/卡池） | R06 | `game/src/battle/effects/effect-verbs.js:57` |
| getSpecificCard / VERBS | 获取指定牌（置入手牌） | R06 | `game/src/battle/effects/effect-verbs.js:58` |
| deckInsert / VERBS | 洗入/置入牌库 | R04 | `game/src/battle/effects/effect-verbs.js:59` |
| handInsert / VERBS | 置入手牌 / 置入至满手牌 | R04 | `game/src/battle/effects/effect-verbs.js:60` |
| costMod / VERBS | 费用变化（变为 0 费 / 费用 -N） | R05 | `game/src/battle/effects/effect-verbs.js:61` |
| energyGain / VERBS | 获得能量 | R05 | `game/src/battle/effects/effect-verbs.js:62` |
| energyCapUp / VERBS | 能量上限 +N | R05 | `game/src/battle/effects/effect-verbs.js:63` |
| maxHpUp / VERBS | 血量上限 / 牌库上限 +N | R02 | `game/src/battle/effects/effect-verbs.js:64` |
| spellPowerUp / VERBS | 法伤 +N | R05 | `game/src/battle/effects/effect-verbs.js:65` |
| summonAlly / VERBS | 召唤随从 | R07 | `game/src/battle/effects/effect-verbs.js:66` |
| extraTurn / VERBS | 获得额外回合 | R07 | `game/src/battle/effects/effect-verbs.js:67` |
| noDrawOrSkip / VERBS | 跳过敌方阶段/无法行动 | R07 | `game/src/battle/effects/effect-verbs.js:68` |
| stealth / VERBS | 潜行 | R02 | `game/src/battle/effects/effect-verbs.js:69` |
| tauntOthers / VERBS | 迫使敌人相互攻击 | R07 | `game/src/battle/effects/effect-verbs.js:70` |
| stealAtk / VERBS | 偷取/夺取/降低敌方攻击力 | R07 | `game/src/battle/effects/effect-verbs.js:71` |
| execute / VERBS | 消灭低攻/受伤敌人 | R02 | `game/src/battle/effects/effect-verbs.js:72` |
| revive / VERBS | 复原/复活消耗卡 | R02 | `game/src/battle/effects/effect-verbs.js:73` |
| handSelect / VERBS | 手牌选择（复制/变 0 费/消耗） | R04 | `game/src/battle/effects/effect-verbs.js:74` |
| discardOrConsumeHand / VERBS | 消耗/弃置手牌 | R04 | `game/src/battle/effects/effect-verbs.js:75` |
| autoPlayHandType / VERBS | 直接释放手牌中的某类牌 | R06 | `game/src/battle/effects/effect-verbs.js:76` |
| nextSpellTwice / VERBS | 下一张牌施放 N 次 | R08 | `game/src/battle/effects/effect-verbs.js:77` |
| doubleDamageNext / VERBS | 破隐/破甲类伤害翻倍 | R01 | `game/src/battle/effects/effect-verbs.js:78` |
| damageReduce / VERBS | 本回合所受伤害降为 N / 避开伤害 / 免疫致命 | R01 | `game/src/battle/effects/effect-verbs.js:79` |
| escape / VERBS | 逃跑 | R10 | `game/src/battle/effects/effect-verbs.js:80` |
| blessingChoice / VERBS | 随机获取一项祝福 | R08 | `game/src/battle/effects/effect-verbs.js:81` |
| pocketUse / VERBS | 仅背包内可用（复原最多 N 张） | R10 | `game/src/battle/effects/effect-verbs.js:82` |
| duration / VERBS | 持续 N 回合（时长覆盖） | R03 | `game/src/battle/effects/effect-verbs.js:83` |
| castTimes / VERBS | 施放 N 次某牌 | R08 | `game/src/battle/effects/effect-verbs.js:84` |
| formSwitch / VERBS | 形态（剑仙/自然/宇宙/形态池） | R09 | `game/src/battle/effects/effect-verbs.js:85` |
| mysteryEffect / VERBS | 随机神秘效果 | R09 | `game/src/battle/effects/effect-verbs.js:86` |
| choiceBranch / VERBS | 抉择（1°/2°/3° 分支） | R09 | `game/src/battle/effects/effect-verbs.js:87` |
| costSwapDiscover / VERBS | 发现两张随机招式并交换费用 | R06 | `game/src/battle/effects/effect-verbs.js:88` |
| multiShot / VERBS | 连开 N 枪 / 连击 | R01 | `game/src/battle/effects/effect-verbs.js:89` |
| killReward / VERBS | 击杀奖励（护甲/币/抽牌） | R01 | `game/src/battle/effects/effect-verbs.js:90` |
| container / VERBS | 容器（背包扩容/内置空间） | R10 | `game/src/battle/effects/effect-verbs.js:91` |
| sealUnlock / VERBS | 累计注能解锁 | R09 | `game/src/battle/effects/effect-verbs.js:92` |
| shaTransform / VERBS | 把「初始攻击」转化为其它牌 | R09 | `game/src/battle/effects/effect-verbs.js:93` |
| imitate / VERBS | 在手牌中变形为上一张牌 | R09 | `game/src/battle/effects/effect-verbs.js:94` |
| combatStartPassive / VERBS | 对战开始时被动 | R08 | `game/src/battle/effects/effect-verbs.js:95` |
| graveScale / ELSEWHERE | 墓地/消耗数量加成 | R04 | `game/src/battle/effects/effect-verbs.js:103` |
| fuelPriceScale / ELSEWHERE | 按注能牺牲品价格折算 | R05 | `game/src/battle/effects/effect-verbs.js:104` |
| keepInHand / ELSEWHERE | 永远保留在手牌 / 无法注能 | R04 | `game/src/battle/effects/effect-verbs.js:105` |
| nextCastTimes / ELSEWHERE | 下一张牌施放 N 次（规则层） | R08 | `game/src/battle/effects/effect-verbs.js:106` |
| selfCostZero / ELSEWHERE | 满足条件时本牌变为 0 费 | R05 | `game/src/battle/effects/effect-verbs.js:107` |
| prevCardBonus / ELSEWHERE | 上一张打出的牌决定加成 | R05 | `game/src/battle/effects/effect-verbs.js:108` |
| bleedDouble / ELSEWHERE | 流血相关伤害翻倍 | R03 | `game/src/battle/effects/effect-verbs.js:109` |
| bleedTargetBonus / ELSEWHERE | 对流血目标的结算加成 | R03 | `game/src/battle/effects/effect-verbs.js:110` |
| consumeTrigger / ELSEWHERE | 消耗该牌时触发 | R08 | `game/src/battle/effects/effect-verbs.js:111` |
| onAcquire / ELSEWHERE | 获取该牌时被动 | R06 | `game/src/battle/effects/effect-verbs.js:112` |
| vsFreezeBonus / ELSEWHERE | 对冰冻目标伤害加成 | R03 | `game/src/battle/effects/effect-verbs.js:113` |
| onKill / ELSEWHERE | 击杀钩子 | R01 | `game/src/battle/effects/effect-verbs.js:114` |
| pouchCast / ELSEWHERE | 容器选择其中 1 张直接施放 | R10 | `game/src/battle/effects/effect-verbs.js:115` |
| delayedGate / ELSEWHERE | 两回合后的延迟门 | R08 | `game/src/battle/effects/effect-verbs.js:116` |
| designerBlank / ELSEWHERE | 设计者原文留白句 | R11 | `game/src/battle/effects/effect-verbs.js:117` |
| imitateInHand / ELSEWHERE | 在手牌中变形 | R09 | `game/src/battle/effects/effect-verbs.js:118` |
| pocketRestore / ELSEWHERE | 背包消耗口袋复原 | R10 | `game/src/battle/effects/effect-verbs.js:119` |
| structuredDamage / ELSEWHERE | 结构化伤害字段已覆盖<br>gate=structuredHit | R01 | `game/src/battle/effects/effect-verbs.js:120` |
| infuseBonusStructured / ELSEWHERE | 注能伤害加成（结构化字段覆盖）<br>gate=structuredHit | R05 | `game/src/battle/effects/effect-verbs.js:121` |
| infuseLeadBonus / ELSEWHERE | 注能前缀后的「伤害 +N」<br>gate=structuredHit+infusedLead | R05 | `game/src/battle/effects/effect-verbs.js:122` |
| hpThreshold / ELSEWHERE | 对低血目标加成<br>gate=structuredHit | R01 | `game/src/battle/effects/effect-verbs.js:123` |
| hpHalfThreshold / ELSEWHERE | 血量一半及以下伤害增加<br>gate=structuredHit | R01 | `game/src/battle/effects/effect-verbs.js:124` |
| healEqualToDamage / ELSEWHERE | 回复等量生命（结算层）<br>gate=structuredHit | R02 | `game/src/battle/effects/effect-verbs.js:125` |
| repeatTimes / ELSEWHERE | 触发 N 次（结构化）<br>gate=structuredHit | R01 | `game/src/battle/effects/effect-verbs.js:126` |
| extraCastTimes / ELSEWHERE | 额外施放 N 次（结构化）<br>gate=structuredHit | R01 | `game/src/battle/effects/effect-verbs.js:127` |
| spellBonusDouble / ELSEWHERE | 受法伤加成翻倍（结构化）<br>gate=structuredHit | R05 | `game/src/battle/effects/effect-verbs.js:128` |
| atkEqualToDamage / ELSEWHERE | 造成等同于攻击力的伤害（结构化）<br>gate=structuredHit | R01 | `game/src/battle/effects/effect-verbs.js:129` |
| poisonLegacy / ELSEWHERE | 中毒敌人死亡时层数转移（腐化之种，battle.core 打出登记 + 三死亡入口结算） | R03 | `game/src/battle/effects/effect-verbs.js:130` |
| curseImmune / ELSEWHERE | 免疫诅咒（深渊主宰·妲莉薇特，battle.core addPlayerCurse 拦截） | R03 | `game/src/battle/effects/effect-verbs.js:131` |
| spellsInfused / ELSEWHERE | 本场所有法术均已注能（深渊主宰·妲莉薇特，battle.core infusedBase 贯通） | R05 | `game/src/battle/effects/effect-verbs.js:132` |
| unplayableSeal / ELSEWHERE | 封印之牌无法打出（受缚之残影系，battle.rules unplayableReasonFor 拦截） | R11 | `game/src/battle/effects/effect-verbs.js:133` |
| sealTransform / ELSEWHERE | 集齐封印之牌破封化形（受缚之残影 → 深渊主宰·妲莉薇特，battle.core 集齐检测） | R09 | `game/src/battle/effects/effect-verbs.js:134` |
| summonStatlessLimbs / ELSEWHERE | 召唤 4 名封印肢体（无攻血场面物件，battle.core 打出登记） | R07 | `game/src/battle/effects/effect-verbs.js:135` |
| weaponCover / DESIGNER_BLANKS | 以天启诛魔剑覆盖你的所有武器（设计者留白，无结算） | R11 | `game/src/battle/effects/effect-verbs.js:142` |

## 禁用/留白/未归类边界

制作器写、导入写、编辑删除由CARD_DESIGNER_WRITES_ENABLED=false冻结；制作器源码存在不等于当前上线。结构预检显式拒绝transform无resolver、equip.container未接、hits.perFoe未支持、未知手牌操作/获取filter/dest-act、未知hosted规则；武器覆盖为DESIGNER_BLANKS留白。这些列为独立拒绝/留白边界，不“修复”成新功能。研究所备战/节点/符文/商店/结局等暂缓功能按F64及LAB-*目录登记，未展开实战。

275个UI.act注册点全部归类，11个动态表达式仍保留原式/循环源，没有假装全部实例已点击。17个未归类底层监听逐行列于INTERFACE-INVENTORY；动画/素材/错误捕获/QA与缩放事件尚未逐内部函数分析，属于工程边界，非玩家页面漏项。模板跨插值data-act只保留片段，不把静态无匹配直接判失接线；例如cardZoom在body外有专用footer分发。

**未覆盖的实测边界：** 所有卡牌两两/长链组合、全部事件/成就/宠物可达、长期构筑胜率、所有地图种子、每种存储损坏/配额失败实页、声音听感和自然动画时序。79个分析族是完整静态接线的归纳，不是79项全通过测试。前提/结果/风险里需决策的规则（如安全往返经验）先交老板定规则，再授权开发。
