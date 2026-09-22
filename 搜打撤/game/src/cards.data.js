/* 由 cards.js 拆出（2026-09-22 六文件重构批2）：卡池数据（EVENTS_0919 + TABLETOP/TT2-TT8 + BESTIARY + TT10/TT11）。
 * 逐字搬迁，属性顺序=原文件顺序；在壳 cards.js 中展开装配为 SDT.Cards，键面与数据字节不变。 */
import { KEY, TT10_KEY, TT11_KEY, RETIRE_TT11 } from './cards.consts.js';
export const dataSlice = {
    EVENTS_0919: [
      { id: 'tt6-demondeal', name: '隧道血契', cost: 0, rarity: '衍生', type: '事件', desc: '-5 血，获得 1 个军用保险柜。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-bandits', name: '暴雨劫道', cost: 0, rarity: '衍生', type: '事件', battle: true, desc: '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-mystery', name: '实验室余粮', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片，+2 币。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-goldmine', name: '塌方采掘点', cost: 0, rarity: '衍生', type: '事件', desc: '稳妥取走 3 币，或冒险深挖获得 6 币并损失 3 血。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-goldhammer', name: '满电动力锤', cost: 0, rarity: '衍生', type: '事件', desc: '获得卡牌「闪金之锤」。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-relief', name: '临时救护站', cost: 0, rarity: '衍生', type: '事件', desc: '回复 6 点生命。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-airdrop', name: '污染空投箱', cost: 0, rarity: '衍生', type: '事件', desc: '从木材、口粮、能量饮料、随机药水中选择一项。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-chestdraw', name: '熔断双箱', cost: 0, rarity: '衍生', type: '事件', desc: '从大、中、小宝箱中随机抽取 1 个开启。', value: 0, sellable: false, unrandom: true },
      { id: 'tt6-systemsupply', name: '末班配送无人机', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片和木材卡 ×1。', value: 0, sellable: false, unrandom: true },
      { id: 'cmtn7qttxqo4', name: '巷口修鞋匠', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片；复原 1 张卡牌。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-vital', name: '高压急救', cost: 0, rarity: '衍生', type: '事件', desc: '生命上限 +3，并回复 3 点生命。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-pearlbox', name: '遗落的珍珠匣', cost: 0, rarity: '衍生', type: '事件', desc: '获得卡牌「珍珠盒」。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-fireballs', name: '双焰走私', cost: 0, rarity: '衍生', type: '事件', desc: '获得两张「火球」。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-classchest', name: '黑箱调拨', cost: 0, rarity: '衍生', type: '事件', desc: '获得 1 个职业·密封物资箱。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-recode', name: '故障重编', cost: 0, rarity: '衍生', type: '事件', desc: '选择 2 张招式或装备卡，随机变为同稀有度、同类型的卡牌。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-potions', name: '避难市集药摊', cost: 0, rarity: '衍生', type: '事件', desc: '从 3 瓶随机药水中选择 1 瓶获得。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-arrows', name: '海堤箭库', cost: 0, rarity: '衍生', type: '事件', desc: '获得 2 张随机非职业箭系列卡牌。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-gamble', name: '地下商场黑市', cost: 0, rarity: '衍生', type: '事件', desc: '每次投入 3 币，50% 获得预览的 1 张装备和 2 张招式；第 5 次必定成功，可随时放弃。', value: 0, sellable: false, unrandom: true },
      { id: 'ev19-quartermaster', name: '装备征用令', cost: 0, rarity: '衍生', type: '事件', desc: '花费 3 币，从 3 张随机装备卡中选择 1 张获得。', value: 0, sellable: false, unrandom: true },
    ],
    // 拥有伤害词条（红色伤害宝石）的类型

    // 桌游手绘道具卡（2026-09-01 照片提取，17 张 → 15 种：
    // 银币 ×2、铜币 ×2 为重复/同卡备注，各保留一种设计）。
    // 资源标注重拍照片后：钥匙/口粮/木材系/经济卡包按卡面「资源·N币」标注
    // 改为资源类型（设计者规则：未标注类型的卡牌均为资源）；
    // 急救合剂/金疮药/能源结晶/金银铜币/员工通行证仍为道具（药水与通行证可在背包直接使用）。
    TABLETOP: [
      // —— 第一排 ——
      { id: 'tt-medneedle',  name: '急救合剂', cost: 1, rarity: '古朴', type: '道具', desc: '回复 16 点生命。', value: 4 },
      { id: 'tt-copper',     name: '铜币',     cost: 0, rarity: '初始', type: '道具', desc: '高价值，可出售。', value: 3, unrandom: true }, // 2026-09-13 老板拍板：经济牌退出商店/发现池，堵买低卖高套利
      { id: 'tt-keys-bunch', name: '一串钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '钥匙 ×2。', value: 4 },
      { id: 'tt-rations',    name: '口粮',     cost: 0, rarity: '初始', type: '资源', desc: '升级宠物。', value: 3 },
      { id: 'tt-token-color', name: '员工通行证A', cost: 2, rarity: '史诗', type: '道具', desc: '觉醒。', value: 8 },
      // —— 第二排 ——
      { id: 'tt-gold',       name: '金币',     cost: 0, rarity: '史诗', type: '道具', desc: '贵重货币，可出售。', value: 9, unrandom: true },
      { id: 'tt-econpack',   name: '经济卡包', cost: 2, rarity: '传说', type: '资源', desc: '带入战场时，以 5 张随机卡牌开局。可出售。', value: 10, sellable: true, unrandom: true }, // 资源标注重拍：卡面明确「可出售 10币」
      { id: 'tt-silver',     name: '银币',     cost: 0, rarity: '古朴', type: '道具', desc: '可出售。', value: 6, unrandom: true },
      { id: 'tt-key',        name: '钥匙',     cost: 0, rarity: '初始', type: '资源', desc: '解锁神秘宝箱。', value: 2 },
      // —— 第三排 ——
      { id: 'tt-crystal',    name: '能源结晶', cost: 1, rarity: '古朴', type: '道具', desc: '复活最多 3 张卡牌。', value: 3 },
      { id: 'tt-key-one',    name: '一把钥匙', cost: 0, rarity: '古朴', type: '资源', desc: '钥匙 ×3。', value: 6 },
      { id: 'tt-token-gold', name: '员工通行证B', cost: 1, rarity: '稀有', type: '道具', desc: '抽取 1 张传说卡。', value: 5 }, // 照片重辨：手写为「传说卡」（[[icon:crystal]]传），非「传统卡」
      { id: 'tt-jinchuangyao', name: '金疮药', cost: 1, rarity: '古朴', type: '道具', desc: '回复 10 点生命。', value: 3 },
      { id: 'tt-wood',       name: '木材',     cost: 0, rarity: '初始', type: '资源', desc: '木材 ×1。', value: 2 }, // 资源标注重拍：纯资源卡（无回复效果）；「木化」药水另录于 TABLETOP4
      { id: 'tt-wood-lots',  name: '大量木材', cost: 0, rarity: '古朴', type: '资源', desc: '木材 ×2。', value: 4 },
    ],

    // 桌游手绘卡 · 第二批（2026-09-01 照片提取，17 张：7 装备 + 10 武术）。
    // 注意：这批卡角标注「类型 · N[[icon:coin]]」中的 N 是能量费用（不是币值！），
    // 「射击」左上角 free = 0 费；[[icon:crystal]] 为手绘的类别记号，稀有度按效果强度代拟。
    // 抽牌/破甲/吸血/加甲等词条等 M1 卡牌战斗实装。

    // 桌游手绘卡 · 第二批（2026-09-01 照片提取，17 张：7 装备 + 10 武术）。
    // 注意：这批卡角标注「类型 · N[[icon:coin]]」中的 N 是能量费用（不是币值！），
    // 「射击」左上角 free = 0 费；[[icon:crystal]] 为手绘的类别记号，稀有度按效果强度代拟。
    // 抽牌/破甲/吸血/加甲等词条等 M1 卡牌战斗实装。
    TABLETOP2: [
      // —— 装备（描述已按第四批高清照片重辨精修）——
      { id: 'tt2-apollo',     name: '阿波罗的礼物', cost: 2, rarity: '史诗', type: '装备', desc: '限定：获得 1 点能量，抽 2 张牌；发现或随机获取任何牌时，可直接施放（不受限定限制）。' },
      { id: 'tt2-pearlbox',   name: '珍珠盒',   cost: 4, rarity: '稀有', type: '装备', desc: '可以容纳所有资源卡牌。' },
      { id: 'tt2-wreck',      name: '沉船宝藏', cost: 4, rarity: '史诗', type: '装备', desc: '抽到或消耗时，获取 1 张随机卡牌。' },
      { id: 'tt2-treasuremap', name: '寻宝图', cost: 4, rarity: '古朴', type: '装备', desc: '限定：将 2 张军用保险柜的物资置入牌库，抽 1 张牌。' },
      { id: 'tt2-venomstaff', name: '毒木杖',   cost: 2, rarity: '古朴', type: '装备', desc: '限定：施放中毒牌时，每 1 层法伤加成，额外施放 1 次。' },
      { id: 'tt2-frostsword', name: '寒冰剑',   cost: 2, rarity: '古朴', type: '装备', desc: '对冰冻角色伤害 +2。' },
      // —— 武术（描述已按第五批高清武术摞照片重辨精修）——
      { id: 'tt2-jianghu',     name: '江湖救急', cost: 4, rarity: '稀有', type: '武术', desc: '发现 1 张其它职业的卡牌并施放。' },
      { id: 'tt2-swiftarrow',  name: '迅疾箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，抽 1 张牌。' },
      { id: 'tt2-block',       name: '格挡',     cost: 2, rarity: '古朴', type: '武术', desc: '本回合所受伤害降为 1。' },
      { id: 'tt2-comboarrow',  name: '连击箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1；如果你的上一张牌是武术，变为 0 费。' },
      { id: 'tt2-piercearrow', name: '破甲箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，破甲。' },
      { id: 'tt2-shoot',       name: '射击',     cost: 0, rarity: '初始', type: '武术', dmg: 2, dmgType: 'fixed', desc: '造成 2 点伤害。' }, // 设计者定版：2 点固定伤害
      { id: 'tt2-turtlearmor', name: '龟寿甲',   cost: 2, rarity: '古朴', type: '武术', desc: '弃 1 张装备牌，+8 甲。' },
      { id: 'tt2-bloodblade',  name: '血刃',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加吸血。' },
      { id: 'tt2-forestarrow', name: '绿化箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，+3 甲。' },
    ],

    // 桌游手绘卡 · 第三批（2026-09-01 全套照片提取；另一会话录入 93 张在先，
    // 本会话对「28 张法术一摞」照片做了逐张放大重辨：同卡条目已按更准确的读法
    // 覆盖（保留原 id），缺卡补录于「法术（重辨补录）」段，其余各摞条目未动）。
    // 注意：本摞照片角标为「法术·N[[icon:coin]]」，与第二批一致 = 能量费用（非币值）；
    // 卡名前 [[icon:crystal]] 数量 = 稀有度记号（1 古朴 / 2 稀有 / 3 史诗）。

    // 桌游手绘卡 · 第三批（2026-09-01 全套照片提取；另一会话录入 93 张在先，
    // 本会话对「28 张法术一摞」照片做了逐张放大重辨：同卡条目已按更准确的读法
    // 覆盖（保留原 id），缺卡补录于「法术（重辨补录）」段，其余各摞条目未动）。
    // 注意：本摞照片角标为「法术·N[[icon:coin]]」，与第二批一致 = 能量费用（非币值）；
    // 卡名前 [[icon:crystal]] 数量 = 稀有度记号（1 古朴 / 2 稀有 / 3 史诗）。
    TABLETOP3: [
      // —— 武术（28 张一揽；2026-09-01 高清武术摞照片逐张重辨：费用按卡角
      //     「武术·N[[icon:coin]]」修正（此前普遍低记 1 费）、描述按原文「攻⁺n」记号，
      //     同卡异名已改（飞箭鹰→飞身劈、重射→重新）；制敌/跳击/铠甲/剑落纷霜
      //     不在本摞照片中，保持原样）——
      { id: 'tt3-blood-arrow',   name: '血箭',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加流血。' },
      { id: 'tt3-fatal-pierce',  name: '致命穿刺', cost: 2, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2；若对方有流血，伤害 +1 并破甲。' },
      { id: 'tt3-fly-arrowhawk', name: '飞身劈',   cost: 3, rarity: '稀有', type: '武术', dmg: 3, dmgType: 'attack', desc: '攻⁺3，触发流血伤害翻倍。' },
      { id: 'tt3-frost-slash',   name: '霜月斩',   cost: 4, rarity: '稀有', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2，附加冰冻，冻结状态 2 回合。' },
      { id: 'tt3-noon-duel',     name: '正午决战', cost: 4, rarity: '稀有', type: '武术', desc: '下回合开始，连开四枪！四响。' },
      { id: 'tt3-armor-rush',    name: '破甲急袭', cost: 3, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2，附加 2 层流血。' },
      { id: 'tt3-double-shot',   name: '连射',     cost: 2, rarity: '古朴', type: '武术', dmg: 2, desc: '2 点伤害，2 次。' },
      { id: 'tt3-bandage',       name: '包扎',     cost: 2, rarity: '初始', type: '武术', desc: '+3 血，+3 甲。' },
      { id: 'tt3-purify-arrow',  name: '净化箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，净化负面效果。' },
      { id: 'tt3-arrow-rain',    name: '箭雨',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，全体攻击。' },
      { id: 'tt3-wave-slash',    name: '破浪斩',   cost: 2, rarity: '古朴', type: '武术', dmg: 3, dmgType: 'attack', desc: '攻⁺3，下回合无法抽牌。' },
      { id: 'tt3-qi-wave',       name: '气功波',   cost: 3, rarity: '古朴', type: '武术', desc: '抽 1 张牌，对全体敌人造成等量伤害。' },
      { id: 'tt3-hold-fast',     name: '坚守',     cost: 2, rarity: '初始', type: '武术', desc: '+3 甲，抽 1 张牌。' },
      { id: 'tt3-life-arrow',    name: '生命箭',   cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，获得 1 张随机卡牌。' },
      { id: 'tt3-dig-treasure',  name: '挖宝',     cost: 4, rarity: '古朴', type: '武术', desc: '从牌库底发现 1 张牌，并获得等价护甲。' },
      { id: 'tt3-reshot',        name: '重新',     cost: 2, rarity: '古朴', type: '武术', dmg: 2, dmgType: 'attack', desc: '攻⁺2。' },
      { id: 'tt3-venom-arrow',   name: '毒箭',     cost: 2, rarity: '古朴', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻⁺1，附加中毒。' },
      { id: 'tt3-toxin',         name: '毒药',     cost: 0, rarity: '初始', type: '武术', desc: '附加 1 层中毒。' },
      { id: 'tt3-frostfall',     name: '剑落纷霜', cost: 2, rarity: '传说', type: '武术', dmg: 5, dmgType: 'attack', desc: '攻5，破坏敌方手牌中 1 张武术。', value: 5 }, // 传说系列重拍：首张照片，效果修订（旧读「破坏冰阵」）
      // —— 武术（本摞照片重辨补录 1 张）——
      { id: 'tt3wu-shike',       name: '割蚀',     cost: 2, rarity: '古朴', type: '武术', desc: '降低 1 名敌人 2 攻，附加流血。' },
      // —— 法术 / 药水（第一摞 28 张）——
      { id: 'tt3-mystery-potion', name: '神秘药水', cost: 3, rarity: '古朴', type: '道具', desc: '随机神秘效果。', value: 2 },
      { id: 'tt3-blue-potion',   name: '蓝瓶药水', cost: 3, rarity: '古朴', type: '道具', desc: '回复 3 点生命，抽 1 张牌。', value: 2 },
      { id: 'tt3-treasure-hunt', name: '寻宝',     cost: 2, rarity: '古朴', type: '法术', desc: "3′，发现 1 张牌。" },
      { id: 'tt3-flame-storm',   name: '火焰风暴', cost: 3, rarity: '稀有', type: '法术', dmg: 3, desc: '对全体敌人造成 3 点伤害。', value: 3 },
      { id: 'tt3-nature-form',   name: '自然升华', cost: 4, rarity: '稀有', type: '法术', desc: '本场战斗中，能量上限 +1。' },
      { id: 'tt3-python-potion', name: '巨蟒药水', cost: 2, rarity: '古朴', type: '道具', desc: '召唤巨蟒助战。', value: 2 },
      { id: 'tt3-chain-lightning', name: '闪电链', cost: 2, rarity: '古朴', type: '法术', desc: "3′，2 段伤害。" },
      { id: 'tt3-houyi-potion',  name: '后羿药水', cost: 2, rarity: '古朴', type: '道具', desc: '本回合攻击 +2。', value: 2 },
      { id: 'tt3-fireball',      name: '火球',     cost: 2, rarity: '衍生', type: '法术', dmg: 4, unrandom: true, desc: '造成 4 点伤害（4′）。' }, // 衍生牌（2026-09-16 留言「把火球设定成衍生」）：不再每局携带，仅由三重火球等效果生成；不随机掉落/发现/上架
      { id: 'tt3-holy-water',    name: '圣水',     cost: 2, rarity: '古朴', type: '法术', desc: '回复 4 点生命，净化负面效果。', value: 2 },
      { id: 'tt3-skewer',        name: '穿刺',     cost: 2, rarity: '古朴', type: '法术', dmg: 2, desc: '造成 2 点伤害，无视护甲。', value: 3 },
      { id: 'tt3-holy-shield',   name: '圣盾',     cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '获得 5 点护甲。', value: 2 }, // 2026-09-05 职业整合：原地转为牧师职业卡
      { id: 'tt3-iceheart-potion', name: '冰心药水', cost: 2, rarity: '古朴', type: '道具', desc: '免疫冰冻，回复 3 点生命。', value: 2 },
      { id: 'tt3-demon-potion',  name: '魔化药水', cost: 2, rarity: '古朴', type: '道具', desc: '本回合法术伤害 +2。', value: 2 },
      { id: 'tt3-nuke-ray',      name: '核爆射线', cost: 2, rarity: '史诗', type: '法术', dmg: 4, desc: '造成 4 点伤害。', value: 4 },
      { id: 'tt3-petal',         name: '花瓣',     cost: 2, rarity: '稀有', type: '法术', desc: '每回合结束回复 2 点生命。', value: 4 },
      // —— 法术 / 药水（第二摞补 11 张）——
      { id: 'tt3-magic-lamp',    name: '神灯',     cost: 4, rarity: '古朴', type: '法术', desc: '抉择：1° 发现 1 张牌并释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，+5 甲。' },
      { id: 'tt3-thornfield',    name: '棘刺之地', cost: 3, rarity: '古朴', type: '法术', desc: '对所有敌人附加 1 层中毒，+1 甲。' },
      { id: 'tt3-mind-potion',   name: '精神药水', cost: 2, rarity: '稀有', type: '道具', desc: '抽 2 张牌。', value: 4 },
      { id: 'tt3-turnabout-potion', name: '转势药水', cost: 1, rarity: '稀有', type: '道具', desc: '使所有敌人附加陷阱牌。', value: 3 },
      { id: 'tt3-firm-barrier',  name: '坚冰结界', cost: 4, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '延长 1 名角色的冰冻 1 回合。（手绘卡左上角注 free）' }, // 2026-09-05 职业整合：原地转为法师职业卡
      { id: 'tt3-ice-spike',     name: '冰刺',     cost: 2, rarity: '古朴', type: '法术', desc: "1′，附加冰冻。" },
      { id: 'tt3-grope',         name: '摸索',     cost: 1, rarity: '古朴', type: '法术', desc: '抽 2 张牌。', value: 3 },
      { id: 'tt3-mixed-potion',  name: '混血药水', cost: 1, rarity: '古朴', type: '道具', desc: '造成 2 点伤害，附加流血。', value: 2 },
      // —— 法术（重辨补录 15 张：此前未入库的同摞卡）——
      { id: 'tt3sp-dodge',        name: '闪避',     cost: 2, rarity: '古朴', type: '法术', desc: '应对攻击时：避开 1 段伤害。' },
      { id: 'tt3sp-devour',       name: '吞噬',     cost: 3, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '消灭 1 名 4 级及以下小怪。', value: 2 }, // 2026-09-05 职业整合：原地转为牧师职业卡
      { id: 'tt3sp-doom',         name: '毁灭',     cost: 3, rarity: '史诗', type: '法术', desc: '消灭 2 名 5 级及以下小怪，不可复原。' },
      { id: 'tt3sp-silverthorn',  name: '银刺',     cost: 2, rarity: '古朴', type: '法术', desc: "5′；注能(小)：改为 8′。" },
      { id: 'tt3sp-magicoil',     name: '魔法药水', cost: 2, rarity: '古朴', type: '法术', desc: "限定：1′，抽 1 张牌。" },
      { id: 'tt3sp-shadowbug',    name: '影蛊',     cost: 3, rarity: '古朴', type: '法术', desc: '本回合偷取 1 名敌人的攻击。' },
      { id: 'tt3sp-flowerzhen',   name: '花鸩',     cost: 4, rarity: '古朴', type: '法术', desc: '使 1 名角色中毒层数效果翻倍。' },
      { id: 'tt3sp-bloodstorm',   name: '血腥风暴', cost: 4, rarity: '稀有', type: '法术', desc: "3′，吸血，对敌方全体；注能(2)：额外施放 1 段。" },
      { id: 'tt3sp-shadowshot',   name: '暗影射击', cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: "3′，若对手处于诅咒状态，额外施放 1 次。", value: 2 }, // 2026-09-05 职业整合：原地转为降临者职业卡
      // —— 杂项（第三摞 9 张：高费大招与宝物）——
      { id: 'tt3-thunderblast',  name: '雷殛',     cost: 3, rarity: '传说', type: '法术', dmg: 7, dmgType: 'spell', desc: "7′，墓地指定 1 张牌，伤害 +1。", value: 5 }, // 传说系列重拍：desc 重辨（原文疑「蓄地槽…」），机制沿旧读「从墓地指定」
      { id: 'tt3-flux-slash',    name: '流光斩',   cost: 2, rarity: '传说', type: '武术', dmg: 1, dmgType: 'attack', desc: '攻1，附加 2 层流血；将流光斩复制放入牌库。', value: 5 }, // 传说系列重拍：改武术、攻1、复制入牌库（原文「流光照影放入牌库」重辨存疑）
      { id: 'tt3-immortal-blade', name: '不朽神剑', cost: 2, rarity: '传说', type: '装备', desc: '对战开始时，你的攻击化为 1 张不朽斩。', value: 5 }, // 传说系列重拍：效果按本批照片重写
      { id: 'tt3-diamond',       name: '钻石',     cost: 0, rarity: '传说', type: '资源', desc: '贵重货币，可出售。', value: 16, unrandom: true },
      { id: 'tt3-master-staff',  name: '大师的神杖', cost: 2, rarity: '稀有', type: '道具', desc: '回合开始时回复 5 点生命。', value: 5 },
      { id: 'tt3-chaos-eye',     name: '混沌之眼', cost: 1, rarity: '传说', type: '装备', desc: '装备：血量上限 +10，牌库上限 5。', value: 5 }, // 传说系列重拍：卡名/效果按本批照片（旧读「混沌眼」「生命上限+10」）
      { id: 'tt3-execute',       name: '斩杀',     cost: 3, rarity: '传说', type: '武术', dmg: 9, dmgType: 'spell', desc: "对 9 血以下角色造成 9′。", value: 5 }, // 传说系列重拍：角标武术、阈值 9 血
      { id: 'tt3-savior-elixir', name: '斗神酒', cost: 0, rarity: '传说', type: '道具', desc: '回复 99 点生命（相当于回满）。', value: 5 },
      // —— 装备（武器/防具/符印一摞；角标与描述已按第四批高清照片逐张重辨修正，
      //     未在本摞照片中出现的条目（魔纹银剑/深红丝袋/圣杖/玄龟/草甲/逆弓/聚魔之血/深衍日记）保持原样）——
      { id: 'tt3-silver-runesword', name: '魔纹银剑', cost: 2, rarity: '稀有', type: '装备', desc: '装备：攻击 +3。', value: 3 },
      { id: 'tt3-azure-sword',  name: '百炼青虹剑', cost: 2, rarity: '稀有', type: '装备', desc: '消耗时 +4 甲，将其置于牌库底。' },
      { id: 'tt3-deep-seal',    name: '深解印记', cost: 4, rarity: '稀有', type: '装备', desc: '诅咒状态下，攻 +2，法伤 +2。' },
      { id: 'tt3-fate-wheel',   name: '命运钟表', cost: 4, rarity: '史诗', type: '装备', desc: '限定：弃掉所有手牌，获得 1 个额外回合。' },
      { id: 'tt3-crimson-pouch', name: '深红丝袋', cost: 2, rarity: '稀有', type: '装备', desc: '装备：可复制你装备的 1 张牌。', value: 4 },
      { id: 'tt3-holy-staff',   name: '圣杖',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：消耗能量进入法阵。', value: 3 },
      { id: 'tt3-staff',        name: '法杖',     cost: 2, rarity: '古朴', type: '装备', desc: '法伤 +1。' },
      // 灭魔之剑 tt3-dark-blade 已整卡退役（2026-09-16 留言「删除灭魔之剑」，cards-sync v24 retire 清旧档）
      { id: 'tt3-wolf-bow',     name: '天狼长弓', cost: 2, rarity: '稀有', type: '装备', desc: '回合开始时，舍弃 1 张牌并抽 1 张牌。' },
      { id: 'tt3-sapper-bomb',  name: '石工炸药', cost: 2, rarity: '古朴', type: '装备', desc: '消耗时，造成 4 点伤害。' },
      { id: 'tt3-twinwater-mail', name: '二水甲', cost: 2, rarity: '古朴', type: '装备', desc: '冰冻 1 名敌人后，+1 甲。' },
      { id: 'tt3-grass-armor',  name: '草甲',     cost: 1, rarity: '古朴', type: '装备', desc: '装备：装备时回复 2 点生命。', value: 2 },
      { id: 'tt3-blooddrinker', name: '饮血剑',   cost: 2, rarity: '古朴', type: '装备', desc: '本局对战内，每消灭 1 个敌人，+1 攻。' },
      { id: 'tt3-longsword',    name: '长剑',     cost: 2, rarity: '初始', type: '装备', desc: '+1 攻。' },
      { id: 'tt3-element-seal', name: '元素符印', cost: 4, rarity: '稀有', type: '装备', desc: '注能 2 张法术牌后解锁：法伤 +2，抽 2 张牌。' },
      { id: 'tt3-light-mail',   name: '轻甲',     cost: 2, rarity: '古朴', type: '装备', desc: '+5 血。' },
      { id: 'tt3-reverse-bow',  name: '逆弓',     cost: 2, rarity: '古朴', type: '装备', desc: '装备：对方行动时，将 2 张手牌换新。', value: 2 },
      { id: 'tt3-deep-diary',   name: '深衍日记', cost: 1, rarity: '古朴', type: '装备', desc: '装备：记载深处的秘密。', value: 3 },
      // —— 装备（第四批照片重辨补录 2 张：此前未入库）——
      { id: 'tt3eq-boiler',     name: '魔法锅炉', cost: 3, rarity: '古朴', type: '装备', desc: '限定：消耗至多 2 张牌，发现等量随机卡牌。' },
      { id: 'tt3eq-mistbox',    name: '迷之匣',   cost: 2, rarity: '古朴', type: '装备', desc: '对战开始时，将 2 张攻替换为随机卡牌。' },
      // —— 资源（散卡 3 张）——
      { id: 'tt3-garnet-marble', name: '石榴石弹珠', cost: 0, rarity: '古朴', type: '资源', desc: '漂亮的小玩意，可出售。', value: 4, unrandom: true }, // 2026-09-13 老板拍板：卖价 3→4，并退出商店/发现池
      { id: 'tt3-wood-bundle',  name: '一捆木材', cost: 0, rarity: '稀有', type: '资源', desc: '木材 ×3。', value: 6 },
      { id: 'tt3-ration-double', name: '双份口粮', cost: 0, rarity: '稀有', type: '资源', desc: '口粮 ×2。', value: 6 },
    ],

    // 桌游手绘卡 · 第四批（2026-09-01 照片提取，15 张）：
    // 13 张与第一批同设计（员工通行证B ×2、银币 ×2、铜币 ×3 含「高价值」1 张、
    // 员工通行证A、能源结晶、金疮药、急救合剂、金币），不再重复入库；高清照片同时
    // 修正第一批「员工通行证B传说卡」识别。播本批新设计 3 张：员工通行证C、烟雾弹，
    // 以及「木化」——资源标注重拍照片证实它是独立药水卡（回复 6 血、物品·2币），
    // 此前被误并入「木材」，已在第一批拆分还原。
    // 角标「[[icon:crystal]] 字」多数取卡名/效果用字（彩/木/水/金/传），唯烟雾弹 [[icon:crystal]]稀 与效果
    // 无关，按稀有度「稀有」解读。

    // 桌游手绘卡 · 第四批（2026-09-01 照片提取，15 张）：
    // 13 张与第一批同设计（员工通行证B ×2、银币 ×2、铜币 ×3 含「高价值」1 张、
    // 员工通行证A、能源结晶、金疮药、急救合剂、金币），不再重复入库；高清照片同时
    // 修正第一批「员工通行证B传说卡」识别。播本批新设计 3 张：员工通行证C、烟雾弹，
    // 以及「木化」——资源标注重拍照片证实它是独立药水卡（回复 6 血、物品·2币），
    // 此前被误并入「木材」，已在第一批拆分还原。
    // 角标「[[icon:crystal]] 字」多数取卡名/效果用字（彩/木/水/金/传），唯烟雾弹 [[icon:crystal]]稀 与效果
    // 无关，按稀有度「稀有」解读。
    TABLETOP4: [
      { id: 'tt4-shine-token', name: '员工通行证C', cost: 2, rarity: '史诗', type: '道具', desc: '发现 1 张传说卡。', value: 7 },
      { id: 'tt4-smoke-bomb',  name: '烟雾弹',   cost: 1, rarity: '稀有', type: '道具', desc: '非 BOSS 战逃跑一次。', value: 3 },
      { id: 'tt4-woodify',     name: '能量饮料', cost: 0, rarity: '初始', type: '道具', desc: '回复 6 点生命。', value: 2 },
    ],

    // 桌游手绘卡 · 第五批（2026-09-01「传说卡」照片，10 张）：
    // 全批为传说特例卡——非常强力，unrandom: true 锁死随机与发现获取
    // （含商店随机槽位；「员工通行证C：发现 1 张传说卡」同样发现不到它们）。
    // 照片中另 8 张为已有卡重拍：斩杀/流光斩/剑落纷霜/雷殛/混沌之眼/不朽神剑
    // 已在 TABLETOP3 升传说并按照片修订，斗神酒/钻石仅补 unrandom 标记。

    // 桌游手绘卡 · 第五批（2026-09-01「传说卡」照片，10 张）：
    // 全批为传说特例卡——非常强力，unrandom: true 锁死随机与发现获取
    // （含商店随机槽位；「员工通行证C：发现 1 张传说卡」同样发现不到它们）。
    // 照片中另 8 张为已有卡重拍：斩杀/流光斩/剑落纷霜/雷殛/混沌之眼/不朽神剑
    // 已在 TABLETOP3 升传说并按照片修订，斗神酒/钻石仅补 unrandom 标记。
    TABLETOP5: [
      { id: 'tt5-galaxy-voyage', name: '银河之旅',   cost: 4, rarity: '传说', type: '法术', desc: '本场对战中，你的所有法术均为 1 费。', value: 5 }, // 原文单字「术」，按法术解读
    ],

    // 桌游手绘卡 · 第六批（2026-09-01「事件卡」照片，10 张）：
    // 设计者定版——这一类是事件，只能在棋盘的事件格中触发，无法在背包中使用，
    // 背包里会记录本局触发过哪些事件（game.js 事件格结算 + 背包「事件记录」）。
    // 因此稀有度记为「衍生」（不进商店/随机池），并全部加 unrandom 双保险；
    // 闪金之锤角标 <事件战斗>、盗匪横行含反抗组织拾荒者×5，battle: true 供战斗结算识别。
    // tt6 事件卡与下方桌面区同名同 id 双版并存（微信版 233 张定版口径）——两处描述必须
    // 保持一致（2026-09-19 审计 D-5 对齐），实际结算效果以 game.run.flow eventChoiceSpec V2 为准。

    // 桌游手绘卡 · 第六批（2026-09-01「事件卡」照片，10 张）：
    // 设计者定版——这一类是事件，只能在棋盘的事件格中触发，无法在背包中使用，
    // 背包里会记录本局触发过哪些事件（game.js 事件格结算 + 背包「事件记录」）。
    // 因此稀有度记为「衍生」（不进商店/随机池），并全部加 unrandom 双保险；
    // 闪金之锤角标 <事件战斗>、盗匪横行含反抗组织拾荒者×5，battle: true 供战斗结算识别。
    // tt6 事件卡与下方桌面区同名同 id 双版并存（微信版 233 张定版口径）——两处描述必须
    // 保持一致（2026-09-19 审计 D-5 对齐），实际结算效果以 game.run.flow eventChoiceSpec V2 为准。
    TABLETOP6: [
      { id: 'tt6-demondeal',   name: '恶魔交易',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '-5血，获得1个大宝箱。' },
      { id: 'tt6-bandits',     name: '盗匪横行',   cost: 0, rarity: '衍生', type: '事件', battle: true, unrandom: true, desc: '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。' },
      { id: 'tt6-mystery',     name: '神秘补给',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得员工通行证A碎片，+2 币。' },
      { id: 'tt6-goldmine',    name: '金矿',       cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得 3 币。' },
      { id: 'tt6-goldhammer',  name: '闪金之锤',   cost: 0, rarity: '衍生', type: '事件', battle: true, unrandom: true, desc: '造成 5 点伤害，若斩杀敌人，+2 币。' },
      { id: 'tt6-relief',      name: '爱心救济站', cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '回复 6 血。' },
      { id: 'tt6-airdrop',     name: '空中补给',   cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '从木材、口粮、能量饮料、随机药水中抽取一项。' },
      { id: 'tt6-chestdraw',   name: '宝箱',       cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '从大，中，小宝箱中抽取 1 个。' },
      { id: 'tt6-systemsupply', name: '系统补给',  cost: 0, rarity: '衍生', type: '事件', unrandom: true, desc: '获得员工通行证A碎片，木材 ×1。' },
    ],

    // 桌游手绘卡 · 第七批（2026-09-01「职业卡」照片 → 2026-09-05 职业整合定版）：
    // 2026-09-05 设计者定版：原 11 职业 44 张职业卡整合为 5 职业（侠客/战士/牧师/法师/降临者），
    // 每职业 10-12 张职业卡（含本批新增 cc- 前缀整合卡与第三批原地转职的 4 张，全表见
    // docs/class-consolidation.md）；职业卡 rarity 全部为「职业」，unrandom 锁死随机与发现获取
    // ——不同职业不互通，只经 classPool / randomClassCard 按职业发放。
    // 实机卡库的老卡改归属/更名/退役与 cc- 新卡补种由 ensureClassConsolidation() 完成。

    // 桌游手绘卡 · 第七批（2026-09-01「职业卡」照片 → 2026-09-05 职业整合定版）：
    // 2026-09-05 设计者定版：原 11 职业 44 张职业卡整合为 5 职业（侠客/战士/牧师/法师/降临者），
    // 每职业 10-12 张职业卡（含本批新增 cc- 前缀整合卡与第三批原地转职的 4 张，全表见
    // docs/class-consolidation.md）；职业卡 rarity 全部为「职业」，unrandom 锁死随机与发现获取
    // ——不同职业不互通，只经 classPool / randomClassCard 按职业发放。
    // 实机卡库的老卡改归属/更名/退役与 cc- 新卡补种由 ensureClassConsolidation() 完成。
    TABLETOP7: [
      // —— 侠客（← 刺客 + 剑客 + 游侠；能力卡：白梅落影·妄 / 天剑诛魔·云阳 / 无量仙剑·云风）——
      { id: 'tt7-throwblade',  name: '飞刃偷袭',   cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 3, dmgType: 'attack', desc: '攻3，附加流血，抽 1 张牌。', value: 3 },
      { id: 'tt7-goldencicada', name: '金蝉脱壳',  cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '弃掉所有手牌，抽 3 张。', value: 4 },
      { id: 'tt7-sneak',       name: '偷袭',       cost: 0, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1。', value: 3 },
      { id: 'tt7-ghostblade',  name: '鬼魅之刃',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，破隐时伤害 +2，并抽 2 张牌。', value: 3 },
      { id: 'tt7-thundergrudge', name: '快意恩仇', cost: 3, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 0, dmgType: 'attack', desc: '消耗 2 张初始攻击，攻击 3 次。', value: 3 }, // 定版更名（原疾雷恩仇），代价句对齐 battle.core「消耗 N 张杀」结算
      { id: 'tt7-meteorrain',  name: '流星箭雨',   cost: 2, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，2 段伤害。', value: 3 },
      { id: 'tt7-stealth',     name: '潜匿',       cost: 1, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '进入潜行状态 1 回合。', value: 4 },
      { id: 'tt7-swordimmortal', name: '剑仙形态', cost: 3, rarity: '职业', type: '武术', cls: '侠客', unrandom: true, desc: '对决中，每回合额外抽 1 张。', value: 4 }, // 定版更名（原剑仙附身）
      // —— 战士（← 战士 + 守卫；能力卡：青龙化身 / 圣剑化身，2026-09-13 老板拍板定名，原 龙吟沧海·关云长 / 圣剑誓约·亚瑟）——
      { id: 'cc-unmoved',      name: '不变应万变', cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合所受伤害降为 1，获得 4 点护甲。', value: 3 },
      { id: 'tt7-marchrush',   name: '急行军',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '抽 2 张牌，+4 甲；压制：抽 1 张牌。', value: 3 }, // 定版更名（原急行奔驰）
      { id: 'tt7-bulwark',     name: '坚盾',       cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '本回合获得 8 点护甲，回合结束 -4 点。', value: 2 },
      { id: 'tt7-armup',       name: '武装',       cost: 1, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '从牌库中抽取 1 张装备贮藏。', value: 2 },
      { id: 'tt7-whirlwind',   name: '旋风斩',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，全体攻击。', value: 2 },   // 2026-09-17 留言「旋风斩应为2费」
      { id: 'tt7-demonbreaker', name: '破甲重斩',  cost: 3, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 5, dmgType: 'attack', desc: '攻5，附加破甲；击杀则 +4 甲。', value: 3 },
      { id: 'tt7-fullstrike',  name: '全力一击',   cost: 3, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 5, dmgType: 'attack', desc: '攻5，抽 1 张牌。', value: 2 },
      { id: 'tt7-ironphalanx', name: '铁甲阵',     cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, desc: '+10 甲，洗入 5 张随机卡牌。', value: 4 },
      { id: 'tt7-bloodpoison', name: '血毒双镖',   cost: 2, rarity: '职业', type: '武术', cls: '战士', unrandom: true, dmg: 1, dmgType: 'attack', desc: '攻1，附加流血；攻1，附加中毒。', value: 2 },
      // —— 牧师（← 牧师 + 授印者 + 术士；能力卡：浪掷风吟 / 禁术解放，2026-09-13 老板拍板实机定名）——
      // 另有 吞噬（tt3sp-devour）/ 圣盾（tt3-holy-shield）自第三批原地转职为本职业卡
      { id: 'tt7-silence',     name: '禁言术',     cost: 0, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '沉默 1 名角色 1 回合，抽 1 张牌。', value: 2 },
      { id: 'cc-demon',        name: '恶魔之力',   cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，损失 2 点生命。", value: 3 },
      { id: 'tt7-holyglow',    name: '沐愈光辉',   cost: 4, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '将自身血量回复至 12 血。', value: 3 },
      { id: 'tt7-holyheal',    name: '圣光治愈',   cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '弃置 1 张牌，回复 2 倍于其费用的血量。', value: 2 },
      { id: 'tt7-provoke',     name: '扰敌',       cost: 1, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, desc: '迫使 2 名敌人斗殴。', value: 2 },
      { id: 'tt7-bloodpotion', name: '噬血术',     cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 3, dmgType: 'spell', desc: "混合：3′，吸血。", value: 3 }, // 定版更名（原噬血药水）
      { id: 'tt7-smite',       name: '惩击',       cost: 2, rarity: '职业', type: '法术', cls: '牧师', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，对血量以下的敌人不能增益。", value: 2 },
      // —— 法师（← 法师 + 召唤师；能力卡：博览者的狂语 / 花开两面，2026-09-13 老板拍板实机定名）——
      // 另有 坚冰结界（tt3-firm-barrier）自第三批原地转职为本职业卡
      { id: 'tt7-arcanebolt',  name: '奥术弹',     cost: 0, rarity: '职业', type: '法术', cls: '法师', unrandom: true, dmg: 1, dmgType: 'spell', desc: "1′，抽 1 张牌。", value: 3 },
      { id: 'tt7-energize',    name: '聚能',       cost: 0, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '能量 +1。', value: 2 },
      { id: 'tt7-frozenight',  name: '冰封千里',   cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '冰冻所有敌人。', value: 3 },
      { id: 'tt7-stratagem',   name: '法师锦囊',   cost: 1, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '对战开始时拿 3 张牌备用，打牌时选择 1 张施放。', value: 3 }, // 定版更名（原锦囊）
      { id: 'tt7-bladebloom',  name: '永恒绽放',   cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '发现并施放 1 张牌，获取剩下两张。', value: 4 }, // 定版更名（原利刃绽放）
      { id: 'tt7-recruit',     name: '征召',       cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '注能(小)：召唤骑兵 ×2 冲锋作战。', value: 3 },
      { id: 'tt7-elementstorm', name: '元素风暴',  cost: 3, rarity: '职业', type: '法术', cls: '法师', unrandom: true, desc: '注能(小)：下一张法术施放 2 次。', value: 4 },
      // —— 降临者（← 降临者 + 授印者；能力卡：九尾焚天·妲 / 楔天玄翼·焚殃）——
      // 另有 暗影射击（tt3sp-shadowshot）自第三批原地转职为本职业卡
      { id: 'tt7-burnharvest', name: '爆燃火球',   cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，受法伤加成翻倍。", value: 3 }, // 定版更名（原燃烧收获）；注能收益已删（ensureCardFixes，2026-09-05）
      { id: 'tt7-twinfireball', name: '三重火球',  cost: 2, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，可使用 3 次。", value: 4 }, // 定版更名（原双生火球），次数按三重
      { id: 'tt7-abysscurse',  name: '深渊诅咒',   cost: 3, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, dmg: 4, dmgType: 'spell', desc: "4′，附加禁疗；此时对方每有 1 种诅咒，抽 1 张牌。", value: 3 },
      { id: 'tt7-meteorstrong', name: '星陨之力',  cost: 4, rarity: '职业', type: '法术', cls: '降临者', unrandom: true, desc: "注能(2)：施放 3 次火球术(4′)。", value: 4 }, // 定版更名（原陨强）
    ],

    // 桌游手绘卡 · 第八批（2026-09-01「英雄卡」照片 → 2026-09-05 职业整合定版；类型 2026-09-08 定版更名「能力卡」）：
    // 能力卡 = 各职业的觉醒形态（角标「职业·觉醒」），type 能力卡、cls 绑定职业、hero: true；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡：
    //   侠客：妄 / 云阳 / 云风 · 战士：青龙化身 / 圣剑化身 · 牧师：浪掷风吟 / 禁术解放（2026-09-13 实机定名）
    //   法师：博览者的狂语 / 花开两面（原召唤师英雄定版更名）· 降临者：邪渊主宰 / 充能火山
    // 原授印者英雄「邪渊主宰」2026-09-05 改归降临者；2026-09-13 实机定名定回「邪渊主宰」
    //（描述按降临者火焰主题重写，卡面立绘随 cls 自动换为降临者）；
    // 其印记衍生牌（治伤+1 等 4 张）未随迁，保留退役。
    // 能力卡本体只能通过 ① 事件拼凑 ② 祭坛弃牌 ③ 员工通行证A 三种途径获得——均不实装为
    // 随机获取，故全部 unrandom（获取途径待后续版本实装）。
    // 衍生牌（角标「衍」/「××专属·衍生」）围绕英雄效果展开：rarity 衍生、
    // tokenOf 指向所属英雄；禁咒×4 由牧师英雄「禁术解放」洗入牌库，
    // 诛魔剑系由侠客英雄「天剑诛魔·云阳」洗入牌库，青龙偃月斩为战士英雄武器。
    // 角标 [[icon:crystal]][[icon:crystal]]/[[icon:crystal]] 照录为稀有/古朴；「5[[icon:coin]]/8[[icon:coin]]」为币值（右下盾形数字同值）。

    // 桌游手绘卡 · 第八批（2026-09-01「英雄卡」照片 → 2026-09-05 职业整合定版；类型 2026-09-08 定版更名「能力卡」）：
    // 能力卡 = 各职业的觉醒形态（角标「职业·觉醒」），type 能力卡、cls 绑定职业、hero: true；
    // 2026-09-05 职业整合后每职业 1-3 张能力卡：
    //   侠客：妄 / 云阳 / 云风 · 战士：青龙化身 / 圣剑化身 · 牧师：浪掷风吟 / 禁术解放（2026-09-13 实机定名）
    //   法师：博览者的狂语 / 花开两面（原召唤师英雄定版更名）· 降临者：邪渊主宰 / 充能火山
    // 原授印者英雄「邪渊主宰」2026-09-05 改归降临者；2026-09-13 实机定名定回「邪渊主宰」
    //（描述按降临者火焰主题重写，卡面立绘随 cls 自动换为降临者）；
    // 其印记衍生牌（治伤+1 等 4 张）未随迁，保留退役。
    // 能力卡本体只能通过 ① 事件拼凑 ② 祭坛弃牌 ③ 员工通行证A 三种途径获得——均不实装为
    // 随机获取，故全部 unrandom（获取途径待后续版本实装）。
    // 衍生牌（角标「衍」/「××专属·衍生」）围绕英雄效果展开：rarity 衍生、
    // tokenOf 指向所属英雄；禁咒×4 由牧师英雄「禁术解放」洗入牌库，
    // 诛魔剑系由侠客英雄「天剑诛魔·云阳」洗入牌库，青龙偃月斩为战士英雄武器。
    // 角标 [[icon:crystal]][[icon:crystal]]/[[icon:crystal]] 照录为稀有/古朴；「5[[icon:coin]]/8[[icon:coin]]」为币值（右下盾形数字同值）。
    TABLETOP8: [
      // —— 能力卡（5 职业 · 11 张）——
      { id: 'tt8-hero-assassin',   name: '白梅落影·妄',       cost: 0, rarity: '稀有', type: '能力卡', cls: '侠客', hero: true, unrandom: true, desc: '潜入夺宝：净化陷阱，潜行 2 回合；破隐一连击开弹幕。', value: 5 }, // 关键词与尾句重辨存疑
      { id: 'tt8-hero-sword',      name: '无量仙剑·云风',     cost: 0, rarity: '稀有', type: '能力卡', cls: '侠客', hero: true, unrandom: true, desc: '万剑归宗：抽 5 张牌，充能 +1。', value: 5 }, // 尾句重辨存疑
      { id: 'tt8-hero-ranger',     name: '天剑诛魔·云阳',     cost: 0, rarity: '古朴', type: '能力卡', cls: '侠客', hero: true, unrandom: true, desc: '寂断念：将天启剑与 5 件魔剑洗入牌库。', value: 5 }, // 关键词重辨存疑
      { id: 'tt8-hero-warrior',    name: '青龙化身',   cost: 0, rarity: '稀有', type: '能力卡', cls: '战士', hero: true, unrandom: true, desc: '真龙降世：攻 +2 的青龙偃月斩。', value: 8 },
      { id: 'tt8-hero-guardian',   name: '圣剑化身',     cost: 0, rarity: '古朴', type: '能力卡', cls: '战士', hero: true, unrandom: true, desc: '诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。', value: 8 },
      { id: 'tt8-hero-priest',     name: '浪掷风吟',   cost: 0, rarity: '稀有', type: '能力卡', cls: '牧师', hero: true, unrandom: true, desc: '甘霖降世：置入随机卡牌直至 6 张；每 1 次施法回复 3 血。', value: 5 },
      { id: 'tt8-hero-warlock',    name: '禁术解放', cost: 0, rarity: '稀有', type: '能力卡', cls: '牧师', hero: true, unrandom: true, desc: '无定横行：将四张禁咒洗入牌库，然后抽 2 张牌。', value: 5 }, // 定名 2026-09-13 老板拍板实机名（原 无极梦魇·血苑修罗）
      { id: 'tt8-hero-mage',       name: '博览者的狂语',     cost: 0, rarity: '稀有', type: '能力卡', cls: '法师', hero: true, unrandom: true, desc: '万法乾坤：法伤 +1，回合结束时抽 1 张牌。', value: 5 },
      { id: 'tt8-hero-summoner',   name: '花开两面',   cost: 0, rarity: '稀有', type: '能力卡', cls: '法师', hero: true, unrandom: true, desc: '元素潮汐：打开神界之门。', value: 5 }, // 定名 2026-09-13 老板拍板实机名（原 神话终章·雷修斯）
      { id: 'tt8-hero-sealer',     name: '邪渊主宰', cost: 0, rarity: '稀有', type: '能力卡', cls: '降临者', hero: true, unrandom: true, desc: '深渊降焰：法伤 +1，每消耗 1 张卡牌，施放 1 次火球。', value: 5 }, // 定版更名并改归降临者（原授印者英雄「邪渊主宰」）；效果沿用「每消耗 1 张牌施放火球」结算
      { id: 'tt8-hero-descender',  name: '充能火山',     cost: 0, rarity: '古朴', type: '能力卡', cls: '降临者', hero: true, unrandom: true, dmg: 4, dmgType: 'spell', desc: "寂灭苍穹：法伤 +1，每消耗 1 张牌，施放 1 次火球术(4′)。", value: 5 }, // 卡名重辨存疑
      // —— 衍生牌 · 牧师专属（禁术解放洗入牌库的禁咒）——
      { id: 'tt8-curse1', name: '禁咒I',   cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：夺取 1 点攻击力。', value: 5 },
      { id: 'tt8-curse2', name: '禁咒II',  cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：冰冻。', value: 5 },
      { id: 'tt8-curse3', name: '禁咒III', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：中毒，流血。', value: 5 },
      { id: 'tt8-curse4', name: '禁咒IV', cost: 0, rarity: '衍生', type: '法术', cls: '牧师', tokenOf: 'tt8-hero-warlock', unrandom: true, desc: '抽到时施放：沉默 1 回合。', value: 5 },
      // —— 衍生牌 · 侠客专属（天剑诛魔·云阳洗入牌库的剑）——
      { id: 'tt8-demonslay',  name: '诛魔剑',     cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '抽到时攻击全体敌人；以天启诛魔剑覆盖你的所有武器。', value: 4 },
      { id: 'tt8-archdemon',  name: '天启诛魔剑', cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '攻 +1，手中所有武器牌视为重衍。', value: 5 }, // 尾句重辨存疑
      { id: 'tt8-heavensword', name: '天启剑',    cost: 0, rarity: '衍生', type: '装备', cls: '侠客', tokenOf: 'tt8-hero-ranger', unrandom: true, desc: '抽到时额外抽 1 张牌；在你抽到天启剑与 5 件魔剑后……', value: 4 },
      // —— 衍生牌 · 战士（青龙化身的佩刀）——
      { id: 'tt8-dragonblade', name: '青龙偃月斩', cost: 0, rarity: '衍生', type: '武术', cls: '战士', tokenOf: 'tt8-hero-warrior', unrandom: true, dmg: 6, dmgType: 'attack', desc: '攻6，破甲，流血。', value: 8 },
    ],

    // 生物图鉴（第九批，2026-09-04 定版：新卡牌类型「生物」——与武术/法术等并列）。
    // 2026-09-09 老板定版：新世界观命名 + 五层分布（联邦部队 / 反抗组织 / 双阵营能力者 / 变异生物体）。
    // 全部敌人信息录入：数值与 mapData.js monsters / altar.bosses 一一对应
    // （角标「攻-血」即设计者记法，如巨兽「荒渊」7-40）；art 字段指向战场立绘 id。
    // 生物卡是敌人图鉴：unrandom + 衍生稀有度双重排除，不进商店/发现/随机池，
    // 也无法在对战中打出（battle.core unplayableReason）。

    // 生物图鉴（第九批，2026-09-04 定版：新卡牌类型「生物」——与武术/法术等并列）。
    // 2026-09-09 老板定版：新世界观命名 + 五层分布（联邦部队 / 反抗组织 / 双阵营能力者 / 变异生物体）。
    // 全部敌人信息录入：数值与 mapData.js monsters / altar.bosses 一一对应
    // （角标「攻-血」即设计者记法，如巨兽「荒渊」7-40）；art 字段指向战场立绘 id。
    // 生物卡是敌人图鉴：unrandom + 衍生稀有度双重排除，不进商店/发现/随机池，
    // 也无法在对战中打出（battle.core unplayableReason）。
    BESTIARY: [
      // —— 第 1 层 外围荒地：联邦巡防 vs 反抗拾荒 ——
      { id: 'foe-infantry',   name: '联邦巡防兵',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'infantry',   desc: '攻击 4 / 生命 4。联邦·第1层。普通近战，行动无特殊之处。' },
      { id: 'foe-archer',     name: '联邦射手',       cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'archer',     desc: '攻击 5 / 生命 3。联邦·第1层。远程攻击。' },
      { id: 'foe-bandit',     name: '反抗组织拾荒者', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'bandit',     desc: '攻击 3 / 生命 3。反抗·第1层。普通近战，成群出现（盗匪横行 ×5）。' },
      // —— 第 2 层 风雪哨线：双方正规部队 ——
      { id: 'foe-cavalry',    name: '联邦机动兵',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'cavalry',    desc: '攻击 5 / 生命 6。联邦·第2层。蓄力攻击：隔回合强化一击。' },
      { id: 'foe-orc_jav',    name: '反抗组织掷弹兵', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'orc_jav',    desc: '攻击 6 / 生命 4。反抗·第2层。远程投掷。' },
      // —— 第 3 层 冻土遗迹：异变初现 ——
      { id: 'foe-wolf_rider', name: '变异雪狼',       cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'wolf_rider', desc: '攻击 7 / 生命 6。变异·第3层。蓄力攻击：隔回合强化一击。' },
      { id: 'foe-orc_axe',    name: '甲壳变异体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'orc_axe',    desc: '攻击 4 / 生命 7。变异·第3层。防御/反击型，隔回合蓄势。' },
      // —— 第 4 层 高危战区：元素异变体 + 双阵营能力者 ——
      { id: 'foe-fire_el',    name: '灼热异变体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'fire_el',    desc: '攻击 10 / 生命 7。变异·第4层。攻击并灼烧。' },
      { id: 'foe-water_el',   name: '腐蚀异变体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'water_el',   desc: '攻击 7 / 生命 10。变异·第4层。防御/反击型，隔回合蓄势。' },
      { id: 'foe-esper_crow',   name: '白鸦', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_crow',
        desc: '攻击 8 / 生命 5。联邦能力者·第4层。碎晶齐射：远程多段攻击。' },
      { id: 'foe-esper_candle', name: '烛火', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_candle',
        desc: '攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击并灼烧。' },
      // —— 第 5 层 污染核心：深层异变 + 双阵营能力者 + 巨兽 ——
      { id: 'foe-grass_el',   name: '滋生异变体',     cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'grass_el',   desc: '攻击 5 / 生命 12。变异·第5层。攻击并施加诅咒。' },
      { id: 'foe-esper_silence', name: '静默', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_silence',
        desc: '攻击 7 / 生命 9。联邦能力者·第5层。声场压制：攻击并施加诅咒。' },
      { id: 'foe-esper_echo',    name: '回声', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'esper_echo',
        desc: '攻击 9 / 生命 7。反抗能力者·第5层。声波叠伤：远程多段攻击。' },
      { id: 'foe-dragon',     name: '巨兽「荒渊」',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'dragon', desc: '攻击 7 / 生命 40。变异·第5层精英。重击/特殊；第一回合蓄力不会攻击。' },
      // —— BOSS（污染核心三首脑）——
      { id: 'foe-boss_general', name: '肃清总督', cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_general',
        desc: '攻击 5 / 生命 50。BOSS·联邦。词缀【军威】：每个回合结束时攻击力 +2。' },
      { id: 'foe-boss_orc',   name: '变异巢母',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_orc',
        desc: '攻击 4 / 生命 45。BOSS·变异。词缀【狂乱】：每回合攻击两次，每次附加 1 层流血或中毒。' },
      { id: 'foe-boss_elem',  name: '异能领主',   cost: 0, rarity: '衍生', type: '生物', unrandom: true, art: 'boss_elem',
        desc: '攻击 8 / 生命 48。BOSS·能力者。词缀【元素庇幕】：偶数回合减免所有伤害（破甲可克制）。' },
    ],

    // 桌游手绘卡 · 第十批（2026-09-07 设计者实机定版同步）：与设计者实机卡库导出
    // （sdt-cards.json，2026-09 微信接收）双向合并的定版快照，由合并脚本生成：
    //   · 共享 id 卡取设计者精修稿（名字/费用/稀有度/类型/描述/词条/币值），
    //     结构字段（cls/hero/tokenOf）与仓库实现标记（battle/art）保仓库；
    //   · unrandom 随机锁取两侧并集；图鉴 foe-*、寻宝图、员工通行证A、初始火球、
    //     经济卡包、tt6-goldhammer、tt3-* 三张撞名职业卡按仓库定版保留（不在本批）；
    //   · 补种设计者实机有而仓库缺失的卡（流光照影/不朽斩/步兵/两扇门/
    //     灵能召唤/刀剑形态/法力光波）；「初始攻击」名字保持不变（老板 2026-09-07 指定）；
    //   · 同设计改名卡（火焰/冰冻/剧毒/流血药水）定版在设计者旧 id 上，
    //     仓库 09-06 转录用的 tt3-freeze 等四个重复 id 由 ensureTabletopSync() 移除。
    // 覆盖/补种走 ensureTabletopSync()（TT10_KEY 标记，一次性，按 id 整卡覆盖）。
    // 2026-09-20 防退回口径：本表快照冻结自 09-07，而定版持续演进在 cards-sync——本表若升
    // KEY 重播会把旧定义整卡写回（09-20 TT11 v6 重播即把受缚之残影退回邪渊主宰，实测）。
    // 故本表与 cards-sync 同 id 条目已按 sync 定版对齐，并由 tests/cards-sync-snapshot-guard.test.js
    // 守卫：改 sync 定版时必须同步本表（TT11 同规）。

    // 桌游手绘卡 · 第十批（2026-09-07 设计者实机定版同步）：与设计者实机卡库导出
    // （sdt-cards.json，2026-09 微信接收）双向合并的定版快照，由合并脚本生成：
    //   · 共享 id 卡取设计者精修稿（名字/费用/稀有度/类型/描述/词条/币值），
    //     结构字段（cls/hero/tokenOf）与仓库实现标记（battle/art）保仓库；
    //   · unrandom 随机锁取两侧并集；图鉴 foe-*、寻宝图、员工通行证A、初始火球、
    //     经济卡包、tt6-goldhammer、tt3-* 三张撞名职业卡按仓库定版保留（不在本批）；
    //   · 补种设计者实机有而仓库缺失的卡（流光照影/不朽斩/步兵/两扇门/
    //     灵能召唤/刀剑形态/法力光波）；「初始攻击」名字保持不变（老板 2026-09-07 指定）；
    //   · 同设计改名卡（火焰/冰冻/剧毒/流血药水）定版在设计者旧 id 上，
    //     仓库 09-06 转录用的 tt3-freeze 等四个重复 id 由 ensureTabletopSync() 移除。
    // 覆盖/补种走 ensureTabletopSync()（TT10_KEY 标记，一次性，按 id 整卡覆盖）。
    // 2026-09-20 防退回口径：本表快照冻结自 09-07，而定版持续演进在 cards-sync——本表若升
    // KEY 重播会把旧定义整卡写回（09-20 TT11 v6 重播即把受缚之残影退回邪渊主宰，实测）。
    // 故本表与 cards-sync 同 id 条目已按 sync 定版对齐，并由 tests/cards-sync-snapshot-guard.test.js
    // 守卫：改 sync 定版时必须同步本表（TT11 同规）。
    TABLETOP10: [
      { id: 'starter-attack', name: '初始攻击', cost: 1, rarity: '初始', type: '武术', desc: '攻（+0）：造成等同于攻击力的伤害。', dmg: 0, dmgType: 'attack', value: 1 },
      { id: 'tt-medneedle', name: '急救合剂', cost: 0, rarity: '稀有', type: '道具', desc: '回合开始时：回复 6点生命。持续 3 回合。', dmg: 0, heal: 16, value: 4 },
      { id: 'tt-copper', name: '铜币', cost: 0, rarity: '古朴', type: '资源', desc: '可出售。', dmg: 0, value: 3, sellable: true, unrandom: true },
      { id: "tt-keys-bunch", name: "两把钥匙", cost: 0, rarity: "稀有", type: "资源", dmg: 0, desc: "钥匙 ×2。", value: 4, sellable: false },
      { id: 'tt-rations', name: '口粮', cost: 0, rarity: '稀有', type: '资源', desc: '升级宠物。', dmg: 0, value: 3 },
      { id: 'tt-gold', name: '金币', cost: 0, rarity: '史诗', type: '资源', desc: '贵重货币，可出售。', dmg: 0, value: 9, sellable: true, unrandom: true },
      { id: 'tt-silver', name: '银币', cost: 0, rarity: '稀有', type: '资源', desc: '可出售。', dmg: 0, value: 6, sellable: true, unrandom: true },
      { id: "tt-key", name: "一把钥匙", cost: 0, rarity: "古朴", type: "资源", dmg: 0, desc: "解锁大门。", value: 2, sellable: false },
      { id: "tt-crystal", name: "能源结晶", cost: 0, rarity: "史诗", type: "道具", dmg: 0, desc: "在背包中才能使用，可以复原最多 3 张卡牌。", value: 3, sellable: false },
      { id: "tt-key-one", name: "三把钥匙", cost: 0, rarity: "史诗", type: "资源", dmg: 0, desc: "钥匙 ×3。", value: 6, sellable: false },
      { id: 'tt-token-gold', name: '员工通行证B', cost: 0, rarity: '史诗', type: '道具', desc: '随机获取 1 张传说卡（不含棱彩卡）。', dmg: 0, value: 4 },
      { id: 'tt-jinchuangyao', name: '金疮药', cost: 0, rarity: '史诗', type: '道具', desc: '回复 20 点生命。', dmg: 0, heal: 20, value: 4 },
      { id: 'tt-wood', name: '木材', cost: 0, rarity: '古朴', type: '资源', desc: '木材 ×1。', dmg: 0, value: 2 },
      { id: 'tt-wood-lots', name: '大量木材', cost: 0, rarity: '稀有', type: '资源', desc: '木材 ×2。', dmg: 0, value: 4 },
      { id: 'tt2-apollo', name: '阿猫的礼物', cost: 0, rarity: '史诗', type: '装备', desc: '发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌。', dmg: 0, value: 4 },
      { id: 'tt2-pearlbox', name: '珍珠盒', cost: 0, rarity: '稀有', type: '装备', desc: '内置3*3空间，可以容纳所有类型的资源卡牌。', dmg: 0, value: 3 },
      { id: 'tt2-wreck', name: '沉船宝盒', cost: 0, rarity: '史诗', type: '装备', desc: '消耗该牌时，获取 2张随机卡牌。', dmg: 0, value: 4 },
      { id: 'tt2-venomstaff', name: '毒杖', cost: 0, rarity: '史诗', type: '装备', desc: '每当你使用一张法术牌，为1名随机敌人附加中毒', dmg: 0, value: 4 },
      { id: 'tt2-frostsword', name: '寒冰剑', cost: 0, rarity: '古朴', type: '装备', desc: '对冰冻角色伤害 +2。', dmg: 0, value: 2 },
      { id: 'tt2-jianghu', name: '江湖救急', cost: 1, rarity: '史诗', type: '武术', desc: '发现 1 张其它职业的卡牌并直接施放。', dmg: 0, value: 4 },
      { id: 'tt2-swiftarrow', name: '迅疾箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），抽 1 张牌。', dmg: -1, dmgType: 'attack', draw: 1, value: 2 },
      { id: 'tt2-block', name: '格挡', cost: 1, rarity: '古朴', type: '武术', desc: '本回合所受伤害降为 1。', dmg: 0, value: 2 },
      { id: 'tt2-comboarrow', name: '连击箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1）；如果你打出的上一张牌是武术牌，本牌变为0费。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt2-piercearrow', name: '破甲箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），获得 3 点护甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2 },
      { id: 'tt2-shoot', name: '射击', cost: 0, rarity: '古朴', type: '武术', desc: '造成 2 点伤害。', dmg: 2, dmgType: 'fixed', value: 2 },
      { id: 'tt2-turtlearmor', name: '铸甲', cost: 1, rarity: '稀有', type: '武术', desc: '消耗1 张装备牌，+10甲。', dmg: 0, armor: 10, value: 3 },
      { id: 'tt2-bloodblade', name: '嗜血刃', cost: 2, rarity: '史诗', type: '武术', desc: '攻（+2），回复等量生命。', dmg: 2, dmgType: 'attack', value: 4 },
      { id: 'tt2-forestarrow', name: '绿化箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），+3 甲。', dmg: -1, dmgType: 'attack', armor: 3, value: 2 },
      { id: 'tt3-blood-arrow', name: '血箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），附加流血。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-fatal-pierce', name: '致命穿刺', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+1）；若对方处于流血状态，伤害 +2 并附加破甲，持续 1 回合。', dmg: 1, dmgType: 'attack', value: 2 },
      { id: 'tt3-fly-arrowhawk', name: '飞身劈', cost: 2, rarity: '稀有', type: '武术', desc: '攻（+3），触发的流血伤害翻倍。', dmg: 3, dmgType: 'attack', value: 3 },
      { id: 'tt3-frost-slash', name: '霜月斩', cost: 2, rarity: '史诗', type: '武术', desc: '攻（+2），附加冰冻与禁疗，持续1回合。', dmg: 2, dmgType: 'attack', value: 4 },
      { id: 'tt3-noon-duel', name: '正午决战', cost: 1, rarity: '史诗', type: '武术', desc: '下回合开始时，连开四枪！（每枪造成2点固定伤害）。', dmg: 0, value: 3 },
      { id: 'tt3-armor-rush', name: '破甲急袭', cost: 2, rarity: '稀有', type: '武术', desc: '攻（+4），附加 2 层流血。', dmg: 4, dmgType: 'attack', value: 3 },
      { id: 'tt3-double-shot', name: '连射', cost: 1, rarity: '稀有', type: '武术', desc: '造成2 点固定伤害，触发 3 次。', dmg: 2, dmgType: 'fixed', value: 2 },
      { id: 'tt3-bandage', name: '包扎', cost: 1, rarity: '古朴', type: '武术', desc: '+3 血，+3 甲。', dmg: 0, heal: 3, armor: 3 },
      { id: 'tt3-purify-arrow', name: '净化箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），净化自身。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-arrow-rain', name: '箭雨', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），目标为敌方全体。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-wave-slash', name: '破浪斩', cost: 1, rarity: '稀有', type: '武术', desc: '攻（+3），下回合无法抽牌。', dmg: 3, dmgType: 'attack', value: 2 },
      { id: 'tt3-qi-wave', name: '气功波', cost: 1, rarity: '古朴', type: '武术', desc: '抽 1 张牌，对全体敌人造成等同于其价格的固定伤害。', dmg: 0, draw: 1, value: 2 },
      { id: 'tt3-hold-fast', name: '坚守', cost: 1, rarity: '古朴', type: '武术', desc: '+5 甲，抽 1 张牌。', dmg: 0, draw: 1, armor: 5, value: 2 },
      { id: 'tt3-life-arrow', name: '生命箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），获得 1 张随机卡牌。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-dig-treasure', name: '挖宝', cost: 1, rarity: '古朴', type: '武术', desc: '从牌库底发现 1 张牌，并获得等同于其价格的护甲。', dmg: 0, value: 2 },
      { id: 'tt3-reshot', name: '重斩', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+2）。', dmg: 2, dmgType: 'attack', value: 2 },
      { id: 'tt3-venom-arrow', name: '毒箭', cost: 1, rarity: '古朴', type: '武术', desc: '攻（-1），附加 1层中毒。', dmg: -1, dmgType: 'attack', value: 2 },
      { id: 'tt3-toxin', name: '毒药', cost: 0, rarity: '古朴', type: '法术', desc: '附加 1 层中毒。抽 1 张牌。', dmg: 0, draw: 1, value: 2 },
      { id: 'tt3-frostfall', name: '剑荡妖邪', cost: 2, rarity: '传说', type: '武术', desc: '攻+5，选择手牌中 1 张武术卡直接释放。', dmg: 5, dmgType: 'attack', value: 5 },
      { id: 'tt3wu-shike', name: '割蚀', cost: 1, rarity: '古朴', type: '武术', desc: '降低 1 名敌人 2 攻，持续3回合；附加流血。', dmg: 0, value: 2 },
      { id: 'tt3-mystery-potion', name: '神秘药水', cost: 0, rarity: '稀有', type: '道具', desc: '回合开始时：变成1张随机招式卡牌，使其费用为0。', dmg: 0, value: 3 },
      { id: 'tt3-blue-potion', name: '恢复药水', cost: 0, rarity: '稀有', type: '道具', desc: '回复 5 点生命，回复1点能量。', dmg: 0, heal: 5, value: 2 },
      { id: 'tt3-treasure-hunt', name: '寻宝', cost: 1, rarity: '古朴', type: '法术', desc: '造成4点法术伤害，发现 1 张牌。', dmg: 4, dmgType: 'spell', value: 2 },
      { id: 'tt3-nature-form', name: '自然形态', cost: 2, rarity: '稀有', type: '法术', desc: '本局战斗中，能量上限 +1。', dmg: 0, value: 3 },
      { id: 'tt3-python-potion', name: '火焰药水', cost: 0, rarity: '稀有', type: '道具', desc: '对所有敌人造成2点法伤', dmg: 0, value: 3 },
      { id: 'tt3-chain-lightning', name: '闪电链', cost: 1, rarity: '古朴', type: '法术', desc: '3′，触发 2 次。', dmg: 3, dmgType: 'spell', value: 2 },
      { id: 'tt3-houyi-potion', name: '狂暴药水', cost: 0, rarity: '稀有', type: '道具', desc: '获得 2 点攻击力。持续 1 回合。', dmg: 0, value: 3 },
      { id: "tt3-holy-water", name: "治愈", cost: 1, rarity: "古朴", type: "法术", dmg: 0, heal: 5, desc: "回复 5 点生命，净化自身", value: 2 },
      { id: 'tt3-skewer', name: '穿刺', cost: 1, rarity: '古朴', type: '武术', desc: '攻（+2），附加破甲，持续 1 回合。', dmg: 2, dmgType: 'attack', value: 3 },
      { id: "tt3-holy-shield", cls: "牧师", name: "圣盾", cost: 1, rarity: "职业", type: "法术", dmg: 0, armor: 6, desc: "获得 6 点护甲；若你此时护甲为 0，本牌变为 0 费。", value: 3, unrandom: true },
      { id: 'tt3-iceheart-potion', name: '冰冻药水', cost: 0, rarity: '稀有', type: '道具', desc: '附加冰冻，持续 1 回合。', dmg: 0, value: 3 },
      { id: 'tt3-demon-potion', name: '法力药水', cost: 0, rarity: '稀有', type: '道具', desc: '法伤 +2。持续 1 回合。', dmg: 0, value: 2 },
      { id: 'tt3-magic-lamp', name: '神灯', cost: 1, rarity: '史诗', type: '法术', desc: '抉择：1° 发现 1 张牌并将其释放；2° 消灭 1 名受伤敌人（非 BOSS）；3° 冰冻 2 名角色，获得5 点护甲。', dmg: 0, value: 4 },
      { id: 'tt3-thornfield', name: '棘刺之地', cost: 2, rarity: '稀有', type: '法术', desc: '对所有敌人附加 2 层中毒，并立即触发1次毒伤。', dmg: 0, value: 3 },
      { id: 'tt3-mind-potion', name: '精神药水', cost: 0, rarity: '稀有', type: '道具', desc: '抽 2 张牌。', dmg: 0, draw: 2, value: 3 },
      { id: 'tt3-turnabout-potion', name: '剧毒药水', cost: 0, rarity: '稀有', type: '道具', desc: '对所有敌人附加1层中毒。', dmg: 0, value: 3 },
      { id: 'tt3-firm-barrier', cls: '法师', name: '坚冰结界', cost: 0, rarity: '职业', type: '法术', desc: '延长 1 名角色的冰冻 1 回合，抽1张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
      { id: 'tt3-ice-spike', name: '冰刺', cost: 1, rarity: '古朴', type: '法术', desc: '2′，附加冰冻。', dmg: 2, dmgType: 'spell' },
      { id: 'tt3-grope', name: '摸索', cost: 1, rarity: '古朴', type: '法术', desc: '抽2-3张牌。', dmg: 0, draw: 2, value: 2 },
      { id: 'tt3-mixed-potion', name: '流血药水', cost: 0, rarity: '稀有', type: '道具', desc: '造成 2 点固定伤害，附加流血。', dmg: 0, value: 2 },
      { id: 'tt3sp-dodge', name: '闪避', cost: 1, rarity: '古朴', type: '法术', desc: '本回合避开第1段伤害。', dmg: 0, value: 2 },
      { id: 'tt3sp-devour', cls: '牧师', name: '吞噬', cost: 1, rarity: '职业', type: '法术', desc: '消灭 1 名 攻击力4 点及以下小怪。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt3sp-doom', name: 'TNT', cost: 0, rarity: '史诗', type: '道具', desc: '消灭 2 名 攻击力5点及以下小怪', dmg: 0, value: 4 },
      { id: 'tt3sp-silverthorn', name: '镭射', cost: 1, rarity: '古朴', type: '法术', desc: '造成5点法术伤害；注能(1)：伤害+3。', dmg: 5, dmgType: 'spell', infuse: 1, value: 2 },
      { id: 'tt3sp-magicoil', name: '药水魔法', cost: 1, rarity: '稀有', type: '法术', desc: '发现1瓶药水并直接释放', dmg: 0, value: 3 },
      { id: 'tt3sp-shadowbug', name: '影噬', cost: 1, rarity: '稀有', type: '武术', desc: '本回合偷取 1 名敌人的攻击力至1点。', dmg: 0, value: 3 },
      { id: 'tt3sp-flowerzhen', name: '花鸩', cost: 1, rarity: '史诗', type: '法术', desc: '使 1 名角色中毒层数翻倍并立即触发1次毒伤。', dmg: 0, value: 4 },
      { id: 'tt3sp-bloodstorm', name: '血蝠风暴', cost: 2, rarity: '史诗', type: '法术', desc: '3′，目标为全体敌人，回复等量生命；注能(2)：触发 2 次。', dmg: 3, dmgType: 'spell', infuse: 2, value: 3 },
      { id: 'tt3sp-shadowshot', cls: '降临者', name: '暗影射击', cost: 1, rarity: '职业', type: '法术', desc: '3′，若对手处于诅咒状态，额外施放 1 次。', dmg: 3, dmgType: 'spell', unrandom: true },
      { id: 'tt3-thunderblast', name: '雷殛', cost: 2, rarity: '传说', type: '法术', desc: '造成7点法术伤害；墓地中每有1 张法术牌，伤害+1。', dmg: 7, dmgType: 'spell', value: 5 },
      { id: 'tt3-flux-slash', name: '流光斩', cost: 1, rarity: '传说', type: '武术', desc: '攻（-1），附加 2 层流血；将流光照影洗入牌库。', dmg: -1, dmgType: 'attack', value: 5 },
      { id: "tt3-immortal-blade", name: "骷髅王剑", cost: 0, rarity: "传说", type: "装备", dmg: 0, desc: "对战开始时，你的所有「初始攻击」化为 1 张不朽斩。", value: 5 },
      { id: 'tt3-diamond', name: '钻石', cost: 0, rarity: '传说', type: '资源', desc: '贵重货币，可出售。', value: 16, unrandom: true },
      { id: 'tt3-master-staff', name: '大法师之杖', cost: 0, rarity: '传说', type: '装备', desc: '回合开始时法伤 +1。', dmg: 0, value: 5 },
      { id: 'tt3-chaos-eye', name: '混沌之眼', cost: 0, rarity: '传说', type: '装备', desc: '对战开始时：血量上限 +10，牌库上限+5。', dmg: 0, value: 5 },
      { id: 'tt3-execute', name: '斩杀', cost: 1, rarity: '传说', type: '武术', desc: '对 9 血以下角色造成9点真实伤害。', dmg: 9, dmgType: 'true', value: 5 },
      { id: "tt3-savior-elixir", name: "斗神酒", cost: 0, rarity: "传说", type: "道具", dmg: 0, heal: 99, desc: "回复 99 点生命。", value: 5, sellable: false },
      { id: 'tt3-silver-runesword', name: '诅咒之剑', cost: 0, rarity: '史诗', type: '装备', desc: '获得 2 点攻击力；回合开始时，受到2点伤害', dmg: 0, value: 3 },
      { id: 'tt3-azure-sword', name: '百炼青虹剑', cost: 0, rarity: '稀有', type: '装备', desc: '消耗该牌时立即释放一次’初始攻击‘。', dmg: 0, value: 3 },
      { id: 'tt3-deep-seal', name: '深海印记', cost: 0, rarity: '稀有', type: '装备', desc: '诅咒状态下，攻 +2，法伤 +2。', dmg: 0, dmgType: 'attack' },
      { id: 'tt3-fate-wheel', name: '命运钟表', cost: 0, rarity: '史诗', type: '装备', desc: '主动技能：消耗所有手牌，获得 1 个额外回合。', dmg: 0, value: 4 },
      { id: 'tt3-crimson-pouch', name: '深红丝袋', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：选择并复制你的 1 张手牌。', dmg: 0, value: 3 },
      { id: 'tt3-holy-staff', name: '圣杖', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：净化并回复5血', dmg: 0, heal: 5, value: 3 },
      { id: 'tt3-staff', name: '法杖', cost: 0, rarity: '古朴', type: '装备', desc: '法伤 +1。', dmg: 0, value: 2 },
      { id: 'tt3-wolf-bow', name: '天狼长弓', cost: 0, rarity: '稀有', type: '装备', desc: '回合开始时，获得1张随机的‘箭矢’并将其变为0费。', dmg: 0, value: 3 },
      { id: 'tt3-sapper-bomb', name: '矿工炸药', cost: 0, rarity: '古朴', type: '装备', desc: '消耗该牌时，造成 4 点固定伤害。', dmg: 0, value: 2 },
      { id: 'tt3-twinwater-mail', name: '冰甲', cost: 0, rarity: '古朴', type: '装备', desc: '冰冻 1 名敌人后，+3甲。', dmg: 0, armor: 3 },
      { id: 'tt3-grass-armor', name: '草甲', cost: 0, rarity: '古朴', type: '装备', desc: '装备：装备时获得5点护甲。', dmg: 0, armor: 5, value: 2 },
      { id: 'tt3-blooddrinker', name: '饮血剑', cost: 0, rarity: '史诗', type: '装备', desc: '本局对战内，每消灭 1 个敌人，+1 点攻击力。', dmg: 0, value: 4 },
      { id: 'tt3-longsword', name: '长剑', cost: 0, rarity: '古朴', type: '装备', desc: '+1 攻。', dmg: 0, value: 2 },
      { id: 'tt3-element-seal', name: '元素符印', cost: 0, rarity: '稀有', type: '装备', desc: '本局对战中累计注能3张卡牌后解锁：法伤 +2，抽2张牌。', dmg: 0, draw: 2, value: 3 },
      { id: 'tt3-light-mail', name: '急速跑鞋', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：抽3张牌', dmg: 0, draw: 3 },
      { id: 'tt3-reverse-bow', name: '连弩', cost: 0, rarity: '古朴', type: '装备', desc: '主动技能：直接释放手牌中的所有‘箭’，每释放1张，抽1张牌。', dmg: 0, draw: 1, value: 2 },
      { id: 'tt3-deep-diary', name: '深海咒印', cost: 0, rarity: '史诗', type: '装备', desc: '自身处于诅咒状态时，获得 2 点攻击力且法伤 +2。', dmg: 0, value: 4 },
      { id: 'tt3eq-boiler', name: '魔法锅炉', cost: 0, rarity: '古朴', type: '装备', desc: '主动技能：注能(2)：随机获取 3 张卡牌。', dmg: 0, infuse: 2, value: 2 },
      { id: "tt3eq-mistbox", name: "迷之匣", cost: 0, rarity: "史诗", type: "装备", dmg: 0, desc: "主动技能：发现两张随机招式，交换其费用。", value: 2, sellable: false },
      { id: 'tt3-wood-bundle', name: '一捆木材', cost: 0, rarity: '史诗', type: '资源', desc: '木材 ×3。', dmg: 0, value: 6 },
      { id: 'tt3-ration-double', name: '双份口粮', cost: 0, rarity: '史诗', type: '资源', desc: '口粮 ×2。', dmg: 0, value: 6 },
      { id: 'tt4-shine-token', name: '员工通行证C', cost: 0, rarity: '史诗', type: '道具', desc: '发现 1 张传说卡。', dmg: 0, value: 4 },
      { id: 'tt4-smoke-bomb', name: '烟雾弹', cost: 0, rarity: '稀有', type: '道具', desc: '非 BOSS 战逃跑一次。', dmg: 0, value: 3 },
      { id: 'tt4-woodify', name: '能量饮料', cost: 0, rarity: '古朴', type: '道具', desc: '回复 6 点生命。', dmg: 0, heal: 6, value: 2 },
      { id: "tt5-galaxy-voyage", name: "银河之旅", cost: 2, rarity: "传说", type: "法术", dmg: 0, desc: "本场对战中，你的所有武术均为 1 费。", value: 5 },
      { id: 'tt6-demondeal', name: '恶魔交易', cost: 0, rarity: '衍生', type: '事件', desc: '-5血，获得1个大宝箱。', dmg: 0, unrandom: true },
      { id: 'tt6-bandits', battle: true, name: '盗匪横行', cost: 0, rarity: '衍生', type: '事件', desc: '反抗组织拾荒者 ×3~5（随层数增加）。奖励：密封物资箱 ×2。', dmg: 0, unrandom: true },
      { id: 'tt6-mystery', name: '神秘补给', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片，+2 币。', dmg: 0, unrandom: true },
      { id: 'tt6-goldmine', name: '金矿', cost: 0, rarity: '衍生', type: '事件', desc: '获得 3 币。', dmg: 0, unrandom: true },
      { id: 'tt6-airdrop', name: '空中补给', cost: 0, rarity: '衍生', type: '事件', desc: '从木材、口粮、能量饮料、随机药水中抽取一项。', dmg: 0, unrandom: true },
      { id: 'tt6-chestdraw', name: '宝箱', cost: 0, rarity: '衍生', type: '事件', desc: '从大，中，小宝箱中抽取 1 个。', dmg: 0, unrandom: true },
      { id: 'tt6-systemsupply', name: '系统补给', cost: 0, rarity: '衍生', type: '事件', desc: '获得员工通行证A碎片，木材 ×1。', dmg: 0, unrandom: true },
      { id: 'tt7-throwblade', cls: '侠客', name: '飞刃偷袭', cost: 0, rarity: '职业', type: '武术', desc: '攻（-3），附加流血，抽 1 张牌。', dmg: -3, dmgType: 'attack', draw: 1, value: 3, unrandom: true },
      { id: 'tt7-stealth', cls: '侠客', name: '潜匿', cost: 1, rarity: '职业', type: '武术', desc: '进入潜行状态 1 回合，抽1张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
      { id: 'tt7-ghostblade', cls: '侠客', name: '鬼魅之刃', cost: 1, rarity: '职业', type: '武术', desc: '攻（+1），破除隐身时伤害 +2，并抽 2 张牌。', dmg: 1, dmgType: 'attack', draw: 2, value: 3, unrandom: true },
      { id: 'tt7-goldencicada', cls: '侠客', name: '金蝉脱壳', cost: 0, rarity: '职业', type: '武术', desc: '消耗所有手牌，抽 3 张。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-thundergrudge', cls: '侠客', name: '快意恩仇', cost: 1, rarity: '职业', type: '武术', desc: '消耗 2 张初始攻击，攻击 3 次。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-sneak', cls: '侠客', name: '偷袭', cost: 0, rarity: '职业', type: '武术', desc: '攻（-1）。', dmg: -1, dmgType: 'attack', value: 3, unrandom: true },
      { id: 'tt7-swordimmortal', cls: '侠客', name: '剑仙形态', cost: 2, rarity: '职业', type: '武术', desc: '本局对战中，回合开始时额外抽 1 张牌。', dmg: 0, draw: 1, value: 4, unrandom: true },
      { id: 'tt7-ironphalanx', cls: '战士', name: '铁甲阵', cost: 2, rarity: '职业', type: '武术', desc: '+10 甲，将 5 张随机卡牌洗入牌库，并使其费用均-1。', dmg: 0, armor: 10, value: 3, unrandom: true },
      { id: 'tt7-bloodpotion', cls: '牧师', name: '噬血术', cost: 1, rarity: '职业', type: '法术', desc: '3′，回复等量生命。', dmg: 3, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-bloodpoison', cls: '战士', name: '血毒双镖', cost: 2, rarity: '职业', type: '武术', desc: '选择两个目标（可以重复）：攻（+1），附加流血；攻（+1），附加中毒。', dmg: 1, dmgType: 'attack', value: 3, unrandom: true },
      { id: 'tt7-provoke', cls: '牧师', name: '扰敌', cost: 1, rarity: '职业', type: '法术', desc: '选择2 名敌人，迫使其相互攻击一次。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-stratagem', cls: '法师', name: '法师锦囊', cost: 1, rarity: '职业', type: '法术', desc: '自带1*3空间，可以置入3张法术牌；打出时选择其中 1 张直接施放。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-bladebloom', cls: '法师', name: '永恒绽放', cost: 2, rarity: '职业', type: '法术', desc: '发现并直接施放 1 张牌，获取剩下两张。', dmg: 0, value: 3, unrandom: true },
      { id: "tt7-elementstorm", cls: "法师", name: "元素风暴", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "下一张法术施放 2 次。", value: 3, unrandom: true },
      { id: 'tt7-holyglow', cls: '牧师', name: '沐愈光辉', cost: 1, rarity: '职业', type: '法术', desc: '将自身血量回复至 12 血。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-holyheal', cls: '牧师', name: '圣光治愈', cost: 1, rarity: '职业', type: '法术', desc: '注能（1）：回复 2 倍于被注能卡牌价格的血量。', dmg: 0, infuse: 1, value: 3, unrandom: true },
      { id: 'tt7-energize', cls: '法师', name: '聚能', cost: 0, rarity: '职业', type: '法术', desc: '获得1点能量 。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-abysscurse', cls: '降临者', name: '深渊诅咒', cost: 2, rarity: '职业', type: '法术', desc: '7′，附加禁疗；此时对方身上每有 1 种诅咒，抽 1 张牌。', dmg: 7, dmgType: 'spell', draw: 1, value: 3, unrandom: true },
      { id: 'tt7-smite', cls: '牧师', name: '惩击', cost: 2, rarity: '职业', type: '法术', desc: '10′，对血量一半及以下的敌人伤害增加50%。', dmg: 10, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-silence', cls: '牧师', name: '禁言术', cost: 0, rarity: '职业', type: '法术', desc: '沉默 1 名角色 1 回合，抽 1 张牌。', dmg: 0, draw: 1, value: 3, unrandom: true },
      { id: 'tt7-burnharvest', cls: '降临者', name: '爆燃火球', cost: 1, rarity: '职业', type: '法术', desc: '5′，受法伤加成翻倍；', dmg: 5, dmgType: 'spell', value: 3, unrandom: true },
      { id: 'tt7-twinfireball', cls: '降临者', name: '三重火球', cost: 1, rarity: '职业', type: '法术', desc: '4′，将2张‘火球’置入手牌。', dmg: 4, dmgType: 'spell', value: 3, unrandom: true },
      { id: "tt7-meteorstrong", cls: "降临者", name: "星陨之力", cost: 2, rarity: "职业", type: "法术", dmg: 0, infuse: 2, desc: "注能(2)：施放 3 次火球。", value: 3, unrandom: true },
      { id: 'tt7-recruit', cls: '法师', name: '征召', cost: 2, rarity: '职业', type: '法术', desc: '召唤步兵（4-4） ×2为你抵挡伤害并自动战斗。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-frozenight', cls: '法师', name: '冰封千里', cost: 1, rarity: '职业', type: '法术', desc: '冰冻所有敌人，持续 1 回合。', dmg: 0, value: 3, unrandom: true },
      { id: 'tt7-fullstrike', cls: '战士', name: '全力一击', cost: 2, rarity: '职业', type: '武术', desc: '攻（+5），抽 1 张牌。', dmg: 5, dmgType: 'attack', draw: 1, value: 2, unrandom: true },
      { id: 'tt7-bulwark', cls: '战士', name: '坚盾', cost: 1, rarity: '职业', type: '武术', desc: '本回合获得 8点护甲，下回合开始时 -4 点。', dmg: 0, armor: 8, value: 3, unrandom: true },
      { id: 'tt7-meteorrain', cls: '侠客', name: '流星箭雨', cost: 1, rarity: '职业', type: '武术', desc: '攻（-1）；触发 2 次。', dmg: -1, dmgType: 'attack', value: 3, unrandom: true },
      { id: 'tt7-armup', cls: '战士', name: '武装', cost: 1, rarity: '职业', type: '武术', desc: '从牌库中抽取 2 张装备牌。', dmg: 0, value: 3, unrandom: true },
      { id: "tt7-demonbreaker", cls: "战士", name: "破甲重斩", cost: 2, rarity: "职业", type: "武术", dmg: 5, dmgType: "attack", armor: 4, desc: "攻5，附加破甲，持续 2 回合；击杀敌人时 +4 甲。", value: 3, unrandom: true },
      { id: 'tt7-whirlwind', cls: '战士', name: '旋风斩', cost: 2, rarity: '职业', type: '武术', desc: '攻（+1），目标为敌方全体。', dmg: 1, dmgType: 'attack', value: 3, unrandom: true },   // 2026-09-17 留言「旋风斩应为2费」
      { id: 'tt7-marchrush', cls: '战士', name: '急行军', cost: 1, rarity: '职业', type: '武术', desc: '抽 2张牌，+2甲；若本牌为最后一张手牌，效果触发2次。', dmg: 0, draw: 2, armor: 2, value: 3, unrandom: true },
      { id: 'tt8-hero-assassin', cls: '侠客', hero: true, name: '白梅落影·妄', cost: 2, rarity: '稀有', type: '能力卡', desc: '遁入虚空：净化自身，潜行 2 回合；破隐一击伤害翻倍。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-sword', cls: '侠客', hero: true, name: '无量仙剑·云风', cost: 2, rarity: '稀有', type: '能力卡', desc: '万剑归宗：抽 5 张牌，直接释放其中武术。', dmg: 0, draw: 5, value: 8, unrandom: true },
      { id: "tt8-hero-warlock", cls: "牧师", hero: true, name: "禁术解放", cost: 0, rarity: "稀有", type: "能力卡", desc: "无定横行：将四张禁咒洗入牌库，然后抽 2 张牌。", value: 5, unrandom: true },
      { id: 'tt8-hero-mage', cls: '法师', hero: true, name: '博览者的狂语', cost: 2, rarity: '稀有', type: '能力卡', desc: '万法乾坤：法伤 +1，回合开始时发现 1 张卡牌。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-priest', cls: '牧师', hero: true, name: '浪掷风吟', cost: 2, rarity: '棱彩', type: '能力卡', desc: '甘霖降世：置入随机卡牌直至手牌达到 6 张；其中每置入1 张法术，回复 3 血。', dmg: 0, heal: 3, value: 8, unrandom: true },
      { id: "tt8-hero-sealer", cls: "降临者", hero: true, name: "受缚之残影", cost: 2, rarity: "棱彩", type: "能力卡", desc: "深海封印：对战开始时，将本牌与四张「封印肢体」洗入牌库；手牌中集齐这 5 张封印之牌后破除封印，化为深渊主宰·妲莉薇特。无法打出。", value: 8, sellable: false, unrandom: true },
      { id: 'tt8-hero-descender', cls: '降临者', hero: true, name: '充能火山', cost: 2, rarity: '古朴', type: '能力卡', desc: '寂灭苍穹：法伤 +1，本局对战中，每消耗 1 张卡牌，施放 1 次‘火球’。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-summoner', cls: '法师', hero: true, name: '花开两面', cost: 2, rarity: '棱彩', type: '能力卡', desc: '元素潮汐：抉择：打开‘末日浩劫之门’或者‘天国之门’。两回合后，开启未选择的那扇‘门’', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-guardian', cls: '战士', hero: true, name: '圣剑化身', cost: 2, rarity: '古朴', type: '能力卡', desc: '诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-ranger', cls: '侠客', hero: true, name: '天剑诛魔·云阳', cost: 2, rarity: '古朴', type: '能力卡', desc: '断念：将天启剑与诛魔剑洗入牌库。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-hero-warrior', cls: '战士', hero: true, name: '青龙化身', cost: 2, rarity: '稀有', type: '能力卡', desc: '真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。', dmg: 0, value: 8, unrandom: true },
      { id: "tt8-curse1", cls: "牧师", tokenOf: "tt8-hero-warlock", name: "禁咒I", cost: 0, rarity: "衍生", type: "法术", desc: "抽到时施放：夺取 1 点攻击力。", value: 5, unrandom: true },
      { id: "tt8-curse2", cls: "牧师", tokenOf: "tt8-hero-warlock", name: "禁咒II", cost: 0, rarity: "衍生", type: "法术", desc: "抽到时施放：冰冻。", value: 5, unrandom: true },
      { id: "tt8-curse3", cls: "牧师", tokenOf: "tt8-hero-warlock", name: "禁咒III", cost: 0, rarity: "衍生", type: "法术", desc: "抽到时施放：中毒，流血。", value: 5, unrandom: true },
      { id: "tt8-curse4", cls: "牧师", tokenOf: "tt8-hero-warlock", name: "禁咒IV", cost: 0, rarity: "衍生", type: "法术", desc: "抽到时施放：沉默 1 回合。", value: 5, unrandom: true },
      { id: 'tt8-demonslay', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '诛魔剑', cost: 0, rarity: '衍生', type: '装备', desc: '抽到该牌时攻击全体敌人；···以天启诛魔剑覆盖你的所有武器。', dmg: 0, value: 4, unrandom: true },
      { id: 'tt8-archdemon', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '天启诛魔剑', cost: 0, rarity: '衍生', type: '装备', desc: '获得 1 点攻击力，获得3张重斩。', dmg: 0, value: 8, unrandom: true },
      { id: 'tt8-heavensword', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '天启剑', cost: 0, rarity: '衍生', type: '装备', desc: '抽到该牌时额外抽 1 张牌；在你抽到天启剑与诛魔剑后……', dmg: 0, draw: 1, value: 4, unrandom: true },
      { id: 'tt8-dragonblade', cls: '战士', hero: true, tokenOf: 'tt8-hero-warrior', name: '青龙偃月斩', cost: 2, rarity: '衍生', type: '武术', desc: '攻+6，附加破甲与 1 层流血。', dmg: 6, dmgType: 'attack', value: 8, unrandom: true },
      { id: 'cmtn0pbkmnvc', name: '流光照影', cost: 2, rarity: '衍生', type: '武术', desc: '对方身上每有一层诅咒，释放一次‘初始攻击’', value: 5, unrandom: true }, // 第十批补种（设计者实机卡）
      { id: 'cmtn1epgt20j', name: '灵能召唤', cost: 1, rarity: '稀有', type: '法术', desc: '发现一张注能卡，使其无需注能', value: 3 }, // 第十批补种（设计者实机卡）
      { id: 'cmtn233trmeg', name: '不朽斩', cost: 1, rarity: '衍生', type: '武术', desc: '攻（+1），永远被保留在手牌中，无法用于注能', dmg: 1, dmgType: 'attack', value: 5, unrandom: true }, // 第十批补种（设计者实机卡）
      { id: 'cmtn2jc142dj', name: '刀剑形态', cost: 1, rarity: '稀有', type: '武术', desc: '回合开始时，获得一张随机手牌的复制', value: 3 }, // 第十批补种（设计者实机卡）
      { id: "cmtn6ulm4boj", name: "步兵", cost: 0, rarity: "衍生", type: "生物", desc: "攻击力4生命4，优先为主人承受伤害，自动攻击敌人", value: 0, sellable: false, unrandom: true }, // 第十批补种（设计者实机卡）；cost 补 0 防库界面显示 undefined
      { id: "cmtn79743r2n", name: "末日浩劫之门", cost: 0, rarity: "棱彩", type: "生物", dmg: 0, desc: "回合开始时对所有敌方角色各施加一层随机诅咒，优先不重复。", value: 0, sellable: false, unrandom: true }, // 第十批补种（设计者实机卡）
      { id: "cmtn7err0a7", name: "天国之门", cost: 0, rarity: "棱彩", type: "生物", dmg: 0, armor: 5, desc: "回合开始时随机获取一项祝福，对全体友方施放，优先不重复。（获得潜行，持续 1 回合。获得 1 点攻击力。法伤 +1。减伤 1。获得 5 点护甲。净化。从这些中随机）", value: 0, sellable: false }, // 第十批补种（设计者实机卡）
      { id: 'cmtna0nb1yxt', name: '法力光波', cost: 1, rarity: '古朴', type: '法术', desc: '5点法术伤害', dmg: 5, dmgType: 'spell', value: 2 }, // 第十批补种（设计者实机卡）
    ],
    // 桌游手绘卡 · 第十一批（2026-09-09 与设计者实机卡库导出完全对齐，老板拍板）：
    // 以微信接收的设计者导出（搜打撤·代号7_卡牌库_233张.json，裸数组旧格式）为准：
    //   · 补入设计者实机有而仓库缺失的 26 张（tt7 旧职业卡 9 / 封印肢体 4 /
    //     制作坊自建 cmtn* 13）；不变应万变新旧两版并存，与设计者实机一致；厉兵秣马双版已终（cc-prep 于 2026-09-19 退役，只留 tt7-ironcharge）
    //     （旧版 tt7-* 无 cls，不进职业池；例外：法力补给 tt7-maxsupply 仓库侧补
    //     cls=法师——白塔专属，卡面「人物专属」写不清归属）；
    //   · 恶魔之力 tt7-drunksong 整卡退役（2026-09-13 老板拍板删除：同名双版收口只留
    //     cc-demon；入 RETIRE_TT11 + key 升 v5 重播清老档）；
    //   · 25 张共享 id 卡整卡取设计者稿（寻宝图/员工通行证A/经济卡包/初始火球/
    //     tt6-goldhammer/风暴火球/致命射线/花瓣 回退设计者版），其中：
    //     能力卡 type 保持定版「能力卡」、敌人图鉴保仓库 art 贴图键、
    //     desc「英雄卡」字样改「能力卡」（2026-09-08 术语定版）；
    // 覆盖/补种/退役走 ensureTabletopSync11()（TT11_KEY 标记，一次性）。
    // 2026-09-20 防退回口径（教训实测）：本表快照冻结自 09-09，sync 定版持续演进——TT11 升
    // KEY 重播（如 09-20 v6）会把旧定义整卡写回，曾把受缚之残影退回邪渊主宰、把满电动力锤
    // 压死为矮人的帮助。故本表与 cards-sync（及 TABLETOP6 09-19 定名）同 id 条目已按定版
    // 对齐，由 tests/cards-sync-snapshot-guard.test.js 守卫：改定版必须同步本表（TT10 同规）。
    // 桌游手绘卡 · 第十一批（2026-09-09 与设计者实机卡库导出完全对齐，老板拍板）：
    // 以微信接收的设计者导出（搜打撤·代号7_卡牌库_233张.json，裸数组旧格式）为准：
    //   · 补入设计者实机有而仓库缺失的 26 张（tt7 旧职业卡 9 / 封印肢体 4 /
    //     制作坊自建 cmtn* 13）；不变应万变新旧两版并存，与设计者实机一致；厉兵秣马双版已终（cc-prep 于 2026-09-19 退役，只留 tt7-ironcharge）
    //     （旧版 tt7-* 无 cls，不进职业池；例外：法力补给 tt7-maxsupply 仓库侧补
    //     cls=法师——白塔专属，卡面「人物专属」写不清归属）；
    //   · 恶魔之力 tt7-drunksong 整卡退役（2026-09-13 老板拍板删除：同名双版收口只留
    //     cc-demon；入 RETIRE_TT11 + key 升 v5 重播清老档）；
    //   · 25 张共享 id 卡整卡取设计者稿（寻宝图/员工通行证A/经济卡包/初始火球/
    //     tt6-goldhammer/风暴火球/致命射线/花瓣 回退设计者版），其中：
    //     能力卡 type 保持定版「能力卡」、敌人图鉴保仓库 art 贴图键、
    //     desc「英雄卡」字样改「能力卡」（2026-09-08 术语定版）；
    // 覆盖/补种/退役走 ensureTabletopSync11()（TT11_KEY 标记，一次性）。
    // 2026-09-20 防退回口径（教训实测）：本表快照冻结自 09-09，sync 定版持续演进——TT11 升
    // KEY 重播（如 09-20 v6）会把旧定义整卡写回，曾把受缚之残影退回邪渊主宰、把满电动力锤
    // 压死为矮人的帮助。故本表与 cards-sync（及 TABLETOP6 09-19 定名）同 id 条目已按定版
    // 对齐，由 tests/cards-sync-snapshot-guard.test.js 守卫：改定版必须同步本表（TT10 同规）。
    TABLETOP11: [
      { id: "tt7-livingwater", cls: "牧师", name: "圣光之源", cost: 2, rarity: "职业", type: "法术", dmg: 0, draw: 5, desc: "抽 5 张牌。", value: 3, sellable: false }, // cls 为定版归属（老板 2026-09-20 拍板星月专属）
      { id: "tt7-naturestaff", name: "自然法杖", cost: 0, rarity: "稀有", type: "装备", dmg: 0, desc: "主动技能：选择 1 张卡牌，下回合将其变为 0 费。", value: 3, sellable: false }, // 稀有度改稀有 + 限定技能改主动技能（2026-09-16 留言）
      { id: "tt7-darkfort", cls: "降临者", name: "黑暗吊坠", cost: 0, rarity: "职业", type: "装备", dmg: 0, desc: "免疫 1 次致命伤害，并在该回合内处于无敌状态。", value: 3, sellable: false }, // cls 为定版归属（老板 2026-09-09 拍板常无欲专属）
      { id: "tt7-arcanescroll", cls: "法师", name: "奥术残卷", cost: 0, rarity: "职业", type: "装备", dmg: 0, draw: 3, desc: "消耗该牌时抽 3 张牌。", value: 3, sellable: false }, // cls 为定版归属（老板 2026-09-09 拍板白塔专属）
      { id: "tt7-talisman", name: "灵符", cost: 0, rarity: "稀有", type: "装备", dmg: 0, draw: 2, desc: "对战开始时，额外抽 2 张牌。", value: 3, sellable: false }, // 稀有度改稀有（2026-09-16 留言）
      { id: "tt7-ironcharge", cls: "战士", name: "厉兵秣马", cost: 2, rarity: "职业", type: "武术", dmg: 0, armor: 12, draw: 2, desc: "+12 甲，抽 2 张牌。", value: 3, sellable: false, unrandom: true },
      { id: "tt7-maxsupply", cls: "法师", name: "法力补给", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "抽牌，直到有 4 张手牌。", value: 3, sellable: false }, // cls 为仓库侧定版（老板 2026-09-09 拍板白塔专属），设计者实机稿无 cls
      { id: "tt7-imitate", cls: "侠客", name: "不变应万变-改", cost: 1, rarity: "职业", type: "武术", dmg: 0, desc: "在手牌中时，本牌变为打出的上一张武术牌的1费复制。", value: 3, sellable: false }, // 同名不同效果版本按老板 2026-09-19 规则追加「-改」
      { id: "tt8-healplus", tokenOf: "tt8-hero-sealer", name: "封印肢体4", cost: 0, rarity: "棱彩", type: "生物", desc: "受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-energycap", tokenOf: "tt8-hero-sealer", name: "封印肢体2", cost: 0, rarity: "棱彩", type: "生物", desc: "受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-nofocus", tokenOf: "tt8-hero-sealer", name: "封印肢体3", cost: 0, rarity: "棱彩", type: "生物", desc: "受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-curseimmune", tokenOf: "tt8-hero-sealer", name: "封印肢体1", cost: 0, rarity: "棱彩", type: "生物", desc: "受缚之残影的封印肢体。入手时无效果，无法打出；集齐 5 张封印之牌后破除封印。", value: 8, sellable: false, unrandom: true },
      { id: "cmtmvq6ss84l", name: "员工通行证A", cost: 0, rarity: "衍生", type: "道具", dmg: 0, desc: "获取本职业的能力卡", value: 8, sellable: false },
      { id: "cmtn0xt0zr7", name: "闪金之锤", cost: 1, rarity: "衍生", type: "武术", dmg: 5, dmgType: "fixed", desc: "造成5点固定伤害，若击杀敌人，+2币。", value: 3, sellable: false },
      { id: "cmtn125e1nk0", name: "神秘召唤", cost: 2, rarity: "史诗", type: "法术", dmg: 0, desc: "发现一张传说或能力卡。", value: 4, sellable: false },
      { id: "cmtn1gfhczzj", cls: "降临者", name: "厄运", cost: 0, rarity: "职业", type: "法术", dmg: 0, desc: "随机获取1张能施加诅咒的招式", value: 2, sellable: false, unrandom: true },
      { id: "cmtn1i64j7y7", cls: "侠客", name: "盗宝", cost: 1, rarity: "职业", type: "武术", dmg: 0, desc: "发现一张装备卡", value: 3, sellable: false, unrandom: true },
      { id: "cmtn1lbhbqi4", cls: "降临者", name: "充能火球", cost: 1, rarity: "职业", type: "法术", dmg: 4, dmgType: "spell", desc: "4‘，回合开始时，本牌伤害+1", value: 3, sellable: false, unrandom: true },
      { id: "cmtn1ntxzoc4", cls: "降临者", name: "火焰形态", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "本局对战中，法伤+1", value: 2, sellable: false, unrandom: true },
      { id: "cmtn1p9vb5au", cls: "法师", name: "千变万化", cost: 2, rarity: "职业", type: "法术", dmg: 0, desc: "发现一种形态并释放", value: 3, sellable: false, unrandom: true },
      { id: "cmtn1r10xnl1", cls: "降临者", name: "黑暗形态", cost: 1, rarity: "职业", type: "法术", dmg: 0, desc: "本局对战中，每当你发现卡牌时，增加1个可选项", value: 2, sellable: false, unrandom: true },
      { id: "cmtn1wnhhym", cls: "侠客", name: "江湖救急-改", cost: 0, rarity: "职业", type: "武术", dmg: 0, desc: "随机获得3张临时卡牌，回合开始时将其消耗。", value: 3, sellable: false, unrandom: true },   // 同名不同效果版本按老板 2026-09-19 规则追加「-改」
      { id: "cmtn28jv33wx", name: "搜索大宝箱", cost: 0, rarity: "衍生", type: "法术", dmg: 0, desc: "随机获取3张卡牌", value: 3, sellable: false },
      { id: "cmtn6bge52qt", name: "复原药水", cost: 0, rarity: "稀有", type: "道具", dmg: 0, desc: "在背包中才能使用，复原最多两张卡牌", value: 3, sellable: false },
      { id: "cmtn7qttxqo4", name: "修鞋铺", cost: 0, rarity: "衍生", type: "事件", dmg: 0, desc: "获得员工通行证A碎片；复原1张卡牌", value: 0, sellable: false },
      // —— 以下 25 张共享 id 卡取设计者稿（整卡覆盖） ——
      { id: "starter-emergency-bandage", name: "应急绷带", cost: 0, rarity: "稀有", type: "道具", dmg: 0, heal: 12, desc: "回复12 点生命。", value: 0, sellable: false },
      { id: "tt-token-color", name: "员工通行证A", cost: 0, rarity: "史诗", type: "道具", dmg: 0, desc: "集齐两枚碎片，合成真正的员工通行证A：获取一张能力卡。", value: 4, sellable: false },
      { id: "tt-econpack", name: "经济卡包", cost: 0, rarity: "史诗", type: "资源", dmg: 0, desc: "只能在仓库界面点击使用，获得5张随机卡牌", value: 10, sellable: false, unrandom: true },
      { id: "tt2-treasuremap", name: "寻宝图", cost: 0, rarity: "古朴", type: "装备", dmg: 0, draw: 1, desc: "主动技能：将 1张‘搜索大宝箱’洗入牌库，抽1张牌。", value: 2, sellable: false },
      { id: "tt3-flame-storm", cls: "降临者", name: "风暴火球", cost: 2, rarity: "职业", type: "法术", dmg: 4, dmgType: "spell", desc: "对全体敌人每人释放1次火球。", value: 3, sellable: false, unrandom: true },
      { id: "tt3-fireball", name: "火球", cost: 1, rarity: "衍生", type: "法术", dmg: 4, dmgType: "spell", desc: "造成 4 点法术伤害。", value: 1, sellable: false, unrandom: true }, // 衍生牌（2026-09-16 留言「初始不给火球，把火球设定成衍生」）：不再每局携带；unrandom 双保险——不进发现/随机/商店池
      { id: "tt3-nuke-ray", cls: "降临者", name: "致命射线", cost: 2, rarity: "职业", type: "法术", dmg: 8, dmgType: "spell", desc: "造成8点法术伤害，对其附加3种随机诅咒", value: 3, sellable: false, unrandom: true },
      { id: "tt3-petal", cls: "牧师", name: "花瓣法阵", cost: 1, rarity: "职业", type: "法术", dmg: 0, draw: 1, heal: 2, desc: "回合开始时额外抽1张牌并回复 3 点生命，持续 3 回合。", value: 3, sellable: false, unrandom: true },
      { id: "tt6-goldhammer", name: "满电动力锤", cost: 0, rarity: "衍生", type: "事件", desc: "获得卡牌「闪金之锤」。", value: 0, sellable: false, unrandom: true },
      { id: "tt8-hero-assassin", cls: "侠客", hero: true, name: "白梅落影·妄", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, desc: "遁入虚空：净化自身，潜行 2 回合；破隐一击伤害翻倍。", value: 8, unrandom: true },
      { id: "tt8-hero-sword", cls: "侠客", hero: true, name: "无量仙剑·云风", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, draw: 5, desc: "万剑归宗：抽 5 张牌，直接释放其中武术。", value: 8, unrandom: true },
      { id: "tt8-hero-warlock", cls: "牧师", hero: true, name: "禁术解放", cost: 0, rarity: "稀有", type: "能力卡", desc: "无定横行：将四张禁咒洗入牌库，然后抽 2 张牌。", value: 5, unrandom: true },
      { id: "tt8-hero-mage", cls: "法师", hero: true, name: "博览者的狂语", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, desc: "万法乾坤：法伤 +1，回合开始时发现 1 张卡牌。", value: 8, unrandom: true },
      { id: "tt8-hero-priest", cls: "牧师", hero: true, name: "浪掷风吟", cost: 2, rarity: "棱彩", type: "能力卡", dmg: 0, heal: 3, desc: "甘霖降世：置入随机卡牌直至手牌达到 6 张；其中每置入1 张法术，回复 3 血。", value: 8, unrandom: true },
      { id: "tt8-hero-sealer", cls: "降临者", hero: true, name: "受缚之残影", cost: 2, rarity: "棱彩", type: "能力卡", desc: "深海封印：对战开始时，将本牌与四张「封印肢体」洗入牌库；手牌中集齐这 5 张封印之牌后破除封印，化为深渊主宰·妲莉薇特。无法打出。", value: 8, sellable: false, unrandom: true },
      { id: "tt8-hero-descender", cls: "降临者", hero: true, name: "充能火山", cost: 2, rarity: "古朴", type: "能力卡", dmg: 0, desc: "寂灭苍穹：法伤 +1，本局对战中，每消耗 1 张卡牌，施放 1 次‘火球’。", value: 8, unrandom: true },
      { id: "tt8-hero-summoner", cls: "法师", hero: true, name: "花开两面", cost: 2, rarity: "棱彩", type: "能力卡", dmg: 0, desc: "元素潮汐：抉择：打开‘末日浩劫之门’或者‘天国之门’。两回合后，开启未选择的那扇‘门’", value: 8, unrandom: true },
      { id: "tt8-hero-guardian", cls: "战士", hero: true, name: "圣剑化身", cost: 2, rarity: "古朴", type: "能力卡", dmg: 0, desc: "诛邪圣剑：本局对战中，能量上限 +1，装备上限 +1。", value: 8, unrandom: true },
      { id: "tt8-hero-ranger", cls: "侠客", hero: true, name: "天剑诛魔·云阳", cost: 2, rarity: "古朴", type: "能力卡", dmg: 0, desc: "断念：将天启剑与诛魔剑洗入牌库。", value: 8, unrandom: true },
      { id: "tt8-hero-warrior", cls: "战士", hero: true, name: "青龙化身", cost: 2, rarity: "稀有", type: "能力卡", dmg: 0, desc: "真龙降世：本局对战中，将‘初始攻击’化为‘青龙偃月斩’。", value: 8, unrandom: true },
      // 敌人图鉴 5 张（与 BESTIARY 同 id）：2026-09-09 老板定版新世界观命名，名字与描述随 BESTIARY 同步
      { id: "foe-orc_axe", name: "甲壳变异体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 4 / 生命 7。变异·第3层。防御/反击型，隔回合蓄势。", value: 0, sellable: false, art: "orc_axe" },
      { id: "foe-wolf_rider", name: "变异雪狼", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 7 / 生命 6。变异·第3层。蓄力攻击：隔回合强化一击。", value: 0, sellable: false, art: "wolf_rider" },
      { id: "foe-fire_el", name: "灼热异变体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 10 / 生命 7。变异·第4层。攻击并灼烧。", value: 0, sellable: false, art: "fire_el" },
      { id: "foe-water_el", name: "腐蚀异变体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 7 / 生命 10。变异·第4层。防御/反击型，隔回合蓄势。", value: 0, sellable: false, art: "water_el" },
      { id: "foe-grass_el", name: "滋生异变体", cost: 0, rarity: "衍生", type: "生物", dmg: 0, desc: "攻击 5 / 生命 12。变异·第5层。攻击并施加诅咒。", value: 0, sellable: false, art: "grass_el" },
    ],

};
