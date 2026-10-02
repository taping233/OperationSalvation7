import fs from 'node:fs';
import path from 'node:path';

const base='docs/evidence/2026-10-02-production-research';
const dest=base+'/planning/pages';
const read=p=>JSON.parse(fs.readFileSync(base+'/'+p,'utf8'));
const art=read('diagnosis/art-annotations/annotations.json');
const inv=read('diagnosis/coverage/inventory.json');
const refs=read('diagnosis/visual-comparators/records.json');
const resourceLinks=read('planning/systems/resources.json').uiRequestLinks;
const healthyUpdates={
 'AMMO-TUTORIAL':{image:'AMMO-TUTORIAL-healthy.jpg',issues:[{location:'普通牌命运示例',symptom:'左列普通牌进消耗口袋与右列初始攻击直接消散都使用初始攻击卡图，图文指向相反。',impact:'同一对象被教成两种相反命运；示例失去可信度，装饰再完整也不能帮助玩家理解核心经济。',acceptance:'左列改为真实可进消耗口袋的普通牌（如镭射），右列保留初始攻击；图名、规则和命运一致。'},{location:'教学收口',symptom:'“知道了”按钮只横跨左侧约两栏下方，三列说明的底部收束不齐。',impact:'按钮看起来属于左两列，第三列与整段教学关系变弱。',acceptance:'统一整段教学的结束操作区，三列示例与继续按钮关系明确。'}]},
 'NOTES-CLEAR':{image:'NOTES-CLEAR-healthy.jpg',issues:[{location:'清空确认按钮',symptom:'不可恢复的“确认清空”仍是最亮金按钮，取消较灰。',impact:'普通收益动作与不可恢复删除共用最强权重，风险语义不清。',acceptance:'风险色/文字与默认取消对齐；补准确清空数量，未经授权不执行删除。'}]},
 'NODE-NOTE':{image:'NODE-NOTE-healthy.jpg',issues:[{location:'编辑输入与动作组',symptom:'textarea为突兀纯黑默认表单；保存/清空同排，取消孤立左下。',impact:'默认表单材质打断现有冷青工具壳；安全返回与删除的层级不连续。',acceptance:'输入框沿现有冷青承托，保存为主、取消相邻、清空独立风险项；保持开发工具低制作成本。'}]},
 'TERMINAL-RETRY':{image:'TERMINAL-RETRY-healthy.jpg',fixture:true,issues:[{location:'保存失败说明',symptom:'公开renderer fixture只写“终局安全提交服务不可用”和重试，没有说清原进度是否保留及下一步。',impact:'玩家无法判断重试/停留的安全边界；这是renderer示例可见的文案缺口，不是实际故障复现。',acceptance:'说明原进度/待提交状态与安全下一步；若增加退出，必须保证不破坏待提交状态。'}]},
};
for(const [id,u] of Object.entries(healthyUpdates)){
 const r=art.records.find(r=>r.id===id);
 r.evidence=[{path:'../interface-captures/'+u.image,source:u.fixture?'主会话健康服务公开renderer fixture；不证明真实故障发生或重试通过':'主会话新增健康服务界面截图；本计划作者view_image亲读；输入来源沿主会话轨迹，不冒充自然走线',reviewed:true}];
 r.status=u.fixture?'健康renderer fixture已亲读，非实际故障复现':'新增健康实页图已亲读，动作仍按来源单独核';
 r.issues=u.issues;
}
const battleAnnotation=art.records.find(r=>r.id==='BATTLE');
battleAnnotation.issues[0]={...battleAnnotation.issues[0],symptom:'收起手牌部分卡缘伸出底边；新增健康图已证初始攻击悬停展开且规则可见。',impact:'现有展开有效，不能说详情不存在；剩余风险是长效果牌展开后的全文与HP/意图安全区尚未验证。',acceptance:'保留已证悬停上抬/轻放大/描述展开；长效果牌展开时全文、费用与目标说明可见，不盖HP/意图。'};
battleAnnotation.strengths.push('新增健康服务图与协议采样证实初始攻击已有悬停上抬、轻放大、描述展开；不能写成无动效。');
battleAnnotation.evidence.push({path:'../interface-captures/BATTLE-HOVER-healthy.jpg',source:'主会话IAB协议mouseMoved悬停；本计划作者亲读图；动态box采样见BATTLE-card-hover-motion.json',reviewed:true});

// Each row is a concrete work order, not an automatic claim about unseen pixels.
const plans={
TITLE:['把英文花体保留作装饰；若需要副说明，另放一行实色中文短句。','主入口保留剑形物件与金色焦点；照相馆、成就、设置保留各自器物身份。','给次入口补稳定中文标签和键盘焦点框；焦点不压人物脸部。','有档与无档分别显示继续/新建的具体对象，异常档转档位恢复而不是静默失败。'],
SLOTS:['五档卡保留同一基线；空档继续保留雾景，有档把中段让给人物、当前层/基地、最近活动。','每档固定一个状态词：空档、远征中、待整理、基地档案；装饰英文不承担状态。','继续、另开和删除分开布局；覆盖确认写清档位和将失去的内容。','载入期间只锁本次入口，显示当前档号和进度；失败留原卡并给恢复入口。'],
'HUB-DEPLOY':['标准/精英卡首行直接放倍率与带回比例，风险差别用两行对照而不是小字号段落。','把准备摘要按生命、可携卡、安全格、局内币去向分组，背景标语降为氛围。','整备保持唯一金色主动作；目标预设保留次动作并显示当前目标数量。','钥匙门和暂缓研究所沿用真实状态说明，未开放项不画成马上可进入的按钮。'],
'HUB-STASH':['仓库和消耗口袋保持两个容器身份；每区显示容量和一句去向说明。','转移/复原后自动把新物品定位到可见区，容量变化贴容器标题。','只给主要网格一条明确滚动轨；页面标题、资源与选中物品详情固定。','堆叠卡显示数量和当前选中框；操作区只出现该类型实际支持的命令。'],
PREP:['小卡保留名称、费用、类型和一句决策摘要；完整效果转稳定大卡详情。','可携卡和出征背包共享选中标记；点加入/移除后同时更新两边数量。','固定底部已携/容量/安全格摘要和确认出发，不能被长牌列表推到屏外。','宠物与固有初始卡明确标识；不能带回等命运在详情中写清，不靠玩家记手册。'],
'CLASS-CHOICE':['人物选中用姓名旁勾和主框；皮肤只用细金线与“当前皮肤”，两种选择不再同强度。','立绘继续作为主体，名字、职业、起始补给与卡池入口形成一个资料区。','切换人物时卡池摘要和说明一起更新，旧人物文字不能留到新立绘上。','可预览但未解锁皮肤写清条件；确认人物与仅预览皮肤分成两个动作。'],
'CLASS-GRANT':['给职业补给标题与固定口袋条各留轨道，标题不被资源条盖住。','把领取说明放在牌列前，职业名和补给数量相邻；每张牌支持完整详情。','选中牌先亮框/勾，再执行领取并更新背包；满包在动作旁说明。','服务恢复后重看补给帧，确认潜匿图正常；原破图不进入重画清单。'],
MAP:['路线区至少露出一个完整可行按钮与当前目标；地图继续占主舞台。','把日志收进固定边区，默认只保留最近一条；展开时不能盖当前节点和连线。','当前、可去、已走、不可去使用形状/边框和文字双重区分，不只改颜色。','提示只提供已知节点类型、合法去向和成本；不新增敌人/奖励的精确剧透。','四层标题及终局去向用同一规则来源，移除“第五层”类错误指引。'],
'CHEST-PICK':['标题与口袋条错开，保留三张牌为最大对象。','在牌列前写“选一张领取，其余放弃”；详情入口不直接触发领取。','选中框与领取结果连接，领取后更新容量；失败保留候选和原因。','把跳过/离开放稳定次动作区，满包提供管理背包出口后能回到同一箱。'],
BATTLE:['保留已证悬停上抬、轻放大和描述展开；规范展开安全区，并用长效果牌核全文、费用与目标提示。','当回合实算意图作敌方主信息，长期状态放短徽记与详情，避免用大段规则挤人物。','低生命保留HP数值并加“危险”文字/边缘标记；不靠绿色条长度让玩家猜。','出牌过程按来源牌→目标→数值结果串联；持续HUD不跟短特效一起消失。','点选、拖拽、键盘的可用/不可用分别验；未实测输入不能据点击证据宣称全部可用。'],
'BATTLE-REWARD':['把胜利横幅、标题、战果合为短结果条；首屏让至少一张完整奖励与领取动作同屏。','箱体保留小型物件身份，不能继续占掉牌面阅读空间。','显示本箱规则、已取数量、剩余候选和背包容量，普通/职业卡命运分开说。','奖励入包后再刷新数量并进入消耗教学；保存失败单独显示，不重复发奖。'],
'BOSS-GATE':['给首脑独立名牌/现有剪影位，HP、攻击和特殊词缀分块。','挑战成本、编组要求和可带资源放按钮前；不足条件明确写出。','背景保留破败温室，不换整套画风；首脑框式沿到编组与战斗。','编组入口说明本次可选/要求数量；14选14样本要如实显示，不包装成有取舍。'],
'BOSS-DECK':['页顶只固定本次要求、已选数、特殊规则三个摘要，六行长规则折叠到详情。','首屏至少一行完整可选牌和确认动作；选中牌用勾及计数双提示。','沿首脑门的冷青边框与页眉，操作背景保持安静，取消突兀纯黑壳。','14可用且必须14的样本直接写“全部编入”；规则是否调整另做玩法实验。','确认前核牌数和不可用原因；错误保留选择，不让玩家重选整组。'],
'BOSS-BATTLE':['当前实算意图固定为主行，常驻词缀改徽记与详情入口。','首脑名牌、HP、规则和受击数字各留位置，不能在立绘附近挤成多行。','沿用普通战手牌阅读和目标反馈组件；首脑差异只增身份、阶段与专属规则。','阶段变化先说明哪条规则改变，再更新意图；不以全屏闪光代替信息。'],
'CHEST-ALL':['多块容量警告合成一行“容量/可收/剩余”，管理背包成为相邻次动作。','首屏展示一张完整主要奖励，箱体缩小，长战果收折。','逐收、全收和离开分别显示会收多少/留下多少；结果只能取成功回包。','多箱队列固定当前序号与剩余箱数，离开当前箱后清楚进入下一箱或地图。'],
'EXIT-FINAL':['撤离按钮旁固定本次可带回、局内币将留下与待整理数量，不把22币警告埋段落。','首脑突破与终局出口写成明确身份，保留继续深入的真实可用状态。','点击撤离进入保存/整理阶段，完成前不显示入库成功。','返回地图时恢复原节点与风险摘要；不新增一个不存在的第五层。'],
'EXTRACT-STASH':['全部入库作主动作；完成整理但仍有未入库牌作风险动作并明确二次确认数量。','标题区固定仓库容量、本次候选、已入库、剩余未入库；不要用仓库总量代替本次净收益。','卡网格只保留一种明确滚动轴，转移后定位新位置并同步计数。','智能整理先给具体去留预览，再应用；初始牌不能入库的原因贴对象。','保存失败保留这次整理身份与剩余牌，不伪报成功；重试只重保存。'],
'EXTRACT-DONE':['结果先写首脑是否突破、真实入库数、留下/损失数，再给仓库总量。','展示本次最有代表性的几张带回牌，初始牌和原有仓库不混入净收获。','用时、行动、HP等统计降为可展开细节，不与收获争首屏。','回基地与再出发明确目的地和新局规则；刷新后结果与仓库对账。'],
STUDIO:['主照片继续占大画幅；名称、效果、编号、背签、大图入口收成一个阅读区。','筛选/搜索/排序放纸质索引工具栏，当前类型、结果数和页码保持可见。','翻页与选片保持选中身份；空结果写搜索条件和清除按钮。','照片备注保存状态独立于卡牌规则，馆方记录与玩家备注标签分开。'],
GUIDE:['保留编号步骤面板，把整备→探索→战斗→撤离四步完整列出。','先取得稳定全文帧，再决定是否调整正文颜色；过渡淡入不作读性缺陷。','每步只放本阶段最重要规则，卡牌消耗与带回规则给一个可点击示例。','关闭回原来源页并恢复位置，战斗来源不能跳回标题。'],
'HUB-SHOP':['保留2×2货架与货物旁的效果文本，价格/储备币/空格保持一眼可见。','缺币与满库原因贴购买动作；货物名称和作用保持可读。','购买成功后同一区更新余额、空格、物品去向，不能只弹一个“成功”。','用充足币、缺币、满库三种状态复核后再动布局；目前不扩大商品池。'],
'HUB-UPGRADE':['保留容量大数字，把升级前→升级后、成本、MAX固定在同一行。','扩建和宠物升级分两个区域，木材/口粮各贴对应动作，避免错认币种。','携带勾与可升级状态分开；升级成功只更新目标项和资源数。','全满级、材料不足与未孵化蛋分别取稳定帧，已有首屏不能代验边界。'],
'HUB-CLASSES':['保留五列人物档案的比较基线，姓名、等级、XP、生命加成位置一致。','每人物默认皮肤金框标“该人物当前皮肤”，不能暗示五人物同时被选。','当前出征人物另用单独标记；预览皮肤不等于持久选用。','卡池入口显示该人物真实可用数；切换或成长后原位刷新，长名不挤XP。'],
'HUB-ACH':['共享页眉只常驻标题、总进度与当前子页，故事线索收为一行可展开。','卡背、成就、职业收藏三个入口用稳定标签，切换保留各子页状态。','给子页至少一行完整对象，减少公共说明抢占首屏。','领奖数与只读总进度分别标识，标题入口不能伪装为基地领奖。'],
'HUB-BACKS':['先取得稳定帧；过渡中的淡卡背不判缺图或完成度。','每卡背固定未解锁条件、已解锁未选、当前使用三种标签。','展示原卡背图，选用按钮与锁定原因在同一张卡下。','选择后只移动“当前使用”标记，返回再进与重载核持久化。'],
'HUB-COLLECTION':['首次保留收藏规则，熟悉后收折；五项目标压成紧凑进度条。','首屏至少一排完整收藏卡与当前人物进度，空位显示该人物真实池分母。','收藏动作明确会消耗哪张职业卡和提升什么，不与战斗消散混说。','已收藏、未收藏、可领取里程碑分别标记；领取更新奖励与计数同区。'],
'HUB-ACHIEVEMENTS':['把奖励与领取合成横向动作组，按钮完整写出“领取”，避免窄竖金条。','未达成、可领取、已领取用标签和图形区别，不只换行左线颜色。','奖励类型/数量贴按钮，领取后更新对应资源并保留该行位置。','长成就名和复杂条件先换行再扩行高，不把奖励挤成极小字。'],
SETTINGS:['保留单列中文标签和不同类型控件；英文继续作次级注释。','音源、主音量、音乐、音效分组；每滑杆显示实时数值和可验证试听入口。','减动态开关说明会抑制哪些短效与过渡，开启后不改变规则反馈文字。','危险区与普通偏好分开，清空写具体对象与数量，默认焦点留取消。','分别核标题/基地/战斗来源返回；改值和重载证据只验实际操作项。'],
INBOX:['空态补显式“写留言”入口，调用现有编辑流程，右键继续可用。','每留言显示来源对象、时间与内容摘要；空态保留邮筒主体。','导出/删除与打开阅读分组，删除须说清具体留言，不能在诊断时执行。','写入失败保留输入并显示重试；来源origin与文件库分清。'],
DATA:['表头标样本数和正常/Agent/调试辅助属性，辅助局不能只标human。','最近局获得更宽区域，少样本的空图表收紧为一句“样本不足”。','本次真实入库与携出候选拆字段，初始牌不算净带回。','导出与清空分区，清空显示范围；统计只作样本事实，不写成平衡结论。'],
'STASH-ITEM':['物品卡支持只读大详情，处置前可读完整效果、来源和堆数量。','出售、收藏、开经济包按类型显示；每动作旁写收益币种或消耗结果。','最后一张/全堆处置进入同一风险确认，返回保持选中物品。','执行成功后同步仓库数量、储币/收藏XP并定位变化，失败保留原对象。'],
'STASH-MATERIAL':['保留“不能出售换币”和每张折入真实资源说明，材料身份与普通牌分开。','单张与全部用量显示预计转换数，只有一张时全部动作解释为何不可用。','末张确认写卡名、数量、得到的真实资源，沿材料确认组件。','转换后原位更新卡堆和资源栏；多张/最后一张/失败分别核。'],
'MATERIAL-CONFIRM':['确认卡内带来源口粮卡缩略图、名称、数量和转换结果，底图是谁都能认对象。','保留与使用明确分蓝/风险红，并写完整动词。','默认焦点放保留；确认中锁定同一命令，失败仍保留来源卡身份。','回到原物品详情及滚动位置，不能用底层地图掩盖操作来源。'],
'CARD-ZOOM':['大卡继续为唯一强对象，背景暗化仍保留来源页。','备注另用清楚承托块，提高空态、输入与来源说明对比。','规则文本与玩家备注标签分开，保存中/已保存/失败显示在输入旁。','关闭恢复原牌与焦点；详情开启不能误发加入、领取或出售命令。'],
'CLASS-POOL':['小卡用短机制徽记粗筛，完整规则沿左侧大预览，不塞满所有细字。','固定人物名、真实池数与当前页，按现有10张上限分页。','改变人物/筛选后预览与网格一起更新，旧选中卡不残留。','长能力/注能详情用术语说明，但不改卡牌实际规则。'],
'PHOTO-ZOOM':['保留照片与背签并排、大画幅与护角物件感。','规则、馆方记录、玩家备注各自标签，编辑区独立显示保存状态。','长名/长效果在背签区域滚动，照片主体不随正文挤缩。','关闭/Esc返回原选片位置，失败素材只保留明确兜底，不直接改原画。'],
'PREP-GOALS':['空方案写“空清单，不会加入卡牌”；命令可用与配装有效分开。','两预设分别写所需、可带、缺失、超容量，应用前能看具体差额。','目标0/3按当前选择更新，未知掉落来源明确标未知。','保存/覆盖预设写目标方案名，应用后整备清单与容量一起更新。'],
'RUN-SHOP':['零币仅降低购买按钮权重，货物图、名称、规则保持可读。','局内币与基地储币写不同名称，价格贴购买动作。','满包、已售、缺币分别说明，购买失败不能扣币后静默。','服务恢复后重看货架和离开图标；已修破图不计入美术重做。'],
'RUN-SELL':['空出售列表写“没有可出售卡”及可售类型，不把空态画成加载失败。','返回商店保持原货架与余额，沿统一返回标签。','有可售卡时写将售堆数与得到局内币，区别基地储备币。','恢复后复核返回图标；原服务断开占位不作原画问题。'],
FIRE:['保留营火场景与回血/复原两类动作，分别写成本、次数和可恢复数量。','空消耗口袋明确“无可复原卡”，回血动作仍独立解释。','复原入口显示来源火堆，结果定位回到口袋新卡与HP。','服务恢复后复核火图标稳定帧，破图alt已不列美术缺陷。'],
ALTAR:['三牌激活、碎片兑换、道具复原分三个成本块，不能共用模糊金按钮。','未激活/已激活固定标签，一次性规则贴动作。','缺职业/无池等不可用原因保留正文对比，碎片是否保留明说。','恢复后取稳定祭坛帧；晶体图标不因历史服务断开进入重画清单。'],
SACRIFICE:['选择标题留独立安全区，不与口袋条重叠。','祭坛3张、紧急撤离3张、道具1张显示来源与不同目的，不只统一写献祭。','每牌勾选与已选/要求计数同屏，确认未满数写原因。','取消恢复原牌与场景；实际扣牌之后才显示结果，复核恢复图像即可。'],
'ALTAR-REWARD':['奖励行保持名称、收益和不可选原因可读，禁用只作用于动作。','二选一规则贴候选；空口袋/满包原因分别说清。','选择成功后同步收益与祭坛状态，失败保留两个候选及原因。','复核恢复后的晶体图标，不把原断线截图计作缺素材。'],
EVENT:['先取得塌方采掘点的稳定正文/选项帧；当前过渡帧不判实际读性与缺选项。','按标题、场景文、代价选项、结果分段，资源数贴每个选择。','已知与随机结果分别标，不显示未经确认的精确收益。','选择后只执行一次并进入结果；返回保留事件与资源变动身份。'],
'SLOT-RECOVERY':['页顶明确当前档号与正在恢复基地/远征/待整理哪一种。','加载、恢复成功、旧版迁移、损坏失败分阶段标签。','失败提供原档检查/重试/返回档位，不能用装饰过场盖住错误。','连点期间锁住同档进入，旧回调取消；不在真实老板存档造故障。'],
'TITLE-ACH':['标题写“成就总览”，只读状态与基地可领奖区分。','已达成和未达成显示条件与进度，奖励标“去基地领取”或真实状态。','保留总数与分类，长条件展开看全文。','关闭回标题原入口，不能跳进未选择的基地档。'],
SUGGESTION:['顶部写留言针对哪个页面/物件，输入区不混进功能设置。','保存中、已保存、失败紧贴输入；失败保留全部原文。','关闭前有未保存内容时明确保留/放弃/继续编辑。','显式写留言入口与右键走同一组件，来源坐标/对象保持一致。'],
LEAVE:['继续作安全主动作；保存退出与放弃分开两组。','保存退出说明检查点口径，放弃写具体失去与安全格保留。','正在保存时不允许再次提交，失败留原局并给重试。','关闭回原地图/战斗位置，放弃需独立确认。'],
'ABANDON-DONE':['标题明确“已放弃”，不能套用撤离成功。','列损失与安全保留的卡/资源数量，本次入库与仓库总量分开。','回基地与回标题放稳定底部动作区。','只有持久化成功才显示完成，失败转终局保存重试。'],
'TERMINAL-RETRY':['首句写“结果未保存”，胜败故事放后面。','显示原局身份、待保存结果与原局仍保留，不能显示伪成功。','重试只重复保存，不重新战斗/发奖；按钮显示忙碌态。','保留安全退路及错误原因，重试成功后回正确终局页。'],
'EXIT-SCREEN':['直说浏览器页需要由玩家关闭标签或窗口，不声称已经关闭应用。','保留已保存/未保存的具体状态与返回游戏入口。','出口说明用简短正文，避免空黑幕像崩溃。','返回恢复标题或原来源，不自动开始新局。'],
'HUB-PETS':['拥有、未孵化、当前携带分别标签，只有一只携带用勾与文字。','每宠物写真实效果、安全格收益和等级，不能只看头像猜。','切换前说明旧安全卡保留规则，切换后同步整备摘要。','蛋与宠物分区，升级成本链接现有升级页。'],
'STASH-EGG':['显示蛋数量、50储备币成本和“随机未拥有宠物”。','全齐、缺币、无蛋三种原因分别贴孵化动作。','提交中只锁一次孵化，揭晓后显示新增宠物与剩余蛋/币。','取消返回同一蛋堆，失败保留对象并说明未扣或回包结果。'],
'STASH-RAW':['标题写真实木材/口粮/钥匙，与对应材料卡区别。','各资源显示数量、使用去向和来源，不误加出售按钮。','从资源栏打开就定位该资源，返回恢复仓库位置。','未知来源不编说明，沿经济数据实际字段。'],
'STASH-CONFIRM':['确认上方写卡名、堆数量、出售或消耗命令与所得/失去。','取消作默认安全焦点，风险确认与普通购买金按钮分色。','最后一张、全堆和部分数量各列准确数值。','命令失败保留原对象，成功后定位变化并更新余额。'],
'HUB-HELP':['标题直接写当前六页签中的名称，不只用通用问号。','每份说明按“能做什么/要付什么/去向”三段，只列本页命令。','卡牌和真实资源术语沿共享说明，不复制另一套经济规则。','关闭回来源页签与滚动位置，帮助本身不触发操作。'],
'CARD-DESIGNER':['字段编辑、机制、即时预览与保存结果分栏。','开发守卫关闭时入口显示只读/未开放，不画伪可写按钮。','结构规则错误定位字段，原输入保留；支持表之外写不支持。','预览与正式卡库写入分开，导出不等于已入库；不手改cards-sync.json。'],
'CARDS-EXPORT':['文本预览可手选，复制与下载分两个明确按钮。','复制失败保留全文，给下载替代出口。','标导出版本、范围和条数，不能泛称全部卡库。','返回制作器/照相馆保留筛选与选择，不改变卡数据。'],
'CARDS-IMPORT':['JSON输入、解析错误、结构错误和导入结果分区。','错误定位条目/字段，原文保留，成功与失败不共用绿色块。','覆盖与合并按真实规则说明，先显示将影响的条目。','执行一次后核实际条数，守卫关闭时只读，不绕过同步入口。'],
'RUN-TRANSITION':['过场显示即将进入节点/档位的具体身份。','允许真实已支持的跳过，跳过后不能留下旧场景层。','完成过场再开放新页操作，旧异步回调随路由取消。','减动态时直接到稳定页，仍保留阶段/错误文字。'],
'NODE-SAFE':['明确“安全节点，无事件，可继续”，空白有意图而非像加载失败。','保留当前层/节点与相邻合法路线。','继续动作位于稳定操作区，不添加虚假搜刮。','返回地图定位同一节点，资源没有变化就直说。'],
PICKUP:['搜寻中、揭晓、已收取分别标签，数值不能提前跳。','币、木材、口粮、钥匙使用各自既有图标与去向名称。','领取成功后同步资源栏和节点消耗，失败保留领取机会。','返回原节点；减动态只省揭晓短效，不省数量与结果。'],
'RESOURCE-PICK':['两个候选写清资源身份、数量和去向，选择规则紧贴候选。','满包拒收保留候选并显示管理背包/离开。','成功回包后再锁另一候选，失败不误报已领取。','返回与取消不耗未实际领取资源。'],
'CHEST-SEARCH':['固定当前箱序号与后续箱数量，搜寻中不露可领取假按钮。','揭晓后同一箱标题变成领取规则，箱体缩到信息辅位。','重复点击只开一次，失败说明仍未揭晓。','跳过过场直接进入相同稳定奖励，不跳过奖励或保存。'],
'AMMO-TUTORIAL':['左列换成真实可进消耗口袋的普通牌（如镭射），右列保留初始攻击；禁止同一图教相反命运。','普通牌进消耗袋、职业/初始攻击消散、1/3带回用对象与去向配对示例。','把“知道了”放整段教学统一结束区，三列说明收束对齐。','层数与终局指引从现行四层规则取值，不保留第五层文案。'],
'BATTLE-SETTLE-RETRY':['“战斗胜利”与“保存未完成”两段呈现。','显示本场奖励/消耗尚待保存的状态，不暗示再领一次。','重试仅保存，正在重试锁按钮；保留原场身份。','成功转原奖励/教学步骤，失败保留结果和具体原因。'],
DOOR:['下一层、门店、留在当前层列成三种明确去向。','主行写当前层→下一层及成本，暂不可去说明原因。','门店是支路入口，不能与直接跨层画成同义按钮。','取消保留原节点，跨层成功才更新层标与场景。'],
'POCKET-RESTORE':['写来源是火堆/祭坛/修鞋铺，次数与成本放候选上方。','可复原牌用勾和已选数，空口袋解释无候选。','确认后牌去向和剩余次数一起更新，失败保留候选。','关闭回来源动作，不能混回地图默认页。'],
'EVENT-CHOICE':['候选药水/军需卡写身份与实得去向。','已扣3币的信息固定显示，取消或满包不能让人误以为还未付款。','满包解释下一步处理，结果用真实命令回包。','返回保留事件与已付状态，防止重复扣币/重复发牌。'],
'EVENT-RECODE':['上方写最多2张、同类型和稀有度限制。','每张原牌与将变结果保留身份，选中数和可确认原因同屏。','提交前可取消选择；提交后只显示一次变化结果。','失败留原牌与选中状态，不能用空列表冒充已重编。'],
'EVENT-GAMBLE':['尝试前写支付成本，缺币原因贴按钮。','支付中、结果已结算、可离开三个阶段明确。','显示真实掷得结果与币/牌变化，不把宣传概率写实测概率。','一次结果只结算一次；再次尝试是新动作且重新展示成本。'],
'LAST-LAMP':['人物名、故事段落、选择成本分区，正文保留舒适阅读宽度。','分段推进时保留当前位置，继续与最终提交不能同时激活。','选项写可知代价与未知结果，不编全剧情结论。','离开前保留阅读/选择状态，具体持久化沿现有接口。'],
'LAST-LAMP-RESULT':['故事结果与“保存失败”分开，失败不能抹掉刚读的结局。','显示已选决定和待保存状态，不能再给重复选择按钮。','重试只重保存；成功回正确事件/终局去向。','长文用单一阅读滚动区，底部返回与状态始终可见。'],
'ALTAR-FRAGMENT-FAIL':['无职业和无能力池写不同原因，保留碎片数量。','明确本次兑换未发生及碎片是否未扣，以真实回包为准。','给返回祭坛入口，不能只有暗按钮。','说明与祭坛共享资源词，不新增另一种货币。'],
'EXIT-PAY':['第三层撤离写弃3张与局内币损失，两种代价分行。','卡不足说明缺多少，确认不可用原因贴动作。','进入献祭页仍保留“紧急撤离”身份，不套祭坛文案。','取消留当前节点；支付成功才进入撤离保存/整理。'],
'EXTRACT-RETRY':['标题明确整理快照未保存，保留原局和待入库数。','未成功前不显示仓库已增长，也不重新生成候选。','重试只保存同一快照，忙碌态阻止连点。','成功回原整理/完成阶段，失败保持可检查的具体原因。'],
DEATH:['标题明确死亡与原因，损失和安全格保留分两块。','列本次真实保留卡/资源，不用仓库总量代替结果。','再来与回基地写去向；失败记录保存后才显示完成。','保存失败走独立重试，不把错误混进死亡氛围大字。'],
BAG:['普通格、安全格、消耗口袋分容器，容量与命运分别标签。','选中物品详情稳定，排序/拖放后定位物品与新格位。','使用、移动安全格、丢弃按类型分动作，禁用原因就近。','容器扩展与旧合成保持现有守卫，未接功能不因计划而上线。'],
'BAG-DISCARD':['确认写具体卡名、整堆数量和不可恢复结果。','取消默认焦点；丢弃与普通金色领取按钮明显分开。','确认期间锁同一UID，防止换物品后旧回调丢错堆。','结束回原背包位置，成功再更新容量。'],
'BAG-PEARL':['珍珠盒与普通包分容器，列资源种类、当前存储和容量。','存入/取出写各自数量与目标去向。','满包取出失败就近解释，不先清盒再失败。','关闭回同一珍珠盒详情，不套法术筛选图标。'],
'BAG-POUCH':['锦囊明确仅法术，候选过滤与容量固定显示。','存入/取出显示牌名及目标容器，空态写无可用法术。','非法类型与满包分别提示，候选不凭空消失。','返回保留锦囊身份和选择，不能套珍珠盒资源文案。'],
'BATTLE-GRAVE':['标题写墓地/已消耗及其规则，与首脑弃牌堆区分。','牌数与空态一致，空墓地直说而不显示缺图。','卡牌支持只读详情，不能从墓地发出出牌命令。','关闭恢复原战场与回合，不能触发回合继续。'],
'BATTLE-DECK':['抽牌与弃牌分标签、真实牌数和列表。','空堆显示明确空态，不能用图库总数代替当场牌。','只读详情回到同一牌堆位置，保持回合状态。','切换牌堆只换内容不重新渲染战斗规则。'],
'BATTLE-BAG':['战中使用道具与移安全格分组，具体可用类型写清。','忙碌、无可用、满格分别原因，物品仍可查看。','使用成功后数量、HP/效果与容量同区更新。','关闭回原战场，不因查看背包恢复错误目标或重开回合。'],
'BATTLE-CHOICE':['标题明确N选一，候选比暗化战场更突出。','选中框、效果全文与确认连在同区，不能暗示普遍可跳过。','提交中只结算一项，结果回对应牌效。','规则允许取消才显示取消，强制流程保留诚实原因。'],
'BATTLE-PAYMENT':['主牌与可选燃料分区，写必须选满的数量和已选数。','主牌UID排除与同名不同卡数量可见，不只按名字高亮。','未付满时确认写原因，不能看似主牌已发动。','可选跳过与强制支付不同模板状态；取消恢复未发动主牌。'],
'BATTLE-DISCOVER':['候选牌标“仅当场/战后消散”及将进入手牌。','选中后真实入手，再更新牌数；空池解释无候选。','只展示真实可选牌效果，不能用卡库页代验。','关闭/取消按现行规则，选中结果回原牌效链。'],
'BATTLE-INFUSE':['主牌、燃料区、已选数量、确认/取消/直接打四区明确。','同名燃料按UID与数量标记，轮换时不残留旧勾。','确认前写实际费用与结果摘要，直接打说明未注能。','取消恢复主牌；成功后燃料消耗、主牌发动与目标反馈连起来。'],
'BATTLE-TARGET':['合法目标用轮廓/文字与预览成对，非法目标直接写原因。','伤害未知明确写未知，不给假精确数。','当前选牌、目标、实算意图保留持续信息，短特效不盖数字。','取消目标回手牌选择，目标失效重算后说明，不结算旧预览。'],
'BATTLE-SETTINGS':['小设置面板保留战场上下文，速度/音量按真实可用项分组。','减动态影响短效，保留伤害、意图和状态文字。','关闭返回同一回合，不重开全局设置或重新战斗。','实际改值后就地显示新值，重载/听感只验已操作范围。'],
'TERM-TIP':['说明贴触发词边缘，位置避开当前数值和目标。','悬停与键盘焦点都可开，同一词仅一个浮层。','未知词不弹空框；长说明给完整可读文本。','离开词/关闭来源就清浮层，避免残留到另一页面。'],
'NODE-NOTE':['页顶继续写层/节点坐标与当前对象，原备注和编辑区分。','输入框沿现有冷青承托，替换突兀纯黑默认表单；只做CSS小修，不新画工具资产。','保存为主动作、取消相邻，清空独立风险项；取消不改数据。','保存状态贴输入，失败保留全文；返回保持地图同一节点，不把备注当实际事件配置。'],
'NOTES-EXPORT':['标节点备注、版本、数量，与馆方备注区别。','文本可手选，复制/下载分按钮。','复制失败保留内容和下载出口。','导出成功只写生成文件/复制结果，不写已经备份到云端。'],
'NOTES-IMPORT':['JSON输入与v3/v2兼容说明同区。','合并覆盖同格与新增数量先给预览，错误定位具体行。','部分失败分成功/失败条目，不能笼统写已导入。','执行失败保留原文；返回编辑器恢复当前位置。'],
'NOTES-CLEAR':['写不可恢复的具体备注数量与范围。','取消默认焦点，清空风险按钮独立。','忙碌态阻止重复提交，结果据实际命令回包。','本轮只评确认设计，不执行实际清空造证据。'],
'DEV-DEBUG':['页顶常驻“开发工具，操作可能影响存档”，调试获胜等明确辅助标签。','资源、发牌、战斗、路由工具按影响范围分组。','危险命令写目标档/局与结果，执行后留下可追溯记录。','玩家入口受守卫，计划不替老板启用开发开关。'],
'DEV-AGENT':['策略、运行/停止、turbo、LLM配置四区明确。','常驻显示真人/Agent/调试接力与当前运行状态。','停止按钮随时可达，运行中不能被日志推屏外。','错误写具体阶段与重试范围，敏感配置不输出到证据。'],
'DEV-DATA':['沿跑局数据事实模型，新增开发壳身份而非复制统计规则。','正常/脚本/调试/接力标签与每局记录对应。','携出候选与实际入库分列，样本数与空统计明确。','导出/清空分区，清空范围确认；不把辅助胜率当自然平衡。'],
'DEV-KEYS':['路由按实际守卫显示可用/禁用。','战中或进行中禁止基地写原因，不只暗按钮。','快捷键与点击调用同入口，成功后显示具体去向。','辅助导航写证据来源，不能计作正常走线覆盖。'],
'SFX-AUDITION':['库/方案/搜索与当前播放两区，显示实际cue名。','播放、失败、停止、循环、连续状态分开，失败不能显示正在播放。','进度与音量有数字；试听日志标实际使用来源。','先核现有cue/scene接线再听，不为补计划安装音库或改全局音频。'],
'HOME-SCENE':['保留源码存在/未接入口标识，先确认老板是否解冻才安排实页。','若获准启用，家具、陈列、拖放合法位分别状态。','抓取→预览位置→放置→取消保持对象身份，不能先提交后预览。','布置保存与物品拥有分开，未授权不接入口。'],
'LAB-DOOR':['保持暂缓标签，研究所与主远征四层入口分清。','钥匙要求、旧档兼容与不可用原因贴门动作。','只先核可达/守卫，不以主图出口证据代验。','获得解冻授权后再取稳定门帧，不现在接入口。'],
'LAB-PREP':['独立nestRun标识常驻，卡箱、符文与容量分区。','选择变化同步预览与成本，不能套主远征背包字段。','确认前列本次实际带入清单，失败保留选择。','暂缓阶段仅列计划；解冻后独立验保存与返回。'],
'LAB-MAP':['独立顺序节点与符文/元素盒子导航标识，不套主四层路线。','当前、完成、可继续三态分形状和文字。','资源和节点结果贴相关位置，不借主图HUD证明。','暂缓不接入口；解冻后再定场景构图与实际滚动。'],
'LAB-RUNES':['候选、开盒、继续三阶段分别标题与动作。','空符文池解释原因，不能留空框像资源失败。','揭晓后数量与所选符文同区更新，只提交一次。','取消/返回沿独立研究所规则，解冻后才实页核。'],
'LAB-ALTAR':['能力候选、重掷成本、继续分区。','重掷前后候选身份和资源扣除保持连续。','不足与空池分别原因，失败保留旧候选。','共享选择组件但不共享主图祭坛经济，暂缓不实施。'],
'LAB-SHOP':['牌、职业、符文货分品类与实际币种。','每货物写成本、去向、不足/售罄原因。','购买结果同步独立nest资源，不能并入主仓库。','暂缓先保留清单，解冻后按各品类一个边界验。'],
'LAB-RETRY':['首句写研究所结果未保存，独立nest局身份可见。','待保存分数/符文与失败原因分区，不能借主远征成功图。','重试只保存同一结果，忙碌锁定重复提交。','成功回研究所结算；未解冻不故障注入真实存档。'],
'LAB-ENDING':['三结局保留独立故事、插画与返回身份，不当主图结尾。','解冻后先核入口、素材和稳定长文，再评画面。','继续/跳过/回标题按真实规则分工，演出不能盖保存失败。','未解冻只排资源校对与文本结构，不新画三张插画。'],
'LAB-DONE':['标题明确研究所行动结算，计分/符文与主远征入库区别。','本次所得与历史累计分开，返回标题稳定可见。','完成之前核独立nest保存结果，失败转专属重试。','暂缓阶段不实施、不拿主图22/25仓库作验收。'],
};

const cssByKind={
title:['game/css/title-p0.css','game/css/page-slot-select.css'],
hub:['game/css/expedition-hub.css','game/css/page-hub.css'],
stash:['game/css/page-stash.css','game/css/expedition-inventory.css'],
prep:['game/css/preparation.css','game/css/page-deploy.css','game/css/expedition-roster.css'],
cards:['game/css/card-v3.css','game/css/cards.css','game/css/overlays.css'],
map:['game/css/expedition-map.css','game/css/page-expedition-hud.css'],
reward:['game/css/expedition-rewards.css','game/css/page-rewards-bag-help.css','game/css/pocket-strip.css'],
battle:['game/css/battle.css','game/css/expedition-battle.css','game/css/combat-feedback.css'],
studio:['game/css/page-cardslib.css','game/css/photo-studio-mounts.css'],
collection:['game/css/page-ach.css','game/css/page-classes.css'],
event:['game/css/page-events.css','game/css/scenes.css'],
settings:['game/css/page-settings.css','game/css/overlays.css'],
tools:['game/css/page-datapage.css','game/css/overlays.css'],
lab:['game/css/lab-ending.css','game/css/scenes.css'],
overlay:['game/css/overlays.css','game/css/expedition.css'],
};
function kind(r){
 const id=r.id;
 if(['STASH-CONFIRM','MATERIAL-CONFIRM','BAG-DISCARD','LEAVE','ABANDON-DONE','TERMINAL-RETRY','EXTRACT-RETRY','BATTLE-SETTLE-RETRY','DEATH'].includes(id))return 'overlay';
 if(['BATTLE-REWARD','AMMO-TUTORIAL','CLASS-GRANT'].includes(id))return 'reward';
 if(['HUB-SHOP','RUN-SHOP','RUN-SELL'].includes(id))return 'shop';
 if(id.startsWith('LAB-'))return 'lab';
 if(['TITLE','SLOTS','SLOT-RECOVERY','EXIT-SCREEN'].includes(id))return 'title';
 if(id.startsWith('BATTLE')||id==='BOSS-BATTLE')return 'battle';
 if(id==='BOSS-DECK'||id.startsWith('CLASS-')||id.startsWith('PREP'))return 'prep';
 if(id==='MAP')return 'map';
 if(id==='STUDIO'||id==='PHOTO-ZOOM')return 'studio';
 if(id==='CARD-ZOOM')return 'cards';
 if(id.startsWith('STASH')||id==='HUB-STASH'||id==='HUB-PETS'||id.startsWith('BAG')||id==='MATERIAL-CONFIRM')return 'stash';
 if(id.startsWith('CHEST')||id.startsWith('EXTRACT')||id.startsWith('EXIT-')||id==='AMMO-TUTORIAL'||id==='CLASS-GRANT')return 'reward';
 if(id.startsWith('HUB-ACH')||['HUB-BACKS','HUB-COLLECTION','TITLE-ACH'].includes(id))return 'collection';
 if(id.startsWith('HUB-')||id==='HOME-SCENE')return 'hub';
 if(id==='SETTINGS'||id==='GUIDE')return 'settings';
 if(id.startsWith('DEV-')||id.startsWith('NOTES-')||id.startsWith('CARDS-')||['DATA','NODE-NOTE','CARD-DESIGNER','SFX-AUDITION'].includes(id))return 'tools';
 if(id.startsWith('EVENT')||id.startsWith('LAST-LAMP')||['FIRE','ALTAR','SACRIFICE','ALTAR-REWARD','ALTAR-FRAGMENT-FAIL','PICKUP','NODE-SAFE','RUN-TRANSITION','DOOR','POCKET-RESTORE','RESOURCE-PICK'].includes(id))return 'event';
 return 'overlay';
}
const templates={
shop:{reuse:'ShopOffer / ResourceCostRow / PurchaseResult',layout:'货架对象、效果与价格同格，当前余额/容量固定，离开和收购台作稳定次动作。',type:'货物名/用途/价格优先，规则用旁侧正文，缺币/满库原因贴购买动作。',color:'仅购买动作禁用变暗；货物仍可读，局内币/储备币有完整标签。',material:'沿现有货架/卡图与冷青面板，不用新增装饰取代商品身份。',resource:['UI-R01','UI-R02','UI-R03','UI-R06']},
title:{reuse:'ArchiveEntry / SlotStateCard',layout:'主入口保留人物三角焦点；档位使用同基线五卡，信息按状态替换中段。',type:'主标题最大；档位状态/角色次之；必要说明用实色正文，花体只作装饰。',color:'沿冷青冬境与金主动作，异常用文字和暗红风险标签。',material:'保留废墟/雾景与档案徽记，文字后有安静承托，不加第二套材质。',resource:['UI-R01','UI-R02','UI-R04']},
hub:{reuse:'HubPageHeader / ResourceCostRow / GrowthItem',layout:'共享资源顶栏、页签和标题，主对象靠中段，成本与动作邻近。',type:'对象名称→当前/升级后数值→成本→说明；中文标签稳定，英文降级。',color:'冷青底、金可执行主动作、蓝返回；不足原因用正常正文。',material:'沿冬境终端板与人物/物件原图，正文区降低纹理。',resource:['UI-R01','UI-R02','UI-R06']},
stash:{reuse:'InventoryGrid / ItemActionPanel / RiskConfirm',layout:'各容器独立标题/容量，网格单主滚动区，选中物品与操作靠在一起。',type:'物品名/堆数/去向优先，完整效果沿详情；真实资源与卡牌明确命名。',color:'金用于保留收益主动作；暗红用于丢弃/末张消耗；禁用仅作用动作。',material:'沿卡牌、仓库槽和冷青面板，不把所有物品都套同一图标。',resource:['UI-R02','UI-R03','UI-R04','UI-R06']},
prep:{reuse:'CardSelectionGrid / SelectionSummary / CharacterPreview',layout:'候选与预览并列，已选/要求/容量固定摘要，确认动作不随列表滚走。',type:'人物/规则摘要优先，长牌效果在大预览，网格只放可决策短句。',color:'人物与卡选择用勾+框，皮肤细金线；风险与不足文字独立。',material:'保留既有立绘和冷青档案框，首脑编组承接门页身份。',resource:['UI-R01','UI-R02','UI-R03','UI-R07']},
cards:{reuse:'CardDetail / NoteSaveState',layout:'大卡居中为主体，备注独立块，暗化底层保留来源。',type:'费用/名/类型/效果沿现有卡面语法，备注与系统规则分标签。',color:'卡稀有度沿原框，备注用稳定亮正文，保存错误单独风险字。',material:'保留卡图与框式，不叠额外纹理或通用玻璃卡。',resource:['UI-R01','UI-R03']},
map:{reuse:'MapNodeState / RouteChoiceRow / CompactLog',layout:'地图主舞台、边缘状态区、完整可行路线与目标同屏，日志不盖节点。',type:'当前层/节点、去向/成本、目标、日志顺序；未知内容明确标未知。',color:'当前金、可去冷青、不可去低权重，但形状/文字承担状态。',material:'保留四层背景与地图连线，背景低对比而节点清楚。',resource:['UI-R02','UI-R09']},
reward:{reuse:'RewardHeader / LootChoice / CapacitySummary / SettlementSummary',layout:'短结果条→完整奖励→领取/管理背包；终局先净收获与风险，统计折叠。',type:'箱规则/真实入库数/剩余数最大，装饰横幅降级，长规则沿详情。',color:'金用于确定收获，棕警告改短风险摘要，结束丢失用暗红加文字。',material:'沿箱体/冷青面板/卡牌原画；箱体作辅位，避免材质挤牌。',resource:['UI-R02','UI-R03','UI-R04','UI-R05']},
battle:{reuse:'BattleIntent / HandCardDetail / TargetPreview / SelectionSummary',layout:'双方舞台→持续状态→手牌操作；意图、HP、词缀各有区域，选牌能完整展开。',type:'实际伤害/费用/目标优先，长期规则徽记+详情；底部不截关键数值。',color:'保留双方与稀有度语法；危险有文字，合法目标有轮廓，禁用原因可读。',material:'保留场景纵深、人物和扇形手牌；HUD安静，不叠全屏粒子。',resource:['UI-R02','UI-R03','UI-R06','UI-R07','UI-R10']},
studio:{reuse:'PhotoIndex / PhotoPreview / BackNoteEditor',layout:'索引工具栏、照片主画幅、统一背签阅读区，选片与页码稳定。',type:'照片名/类型/编号清楚，效果与备注分标签；长文只在背签滚动。',color:'保留纸面/深绿背签与稀有度名字色，工具按钮服从照片。',material:'保留照片护角、夹子、纸索引，不强行改成战斗终端。',resource:['UI-R01','UI-R03','UI-R08']},
collection:{reuse:'CollectionHeader / ProgressRow / UnlockState / RewardClaim',layout:'公共页眉收紧，首屏让卡背/成就/收藏对象出现，奖励贴领取。',type:'对象名→达成/锁条件→奖励/数量，故事长文展开，分母按真实池。',color:'可领金、未达成文字标签、已领勾；当前使用不等同解锁。',material:'沿现有档案/卡背陈列，保留人物与卡身份，不全量重画收藏图。',resource:['UI-R01','UI-R02','UI-R08']},
event:{reuse:'SceneHeader / NarrativeChoice / CostResultRow',layout:'标题、短叙事、代价选择与结果分段；资源及来源在操作旁。',type:'已知代价/可选条件稳定正文，长故事保持阅读宽度，不以细字挤在按钮里。',color:'金作确认/收益、蓝作安全返回；未知与不足用明确文字。',material:'保留各场景插画与冷青叙事区，图标沿既有身份，不因历史破图换画。',resource:['UI-R01','UI-R02','UI-R04','UI-R06']},
settings:{reuse:'SettingGroup / PreferenceRow / SourceReturn',layout:'单列功能行分组，音频与危险区分开，关闭回原来源。',type:'中文标签优先，值/状态就地显示；完整正文先取稳定帧再定对比。',color:'开关勾+色，未勾空框；清空独立风险色，说明不随禁用一起变暗。',material:'沿安静冷青面板，减少纹理；功能控件不需要额外装饰插画。',resource:['UI-R01','UI-R02','UI-R04','UI-R10']},
tools:{reuse:'ToolPanel / OperationResult / RunProvenanceLabel',layout:'配置/输入、执行动作、结果/日志分区，停止和错误出口固定可达。',type:'来源/范围/样本数与错误原因优先，JSON/日志沿等宽已有字体，不下载字体。',color:'开发标签常驻，成功/失败文字分开；危险写入与导出分色。',material:'功能面板简洁，沿现有终端壳；不为工具页制作叙事背景。',resource:['UI-R01','UI-R02','UI-R04','UI-R05','UI-R10']},
lab:{reuse:'DeferredLabShell / NarrativeChoice / OperationResult',layout:'独立nest身份、暂缓标记常驻；解冻后才核候选/地图/结算真实构图。',type:'独立分数/符文/资源与主图入库词汇分开；未見实页不定字号。',color:'先复用现有冷青壳，研究所专属色仅解冻后据稳定图决定。',material:'保留现有研究所资产清单，不现在新画三结局或接入口。',resource:['UI-R02','UI-R06']},
overlay:{reuse:'SourceOverlay / OperationResult / RiskConfirm',layout:'标题+来源对象+当前阶段+明确动作，返回保持原页上下文。',type:'动作代价、结果和错误先于氛围；必要说明用稳定正文。',color:'主动作金、安全返回蓝、损失风险暗红并有文字，不能只靠颜色。',material:'沿现有冷青通用壳，局部身份用对象图，不新增通用满屏纹理。',resource:['UI-R01','UI-R02','UI-R04']},
};

const phaseDefs={PH0:'事实与组件基线：当前窗口补稳定帧、结果字段/安全区/来源回退契约；只动获授权范围。',PH1:'已证高代价问题：标题遮挡、风险确认、保存/净收益事实、错误层数。',PH2:'核心操作：整备、卡牌阅读、地图、战斗信息与首脑编组。',PH3:'基地成长、收藏与说明工具的一致性。',PH4:'暂缓/未接入口：保留计划，解冻授权后再验证和排开发。'};
const urgent=new Set(['CLASS-GRANT','CHEST-PICK','SACRIFICE','EXTRACT-STASH','EXTRACT-DONE','MAP','AMMO-TUTORIAL','DATA','DEV-DATA']);
const core=new Set(['PREP','CLASS-CHOICE','CLASS-POOL','BATTLE','BOSS-DECK','BOSS-BATTLE','BOSS-GATE','CHEST-ALL','BATTLE-REWARD','EXIT-PAY','EXIT-FINAL','EXTRACT-RETRY','DEATH','TERMINAL-RETRY','BATTLE-SETTLE-RETRY','BATTLE-TARGET','BATTLE-INFUSE','BATTLE-CHOICE','BATTLE-PAYMENT','BATTLE-DISCOVER','BAG']);
const riskIds=new Set(['STASH-CONFIRM','MATERIAL-CONFIRM','BAG-DISCARD','LEAVE','ABANDON-DONE','NOTES-CLEAR']);
const compoundBroken=new Map([['SACRIFICE',{location:'选择标题与口袋条',symptom:'口袋条压选择标题。',impact:'主任务与必须支付数量的入口被固定资源层争占；需要先分轨再谈装饰。',direction:'选择标题与固定口袋条分配独立安全区。',acceptance:'标题全句、已选/要求计数与候选不被口袋条覆盖。'}]]);

function filteredIssues(r){return (r.issues||[]).flatMap(q=>{
 if(!/破图|alt|失效图标/.test(q.symptom))return [q];
 if(compoundBroken.has(r.id))return [compoundBroken.get(r.id)];
 return [];
});}
function evidenceLevel(r){if(r.id==='TERMINAL-RETRY')return 'RENDERER_FIXTURE';if(r.id==='EVENT'||r.id==='HUB-BACKS')return 'TRANSITION_ONLY';return r.evidence.length?'IMAGE_REVIEWED':'SOURCE_ONLY';}
function dispatchGroup(r,k){
 if(k==='lab'||k==='tools'||r.id==='HOME-SCENE')return '工具研究所';
 if(k==='battle'||['BOSS-GATE','BOSS-DECK','BATTLE-REWARD'].includes(r.id)||r.id.startsWith('EXTRACT')||(r.id.startsWith('EXIT-')&&r.id!=='EXIT-SCREEN')||['DEATH','ABANDON-DONE','TERMINAL-RETRY','AMMO-TUTORIAL'].includes(r.id))return '战斗结算';
 if(k==='map'||k==='event'||r.id.startsWith('CHEST')||r.id.startsWith('RUN-')||r.id==='CLASS-GRANT'||r.id.startsWith('BAG'))return '探索事件';
 return '入口基地';
}
function motion(r,k){
 const pending='以下为拟定实现与验收规范；除BATTLE悬停外，其它本项目动态未观察。STS仅有限宣传短循环可支持战斗短效/持续HUD分层，不证明真实响应速度。';
 if(r.id==='BATTLE')return {trigger:'已证：IAB协议mouseMoved悬停初始攻击；拟定：长牌、选目标及出牌结算',process:'已证卡框由136×131/y624变为约141×194/y555，末态轻放大scale1.04与translateY-12并展开描述；保留它，核长牌展开不压HP/意图。出牌链另行验证',end:'已证559ms采样末态仍展开；拟定离开恢复卡位，结算后留真实HP/能量/牌数',interrupt:'悬停退出/取消选牌应恢复原牌；路由退出清临时层；忙碌不重复结算；减动态保留描述和结果文字（均待验）',evidenceLimit:'diagnosis/interface-captures/BATTLE-card-hover-motion.json + BATTLE-HOVER-healthy.jpg；document.hidden=false，IAB协议输入；不测FPS、物理真人延迟，不外推长牌/拖拽/键盘/出牌动态。'};
 if(k==='battle')return {trigger:'选牌/选目标、真实出牌结算、敌方动作或阶段变化',process:'先保留选牌/目标，再在目标附近显示一次短效和变化数值；持续HP/意图/状态原位更新',end:'动作完成清短效，留下真实HP/能量/牌数和可操作状态',interrupt:'取消选牌恢复原牌；路由退出清临时层；忙碌阶段不重复结算；减动态保留结果文字',evidenceLimit:pending};
 if(['reward','stash','prep'].includes(k))return {trigger:'勾选/领取/移入/处置/确认的真实操作',process:'选中先给框与勾；执行中只锁该动作；成功后计数与目标位置就地变化，不长时间飞牌',end:'留下对象、数量和去向；失败保留原候选与原因',interrupt:'取消恢复选择；关闭失效旧回调；保存重试不重复发奖；减动态直接更新同样结果',evidenceLimit:pending};
 if(k==='map')return {trigger:'合法移动与节点进入',process:'标出当前→目标连接，资源与行动数据结果更新；日志只出现一条短反馈',end:'新当前节点、合法路由与目标稳定显示',interrupt:'重复点击守卫；离开清旧过场；减动态直接稳定到目标节点',evidenceLimit:pending};
 if(k==='studio'||k==='collection')return {trigger:'筛选、选片、解锁/领取与切换子页',process:'内容就地替换并保留选中身份；仅用短淡入解释新对象，不逐项拖延全部列表',end:'照片/条目、页码、进度与状态固定',interrupt:'连续筛选只采用最后请求；关闭取消旧更新；减动态直接呈现',evidenceLimit:pending};
 if(k==='lab')return {trigger:'解冻后对应研究所场景/选择/结算入口',process:'先验证真实流程；仅沿现有过场，阶段文字常驻',end:'独立nest状态与保存结果稳定',interrupt:'返回/失败保持原对象；未解冻不实施新增演出',evidenceLimit:pending};
 return {trigger:'进入/关闭本页、提交设置/输入或恢复操作',process:'来源对象和当前阶段持续显示；过渡只用于层级变化，保存中有文字而非无限装饰旋转',end:'稳定页/真实结果，并恢复原来源焦点',interrupt:'关闭取消旧回调；错误保留输入；减动态直接出现稳定内容',evidenceLimit:pending};
}
function sourceFile(p,line,anchor){return {path:p,line:line||null,anchor:anchor||null,exists:fs.existsSync(p)};}
function assets(k,r,issues){
 const out=['复用本页已有插画/卡图/人物与图标；新素材制作前核恢复来源加载。'];
 if(k==='battle')out.push('状态/意图/合法目标标记先用CSS与既有图标；仅现有图标无法表达的已核规则才补单枚矢量。');
 else if(k==='reward')out.push('结算缩略牌、箱体沿现有资源；净收益/丢失/保存状态优先用文字与组件。');
 else if(k==='studio'||k==='collection')out.push('照片护角/卡背/纸索引沿现有资产；只校对裁切和标签。');
 else if(k==='lab')out.push('暂缓：先登记现有资源与实际入口，解冻前不新增插画。');
 else out.push('优先CSS层级、字阶、间距与既有矢量；需要新增图标时列具体语义再制作。');
 if(r.id==='BOSS-GATE'||r.id==='BOSS-BATTLE')out.push('首脑身份名牌或既有首脑剪影；不新增整幅背景。');
 return out;
}
const pages=art.records.map(r=>{
 if(!plans[r.id])throw new Error('Missing concrete plan '+r.id);
 const k=kind(r),t=templates[k],issues=filteredIssues(r),level=evidenceLevel(r),sourceOnly=level==='SOURCE_ONLY';
 const phase=r.source.state==='deferred'||r.id==='HOME-SCENE'?'PH4':urgent.has(r.id)?'PH1':core.has(r.id)||riskIds.has(r.id)?'PH2':'PH3';
 const priority=phase==='PH4'?'P3':phase==='PH1'?'P1':core.has(r.id)?'P1':'P2';
 const related=inv.functionFamilies.filter(f=>f.interfaceIds.includes(r.id));
 const ref=refs.records.find(x=>x.id===r.comparator.referenceId);
 const actual=issues.map(x=>({location:x.location,symptom:x.symptom,whyRough:x.impact||'该信息与主动作未在同一视线链上；先恢复阅读与因果，再决定装饰。',status:r.id==='TERMINAL-RETRY'?'CONFIRMED_RENDERER_SAMPLE':'CONFIRMED_STATIC',acceptance:x.acceptance}));
 if(!actual.length)actual.push({location:'证据边界',symptom:sourceOnly?r.visualFocus.replace('源码层审查重点：','需验证的风险：'):level==='TRANSITION_ONLY'?'已有图是过渡/初始帧，正文或对象稳定状态未见。':'已有稳定部分未发现新的明确静态缺陷；其余状态和操作仍待核。',whyRough:sourceOnly?'尚无该页实图，不能断言它粗糙、不高级、遮挡或缺素材；以下改法是条件设计与验收要求。':'不能把未验边界或过渡帧写成实际美术缺陷；先保留已成立结构，针对剩余风险定向复核。',status:sourceOnly?'UNVERIFIED_RISK':'VERIFICATION_ONLY'});
 const affected=[sourceFile(r.source.path,r.source.line,r.source.anchor),...(k==='shop'?['game/css/expedition-shop.css','game/css/page-shop.css']:cssByKind[k]).map(p=>sourceFile(p))];
 if(r.id==='CARD-DESIGNER')affected.push(sourceFile('game/css/page-cardforge.css'));
 if(r.id==='SFX-AUDITION')affected.push(sourceFile('game/css/sfx-audition.css'));
 if(r.id==='HUB-UPGRADE')affected.push(sourceFile('game/css/page-upgrade.css'));
 if(r.id==='HUB-CLASSES')affected.push(sourceFile('game/css/page-classes.css'));
 if(['CLASS-GRANT','CHEST-PICK','SACRIFICE'].includes(r.id))affected.push(sourceFile('game/src/experience/pocket-strip.js'),sourceFile('game/css/pocket-strip.css'));
 if(['EXTRACT-DONE','DATA','DEV-DATA'].includes(r.id))affected.push(sourceFile('game/src/agent/agent.data.js'));
 const uniqueFiles=affected.filter((v,i,a)=>a.findIndex(x=>x.path===v.path)===i);
 const architecture=['保留现有Vite/DOM与'+r.source.anchor+'入口；先提取局部视图组件，不改玩法/存档框架。','共享'+t.reuse+'，内容和状态由现有数据传入；实际命令沿原守卫和成功回包更新。','来源返回保持 '+r.source.returnTo+'；持久化口径：'+r.source.persistence+'。'];
 if(related.length)architecture.push('定向行为对账：'+related.map(f=>f.id+' '+f.intent).join('；')+'。');
 const dependencies=['PH0：当前源码/入口与稳定帧核对','UI-R02：共享安全区/来源回退规范'];
 if(k==='battle')dependencies.push('UI-R03：卡摘要/详情','玩法实算预览与意图事实契约','UI-R10：现有cue/scene接线后试听');
 if(k==='reward')dependencies.push('UI-R05：奖励与终局统一事实对象','server-repair：恢复来源素材已正常；仅定向重看');
 if(k==='lab')dependencies.push('老板明确解冻研究所；当前只登记计划');
 if(r.id==='HOME-SCENE')dependencies.push('老板明确接通基地布置入口');
 const acceptance=[...issues.map(x=>x.acceptance),...r.unverified.filter(x=>!(healthyUpdates[r.id]&&/暂无|需获得当前窗口稳定帧/.test(x))).map(x=>'定向核：'+x),'仅当前平台内置浏览器、当前窗口复核，注明正常输入/辅助入口；无额外多尺寸。','实际动作前后配对对象/数量/来源；源码和静态帧不能代替操作、音频或自然通关。'];
 if(r.id==='BATTLE')acceptance.push('已证初始攻击悬停上抬/轻放大/描述展开必须保留；新增只验长牌与安全区，不宣称无动效或所有出牌动态已验。');
 if(r.id==='TERMINAL-RETRY')acceptance.push('fixture只支持renderer文案与布局批注；不能标实际保存失败恢复已通过。');
 return {id:r.id,name:r.title,group:r.group,dispatchGroup:dispatchGroup(r,k),evidenceLevel:level,evidenceBasis:{status:r.status,images:r.evidence,source:r.source,limits:art.boundary,repairCorrection:/破图|alt/.test((r.issues||[]).map(x=>x.symptom).join(''))?'原服务断开造成的破图已由server-repair 32图解码、0破图证明排除；本计划不据这些占位评价原画。':null},sourceOnly,currentProblems:actual,strengths:r.strengths.length?r.strengths:['保留现有功能边界：'+r.source.boundary+'；视觉优点未核，不编造。'],changes:plans[r.id],layout:t.layout,type:t.type,color:t.color,material:t.material,motion:motion(r,k),affectedFiles:uniqueFiles,reuseComponent:t.reuse,architecture,reference:{referenceId:ref.id,game:ref.game,level:ref.staticEvidence.level,canBorrow:r.comparator.canBorrow,cannotCopy:r.comparator.cannotCopy,motionLevel:k==='battle'&&ref.id==='VC-STS-01'?ref.motionEvidence.level:'M0',limit:ref.staticEvidence.level==='D1'?'仅官方/作者设计依据，未见像素；不比较实际画面水平。':'只借已见静态信息分工，不能从商店图推出互动品质。'},assetsNeeded:assets(k,r,issues),resourceIds:t.resource,tools:['现有Node/npm定向脚本与rg定位；按WORKFLOW-TOOLS使用workflow verify留证','当前Codex/ZCode内置浏览器：当前窗口稳定帧、正常动作前后与图片解码','CSS/DOM局部原型；图标优先现有SVG/CSS，不安装框架或改全局配置',...(k==='battle'||k==='settings'||r.id==='SFX-AUDITION'?['现有sfx-audition与cue日志；未试听前不评价听感或补全套音库']:[])],acceptance,priority,phase,dependencies,scopeCost:['BATTLE','BOSS-BATTLE','MAP','EXTRACT-STASH'].includes(r.id)?'大':riskIds.has(r.id)||['TITLE','RUN-SELL','ALTAR-FRAGMENT-FAIL','TERM-TIP','NODE-NOTE'].includes(r.id)?'小':'中',costNote:phase==='PH4'?'仅同类范围粗分；暂缓，解冻后以实页和规则重新估，不承诺工时。':'只按改动范围粗分，不承诺精确工时。'};
});

const variantDetails={
'CLASS-CHOICE':v=>['人物身份：'+v.name+'（'+v.value+'）。只替换该人物立绘/皮肤/起始规则，不另建页面壳。','检查该人物姓名长度、实际可用皮肤与补给/卡池摘要一致；当前人物勾与当前皮肤线分开。'],
'CLASS-POOL':v=>['卡池身份：'+v.name+'。共享10张上限均衡分页，池数取该职业真实过滤结果。','选该职业后大预览、网格、页码一起换；用该职业最长能力/注能牌验全文，不用无的截图代验。'],
'HUB-CLASSES':v=>['成长档案：'+v.name+'。列该人物实际等级/XP/生命加成与已解锁皮肤。','四项数据更新同列，皮肤预览与持久选用分开；无的四皮肤排法不能外推其它人物。'],
'HUB-COLLECTION':v=>['收藏分组：'+v.name+'。分母按该职业真实池，不把总67当个人池。','零收藏、部分收藏与里程碑取该职业真实状态；收藏消耗/熟练度与战斗消散分别标签。'],
'HUB-HELP':v=>{const detail={deploy:'标准/精英、整备、目标预设与钥匙门暂缓',stash:'仓库/口袋/宠物与真实资源去向',shop:'储备币购货、空格与不足原因',upgrade:'木材扩建、口粮宠物升级与上限',classes:'人物XP、皮肤与卡池查看',ach:'卡背、成就领奖、职业收藏三子页'};return ['帮助内容：'+detail[v.value]+'。标题用中文来源页名。','只写该页实际命令；关闭回'+v.value+'页签与原位置，不能共用默认返回。'];},
'HUB-DEPLOY':v=>['模式：'+(v.value==='standard'?'标准：敌/币/XP倍率1，完整四层、第四层祭坛与首脑后终局撤离':'精英：敌/首脑属性×1.5、战斗币×1.5、XP+50%，描述高稀有掉落+20%')+'；同地图倍率变体，非新增地图。','首行显示该模式实际倍率；带回规则沿同一经济来源，不暗示精英有另一套带回比例。选中勾与模式名一致，标准图不能代验精英文字。'],
'CHEST-ALL':v=>{const d={small:'小箱：沿实际奖励数逐收/全收，不能误写三选一。',big:'大箱：候选较多时仍固定容量与至少一张完整奖励。',class:'职业箱：职业牌身份与消散/收藏规则单独说明。',bossReward:'首脑保险柜：首脑身份、主要奖励与终局去向串起来。',multiQueue:'多箱队列：当前第几箱/剩余几箱固定，离开当前箱后写真实下一步。',fullBag:'满包：管理背包与返回同一候选；不能把人工可离开样本写成永久卡死。',emptyCatalog:'空目录：说明本次无候选与可离开，不能画成素材加载失败。'};return [d[v.value],'数量、可领、留下与错误结果沿共享箱模板，但逐一对该箱实际规则；不复制一整套美术壳。'];},
'CHEST-PICK':v=>['中箱medium：明确三选一，选中一张后其它候选的命运。','选牌与详情分开，满包拒收保留三候选；不用全收箱操作代验。'],
MAP:v=>['第'+v.value+'层：使用该层真实背景、节点池、层标题与合法路线。',v.value===3?'第三层有紧急撤离代价入口，固定日志不盖当前节点；不能拿第一层图代验。':v.value===4?'第四层祭坛→首脑→终局出口，终局不提示第五层；辅助走线标清。':'前两层无成功出口是现行规则事实，地图要说明可知去向；是否改规则需另做玩法实验。'],
'HUB-BACKS':()=>['backs子视图：卡背解锁/选用身份，沿HUB-BACKS计划；属于同一基本页别名。','本条仅验tab路由与返回，不重复制作一套卡背页。'],
'HUB-ACHIEVEMENTS':()=>['achievements子视图：可领成就与真实奖励，沿HUB-ACHIEVEMENTS计划。','本条验tab路由、领奖后计数与位置保持，不重复基本页美术工作。'],
STUDIO:v=>['筛选类型：'+v.value+'；当前类型标签、结果数与页码对应真实TYPES数据。',v.value==='全部'?'取消类型限制后保留其它搜索条件并重算页数；“全部”不等于当前所有卡已可获得。':'该类可能零卡，明确“当前条件无结果”；用该类长名/效果取稳定详情，不承诺每类有卡。'],
'LAB-ENDING':v=>['结局内容：'+v.value+'；独立文本/插画，暂缓研究所，非主图终局。','解冻后各自校对故事段落、插画实际加载与返回，当前不新绘三图或假称已见。'],
};
const artVariants=new Map(art.records.flatMap(r=>(r.variantAnnotations||[]).map(v=>[v.id,v])));
const variants=inv.variants.map(v=>{
 const p=pages.find(p=>p.id===v.templateId),a=artVariants.get(v.id); if(!p)throw new Error('Variant parent absent '+v.id);
 const changes=v.id==='HUB-ACH-VIEW-CLASSES'?['classes子视图：职业收藏室整体入口，沿HUB-COLLECTION计划，不是某个人物变体。','本条只验tab路由、返回与总体进度；五人物收藏分组另有独立变体行，不重复制作。']:(variantDetails[v.templateId]||(()=>['沿基本页内容契约单独核本变体。','返回及计数按真实状态。']))(v);
 const sources=v.source.split(';').map(s=>s.trim()).map(s=>{const m=s.match(/^(.*?)(?::(\d+))?$/);return sourceFile(m[1],m[2]?Number(m[2]):null);});
 const level=a?.evidence?.length?'IMAGE_REVIEWED_PARTIAL':'SOURCE_ONLY';
 return {id:v.id,name:v.name,parentId:v.templateId,group:p.group,dispatchGroup:p.dispatchGroup,evidenceLevel:level,sourceOnly:level==='SOURCE_ONLY',sharedTemplate:p.reuseComponent,contentDifference:changes[0],currentProblems:level==='SOURCE_ONLY'?'暂无该变体实图；内容差异为待验证风险，不能断言画面粗糙。':'仅共享图中的实际可见内容已审；其它状态/动作仍待核。',changes:changes.slice(1),affectedFiles:[...sources,sourceFile(p.affectedFiles[0].path)].filter((x,i,a)=>a.findIndex(y=>y.path===x.path)===i),reference:p.reference,assetsNeeded:['复用'+p.id+'共享资产与壳；只校对'+v.name+'的实际内容/裁切/状态，不另建整套美术。'],resourceIds:p.resourceIds,tools:['沿'+p.id+'工具与验收，不另采重复模板图。'],acceptance:['共享模板达到'+p.id+'验收后再验本变体（非当前已通过）。','本变体名称/规则/数量/图像与数据一致；图中未见的变体不可外推通过。',...changes],priority:p.priority,phase:p.phase,dependencies:[p.id+'共享模板先完成',...p.dependencies],scopeCost:'小',costNote:p.phase==='PH4'?'暂缓；解冻后再估。共享模板成本计基本页。':'内容核对；共享模板成本计基本页。',sourceNote:v.note,evidenceBasis:a?.evidence||[]};
});

const expectedBasic=inv.interfaces.map(x=>x.id),expectedVariants=inv.variants.map(x=>x.id);
const unique=a=>new Set(a).size===a.length;
if(pages.length!==110||variants.length!==55||!unique(pages.map(x=>x.id))||!unique(variants.map(x=>x.id)))throw new Error('Count mismatch');
if(expectedBasic.some(id=>!pages.find(x=>x.id===id))||expectedVariants.some(id=>!variants.find(x=>x.id===id)))throw new Error('Coverage gap');
if(pages.flatMap(x=>x.affectedFiles).concat(variants.flatMap(x=>x.affectedFiles)).some(f=>!f.exists))throw new Error('Nonexistent affected path');
const tally=(rows,key)=>rows.reduce((a,r)=>(a[r[key]]=(a[r[key]]||0)+1,a),{});
const summary={basicInterfaces:pages.length,variants:variants.length,baseEvidence:tally(pages,'evidenceLevel'),variantEvidence:tally(variants,'evidenceLevel'),priority:tally(pages,'priority'),phase:tally(pages,'phase'),phaseDefinitions:phaseDefs,coverage:{missingBasicIds:expectedBasic.filter(id=>!pages.find(x=>x.id===id)),missingVariantIds:expectedVariants.filter(id=>!variants.find(x=>x.id===id)),duplicates:false,allAffectedPathsExist:true},repairCorrection:'server-repair/browser-images.json：恢复后32张可见图已解码，0破图；原断线占位不用于原画质量判断。',referenceBoundary:'8参考：3 S1静态像素 + 5 D1设计依据；STS仅有限官方宣传短循环M1，不是亲玩/输入响应测试。项目动态与音频未验。',productionBoundary:'仅计划；未改游戏、未开浏览器、未安装、未build、未提交。未见页先补当前窗口证据；研究所/基地布置不因计划而解冻。',resourceIdStatus:'UI-R01..UI-R10为页面计划的资源请求编号（非已存在资产编号），工作簿统一时可映射；每条均优先复用。',toolBoundary:'工具列是未来制作/验证选项，不代表已运行或授权安装；游戏实页仅当前平台内置浏览器、当前窗口。'};
summary.referenceBoundary='8参考：3 S1静态像素 + 5 D1设计依据；STS仅有限官方宣传短循环M1。本项目仅新增BATTLE悬停上抬/轻放大/描述展开的协议输入采样；不证明FPS、物理真人延迟、出牌动态或音频。';
summary.resourceIdStatus='UI-R01..UI-R10为资源制作请求，沿planning/systems/resources.json#uiRequestLinks映射真实来源及SYS编号；不冒充已下载素材。';
summary.updatedHealthyImages=Object.keys(healthyUpdates);
summary.dispatchGroups=tally(pages,'dispatchGroup');
summary.resourceBridgeVerified=pages.flatMap(p=>p.resourceIds).every(id=>resourceLinks.some(l=>l.id===id));
const result={schemaVersion:1,generatedAt:'2026-10-02',sources:['diagnosis/art-annotations/annotations.json','diagnosis/coverage/inventory.json','diagnosis/coverage/FUNCTION-ANALYSIS.md','diagnosis/visual-comparators/records.json','diagnosis/interface-captures/BATTLE-card-hover-motion.json',...Object.values(healthyUpdates).map(u=>'diagnosis/interface-captures/'+u.image),'FINAL-ADDENDUM.md','server-repair/README.md'],pages,variants,resourceLinks,summary};
fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(dest+'/pages.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(dest+'/validation.json',JSON.stringify({checkedAt:'2026-10-02',checks:{basicCount:110,variantCount:55,uniqueIds:true,inventoryExactMatch:true,allAffectedPathsExist:true,allBasicChangesBetween3And6:pages.every(p=>p.changes.length>=3&&p.changes.length<=6),allRequiredFieldsPresent:pages.every(p=>['currentProblems','strengths','changes','layout','type','color','material','motion','affectedFiles','reuseComponent','architecture','reference','assetsNeeded','resourceIds','tools','acceptance','priority','phase','dependencies','scopeCost'].every(k=>k in p)),noBrokenImagesCountedAsArtDefect:!pages.some(p=>p.currentProblems.some(x=>/破图|crystal.*alt|fire.*alt/.test(x.symptom)))},summary},null,2)+'\n');

const md=['# 逐界面改造计划（110基本页 + 55内容变体）','', '2026-10-02。老板，这份计划先把读不清、挡标题、风险同色、收益说不明白的具体问题解决，再安排装饰和资源补充。全部条目可直接拆任务；本轮只产计划。','', '## 怎么读','', '- **IMAGE_REVIEWED**：已有静态图亲读，可陈述可见问题；不证明动态/声音/每个操作。', '- **TRANSITION_ONLY**：只有过渡/初始帧，先补稳定图，不能据淡入判粗糙。', '- **SOURCE_ONLY**：只有源码边界；风险是待核条件，不能断言该页不高级。', '- **变体**：独立一行，但共享基本页模板；只派内容差异，模板成本不重算。', '- 原服务断开所致破图已由恢复后32图、0破图排除，不纳入原画重做。', '- 对照只按3个S1静态像素与5个D1设计依据使用；STS有限M1仅借战斗短效/持续HUD分层。','', '## 总体派工顺序','', '| 阶段 | 内容 | 基本页数 | 开工条件 | 收口要求 |','|---|---|---:|---|---|',...Object.entries(phaseDefs).map(([id,desc])=>`| ${id} | ${desc} | ${summary.phase[id]||0} | ${id==='PH4'?'老板明确解冻；否则保留待办':'当前源码、所属域与相关证据有效；未见页先取稳定图'} | ${id==='PH1'?'标题不挡、风险可辨、净收获/保存事实一致':id==='PH2'?'长牌可读、状态与操作结果配对':id==='PH3'?'对象/成本/结果/来源统一':id==='PH4'?'独立验收，不借主图证据':'共享契约和单页样板确认'} |`),'','PH1优先页：'+pages.filter(p=>p.phase==='PH1').map(p=>p.id).join('、')+'。P0没有新造条目：现有证据不足以宣布全面阻断或整套资产失效。','', '## 共用架构、资源与工具','', '保留现有Vite/DOM、动作守卫与存档接口。按同一语义抽小组件：共享安全区、卡牌摘要/详情、选择计数、容量摘要、风险确认、操作结果、来源回退。先修一个代表页并验证，再迁同模板；不先做全项目框架迁移。','', '| 请求编号 | 内容 | 做法 |','|---|---|---|','| UI-R01 | 字阶、颜色、间距基线 | 用现有CSS/字体定主/次信息；不下载字体 |','| UI-R02 | 共享壳、安全区、来源回退 | 标题与口袋条分轨；固定摘要；关闭恢复来源 |','| UI-R03 | 卡摘要/详情 | 小卡粗筛、大卡全文，沿现有卡语法 |','| UI-R04 | 风险确认 | 对象+数量+损失，取消默认安全焦点 |','| UI-R05 | 奖励与终局摘要 | UI/Agent消费同一真实结果对象，区分净入库与候选 |','| UI-R06 | 状态/资源图标 | 先复用现有SVG/CSS，仅补具体缺语义 |','| UI-R07 | 首脑身份 | 现有首脑图/剪影+名牌；不增整幅背景 |','| UI-R08 | 收藏陈列 | 沿纸面、照片护角、卡背与档案框 |','| UI-R09 | 地图标记 | 当前/可去/已走/不可去的形状与文字 |','| UI-R10 | cue/scene接线与试听 | 先核已有注册与事件契约，再用现有试听页听；未听不判混音 |','', '以上是资源**请求**编号，不冒充现有文件资产ID。使用现有Node/npm、rg、workflow verify；玩家页面用当前平台内置浏览器当前窗口。资源制作优先CSS/现有矢量，确有新位图缺口时才按具体画幅调用图像工具。计划不授权安装、build、改全局配置或启用暂缓入口。','', '## 110个基本界面分表',''];
for(const p of pages){
 md.push(`### ${p.id} · ${p.name}`,'',`属组：${p.group}；证据：${p.evidenceLevel}；优先：${p.priority} / ${p.phase}；范围成本：${p.scopeCost}。`,'', '**当前问题与为什么显粗糙/不高级**','',...p.currentProblems.map(x=>`- [${x.status}] ${x.location}：${x.symptom} ${x.whyRough}`),'', '**保留**：'+p.strengths.join(' '),'', '**具体改法**','',...p.changes.map((x,i)=>`${i+1}. ${x}`),'',`| 维度 | 约定 |`,`|---|---|`,`| 布局 | ${p.layout} |`,`| 字体 | ${p.type} |`,`| 颜色 | ${p.color} |`,`| 材质 | ${p.material} |`,'',`动效：触发=${p.motion.trigger}；过程=${p.motion.process}；结束=${p.motion.end}；打断=${p.motion.interrupt}。**均为拟定规范，项目动态未验**。`,'',`架构/复用：${p.reuseComponent}。${p.architecture.join(' ')}`,'',`已核路径：${p.affectedFiles.map(f=>'`'+f.path+(f.line?':'+f.line:'')+'`').join('、')}。`,'',`参考：${p.reference.referenceId} / ${p.reference.game} / ${p.reference.level}。可借：${p.reference.canBorrow} 不可照搬：${p.reference.cannotCopy} ${p.reference.limit}`,'',`资源：${p.resourceIds.join('、')}。${p.assetsNeeded.join(' ')}`,'',`工具：${p.tools.join('；')}。`,'',`依赖：${p.dependencies.join('；')}。`,'', '**验收**','',...p.acceptance.map(x=>'- '+x),'');
}
md.push('## 55个变体分表','','| ID / 内容 | 共用模板 | 证据 | 内容特有派工与验收 | 排期 / 成本 |','|---|---|---|---|---|');
for(const v of variants)md.push(`| ${v.id} / ${v.name} | ${v.parentId}：${v.sharedTemplate} | ${v.evidenceLevel} | ${v.contentDifference} ${v.changes.join(' ')} ${v.sourceOnly?'无实图，先定向核内容，不下美术高低结论。':''} | ${v.priority}/${v.phase}；${v.scopeCost} |`);
md.push('','## 覆盖与限度','','110基本ID、55变体ID与coverage/inventory逐项一致，无漏项、无重复；所有affectedFiles已核文件存在。44基本页原有图片，其中EVENT与HUB-BACKS仅过渡/初始帧，计划保守拆为42可审静态页、2待稳定帧；其余66源码页。变体22有共享图局部、33源码。完整字段与证据路径见[pages.json](pages.json)，机械对账见[validation.json](validation.json)。','','未核事项仍是无辅助四层平衡、全职业内容可达、所有输入、声音听感、逐页当前源码与图像一致性。四层辅助流程、20张真实入库、刷新后22/25仓库只支持各自事实，不能外推自然通关或所有变体验收。');
for(let n=0;n<md.length;n++){
 if(md[n].startsWith('动效：'))md[n]=md[n].replace('**均为拟定规范，项目动态未验**','**'+(md[n].includes('已证：IAB')?'本页初始攻击悬停已有实测；其它链路仍待验':'此页动效为拟定规范，未实际观察')+'**');
 if(md[n].startsWith('110基本ID'))md[n]=`110基本ID、55变体ID与coverage/inventory逐项一致，无漏项、无重复；所有affectedFiles已核文件存在。现有${summary.baseEvidence.IMAGE_REVIEWED}页可审静态图、${summary.baseEvidence.TRANSITION_ONLY}页过渡/初始帧、${summary.baseEvidence.RENDERER_FIXTURE}页公开renderer fixture、${summary.baseEvidence.SOURCE_ONLY}页源码；fixture不证明真实故障。变体22有共享图局部、33源码。完整字段与证据路径见[pages.json](pages.json)，机械对账见[validation.json](validation.json)。`;
 if(md[n].startsWith('以上是资源**请求**'))md[n]+=' 跨表统一映射已在[resources.json](../systems/resources.json)的uiRequestLinks落库，pages.json也附同一resourceLinks，不把制作请求当下载来源。';
}
md.splice(md.indexOf('## 总体派工顺序'),0,'- **RENDERER_FIXTURE**：公开渲染示例仅支持文案/布局批注，不代表真实故障复现或恢复通过。','- 新增BATTLE悬停有真实协议输入与box采样：保留上抬/轻放大/描述展开；不测FPS、物理真人延迟或完整出牌动态。','');
fs.writeFileSync(dest+'/UI-PAGE-PLAN.md',md.join('\n')+'\n');
console.log(JSON.stringify({output:dest,summary,bytes:fs.statSync(dest+'/pages.json').size,markdownBytes:fs.statSync(dest+'/UI-PAGE-PLAN.md').size}));
