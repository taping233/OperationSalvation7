/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { openClassChoice } from './game.run.js';
import { openBaseHub } from './game.hub.js';
import { rebuildNotes } from './game.notes.js';
import { resize } from './game.boot.js';
/* ============================================================
 * 搜打撤 v0.3 —— 游戏主逻辑（三环棋盘）
 * 流程：选入口(外圈四角) → 掷骰顺时针环走 → 落脚触发格子事件
 *   环间门：踩到弹窗（进入下一环 / 返回上一环 / 外圈门可撤离）
 *   祭坛入口：进入祭坛挑战 BOSS（M1 实装卡牌战斗）
 *   紧急撤离点：花 10 币直接撤离
 * ============================================================ */
  const MAP = SDT.MAP;
  const FX = SDT.FX; // 渲染特效：飘字 / 脉冲 / 震屏

  const game = {
    map: MAP,
    toggles: { index: true },
    rings: [],            // [layerIdx] => 轨道数组
    layerIdx: 0,
    trackPos: 0,
    pos: { x: 0.5, y: 0.5 },
    hop: 0,
    state: 'boot',        // boot/idle/rolling/moving/modal/done
    turn: 1,
    coins: 0,
    hp: 30,
    maxHp: 30,
    atk: MAP.rules.playerAtk,
    mode: 'standard',     // 本局玩法（standard/elite/casual，基地出发时选择）
    runActive: false,     // v0.21：是否有一场对局正在进行（存档/放弃判定的依据）
    battleActive: false,  // 战斗覆盖层活动中；BOSS 战期间禁止从侧栏/快捷键打开背包
    bossCleanupPending: false, // BOSS 胜利奖励结算后，必须先完成整理背包
    ownedCards: [],       // 本局持有的卡牌 [{uid, card, safe?, brought?}]（safe=存入安全格；brought=开局带入）
    cardOrder: [],        // v0.21：卡牌堆在背包中的显示顺序（卡名列表，可拖拽调整）
    usedPocket: [],       // 消耗口袋 [{card, count}]：对小怪用过的卡，复原后才能再用
    shopStock: [],
    dice: null,
    diceHistory: [],
    inventory: [],
    discoveredPairs: new Set(),  // 已踩过的门/祭坛入口（按 pair）
    altarFrom: null,      // 进祭坛时的来路 {li, idx, pair}
    hover: null,
    moveTarget: null,     // 移动中的目标逻辑格（渲染金色括号用）
    time: 0,
    elapsed: 0,
    elapsedSynced: 0,     // 已累计进基地档案的秒数，避免频繁保存时重复计时
  };

  // ---------- 玩法模式（基地「出发」页选择） ----------
  const BASE_FIRE_HEAL = MAP.rules.fireHeal;
  const MODES = {
    standard: { id: 'standard', icon: '[[icon:map]]', name: '标准搜打撤',
      desc: '完整三环棋盘：掷骰环走、搜刮战斗，从外圈门撤离。原版规则的完整体验。',
      enemyMul: 1, coinMul: 1, xpMul: 1, startCoins: 0, healMul: 1, ckpt: '规则无修正' },
    elite: { id: 'elite', icon: '[[icon:fire]]', name: '精英突袭',
      desc: '敌人与 BOSS 属性 ×1.5，战斗掉落金币 ×1.5，职业经验 +50%。高风险高回报。',
      enemyMul: 1.5, coinMul: 1.5, xpMul: 1.5, startCoins: 0, healMul: 1, ckpt: '敌人 ×1.5 · 经验 +50%' },
    casual: { id: 'casual', icon: '[[icon:home]]', name: '悠闲行军',
      desc: '开局携带 10 币，火堆与治疗效果 ×2，职业经验 -20%。适合练级与囤积基地物资。',
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
  // alpha:false——每帧都会整屏铺背景，不透明画布可让合成器跳过透明混合
  const ctx = canvas.getContext('2d', { alpha: false });
  let cam, dpr = 1;

  // ---------- 工具 ----------
  // curLayer 返回运行时层数据（layerData，含逻辑格），MAP.layers 仅作授权数据
  const curLayer = () => game.layerData[game.layerIdx];
  // 结点地图：pos 与结点坐标一律为世界像素（几何唯一来源见 buildDerived 的 nodePos）
  const cellCenter = (li, idx) => ({ ...game.nodePos[li][idx] });
  const rndDice = () => 1 + Math.floor(Math.random() * MAP.rules.diceSides);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fxAt = () => ({ x: game.pos.x, y: game.pos.y });

  const weighted = (arr) => {
    const total = arr.reduce((a, b) => a + b.w, 0);
    let r = Math.random() * total;
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
    FX.float(`-${n} 生命`, p.x, p.y, '#ff6b5e', true);
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
    UI.act('goBase', () => { UI.hideOverlay(); openBaseHub('deploy'); });
    UI.act('again', () => { UI.hideOverlay(); openBaseHub('deploy'); });
    UI.refresh(game);
  }

  // ---------- 背包容量（基地扩建后生效）----------
  // 物资与卡牌混占背包格：同名物资/同名卡牌各堆叠 1 格；
  // 安全格独立计容（基地用口粮升级），消耗口袋不占格（无限容量）。
  const bagCap = () => SDT.Base.bagCap();
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
  game.bagCap = bagCap;
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
  function buildDerived() {
    // 网格环（几何与底色渲染用）
    game.rings = MAP.layers.map(l => MAP.makeRing(l.inset));

    // 逻辑环 + 运行时层数据
    game.layerData = MAP.layers.map((layer, li) => {
      const gridRing = game.rings[li];
      const cellsTable = layer.cells || {};
      const isFire = (idx) => !!(cellsTable[idx] && cellsTable[idx].type === 'fire');
      const logical = [];
      const toLogical = new Map(); // 授权用网格环索引 → 逻辑索引
      for (let i = 0; i < gridRing.length; i++) {
        if (toLogical.has(i)) continue;
        const grid = [gridRing[i]];
        toLogical.set(i, logical.length);
        const fire = isFire(i);
        let def = fire ? { type: 'fire', name: '火堆' } : cellsTable[i];
        if (fire) { // 吞并后续相连火堆格
          let j = i + 1;
          while (j < gridRing.length && isFire(j)) {
            grid.push(gridRing[j]);
            toLogical.set(j, logical.length);
            j++;
          }
        }
        logical.push({ grid, fire, oldIdx: i, def });
      }
      const conv = (oldIdx) => (toLogical.has(oldIdx) ? toLogical.get(oldIdx) : 0);
      return {
        id: layer.id, name: layer.name, nameEn: layer.nameEn, color: layer.color,
        entranceNames: layer.entranceNames || [],
        entrances: (layer.entrances || []).map(conv),
        doors: (layer.doors || []).map(d => ({ ...d, at: conv(d.at), arriveAt: conv(d.arriveAt) })),
        altarEntrances: (layer.altarEntrances || []).map(a => ({ ...a, at: conv(a.at) })),
        logical, toLogical,
      };
    });

    // 门为双向：在目标层生成对应的返回门（同 pair）
    game.layerData.forEach((ld, li) => {
      [...ld.doors].forEach(d => {
        const dst = game.layerData[d.toLayer];
        if (!dst.doors.some(x => x.pair === d.pair && x.at === d.arriveAt)) {
          dst.doors.push({ pair: d.pair, at: d.arriveAt, toLayer: li, arriveAt: d.at, reverse: true });
        }
      });
    });

    // ---------- 结点布局（分布式结点地图的几何唯一来源） ----------
    // 逻辑格 (li, idx) → 结点世界像素坐标；渲染 / 命中 / 移动动画全部基于它。
    const layout = MAP.buildNodePositions(game.layerData.map(ld => ld.logical.length));
    game.nodePos = layout.layers;     // [li][idx] → {x, y}
    game.centerPos = layout.center;   // [祭坛, BOSS×3]，与 MAP.center 顺序一一对应
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
    // 外圈出口门格（无其他事件）→ 门/撤 图标
    (game.layerData[0].doors || []).forEach(d => {
      const info = game.cellDefs.get('0,' + d.at);
      if (info && !info.def) {
        info.def = { type: 'door', exit: !!d.exit, name: '出口 / 环间门' };
        const node = game.nodes.find(n => n.li === 0 && n.idx === d.at);
        if (node) node.def = info.def;
      }
    });
    // 中央区：祭坛 + 三 BOSS（li=-1；战斗经由祭坛触发，这里只作渲染/悬浮）
    MAP.center.forEach((cc, k) => addNode(-1, k, cc));
  }

  // ---------- 存档（三档位，互相独立；基地数据也按档位隔离，见 base.js） ----------
  const SLOT_COUNT = 3;
  const RUN_KEY = (i) => 'sdt-save-v2-slot' + i;   // 对局进度（进行中的那一局）
  const OLD_SAVE_KEY = 'sdt-save-v1';   // 旧版单档存档，启动时自动迁入档位 1
  let activeSlot = null;                // 当前游玩的档位（1..3），标题界面为 null

  const hasRun = (i) => !!localStorage.getItem(RUN_KEY(i));          // 该档有进行中的对局
  const hasSlot = (i) => hasRun(i) || SDT.Base.hasSlot(i);           // 该档位已被创建

  function readSlot(i) {
    try { return JSON.parse(localStorage.getItem(RUN_KEY(i))); } catch (e) { return null; }
  }

  function migrateOldSave() {
    try {
      const old = localStorage.getItem(OLD_SAVE_KEY);
      if (old && !localStorage.getItem(RUN_KEY(1))) localStorage.setItem(RUN_KEY(1), old);
      localStorage.removeItem(OLD_SAVE_KEY);
    } catch (e) { /* 存储不可用时静默 */ }
  }

  function saveGame() {
    // v0.21：只有真正开局后（runActive）才写对局存档；在基地/标题界面不产生对局文件
    if (!game.runActive || game.state === 'title' || game.state === 'done' || game.state === 'boot') return;
    if (!activeSlot) return;
    syncPlayTime();
    try {
      localStorage.setItem(RUN_KEY(activeSlot), JSON.stringify({
        layerIdx: game.layerIdx, trackPos: game.trackPos,
        hp: game.hp, maxHp: game.maxHp, coins: game.coins, turn: game.turn,
        atk: game.atk, mode: game.mode, myClass: game.myClass || null,
        inventory: game.inventory, ownedCards: game.ownedCards,
        cardOrder: game.cardOrder || [],
        usedPocket: game.usedPocket,
        eventLog: game.eventLog || [],
        discovered: [...game.discoveredPairs],
        diceHistory: game.diceHistory, elapsed: game.elapsed,
        slot: activeSlot, savedAt: Date.now(),
      }));
    } catch (e) { /* 存储不可用时静默 */ }
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
    localStorage.removeItem(RUN_KEY(i));
    SDT.Base.wipe(i);
  }
  function clearSave() { if (activeSlot) localStorage.removeItem(RUN_KEY(activeSlot)); }
  function clearAllSlots() { for (let i = 1; i <= SLOT_COUNT; i++) clearSlot(i); }

  function loadGame(slot) {
    const s = readSlot(slot);
    if (!s) return false;
    SDT.Base.use(slot);   // 该档位的基地数据（仓库/熟练度/成就/卡背）
    game.runActive = true;
    setLobby(false);      // 直接回到棋盘上的对局：恢复左侧栏
    game.hp = s.hp; game.maxHp = s.maxHp || MAP.rules.playerMaxHp;
    game.atk = s.atk || MAP.rules.playerAtk;
    game.coins = s.coins; game.turn = s.turn || 1;
    game.mode = MODES[s.mode] ? s.mode : 'standard';
    game.myClass = s.myClass || null;
    applyModeRules();
    game.inventory = Array.isArray(s.inventory) ? s.inventory : [];
    game.ownedCards = Array.isArray(s.ownedCards) ? s.ownedCards : [];
    game.cardOrder = Array.isArray(s.cardOrder) ? s.cardOrder : [];
    game.usedPocket = Array.isArray(s.usedPocket) ? s.usedPocket : [];
    game.eventLog = Array.isArray(s.eventLog) ? s.eventLog : [];
    game.pendingEventLoot = null;
    game.discoveredPairs = new Set(s.discovered || []);
    game.diceHistory = s.diceHistory || [];
    game.elapsed = s.elapsed || 0;
    // 旧存档只有本局 elapsed：首次读取时把它安全迁入累计游玩时间。
    if ((SDT.Base.data.stats.playSeconds || 0) < game.elapsed) {
      SDT.Base.data.stats.playSeconds = game.elapsed;
      SDT.Base.save();
    }
    game.elapsedSynced = game.elapsed;
    enterLayer(s.layerIdx || 0, s.trackPos || 0);
    SDT.Sound.music('board');
    UI.log(`[[icon:download]] 已读取【档位 ${slot}】存档，直接回到上一局未结束的对局`, 'ok');
    if (!game.myClass) openClassChoice();   // 上次存档时还没选职业：补上开局选择
    return true;
  }

  // ---------- 标题界面 ----------
  // lobby = 非对局界面（标题/退出屏/基地）：隐藏左侧栏，画面更聚焦
  function setLobby(on) {
    document.body.classList.toggle('lobby', !!on);
    resize();   // 视口宽度变了，画布需重新适配
  }

  function showTitle() {
    game.state = 'title';
    game.path = null;
    game.runActive = false;
    activeSlot = null;
    setLobby(true);
    document.getElementById('title').hidden = false;
    document.getElementById('exitScr').hidden = true;
    SDT.Sound.music('title');
    UI.refresh(game);
  }

  function hideTitle() { document.getElementById('title').hidden = true; }

  // ---------- 存档档位选择 ----------
  // mode: 'start' = 开始/继续游戏（进入存档：有未完成对局直接续打，否则先进基地）
  //       'base'  = 从主菜单直达基地（该档有未完成对局时需先续打，不开放）
  function fmtPlayTime(seconds) {
    const sec = Math.max(0, Math.floor(+seconds || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} 小时 ${String(m).padStart(2, '0')} 分` : `${m} 分钟`;
  }

  // 档位只保留累计游玩时间与已解锁成就，避免把基地/对局细节挤在一起。
  function slotInfoHTML(baseData, run) {
    if (!baseData && !run) return '<span class="slot-empty">EMPTY SLOT · 空档位</span>';
    const total = Math.max(baseData?.stats?.playSeconds || 0, run?.elapsed || 0);
    const names = baseData
      ? SDT.Meta.ACHIEVEMENTS.filter(a => SDT.Meta.isUnlocked(a, baseData)).map(a => a.name)
      : [];
    return `<div class="si-line"><em>PLAYTIME</em>游玩时间 <b class="num">${fmtPlayTime(total)}</b></div>` +
      `<div class="si-line"><em>ACHIEVEMENTS</em>已解锁成就 <b class="num">${names.length}</b>` +
      `<span class="si-sub">${names.length ? esc(names.join('、')) : '暂无'}</span></div>`;
  }

  function openSlotPicker() {
    game.state = 'modal';
    const rows = [];
    for (let i = 1; i <= SLOT_COUNT; i++) {
      const run = readSlot(i);
      const baseData = SDT.Base.peek(i);
      const exists = !!run || !!baseData;
      let ops;
      if (!exists) {
        ops = `<button class="ov-btn ok" data-act="newSlot" data-slot="${i}">开新档 <i class="en">NEW GAME</i></button>`;
      } else {
        ops = `<button class="ov-btn ok" data-act="enterSlot" data-slot="${i}">${run ? '继续对局 <i class="en">CONTINUE</i>' : '进入存档 <i class="en">ENTER</i>'}</button>`;
        ops += ` <button class="mini-btn" data-act="overwriteSlot" data-slot="${i}">覆盖重开</button>`;
        ops += ` <button class="mini-btn danger" data-act="delSlot" data-slot="${i}">删除</button>`;
      }
      rows.push(`<div class="slot-row${exists ? ' filled' : ''}">
        <div class="slot-badge"><b>0${i}</b><span>SLOT</span></div>
        <div class="slot-info">${slotInfoHTML(baseData, run)}</div>
        <div class="slot-ops">${ops}</div>
      </div>`);
    }
    UI.registerHelp('slots', {
      title: '存档说明',
      html: `
        <p class="help-item"><b>独立存档</b>三个档位的基地与进度完全独立（资源/仓库/职业/成就/卡背各自保存）。</p>
        <p class="help-item"><b>继续对局</b>有未完成对局的档位会直接回到那一局；没有对局则先进基地，再从基地出发。</p>`,
      back: () => openSlotPicker(),
    });
    UI.showOverlay(`[[icon:archive]] 选择存档 ${UI.helpBtn('slots')}`, `
      <div class="slot-list">${rows.join('')}</div>
      <div class="ov-btns"><button class="ov-btn" data-act="slotBack">返回 <i class="en">BACK</i></button></div>`, true);
    // 进入档位：加载该档基地并执行后续（续打 / 进基地）
    const launch = (slot, fn) => {
      UI.hideOverlay();
      hideTitle();
      UI.clearLog();
      activeSlot = slot;
      SDT.Base.use(slot);
      fn();
      UI.log(`[[icon:archive]] 已进入 <b>档位 ${slot}</b>（基地与进度独立保存到该档位）`, 'sys');
    };
    // 两步确认（首次点击变为「确认？」，2.6 秒后还原）
    const armConfirm = (sel, armedText, normalText) => {
      const btn = document.querySelector(`#ovBody ${sel}`);
      if (!btn || btn.dataset.confirm) return true;
      btn.dataset.confirm = '1'; btn.textContent = armedText; btn.classList.add('arm');
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = normalText; btn.classList.remove('arm'); }
      }, 2600);
      return false;
    };
    UI.act('newSlot', (d) => launch(+d.slot, () => { SDT.Base.reset(+d.slot); openBaseHub('deploy'); }));
    UI.act('enterSlot', (d) => {
      const slot = +d.slot;
      launch(slot, () => {
        // 上一局未结束 → 直接进入未完成对局；否则先进基地
        if (readSlot(slot)) {
          if (!loadGame(slot)) { UI.log('对局存档读取失败，先回基地', 'warn'); openBaseHub('deploy'); }
        } else openBaseHub('deploy');
      });
    });
    UI.act('overwriteSlot', (d) => {
      if (!armConfirm(`[data-act="overwriteSlot"][data-slot="${d.slot}"]`, '确认重开？', '覆盖重开')) return;
      clearSlot(+d.slot);
      launch(+d.slot, () => { SDT.Base.reset(+d.slot); openBaseHub('deploy'); });
    });
    UI.act('delSlot', (d) => {
      if (!armConfirm(`[data-act="delSlot"][data-slot="${d.slot}"]`, '确认删除？', '删除')) return;
      clearSlot(+d.slot);
      UI.log(`[[icon:trash]] 已删除【档位 ${d.slot}】的存档（含基地数据）`, 'warn');
      openSlotPicker();   // 重绘档位列表
    });
    UI.act('slotBack', () => { UI.hideOverlay(); showTitle(); });
  }

  function startNewGame() { openSlotPicker(); }

  function exitToTitle() {
    if (!UI.el.overlay.hidden) return;   // 有弹窗（战斗/场景等）时不响应
    saveGame();   // 内部只在 runActive 时写档
    showTitle();
  }

  // ---------- 离开对局 / 放弃对局（v0.21 设计者规则） ----------
  // 放弃对局：带入本局的卡牌【全部】丢失；对局中获得的卡牌只有安全格里的
  // 会被宠物运回基地；物资/金币/消耗口袋全部散失。
  function openLeaveMenu() {
    game.state = 'modal';
    UI.showOverlay('[[icon:door]] 离开对局？', `
      <p class="ov-note">当前对局进度已自动保存——下次「开始游戏」进入 <b>档位 ${activeSlot}</b> 会直接继续这场对局。</p>
      <p class="ov-note" style="color:#f0b9ae">[[icon:question]] 若选择<b>放弃对局</b>：带入本局的卡牌<b>全部丢失</b>；
        对局中获得的卡牌只有存入<b>安全格</b>的会被宠物运回基地；物资与金币全部散失。</p>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="leaveSave">[[icon:save]] 保存并回主菜单</button>
        <button class="ov-btn danger" data-act="leaveAbandon">[[icon:flag]] 放弃对局</button>
        <button class="ov-btn" data-act="leaveCancel">↩ 继续对局</button>
      </div>`);
    UI.act('leaveSave', () => { UI.hideOverlay(); game.state = 'idle'; saveGame(); showTitle(); });
    UI.act('leaveCancel', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
    UI.act('leaveAbandon', () => {
      const btn = document.querySelector('#ovBody [data-act="leaveAbandon"]');
      if (btn && !btn.dataset.confirm) {
        btn.dataset.confirm = '1'; btn.textContent = '确认放弃？（卡牌将全部丢失）'; btn.classList.add('arm');
        setTimeout(() => {
          if (btn.isConnected) { delete btn.dataset.confirm; btn.innerHTML = `${SDT.Icons.img('flag')} 放弃对局`; btn.classList.remove('arm'); }
        }, 2600);
        return;
      }
      abandonRun();
    });
  }

  function abandonRun() {
    syncPlayTime();
    game.state = 'done';
    game.runActive = false;
    clearSave();
    SDT.Sound.sfx('defeat');
    SDT.Sound.music('title');
    // 带入本局的卡牌全部丢失（即使放进了安全格）；获得的卡只有安全格里的被宠物运回
    const kept = game.ownedCards.filter(o => o.safe && !o.brought);
    if (kept.length) SDT.Base.depositCards(kept.map(o => ({ card: o.card, count: 1 })));
    const broughtN = game.ownedCards.filter(o => o.brought).length;
    const keptMap = new Map();
    kept.forEach(o => {
      const k = o.card.name;
      if (!keptMap.has(k)) keptMap.set(k, { card: o.card, count: 0 });
      keptMap.get(k).count++;
    });
    const keptList = [...keptMap.values()];
    UI.log('<b>[[icon:flag]] 已放弃对局</b>：带入的卡牌全部遗失，物资与金币散失', 'warn');
    const keptHTML = keptList.length
      ? `<p class="ov-note">[[icon:lock]] 宠物从安全格抢运回 <b>${kept.length}</b> 张对局中获得的卡牌：` +
        keptList.map(s => `${esc(s.card.name)}${s.count > 1 ? ' ×' + s.count : ''}`).join('、') + '</p>'
      : '<p class="ov-note">安全格里没有对局中获得的卡牌——本次放弃没有带回任何卡牌。</p>';
    UI.showOverlay('[[icon:flag]] 已放弃对局', `
      <p class="ov-stats">带入本局的 <b>${broughtN}</b> 张卡牌全部丢失；对局中获得的卡牌除安全格保护的外也全部失去；
        物资与 <b class="gold">${game.coins} 币</b>一并散失。</p>
      ${keptHTML}
      <div class="ov-btns">
        <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
        <button class="ov-btn ok" data-act="toTitle">[[icon:archive]] 回主菜单</button>
      </div>`);
    UI.act('goBase', () => { UI.hideOverlay(); openBaseHub('deploy'); });
    UI.act('toTitle', () => { UI.hideOverlay(); showTitle(); });
    UI.refresh(game);
  }

  function quitGame() {
    saveGame();
    if (window.sdtDesktop && window.sdtDesktop.isDesktop) {
      window.sdtDesktop.quit(); // 桌面版：存档已保留，真正退出程序
      return;
    }
    document.getElementById('title').hidden = true;
    document.getElementById('exitScr').hidden = false;
    // 网页版无法真正关闭程序：显示告别屏即可（存档已保留，可重新进入继续）
  }

  // ---------- 设置（标题界面调用） ----------
  function openSettings() {
    const prev = game.state;
    game.state = 'modal';
    UI.showOverlay('', `
      <div class="pg settings-page">
        <button class="pg-close" data-act="closeSettings" title="关闭（点此返回）">[[icon:cross]]</button>
        <header class="pg-head"><h2>[[icon:gear]] 设置</h2><span class="pg-spacer"></span></header>
        <div class="settings">
        <h3 class="set-h">[[icon:gear]] 通用 <span class="set-en">GENERAL</span></h3>
        <label class="chk"><input type="checkbox" id="setIndex" ${game.toggles.index ? 'checked' : ''}> 结点编号 <span class="set-en">NODE NUMBERS</span></label>
        <label class="chk"><input type="checkbox" id="setHint" ${localStorage.getItem('sdt-hintbar') !== '0' ? 'checked' : ''}> 底部操作提示条 <span class="set-en">HINT BAR</span></label>
        <label class="chk"><input type="checkbox" id="setBanner" ${localStorage.getItem('sdt-banner') !== '0' ? 'checked' : ''}> 环层横幅 <span class="set-en">LAYER BANNER</span></label>
        <label class="chk"><input type="checkbox" id="setDev" ${game.devMode ? 'checked' : ''}> 开发者模式（固定骰子 / 卡牌制作） <span class="set-en">DEVELOPER</span></label>
        <h3 class="set-h">[[icon:gear]] 音频 <span class="set-en">AUDIO</span></h3>
        <label class="chk"><input type="checkbox" id="setMusic" ${SDT.Sound.musicMuted ? '' : 'checked'}> 背景音乐 <span class="set-en">MUSIC</span></label>
        <label class="chk vol"><span>音乐音量 <span class="set-en">MUSIC VOL</span></span><input type="range" id="setMusicVol" min="0" max="100" value="${Math.round(SDT.Sound.musicVolume * 100)}"><b id="setMusicVolVal">${Math.round(SDT.Sound.musicVolume * 100)}</b></label>
        <label class="chk"><input type="checkbox" id="setSfx" ${SDT.Sound.sfxMuted ? '' : 'checked'}> 音效 <span class="set-en">SOUND FX</span></label>
        <label class="chk vol"><span>音效音量 <span class="set-en">SFX VOL</span></span><input type="range" id="setSfxVol" min="0" max="100" value="${Math.round(SDT.Sound.sfxVolume * 100)}"><b id="setSfxVolVal">${Math.round(SDT.Sound.sfxVolume * 100)}</b></label>
        <p class="hint">侧边栏的 [[icon:gear]] 按钮为全局静音；这里可分别开关音乐与音效、拖动滑条调音量（自动保存）。</p>
        <h3 class="set-h">危险区 <span class="set-en">DANGER ZONE</span></h3>
        <div class="btn-row">
          <button class="mini-btn danger" data-act="wipeNotes">清空格子备注</button>
          <button class="mini-btn danger" data-act="wipeCards">清空卡牌库</button>
          <button class="mini-btn danger" data-act="wipeSave">清空全部存档</button>
        </div>
        <div class="ov-btns"><button class="ov-btn ok" data-act="closeSettings">返回</button></div>
        </div><!-- /.settings -->
      </div><!-- /.pg -->`, 'page');
    const sync = () => {
      if (UI.el.tglIndex) UI.el.tglIndex.checked = game.toggles.index;
      UI.el.devTools.hidden = !game.devMode;
    };
    // 危险操作两步确认：首次点击变为「确认？」，2.6 秒后还原
    const armDanger = (act, armedText) => {
      const btn = document.querySelector(`#ovBody [data-act="${act}"]`);
      if (!btn || btn.dataset.confirm) return true;
      const normal = btn.textContent;
      btn.dataset.confirm = '1'; btn.textContent = armedText; btn.classList.add('arm');
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = normal; btn.classList.remove('arm'); }
      }, 2600);
      return false;
    };
    UI.act('wipeNotes', (d, btn) => {
      if (!armDanger('wipeNotes', '确认清空？')) return;
      SDT.Notes.clearAll(); rebuildNotes(); UI.log('已清空全部格子备注', 'warn');
    });
    UI.act('wipeCards', () => {
      if (!armDanger('wipeCards', '确认清空？')) return;
      SDT.Cards.clearAll(); UI.log('已清空卡牌库', 'warn');
    });
    UI.act('wipeSave', () => {
      if (!armDanger('wipeSave', '确认清空全部？')) return;
      clearAllSlots(); UI.log('已清空全部三个档位的存档', 'warn');
    });
    UI.act('closeSettings', () => { UI.hideOverlay(); game.state = prev === 'modal' ? 'idle' : prev; });
    // 勾选即时生效并同步侧边栏
    document.getElementById('setIndex').addEventListener('change', (e) => { game.toggles.index = e.target.checked; sync(); });
    // 提示条 / 环层横幅开关（随 localStorage 持久化）
    document.getElementById('setHint').addEventListener('change', (e) => {
      localStorage.setItem('sdt-hintbar', e.target.checked ? '1' : '0');
      document.body.classList.toggle('no-hintbar', !e.target.checked);
    });
    document.getElementById('setBanner').addEventListener('change', (e) => {
      localStorage.setItem('sdt-banner', e.target.checked ? '1' : '0');
      document.body.classList.toggle('no-banner', !e.target.checked);
    });
    document.getElementById('setDev').addEventListener('change', (e) => {
      game.devMode = e.target.checked;
      localStorage.setItem('sdt-dev', e.target.checked ? '1' : '0');
      UI.el.devTools.hidden = !game.devMode;
    });
    // 音乐 / 音效独立开关（即时生效，随 localStorage 持久化）
    document.getElementById('setMusic').addEventListener('change', (e) => {
      SDT.Sound.setMusicMuted(!e.target.checked);
      if (!e.target.checked) SDT.Sound.sfx('ding');
    });
    document.getElementById('setSfx').addEventListener('change', (e) => {
      SDT.Sound.setSfxMuted(!e.target.checked);
      SDT.Sound.sfx('ding');   // 开启时给一声反馈（关闭时无感）
    });
    // 音乐 / 音效音量滑条（拖动即时生效；松手播一声试听音效）
    const musicVolEl = document.getElementById('setMusicVol');
    const sfxVolEl = document.getElementById('setSfxVol');
    musicVolEl.addEventListener('input', (e) => {
      SDT.Sound.setMusicVolume(+e.target.value / 100);
      document.getElementById('setMusicVolVal').textContent = e.target.value;
    });
    sfxVolEl.addEventListener('input', (e) => {
      SDT.Sound.setSfxVolume(+e.target.value / 100);
      document.getElementById('setSfxVolVal').textContent = e.target.value;
    });
    sfxVolEl.addEventListener('change', () => SDT.Sound.sfx('ding'));
  }

  // ---------- 流程 ----------
  const newUid = () => 'o' + Date.now().toString(36) +
    Math.floor(Math.random() * 46656).toString(36) + Math.floor(Math.random() * 1296).toString(36);

  // 每局开始：固定携带 5 张初始牌「初始攻击」（同名堆叠，只占 1 格背包）
  // brought=1：开局带入的卡（放弃对局时无条件丢失，v0.21 规则）
  function grantStarterSha() {
    const sha = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
    for (let i = 0; i < MAP.rules.starterSha; i++) {
      game.ownedCards.push({ uid: newUid(), card: { ...sha }, brought: 1 });
    }
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
    game.mode = MODES[mode] ? mode : 'standard';
    applyModeRules();
    game.runActive = true;    // v0.21：从这一刻起才写对局存档
    setLobby(false);          // 进入棋盘：恢复左侧栏
    game.inventory = [];
    game.ownedCards = [];
    game.cardOrder = [];
    game.usedPocket = [];
    game.eventLog = [];
    game.pendingEventLoot = null;
    game.myClass = null;
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
    SDT.Sound.music('board');   // 出发：切入行军氛围
    FX.clear();
    UI.clearLog();
    UI.log(`欢迎来到<b>代号7</b>：本次玩法【<b>${modeCfg().name}</b>】——${modeCfg().ckpt}`, 'sys');
    UI.log('掷骰环走，落脚触发事件；外环闸门可撤离，深处有污染核心与变异首脑', 'sys');
    grantStarterSha();
    UI.log(`[[icon:cards]] 随身携带初始牌【<b>初始攻击</b>】×${MAP.rules.starterSha}（固定携带 · 不可入库 / 安全格）`, 'sys');
    applyDeployPicks(picks);    // 出发准备页选择的仓库卡牌
    const reserve = SDT.Base.takeReserveCoins();
    if (reserve) {
      game.coins += reserve;
      UI.log(`[[icon:coin]] 带上基地储备 <b>${reserve}</b> 币（卖出仓库物品所得）`, 'coin');
    }
    // 随机入口出生
    const l1 = MAP.layers[0];
    const k = Math.floor(Math.random() * l1.entrances.length);
    UI.log(`[[icon:dice]] 随机出生在 <b>${l1.entranceNames[k]}</b>`, 'sys');
    enterLayer(0, l1.entrances[k]);
    openClassChoice();   // 开局二选一职业 + 1 张随机职业卡（与 5 张初始攻击一起）
  }

  function enterLayer(li, atIdx) {
    game.layerIdx = li;
    game.trackPos = atIdx;
    game.pos = cellCenter(li, atIdx);
    game.hop = 0;
    game.state = 'idle';
    if (cam) { cam.cx = game.pos.x; cam.cy = game.pos.y; cam.clamp(); }
    const f = curLayer();
    const eIdx = f.entrances.indexOf(atIdx);
    const eName = eIdx >= 0 ? f.entranceNames[eIdx] : `#${atIdx} 格`;
    UI.log(`—— 置身 <b>${f.name}</b>（${eName}）——`, 'sys');
    saveGame();
    UI.refresh(game);
  }

export { FX, MAP, MODES, SLOT_COUNT, bagCap, buildDerived, cam, canvas, cardStacks, cellCenter, clearSave, ctx, curLayer, doDeath, dpr, safeCap, enterLayer, exitToTitle, gainCoins, game, hasRun, migrateOldSave, modeCfg, newRun, newUid, openSettings, pick, quitGame, rndDice, safeUsed, saveGame, scaledEnemy, setLobby, showTitle, startNewGame, syncPlayTime, usedSlots, weighted };
const _set_dpr = (v) => { dpr = v; };
export { _set_dpr };
const _set_cam = (v) => { cam = v; };
export { _set_cam };
