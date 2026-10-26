// Approved 10-24 elite bestiary and 10-25 story identities/event branches.
// Fixed values, independent of production imports; historical E8 inputs stay intact.
const elite = (id,name,desc,extra={}) => ({id:`foe-${id}`,name,cost:0,rarity:'衍生',type:'生物',unrandom:true,sellable:false,value:0,art:id,desc,...extra});
export const APPROVED_ELITE_CARDS = [
  elite('rager','暴怒者','攻击 2 / 生命 5。第2层精英。一个友方角色死亡后，自身攻击力 +2。'),
  elite('deserter','落难逃兵','攻击 3 / 生命 7。第2层精英。每有一个友方角色死亡，自身失去 2 点生命。'),
  elite('greedy_imp','拾能囊虫','攻击 4 / 生命 5。第2层精英。自身死亡后，为主人公回复 1 点能量。'),
  elite('swaggerer','招摇过客','攻击 2 / 生命 6。第3层精英。其它所有友方单位攻击力 +2。'),
  elite('tin_mute','覆板缄默者','攻击 4 / 生命 9。第3层精英。每次受到的伤害不超过 4 点；破甲与真实伤害无视此限制。',{dmgType:'true'}),
  elite('heavy_hammer','笨重锤手','攻击 8 / 生命 8。第3层精英。仅偶数回合可以攻击。'),
  elite('cultist','封识信徒','攻击 6 / 生命 6。第4层精英。存活期间，主人公无法获得攻击强化与法术强化。'),
  elite('fake_apothecary','黑诊配药人','攻击 5 / 生命 10。第4层精英。每次被附加诅咒时回复 2 点生命（受禁疗限制）。',{heal:2}),
  elite('camo_sniper','迷彩狙击手','攻击 7 / 生命 4。第4层精英。第一回合具有潜行；其它友方角色均死亡时立即失去潜行。'),
];
const names = [
 ['tt3-double-shot','连射','三连射'],
 ['cmtn28jv33wx','搜索大宝箱','搜索军用保险柜'],
 ['foe-archer','联邦射手','封锁线枪手'],['foe-bandit','反抗组织拾荒者','截道拾荒者'],
 ['foe-cavalry','联邦机动兵','封锁线突击兵'],['foe-wolf_rider','变异雪狼','裂颚匍行体'],
 ['foe-orc_axe','甲壳变异体','板壳畸变体'],['foe-fire_el','灼热异变体','灼囊畸变体'],
 ['foe-water_el','腐蚀异变体','渗蚀畸变体'],['foe-grass_el','滋生异变体','囊生畸变体'],
 ['foe-dragon','巨兽「荒渊」','封街巨躯'],['foe-boss_general','肃清总督','封控指挥官'],
 ['foe-boss_orc','变异巢母','囊巢母体'],['foe-boss_elem','异能领主','隔离区看守'],
 ['cmtn6ulm4boj','步兵','米高芬'],['tt6-demondeal','隧道血契','受困运输队'],
 ['tt6-bandits','暴雨劫道','武装截查'],['tt6-mystery','实验室余粮','失联配给柜'],
 ['tt6-goldmine','塌方采掘点','塌陷地下库'],['tt6-goldhammer','满电动力锤','中断的接应'],
 ['tt6-relief','临时救护站','隔离线急救'],['tt6-airdrop','污染空投箱','封锁区投送'],
 ['tt6-chestdraw','熔断物资箱','封存储备库'],['tt6-systemsupply','末班配送无人机','撤离登记台'],
 ['cmtn7qttxqo4','巷口修鞋匠','战地整备'],['ev19-vital','高压急救','封存针剂'],
 ['ev19-pearlbox','遗落的珍珠匣','撤离遗存'],['ev19-fireballs','双焰走私','封装火种'],
 ['ev19-classchest','黑箱调拨','无署名封条'],['ev19-recode','故障重编','异常改装台'],
 ['ev19-potions','避难市集药摊','应急药品站'],['ev19-arrows','海堤箭库','撤防射击位'],
 ['ev19-gamble','地下商场黑市','暗巷赌约'],['ev19-quartermaster','装备征用令','转运军需'],
];
export const APPROVED_CURRENT_REVISIONS = [
 ...names.map(([id,before,after])=>[id,'name',before,after]),
 ['foe-bandit','desc','攻击 3 / 生命 3。反抗·第1层。普通近战，成群出现（盗匪横行 ×5）。','攻击 3 / 生命 3。反抗·第1层。普通近战，成群出现（武装截查 ×5）。'],
 ['tt2-treasuremap','desc','主动技能：将 1张‘搜索大宝箱’洗入牌库，抽1张牌。','主动技能：将 1张‘搜索军用保险柜’洗入牌库，抽1张牌。'],
 ['foe-boss_elem','desc','攻击 8 / 生命 48。BOSS·能力者。词缀【元素庇幕】：偶数回合减免所有伤害（破甲可克制）。','攻击 8 / 生命 48。BOSS·变异。词缀【闭合隔膜】：偶数回合减免所有伤害（破甲可克制）。'],
 ['tt6-demondeal','desc','-5 血，获得 1 个军用保险柜。','损失 5 血搬出军用保险柜，或领取 1 件普通装备，也可直接离开。'],
 ['tt6-bandits','desc','可逃离，或迎战反抗组织拾荒者 ×3~5（随层数增加），胜利获得密封物资箱 ×2。','可逃离，或迎战截道拾荒者 ×3~5（随层数增加），胜利获得密封物资箱 ×2。'],
 ['tt6-mystery','desc','投骰领取：1~3 点获得员工通行证A碎片 ×1，4~6 点获得 3 币；也可离开。','投骰领取：1~3 点获得员工通行证A碎片 ×1，4~6 点获得 3 币；或固定领取 2 币，也可离开。'],
 ['tt6-goldmine','desc','稳妥取走 3 币，或冒险深挖获得 6 币并损失 3 血。','取走外侧的 3 币；或损失 3 血领取 6 币；或消耗随身木材卡 ×1，安全领取 6 币。'],
 ['tt6-goldhammer','desc','选择领取「闪金之锤」，或接受送信委托：下一家商店随机两格商品免费，排除初始攻击。','选择领取「闪金之锤」，或接受接应委托：下一家商店随机两格商品免费，排除初始攻击。'],
 ['tt6-chestdraw','desc','从大、中、小宝箱中随机抽取 1 个开启。','从军用保险柜、密封物资箱、小型物资箱中随机抽取 1 个开启，或领取木材与口粮各 1 张。'],
 ['tt6-systemsupply','desc','获得员工通行证A碎片和木材卡 ×1。','选择获得员工通行证A碎片 ×1 与木材卡 ×1，或碎片 ×1 与 2 币。'],
 ['cmtn7qttxqo4','desc','获得员工通行证A碎片；复原 1 张卡牌。','获得员工通行证A碎片 ×1；另选复原 1 张卡牌或回复 3 点生命。'],
 ['cmtn7qttxqo4','heal',undefined,3],
 ['ev19-vital','desc','生命上限 +3，并回复 3 点生命。','生命上限 +3 并回复 3 点生命，或只回复 8 点生命。'],
 ['ev19-pearlbox','desc','获得卡牌「珍珠盒」。','获得卡牌「珍珠盒」，或接受急救回复 6 点生命。'],['ev19-pearlbox','heal',undefined,6],
 ['ev19-fireballs','desc','获得两张「火球」。','获得两张「火球」，或获得一张「火球」并回复 3 点生命。'],['ev19-fireballs','heal',undefined,3],
 ['ev19-classchest','desc','获得 1 个职业·密封物资箱。','获得 1 个职业·密封物资箱，或领取 3 币。'],
 ['ev19-recode','desc','选择 2 张招式或装备卡，随机变为同稀有度、同类型的卡牌。','两张招式或装备随机转换为同稀有度同类型的卡；或支付 3 币，仅转换一张，候选最多三选一。'],
 ['ev19-potions','desc','从 3 瓶随机药水中选择 1 瓶获得。','从 3 瓶随机药水中选择 1 瓶，或接受处理回复 6 点生命。'],['ev19-potions','heal',undefined,6],
 ['ev19-arrows','desc','获得 2 张随机非职业箭系列卡牌。','获得 2 张随机非职业箭系列卡牌，或从最多 3 张随机非职业箭系列卡牌中选择 1 张。'],
 ['ev19-gamble','desc','每次投入 3 币，50% 获得预览的 1 张装备和 2 张招式；第 5 次必定成功，可随时放弃。','每次投入 3 币，50% 获得预览的 1 张装备和 2 张招式，第 5 次保底；或花费 2 币购买一张可预览的普通招式。'],
 ['ev19-quartermaster','desc','花费 3 币，从 3 张随机装备卡中选择 1 张获得。','支付 3 币从 3 张随机装备选 1 张，或交出一件随身装备换同稀有度装备，候选最多三选一；也可离开。'],
];
export function currentApprovedFieldValue(id,field,fallback) {
 return APPROVED_CURRENT_REVISIONS.find(row=>row[0]===id&&row[1]===field)?.[3] ?? fallback;
}
export function approvedCurrentCatalogBaseline(original) {
 const baseline=structuredClone(original);
 for(const [id,field,before,after] of APPROVED_CURRENT_REVISIONS) {
  const card=baseline.production.cards.find(row=>row.id===id)?.card;
  if(!card||card[field]!==before)throw new Error(`Unreviewed current baseline ${id}.${field}`);
  card[field]=after;
 }
 for(const card of APPROVED_ELITE_CARDS) {
  if(baseline.production.cards.some(row=>row.id===card.id))throw new Error(`Duplicate approved elite ${card.id}`);
  baseline.production.cards.push({id:card.id,card:structuredClone(card)});
 }
 return baseline;
}
