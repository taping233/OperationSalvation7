import { RULES } from './rules.js';

/* ============================================================
 * 搜打撤 v0.3 —— 三环棋盘数据（按设计者的格子备注重建）
 *
 * 结构（8×8 棋盘，三个同心环 + 中央祭坛区）：
 *   第一环 L1 · 外圈 28 格（四角为出生入口）
 *   第二环 L2 · 中圈 20 格
 *   第三环 L3 · 内圈 12 格
 *   中央 2×2：祭坛 + 三只 BOSS（将军/元素领主/兽人首领）
 *
 * 环间门（踩到弹出选择）：
 *   外圈 1/8/15/22 号格 ↔ 第二环（兼撤离出口）
 *   第二环 (3,6)/(1,3) ↔ 第三环（兼商店）
 *   第三环 (3,2)/(2,3) → 祭坛（一个给4币，一个是商店）
 *   紧急撤离点 (2,4)：花 10 币直接撤离
 *
 * 格子事件类型：
 *   coin(币) wood(木材) battle(战斗) event(随机) shop(商店)
 *   fire(火堆) chest(宝箱) rations(口粮) key(钥匙)
 *   emergencyExit(紧急撤离) door(环间门·自动生成) altar(祭坛) boss(BOSS)
 * ============================================================ */
window.SDT = window.SDT || {};

/* ESM 垫片：本模块是首个模块，必须在自己创建命名空间之后才能捕获引用 */
const SDT = window.SDT;

SDT.MAP = {
  version: '0.3',
  boardId: 'B1',
  boardName: '第七净化区 · 三环荒土',
  // 30×30 仅作为世界坐标基准（1440px 世界）；轨道拓扑仍由 makeRing 的 8×8 抽象环生成，
  // 结点坐标全部来自 buildNodePositions，与格子坐标解耦。地图允许超出视口，靠镜头拖拽/缩放浏览，
  // 默认倍率下一屏最多看到地图约一半（见 game.boot.js 启动段）。
  cols: 30,
  rows: 30,
  tile: 48,

  // 对局模式会临时调整治疗等数值，因此地图持有基线规则的可变副本。
  rules: { ...RULES },

  // ---------- 结点布局（分布式结点地图的唯一真源） ----------
  // 为每个 (li, idx) 逻辑格确定性生成结点中心坐标（世界像素）：
  // 每环按轨道顺序在极坐标上均匀取角 + 半径按环 + hash 抖动 + 同环间距防重叠微调；
  // 中央祭坛在正中心，三只 BOSS 环绕。布局确定（无随机数），同输入必得同输出。
  nodeLayout: {
    radii: [560, 390, 225],  // 三环基础半径（外 / 中 / 内）
    radiusJitter: 44,        // 半径抖动幅度（± 一半）
    angleJitter: 0.38,       // 角度抖动（占相邻角距的比例上限）
    bossRadius: 96,          // BOSS 结点环绕祭坛的半径
    minGap: 116,             // 同环相邻结点的最小间距（含结点半径余量）
  },

  buildNodePositions(logicalCounts) {
    const T = this.tile;
    const cx = this.cols * T / 2, cy = this.rows * T / 2;
    const lay = this.nodeLayout;
    const lo = 14, hiX = this.cols * T - 14, hiY = this.rows * T - 14;   // 板内安全边界
    const layers = logicalCounts.map((n, li) => {
      const R = lay.radii[li];
      const arr = [];
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (i / n) * Math.PI * 2 +
          (this._hash(li * 91 + i * 7, li * 13 + 5) - 0.5) * lay.angleJitter * (Math.PI * 2 / n);
        const r = R + (this._hash(li * 17 + i * 3 + 1, li * 29 + 2) - 0.5) * lay.radiusJitter;
        arr.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      // 防重叠微调：同环内任意两点距 < minGap 时沿连线推开，迭代收敛
      for (let pass = 0; pass < 24; pass++) {
        let moved = false;
        for (let a = 0; a < n; a++) {
          for (let b = a + 1; b < n; b++) {
            const dx = arr[b].x - arr[a].x, dy = arr[b].y - arr[a].y;
            const d = Math.hypot(dx, dy);
            if (d >= lay.minGap || d < 0.001) continue;
            const push = (lay.minGap - d) / 2, ux = dx / d, uy = dy / d;
            arr[a].x -= ux * push; arr[a].y -= uy * push;
            arr[b].x += ux * push; arr[b].y += uy * push;
            moved = true;
          }
        }
        if (!moved) break;
      }
      // 拉回板内
      for (const p of arr) {
        p.x = Math.min(hiX, Math.max(lo, p.x));
        p.y = Math.min(hiY, Math.max(lo, p.y));
      }
      return arr;
    });
    // 中央区：祭坛居中，三只 BOSS 环绕（与 MAP.center 顺序一一对应）
    const center = [{ x: cx, y: cy }];
    const br = lay.bossRadius;
    [[-Math.PI / 2, -0.35], [Math.PI / 6 - 0.35, 0.3], [Math.PI * 5 / 6 + 0.35, -0.3]].forEach(([a, dj]) => {
      center.push({ x: cx + Math.cos(a + dj) * br, y: cy + Math.sin(a + dj) * br });
    });
    return { layers, center };
  },

  // 确定性 hash → [0,1)
  _hash(a, b) {
    let n = (Math.floor(a) * 374761393 + Math.floor(b) * 668265263) >>> 0;
    n = ((n ^ (n >>> 13)) * 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  },

  // 生成一圈顺时针轨道（inset = 向内缩进的圈层，0=外圈）
  makeRing(inset) {
    const size = 8 - inset * 2, o = inset, ring = [];
    for (let x = 0; x < size; x++) ring.push({ x: o + x, y: o });              // 上边 →
    for (let y = 1; y < size; y++) ring.push({ x: o + size - 1, y: o + y });   // 右边 ↓
    for (let x = size - 2; x >= 0; x--) ring.push({ x: o + x, y: o + size - 1 });// 下边 ←
    for (let y = size - 2; y >= 1; y--) ring.push({ x: o, y: o + y });         // 左边 ↑
    return ring;
  },

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
    { id: 'bandit', name: '掠夺者', hp: 3, atk: 3 },
  ],
  randomEvents: [ // 事件格
    { w: 3, coins: [1, 3], text: '在瓦砾堆里捡到几枚旧世界硬币' },
    { w: 2, item: 'chest', text: '翻到一批先行者遗留的物资' },
    { w: 2, nothing: true, text: '辐射风掠过荒原，什么也没发生' },
    { w: 1, coins: [4, 6], text: '找到一只未撬过的保险柜！' },
  ],

  // ---------- 怪物图鉴（设计者 2026-09-02 定版，数值 = 攻击力-生命） ----------
  // art = art.js 立绘 id；越往内层（layerIdx 越大）敌人越强。
  monsters: {
    infantry:   { id: 'infantry',   name: '荒民打手',   atk: 4, hp: 4, behavior: 'strike' },
    archer:     { id: 'archer',     name: '废土猎手',   atk: 5, hp: 3, behavior: 'volley' },
    bandit:     { id: 'bandit',     name: '掠夺者',     atk: 3, hp: 3, behavior: 'strike' },
    cavalry:    { id: 'cavalry',    name: '机车掠袭者', atk: 5, hp: 6, behavior: 'charge' },
    orc_jav:    { id: 'orc_jav',    name: '畸变投掷者', atk: 6, hp: 4, behavior: 'volley' },
    orc_axe:    { id: 'orc_axe',    name: '畸变屠夫',   atk: 4, hp: 7, behavior: 'guard' },
    wolf_rider: { id: 'wolf_rider', name: '畸变狼骑兵', atk: 7, hp: 6, behavior: 'charge' },
    fire_el:    { id: 'fire_el',    name: '灼热异变体', atk: 10, hp: 7, behavior: 'burn' },
    water_el:   { id: 'water_el',   name: '腐蚀异变体', atk: 7, hp: 10, behavior: 'guard' },
    grass_el:   { id: 'grass_el',   name: '滋生异变体', atk: 5, hp: 12, behavior: 'curse' },
    dragon:     { id: 'dragon',     name: '巨兽「荒渊」', atk: 7, hp: 40, elite: true, behavior: 'dragon' },
  },
  // 各环层遭遇表：battle 格随机抽一种遭遇（1-3 只）；elite 为稀有强敌遭遇
  // 2026-09-06 #6-8 遭遇表定版（设计者口径，敌人 = 攻-血）：
  //   外层 2-4 只：荒民打手4-4 / 废土猎手5-3 / 掠夺者3-3 / 机车掠袭者5-6（含掠夺者时 ≥3 只）
  //   中层 2-3 只：畸变投掷者6-4 / 畸变屠夫4-7 / 畸变狼骑兵7-6
  //   内层 1-3 只：灼热异变体10-7 / 腐蚀异变体7-10 / 滋生异变体5-12；巨兽「荒渊」7-40 固定单体（25% 概率遭遇）
  encounters: [
    { pool: ['infantry', 'archer', 'bandit', 'cavalry'], size: [2, 4], risk: '低', strategy: '试探：单体攻击，适合熟悉手牌与攒资源；遇掠夺者必成群（≥3）' },
    { pool: ['orc_jav', 'orc_axe', 'wolf_rider'], size: [2, 3], risk: '中', strategy: '压迫：高攻与厚血混编，优先处理投矛手' },
    { pool: ['fire_el', 'water_el', 'grass_el'], size: [1, 3],
      risk: '高', strategy: '变阵：多敌人持续施压，注意元素的不同攻防节奏',
      elite: { pool: ['dragon'], size: [1, 1], chance: 0.25, strategy: '精英预警：巨兽「荒渊」固定单体，撤退仍可保住已结算的战利品' } },
  ],
  enemyPool: [   // 兼容旧引用（事件战等）：统一指向新表
    { id: 'bandit', name: '掠夺者', hp: 3, atk: 3 },
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
  // 环层掉落表（键 = layerIdx）：击败该环敌人掉什么，多组组合时等概率随机一组。
  // n 写成 [min,max] 表示随机数量，写成数字表示固定数量。
  layerChests: [
    [[{ k: 'small', n: [1, 2] }]],                                             // 外层：小宝箱 1-2 个
    [[{ k: 'medium', n: 2 }], [{ k: 'large', n: 1 }]],                         // 中层：中宝箱×2 或 大宝箱×1
    [[{ k: 'large', n: 1 }, { k: 'small', n: 1 }],                             // 内层：大+小 或 大+中
     [{ k: 'large', n: 1 }, { k: 'medium', n: 1 }]],
  ],

  // ---------- 中央祭坛区 ----------
  centerColor: '#4a3763',   // 暗紫：祭坛区
  altar: {
    pos: [3, 3],
    bosses: [
      { id: 'boss_general', name: '锈蚀将军', hp: 50, atk: 5, cell: [4, 3], icon: '将',
        affix: 'grow',  affixName: '军威', behavior: 'general', affixDesc: '每个回合结束时攻击力 +2' },
      { id: 'boss_orc',     name: '兽群之主', hp: 45, atk: 4, cell: [4, 4], icon: '兽',
        affix: 'frenzy', affixName: '狂乱', behavior: 'orc_boss', affixDesc: '每回合攻击两次，每次附加 1 层流血或中毒' },
      { id: 'boss_elem',    name: '辐射领主', hp: 48, atk: 8, cell: [3, 4], icon: '元',
        affix: 'aegis', affixName: '元素庇幕', behavior: 'element_boss', affixDesc: '偶数回合减免所有伤害（破甲可克制）' },
    ],
  },

  // ---------- 三个环层 ----------
  layers: [
    {
      id: 'L1', name: '外环 · 荒地边缘', nameEn: 'The Ashen Fringe', inset: 0, color: '#6e5133',   // 铁锈沙土：荒地外环
      risk: '低', tempo: '补给与试探（战斗较少，适合整备）',

      entrances: [0, 7, 14, 21],
      entranceNames: ['清扫口A · 西北角', '清扫口B · 东北角', '清扫口C · 东南角', '清扫口D · 西南角'],
      doors: [   // 出口和下一层的入口（exit=true 表示可从此撤离）
        { pair: 'p1', at: 1,  toLayer: 1, arriveAt: 0,  exit: true },  // (1,0)↔(1,1)
        { pair: 'p2', at: 8,  toLayer: 1, arriveAt: 5,  exit: true },  // (7,1)↔(6,1)
        { pair: 'p3', at: 15, toLayer: 1, arriveAt: 10, exit: true },  // (6,7)↔(6,6)
        { pair: 'p4', at: 22, toLayer: 1, arriveAt: 15, exit: true },  // (0,6)↔(1,6)
      ],
      cells: {
        // 2:{'两个币'} 3:{'商店'} 4:{'事件'} 5:{'战斗'} 6:{'木材×1'}
        2: { type: 'coin', n: 2 },
        3: { type: 'shop' },
        4: { type: 'event' },
        5: { type: 'battle' },
        6: { type: 'wood', n: 1 },
        // 9:{'两个币'} 10:{'战斗'} 11:{'事件'} 12:{'战斗'} 13:{'战斗'}
        9:  { type: 'coin', n: 2 },
        10: { type: 'battle' },
        11: { type: 'event' },
        12: { type: 'battle' },
        13: { type: 'battle' },
        // 16:{'战斗'} 17:{'小宝箱'} 18:{'事件'} 19:{'两个币'} 20:{'战斗'}
        16: { type: 'battle' },
        17: { type: 'chest' },
        18: { type: 'event' },
        19: { type: 'coin', n: 2 },
        20: { type: 'battle' },
        // 23:{'火堆'} 24:{'火堆'} 25:{'事件'} 26:{'战斗'} 27:{'木材×1'}
        23: { type: 'fire' },
        24: { type: 'fire' },
        25: { type: 'event' },
        26: { type: 'battle' },
        27: { type: 'wood', n: 1 },
      },
    },

    {
      id: 'L2', name: '中环 · 废墟市街', nameEn: 'The Rusted Blocks', inset: 1, color: '#3d5a50',   // 锈绿残垣：中环街区
      risk: '中', tempo: '分岔与取舍（战斗、钥匙、商店交错）',

      doors: [
        { pair: 'p5', at: 13, toLayer: 2, arriveAt: 8 },   // (3,6)→(3,5) 商店，第三层入口
        { pair: 'p6', at: 18, toLayer: 2, arriveAt: 11 },  // (1,3)→(2,3) 商店，第三层入口
      ],
      cells: {
        0:  { type: 'coin', n: 2 },   // (1,1) 第二层入口，2币
        1:  { type: 'fire' },         // (2,1) 火堆
        2:  { type: 'fire' },         // (3,1) 火堆
        3:  { type: 'battle' },       // (4,1) 战斗
        4:  { type: 'event' },        // (5,1) 事件
        5:  { type: 'coin', n: 2 },   // (6,1) 2币
        6:  { type: 'battle' },       // (6,2) 战斗
        7:  { type: 'rations' },      // (6,3) 口粮
        8:  { type: 'battle' },       // (6,4) 战斗
        9:  { type: 'coin', n: 4 },   // (6,5) 4币
        10: { type: 'coin', n: 2 },   // (6,6) 2层入口，2币
        11: { type: 'battle' },       // (5,6) 战斗
        12: { type: 'key' },          // (4,6) 钥匙
        13: { type: 'shop' },         // (3,6) 商店，第三层入口
        14: { type: 'battle' },       // (2,6) 战斗
        15: { type: 'coin', n: 2 },   // (1,6) 2币
        16: { type: 'battle' },       // (1,5) 战斗
        17: { type: 'coin', n: 3 },   // (1,4) 3币
        18: { type: 'shop' },         // (1,3) 商店，第三层入口
        19: { type: 'event' },        // (1,2) 事件
      },
    },

    {
      id: 'L3', name: '内环 · 污染核心区', nameEn: 'The Contaminated Core', inset: 2, color: '#443a63',   // 病变紫岩：污染核心
      risk: '高', tempo: '高压冲刺（高价值、精英预警、紧急撤离）',

      altarEntrances: [
        { pair: 'a1', at: 1 },    // (3,2) 祭坛入口（格本身+4币）
        { pair: 'a2', at: 11 },   // (2,3) 祭坛入口（格本身是商店）
      ],
      cells: {
        0:  { type: 'battle' },          // (2,2) 战斗
        1:  { type: 'coin', n: 4 },      // (3,2) 4币，祭坛入口
        2:  { type: 'wood', n: 2 },      // (4,2) 2木材
        3:  { type: 'battle' },          // (5,2) 战斗
        4:  { type: 'fire' },            // (5,3) 火堆
        5:  { type: 'fire' },            // (5,4) 火堆
        6:  { type: 'battle' },          // (5,5) 战斗
        7:  { type: 'event' },           // (4,5) 事件
        8:  { type: 'shop' },            // (3,5) 商店
        9:  { type: 'battle' },          // (2,5) 战斗
        10: { type: 'emergencyExit' },   // (2,4) 紧急撤离点，花10币直接撤离
        11: { type: 'shop' },            // (2,3) 商店，祭坛入口
      },
    },
  ],

  // ---------- 中央 2×2（渲染与悬浮提示用；战斗经由祭坛触发） ----------
  center: [
    { x: 3, y: 3, type: 'altar', name: '污染核心' },
    { x: 4, y: 3, type: 'boss', icon: '将', name: '锈蚀将军 · 550HP' },
    { x: 3, y: 4, type: 'boss', icon: '元', name: '辐射领主 · 400HP' },
    { x: 4, y: 4, type: 'boss', icon: '兽', name: '兽群之主 · 320HP' },
  ],
};
