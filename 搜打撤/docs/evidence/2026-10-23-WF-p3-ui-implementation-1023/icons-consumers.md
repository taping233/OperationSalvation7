# 图标语义消费者迁移

本子任务首批迁移9份源码中的35处显式图标用途；随后在责任会话明确释放图标字段/token后，追加12份源码59处，再补3份既有属地13处。三批共21份不同源码、107处图标字段/token。新图形注册、SVG资源与公共水合由图标子任务负责；此处只把已核实的业务含义接到对应键，没有全局替换`cards`。当前状态为**已接入待主代理实页核验**。

## 已接入用途

以下源码路径相对`game/src/`，最终资源为`game/assets/ui/semantic-icons/<新键>.svg`。所有入口沿原宿主尺寸，不改变按钮、命中区或卡牌transform。

| 页面/用途 | 消费者 | 旧键 → 新键 | 范围与协调 |
| --- | --- | --- | --- |
| 战斗剩余牌库标题 | `battle/view/battle.overlays.js:renderDeckPileView` | cards → draw-pile | 仅标题小图；牌堆仍显示玩家已装备卡背。 |
| 消耗牌堆标题及HUD后缀 | `battle/view/battle.overlays.js:renderGrave`、`battle.piles.view.js:renderCombatPiles` | skull → consumed-pile | 不引入弃牌堆或洗回规则；原`cardBackHTML`及消耗计数保留。 |
| 战斗存入安全格按钮及成功/容量反馈 | `battle/view/battle.overlays.js:renderBattleBag` | lock → safe-slot | 标题/日志同义；不改整组存入、容量或保存。 |
| 法师锦囊标题、满囊/存入/取出日志、背包详情入口 | `hub/bag-container-pages.js:openPouchStore`、`hub/game.bag.js:openBagZoom` | cards → spell-pouch | 容器标题与操作反馈同一含义；不修改声明容量、类型过滤或存取判定。 |
| 珍珠盒标题、满盒/存入日志、背包详情入口 | `hub/bag-container-pages.js:openPearlStore`、`hub/game.bag.js:openBagZoom` | gem → pearl-box | 容器与一般资源宝石分义；“取回背包”的反馈沿目标容器bag。 |
| 完整人物卡池入口 | `run/game.run.class-choice.page.js:openClassChoice` | cards → card-library | 卡池分类语义；未选卡的通用空预览仍使用cards。 |
| 卡牌制作坊标题及保存成功反馈 | `hub/game.cardslib.designer.js:renderDesigner/saveDraftCard` | cards → card-craft | 保留保存按钮save、导入/导出图及制作器业务。 |
| 制作器两处操作说明 | `hub/game.cardslib.designer.js` | lantern → info | 普通帮助说明不再借照明图；不新增提示层。 |
| 宠物蛋收藏奖励预览及共用领奖反馈 | `hub/meta.js:collRewardText` | crystal → pet-egg | 函数同时供收藏室与成功日志使用；不替换一般宝石资源。 |
| 卡背奖励预览及成就领取反馈 | `hub/hub.archive-v3.js:rewardHTML`、`hub/meta.js:claim` | cards → card-back | 同一奖励行的卡牌奖品仍用cards；七款真实卡背WebP与装备选择不变。 |
| 制作器抽牌句式 | `cards/mech-sentences.js:drawTxt` | cards → draw-card | 只改图标，tpl/sen/cnt/max原文保留。 |
| 制作器11项战斗状态句式 | `cards/mech-sentences.js` | 旧通用图 → STATUS_ICONS | 流血、中毒、冰冻、沉默、破甲、禁疗、潜行、免疫伤害、攻击强化、法术强化、减伤，直接导入`ui/status-icons.js`同义映射，避免再手抄一份。 |

尺寸依据：默认`.ic`是1.1em；日志沿`overlays.css`14px；制作器机制按钮沿`cards.css`14px；普通页头已有18px定值，跑局数据页头已有25px定值。具体页面的最终缩放、filter、focus与禁用对比仍由主代理在当前窗口核验；静态尺寸不是实页测量结果。

## 核对后保留

- `cards/cards.js`的`CARD_BACKS`未改。`scenes.css`已将旧`.hsb-emblem`隐藏，七个`hb-*`使用对应完整手绘WebP。隐藏的历史纹章键不是当前可见占位入口，不为凑数量改动卡背数据。
- `ui/menu-data.js`与`ui/menu-settings.js`原本已使用chart表示跑局数据；消费者含义正确，专属图注册退出旧chart→archive别名后即可生效，两份文件不重写。
- `hub.archive-v3.js`和`meta.js`一般卡牌奖励、人物卡池未选卡空预览继续使用cards；背包反馈使用bag。这些是同义复用。
- 真实卡背HTML、图案、收藏解锁和玩家装备都保留。图标换键不修改流程回调、存档字段、支付、奖励或计数。

## 交主代理继续核对的候选

本表只留追加批完成后仍存在的候选；已完成的59处见下一节。后续若由主代理或其他分片接入，以对应分片记录更新本表。

| 候选 | 当前意义 / 建议 |
| --- | --- |
| `run/game.run.events.js:684/857` | 奖励与修鞋铺两条员工通行证A碎片日志仍crystal → pass-fragment。 |
| `battle/effects/effect-steps.m2.domain.js:191` | 视为已注能日志sparkles → infuse；本文件仍在本子任务写属地之外。 |
| `battle/effects/effect-steps.m2.domain.js:125/132` | 偷取攻击力使用arrow，机制实际为atkDown；建议与状态元数据status-atk-down统一，先由责任方核对。 |
| `battle/core/battle.engine.factory.domain.js:542/546` | 元素符印解锁/重复解锁仍crystal，是“法伤＋抽牌”的组合机制反馈；待明确符印业务图，不机械改成注能。 |
| `cards/mech-sentences.js` | guard与shield仍共用shield，purify仍sparkles，discover仍lantern。次级机制图语义待核对；没有冒充为16项常驻状态枚举。 |

`battle.view.js`手牌页位、`cards.view.js`抽牌/注能/机制图由主代理单独协调；本子任务仍未编辑这两份文件。商店收购入口和核心16状态图标字段已在追加批完成。

## 协调追加批：12文件59处，仅图标宏变化

主代理已读取“全面并行排查项目 Bug”负责会话的明确协调结论，允许修改指定状态icon字段及商店/抽牌/锦囊等图标token。本批以当时工作区为基线，不按HEAD重写；没有给核心计算模块新增UI依赖。

| 文件（相对game/src） | 精确替换数 | 内容 |
| --- | ---: | --- |
| `battle/core/combat.factory.js` | 16 | CURSE_META/BUFF_META各状态的icon宏改为对应status-*；名称、数值/计时/开关字段原文保留。 |
| `battle/effects/battle.status-operations.domain.js` | 7 | 六类明确祝福/闪避日志与中毒引爆图；其余具名诅咒日志经meta.icon自动同义。 |
| `battle/effects/effect-steps.curse.js` | 18 | 明确流血、中毒、冰冻、沉默、破甲、禁疗、潜行、攻击/法术强化、免伤、减伤、剑仙/满月/宇宙形态的图。 |
| `run/game.run.shop.js` | 1 | 收购台标题cards→sell-cards。 |
| `battle/core/battle.engine.factory.domain.js` | 3 | 不屈符文抽牌→draw-card；锦囊载入、空囊反馈→spell-pouch。 |
| `battle/core/battle.draw.domain.js` | 1 | 从牌库抽取指定类别→draw-card。 |
| `battle/core/battle.lifecycle.domain.js` | 2 | BOSS牌盒/编组牌库→draw-pile。 |
| `battle/core/battle.resolution.domain.js` | 6 | 两条牌库上限反馈→draw-pile；四条抽牌反馈→draw-card。 |
| `battle/effects/effect-steps.audit.js` | 2 | 抽牌→draw-card；BOSS编组上限→draw-pile。 |
| `hub/game.bag.safe-transfer.js` | 1 | 移入/换入安全格动作图→safe-slot。 |
| `hub/game.hub.runtime.js` | 1 | 装备卡背反馈→card-back。 |
| `hub/game.hub.pages.js` | 1 | 没有宠物蛋反馈→pet-egg。 |

保留有实际理由的图：lifecycle中“随身手牌入手＋另有99牌库”的混合总述保留通用cards；状态操作的“多种随机/手牌诅咒”总述保留通用skull；失败cross、致命保护特殊规则sparkles、商店币值回执coin未按单一状态误改。

12份源文件均保存即时原文/SHA，随后验证每份文件去除`[[icon:*]]`宏后与即时基线逐字一致，连原换行也未改变；目标SHA全部匹配预检值。16项核心meta.icon与STATUS_ICONS现已全部一致。基线、逐条替换语义和前后SHA位于系统临时目录`p3-ui-card-states-1023/coordinated-tokens-20261024/manifest.json`。

必要近邻回归8文件61项通过：combat、combat-status-boundary-unification、normal-effects-deck-regression、cursed-blade、wf-feedback1021-b-status-icons、shop-currency-guidance、shop-sell-stored-guard、bag-safe-transfer。没有改写测试或玩法行。首次Node写源文件报UNKNOWN并在第一文件停止，核实12份源码均未改变后改用apply_patch完成；未改权限。

## 收尾补齐批：3文件13处与一致性回归

本批沿已获协调的相同属地继续补齐明确机制图，不改判断或结算：`battle.resolution.domain.js`9处（注能2、法伤倍率1、冰冻1、禁疗4、流血条件1），`battle.engine.factory.domain.js`3处（冰冻符文、中毒杖、闪避结果），`game.bag.js`1处（受保护初始牌不能丢弃时pen→lock）。已核该日志来自`result.code==='protected'`，没有编辑功能或修改文案的含义。

这3份原始文件/SHA及精确替换表保存在系统临时目录`p3-ui-card-states-1023/coordinated-detail-tokens-20261024/manifest.json`。补丁后目标SHA和去宏逐字一致保护均通过，不曾改变其他行或换行。

| 分类 | 最终结果 |
| --- | --- |
| 已销账：本子任务接线 | 牌堆标题/消耗HUD、容器入口与日志、卡池/制作坊、宠物蛋/卡背奖励、核心16状态元数据、已分配的状态/抽牌/编组/法伤/注能日志，以及明确受保护提示。 |
| 已销账：主代理接线的近邻复核 | 主代理独自修改手牌页位hand-pages及无正文抽牌draw-card/注能infuse三个参数；本子任务未编辑这两份来源文件。分页HUD字段矩阵通过，单次卡面解析文件通过。 |
| 合理复用 | 一般卡牌奖励/空预览cards、七款完整卡背WebP、混合手牌＋牌库总述cards、混合诅咒skull、失败cross、币值coin、抵抗诅咒shield。后者不等同“免疫伤害”，不能强改status-immune。 |
| 仍待查 | 上一节列出的域外m2/事件碎片、符印组合反馈、制作器次级机制图；固定伤害crystal亦为语义候选，damage-fixed尚未注册。 |

新增`tests/status-icon-consistency.test.js`：17项通过，验证核心9增益＋7诅咒的全集、展示键不重复、core.icon/STATUS_ICONS/TERM_TIPS/语义资源路径一致；core未导入UI。`tests/icon-hydration.test.js`经主代理授权仅将安全格用例的lock预期同步为safe-slot，真实hydrate、装饰aria-hidden、纯图标名称、幂等断言全部保留并通过。两文件ESLint通过。

卡面近邻中`card-description-single-resolution.test.js`通过；四文件46项汇总批次中有1项失败，位于`card-description-text.test.js`的`sourceCardLibrary()`调用：外部同步脚本沙箱剥掉`cards.sync.m1/m2/m3`的`onPlayDefinition as R`导入后未注入别名，报`R is not defined`。其余该批45项通过，不能把文案文件写成全绿。已按主代理指示保留外部问题，不改同步脚本或该测试。分页只跑`battle-persistent-stage.test.js`的`captures equivalent HUD semantics`单例：1通过、40未运行，确实执行了下一栏点击。

新命中闭包补跑`battle-resolution.test.js`与`venom-staff-passive.test.js`，后者6项通过；前者初次8失败均是旧图标token预期，状态/数值断言通过。主代理明确授权后仅同步如下8个expected token，保留全部文本、状态和计数断言；该文件复跑58项全过：

| 状态 | 旧预期 → 新预期 |
| --- | --- |
| 流血 | blood → status-bleed |
| 冰冻 | crystal → status-freeze |
| 攻击强化 | swords → status-atk-up |
| 法术强化 | crystal → status-spell-up |
| 潜行 | runner → status-stealth |
| 免疫伤害 | sparkles → status-immune |
| 闪避 | shield → status-dodge |
| 减伤 | plate → status-reduce |

这8行的去宏后原文一致保护通过，原始测试/SHA另存同一临时证据目录；没有删除或放宽断言。未重复前批61项、未全量/build/提交/浏览器。当前子任务源码与测试冻结。

## 最终集成清单：精确交付路径与现行残留

下表数量是本人相对每批**即时工作区基线**的图标字段/token贡献，不是共享工作树相对HEAD的全部diff；已保留其他会话的既有内容。第一批35＋协调批59＋收尾13＝107处，实际涉及21份不同源码。

| 精确源码路径（相对搜打撤） | 本人替换数 | 消费者到新语义 |
| --- | ---: | --- |
| `game/src/battle/view/battle.overlays.js` | 5 | 剩余牌库draw-pile；消耗标题consumed-pile；战斗安全格safe-slot。 |
| `game/src/battle/view/battle.piles.view.js` | 1 | 消耗HUD后缀consumed-pile，玩家卡背不变。 |
| `game/src/hub/bag-container-pages.js` | 7 | 锦囊标题/存取/容量spell-pouch；珍珠盒标题/存入/容量pearl-box。 |
| `game/src/hub/game.bag.js` | 3 | 容器入口spell-pouch/pearl-box；受保护不可丢弃lock。 |
| `game/src/hub/meta.js` | 2 | 宠物蛋pet-egg、卡背奖励card-back。 |
| `game/src/hub/game.cardslib.designer.js` | 4 | 制作坊标题/保存反馈card-craft；操作帮助info。 |
| `game/src/run/game.run.class-choice.page.js` | 1 | 完整人物卡池card-library。 |
| `game/src/cards/mech-sentences.js` | 12 | 制作器11状态STATUS_ICONS＋抽牌draw-card。 |
| `game/src/hub/hub.archive-v3.js` | 1 | 卡背奖励card-back，与普通卡牌奖励分义。 |
| `game/src/battle/core/combat.factory.js` | 16 | 核心16状态的meta.icon同义status-*；无UI导入。 |
| `game/src/battle/effects/battle.status-operations.domain.js` | 7 | 六类祝福/闪避与中毒引爆的status-*。 |
| `game/src/battle/effects/effect-steps.curse.js` | 18 | 文本路径明确状态日志的status-*。 |
| `game/src/run/game.run.shop.js` | 1 | 收购台标题sell-cards。 |
| `game/src/battle/core/battle.engine.factory.domain.js` | 6 | 抽牌draw-card、锦囊spell-pouch、冰冻/中毒/闪避status-*。 |
| `game/src/battle/core/battle.draw.domain.js` | 1 | 按类别从牌库抽取draw-card。 |
| `game/src/battle/core/battle.lifecycle.domain.js` | 2 | BOSS编组/牌盒标题日志draw-pile。 |
| `game/src/battle/core/battle.resolution.domain.js` | 15 | 牌库上限draw-pile、抽牌draw-card、注能infuse、法伤倍率spell-power、冰冻/禁疗/流血status-*。 |
| `game/src/battle/effects/effect-steps.audit.js` | 2 | 抽牌draw-card、BOSS编组上限draw-pile。 |
| `game/src/hub/game.bag.safe-transfer.js` | 1 | 安全格动作装饰safe-slot。 |
| `game/src/hub/game.hub.runtime.js` | 1 | 装备卡背反馈card-back。 |
| `game/src/hub/game.hub.pages.js` | 1 | 无宠物蛋反馈pet-egg。 |

本人修改的5份CSS：

- `game/css/discovery-selection.css`：选中装饰合并、键盘焦点独立。
- `game/css/card-state-motion.css`：奖励查看焦点。
- `game/css/bag-design-system.css`：释放真实卡面焦点、去重复提亮。
- `game/css/expedition-inventory.css`：CSS hover位移排除真实卡面宿主。
- `game/css/battle-discover.css`：原减少动态规则取消hover位移。

本人修改的8份测试：

- `tests/card-state-motion.test.js`：已领/丢弃卡退出轻抬。
- `tests/discovery-selection.test.js`：阅读焦点不改业务选择。
- `tests/battle-hud-info.test.js`：消耗图及真实卡背保留。
- `tests/hub-archive-v3.test.js`：卡牌/卡背奖品区分。
- `tests/mech-sentences.test.js`：制作器状态图和抽牌键一致。
- `tests/icon-hydration.test.js`：安全格expected token同步safe-slot，其余真实水合与可访问性断言保留。
- `tests/battle-resolution.test.js`：8条旧状态图expected token同步，其余文本/状态/数值断言保留。
- `tests/status-icon-consistency.test.js`：新增16项核心/展示/词条一致性与全集检查。

核对后保持原文的分配入口：`game/src/ui/card-state-motion.js`、`game/css/battle-pile-view.css`。主代理修改的`battle.view.js`、`cards.view.js`不计入本人21源码贡献；设置/密集状态/资源注册的其他子代理贡献也未混入上表。

### 21源码中的剩余cards调用

本次只读检索这21份待交付源码，字面`[[icon:cards]]`或`Icons.img('cards')`共余10处，都是实际运行分支；没有把注释或变量名计入消费者。没有发现“剩余牌库”标题、抽牌动作、锦囊、卡背奖励、制作入口继续借用通用cards。

| 现行位置 | 保留理由 |
| --- | --- |
| `hub/meta.js:268`、`hub/hub.archive-v3.js:22` | 普通卡牌奖品；同一奖励中的卡背已另用card-back。 |
| `run/game.run.class-choice.page.js:191` | 未选卡的空预览，表示等待查看一张卡。 |
| `battle/core/battle.engine.factory.domain.js:509` | 阿猫赠送一张临时牌入手，不是从牌库抽牌。 |
| `battle/core/battle.draw.domain.js:46` | 某卡未满足施放条件、留在手牌中的反馈。 |
| `battle/core/battle.lifecycle.domain.js:317` | 同一句解释随身手牌＋99临时牌库的混合开局总述。 |
| `battle/core/battle.resolution.domain.js:692` | 按本次入手法术数回复生命的组合反馈，不是抽牌动作入口。 |
| `hub/game.hub.runtime.js:324` | 初始牌无需入库的卡牌规则反馈。 |
| `hub/game.hub.pages.js:266/274` | 可获得卡牌集合为空，以及卡包发卡；均以卡牌对象为主语。 |

正向接线复核：`battle.overlays.js:90`剩余牌库为draw-pile，消耗标题/HUD为consumed-pile；主代理的现行手牌页位为hand-pages、卡面无正文抽牌为draw-card、注能为infuse。未发现本子任务需要新增修复的重复牌库占位；域外候选继续保留于前表，不扩大为全仓结论。

### 最终验证复用与补跑

安全格按钮、图标注册/水合实现、safe-slot预期都未晚于原00:33验证发生新变化，真实hydrate通过证据复用。核心`combat.factory.js`于00:37:43被责任会话更新，晚于前次58项回归；因此只补跑`status-icon-consistency.test.js`及`battle-resolution.test.js`，于00:50得到2文件75项通过。未重复未变输入的水合/卡面/分页测试，外部同步沙箱R缺失仍按前节如实保留。本轮仅更新本记录，没有编辑源码；分片再次冻结。

## 2026-10-24只读补盘：高频链的完成边界

**以下是协调追加批实施前的检查快照。** 其中已分配的核心metadata/日志现已按上两节完成，手牌/卡面三个参数已由主代理完成；不能再把这些快照行当作当前待办。其余入口沿当前剩余候选表处理。该次只核对候选及直接调用链，没有重扫全仓或修改源码；行号随其他会话修改可能移动，执行时按符号匹配。

| 链 | 已完整的部分 | 仍需协调的部分 |
| --- | --- | --- |
| 牌堆 | 剩余牌库标题draw-pile、消耗标题/HUD后缀consumed-pile；真实卡背保留正确 | 编组/上限日志仍cards，见上表；这不阻塞牌堆标题本身，但不能称全链已统一。 |
| 手牌页码 | hand-pages键和资源已注册 | `battle.view.js`页码仍cards，当前未接入。 |
| 抽牌 | 制作器drawTxt已draw-card | `cards.view.js`无正文效果标签及实际抽牌日志仍cards。普通卡牌奖励、无卡预览不应跟随修改。 |
| 法伤 | 玩家HUD已spell-power；法术强化常驻项/词条/制作器已status-spell-up | 法伤增加/倍率日志仍crystal；属性法伤与“法术伤害类型”不同，不能把伤害类型sparkles也机械改成spell-power。 |
| 16状态 | 9增益+7诅咒的状态栏全部有STATUS_ICONS；TERM_TIPS的16项与映射一致；制作器存在的11项也一致 | 核心16个meta.icon全为旧键，结构化诅咒日志真实消费它们；文本/结构化祝福及部分诅咒日志另有硬编码旧图。只改核心元数据仍不能闭合所有日志。 |

只读运行核对结果：`states=16`、`presentationMissing=[]`、`tipMismatch=[]`、`craftStateCount=11`、`oldMetadataCount=16`。没有调用出牌、发奖、保存或浏览器接口。

| 具体符号 / 当前行 | 当前键 | 应改键 / 判断 | 是否活跃占用 |
| --- | --- | --- | --- |
| `battle/view/battle.view.js:render → pageHTML:531` | cards | hand-pages | 是：P3台账明确避开；WF-next-verified-main-1021候选待验收，需原责任方协调。 |
| `cards/cards.view.js:buildCardHTML:146` | cards | draw-card；只在drawN>0时可见，是真实条件分支 | 是：同一WF-next候选，P3台账明确避开。 |
| `cards/cards.view.js:buildCardHTML:151` | crystal | infuse；无正文效果标签的真实分支 | 是：同上。 |
| `run/game.run.shop.js:renderSellPage:483` | cards | sell-cards；售卡去向的图，普通购买卡面不改 | 需协调：WF-project-bugfix-round2远征/委托域；旧shop记录的“释放”不代表当前域无占用。 |
| `battle/core/combat.factory.js:createCombatRuntime → CURSE_META:11–19` | blood/skull/crystal/cross/tools/heart/arrow | 对应bleed/poison/freeze/silence/abreak/healban/atkDown的STATUS_ICONS；只替换icon字段 | 是：WF-project-bugfix-round2战斗core域。 |
| `battle/core/combat.factory.js:createCombatRuntime → BUFF_META:26–34` | swords/crystal/runner/sparkles/plate/runner/sword/wood/sparkles | 对应atkUp/spellUp/stealth/immune/reduce/dodge/swordForm/natureForm/cosmosForm的STATUS_ICONS | 是：同上。 |
| `battle/effects/battle.status-operations.domain.js:resolveCurseOperation:108/116/118/147/159/162/164` | meta.icon，运行时来自旧CURSE_META | 跟随核心对应status-*；这些是活日志，文件顶部“单源”注释不是完成证据 | 是：WF-project-bugfix-round2 effects域。 |
| 同文件祝福处理:214/216/225/227/229/233 | runner/sparkles/swords/crystal/plate/shield | 分别status-stealth/status-immune/status-atk-up/status-spell-up/status-reduce/status-dodge；不经meta.icon，须另接 | 是：同上。 |
| `battle/effects/effect-steps.curse.js:26/40/41/81/96/100/101/109/117/125` | blood/skull/crystal/cross/tools/heart | 对应流血/中毒/冰冻/沉默/破甲/禁疗的status-*；17/65的cross是失败图，不能一并改成沉默 | 是：同上。 |
| 同文件祝福处理:135/147/156/181/191/201/210/219 | runner/swords/crystal/sparkles/plate/sword/wood/sparkles | 按潜行/攻击强化/法术强化/免伤/减伤/剑仙/满月/宇宙使用对应STATUS_ICONS | 是：同上。 |
| `battle/core/battle.resolution.domain.js:537`、`battle.engine.factory.domain.js:409` | crystal/gem | status-freeze，分别为附加冰冻和冰冻符文日志 | 是：WF-project-bugfix-round2战斗core域。 |
| `battle/core/battle.resolution.domain.js:224/414`、`battle/effects/effect-steps.m2.domain.js:191` | crystal/sparkles | infuse；已注能数量/视为已注能不是宝石或一般提示 | 是：战斗core/effects域。 |
| `battle/core/battle.resolution.domain.js:246` | crystal | spell-power；此处是法伤倍率，不是注能或伤害类型 | 是：战斗core域。 |
| `cards/cards.rules.js:DMG_TYPE_META.fixed:44` | crystal | 固定伤害与宝石/注能不同；建议专用damage-fixed，当前未注册，属新增候选 | 本轮未确认独立编辑占用；不得据此擅自扩改。 |

按当前台账，WF-backend-audit-phase3对combat.factory的旧工作已释放，但**当前**WF-project-bugfix-round2又声明战斗core/effects编辑中，不能用旧释放记录跳过协调。

本次排除的误报：`cards.data.js`中“手绘水晶表示稀有度”的三处是资料注释；`cards.view.js:69`的cards回退位于当前被隐藏的卡背emblem；`cards.rules.js`的spell图属于伤害类型而非HUD属性。一般卡牌奖励、卡牌库空预览、混合多类诅咒的总述图保留通用图，不逐句造图。

## 验证与现场

- `node node_modules/vitest/vitest.mjs run tests/mech-sentences.test.js tests/battle-hud-info.test.js tests/hub-archive-v3.test.js tests/base-meta.test.js tests/bag-pouch-capacity.test.js --reporter=dot`：5文件、81测试通过。新增断言覆盖消耗图与卡背保留、卡牌/卡背奖励区分、制作器与战斗状态同义图标及抽牌专用键。
- 珍珠盒接入后定向补跑`tests/pearl-storage-interface.test.js`：1文件、10测试通过。
- 9份已改源码经Acorn解析通过；消费者及机制表引用的35个语义键对应资源全部存在。
- 本批前原文与SHA256在系统临时目录`p3-ui-card-states-1023/icons-baseline.json`，测试原文在`icons-tests-baseline.json`。所有既存未提交改动保留。
- `git diff --check`在`game.bag.js:178`报告预存两个空格的空行；首次编辑快照与当前该行逐字一致，不属于本批引入，未改动他人行。其余自有检查未报告新增空白问题。
- 未build、提交、启动服务或自行实页验证；SVG实际辨识度、加载失败文字回退与宿主状态由主代理统一验收。
