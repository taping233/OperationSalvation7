import { RULES } from './rules.js';

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
window.SDT = window.SDT || {};

/* ESM 垫片：本模块是首个模块，必须在自己创建命名空间之后才能捕获引用 */
const SDT = window.SDT;

SDT.MAP = {
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
  // 各层遭遇表（键 = layerIdx 0-4，对应五层）：battle 格随机抽一种遭遇（1-4 只）；elite 为稀有强敌遭遇
  // 2026-09-09 五层定版（设计者口径，敌人 = 攻-血）：
  //   第1层 外围荒地 2-4 只：联邦巡防兵4-4 / 联邦射手5-3 / 反抗组织拾荒者3-3（含拾荒者时 ≥3 只）
  //   第2层 风雪哨线 2-3 只：联邦巡防兵4-4 / 联邦机动兵5-6 / 反抗组织掷弹兵6-4
  //   第3层 冻土遗迹 2-3 只：联邦机动兵5-6 / 变异雪狼7-6 / 甲壳变异体4-7
  //   第4层 高危战区 1-3 只：灼热异变体10-7 / 腐蚀异变体7-10 / 白鸦8-5 / 烛火9-6
  //   第5层 污染核心 1-3 只：滋生异变体5-12 / 静默7-9 / 回声9-7；巨兽「荒渊」7-40 固定单体（25% 概率遭遇）
  encounters: [
    { pool: ['infantry', 'archer', 'bandit'], size: [2, 4], risk: '低',
      strategy: '试探：联邦巡防与反抗拾荒的零星交火，单体攻击为主，适合熟悉手牌与攒资源；遇拾荒者必成群（≥3）' },
    { pool: ['infantry', 'cavalry', 'orc_jav'], size: [2, 3], risk: '中',
      strategy: '对峙：正规部队上哨线，机动兵蓄力冲锋、掷弹兵远程压制，优先打断蓄力' },
    { pool: ['cavalry', 'wolf_rider', 'orc_axe'], size: [2, 3], risk: '中高',
      strategy: '异变：冻土下的变异体混入巡逻队，雪狼高攻冲锋、甲壳厚血防守，注意攻防节奏' },
    { pool: ['fire_el', 'water_el', 'esper_crow', 'esper_candle'], size: [1, 3], risk: '高',
      strategy: '能力者：元素异变体与双阵营能力者同场，灼烧与腐蚀持续消耗，白鸦的碎晶齐射优先处理' },
    { pool: ['grass_el', 'esper_silence', 'esper_echo'], size: [1, 3], risk: '极高',
      strategy: '核心区：滋生体厚血缠斗，静默封住技能、回声的声波叠伤，随时准备撤退',
      elite: { pool: ['dragon'], size: [1, 1], chance: 0.25, strategy: '精英预警：巨兽「荒渊」固定单体，撤退仍可保住已结算的战利品' } },
  ],
  enemyPool: [   // 兼容旧引用（事件战等）：统一指向新表
    { id: 'bandit', name: '反抗组织拾荒者', hp: 3, atk: 3 },
  ],

  // ---------- 战斗胜利宝箱掉落（设计者 2026-09-02 定版：战胜怪物 100% 掉宝箱） ----------
  // 四种宝箱规格：cards=直接获得的随机卡张数 / pickFrom=随机 N 张选 1 /
  // coins=[min,max] 内含随机币；boss 额外掉金币/银币/铜币卡其一，并有 30% 概率掉员工通行证B
  chestKinds: {
    small:  { name: '小型物资箱', icon: '[[icon:archive]]', cards: 1, coins: [1, 2] },
    medium: { name: '密封物资箱', icon: '[[icon:archive]]', pickFrom: 3, coins: [2, 3] },
    large:  { name: '军用保险柜', icon: '[[icon:tools]]', cards: 3, coins: [3, 4] },
    boss:   { name: '首脑保险柜', icon: '[[icon:medal]]', cards: 5, coins: null,
              coinCards: ['金币', '银币', '铜币'], tokenChance: 0.3 },
  },
  // 层掉落表（键 = layerIdx 0~4，对应五层）：击败该层敌人掉什么，多组组合时等概率随机一组。
  // n 写成 [min,max] 表示随机数量，写成数字表示固定数量。
  layerChests: [
    [[{ k: 'small', n: [1, 2] }]],                                                                    // 第 1 层：小型物资箱 1-2 个
    [[{ k: 'medium', n: 2 }], [{ k: 'large', n: 1 }]],                                                // 第 2 层：密封箱×2 或 军用保险柜×1
    [[{ k: 'large', n: 1 }, { k: 'small', n: 1 }],                                                    // 第 3 层：大+小 或 大+中
     [{ k: 'large', n: 1 }, { k: 'medium', n: 1 }]],
    [[{ k: 'large', n: 2 }],                                                                          // 第 4 层：大×2 或 大+中+小
     [{ k: 'large', n: 1 }, { k: 'medium', n: 1 }, { k: 'small', n: 1 }]],
    [[{ k: 'large', n: 2 }, { k: 'small', n: 1 }],                                                    // 第 5 层：大×2+小 或 大+中×2
     [{ k: 'large', n: 1 }, { k: 'medium', n: 2 }]],
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

};
