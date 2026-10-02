import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const research='docs/evidence/2026-10-02-production-research';
const out=path.join(root,research,'planning/systems');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,research,p),'utf8'));
const spec=fs.readFileSync(path.join(root,research,'diagnosis/coverage/FUNCTION-ANALYSIS.md'),'utf8');
const functions=[...spec.matchAll(/^### ((?:F|R)\d+) · (.+)\r?\n([\s\S]*?)(?=^### |^## |$(?![\s\S]))/gm)].map(m=>({id:m[1],name:m[2],body:m[3]}));
const range=(prefix,a,b)=>Array.from({length:b-a+1},(_,i)=>prefix+String(a+i).padStart(2,'0'));
const systems=[];
function add(id,domain,priority,phase,functionIds,problem,evidence,recommendation,keep,before,after,interfaces,files,steps,acceptance,dependencies,risks,tools,resourceIds,cost){
  systems.push({id,domain,priority,phase,problem,evidence:evidence.map(p=>research+'/'+p),recommendation,keep,architectureBefore:before,architectureAfter:after,interfacesAndState:interfaces,files,steps,acceptance,dependencies,risks,tools,resourceIds,scopeCost:cost,functionIds});
}
add('SYS-01','探索奖励与经济激励','P1','P1', ['F33'],
 '安全清空节点往返仍增加成功撤离XP。内存A/B多20步从20变60，其余即时资源相同；实际合法撤离并持久化获利尚未证明。',
 ['diagnosis/gameplay/REPORT.md','diagnosis/gameplay/probe.json'],
 '默认把探索XP绑定首次有效节点结算，行动步数继续用于统计；保留自由回头路。先明确有效结算名单，再修改一条奖励公式。',
 ['相邻移动与visited防重复奖励','四层地图与既有随机种子','行动数作为轨迹统计'],
 '移动统一累计turn；撤离命令用turn计算XP，移动计数和收益资格混在一起。',
 '在现有Run数据中区分行动数与已获得奖励资格；结算命令只读奖励资格。旧档采用保守迁移，不能凭历史turn补发经验。',
 ['拟议字段：rewardedNodeIds或等价已有节点标记；先查复用，不新增第二份节点真源','拟议computeExpeditionXp(summary)纯计算；extraction.commands仍是提交入口','统计action不因这次修复改变含义'],
 ['game/src/run/game.run.flow.js','game/src/hub/extraction.commands.js','game/src/hub/base-meta.commands.js'],
 ['列出战斗/搜寻/事件/火堆/空节点各自是否算有效冒险，给默认表','配对同seed同有效路线，分别加0/20次安全往返，确认差额来自turn','改奖励计算及旧档兼容；保留原移动功能','在合法出口完成A/B及重载实收对账'],
 ['安全往返不会额外赚XP','首次有效探索和战斗按拍板规则正常得XP','迁移前后不重复补发；回头路线仍合法','真实获利验收与内存实验分别留证'],
 [],['有效探索的定义属于玩法语义，D01需在实施公式前确认；当前默认不加饥饿/追兵','修改成长速度后需复核升级阈值，不直接批量调卡'],['T-VERIFY','T-VITEST','T-BROWSER'],['fp-sts-metrics','brogue-source'],'中：2–3个独立改动片，另加一次真实撤离验证；工期须实施前按归属排期');
add('SYS-02','结算真源与主图收束','P1','P1',['F51','F52','F53'],
 '首脑通关沿用通用撤离页；第五层错误实页已证。carried含初始牌，不能作真实入库；本局实际仓库2→22，净入20。',
 ['FINAL-ADDENDUM.md','diagnosis/coverage/FUNCTION-ANALYSIS.md'],
 '先修错误层数，再让结算产生一份真实回执，供结算页、跑局记录与Agent共同读取。clear强调击破首脑和关键收获，extract强调保本返回。',
 ['现有extraction/terminal命令及requestId幂等','撤离整理、逐收/全收、容量拒收和回基地入口','clear与extract的既有区分'],
 '携出候选、整理实际入库、通用结算UI和统计分别表达结果，字段名称容易混淆。',
 '在原命令提交成功处生成可恢复的SettlementReceipt；页面只展示回执，不重新推算收获；首脑、出口、整理、提交、回基地各保留独立状态。',
 ['拟议回执：runId/requestId/outcome、候选/拒收/损失原因/实入卡ID、币/XP净变化、warehouseBefore/After、persisted','carried保留兼容但明确candidate语义；新增stored而不静默重定义历史字段','clear只在主图终局命令完成后认定；bossKilled不等于回仓'],
 ['game/src/hub/extraction.commands.js','game/src/hub/terminal.commands.js','game/src/hub/game.bag.settle.js','game/src/run/game.run.altar.js','game/src/agent/agent.recorder.js'],
 ['先统一四层指引，补一张结果字段对照表','在既有提交点记录实入与损失，不用前后总数碰巧相同替代逐项账','结算页按clear/extract/death展示短收束与关键三项结果','复用辅助四层路径验证提交链，另补自然玩法验收'],
 ['候选初始牌不会进入真实实入统计','重复点击/刷新重试不重复给币牌XP','仓库旧量+净实入=刷新后仓库，逐卡与回执对应','首脑胜利到基地全过程明确且无第五层指引','调试辅助局仍带干预标记'],
 ['SYS-10'],['UI新增字段不能改变奖励概率','存档回执结构需版本兼容；不能把旧carried转成已实收入库','短叙事用现有世界观，不扩章节'],['T-VERIFY','T-VITEST','T-BROWSER'],['indie-cogmind','brogue-source','2048-reference'],'中大：3–4个改动片（回执、迁移/幂等、UI、记录消费）');
add('SYS-03','物资领取、消费与复原事务','P1','P2',[...range('F',34,38),...range('F',40,42),...range('F',47,49),'F54','F55','R10'],
 '系统已有容量与幂等保护；仍需把满包、取消、散落、复原、献祭和多箱结束语义逐一对账。辅助局Agent在满包多箱页停滞，但人工离开可收口，不等于玩家永久卡死。',
 ['diagnosis/coverage/FUNCTION-ANALYSIS.md','FINAL-ADDENDUM.md','diagnosis/gameplay/REPORT.md'],
 '把高价值资源动作的顺序写清：校验→玩家确认→提交→回执→画面更新；优先复用grant/command返回值，仅在重复且易错的叶节点抽公用帮助函数。',
 ['现有容量预检、grant失败留页、taken标记','全收放不下散落与三选一拒收语义','基地储备币与局内随身币分开'],
 '各场景已有不同授卡、扣费、consume、finish回调；差异大多是玩法语义，不能一律合并。',
 '保留场景控制器；让每个动作消费明确结果（成功/容量不足/取消/已处理/存储失败），据结果决定是否消费节点及进入下一箱。',
 ['拟议统一结果形状可放commands.shared，但不建设全局交易总线','picked/taken/queueIdx/visited由原属地写；UI与Agent读取相同合法动作','记录source=chest/shop/fire/altar以及金币账户种类'],
 ['game/src/run/chests.js','game/src/run/game.run.shop.js','game/src/run/game.run.scenes.js','game/src/run/game.run.altar.js','game/src/hub/commands.shared.js'],
 ['按79族现有分析列满包/钱不足/取消/重复点/存储失败的动作结果表','先复现多箱满包的Agent合法离开条件，不增加固定等待碰运气','对已发现不一致点最小修复；其余只留定向回归','对照普通用牌入袋、复原、献祭、死亡安全牌的完整财产轨迹'],
 ['失败和取消不误扣币牌、不误消费节点','同一requestId不重复领取','全收散落提示与实际结果一致','满包多箱既可由人离开，也能被Agent识别为可终止状态'],
 ['SYS-02','SYS-11'],['不是所有场景取消都保留节点；按现有设计逐项确认','先证实具体缺陷才动实现，不因边界多重写全部交易'],['T-VITEST','T-VERIFY','T-BROWSER'],['brogue-source','fp-gamedevbench'],'中大：按已证缺陷拆2–4片，未发现缺陷的分支仅验证');
add('SYS-04','撤离节奏与首脑编组选择','P2','P3',['F39','F50'],
 '成功出口从第三层才出现；四层辅助样本首脑编组14选14没有选留取舍。两者是设计风险，不足以证明整体节奏差或所有职业无构筑。',
 ['FINAL-ADDENDUM.md','diagnosis/gameplay/REPORT.md','library/DEEP-READS.md'],
 '默认维持四层和现有门槛；先观测首次想撤离、理解损耗、发现出口、编组放弃哪张。仅在目标问题成立后试一个变量。',
 ['四层邻接图、闸门配对与既有随机首脑计划','普通战弹药与首脑牌库分工','迷雾和未知收益，不把地图全剧透'],
 'map-generator/altar决定门槛，编组按现有可编牌与数量要求完成；已有规则可以支撑小实验。',
 '架构暂不改。若证据支持，优先把一个门槛变为现有配置中的显式参数，并由UI/Agent共读；不用新地图引擎或新模式。',
 ['实验记录：seed/职业/有效牌数/要求数/选择理由/求助点/结果','参数候选：编组数量范围或牌池投放；撤离候选：费用/提示/时机一次只选一个','D02、D03只在修改相应玩法语义前确认'],
 ['game/src/run/map-generator.js','game/src/run/game.run.altar.js','game/src/run/expedition.view.js','game/src/battle/core/battle.lifecycle.js'],
 ['复用四层辅助轨迹定位观察点；不当成自然平衡样本','先做三个风险/收益状态的预期与实际表','采一条自然失败或撤离路径及一个有冗余牌可选的编组样本','如仍无取舍，提交两种小方案与代价，再只实施一种'],
 ['区分看不懂、没有选择、数值压倒选择三种原因','未经辅助的样本完整标出帮助与耗时口径','方案改善目标问题且不改变未授权模式','明确实验不支持时保持现状'],
 ['SYS-01','SYS-02','SYS-06','SYS-11'],['不能用辅助耗时作为玩家局长','不默认降低层数、免费撤离或增加饥饿'],['T-BROWSER','T-AGENT'],['fp-riot-prototype','fp-xbox-user-research','indie-backpack-hero','fp-itb-postmortem'],'研究中、实现待定：先1份问题表+1–2条观察，规则方案另估');
add('SYS-05','基地成长、收藏与资源去向','P2','P3',range('F',11,24),
 '购买、出售、收藏、孵化、升级、扩建、复原和成就已有实现；目前缺少统一经济去向和逐项可达性证明，数量不等于长期目标成立。',
 ['diagnosis/coverage/FUNCTION-ANALYSIS.md','diagnosis/gameplay/inventory.json'],
 '先画清一张资源来源/消耗/上限表，明确每个按钮付出什么、永久得到什么；优先修真实账目或理解错配，再调节增长曲线。',
 ['Base命令门面与草稿保护','职业收藏消耗牌、熟练度、宠物成长等既有目标','现有收藏/成就/卡背/皮肤配置'],
 '基地多个页面消费Base/Meta命令，各系统各有前置、材料过滤与奖励。',
 '不建统一货币总引擎。复用Base快照为页面提供明确成本/收益视图；提交仍由现有领域命令管理。',
 ['成本预览与命令使用同一资格/过滤函数','储备币、随身币、碎片、钥匙、经验不可合成一个数值','成就/收藏领取使用原一次性标记并验证旧档'],
 ['game/src/hub/base.js','game/src/hub/base-progression.commands.js','game/src/hub/collection.commands.js','game/src/hub/game.hub.pages.js','game/src/hub/meta.js'],
 ['把14族动作列成成本/资格/结果/重复点击表','核最典型购买、出售、收藏和升级各一条闭环','只修已定位的回执/提示/资格错配','以修正后XP基线观察跨局目标，不先新增奖励数量'],
 ['所示成本=实际扣除，收益重载可见','不满足前提时原因明确且无资产变化','一次性奖励不可二领','每类成长至少有一条来源到用途的证据；未验项继续标记'],
 ['SYS-01','SYS-02','SYS-10'],['XP修正规则会影响观察基线','不能以6宠物/26成就等配置数量承诺内容完成'],['T-VITEST','T-BROWSER','T-DATA'],['fp-sts-metrics','indie-cogmind'],'中大：先经济表，再按发现拆小片；不一口气改全部成长');
add('SYS-06','出征整备与首次目标','P2','P2',['F10',...range('F',25,28)],
 '预设、目标追踪、人物/补给和小卡详情已存在；整备长描述阅读压力需要任务验证，不能写成没有详情或卡牌无法选择。',
 ['diagnosis/experience/REPORT.md','diagnosis/coverage/FUNCTION-ANALYSIS.md'],
 '让出征页清楚回答带什么、容量还剩多少、初始牌为何不能入库、本局准备达成什么；小卡保留关键摘要，大卡承担全文。',
 ['两套出征预设','showCardZoom详情入口','固定初始攻击和金色确认出发','当前模式预告与目标追踪'],
 '整备控制器组合小卡、详情、预设与出发命令；卡面层级已有，长文本可能挤压。',
 '复用共享卡牌渲染器增加用途明确的摘要槽；页面只管理选择状态，出发仍走preparation/Base departure命令。',
 ['拟议cardPresentation用途=prep/battle/detail，不让页面自造一套费用/描述规则','预设恢复必须重新检查当前仓库资格和容量','出发确认显示模式、携入和关键损耗承诺'],
 ['game/src/hub/game.hub.depart.js','game/src/hub/preparation.commands.js','game/src/hub/base-departure.commands.js','game/css/cards.css','game/css/card-v3.css'],
 ['选择一张长效果卡核小卡、可发现的详情和移入移出三步','统一费用/主效果/特殊限制的阅读顺序','对失效预设和不足容量给明确反馈','记录首次玩家能否预期初始牌与普通牌的去向'],
 ['当前窗口关键信息可读且详情完整','点击详情不会误改变选择','预设不会带入已失去的卡或突破容量','出发保存失败保持可恢复整备状态'],
 ['SYS-10','SYS-12'],['小卡不是全文容器，不以统一放大所有卡解决','玩法帮助不能抢占主选择区'],['T-BROWSER','T-VITEST'],['fp-itb-postmortem','nng-visual-hierarchy'],'中：2个片（信息摘要、失效预设/出发反馈）');
add('SYS-07','事件与主图叙事投放','P2','P3',range('F',43,46),
 '普通事件和跨局最后一盏灯有真实推进与恢复逻辑；主图章节收束缺少专属表达，研究所演出不能替代。',
 ['diagnosis/gameplay/REPORT.md','diagnosis/coverage/FUNCTION-ANALYSIS.md','library/indie-games/DEEP-CASES.md'],
 '先补主图首脑胜利的一段短收束，再审查事件选择的代价/结果。继续用既有叙事编译与story命令，不迁移新叙事框架。',
 ['最后一盏灯分run推进、二选一与纪念物','现有Ink依赖和narrative:compile入口','事件历史与已提交保护'],
 '叙事运行与story.commands已有；事件节点负责接入，主图结算沿通用撤离。',
 '内容源→现有编译产物→事件/故事命令→结果视图；短终局读取SYS-02回执，剧情不得自己增发经济奖励。',
 ['叙事选择ID稳定，保存提交与奖励requestId一致','编译产物只由编译脚本生成','主图短收束按clear/extract/death选择文本；跨局剧情保持独立进度'],
 ['game/src/home/story.last-lamp.js','game/src/home/story.commands.js','game/src/home/narrative.js','scripts/compile-narrative.mjs','game/src/run/game.run.flow.js'],
 ['为已存在事件列触发/代价/结果/一次性标记','写一版短首脑收束，核世界观和已发生事实','先验取消与提交失败恢复，再补最缺的一条事件反馈','评估跨局出现频率，没证据不加剧情量'],
 ['剧情显示与实际已完成目标一致','重开不重复奖也不跳过未完成选择','明确标注跨局故事尚未全量自然验证','内容编译与规则检查通过'],
 ['SYS-02','SYS-10'],['新世界观方向需D04，已有章程短收束不必再发明大型结局','作者/游戏参考不能直接改写其版权文本'],['T-NARRATIVE','T-VITEST','T-BROWSER'],['inkjs','indie-citizen-sleeper','indie-cultist-simulator'],'中：短收束1片、事件链一致性1–2片；新章节另立范围');
add('SYS-08','战斗规则与牌效消费者','P1','P2',[...range('F',56,60),...range('R',1,9),'R11'],
 '普通战点击闭环已证，牌效族覆盖仅静态；随机/条件预览会降级unknown。复杂牌效需要沿真实消费者对账，不能按卡数或文件大小认定质量。',
 ['diagnosis/coverage/FUNCTION-ANALYSIS.md','diagnosis/experience/REPORT.md'],
 '每次只选一条有误差或拟修改的规则链，核触发→实际计算→状态改变→预览→反馈；让预览调用同一纯计算或明确unknown，不复制第二套战斗逻辑。',
 ['battle core/bag/ui分层','普通战随身牌与首脑抽弃牌分工','既有牌效注册表、结构预检与unknown降级','背包砸击兜底'],
 '注册牌效进入battle engine，视图显示意图与部分预览；执行、呈现和特殊规则间存在需要定向追踪的接口。',
 '只在具体职责冲突处抽取无副作用计算/小型结果对象，保留现有执行门面；不重写整引擎，不引入全局事件总线。',
 ['拟议ResolutionResult只表达该动作实际目标/数值/状态变化；先复用现有返回数据','预览标注known/unknown及原因，不展示无依据的精确值','状态时长与回合推进仍由原执行阶段拥有；动画不得推进规则'],
 ['game/src/battle/core/battle.engine.js','game/src/battle/core/battle.lifecycle.js','game/src/battle/ui/battle.preview.js','game/src/cards/card-rules.schema.js'],
 ['从11规则族选修改相关场景，避免全组合穷举','建立伤害/护甲/多段/击杀/随机条件的输入输出表','修实际错配并补有区分力的边界测试','在当前窗口核一张牌的预览、点击、损血、状态、声效链'],
 ['支持的预览与实际一致；不支持的准确标unknown','取消/无效目标不耗牌费','多段、死亡与回合末顺序符合规则','普通与首脑牌去向未混淆，衍生/职业例外保持'],
 ['SYS-03','SYS-09'],['只有发现耦合才拆模块；不按1409行或strict清单比例计划重写','随机测试固定seed并记录输入'],['T-VITEST','T-DATA','T-VERIFY','T-BROWSER'],['fp-itb-postmortem','fp-sts-metrics','fp-gamedevbench'],'中大：按缺陷/变更逐规则族切片，不承诺一次验完全部组合');
add('SYS-09','战斗信息、动作时序与反馈','P2','P2',['F56','F58','F61','F62'],
 '敌方意图、伤害预览、震动顿帧和击杀机制已有；自然动作动态与试听未全验，手牌重叠不等于不能操作。',
 ['diagnosis/experience/REPORT.md','diagnosis/visual-comparators/COMPARATORS.md'],
 '保住玩家读意图和选目标的时间；把规则完成、命中表现、声音和解除输入锁的顺序对齐。先验一条代表动作，再改相关层。',
 ['calculateEnemyIntent实际计算','减少动态/震动选项与2×节奏','现有Motion与VFX模块','点击/拖拽/键盘输入设计'],
 '规则层、lifecycle、VFX、卡牌层与输入各自有职责；时序需要围绕具体动作验证。',
 '继续使用现有局部动作序列和Motion；用该动作的结果驱动数字/命中/声音，不让CSS时长或固定延时决定游戏状态。',
 ['动作相关的完成/取消信号必须在快进、减少动态、切页时收尾','命中cue与真实伤害消费点关联；普通hit与元素cue避免重复叠播','战斗撤离明确判负，确认后交给现有终局命令'],
 ['game/src/battle/ui/battle.layers.js','game/src/battle/ui/battle.vfx.js','game/src/core/motion.js','game/src/battle/core/battle.lifecycle.js'],
 ['同一当前窗口记录选择→目标→命中→数字→敌方阶段的一条动作','核一击杀、一次多段和一次取消的先后顺序','修已证挡信息/输入锁/反馈时机问题','在同窗口切现有节奏和减少动态复核，不主动改变尺寸'],
 ['动作表现不遮关键意图或可选目标','输入锁可正常解除；取消/离场不遗留效果','减少动态不破坏规则结果','有真实输入与帧/听感证据；无试听时明确未验'],
 ['SYS-08','SYS-12','SYS-14'],['不要用更强震动掩盖结果不清','不能从截图推断动画时长和性能'],['T-BROWSER','T-VITEST','T-AUDIO'],['fp-itb-postmortem','indie-cogmind'],'中：一条标杆动作1片，再按同类机制有限扩展');
add('SYS-10','存档、失败提示与恢复','P1','P1',['F01','F03','F08','F53'],
 'Base/Run分储与兼容persisted:false存在设计风险；已有草稿/journal/幂等保护。已证开战检查点重开与撤离回基地刷新持久化，不等于所有故障安全，也未证玩家丢档。',
 ['diagnosis/engineering/REPORT.md','FINAL-ADDENDUM.md'],
 '先在可丢弃档故障注入定位实际部分失败；补调用方提示和重试，再根据缺陷决定跨键协调。默认保留当前存储，不立刻迁移IndexedDB。',
 ['Base/Run边界、草稿提交、journal/requestId','档位隔离、版本迁移、现有检查点策略','既有recovery命令门面'],
 'Base与Run分开持久化；出发先Base后Run，部分兼容支路内存前进而返回persisted:false。',
 '在既有恢复协调点明确preparing/committed/needsRecovery含义（若现有状态可承载则复用）；所有调用方对persisted:false给可恢复反馈。只有故障实证需要才扩journal覆盖。',
 ['命令结果区分操作拒绝、提交成功、内存成功未持久化','出征/撤离/死亡跨键事务采用同一操作ID并记录恢复进度','不承诺逐回合恢复；UI明确现有开战检查点含义'],
 ['game/src/hub/base.js','game/src/hub/game.storage.js','game/src/core/storage.js','game/src/hub/recovery.commands.js','game/src/hub/base-departure.commands.js'],
 ['枚举出发、战斗结算、撤离、死亡、pet egg/elapsed的持久化返回消费者','用存储适配器注入一次写失败/半途刷新/重复重试','只修观察到的遗漏提示或不可恢复状态','验证旧档读取及对应恢复路径，登记未覆盖故障'],
 ['失败时玩家知道未保存且可重试/恢复','同一操作重试不重复扣资产或发奖','Base/Run/journal最终相容','已有旧档与检查点行为不无意改变'],
 [],['不能因设计风险宣传已丢档','D05仅在实际问题要求存储引擎迁移或逐回合恢复时才需拍板'],['T-VITEST','T-VERIFY','T-BROWSER'],['idb','dexie','2048-reference'],'中大：故障表1片、按实际缺陷1–3片；换存储是另案');
add('SYS-11','Agent真源、干预履历与停止条件','P1','P1',['F06','F63','F37'],
 '辅助局driver=human掩盖调试，carried混入初始卡；策略战利品页spin仍存在，120ms等待没消除。旧r24无provenance，不能当当前平衡结果。',
 ['FINAL-ADDENDUM.md','diagnosis/engineering/REPORT.md'],
 '先让记录诚实再谈策略优劣：驱动、调试干预、源码/数据/seed、初始资源、动作轨迹、终止原因都随局保存。合法动作来自现有场景真源，收益来自结算回执。',
 ['SDT.Agent结构化观察/动作接口','现有runner/recorder/protocol/state边界','真人接力能力与固定种子实验'],
 '已有Agent表面和策略跑局，记录driver粗粒度、carry候选与实收混淆；自动循环未充分识别无进展。',
 '在recorder追加时间有序的controlSegments/interventions；runner依据场景身份+可用动作+实际状态变化判断进展。保持协议门面，不另造模拟游戏状态。',
 ['provenance：source/data指纹、seed、起始资源、策略/模型配置、UI探测范围','interventions：时间/动作/调试类型/影响；含任何胜利调试即assisted','收益消费SettlementReceipt；candidate与stored字段分开','noProgress保存最后动作与状态差异并暂停诊断，禁止循环自称完成'],
 ['game/src/agent/agent.recorder.js','game/src/agent/agent.runner.js','game/src/agent/agent.state.js','game/src/agent/agent.protocol.js','game/src/agent/agent.scenes.js','game/src/agent/agent.stats.js'],
 ['把已知辅助四层作为反例校验记录规则','接SYS-02回执，给旧无来源数据unknown标签','用多箱满包场景核合法leave与状态变化','固定相同seed/职业/资源做配对策略比较，真人另验理解与玩法'],
 ['任何调试胜利都无法被标成纯真人或纯策略样本','每个结果可追到准确输入与终止原因','无进展可诊断退出，不无限spin也不假clear','agent收益与真实入库对得上；UI探测关闭不能宣称视觉通过'],
 ['SYS-02'],['不撤销不同场景的旧PENDING #26','Agent胜率不等于好玩；干预旧数据不能逆推补全'],['T-AGENT','T-VITEST','T-VERIFY'],['fp-gamedevbench','fp-sts-metrics'],'中：3片（履历、回执消费、停滞诊断）');
add('SYS-12','共享界面结构与信息层级','P1','P2',['F02','F09','F29','F30','F65'],
 '搜刮页口袋条盖标题是已证问题；地图资源前景和金色主动作有价值。110基本界面+55变体不适合每页各造一套样式。',
 ['diagnosis/experience/REPORT.md','COVERAGE-REPORT.md'],
 '先立一个轻量场景布局约定：顶部状态、标题、主内容、主动作各有位置。优先改供给与整备的共享容器，保留地图条和照片收藏的纸质语义。',
 ['原生JS/Vite、现有overlay及卡牌门面','冷青深底、金色主操作、费用/伤害/币值语法','照相馆暖纸风格与地图合法路线提示'],
 'pocket-strip固定top/z-index按runActive显隐，未按遮罩场景留空间；多处卡牌/面板CSS叠加。',
 '在overlay或既有场景上下文声明hudMode/safeArea，再由pocket-strip和容器响应；只抽真实重复的标题/动作/空态，避免新组件框架。',
 ['拟议scene layout：map=保留完整HUD，modal=让位或紧凑，不凭URL猜场景','卡牌显示共享用途参数；内容数据不复制到CSS/模板','交互状态：默认/可选/已选/禁用/忙碌/错误使用同一含义'],
 ['game/src/ui/overlay.js','game/src/run/pocket-strip.js','game/css/pocket-strip.css','game/css/cards.css','game/css/card-v3.css'],
 ['修供给页安全区并回地图复核条仍可见','为整备/战斗/详情确定卡牌信息层次','以界面库存分组处理共用容器，页级差异保留','仅当前窗口复核标题、焦点、主动作、返回与空态'],
 ['供给标题完整，三卡仍可领，地图资源前景仍可读','没有新增覆盖点击/焦点问题','相同交互状态跨页含义一致','不将UI结构一致误等同所有插画都重画'],
 [],['不同页面语义需保留，照片馆不强行改成战斗风','美术风格定稿与功能可读性分别验'],['T-BROWSER','T-VITEST'],['nng-visual-hierarchy','wcag-use-of-color','wcag-contrast-minimum','game-icons-net-risk-extraction-inventory'],'中大：先1片已证遮挡，再按组件组2–3片，不逐页重写');
add('SYS-13','美术组件、映射与生成管线','P2','P2',['F22','F24','F30','F66'],
 '现有冬境立绘与卡面语法成立，但素材映射/来源授权仍有历史债。旧5336服务退出造成破图，已修复37测试/32图片通过，不能当成所有美术差的证据。',
 ['diagnosis/experience/REPORT.md','server-repair/README.md','library/README.md'],
 '美术按角色/卡牌/场景/图标四类建锚点和变体；优先校正映射、裁切和信息语义，只针对已选缺口补图。沿用NovelAI当前脚本与人物圣经。',
 ['现有Art/asset-url与生成manifest入口','卡牌职业框/稀有度/费用语法','既有图片可用资产与角色身份','老板审美认可与技术验收分开'],
 '运行时Art门面、清单、生成记录及历史未登记资产并存；映射和来源记录需要逐项可追踪。',
 '资产ID→来源/许可/变体/用途→运行时URL，先复用asset-manifest字段；组件只请求语义ID并采用明确裁切，不硬编码多份路径。',
 ['设计锚点：角色一致性、光色、材质、卡面主体安全区、稀有度不靠颜色独占','新生成记录：中文意图、实际模型/seed/参考来源、产物SHA、授权状态','不得手改generated清单或cards-sync；用现有生成/同步入口'],
 ['game/src/core/art.js','game/src/core/asset-url.js','game/assets/asset-manifest.json','scripts/asset-audit.cjs','tools/nai_gen.py','tools/nai_style.py','docs/character-bible'],
 ['从一角色、一场景、一卡牌详情选现有锚点，做保留/修裁切/补图清单','先运行资产增量审计及URL健康，再判断视觉问题','按现有生成流程小批草图、内部比对、老板审美确认后扩同类','补登记并验证实际消费者，不以磁盘有图算接入'],
 ['每个本次改动资源可追到实际文件/来源/许可状态/SHA','当前窗口主体和文字不抢焦点，人物身份稳定','新增资产不得扩大冻结历史债','已有服务故障与素材质量分开归因'],
 ['SYS-12','SYS-15'],['已有授权文本未等于授权真实性核验；未登记资产不能声明可商用','NovelAI调用凭据/额度未核，本计划不调用付费服务','不整体套Kenney UI风格'],['T-ASSET','T-NAI','T-BROWSER'],['local-art-pipeline','game-icons-net-risk-extraction-inventory','kenney-ui-pack'],'中大：先小样1片；批量工作按确认缺口数量另估，不按271/272全重画');
add('SYS-14','声音cue注册、声景与播放时序','P1','P2',['F07','F65'],
 '20种字面cue在现行运行表缺失（23调用点），另有动态cue；scene?.钩子无公开API。通用click/hit/BGM已有，107文件不证明接线与听感。',
 ['diagnosis/experience/REPORT.md','diagnosis/experience/dispatch-probe.json'],
 '以现有Sound作为唯一门面，把样本库/合成/声景注册对齐，先接已有声音再决定新增。定义场景进入退出和命中时序，并保留音量/静音偏好。',
 ['Howler、既有SampleSfxBank/合成音与WinterSoundscape','Sound.sfx/music偏好接口','通用点击与已接战斗音','现有真实输入音频解锁策略'],
 'Sound运行注册来源与sound.bank库存分离；overlay调用scene可选链被静默跳过。',
 '一个cue目录解析为样本/合成/明确别名；Sound.scene要么实现映射到既有声景层，要么调用方改用正式现有API，不保留假接线。',
 ['cue字段：用途/触发点/播放源/音量分组/并发或冷却/降级规则','未知cue开发环境可诊断，正式版允许受控回退但不掩盖验收失败','场景声景进入/退出不能覆盖战斗模式；命中声音随实际命中'],
 ['game/src/audio/sound.js','game/src/audio/sound.bank.js','game/src/audio/sound.scape.js','game/src/audio/sound.policy.js','game/src/ui/overlay.js','game/src/battle/ui/battle.vfx.js'],
 ['对账字面+动态cue+scene所有消费者与唯一注册表','为整备/出发/搜寻/交易/战斗/撤离选关键短声，先用现有库','契约测试验证命中注册；实际正常点击后试听音量、重复和时机','分别核音乐关闭、音效关闭、解锁失败与场景离开'],
 ['关键cue注册命中且实际可听，未试听项保留未验','scene进入退出有对应行为，optional chaining不冒充实现','音量/静音和浏览器解锁正常','同一动作不重复轰鸣；听感不是文件数或探针通过可代替'],
 ['SYS-09','SYS-12'],['素材许可合格仍需听感筛选','不先引入音频中间件或购买大包'],['T-AUDIO','T-VITEST','T-BROWSER'],['howler','jsfxr','kenney-interface-sounds','mdn-autoplay','indie-cogmind'],'中：入口/目录1片，接线1片，试听调节1片');
add('SYS-15','运行服务与资源健康','P1','P0',[],
 '旧服务PID退出导致破图已完成修复；需要延续工作目录/端口/PID身份与URL验证，不能把已修问题重新排成美术返工。',
 ['server-repair/README.md','server-repair/verification.json','server-repair/browser-images.json'],
 '将现有web-up和资源探测作为实页验收前置，保留修复证据；只在输入或服务身份变化后复核。',
 ['scripts/web-up.mjs现有入口','主线5200/隔离53xx/产物8139约定','服务身份校验与只清理本会话服务'],
 'Vite开发服务与当前浏览器资源请求由现有脚本管理；此次旧进程退出属于运行环境故障。',
 '继续同一架构；验收记录把source-root/port/PID/startTime与图片请求结果绑定，不新增后台守护服务。',
 ['健康结果区分网络失败/HTTP错误/解码失败/映射缺失','页面来源与实际服务工作目录相符','服务退出后不得沿用旧健康证据'],
 ['scripts/web-up.mjs','scripts/asset-audit.cjs'],
 ['复用此次37测试/32图结果，写明边界','下一轮需要实页时确认服务身份与关键资源','故障先分运行/路径/解码/视觉质量再派修','收官仅处理本会话创建且身份确认的进程'],
 ['当前窗口来自目标工作区，关键图片实际加载','不会误杀无主进程或切外部浏览器','健康通过不被写成全美术质量通过'],
 [],['现有修复已完成，不重复实施或重跑全量','本工作包以复用和防复发证据为主'],['T-WEB','T-ASSET','T-BROWSER'],['vite-features'],'小：已修复；下轮只需定向健康核对，异常再估');
add('SYS-16','QA、规则文档与交付证据','P1','P0',[],
 '249源码输入基线已复核；79功能族/165界面条目是盘点，不是全部行为通过。规则配额旧文案和历史测试来源需防漂移。',
 ['verification.json','COVERAGE-REPORT.md','diagnosis/engineering/REPORT.md'],
 '用现有workflow verify和质量门按工作包留证；每个结论注明源码/实验/实页/试听/玩家观察哪一种。文档跟真源更新，不另建强制总账。',
 ['现有handoff、归属登记、quality-gates与receipt','源码/数据指纹和定向测试','既有依赖方向守卫与渐进类型检查'],
 '统一流程已有；历史来源、当前输入与验证级别容易在汇总中混用。',
 '在本次交付包中把工作包→目标文件→验收→证据路径串起来；长期现行状态仍归项目docs原属地，研究表不替代它。',
 ['证据至少含version/input fingerprint、执行时间、工具/来源、真实输入范围、结果、未核项','规则摘要从map/card过滤真源生成或人工核对，不改cards-sync','严格类型只扩本次有风险的边界，不追文件比例'],
 ['scripts/workflow.mjs','scripts/acceptance-gate.mjs','scripts/check-types.mjs','scripts/validate-data.mjs','docs/quality-gates.md','docs/rules.md'],
 ['为每个实施片选择最小有效验收，不默认全量build','共享树先核归属；源码变更后旧输入证据失效部分重验','同步本次涉及规则文案与当前入口','最终报告分改动/已验/未验，不以测试数给完成率'],
 ['每个已交付结论可回溯准确输入与证据','混树不覆盖、不构建或提交他人未授权改动','未测试当前树不写通过；全量和远端CI范围明确','有意义验收先于扩面'],
 [],['流程改造先量真实任务成本，不能按文档页数认定低效','本计划不新增流程强制规则'],['T-VERIFY','T-VITEST','T-DATA'],['fp-gamedevbench','fp-xbox-user-research'],'小中：贯穿各片，主要复用现有流程；不单开重做工具工程');
add('SYS-17','内容编辑、导入与规则一致性','P2','P3',['F31','F32','F67','F68'],
 '卡牌编辑/导入导出与节点备注是已有作者工具；运行卡库有259原始切片、272迁移新库、历史UI271口径差异，尚未追单张原因。',
 ['diagnosis/coverage/FUNCTION-ANALYSIS.md','diagnosis/gameplay/REPORT.md'],
 '先让编辑结果通过现有schema与真实加载链，导入前给校验/冲突结果；只定位272/271差异，不拿数量当完成率。',
 ['现有卡库与规则schema','导入导出和取消入口','节点备注独立于游戏生成规则'],
 '作者界面、导入数据、迁移补种与运行过滤是不同步骤；全部条目与普通随机池不是同一集合。',
 '保持现有链条，明确source→validate→migrate→filter→runtime的责任；编辑器反馈复用验证结果，生成物不人工二次编辑。',
 ['导入结果：accepted/rejected/conflict/warnings；提交前保留旧数据','稳定ID和版本迁移，不按显示名称判断同一卡','备注导入仅更新备注范围，不隐式改地图规则'],
 ['game/src/cards/card-rules.schema.js','game/src/cards/cards.rules.js','scripts/validate-data.mjs','scripts/sync-cards-from-live.mjs'],
 ['用当前库比对原始/迁移/UI过滤三个口径','核非法规则、重复ID、未知资源、取消导入的非破坏性结果','只补缺少的错误反馈/校验消费','同步图鉴/帮助采用同一运行口径'],
 ['导入失败不破坏现有库，导出再导入语义可对账','禁用/未实现规则不伪装可用','卡库数量差异有来源解释或明确未核','cards-sync无手工编辑'],
 ['SYS-08','SYS-13'],['内容工具入口存在不代表所有玩家需看开发细节','本计划不执行导入、删除或批量迁移'],['T-DATA','T-VITEST'],['fp-sts-metrics'],'中：口径核对与校验消费1–2片');
add('SYS-18','反馈、留言与玩家研究入口','P3','P3',['F04','F05'],
 '留言/反馈入口存在；价值在能定位具体预期错配，不能靠满意度或熟人赞同证明好玩。',
 ['diagnosis/coverage/FUNCTION-ANALYSIS.md','library/DEEP-READS.md'],
 '保留轻量入口，反馈自动附场景/版本/当前动作上下文并让玩家写预期和实际；外发、招募和录制按明确授权另行处理。',
 ['现有本地留言阅读/导出/删除','右键反馈入口','普通玩家无需阅读工程日志'],
 '反馈与游戏日志是现有独立入口；观察研究目前需要把问题和证据明确对应。',
 '先整理现有反馈数据结构；只有缺少定位信息时补局部上下文，不建账号、后台或遥测平台。',
 ['拟议context：版本/场景/操作/预期/实际；不默认收凭据或个人信息','导出与删除需保留现有显式动作','研究记录观察与解释分栏'],
 ['game/src'],
 ['按覆盖表定位留言/反馈具体属地再编辑','试一个不诱导任务，记录误点、求助、预期差','检查本地导出可读、取消和删除语义明确','用真实问题驱动待办，不自动扩采样'],
 ['反馈能定位场景和期望，玩家不被迫填长表','导出内容不泄露秘密','未执行研究不写成玩家认可'],
 ['SYS-16'],['无外发授权不发消息/数据','具体实现文件须实施前按F04/F05定位，目录项不是整域修改许可'],['T-BROWSER','T-VERIFY'],['fp-xbox-user-research','fp-riot-prototype'],'小：优先现有数据复用；确缺上下文时1片');
add('SYS-19','研究所边界与冻结平台','保留','P4',['F64'],
 '研究所已有独立规则和结局，但章程明确本轮主图完整版本验收不包含它；Godot/Unity/EXE冻结。',
 ['diagnosis/gameplay/REPORT.md','diagnosis/coverage/FUNCTION-ANALYSIS.md'],
 '列明边界并维持已有入口，不扩玩法、演出或引擎；共享依赖变更只验是否误伤。',
 ['研究所独立规则与结局','Vite唯一开发平台','当前章程范围'],
 '研究所是独立系统，主图结局需求不能由它的playLabEnding抵扣。',
 '不改架构；主图与研究所通过既有入口保持边界。',
 ['共享音频/存储/卡牌变更时仅验兼容接口','不把研究所通关混作主图clear'],
 ['game/src/run/game.nest.js'],
 ['在验收清单标范围外','共享接口变更若触及研究所，跑相应已有定向回归','新增研究所需求进入后续路线图，另行授权'],
 ['主图验收不借研究所证据','冻结平台不产生实现工作','共享依赖没有已知回归'],
 [],['范围外不代表删除入口或清理代码；删除必须明确授权'],['T-VITEST'],[],'本轮不实施；仅兼容回归');

const benefits={
 'SYS-01':'玩家因有效冒险成长，安全绕路不会成为最优升级方式；正常回头搜路仍保留。',
 'SYS-02':'玩家一眼知道是保本撤离还是击破首脑，以及真正带回和失去了什么；团队也能逐项对账。',
 'SYS-03':'满包、取消、买卖、献祭和复原的结果可预期；不会因为页面或代理误判把已领/未领搞混。',
 'SYS-04':'用自然选择证明撤离与编组是否有意义，避免花时间改动其实有效的玩法。',
 'SYS-05':'玩家能看懂资源该花在哪里、能换来什么长期目标；升级和收藏不会只剩菜单数字。',
 'SYS-06':'出发前更容易选对牌、理解容量和损耗，失效预设不会造成困惑。',
 'SYS-07':'首脑胜利有属于本次远征的收束，事件选择有清楚的代价与结果，跨局故事能可靠续接。',
 'SYS-08':'牌面承诺、预览和实际伤害/状态一致；复杂牌效出问题时更容易定位到具体规则。',
 'SYS-09':'玩家看得清敌方意图、确认自己的命中与击杀，快进或减少动态也不会卡住操作。',
 'SYS-10':'保存失败会明确提示并可恢复，重试不会重复扣牌发奖；玩家知道实际检查点在哪里。',
 'SYS-11':'每局成绩能区分真人、策略和辅助干预，代理停住时能说明原因；策略比较更可信。',
 'SYS-12':'标题、卡牌、状态和主按钮不互相抢位置，相同动作跨页更容易辨认。',
 'SYS-13':'角色、卡牌和场景在共同视觉语言下可辨认；改图可追溯来源，减少错映射和无效重画。',
 'SYS-14':'出发、搜寻、命中和撤离有准确且不过量的声音回应，静音与场景切换行为可靠。',
 'SYS-15':'验收先确认页面和图片真的来自正确服务，避免把服务失效当作设计缺陷返工。',
 'SYS-16':'老板能清楚看到哪些已改、验到什么、还有什么未核；接手者不用重做有效验证。',
 'SYS-17':'内容作者能在导入前看见错误与冲突，编辑后的卡能按实际运行规则被正确使用。',
 'SYS-18':'玩家反馈更容易定位和复现，团队能从真实理解障碍选择下一步改进。',
 'SYS-19':'主图制作保持聚焦，研究所和冻结平台不会悄悄扩成另一轮开发。'
};
const fileCorrections={
 'game/src/battle/ui/battle.preview.js':'game/src/battle/view/battle.preview.js',
 'game/src/battle/ui/battle.layers.js':'game/src/battle/view/battle.layers.js',
 'game/src/battle/ui/battle.vfx.js':'game/src/battle/view/battle.vfx.js',
 'game/src/run/pocket-strip.js':'game/src/experience/pocket-strip.js'
};
for(const s of systems){s.phase=s.phase.replace(/^P/,'PH');s.benefit=benefits[s.id];s.files=s.files.map(f=>fileCorrections[f]||f);}
systems.find(s=>s.id==='SYS-18').files=['game/src/ui/game.menu.js'];
systems.find(s=>s.id==='SYS-18').steps[0]='核现有反馈上下文字段及保存回读证据，缺什么才补什么';
systems.find(s=>s.id==='SYS-18').risks[1]='现有复现/期望/实际字段已经存在；不得为计划再次发明同类表单';
systems.find(s=>s.id==='SYS-08').dependencies=['SYS-03'];
systems.find(s=>s.id==='SYS-14').dependencies=['SYS-12'];
for(const s of systems)s.coordination=[];
systems.find(s=>s.id==='SYS-08').coordination=['SYS-09：规则结果与呈现对齐，但规则修复不等待表现完成'];
systems.find(s=>s.id==='SYS-09').coordination=['SYS-08：核对真实结果','SYS-14：命中和场景声音时序联合验收'];
systems.find(s=>s.id==='SYS-14').coordination=['SYS-09：注册入口可先做，实际命中时序联验'];
const ammo=systems.find(s=>s.id==='SYS-03');
ammo.problem+=' 健康实图补证：消耗教程两列都用初始攻击图片，却分别说明普通卡入袋和初始攻击消散，图文歧义已确认。';
ammo.evidence.push(research+'/diagnosis/interface-captures/AMMO-TUTORIAL-healthy.jpg');
ammo.steps.push('教程两列改用符合规则的普通卡与初始攻击示例，并给明确身份标签；不改真实消耗规则');
ammo.acceptance.push('玩家能据教程区分普通卡进入消耗袋与初始攻击消散，图示和实际结果一致');
const recovery=systems.find(s=>s.id==='SYS-10');
recovery.problem+=' TERMINAL-RETRY健康截图是向公开renderer注入terminalCommands:null的渲染夹具，只证明技术错误文案；不证明真实保存失败或原档安全。';
recovery.evidence.push(research+'/diagnosis/interface-captures/TERMINAL-RETRY-healthy.jpg');
recovery.steps.push('错误页解释当前已确认的保存状态和安全下一步；只有命令/故障证据确认原档保留才这样承诺，不加随意关闭绕过pending提交');
recovery.acceptance.push('恢复页文案不超出实际保存保证，重试/回退不绕过未完成终局提交');
const ui=systems.find(s=>s.id==='SYS-12');
ui.problem+=' NOTES-CLEAR健康实图中危险确认仍是最亮金色，默认焦点取消是现有保护；需把危险动作与普通推进视觉区分。';
ui.evidence.push(research+'/diagnosis/interface-captures/NOTES-CLEAR-healthy.jpg');
ui.steps.push('危险确认采用清楚的风险标签与克制强调，保留默认取消及二次确认，不为统一金色按钮削弱保护');
ui.acceptance.push('危险清空动作不会因最亮主按钮误导点击，默认取消保护仍有效');
const phases=[
 {id:'P0',name:'先固定事实与验证入口',exit:'复用服务修复与源码基线；每片有归属、输入指纹和验收范围',systemIds:['SYS-15','SYS-16']},
 {id:'P1',name:'先把收益、结算、恢复和实验记录做实',exit:'XP规则明确；实入回执可追溯；故障可恢复；辅助局不会冒充纯真人',systemIds:['SYS-01','SYS-02','SYS-10','SYS-11']},
 {id:'P2',name:'把最常用的一趟体验接顺',exit:'领取与战斗事实一致；标题不被遮；卡牌可读；关键cue可听；小批美术映射正确',systemIds:['SYS-03','SYS-06','SYS-08','SYS-09','SYS-12','SYS-13','SYS-14']},
 {id:'P3',name:'再用真实旅程决定玩法与内容投入',exit:'自然路径与目标玩家观察支持调整，增长/事件/编组各有明确问题和最小改变量',systemIds:['SYS-04','SYS-05','SYS-07','SYS-17','SYS-18']},
 {id:'P4',name:'保留范围边界',exit:'研究所仅兼容，冻结平台不动',systemIds:['SYS-19']}
].map(p=>({...p,id:p.id.replace(/^P/,'PH')}));
const decisions=[
 {id:'D01',topic:'经验奖励资格',defaultRecommendation:'首次有效节点结算给探索XP，战斗/终局奖励保持独立，安全往返只记行动',whenNeeded:'SYS-01动公式前',question:'哪些节点算有效冒险、失败局是否给其中一部分？',notBlocking:'不阻塞回执、存档、UI和证据分析'},
 {id:'D02',topic:'首次兑现战利品的时机',defaultRecommendation:'先维持三层撤离，先改善风险/出口信息并观察自然路径',whenNeeded:'只有证据支持移动出口/改费用时',question:'要更早保本还是保留深入门槛？',notBlocking:'不阻塞已证错误修复'},
 {id:'D03',topic:'首脑编组是否必须有选留',defaultRecommendation:'先保证可编牌与要求存在有意义余量，再评估数量范围；不凭14选14单样本直接调低门槛',whenNeeded:'SYS-04原型确认无选择且要改规则时',question:'首脑编组目标是精简构筑还是携入总战力检查？',notBlocking:'先采第二类样本和选择理由'},
 {id:'D04',topic:'视觉/主图收束方向',defaultRecommendation:'延续冬境厚涂、冷青深底与金色主操作；主图先补短胜利回顾',whenNeeded:'定稿新增大图或新增世界观/长演出前',question:'小样审美认可与新剧情语义单独确认',notBlocking:'安全区、映射、错误层数与现有目标短收束可先制定'},
 {id:'D05',topic:'恢复承诺或存储迁移',defaultRecommendation:'保留开战检查点和当前存储，先修真实故障',whenNeeded:'要承诺逐回合恢复/跨设备或实际故障要求换存储时',question:'新增恢复粒度和迁移成本是否值得？',notBlocking:'故障注入与persisted:false消费者核对先行'}
];
const evidenceLimits=[
 '本目录是改造建议和工作包，不是实施授权；未改游戏、build、安装、提交或操作浏览器。',
 '源码249项基线由主会话已核；使用当前研究证据，旧报告未核状态以FINAL-ADDENDUM与server-repair更新。',
 '四层辅助流程使用10次普通战+1次首脑胜利调试；driver human不等于纯人局，不作平衡样本。',
 '仓库实际2→22、净入20；carried含初始牌，不作实收。XP20→60仅内存A/B，真实完整获利未证。',
 '终局通用撤离页与第五层错误已实页；服务退出破图已修，37测试/32图结果不能推所有美术完成。',
 '只在当前平台内置浏览器、当前窗口验证；无工具时记阻塞，不换外部浏览器。声音听感、所有内容可达与无辅助四层平衡仍未核。',
 '范围估计是相对改动片数，非人日承诺、完成百分比或发行日期；按实际缺陷再估。'
];
const catalog=read('library/catalog.json');
const indie=read('library/indie-games/records.json').records;
const selected=new Set(systems.flatMap(s=>s.resourceIds));
const resources=[];
for(const r of catalog.filter(r=>selected.has(r.id))){
 resources.push({id:r.id,name:r.title,type:r.category,url:r.url,localEntry:r.localFiles?.length?r.localFiles.map(p=>research+'/library/'+p):[research+'/library/catalog.json'],license:r.license,use:r.projectFit,limits:r.limitations,ownership:r.localFiles?.length?'已拥有所列本地文件；不等于已安装/集成':'仅本地索引与摘要；未下载原文/素材',status:r.useStatus,systemIds:systems.filter(s=>s.resourceIds.includes(r.id)).map(s=>s.id),verifiedAt:'2026-10-02，复用既有来源核验；本计划未重新联网'});
}
for(const r of indie.filter(r=>selected.has(r.id))){
 resources.push({id:r.id,name:r.game,type:'独立游戏方法参考',url:r.sources[0].url,additionalUrls:r.sources.map(s=>s.url),localEntry:[research+'/library/indie-games/records.json',research+'/library/indie-games/DEEP-CASES.md'],license:r.license,use:r.projectBorrow?.summary,limits:r.limitations+'；'+r.doNotCopy,ownership:'仅索引与自写分析；未拥有可复用游戏美术/音频/代码，未亲玩',status:'reference-only',systemIds:systems.filter(s=>s.resourceIds.includes(r.id)).map(s=>s.id),verifiedAt:'2026-10-02，复用既有作者来源'});
}
resources.push({id:'brogue-source',name:'Brogue CE 1.15.1完整固定提交源码研究',type:'完整游戏系统参考',url:'https://github.com/tmewett/BrogueCE/tree/1ba4240b7a928ddf0ffb772717bf1d433cd63804',localEntry:[research+'/library/source-study/README.md',research+'/library/source-study/downloads/BrogueCE-v1.15.1-source.zip',research+'/library/source-study/downloads/readable'],license:'源码AGPL-3.0-or-later；tiles.png CC BY-SA 4.0；其它资源未逐项核',use:'学习地图进入/重访、资源消耗顺序、目标取得/撤离/终局冻结分离',limits:'只借鉴方法，不复制源码或图块；未build/运行/亲玩；不可照搬饥饿或26层返程',ownership:'已拥有完整固定提交归档和9个阅读文件；不是已安装可运行发行包',status:'reference-only',systemIds:systems.filter(s=>s.resourceIds.includes('brogue-source')).map(s=>s.id)});
resources.push({id:'local-art-pipeline',name:'现有NovelAI与人物/美术真源',type:'本项目资源生产入口',url:null,localEntry:['tools/nai_gen.py','tools/nai_style.py','tools/nai_guard.py','docs/character-bible','game/assets/asset-manifest.json','docs/asset-audit-debt.md'],license:'本项目已有资产逐项来源/授权见清单；已有授权文本不等于本轮核真，未登记或授权待确认项不声明商用通过',use:'按既有角色、厚涂配方和资产语义补小批缺口，保留实际生成参数与SHA',limits:'未核凭据/付费额度/第三方当前条款；本计划不调用服务，不用历史手册反推当前模型，也不自动重画全库',ownership:'已拥有脚本、已有图片和人物说明；外部服务可用性未核',status:'现有管线优先',systemIds:['SYS-13']});

const tools=[
 {id:'T-VERIFY',name:'现有workflow/质量门',entry:'npm run workflow；docs/WORKFLOW-TOOLS.md；docs/quality-gates.md',availability:'项目已有脚本',use:'按范围verify留证；混树staged --plan，遵守index与依赖守卫',limits:'本计划不执行全量gate/build；实际命令参数先看现有help/文档'},
 {id:'T-VITEST',name:'Vitest与jsdom',entry:'package.json；npm run test:target；tests/',availability:'package声明现有依赖；本计划不核整套运行环境',use:'收益、命令幂等、故障注入、cue和Agent状态定向测试',limits:'模块测试不等于实页/试听/好玩；不写镜像实现测试'},
 {id:'T-BROWSER',name:'Codex当前内置浏览器',entry:'当前平台浏览器工具；docs/quality-gates.md',availability:'下一轮实际验收时确认可用',use:'当前窗口真实输入、恢复、图像、信息与行为消费点',limits:'禁替换Edge/CDP/headless；不主动多尺寸；状态造档/调试须标干预'},
 {id:'T-AGENT',name:'现有SDT.Agent',entry:'game/src/agent/；现有Agent runner/record导出入口',availability:'项目源码已有',use:'固定输入配对、轨迹、停止原因、策略比较',limits:'未核具体命令前不编造CLI；不替代真人理解或平衡'},
 {id:'T-DATA',name:'现有数据/牌效/类型检查',entry:'npm run validate:data；npm run typecheck；npm run docs:compendium',availability:'package已有入口',use:'变更相关schema、迁移、过滤、图鉴一致性',limits:'不手改cards-sync；类型通过不等于玩法正确'},
 {id:'T-NARRATIVE',name:'现有Ink编译链',entry:'npm run narrative:compile；scripts/compile-narrative.mjs',availability:'inkjs在现有dependencies声明，已有编译入口；未另安装',use:'事件与短收束内容编译、稳定ID和命令提交对账',limits:'资料库inkjs未下载不代表项目没有依赖；不另换引擎'},
 {id:'T-ASSET',name:'增量资产审计',entry:'npm run assets:audit；scripts/asset-audit.cjs --check；docs/asset-audit-debt.md',availability:'项目已有且本次相邻工作已补强',use:'文件/清单/许可状态/路径/SHA检查，实际资源请求另验',limits:'不能重新冻结新债以绕过；通过不代表商业授权核真或美术质量通过'},
 {id:'T-NAI',name:'现有NovelAI Python工具',entry:'tools/nai_gen.py；tools/nai_style.py；tools/nai_guard.py',availability:'脚本存在；凭据、服务/额度未核',use:'保持人物身份与厚涂配方，小批图像变体与生成记录',limits:'不安装/付费调用；美术方向确认与实施授权分开；不输出token'},
 {id:'T-AUDIO',name:'Howler+现有音频库+jsfxr',entry:'game/src/audio/；npm run sfx:gen；game/scripts/jsfxr-generate.cjs',availability:'howler/jsfxr在package中声明，既有运行代码；本计划不安装',use:'统一cue接线、合成短反馈、样本试听与音量时序',limits:'离线howler源码只作参考；资产库存与可听结果分别验'},
 {id:'T-WEB',name:'现有web-up',entry:'npm run web；scripts/web-up.mjs',availability:'服务修复已有37测试/32图片证据',use:'身份明确的Vite服务和资源健康',limits:'本计划不再开进程；无主进程勿杀，按端口约定'},
 {id:'T-OPTIONAL-PBT',name:'fast-check（可选）',entry:'https://github.com/dubzzz/fast-check',availability:'资料库仅索引；未在当前package依赖中声明，未安装',use:'仅当复杂状态序列确有难复现失败时再评估性质测试',limits:'不是这轮必要前置；安装另依授权与范围'},
 {id:'T-OPTIONAL-IDB',name:'idb/Dexie（保留方案）',entry:'https://github.com/jakearchibald/idb；https://github.com/dexie/Dexie.js',availability:'仅索引；当前package未声明，未安装',use:'实际跨键缺陷且当前journal方案不足时比较事务迁移',limits:'不为架构整齐重做存档；需迁移回退与旧档设计'}
];
const uiRequestLinks=[
 {id:'UI-R01',request:'token字阶',systemIds:['SYS-12'],resourceIds:['nng-visual-hierarchy','wcag-contrast-minimum'],kind:'制作请求，不是下载素材'},
 {id:'UI-R02',request:'共享壳',systemIds:['SYS-12'],resourceIds:['nng-visual-hierarchy','kenney-ui-pack'],kind:'制作请求；Kenney只作备选，不套整包'},
 {id:'UI-R03',request:'卡摘要',systemIds:['SYS-06','SYS-08','SYS-12'],resourceIds:['fp-itb-postmortem','fp-sts-metrics'],kind:'制作请求，不是下载素材'},
 {id:'UI-R04',request:'风险确认',systemIds:['SYS-03','SYS-04','SYS-12'],resourceIds:['fp-itb-postmortem','fp-xbox-user-research'],kind:'制作请求，不是下载素材'},
 {id:'UI-R05',request:'终局摘要',systemIds:['SYS-02','SYS-07'],resourceIds:['indie-cogmind','brogue-source'],kind:'制作请求，不是下载素材'},
 {id:'UI-R06',request:'图标',systemIds:['SYS-12','SYS-13'],resourceIds:['game-icons-net-risk-extraction-inventory','local-art-pipeline'],kind:'制作请求；来源素材须独立查许可与归因'},
 {id:'UI-R07',request:'首脑身份',systemIds:['SYS-09','SYS-13'],resourceIds:['local-art-pipeline'],kind:'制作请求；优先现有角色资产'},
 {id:'UI-R08',request:'收藏',systemIds:['SYS-05','SYS-12','SYS-13'],resourceIds:['local-art-pipeline','nng-visual-hierarchy'],kind:'制作请求；保留暖纸收藏语义'},
 {id:'UI-R09',request:'地图',systemIds:['SYS-04','SYS-12'],resourceIds:['fp-itb-postmortem','brogue-source'],kind:'制作请求；不直接移植地图代码'},
 {id:'UI-R10',request:'cue',systemIds:['SYS-14'],resourceIds:['howler','jsfxr','kenney-interface-sounds','mdn-autoplay'],kind:'制作请求；现有cue接线优先'}
];
for(const s of systems)s.uiRequestIds=uiRequestLinks.filter(r=>r.systemIds.includes(s.id)).map(r=>r.id);
for(const r of resources)r.uiRequestIds=uiRequestLinks.filter(u=>u.resourceIds.includes(r.id)).map(u=>u.id);
const plan={schemaVersion:1,generatedAt:'2026-10-02',scope:'总体改造规划的系统/资源分表；无实施',evidenceLimits,phases,systems,decisions,resourcesFile:'resources.json',functionCoverage:functions.map(f=>({id:f.id,name:f.name,systemIds:systems.filter(s=>s.functionIds.includes(f.id)).map(s=>s.id)}))};
const resourcePlan={schemaVersion:1,generatedAt:'2026-10-02',scope:'复用已核38条核心/24款独立游戏/深读与完整源码库；不新增广网搜索',resources,tools,uiRequestLinks};
fs.writeFileSync(path.join(out,'systems.json'),JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(path.join(out,'resources.json'),JSON.stringify(resourcePlan,null,2)+'\n');
let md='# 系统改造分表：保留底座，先把一趟远征做实\n\n2026-10-02。建议默认顺序是：先统一奖励和结算事实、补恢复与记录，再处理信息/声音/动作接线，最后用自然旅程决定撤离、编组与内容调整。现有Vite、领域命令/查询、Base/Run、SDT.Agent、Sound和Art门面继续保留。不做React/Godot重写，不新建全局总线，不以文件行数或strict比例推断质量。\n\n';
md+='## 证据与估算边界\n\n'+evidenceLimits.map(x=>'- '+x).join('\n')+'\n\n';
md+='## 阶段顺序\n\n|阶段|先解决什么|出口条件|工作包|\n|---|---|---|---|\n'+phases.map(p=>`|${p.id}|${p.name}|${p.exit}|${p.systemIds.join('、')}|`).join('\n')+'\n\n阶段是依赖顺序，不是瀑布式整批门禁。SYS-02与SYS-10接口先对齐，SYS-11消费回执；SYS-03的满包处理与SYS-11停止条件联验。SYS-08/09、09/14是联合验收，不要求彼此全部完成后才开始。SYS-12和已证文案修正可在前段独立推进。\n\n';
md+='## 79功能族如何归并\n\n|包|领域|优先级/阶段|覆盖族|相对工作量|\n|---|---|---|---|---|\n'+systems.map(s=>`|${s.id}|${s.domain}|${s.priority}/${s.phase}|${s.functionIds.join('、')||'横切服务/证据'}|${s.scopeCost}|`).join('\n')+'\n\n交叉归属表示同一功能有规则、显示、声音或记录等不同验收面，不授权多人同时编辑同一文件。所有79族均有主工作包；作者工具与研究所明确列界。\n\n';
for(const s of systems){
 md+=`## ${s.id} · ${s.domain}\n\n**为什么要做：** ${s.problem}\n\n**默认怎么做：** ${s.recommendation}\n\n**做好后：** ${s.benefit}\n\n**保留：** ${s.keep.join('；')}。\n\n**现状架构：** ${s.architectureBefore}\n\n**目标架构：** ${s.architectureAfter}\n\n**接口与状态（拟议字段不是现有API承诺）：**\n\n${s.interfacesAndState.map(x=>'- '+x).join('\n')}\n\n**落点：** ${s.files.map(x=>'`'+x+'`').join('、')}。实施前按当前diff和归属复核。\n\n**执行片：**\n\n${s.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n**验收：**\n\n${s.acceptance.map(x=>'- '+x).join('\n')}\n\n**依赖/风险：** ${s.dependencies.join('、')||'可独立启动'}；${s.risks.join('；')}。\n\n**工具/资料：** ${s.tools.join('、')}；${s.resourceIds.join('、')||'仅现有项目'}。${s.scopeCost}。\n\n**依据：** ${s.evidence.map(x=>'`'+x+'`').join('、')}。\n\n`;
}
md+='## 需要老板定语义的时点\n\n当前只做计划，以下问题不会挡住分析与已证修复的排期。提出默认方案是为了实施时可具体评审，不等于这次已获游戏改动授权。\n\n|决策|默认建议|真正需要时|问题|可先继续|\n|---|---|---|---|---|\n'+decisions.map(d=>`|${d.id} ${d.topic}|${d.defaultRecommendation}|${d.whenNeeded}|${d.question}|${d.notBlocking}|`).join('\n')+'\n';
fs.writeFileSync(path.join(out,'SYSTEM-PLAN.md'),md);
let rm='# 资源在哪里、工具怎么用\n\n2026-10-02。这里是工作包对应的精选入口，不是购物清单。已有资料库38条核心、24款游戏、四份深读与Brogue源码继续保留；本次没有重新搜索广网、安装、下载或调用付费生成。\n\n先用项目已有资源和工具；许可允许、文件已拥有、依赖已安装、接线有效、玩家可听/可见是五件不同的事。当前package里的声明不被写成已经成功运行。\n\n## 先取哪类资源\n\n|要做什么|先用什么|不要误用|\n|---|---|---|\n|卡牌、人物、场景补图|项目Art清单、人物圣经、NovelAI当前脚本，先小样|不要把旧服务破图归咎素材；不要用历史手册反推参数|\n|风险/背包/出口图标|已有3个Game-icons SVG，统一笔触并补归因|CC BY 3.0不是CC0，未渲染也不算可读性通过|\n|按钮/操作短音|项目既有库和jsfxr，已有Kenney CC0包试听择少量|不先采购大包，文件存在不等于接通|\n|UI组件材料|现有CSS/卡面语法；Kenney UI只作备选|Kenney UI包本机尚未下载，不能说随时可直接用|\n|风险/奖励/结局设计|深读ITB/STS/Riot/Xbox、Cogmind/Backpack Hero、Brogue源码方法|参考作品不是可复制的美术/音频；未亲玩不写体验结论|\n|保存/叙事/随机|现有journal、Ink与随机代码|Dexie/idb/fast-check/seedrandom/rot.js不作为新增依赖默认方案|\n\n## 精选资源逐项\n\n';
for(const r of resources)rm+=`### ${r.id} · ${r.name}\n\n- 用途：${r.use}\n- 来源：${r.url?'['+r.name+']('+r.url+')':'本地项目入口'}${r.additionalUrls?.length?'；作者深例附链：'+r.additionalUrls.slice(1).map(x=>'[原文]('+x+')').join('、'):''}\n- 本地：${r.localEntry.map(x=>'`'+x+'`').join('、')}\n- 拥有/状态：${r.ownership}；${r.status}\n- 许可：${r.license}\n- 限制：${r.limits}\n- 对应工作包：${r.systemIds.join('、')}\n\n`;
 rm+='## UI制作请求与真实资料的对应\n\nUI-R编号是要制作或调整什么，不是素材文件或下载包。\n\n|制作请求|内容|工作包|可用参考/来源ID|性质|\n|---|---|---|---|---|\n'+uiRequestLinks.map(u=>`|${u.id}|${u.request}|${u.systemIds.join('、')}|${u.resourceIds.join('、')}|${u.kind}|`).join('\n')+'\n\n';
 rm+='## 工具分工与实际可用性\n\n|ID|工具/入口|现状|负责什么|边界|\n|---|---|---|---|---|\n'+tools.map(t=>`|${t.id}|${t.name}：${t.entry}|${t.availability}|${t.use}|${t.limits}|`).join('\n')+'\n\n资产获取顺序：先检查现有映射与文件，再选现有合法素材，仍缺才生成小样或评估外部包；每份新资产记录来源、许可、实际参数、大小与SHA。大文件与二进制按项目规则仅登记相对路径/哈希/获取方式，不擅自入库。外部可选工具不构成安装授权。\n';
fs.writeFileSync(path.join(out,'RESOURCE-TOOLS.md'),rm);
const missingFunctions=plan.functionCoverage.filter(f=>!f.systemIds.length);
const missingResources=[...selected].filter(id=>!resources.some(r=>r.id===id));
const missingFiles=[...new Set(systems.flatMap(s=>s.files))].filter(p=>!fs.existsSync(path.join(root,p)));
const dependencyCycles=[];
function walk(id,chain=[]){if(chain.includes(id)){dependencyCycles.push([...chain,id]);return;}for(const dep of systems.find(s=>s.id===id)?.dependencies||[])walk(dep,[...chain,id]);}
for(const s of systems)walk(s.id);
const missingEvidence=[...new Set(systems.flatMap(s=>s.evidence))].filter(p=>!fs.existsSync(path.join(root,p)));
const missingLocalEntries=resources.flatMap(r=>r.localEntry.filter(p=>!fs.existsSync(path.join(root,p))).map(p=>({id:r.id,path:p})));
const validation={systemCount:systems.length,functionCount:functions.length,resourceCount:resources.length,toolCount:tools.length,uiRequestCount:uiRequestLinks.length,missingFunctions,missingResources,missingFiles,missingEvidence,missingLocalEntries,dependencyCycles,allFunctionIds:plan.functionCoverage.map(f=>f.id),note:'结构/路径验证，不是游戏测试或实施验收'};
fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify(validation));
