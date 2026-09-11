/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { RunStorage, SLOT_COUNT } from './game.storage.js';
import { GameStore } from './game.store.js';
import { createGameMenuController } from './game.menu.js';
import { Random } from './random.js';
import { checkConnectivity } from './map-graph.js';
import { createLayeredMap } from './layeredMap.js';
import { GENERATOR_VERSION, LAYOUT_VERSION } from './map-generator.js';

const runtime = {
  openClassChoice: () => {},
  openBaseHub: () => {},
  rebuildNotes: () => {},
  resize: () => {},
  showRunTransition: async () => {},
};

function configureGameRuntime(hooks) {
  Object.assign(runtime, hooks || {});
}
/* ============================================================
 * 搜打撤 v0.3 —— 游戏主逻辑（五层节点图）
 * 流程：选入口 → 点击相邻节点移动 → 落脚触发格子事件
 *   层间门：踩到弹窗（进入下一层 / 返回上一层 / 终层可撤离）
 *   祭坛入口：进入祭坛挑战 BOSS（M1 实装卡牌战斗）
 *   紧急撤离点：花 10 币直接撤离
 * ============================================================ */
  const MAP = SDT.MAP;
  const FX = SDT.FX; // 渲染特效：飘字 / 脉冲 / 震屏

  const store = new GameStore(MAP);
  const game = store.state;
  game.getSnapshot = () => store.getSnapshot();

  // ---------- 玩法模式（基地「出发」页选择） ----------
  const BASE_FIRE_HEAL = MAP.rules.fireHeal;
  const MODES = {
    standard: { id: 'standard', icon: '[[icon:map]]', name: '标准搜打撤',
      desc: '完整五层节点图：探索、搜刮与战斗，在层间门和终局撤离点做路线选择。',
      enemyMul: 1, coinMul: 1, xpMul: 1, startCoins: 0, healMul: 1, ckpt: '规则无修正' },
    elite: { id: 'elite', icon: '[[icon:fire]]', name: '精英突袭',
      desc: '敌人与 BOSS 属性 ×1.5，战斗掉落金币 ×1.5，人物经验 +50%，高稀有度卡牌爆率 +20%。高风险高回报。',
      enemyMul: 1.5, coinMul: 1.5, xpMul: 1.5, startCoins: 0, healMul: 1, ckpt: '敌人 ×1.5 · 经验 +50% · 高稀有掉落 +20%' },
    casual: { id: 'casual', icon: '[[icon:home]]', name: '悠闲行军',
      desc: '开局携带 10 币，火堆与治疗效果 ×2，人物经验 -20%。适合练级与囤积基地物资。',
      enemyMul: 1, coinMul: 1, xpMul: 0.8, startCoins: 10, healMul: 2, ckpt: '开局 +10 币 · 治疗 ×2' },
  };
  const modeCfg = () => MODES[game.mode] || MODES.standard;
  // 按当前模式缩放敌人属性（战斗格 / 事件战 / BOSS 通用）
  const scaledEnemy = (e) => {
    const m = modeCfg();
    if (!e || m.enemyMul === 1) return e;
    return { ...e, hp: Math.round(e.hp * m.enemyMul), atk: Math.round((e.atk || 2) * m.enemyMul) };
  };
  const applyModeRules = () => {
    const m = modeCfg();
    MAP.rules.fireHeal = BASE_FIRE_HEAL * (m.healMul || 1);
    SDT.Meta.setXpMul(m.xpMul || 1);
  };

  const canvas = document.getElementById('game');
  // alpha:false——每帧都会整屏铺背景，不透明画布可让合成器跳过透明混合。
  // 不启用 desynchronized：本机混合显卡 A/B 中它会让交换链吞吐明显下降。
  const ctx = canvas.getContext('2d', { alpha: false });
  let cam, dpr = 1;

  // ---------- 工具 ----------
  // curLayer 返回运行时层数据（layerData，由生成器按种子产出，含逻辑格/门/入口）
  const curLayer = () => game.layerData[game.layerIdx];
  // 结点地图：pos 与结点坐标一律为世界像素（几何唯一来源见 buildDerived 的 nodePos）
  const cellCenter = (li, idx) => ({ ...game.nodePos[li][idx] });
  const rndDice = () => 1 + Math.floor(Random.random('dice') * MAP.rules.diceSides);
  const pick = (arr) => arr[Math.floor(Random.random('gameplay') * arr.length)];
  const fxAt = () => ({ x: game.pos.x, y: game.pos.y });

  const weighted = (arr) => {
    const total = arr.reduce((a, b) => a + b.w, 0);
    let r = Random.random('gameplay') * total;
    for (const e of arr) { r -= e.w; if (r <= 0) return e; }
    return arr[0];
  };
  game.curLayer = curLayer;
  game.log = (m, c) => UI.log(m, c);
  game.debug = {}; // 调试入口在下方函数定义后填充
  SDT.game = game;

  // ---------- 人物：生命 / 经济 / 背包 ----------
  game.heal = function (n) {
    if (game.hp >= game.maxHp) { UI.log('[[icon:heart]] 生命值已满', 'dim'); return; }
    const real = Math.min(n, game.maxHp - game.hp);
    game.hp += real;
    SDT.Sound.sfx('heal');
    UI.log(`[[icon:heart]] 恢复 <b>${real}</b> 点生命（${game.hp}/${game.maxHp}）`, 'heal');
    UI.refresh(game);
  };

  game.damage = function (n, reason) {
    game.hp -= n;
    const p = fxAt();
    // 三档反馈（game-feel）：玩家受伤=large（大飘字+震屏+顿帧+受击音），重伤加重
    FX.feedback(p.x, p.y, {
      text: `-${n} 生命`, color: '#ff6b5e', big: true,
      tier: n >= 8 ? 'large' : 'medium', sfx: 'strike',
    });
    UI.log(`[[icon:heart]] ${reason ? reason : ''}损失 <b>${n}</b> 点生命（${Math.max(0, game.hp)}/${game.maxHp}）`, 'warn');
    if (game.hp <= 0) doDeath();
    UI.refresh(game);
  };

  function doDeath() {
    syncPlayTime();
    game.state = 'done';
    game.runActive = false;
    clearSave();
    SDT.Sound.sfx('defeat');
    SDT.Sound.music('title');
    SDT.Meta.track('death', { cls: game.myClass });
    const lost = game.inventory.reduce((a, b) => a + b.value * b.count, 0);
    // 安全格里的卡牌由宠物抢运回基地，其余（物资/未保护卡牌/口袋卡）全部丢失
    const saved = cardStacks(true);
    SDT.Base.depositCards(game.ownedCards.filter(o => o.safe).map(o => ({ card: o.card, count: 1 })));
    const savedN = saved.reduce((a, b) => a + b.count, 0);
    UI.log(savedN
      ? `<b>[[icon:skull]] 你倒下了……</b>[[icon:lock]] 宠物抢运回安全格中的 <b>${savedN}</b> 张卡牌，其余全部丢失`
      : '<b>[[icon:skull]] 你倒下了……</b>安全格里没有卡牌，全部战利品丢失', 'warn');
    UI.showOverlay('[[icon:skull]] 撤离失败', `
      <p class="ov-stats">生命归零，价值 <b class="gold">¥${lost.toLocaleString()}</b> 的物资与未保护的卡牌全部掉落</p>
      ${saved.length ? `<p class="ov-note">[[icon:lock]] 安全格保护了 <b>${savedN}</b> 张卡牌并运回基地：` +
        saved.map(s => `${esc(s.card.name)}${s.count > 1 ? ' ×' + s.count : ''}`).join('、') + '</p>'
        : '<p class="ov-note">提示：把卡牌存入背包的<b>安全格</b>（容量在基地用口粮升级），撤离失败时才能保住它们。</p>'}
      <div class="ov-btns">
        <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
        <button class="ov-btn ok" data-act="again">再出发</button>
      </div>`);
    UI.act('goBase', () => { UI.hideOverlay(); runtime.openBaseHub('deploy'); });
    UI.act('again', () => { UI.hideOverlay(); runtime.openBaseHub('deploy'); });
    UI.refresh(game);
  }

  // ---------- 背包容量（基地扩建后生效）----------
  // 物资与卡牌混占背包格：同名物资/同名卡牌各堆叠 1 格；
  // 安全格独立计容（基地用口粮升级），消耗口袋不占格（无限容量）。
  // 珍珠盒（Q5 老板定向）：每持有 1 个额外扩容 9 格，扩出来的格子只能放资源卡。
  const PEARL_BOX_ID = 'tt2-pearlbox';
  const PEARL_BOX_SLOTS = 9;
  const pearlBonus = () => (game.ownedCards || []).filter(o => o.card && o.card.id === PEARL_BOX_ID).length * PEARL_BOX_SLOTS;
  const bagCap = () => SDT.Base.bagCap() + pearlBonus();
  // 背包能否再收一张卡：基础格内任意类型；珍珠盒扩出来的格子仅资源卡（卡面「容纳所有类型的资源卡牌」）
  const canAcceptCard = (card) => {
    if (!card) return false;
    const used = usedSlots();
    if (used < SDT.Base.bagCap()) return true;
    return card.type === '资源' && used < bagCap();
  };
  const safeCap = () => SDT.Base.safeCap();
  function cardStacks(safe) {
    const map = new Map();
    game.ownedCards.forEach(o => {
      if (!!o.safe !== !!safe) return;
      const key = o.card.name;
      if (!map.has(key)) map.set(key, { card: o.card, count: 0, uids: [] });
      const s = map.get(key);
      s.count++;
      s.uids.push(o.uid);
    });
    return [...map.values()];
  }
  function usedSlots() { return game.inventory.length + cardStacks(false).length; }
  function safeUsed() { return cardStacks(true).length; }
  // 卡牌 zone 一致性断言（card-game：一张卡同一时刻只应属于一个 zone）。
  // dev 模式下在存档前跑：uid 重复 / 卡牌同时带 safe 与 brought 以外矛盾标记即报错。
  function assertZones() {
    if (!game.devMode) return;
    const seen = new Set();
    game.ownedCards.forEach(o => {
      if (seen.has(o.uid)) console.error('[zone] uid 重复（卡牌同时存在于两个实例）：', o.uid, o.card && o.card.name);
      seen.add(o.uid);
      if (o.safe && o.brought && o.brought !== 1) {
        console.error('[zone] 卡牌同时标记 safe 与异常 brought：', o.uid, o.card && o.card.name);
      }
    });
    // 消耗口袋与身上卡不共享 uid（usedPocket 存 {card,count} 聚合，无 uid，天然隔离）
    game.usedPocket.forEach(p => {
      if (p && p.uid) console.error('[zone] usedPocket 条目不应携带 uid：', p.uid, p.card && p.card.name);
    });
  }

  game.bagCap = bagCap;
  game.canAcceptCard = canAcceptCard;   // 珍珠盒扩格的资源限制（Q5）
  game.safeCap = safeCap;
  game.usedSlots = usedSlots;
  game.safeUsed = safeUsed;
  game.gainCoins = gainCoins;   // 宝箱等模块发币（含飘字与日志）

  game.addItem = function (tpl, n) {
    n = n || 1;
    // 同名物品堆叠占一格；背包上限 bagCap() 格（基地可扩建）
    let slot = game.inventory.find(it => it.name === tpl.name && it.tier === (tpl.tier || 'C'));
    if (!slot && usedSlots() >= bagCap()) {
      const pf = fxAt();
      FX.float('背包已满', pf.x, pf.y, '#ff6b5e');
      SDT.Sound.sfx('deny');
      UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格，可在基地用木材扩建），无法获得 <b>${tpl.name}</b>`, 'warn');
      return null;
    }
    if (!slot) {
      slot = { name: tpl.name, value: tpl.value || 0, tier: tpl.tier || 'C', count: 0 };
      game.inventory.push(slot);
    }
    slot.count += n;
    const ps = fxAt();
    FX.float(`+${tpl.name}`, ps.x, ps.y, '#c9b6ee');
    UI.log(`获得 <b>${tpl.name}${slot.count > 1 ? ` ×${slot.count}` : ''}</b>（¥${(tpl.value || 0) * slot.count}）`, 'loot');
    UI.refresh(game);
    return slot;
  };

  function gainCoins(n) {
    // 精英突袭等模式的金币倍率（战斗掉落 / 格子币全部生效）
    n = Math.max(1, Math.round(n * (modeCfg().coinMul || 1)));
    game.coins += n;
    SDT.Sound.sfx('coin');
    UI.log(`获得 <b>${n}</b> 币（现有 ${game.coins}）`, 'coin');
  }

  // ---------- 初始化派生数据 ----------
  // 逻辑格：轨道上可站立的最小单位。相连火堆（上下左右连通）合并为 1 个逻辑格，
  // 掷骰移动时整片火堆只算 1 步，不存在"从一半走到另一半"。
  const MAP_NODE_SPACING = 120;
  const MAP_NODE_PADDING = 180;

  function clampIndex(value, max, fallback = 0) {
    const n = Number.isFinite(+value) ? Math.floor(+value) : fallback;
    return Math.max(0, Math.min(Math.max(0, max - 1), n));
  }

  function buildDerived(mapSeed = game.mapSeed ?? game.seed ?? Random.seed ?? 0) {
    game.rings = [];
    game.mapSeed = mapSeed;
    game.generatorVersion = GENERATOR_VERSION;
    game.layoutVersion = LAYOUT_VERSION;
    game.layerData = createLayeredMap(mapSeed);
    game.layerData.forEach(ld => { ld.toLogical = new Map(ld.logical.map((_, i) => [i, i])); });
    const reachable = checkConnectivity(game.layerData);
    if (!reachable.ok) console.error('[map] 不可达结点：', reachable.unreachable.join(' · '));

    // 每层使用自己的局部网格坐标，不再把五层横向平移后硬挤进一张图。
    // 生成器保证 x/row 为四向网格；这里仅负责把格心映射为稳定世界坐标。
    game.nodePos = game.layerData.map(ld => {
      const grid = ld.gridBounds || {};
      const minX = Number.isFinite(grid.minX) ? grid.minX : Math.min(...ld.logical.map(c => c.x || 0));
      const minRow = Number.isFinite(grid.minRow) ? grid.minRow : Math.min(...ld.logical.map(c => c.row || 0));
      return ld.logical.map(cell => ({
        x: MAP_NODE_PADDING + ((cell.x || 0) - minX) * MAP_NODE_SPACING,
        y: MAP_NODE_PADDING + ((cell.row || 0) - minRow) * MAP_NODE_SPACING,
      }));
    });
    game.layerBounds = game.nodePos.map((positions, li) => {
      const grid = game.layerData[li].gridBounds || {};
      const minX = Math.min(...positions.map(p => p.x));
      const maxX = Math.max(...positions.map(p => p.x));
      const minY = Math.min(...positions.map(p => p.y));
      const maxY = Math.max(...positions.map(p => p.y));
      return {
        minX: minX - MAP_NODE_SPACING * 0.5,
        maxX: maxX + MAP_NODE_SPACING * 0.5,
        minY: minY - MAP_NODE_SPACING * 0.5,
        maxY: maxY + MAP_NODE_SPACING * 0.5,
        gridBounds: grid,
      };
    });
    game.geometryVersion = `${String(game.mapSeed)}:${game.generatorVersion}:${game.layoutVersion}`;
    game.centerPos = [];
    game.nodes = [];                  // 扁平结点表（渲染与最近结点命中用）
    game.cellDefs = new Map();        // 'li,idx' → { def, x, y, li, idx }
    const addNode = (li, idx, def) => {
      const p = li === -1 ? game.centerPos[idx] : game.nodePos[li][idx];
      const node = { x: p.x, y: p.y, li, idx, def };
      game.nodes.push(node);
      game.cellDefs.set(li + ',' + idx, { def, x: p.x, y: p.y, li, idx });
      return node;
    };
    game.layerData.forEach((ld, li) => {
      ld.logical.forEach((lc, idx) => {
        let def = lc.def;
        const eIdx = ld.entrances.indexOf(idx);
        if (eIdx >= 0) def = { type: 'entrance', name: ld.entranceNames[eIdx] };
        addNode(li, idx, def);
      });
    });
  }

  // ---------- 存档（五档位，互相独立；基地数据也按档位隔离，见 base.js） ----------
  let activeSlot = null;                // 当前游玩的档位（1..5），标题界面为 null

  const hasRun = (i) => RunStorage.has(i);                            // 该档有进行中的对局
  const hasSlot = (i) => hasRun(i) || SDT.Base.hasSlot(i);           // 该档位已被创建

  function readSlot(i) {
    return RunStorage.read(i);
  }

  function migrateOldSave() {
    RunStorage.migrateLegacy();
  }

  function saveGame() {
    // v0.21：只有真正开局后（runActive）才写对局存档；在基地/标题界面不产生对局文件
    // 只保存稳定节点；动画中可能仍停在线段中间，退出/刷新后必须回到上一个落点。
    if (!game.runActive || game.state === 'title' || game.state === 'done' || game.state === 'boot' || game.state === 'moving') return;
    if (!activeSlot) return;
    syncPlayTime();
    assertZones();
    RunStorage.write(activeSlot, {
        seed: Random.seed, rngState: Random.snapshot(),
        mapSeed: game.mapSeed ?? Random.seed,
        generatorVersion: game.generatorVersion ?? GENERATOR_VERSION,
        layoutVersion: game.layoutVersion ?? LAYOUT_VERSION,
        geometryVersion: game.geometryVersion ?? null,
        layerIdx: game.layerIdx, trackPos: game.trackPos,
        hp: game.hp, maxHp: game.maxHp, coins: game.coins, turn: game.turn,
        atk: game.atk, mode: game.mode, myClass: game.myClass || null, characterId: game.characterId || null,
        inventory: game.inventory, ownedCards: game.ownedCards,
        cardOrder: game.cardOrder || [],
        usedPocket: game.usedPocket,
        eventLog: game.eventLog || [],
        visited: game.visited || {},
        seen: game.seen || {},
        fragments: game.fragments || 0,
        discovered: [...game.discoveredPairs],
        diceHistory: game.diceHistory, elapsed: game.elapsed,
        stamina: game.stamina == null ? MAP.rules.staminaMax : game.stamina,
        slot: activeSlot, savedAt: Date.now(),
        // 战斗中退出/关窗（beforeunload）：把战斗局面一并写入，读档后续打而非重开
        battle: (game.battleActive && SDT.Battle && typeof SDT.Battle.serialize === 'function')
          ? SDT.Battle.serialize() : null,
      });
  }

  function syncPlayTime() {
    if (!activeSlot || !SDT.Base.slot) return;
    const now = Math.max(0, +game.elapsed || 0);
    const prev = Math.max(0, +game.elapsedSynced || 0);
    const delta = Math.max(0, now - prev);
    if (delta > 0) {
      SDT.Base.data.stats.playSeconds = Math.max(0, +SDT.Base.data.stats.playSeconds || 0) + delta;
      game.elapsedSynced = now;
      SDT.Base.save();
    }
  }

  // 删除某档位：对局进度 + 基地一起清空（该档位回到未创建状态）
  function clearSlot(i) {
    RunStorage.remove(i);
    SDT.Base.wipe(i);
  }
  function clearSave() { if (activeSlot) RunStorage.remove(activeSlot); }
  function clearAllSlots() { for (let i = 1; i <= SLOT_COUNT; i++) clearSlot(i); }

  function loadGame(slot) {
    const s = readSlot(slot);
    if (!s) {
      const ri = RunStorage.issue(slot);
      if (ri === 'corrupt') UI.log('[[icon:cross]] 对局存档损坏（原数据已备份），无法读取', 'warn');
      else if (ri === 'tooNew') UI.log('[[icon:cross]] 对局存档来自更新版本的游戏，无法读取', 'warn');
      return false;
    }
    game.seed = Random.restore(s.rngState || s.seed);
    // 旧档没有 mapSeed 时，以旧 seed 作为确定性地图种子；若连 seed 都没有，
    // 使用带档位的固定回退值，避免每次读档得到不同地图。
    const restoredMapSeed = s.mapSeed ?? s.seed ?? `legacy-slot-${slot}`;
    buildDerived(restoredMapSeed);
    SDT.Base.use(slot);   // 该档位的基地数据（仓库/熟练度/成就/卡背）
    const bi = SDT.Base.issue(slot);
    if (bi === 'corrupt') UI.log('[[icon:cross]] 该档位基地数据损坏（原数据已备份），本次以空档案启动', 'warn');
    else if (bi === 'tooNew') UI.log('[[icon:cross]] 该档位基地数据来自更新版本的游戏，已以空档案启动', 'warn');
    game.runActive = true;
    setLobby(false);      // 直接回到棋盘上的对局：恢复左侧栏
    game.hp = s.hp; game.maxHp = s.maxHp || MAP.rules.playerMaxHp;
    game.atk = s.atk || MAP.rules.playerAtk;
    game.coins = s.coins; game.turn = s.turn || 1;
    game.mode = MODES[s.mode] ? s.mode : 'standard';
    game.myClass = s.myClass || null;
    game.characterId = s.characterId || null;
    applyModeRules();
    game.inventory = Array.isArray(s.inventory) ? s.inventory : [];
    game.ownedCards = Array.isArray(s.ownedCards) ? s.ownedCards : [];
    // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）：存档内整卡副本与基地仓库/口袋同步更名
    {
      const copies = game.ownedCards.map(o => o.card)
        .concat((SDT.Base.data.stash || []).concat(SDT.Base.data.pocket || []).map(st => st.card));
      if (SDT.Cards.applyAbilityRename(copies)) SDT.Base.save();
    }
    game.cardOrder = Array.isArray(s.cardOrder) ? s.cardOrder : [];
    game.usedPocket = Array.isArray(s.usedPocket) ? s.usedPocket : [];
    game.eventLog = Array.isArray(s.eventLog) ? s.eventLog : [];
    // 迷雾与防重刷（旧档无字段 → {}，走【全部可见/可重复】的兼容路径）
    game.visited = (s.visited && typeof s.visited === 'object') ? s.visited : {};
    game.seen = (s.seen && typeof s.seen === 'object') ? s.seen : {};
    game.fragments = +s.fragments || 0;   // 彩色令牌碎片（旧档无字段 → 0）
    game.pendingEventLoot = null;
    game.discoveredPairs = new Set(s.discovered || []);
    game.diceHistory = s.diceHistory || [];
    game.elapsed = s.elapsed || 0;
    game.stamina = typeof s.stamina === 'number' ? s.stamina : MAP.rules.staminaMax;   // 旧档无体力字段 → 回满
    // 旧存档只有本局 elapsed：首次读取时把它安全迁入累计游玩时间。
    if ((SDT.Base.data.stats.playSeconds || 0) < game.elapsed) {
      SDT.Base.data.stats.playSeconds = game.elapsed;
      SDT.Base.save();
    }
    game.elapsedSynced = game.elapsed;
    const safeLayer = clampIndex(s.layerIdx, game.layerData.length, 0);
    const layer = game.layerData[safeLayer];
    const requestedIdx = Number.isFinite(+s.trackPos) ? Math.floor(+s.trackPos) : -1;
    const safeIdx = layer?.logical?.[requestedIdx]
      ? requestedIdx
      : (layer?.entrances?.[0] ?? clampIndex(requestedIdx, layer?.logical?.length || 1, 0));
    enterLayer(safeLayer, safeIdx);
    SDT.Sound.music('board');
    UI.log(`[[icon:download]] 已读取【档位 ${slot}】存档，直接回到上一局未结束的对局`, 'ok');
    if (!game.myClass) runtime.openClassChoice();   // 上次存档时还没选职业：补上开局选择
    else if (s.battle && SDT.Battle && typeof SDT.Battle.restore === 'function') {
      if (SDT.Battle.restore(game, s.battle)) {
        // 读档恢复的战斗没经过 resolveCell：本格按已触发处理，撤退/胜利后不重复触发
        if (game.visited) game.visited[game.layerIdx + ',' + game.trackPos] = 1;
        saveGame();   // 恢复后立刻回写，防二次退出丢进度
      }
    }
    return true;
  }

  const menuController = createGameMenuController({
    SDT, UI, game, runtime, SLOT_COUNT, esc, readSlot, loadGame, clearSlot,
    hasRun, RunStorage,
    saveGame, syncPlayTime, clearSave, clearAllSlots,
    getActiveSlot: () => activeSlot,
    setActiveSlot: value => { activeSlot = value; },
  });
  const { setLobby, showTitle, startNewGame, exitToTitle, quitGame, openSettings } = menuController;

  // ---------- 流程 ----------
  const newUid = () => 'o' + Date.now().toString(36) +
    Math.floor(Random.random('identity') * 46656).toString(36) + Math.floor(Random.random('identity') * 1296).toString(36);

  // 每局开始：固定携带 5 张初始牌「初始攻击」（同名堆叠，只占 1 格背包）+ 1 张「火球」
  // brought=1：开局带入的卡（放弃对局时无条件丢失，v0.21 规则）
  function grantStarterSha() {
    const sha = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
    for (let i = 0; i < MAP.rules.starterSha; i++) {
      game.ownedCards.push({ uid: newUid(), card: { ...sha }, brought: 1 });
    }
    // 火球为初始牌（2026-09-06）：每局固定携带 1 张，不随机掉落/发现/上架
    const fb = SDT.Cards.all().find(c => c.id === 'tt3-fireball');
    if (fb) game.ownedCards.push({ uid: newUid(), card: { ...fb }, brought: 1 });
  }

  // 把出发准备页选择的仓库卡牌带入背包（picks: 卡名 => 张数）
  function applyDeployPicks(picks) {
    const B = SDT.Base;
    let loaded = 0;
    Object.keys(picks || {}).forEach(name => {
      const n = Math.max(0, Math.floor(+picks[name] || 0));
      if (n > 0) loaded += B.takeStashCards(name, n);
    });
    if (loaded) UI.log(`[[icon:archive]] 从基地仓库携带 <b>${loaded}</b> 张卡牌出征`, 'loot');
  }

  function newRun(mode, picks) {
    game.seed = Random.reseed();
    game.mapSeed = game.seed;
    buildDerived(game.mapSeed);
    game.mode = MODES[mode] ? mode : 'standard';
    applyModeRules();
    game.runActive = true;    // v0.21：从这一刻起才写对局存档
    setLobby(false);          // 进入棋盘：恢复左侧栏
    game.inventory = [];
    game.ownedCards = [];
    game.stamina = MAP.rules.staminaMax;   // 体力系统（2026-09-06 #29）
    game.cardOrder = [];
    game.usedPocket = [];
    game.eventLog = [];
    game.fragments = 0;   // 彩色令牌碎片（Q6 隐藏计数器）
    game.pendingEventLoot = null;
    game.myClass = null;
    game.characterId = null;
    game.classCard = null;
    game.coins = modeCfg().startCoins || 0;
    game.maxHp = MAP.rules.playerMaxHp;
    game.hp = game.maxHp;
    game.atk = MAP.rules.playerAtk;
    game.discoveredPairs = new Set();
    game.diceHistory = [];
    game.dice = null;
    game.turn = 1;
    game.elapsed = 0;
    game.elapsedSynced = 0;
    game.altarFrom = null;
    game.visited = {};   // 已结算过的一次性格（防回头路重刷战斗/宝箱/事件）
    game.seen = {};      // 战争迷雾：走过的节点 + 当前相邻节点可见，其余隐藏
    SDT.Sound.music('board');   // 出发：切入行军氛围
    FX.clear();
    UI.clearLog();
    UI.log(`欢迎来到<b>代号7</b>：本次玩法【<b>${modeCfg().name}</b>】——${modeCfg().ckpt}`, 'sys');
    UI.log('点击相邻节点前进，落脚触发事件；层间闸门通往更深区域，终层可完成撤离', 'sys');
    grantStarterSha();
    UI.log(`[[icon:cards]] 随身携带初始牌【<b>初始攻击</b>】×${MAP.rules.starterSha}、【<b>火球</b>】×1（固定携带 · 不可入库 / 安全格）`, 'sys');
    applyDeployPicks(picks);    // 出发准备页选择的仓库卡牌
    const reserve = SDT.Base.takeReserveCoins();
    if (reserve) {
      game.coins += reserve;
      UI.log(`[[icon:coin]] 带上基地储备 <b>${reserve}</b> 币（卖出仓库物品所得）`, 'coin');
    }
    // 五层图从第一层的多个入口之一开始；这是起点选择，不消耗行动力。
    const l1 = game.layerData[0];
    const startIdx = l1.entrances[Math.floor(Random.random('gameplay') * l1.entrances.length)] || 0;
    enterLayer(0, startIdx);
    runtime.openClassChoice();   // 从全部职业中选择 + 1 张随机职业卡（与 5 张初始攻击一起）
  }

  // 战争迷雾可见集：到达节点 = 该节点 + 其相邻节点变为可见（走过的路径天然保留在 seen 里）
  function markSeen(li, idx) {
    if (!game.seen) game.seen = {};
    const ld = game.layerData?.[li];
    const cur = ld?.logical?.[idx];
    if (!cur) return;
    game.seen[li + ',' + idx] = 1;
    for (const [nl, ni] of (cur.next || [])) {
      if (nl === li) game.seen[nl + ',' + ni] = 1;
    }
    renderMiniMap();   // 底栏简图只在解锁新区域时重绘，平时保持原样（2026-09-09 老板定向）
  }

  // 底栏迷你地图：只画迷雾内（走过的 + 相邻可走）的节点与连线，当前节点金圈、
  // 可走相邻亮环。事件驱动重绘（markSeen / 换层时调用），不逐帧重绘。
  const MINI_TYPE_COLOR = {
    battle: '#ff6b5e', fire: '#f2854a', chest: '#f5c542', event: '#41d0a8',
    shop: '#52d273', key: '#f5c542', coin: '#f5c542', wood: '#c8956a',
    rations: '#7fdd9c', door: '#c9b28a', entrance: '#52d273',
    extraction: '#52d273', emergencyExit: '#52d273', altar: '#b77ad8', boss: '#ff5a50',
  };
  function renderMiniMap() {
    const cv = document.getElementById('miniMap');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    // 内部分辨率跟随 CSS 显示尺寸（dpr 缩放），内部/显示比例一致才不会拉伸变形
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.round(rect.width * dpr));
    const H = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    ctx.clearRect(0, 0, W, H);
    const li = game.layerIdx;
    const ld = game.layerData?.[li];
    const pts = game.nodePos?.[li];
    if (!ld || !pts) return;
    const seen = game.seen || {};
    const seenAt = (i) => seen[li + ',' + i] === 1;
    // 本层包围盒 → 画布内留边适配（保持纵横比）；pad 按短边比例留白更从容
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY - minY);
    const pad = Math.min(W, H) * 0.16;
    const s = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const ox = (W - spanX * s) / 2, oy = (H - spanY * s) / 2;
    const px = (i) => ox + (pts[i].x - minX) * s;
    const py = (i) => oy + (pts[i].y - minY) * s;
    const nodeR = Math.max(5, Math.min(W, H) * 0.055);   // 圆点尺寸随画布自适应
    // 当前节点的相邻（可走）集合
    const curCell = ld.logical[game.trackPos];
    const legal = new Set((curCell?.next || []).filter(([nl]) => nl === li).map(([, ni]) => ni));
    // 连线：两端都已解锁的边
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(214,181,110,0.4)';
    ld.logical.forEach((cell, i) => {
      if (!seenAt(i)) return;
      for (const [nl, ni] of (cell.next || [])) {
        if (nl !== li || ni <= i || !seenAt(ni)) continue;
        ctx.beginPath();
        ctx.moveTo(px(i), py(i));
        ctx.lineTo(px(ni), py(ni));
        ctx.stroke();
      }
    });
    // 当前节点 → 可走相邻的亮边
    ctx.strokeStyle = 'rgba(255,202,91,0.95)';
    ctx.lineWidth = nodeR * 0.42;
    for (const ni of legal) {
      if (!seenAt(ni)) continue;
      ctx.beginPath();
      ctx.moveTo(px(game.trackPos), py(game.trackPos));
      ctx.lineTo(px(ni), py(ni));
      ctx.stroke();
    }
    // 节点圆点：当前金圈最大、可走次之、走过的半透明
    ld.logical.forEach((cell, i) => {
      if (!seenAt(i)) return;
      const col = MINI_TYPE_COLOR[cell.def?.type] || '#d8b46a';
      const isCur = i === game.trackPos;
      const isLegal = legal.has(i);
      ctx.globalAlpha = isCur || isLegal ? 1 : 0.62;
      ctx.beginPath();
      ctx.arc(px(i), py(i), isCur ? nodeR : nodeR * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
      if (isLegal && !isCur) { ctx.strokeStyle = 'rgba(255,214,110,0.95)'; ctx.lineWidth = nodeR * 0.3; ctx.stroke(); }
      if (isCur) { ctx.strokeStyle = '#ffd166'; ctx.lineWidth = nodeR * 0.36; ctx.stroke(); }
      ctx.globalAlpha = 1;
    });
  }
  // 窗口尺寸变化后按新容器尺寸重绘一次（仍是事件驱动，不逐帧）
  window.addEventListener('resize', () => { if (game.runActive) renderMiniMap(); });

  function enterLayer(li, atIdx) {
    const safeLayer = clampIndex(li, game.layerData?.length || 1, 0);
    const layer = game.layerData?.[safeLayer];
    const safeIdx = layer?.logical?.[atIdx]
      ? atIdx
      : (layer?.entrances?.[0] ?? clampIndex(atIdx, layer?.logical?.length || 1, 0));
    game.layerIdx = safeLayer;
    game.trackPos = safeIdx;
    game.pos = cellCenter(safeLayer, safeIdx);
    markSeen(safeLayer, safeIdx);
    game.activeLayerBounds = game.layerBounds?.[safeLayer] || null;
    game.hop = 0;
    game.state = 'idle';
    if (cam) {
      // 每次新局、跨层或读档都以当前层全貌为镜头目标，避免只聚焦入口导致
      // 主体被裁到右侧、顶部留下大片空白。旧版 Camera 没有 fitLayer 时保留 focus 兜底。
      const fitted = typeof cam.fitLayer === 'function' && cam.fitLayer(game, 128);
      if (!fitted) { cam.cx = game.pos.x; cam.cy = game.pos.y; cam.clamp(); }
    }
    const f = curLayer();
    const eIdx = f.entrances.indexOf(atIdx);
    const eName = eIdx >= 0 ? f.entranceNames[eIdx] : `#${atIdx} 格`;
    UI.log(`—— 置身 <b>${f.name}</b>（${eName}）——`, 'sys');
    saveGame();
    UI.refresh(game);
  }

export { FX, MAP, MODES, SLOT_COUNT, bagCap, buildDerived, cam, canAcceptCard, canvas, cardStacks, cellCenter, clearSave, configureGameRuntime, ctx, curLayer, doDeath, dpr, markSeen, safeCap, enterLayer, exitToTitle, gainCoins, game, hasRun, migrateOldSave, modeCfg, newRun, newUid, openSettings, pick, quitGame, rndDice, safeUsed, saveGame, scaledEnemy, setLobby, showTitle, startNewGame, syncPlayTime, usedSlots, weighted };
const _set_dpr = (v) => { dpr = v; };
export { _set_dpr };
const _set_cam = (v) => { cam = v; };
export { _set_cam };
