/* ============================================================
 * effect-verbs.js —— 牌效动词注册表（2026-09-11 架构批次 3）
 *
 * 背景：卡牌效果靠 battle.effects.js 里的文本正则链结算，加一张新卡就要往
 * 千行函数里再塞一个 if；且「这句话到底有没有实现」只能靠人肉审计。
 * 本表把「支持哪些动词/句式」变成可读数据，并给文本执行器提供未识别子句哨兵。
 *
 * 三张表：
 *   VERBS           —— 已实装的效果动词（人类可读索引 + 检测用句式），
 *                      供新卡作者查「这句话这么说能不能被识别」，也是覆盖度断言的依据。
 *   ELSEWHERE       —— 由文本执行器之外的层实装的句式（出牌结算 battle.core /
 *                      战斗规则 battle.rules / 背包 game.bag 等）。
 *                      注：impl 字段是人类可读的历史标注、无代码分发消费方——2026-09-22
 *                      批6 拆分后 battle.core 已拆为 battle.engine.js 等，impl 值保留不改。
 *                      执行器命中这些只标记「已识别」，不重复结算。
 *                      表内句式与门控逐条冻结（快照见 tests/fixtures/effect-elsewhere-frozen.json）。
 *   DESIGNER_BLANKS —— 已知未实装的设计者留白句；显式登记以免被当成新问题或悄悄放行。
 *
 * 口径：这两张表只做「识别」，不改结算顺序与数值——结算仍由 battle.effects.js
 * 的正则链按原顺序执行（该链对顺序与 did 门控敏感，改动风险高，不在本批次范围）。
 *
 * 哨兵：文本执行器跑完一句后若「什么都没发生」且本表也不认识它，就记入
 * UNKNOWN_EFFECTS（getUnknownEffects 可读），供实机试玩与自定义卡排查——
 * 症状是「牌面写着效果，打出去毫无反应」。
 * ============================================================ */
import { sdtDefine } from './sdt-facade.js';

/* 句式里出现这些词才被当成「有效果要结算」，纯风味句（如「向深渊献上敬意」）不报警。 */
const ACTION_RE = /造成|伤害|抽|发现|获得|获取|随机|洗入|置入|放入|消耗|攻击|冰冻|冻结|中毒|流血|沉默|破甲|禁疗|净化|回复|治疗|护甲|护盾|能量|法术伤害|法伤|召唤|释放|施放|打出|化为|消灭|复活|弃|免疫|无敌|偷取|降低|翻倍|复制|替换|逃跑|潜行|变为|变成|延长|升|夺|诱发|诅咒|门|枪|箭|杀|张|枚|种|层|回合|费|攻击力/;

/** 是否是「有效果」的句子（风味句不受未识别哨兵约束）。 */
const looksLikeEffect = (text) => ACTION_RE.test(String(text || ''));

/* ---------- 1. 已实装的效果动词（检测句式，与结算代码一一对应） ---------- */
const VERBS = [
  { id: 'attackMod', label: '攻击力增减（攻+N / 攻（-N）/ 获得 N 点攻击力）', impl: 'battle.effects', pattern: /攻\s*[（(]?\s*[+＋\-−]?\s*\d|获得\s*\d+\s*点攻击力|攻击力?\s*\+\s*\d|本回合攻击\s*\+\s*\d|攻击\s*\+\s*\d/ },
  { id: 'damage', label: '造成伤害（N 点攻击/法术/固定/真实伤害 / N 点法伤 / 区间 M-N）', impl: 'battle.effects', pattern: /造成[\s\d一两二三四五六七八九十]*点?(?:攻击|法术|固定|真实)?伤害|造成\s*\d+(?:\s*[-–~至]\s*\d+)?\s*点法(?:术)?伤|\d+\s*点?(?:法术|固定|真实)伤害|造成等同于|伤害\s*\+\s*\d/ },
  { id: 'aoeDamage', label: '对全体/多目标伤害', impl: 'battle.effects', pattern: /对所有敌|对全体敌|攻击全体敌|敌方全体|目标为敌方全体|目标为全体敌人|对随机敌/ },
  { id: 'aoeFixedByPrice', label: '按价格折算的全体固定伤害', impl: 'battle.effects', pattern: /造成等同于其价格的固定伤害/ },
  { id: 'damageRepeat', label: '伤害/效果触发 N 次（含区间 M-N）', impl: 'battle.effects', pattern: /触发\s*\d+(?:\s*[-–~至]\s*\d+)?\s*次|攻击\s*\d+\s*次|[‘'’”]?\d+[′'’”]/ },
  { id: 'selfDamage', label: '自伤', impl: 'battle.effects', pattern: /受到\s*\d+\s*点?伤害|损失\s*\d+\s*点?(?:生命|血)|回合开始\s*-\s*\d+\s*血|每次?消耗[^。]*?-\s*\d+\s*血/ },
  { id: 'heal', label: '回复生命', impl: 'battle.effects', pattern: /回复[\s\d一两二三四五六七八九十]*点?(?:生命|血)|回血|\+\s*\d+\s*血|回复等量生命|回复\s*至\s*\d+\s*血|治疗所有队友|治疗全体/ },
  { id: 'armor', label: '获得护甲', impl: 'battle.effects', pattern: /\+?\s*\d+\s*(?:点)?甲|获得\s*\d+\s*点护甲|护甲\s*\+\s*\d+/ },
  { id: 'draw', label: '抽牌', impl: 'battle.effects', pattern: /抽\s*[\d一两二三四五六七八九十]+(?:\s*-\s*\d+)?\s*张|抽牌|抽出\s*\d+\s*张/ },
  { id: 'drawUntil', label: '抽到指定手牌数 / 从牌库定向抽取', impl: 'battle.effects', pattern: /抽牌[^。；]*?直到|直到有\s*\d+\s*张手牌|从牌库(?:中|底)?(?:抽取|发现|取)\s*\d*\s*张?/ },
  { id: 'noDraw', label: '下回合无法抽牌', impl: 'battle.effects', pattern: /下(?:个)?回合无法抽牌/ },
  { id: 'curseAdd', label: '附加诅咒（流血/中毒/冰冻/沉默/破甲/禁疗/灼烧）', impl: 'battle.effects', pattern: /附加[^。；]*(流血|中毒|冰冻|冻结|沉默|破甲|禁疗|灼烧)|施加[^。；]*(流血|中毒|灼烧)|冰冻\s*(?:所有|\d|[一两二三四五])|冻结|沉默\s*\d|破甲|禁疗|中毒层数翻倍|延长[^。]*冰冻/ },
  { id: 'curseRandom', label: '随机诅咒', impl: 'battle.effects', pattern: /随机诅咒|种随机诅咒|每有\s*1\s*种诅咒|诅咒状态/ },
  { id: 'curseCopyAll', label: '复制手牌招式上的全部诅咒', impl: 'battle.effects', pattern: /附加手牌中的招式所具有的全部诅咒/ },
  { id: 'purify', label: '净化自身', impl: 'battle.effects', pattern: /净化/ },
  { id: 'poisonBurst', label: '立即触发毒伤', impl: 'battle.effects', pattern: /立即触发[^。]*次毒伤|触发\s*1\s*次毒伤/ },
  { id: 'discover', label: '发现 N 张牌（可限定卡池）', impl: 'battle.effects', pattern: /发现\s*(?:一|1|\d+|两)\s*[张种瓶枚]|每当你发现卡牌时|发现卡牌时/ },
  { id: 'discoverAndCast', label: '发现并直接施放 / 获取剩余', impl: 'battle.effects', pattern: /并直接释放|并直接施放|并(?:直接)?(?:施放|释放)|选择其中\s*(?:1|一)\s*张直接施放|获取剩下/ },
  { id: 'discoverCopy', label: '发现并额外获得复制', impl: 'battle.effects', pattern: /额外获得\s*1\s*张复制|并额外获得|获得一张随机手牌的复制/ },
  { id: 'discoverInfuseFree', label: '发现注能卡并免注能', impl: 'battle.effects', pattern: /发现\s*(?:一|1)\s*张注能卡|使其无需注能/ },
  { id: 'potionDiscover', label: '发现药水并直接释放', impl: 'battle.effects', pattern: /发现\s*1?\s*瓶药水/ },
  { id: 'getRandomCard', label: '随机获取卡牌（可限定数量/卡池）', impl: 'battle.effects', pattern: /随机获取|获取\s*\d*\s*张|获得\s*\d+\s*张(?:随机|重斩|临时|传说|能力)/ },
  { id: 'getSpecificCard', label: '获取指定牌（置入手牌）', impl: 'battle.effects', pattern: /获取(?:一张|1\s*张)?[^。；]*卡|获得\s*1\s*个?员工通行证|获取本职业的能力卡|获取一张能力卡|获取\s*1\s*张传说卡/ },
  { id: 'deckInsert', label: '洗入/置入牌库', impl: 'battle.effects', pattern: /洗入牌库|置入[^。；]*牌库|从牌库中抽取|将[^。；]*(?:洗入|置入)/ },
  { id: 'handInsert', label: '置入手牌 / 置入至满手牌', impl: 'battle.effects', pattern: /置入手牌|置入随机卡牌直至|置入\s*\d+\s*张|将\s*\d+\s*张/ },
  { id: 'costMod', label: '费用变化（变为 0 费 / 费用 -N）', impl: 'battle.effects', pattern: /变为\s*0\s*费|本牌变为\s*0\s*费|费用\s*-\s*\d|费用-1|费用均-1|费用为\s*0|费用变为\s*0|招式均为\s*1\s*费/ },
  { id: 'energyGain', label: '获得能量', impl: 'battle.effects', pattern: /(?:获得|回复)\s*\d+\s*点?能量/ },
  { id: 'energyCapUp', label: '能量上限 +N', impl: 'battle.effects', pattern: /能量上限\s*\+\s*\d/ },
  { id: 'maxHpUp', label: '血量上限 / 牌库上限 +N', impl: 'battle.effects', pattern: /血量上限\s*\+\s*\d|牌库上限\s*\+\s*\d/ },
  { id: 'spellPowerUp', label: '法伤 +N', impl: 'battle.effects', pattern: /法伤\s*\+\s*\d/ },
  { id: 'summonAlly', label: '召唤随从', impl: 'battle.effects', pattern: /召唤\s*[^\s（(，。；;、]+/ },
  { id: 'extraTurn', label: '获得额外回合', impl: 'battle.effects', pattern: /获得\s*1\s*个额外回合/ },
  { id: 'noDrawOrSkip', label: '跳过敌方阶段/无法行动', impl: 'battle.effects', pattern: /无法行动|跳过[^。；]*阶段/ },
  { id: 'stealth', label: '潜行', impl: 'battle.effects', pattern: /潜行|遁入虚空/ },
  { id: 'tauntOthers', label: '迫使敌人相互攻击', impl: 'battle.effects', pattern: /迫使其?相互攻击|相互攻击/ },
  { id: 'stealAtk', label: '偷取/夺取/降低敌方攻击力', impl: 'battle.effects', pattern: /偷取[^。]*?攻击|夺取[^。]*?攻击力|降低\s*\d*\s*名?敌人\s*\d*\s*攻/ },
  { id: 'execute', label: '消灭低攻/受伤敌人', impl: 'battle.effects', pattern: /消灭\s*(?:\d+|一|两)\s*名|消灭\s*1\s*名|死亡之?门/ },
  { id: 'revive', label: '复原/复活消耗卡', impl: 'battle.effects', pattern: /复原|复活\s*(?:最多)?\s*\d+\s*张/ },
  { id: 'handSelect', label: '手牌选择（复制/变 0 费/消耗）', impl: 'battle.effects', pattern: /选择\s*(?:1|一)\s*张(?:卡牌|手牌)|选择并复制|选择手牌中|选择两个目标/ },
  { id: 'discardOrConsumeHand', label: '消耗/弃置手牌', impl: 'battle.effects', pattern: /消耗(?:所有|全部|掉)?(?:的)?手牌|消耗[^。；]{0,4}?(?:\d+|[一两二三四五])\s*张|弃(?:掉)?\s*\d*\s*张?牌?/ },
  { id: 'autoPlayHandType', label: '直接释放手牌中的某类牌', impl: 'battle.effects', pattern: /直接释放|立即释放|自动施放|释放手牌中|释放一次|释放其中/ },
  { id: 'nextSpellTwice', label: '下一张牌施放 N 次', impl: 'battle.effects', pattern: /下一张[^。；]*施放\s*\d+\s*次|额外施放\s*\d+\s*次/ },
  { id: 'doubleDamageNext', label: '破隐/破甲类伤害翻倍', impl: 'battle.effects', pattern: /破(?:隐|除隐身)[^。]*伤害翻倍|伤害翻倍|受法伤加成翻倍|流血伤害翻倍/ },
  { id: 'damageReduce', label: '本回合所受伤害降为 N / 避开伤害 / 免疫致命', impl: 'battle.effects', pattern: /所受伤害降为|避开第\s*\d+\s*段伤害|免疫\s*1\s*次致命伤害|免疫伤害|无敌/ },
  { id: 'escape', label: '逃跑', impl: 'battle.effects', pattern: /逃跑/ },
  { id: 'blessingChoice', label: '随机获取一项祝福', impl: 'battle.effects', pattern: /随机获取一项祝福|祝福/ },
  { id: 'pocketUse', label: '仅背包内可用（复原最多 N 张）', impl: 'game.bag', pattern: /在背包中才能使用|复原最多\s*(?:两|2|3)\s*张/ },
  { id: 'duration', label: '持续 N 回合（时长覆盖）', impl: 'battle.effects', pattern: /持续\s*\d+\s*回合/ },
  { id: 'castTimes', label: '施放 N 次某牌', impl: 'battle.effects', pattern: /施放\s*\d+\s*次/ },
  { id: 'formSwitch', label: '形态（剑仙/自然/宇宙/形态池）', impl: 'battle.effects', pattern: /剑仙形态|自然形态|宇宙形态|形态/ },
  { id: 'mysteryEffect', label: '随机神秘效果', impl: 'battle.effects', pattern: /随机神秘效果/ },
  { id: 'choiceBranch', label: '抉择（1°/2°/3° 分支）', impl: 'battle.effects', pattern: /抉择[:：]|\d\s*[°′]|其中每置入|集齐两枚碎片/ },
  { id: 'costSwapDiscover', label: '发现两张随机招式并交换费用', impl: 'battle.effects', pattern: /发现两张随机招式/ },
  { id: 'multiShot', label: '连开 N 枪 / 连击', impl: 'battle.effects', pattern: /连开\s*[一二三四五六七八九十\d]+\s*枪/ },
  { id: 'killReward', label: '击杀奖励（护甲/币/抽牌）', impl: 'battle.effects', pattern: /击杀敌人时|每消灭\s*1\s*个敌人|若击杀敌人/ },
  { id: 'container', label: '容器（背包扩容/内置空间）', impl: 'game.session', pattern: /空间|容纳所有|扩容/ },
  { id: 'sealUnlock', label: '累计注能解锁', impl: 'battle.effects', pattern: /累计注能[^。]*解锁|解锁[:：]/ },
  { id: 'shaTransform', label: '把「初始攻击」转化为其它牌', impl: 'battle.effects', pattern: /化为\s*\d?\s*张|所有[‘'"]?初始攻击[’'"]?化|将[‘'"]?初始攻击[’'"]?化/ },
  { id: 'imitate', label: '在手牌中变形为上一张牌', impl: 'battle.effects', pattern: /在手牌中时|上一张[^。]*牌是武术|上一张武术牌的\s*1\s*费复制/ },
  { id: 'combatStartPassive', label: '对战开始时被动', impl: 'battle.effects', pattern: /对战开始时/ },
];

/* ---------- 2. 由执行器之外的层实装的句式（执行器只标记已识别） ----------
 * 这批句式＝原 battle.effects.js「识别补丁」白名单的字面搬家，句式与门控逐条冻结
 * （tests/effect-verbs.test.js 有快照断言）。识别面直接影响执行器 did 返回值，
 * 要动必须先跑差分：全卡库 216 句子在 structuredHit 两种取值下 did 必须不变。 */
const ELSEWHERE = [
  { id: 'graveScale', label: '墓地/消耗数量加成', impl: 'battle.core', pattern: /墓地中每有\s*1\s*张(武术|法术|装备|道具|资源)牌/ },
  { id: 'fuelPriceScale', label: '按注能牺牲品价格折算', impl: 'battle.effects', pattern: /倍于被注能卡牌价格/ },
  { id: 'keepInHand', label: '永远保留在手牌 / 无法注能', impl: 'battle.rules', pattern: /永远被保留在手牌中|无法用于注能/ },
  { id: 'nextCastTimes', label: '下一张牌施放 N 次（规则层）', impl: 'battle.core', pattern: /下一张(?:法术|招式)?施放\s*\d+\s*次/ },
  { id: 'selfCostZero', label: '满足条件时本牌变为 0 费', impl: 'battle.core', pattern: /本牌变为\s*0\s*费/ },
  { id: 'prevCardBonus', label: '上一张打出的牌决定加成', impl: 'battle.core', pattern: /上一张(?:打出的)?牌是武术/ },
  { id: 'bleedDouble', label: '流血相关伤害翻倍', impl: 'battle.core', pattern: /流血伤害翻倍/ },
  { id: 'bleedTargetBonus', label: '对流血目标的结算加成', impl: 'battle.core', pattern: /若对方[^。]*流血/ },
  { id: 'consumeTrigger', label: '消耗该牌时触发', impl: 'battle.core', pattern: /消耗该牌时/ },
  { id: 'onAcquire', label: '获取该牌时被动', impl: 'battle.core', pattern: /发现或随机获取该牌时/ },
  { id: 'vsFreezeBonus', label: '对冰冻目标伤害加成', impl: 'battle.core', pattern: /对冰冻[^。]*?伤害\s*\+\s*\d+/ },
  { id: 'onKill', label: '击杀钩子', impl: 'battle.core', pattern: /每消灭\s*1\s*个敌人/ },
  { id: 'pouchCast', label: '容器选择其中 1 张直接施放', impl: 'battle.core', pattern: /选择其中\s*(?:1|一)\s*张直接施放/ },
  { id: 'delayedGate', label: '两回合后的延迟门', impl: 'battle.core', pattern: /两回合后[^。]*未选择/ },
  { id: 'designerBlank', label: '设计者原文留白句', impl: 'battle.core', pattern: /在你抽到[^。]*后……/ },
  { id: 'imitateInHand', label: '在手牌中变形', impl: 'battle.core', pattern: /在手牌中时[^。]*?变为/ },
  { id: 'pocketRestore', label: '背包消耗口袋复原', impl: 'game.bag', pattern: /复原最多(两|2)张/ },
  { id: 'structuredDamage', label: '结构化伤害字段已覆盖', impl: 'battle.core', gate: 'structuredHit', pattern: /造成\s*\d+\s*点(?:\s*(?:固定|法术|真实|攻击))?\s*伤害|(\d+)\s*点?法术伤害/ },
  { id: 'infuseBonusStructured', label: '注能伤害加成（结构化字段覆盖）', impl: 'battle.core', gate: 'structuredHit', pattern: /注能\s*[（(][^）)]*[）)][：:]?\s*伤害\s*\+\s*\d+/ },
  { id: 'infuseLeadBonus', label: '注能前缀后的「伤害 +N」', impl: 'battle.core', gate: 'structuredHit+infusedLead', pattern: /^\s*伤害\s*\+\s*\d+\s*$/ },
  { id: 'hpThreshold', label: '对低血目标加成', impl: 'battle.core', gate: 'structuredHit', pattern: /对\s*\d+\s*血以下/ },
  { id: 'hpHalfThreshold', label: '血量一半及以下伤害增加', impl: 'battle.core', gate: 'structuredHit', pattern: /血量一半及以下的敌人伤害增加/ },
  { id: 'healEqualToDamage', label: '回复等量生命（结算层）', impl: 'battle.core', gate: 'structuredHit', pattern: /回复等量生命/ },
  { id: 'repeatTimes', label: '触发 N 次（结构化）', impl: 'battle.core', gate: 'structuredHit', pattern: /触发\s*\d+\s*次/ },
  { id: 'extraCastTimes', label: '额外施放 N 次（结构化）', impl: 'battle.core', gate: 'structuredHit', pattern: /额外施放\s*\d+\s*次/ },
  { id: 'spellBonusDouble', label: '受法伤加成翻倍（结构化）', impl: 'battle.core', gate: 'structuredHit', pattern: /受法伤加成翻倍/ },
  { id: 'atkEqualToDamage', label: '造成等同于攻击力的伤害（结构化）', impl: 'battle.core', gate: 'structuredHit', pattern: /造成等同于攻击力的伤害/ },
  { id: 'poisonLegacy', label: '中毒敌人死亡时层数转移（腐化之种，battle.core 打出登记 + 三死亡入口结算）', impl: 'battle.core', pattern: /死亡时[^。]*中毒层数转移/ },
  { id: 'curseImmune', label: '免疫诅咒（深渊主宰·妲莉薇特，battle.core addPlayerCurse 拦截）', impl: 'battle.core', pattern: /免疫诅咒/ },
  { id: 'spellsInfused', label: '本场所有法术均已注能（深渊主宰·妲莉薇特，battle.core infusedBase 贯通）', impl: 'battle.core', pattern: /均已注能/ },
  { id: 'unplayableSeal', label: '封印之牌无法打出（受缚之残影系，battle.rules unplayableReasonFor 拦截）', impl: 'battle.rules', pattern: /无法打出/ },
  { id: 'sealTransform', label: '集齐封印之牌破封化形（受缚之残影 → 深渊主宰·妲莉薇特，battle.core 集齐检测）', impl: 'battle.core', pattern: /集齐[^。]*封印|化为深渊主宰/ },
  { id: 'summonStatlessLimbs', label: '召唤 4 名封印肢体（无攻血场面物件，battle.core 打出登记）', impl: 'battle.core', pattern: /召唤\s*4\s*名封印肢体/ },
];

/* ---------- 2b. 已知未实装的设计者留白（显式列出，避免被当成「已识别」而埋掉） ----------
 * 这些句子在设计者原文里是氛围/留白，没有结算实现；登记在此是为了让覆盖度断言
 * 只放行「已明确知道」的句子——新出现的未实装句式仍会让断言失败。 */
const DESIGNER_BLANKS = [
  { id: 'weaponCover', label: '以天启诛魔剑覆盖你的所有武器（设计者留白，无结算）', pattern: /覆盖你的所有武器/ },
];

/* ---------- 3. 查询接口 ---------- */
/** 命中哪些已实装动词（返回 id 数组，按表内顺序）。 */
function matchVerbs(text) {
  const s = String(text || '');
  return VERBS.filter(v => v.pattern.test(s)).map(v => v.id);
}

/** 是否由执行器之外的层实装（context：{ structuredHit, infusedLead }）。 */
function matchElsewhere(text, context) {
  const s = String(text || '');
  const ctx = context || {};
  return ELSEWHERE.filter(v => {
    if (v.gate && v.gate.includes('structuredHit') && !ctx.structuredHit) return false;
    if (v.gate && v.gate.includes('infusedLead') && !ctx.infusedLead) return false;
    return v.pattern.test(s);
  }).map(v => v.id);
}

/** 命中哪些「设计者留白」句（已知未实装，非新问题）。 */
function matchBlank(text) {
  const s = String(text || '');
  return DESIGNER_BLANKS.filter(v => v.pattern.test(s)).map(v => v.id);
}

/** 本表是否认识这句话（已实装动词 / 外部层实装 / 已知留白）。 */
function isRecognized(text, context) {
  const s = String(text || '');
  return matchVerbs(s).length > 0 || matchElsewhere(s, context).length > 0 || matchBlank(s).length > 0;
}

/* ---------- 4. 未识别子句哨兵 ---------- */
const UNKNOWN_EFFECTS = new Map();   // text -> { card, count, firstAt }

/** 记录一句「牌面写了效果但打出去什么都没发生」的文本（同句只留一条，累计次数）。 */
function noteUnknownEffect(card, text) {
  const s = String(text || '').trim();
  if (!s || !looksLikeEffect(s)) return null;
  const hit = UNKNOWN_EFFECTS.get(s);
  if (hit) { hit.count++; return hit; }
  const entry = { card: card && card.name ? card.name : '?', count: 1, firstAt: Date.now() };
  UNKNOWN_EFFECTS.set(s, entry);
  return entry;
}

/** 未识别子句快照（[{ text, card, count }]，试玩排查与自动化断言用）。 */
function getUnknownEffects() {
  return [...UNKNOWN_EFFECTS.entries()].map(([text, e]) => ({ text, ...e }));
}

function resetUnknownEffects() { UNKNOWN_EFFECTS.clear(); }

const VerbRegistry = { VERBS, ELSEWHERE, DESIGNER_BLANKS, matchVerbs, matchElsewhere, matchBlank, isRecognized, looksLikeEffect, noteUnknownEffect, getUnknownEffects, resetUnknownEffects };
sdtDefine('EffectVerbs', VerbRegistry);
export { VERBS, ELSEWHERE, DESIGNER_BLANKS, matchVerbs, matchElsewhere, matchBlank, isRecognized, looksLikeEffect, noteUnknownEffect, getUnknownEffects, resetUnknownEffects };
export default VerbRegistry;
