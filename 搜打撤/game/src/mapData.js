import { RULES } from './rules.js';
import { sdtDefine } from './sdt-facade.js';

/* ============================================================
 * 搜打撤 —— 地图静态数据表
 *
 * 地图几何（五层、每层结点、门与入口）由 map-generator.js 按种子生成；
 * 本文件只放不随种子变化的数据：世界坐标基准、物品/宝箱表、怪物与遭遇表、祭坛 BOSS。
 *
 * 生成器口径（2026-09-09 五层定版）：
 *   五层结点数 13/15/17/15/13，每层从 x=0 的入口进入、走到最右端出口；
 *   前四层出口是通往下一层的门（第 1 层的门兼免费撤离），第 5 层出口是终局撤离点；
 *   每层保证 ≥3 场战斗、1 个火堆、1 个补给站，且不出现连续三个战斗结点。
 *
 * 格子事件类型（生成器产出的 def.type）：
 *   entrance(入口) battle(战斗) event(随机) fire(火堆) chest(搜刮点)
 *   shop(补给站) emergencyExit(紧急撤离) door(层间门) extraction(终局撤离)
 * ============================================================ */

/* ESM 垫片：命名空间由 sdt-facade.js 唯一创建 */
sdtDefine('MAP', {
  version: '0.3',
  boardId: 'B1',
  boardName: '第七净化区 · 三环荒土',
  // 30×30 仅作为世界坐标基准（1440px 世界）；结点坐标由 game.session.js 的 buildDerived
  // 按生成器网格映射（MAP_NODE_SPACING），与格子坐标解耦。地图允许超出视口，靠镜头拖拽/缩放浏览，
  // 默认倍率下一屏最多看到地图约一半（见 game.boot.js 启动段）。
  cols: 30,
  rows: 30,
  tile: 48,

  // 对局模式会临时调整治疗等数值，因此地图持有基线规则的可变副本。
  rules: { ...RULES },

  // ---------- 物品 / 表格配置 ----------
  items: {
    wood:    { name: '木材',     value: 5,   tier: 'C' },
    rations: { name: '口粮',     value: 15,  tier: 'C' },
    key:     { name: '神秘钥匙', value: 100, tier: 'A' },
  },
  chestTable: [   // 小宝箱
    { name: '绷带',     value: 45, tier: 'C' },
    { name: '零散弹药', value: 35, tier: 'C' },
    { name: '瓶装水',   value: 25, tier: 'C' },
    { name: '旧地图',   value: 20, tier: 'C' },
  ],
  eventEnemies: [ // 事件卡战斗敌人（盗匪横行 / 闪金之锤 等 <事件战斗>）
    { id: 'bandit', name: '反抗组织拾荒者', hp: 3, atk: 3 },
  ],
  randomEvents: [ // 事件格
    { w: 3, coins: [1, 3], text: '在瓦砾堆里捡到几枚旧世界硬币' },
    { w: 2, item: 'chest', text: '翻到一批先行者遗留的物资' },
    { w: 2, nothing: true, text: '辐射风掠过荒原，什么也没发生' },
    { w: 1, coins: [4, 6], text: '找到一只未撬过的保险柜！' },
  ],

  // ---------- 怪物图鉴（2026-09-09 老板定版：新世界观 · 五层分布，数值 = 攻击力-生命） ----------
  // 世界观：联邦部队与反抗组织在废土上拉锯；能力者（双阵营）是稀有强敌；
  // 越深入污染越重，异变生物越强。art = art.js 立绘 id；layerIdx 越大敌人越强。
  monsters: {
    // 第 1 层 外围荒地：联邦巡防与反抗拾荒的零星交火
    infantry:   { id: 'infantry',   name: '联邦巡防兵',     atk: 4,  hp: 4,  behavior: 'strike' },
    archer:     { id: 'archer',     name: '联邦射手',       atk: 5,  hp: 3,  behavior: 'volley' },
    bandit:     { id: 'bandit',     name: '反抗组织拾荒者', atk: 3,  hp: 3,  behavior: 'strike' },
    // 第 2 层 风雪哨线：双方正规部队
    cavalry:    { id: 'cavalry',    name: '联邦机动兵',     atk: 5,  hp: 6,  behavior: 'charge' },
    orc_jav:    { id: 'orc_jav',    name: '反抗组织掷弹兵', atk: 6,  hp: 4,  behavior: 'volley' },
    // 第 3 层 冻土遗迹：异变初现
    wolf_rider: { id: 'wolf_rider', name: '变异雪狼',       atk: 7,  hp: 6,  behavior: 'charge' },
    orc_axe:    { id: 'orc_axe',    name: '甲壳变异体',     atk: 4,  hp: 7,  behavior: 'guard' },
    // 第 4 层 高危战区：元素异变体 + 双阵营能力者
    fire_el:    { id: 'fire_el',    name: '灼热异变体',     atk: 10, hp: 7,  behavior: 'burn' },
    water_el:   { id: 'water_el',   name: '腐蚀异变体',     atk: 7,  hp: 10, behavior: 'guard' },
    esper_crow:   { id: 'esper_crow',   name: '白鸦',       atk: 8,  hp: 5,  behavior: 'volley' },
    esper_candle: { id: 'esper_candle', name: '烛火',       atk: 9,  hp: 6,  behavior: 'burn' },
    // 第 5 层 污染核心：深层异变 + 双阵营能力者 + 巨兽
    grass_el:   { id: 'grass_el',   name: '滋生异变体',     atk: 5,  hp: 12, behavior: 'curse' },
    esper_silence: { id: 'esper_silence', name: '静默',     atk: 7,  hp: 9,  behavior: 'curse' },
    esper_echo:    { id: 'esper_echo',    name: '回声',     atk: 9,  hp: 7,  behavior: 'volley' },
    dragon:     { id: 'dragon',     name: '巨兽「荒渊」',   atk: 7,  hp: 40, elite: true, behavior: 'dragon' },
  },
  // 各层遭遇表（键 = layerIdx 0-3，对应四层；2026-09-10 玩法定版，敌人 = 攻-血）：
  //   每种敌人的数量区间一律落在 1~3 只之间（如 1-3 / 2-3 / 1-2），且区间内每个数量等概率生成；
  //   第 1 层 外围荒地：3-3 拾荒者成群 2-3 只；4-4 巡防兵 2-3 只；5-3 射手 2-3 只
  //   第 2 层 风雪哨线：4-4 巡防兵 2-3 只；5-3 射手 2-3 只；5-6 机动兵 2-3 只
  //   第 3 层 冻土遗迹：7-6 雪狼 1-3 只；4-7 甲壳 2-3 只；6-4 掷弹兵 2-3 只；7-40 巨兽仅 3% 概率刷出
  //   第 4 层 污染核心：7-10 腐蚀 / 10-7 灼热 / 5-12 滋生各 1-2 只；7-40 巨兽仅 10% 概率刷出
  // 巨兽（精英）奖励：2 个大宝箱 + 30% 概率额外 1 张传说卡（见 chests.rollDrops / 战后结算）
  // 敌人取自卡牌库同攻血生物（foe-* 图鉴）；不含「步兵」。
  // rollCount：区间 [min,max] 内等概率取整数（2026-09-10 定版——1-3 出 1/2/3 各 1/3，2-3 出 2/3 各 1/2）
  rollCount(size, rand) {
    const [min, max] = size;
    return min + Math.floor(rand() * (max - min + 1));
  },
  encounters: [
    { entries: [
        { id: 'bandit',   size: [2, 3] },
        { id: 'infantry', size: [2, 3] },
        { id: 'archer',   size: [2, 3] },
      ], risk: '低',
      strategy: '试探：联邦巡防与反抗拾荒的零星交火，单体攻击为主，适合熟悉手牌与攒资源；拾荒者成群出没（2-3 只）' },
    { entries: [
        { id: 'infantry', size: [2, 3] },
        { id: 'archer',   size: [2, 3] },
        { id: 'cavalry',  size: [2, 3] },
      ], risk: '中',
      strategy: '对峙：正规部队上哨线，机动兵蓄力冲锋、射手远程压制，优先打断蓄力' },
    { entries: [
        { id: 'wolf_rider', size: [1, 3] },
        { id: 'orc_axe',    size: [2, 3] },
        { id: 'orc_jav',    size: [2, 3] },
      ], risk: '高',
      strategy: '异变：冻土下的变异体混入巡逻队，雪狼高攻冲锋、甲壳厚血防守，注意攻防节奏',
      elite: { pool: ['dragon'], size: [1, 1], chance: 0.03, strategy: '精英预警：巨兽「荒渊」固定单体——奖励 2 个大宝箱，30% 概率额外掉 1 张传说卡' } },
    { entries: [
        { id: 'water_el', size: [1, 2] },
        { id: 'fire_el',  size: [1, 2] },
        { id: 'grass_el', size: [1, 2] },
      ], risk: '极高',
      strategy: '核心区：腐蚀与灼烧持续消耗、滋生体厚血缠斗，随时准备战术取舍；巨兽「荒渊」偶尔出没',
      elite: { pool: ['dragon'], size: [1, 1], chance: 0.10, strategy: '精英预警：巨兽「荒渊」固定单体——奖励 2 个大宝箱，30% 概率额外掉 1 张传说卡' } },
  ],
  enemyPool: [   // 兼容旧引用（事件战等）：统一指向新表
    { id: 'bandit', name: '反抗组织拾荒者', hp: 3, atk: 3 },
  ],

  // ---------- 战斗胜利宝箱掉落（设计者 2026-09-02 定版：战胜怪物 100% 掉宝箱） ----------
  // 四种宝箱规格：cards=直接获得的随机卡张数 / pickFrom=随机 N 张选 1 /
  // coins=[min,max] 内含随机币；boss 额外掉金币/银币/铜币卡其一，并有 30% 概率掉员工通行证B
  // 币掉落定版（2026-09-09）：小宝箱 1 币、中宝箱 1-2 币、大宝箱 2-3 币
  chestKinds: {
    small:  { name: '小型物资箱', icon: '[[icon:archive]]', cards: 1, coins: [1, 1] },
    medium: { name: '密封物资箱', icon: '[[icon:archive]]', pickFrom: 3, coins: [1, 2] },
    large:  { name: '军用保险柜', icon: '[[icon:tools]]', cards: 3, coins: [2, 3] },
    boss:   { name: '首脑保险柜', icon: '[[icon:medal]]', cards: 5, coins: null,
              coinCards: ['金币', '银币', '铜币'], tokenChance: 0.3 },
  },
  // 层掉落表（键 = layerIdx 0~3，对应四层，2026-09-09 玩法定版）：
  //   types = 宝箱种类权重（小/中/大）；count = 宝箱个数权重；fixed = 固定组合（第四层）
  //   第 1 层：70% 小宝箱（随机 1 张）/ 30% 中宝箱（3 选 1），1 个；
  //   第 2 层：40% 小 / 40% 中 / 20% 大，1 个；
  //   第 3 层：70% 中 / 30% 大；个数 70% ×1 / 30% ×2；
  //   第 4 层：胜利固定 1 大 + 1 中。
  layerChests: [
    { types: [ { k: 'small', w: 7 }, { k: 'medium', w: 3 } ], count: [ { n: 1, w: 1 } ] },
    { types: [ { k: 'small', w: 4 }, { k: 'medium', w: 4 }, { k: 'large', w: 2 } ], count: [ { n: 1, w: 1 } ] },
    { types: [ { k: 'medium', w: 7 }, { k: 'large', w: 3 } ], count: [ { n: 1, w: 7 }, { n: 2, w: 3 } ] },
    { fixed: [ { k: 'large', n: 1 }, { k: 'medium', n: 1 } ] },
  ],

  // ---------- 中央祭坛区 ----------
  centerColor: '#4a3763',   // 暗紫：祭坛区
  altar: {
    pos: [3, 3],
    bosses: [
      { id: 'boss_general', name: '肃清总督', hp: 50, atk: 5, cell: [4, 3], icon: '将',
        affix: 'grow',  affixName: '军威', behavior: 'general', affixDesc: '每个回合结束时攻击力 +2' },
      { id: 'boss_orc',     name: '变异巢母', hp: 45, atk: 4, cell: [4, 4], icon: '巢',
        affix: 'frenzy', affixName: '狂乱', behavior: 'orc_boss', affixDesc: '每回合攻击两次，每次附加 1 层流血或中毒' },
      { id: 'boss_elem',    name: '异能领主', hp: 48, atk: 8, cell: [3, 4], icon: '能',
        affix: 'aegis', affixName: '元素庇幕', behavior: 'element_boss', affixDesc: '偶数回合减免所有伤害（破甲可克制）' },
    ],
  },
});
