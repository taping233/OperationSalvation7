import { CHARACTERS, characterFor, characterName } from './characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { FX, MAP, bagCap } from './game.session.js';
import { tone } from './sound.js';
import { escAttr } from './shared.js';
import { cellCenter, clearSave, curLayer, enterLayer, exitToTitle, gainCoins, game, markSeen, modeCfg, newUid, pick, saveGame, scaledEnemy, syncPlayTime, usedSlots, weighted } from './game.session.js';
import { openBaseHub } from './game.hub.js';
import { Sfx, cardHTML, _set_cardPageOpen } from './game.cardslib.js';
import { CLASS_STORY, EVENT_SCENE_META, IMMEDIATE_SCENES, NODE_BG, PICKUP_BG, PRELOAD_SCENES, SCENES, SCENE_META } from './game.run.data.js';
import { createShopController } from './game.run.shop.js';
import { Random } from './random.js';
import { eventNarrative } from './narrative.js';
  const { openShop } = createShopController({
    UI,
    SDT,
    game,
    bagCap,
    cardHTML,
    newUid,
    saveGame,
    setCardPageOpen: _set_cardPageOpen,
    usedSlots,
  });
  // 直接选择相邻节点，不再掷骰或消耗行动力。
  // 移动是一个原子事务：开始时只进入 moving，稳定节点/回合/事件结算均在
  // 动画完成后一次性提交。这样刷新或退出不会把角色保存在线段中间。
  let moveSeq = 0;
  let activeMove = null;
  const MOVE_DURATION = 220;
  const moveUsesReducedMotion = () => {
    try { return localStorage.getItem('sdt-reduce-motion') === '1' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }
    catch (_) { return false; }
  };
  function moveTo(toLi, toIdx) {
    if (game.state !== 'idle' || activeMove) return false;
    const current = curLayer()?.logical[game.trackPos];
    const allowed = current?.next || [];
    if (!allowed.some(([li, idx]) => li === toLi && idx === toIdx)) return false;
    const fromLi = game.layerIdx, fromIdx = game.trackPos;
    const from = cellCenter(fromLi, fromIdx);
    const to = cellCenter(toLi, toIdx);
    if (!from || !to) return false;

    const seq = ++moveSeq;
    const startedAt = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    let done = false;
    let watchdog = null;
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb) => setTimeout(() => cb(Date.now()), 16);
    const finish = () => {
      if (done || !activeMove || activeMove.seq !== seq) return;
      done = true;
      if (watchdog != null) clearTimeout(watchdog);
      activeMove = null;
      game.pos = { ...to };
      game.layerIdx = toLi;
      game.trackPos = toIdx;
      markSeen(toLi, toIdx);
      game.hop = 0;
      game.moveTarget = null;
      game.turn++;
      game.activeLayerBounds = game.layerBounds?.[toLi] || null;
      game.geometryVersion = game.geometryVersion || `${String(game.mapSeed)}:${game.layoutVersion || 0}`;
      SDT.Meta.track('action');
      resolveCell();
    };
    const tick = (now) => {
      if (done || !activeMove || activeMove.seq !== seq) return;
      const t = Math.max(0, Math.min(1, ((now || Date.now()) - startedAt) / MOVE_DURATION));
      const eased = 1 - Math.pow(1 - t, 3);
      game.pos = { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
      game.moveTarget.progress = t;
      if (t >= 1) finish();
      else frame(tick);
    };
    activeMove = { seq, from: { li: fromLi, idx: fromIdx }, to: { li: toLi, idx: toIdx }, startedAt };
    game.moveTarget = { li: toLi, idx: toIdx, seq, progress: 0, moving: true };
    game.state = 'moving';
    game.pos = { ...from };
    // rAF 在后台页可能被暂停；看门狗确保事务最终回到稳定节点。
    watchdog = setTimeout(finish, MOVE_DURATION + 700);
    if (moveUsesReducedMotion()) finish();
    else frame(tick);
    return true;
  }

  function cancelLegacyChainMove(reason = '即时事件不再自动跳转') {
    const steps = Math.max(0, Number(game.chainMove) || 0);
    if (!steps) return false;
    game.chainMove = 0;
    UI.log(`[[icon:road]] ${reason}（原计划前进 ${steps} 格）`, 'sys');
    return true;
  }

  // ---------- 落脚结算 ----------
  // ---------- 场景演出（v0.10：不同格子进入不同场景，少量对话后开启内容） ----------
  let scenePreload = null;
  function preloadScene(name) {
    if (!name || (scenePreload && scenePreload.name === name)) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = name;
    scenePreload = { name, img };
    if (img.decode) img.decode().catch(() => {});
  }
  function preloadCellScene(layer, idx) {
    const cell = layer.logical[idx];
    const cellType = cell && cell.def && cell.def.type;
    const door = (layer.doors || []).some(d => d.at === idx);
    const altar = (layer.altarEntrances || []).some(a => a.at === idx);
    const immediate = IMMEDIATE_SCENES.has(cellType);
    const type = immediate ? cellType : door ? 'door' : altar ? 'altar' : cellType;
    preloadScene(PRELOAD_SCENES[type]);
  }
  // 开局一次性预载全部整页背景（nodeShell 的 NODE_BG + 预载表）：
  // 这些 webp 若等 CSS background-image 打开页面才请求，大图加载期间整页近乎黑屏（2026-09-09 实测反馈）
  const _preloaded = new Set();
  function preloadSceneList(urls) {
    urls.forEach(url => {
      if (!url || _preloaded.has(url)) return;
      _preloaded.add(url);
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      if (img.decode) img.decode().catch(() => {});
    });
  }
  function preloadAllNodeShellBgs() {
    preloadSceneList(Object.values(PRELOAD_SCENES));
    // NODE_BG 存的是 asset-key，实际 URL 与 PRELOAD_SCENES 同图（见 css/scenes.css 映射），上面已覆盖
  }
  let sceneState = null;

  // ---------- 全屏节点页外壳：杀戮尖塔式——整屏场景背景图，标题与选项虚化在右侧毛玻璃面板 ----------
  // o = { tone: 场景分色(sc-*), icon, title, sub, body, foot, asset: 背景图 asset-key（缺省按 tone 映射） }
  function nodeShell(o) {
    const bg = o.asset || NODE_BG[o.tone] || '';
    UI.showOverlay('', `
      <div class="pg node-pg sc-${o.tone}"${bg ? ` data-asset-key="${escAttr(bg)}"` : ''}>
        <div class="node-panel">
          <header class="pg-head">
            <h2>${o.icon} ${o.title}</h2>
            ${o.sub ? `<span class="sub">${o.sub}</span>` : ''}
          </header>
          <div class="node-main">${o.body}</div>
          ${o.foot ? `<footer class="node-foot">${o.foot}</footer>` : ''}
        </div>
      </div>`, 'page');
  }
  // 杀戮尖塔式选项条：主标题 + 后果说明（复用事件页 .evt-opt 样式）
  function nodeOpt(act, label, detail, tone = '', extra = '') {
    return `<button class="evt-opt ${tone}" data-act="${act}" ${extra}><b>${label}</b>${detail ? `<span>${detail}</span>` : ''}</button>`;
  }

  // 打开场景：对话展示 →（点击任意处继续）→ onDone 开启真正内容
  // opts.foes = 遭遇敌人数组：战斗场景展示统一位图敌人立绘。
  // opts.gain = 明确结算文案（如「+2 币」）：拾取类格子用大字告知玩家获得了什么
  function openScene(kind, opts = {}) {
    const f = SCENES[kind];
    if (!f) { if (opts.onDone) opts.onDone(); return; }
    game.state = 'modal';
    Sfx.tick();
    SDT.Sound.sfx('scene');
    sceneState = { onDone: opts.onDone || null };
    const text = pick(f.lines).replace('{name}', opts.name || '不速之客');
    const artHTML = opts.foes && opts.foes.length
      ? `<div class="scene-foes">${opts.foes.map(foe =>
          `<div class="art scene-foe-art" data-foe-id="${escAttr(foe.id || foe.name)}" title="${escAttr(foe.name)}">${SDT.Art.monsterArt(foe.id)}</div>`).join('')}</div>`
      : `<div class="scene-art"><span>${f.icon}</span></div>`;
    const meta = opts.sceneMeta || SCENE_META[kind] || [kind, `scene-${kind}`, `scene-${kind}`];
    UI.showOverlay('', `
      <div class="scene sc-${f.tone} ${meta[1]}" data-act="sceneNext" data-scene-id="${escAttr(meta[0])}" data-asset-key="${escAttr(meta[2])}">
        <div class="scene-glow"></div>
        ${artHTML}
        <h2 class="scene-title">${f.title}</h2>
        ${opts.gain ? `<div class="scene-gain"><b>${opts.gain}</b></div>` : ''}
        <div class="scene-line"><p>${esc(text)}</p></div>
        <div class="scene-ops">${f.auto ? '' :
          `<button class="ov-btn ok" data-act="sceneGo">${opts.btn || f.btn || '继 续'}</button>`}</div>
        <p class="scene-hint">[[icon:sparkles]] 点击任意处继续 [[icon:sparkles]]</p>
      </div>`, 'scene');
    UI.act('sceneNext', () => finishScene());
    UI.act('sceneGo', () => finishScene());
    UI.refresh(game);
  }
  function finishScene() {
    if (!sceneState) return;
    const cb = sceneState.onDone;
    sceneState = null;
    UI.hideOverlay();
    if (cb) cb();
  }

  // 节点与战斗结算之间的短过场：复用现有场景美术，不引入额外资源或阻塞式页面。
  function showRunTransition({ tone = 'battle', asset = 'scene-battle-bg', eyebrow = 'AREA ENTERED', title, detail = '', duration = 900 }) {
    // 结束时必须恢复状态：战斗/节点流程下游会自行改状态，但「继续对局」路径
    // 过渡后无人收拾，曾导致 game.state 卡死在 modal、骰子按钮永久禁用
    const prevState = game.state;
    game.state = 'modal';
    return new Promise(resolve => {
      let done = false;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        UI.hideOverlay();
        // 战斗 modal 态（Battle.restore 置位）不得降级为 idle，否则战斗界面丢失且移动锁死
        game.state = (prevState === 'modal' && !game.battleActive) ? 'idle' : prevState;
        resolve();
      };
      UI.showOverlay('', `
        <div class="scene flow-transition sc-${escAttr(tone)}" data-asset-key="${escAttr(asset)}" data-act="flowContinue">
          <div class="flow-scan" aria-hidden="true"></div>
          <p class="flow-eyebrow">${esc(eyebrow)}</p>
          <h2 class="flow-title">${esc(title || '未知区域')}</h2>
          ${detail ? `<p class="flow-detail">${esc(detail)}</p>` : ''}
          <div class="flow-line" aria-hidden="true"><i></i></div>
          <p class="flow-hint">点击跳过</p>
        </div>`, 'scene');
      UI.act('flowContinue', finish);
      timer = setTimeout(finish, duration);
      UI.refresh(game);
    });
  }

  function enterNode(kind, done) {
    const transitions = {
      battle: { tone: 'battle', asset: 'scene-battle-bg', eyebrow: 'HOSTILE CONTACT', title: '遭遇敌袭', detail: '武器解锁 · 准备接敌' },
      door: { tone: 'door', asset: 'scene-door-bg', eyebrow: 'GATE SIGNAL', title: '抵达大门', detail: '环层通路正在响应' },
      altar: { tone: 'altar', asset: 'scene-altar-bg', eyebrow: 'CONTAMINATION DETECTED', title: '污染核心', detail: '高危生命信号逼近' },
      emergencyExit: { tone: 'exit', asset: 'scene-extract-bg', eyebrow: 'EXTRACTION POINT', title: '紧急撤离点', detail: '撤离信标已经接通' },
      shop: { tone: 'shop', asset: 'scene-shop-bg', eyebrow: 'CARAVAN SIGNAL', title: '拾荒商队', detail: '交易频道已经开放' },
    };
    return showRunTransition(transitions[kind] || { title: '进入节点' }).then(done);
  }

  // 场景/即时效果结束后的收尾：事件连锁移动优先，否则回待机并存档
  function finishInstant() {
    if (game.chainMove) {
      cancelLegacyChainMove();
    }
    game.state = 'idle';
    saveGame();
    UI.refresh(game);
  }

  // 拾取页：杀戮尖塔式右栏——拾获叙事 + 大字收益 + 继续按钮
  // 搜索物资（2026-09-09 老板 #3）：收获不再直接蹦出来——先演一段搜索（提灯扫过 + 进度条填充），
  // 约 0.95s 后揭晓收获大字与「继续」按钮，给拾取一个过程感
  const PICKUP_SEARCH_MS = 950;
  function openPickupPage(kind, gain, onDone) {
    const f = SCENES[kind];
    nodeShell({ tone: 'pickup', asset: PICKUP_BG[kind], icon: f.icon, title: f.title,
      sub: pick(f.lines),
      body: `<div class="pick-search">
          <span class="ps-lantern">[[icon:lantern]]</span>
          <span class="ps-ground"><i></i></span>
          <p class="ps-tip">正在搜索物资…</p>
        </div>` });
    SDT.Sound.sfx('pick');
    const main = UI.el.ovBody.querySelector('.node-main');
    setTimeout(() => {
      if (!main || !main.isConnected) return;   // 页面已被换掉/关掉就不再揭晓
      main.innerHTML = `<p class="gain-big">${gain}</p>
        <button class="evt-opt ok" data-act="pickupGo"><b>继 续</b></button>`;
      SDT.Sound.sfx('gain');
      const go = main.querySelector('[data-act="pickupGo"]');
      if (go) go.focus({ preventScroll: true });
    }, PICKUP_SEARCH_MS);
    UI.act('pickupGo', () => { UI.hideOverlay(); onDone(); });
  }

  // ---------- 遭遇组建（设计者 2026-09-02 定版：按环层抽怪，1-3 只，越内层越强） ----------
  function buildEncounter(layerIdx) {
    const enc = MAP.encounters[layerIdx] || MAP.encounters[0];
    let pool, size;
    let strategy = enc.strategy || '';
    let risk = enc.risk || '中';   // 风险等级随层写在 encounters 表里
    // 2026-09-10 玩法定版：每层每种敌人有固定数量区间（一律落在 1~3 只，如 2-3 只），
    // 区间内每个数量等概率生成（MAP.rollCount）；巨兽「荒渊」按层概率刷出（第 3 层 3%、第 4 层 10%），固定单体。
    if (enc.elite && Random.random('enemy') < enc.elite.chance) {
      pool = enc.elite.pool; size = enc.elite.size; strategy = enc.elite.strategy || strategy; risk = '精英';
    } else {
      const entries = enc.entries || [];
      const ent = entries[Math.floor(Random.random('enemy') * entries.length)] || entries[0];
      pool = ent ? [ent.id] : [];
      size = ent ? ent.size : [1, 1];
    }
    const n = MAP.rollCount ? MAP.rollCount(size, () => Random.random('enemy')) : size[0] + Math.floor(Random.random('enemy') * (size[1] - size[0] + 1));
    const list = [];
    for (let i = 0; i < n; i++) {
      const tpl = MAP.monsters[pool[Math.floor(Random.random('enemy') * pool.length)]];
      list.push(scaledEnemy({ ...tpl }));
    }
    // 元数据不参与战斗结算，仅用于战前预告和战斗内提示；旧敌人对象仍保持原字段。
    list.risk = risk;
    list.strategy = strategy;
    return list;
  }

  function resolveCell() {
    const layer = curLayer(), idx = game.trackPos;
    const lc = layer.logical[idx];
    const def = lc ? lc.def : undefined;
    const door = (layer.doors || []).find(d => d.at === idx);
    const altarE = (layer.altarEntrances || []).find(a => a.at === idx);

    // 一次性内容防重刷（2026-09-09 玩法定版：任何格子只能触发一次）：
    // 战斗/宝箱/拾取/事件/火堆/商店/祭坛/首脑结算过一次就标记，回头路再次踏入只提示不重触发。
    // 仍可通行/使用的格：门/紧急撤离/终局撤离（通路）、空白格。
    // 走过的格子会在地图上标绿（renderer 按 visited 绘制）。
    game.visited = game.visited || {};
    const vKey = game.layerIdx + ',' + idx;
    const repeatable = !def || door || altarE ||
      ['emergencyExit', 'extraction'].includes(def.type);
    if (game.visited[vKey] && !repeatable) {
      UI.log('[[icon:road]] 这里已经来过了——能拿的都拿走了，什么也没有。', 'sys');
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
      return;
    }
    // 祭坛格：踩上不锁定，激活（或用碎片兑换）成功后才算触发过；
    // 首脑格：编组/战斗前也不锁定——放弃编组可再来，只有击败首脑后才消耗本格。
    const ritualPending = def && (def.type === 'altar' || def.type === 'boss');
    if (!ritualPending) game.visited[vKey] = 1;

    // 杀戮尖塔式房间切换：从落脚开始到本格全部结算完成，地图始终由全屏房间页取代。
    UI.beginRoom();

    // 落点脉冲（按事件类型着色）
    const PULSE_COL = { coin: '#f5c542', chest: '#f5c542', key: '#f5c542', fire: '#f2854a',
      shop: '#52d273', battle: '#ff6b5e', rations: '#7fdd9c', wood: '#c8956a',
      event: '#41d0a8', emergencyExit: '#52d273', altar: '#b77ad8', boss: '#ff6b5e' };
    FX.pulse(game.pos.x, game.pos.y, PULSE_COL[def && def.type] || '#d8b46a');

    // 1) 战斗格：先给出短暂接敌过场，再进入遭遇战。
    if (def && def.type === 'battle') {
      const encounter = buildEncounter(game.layerIdx);
      enterNode('battle', () => openBattleCell(def, encounter));
      return;
    }

    // 2) 即时效果类（币/木材/宝箱/口粮/钥匙/火堆/事件）：拾取或场景演出后再继续
    const INSTANT_TYPES = ['coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event'];
    if (def && INSTANT_TYPES.includes(def.type)) {
      runInstant(def, () => {
        // 即时效果完成 → 本格若兼为节点（如带商店的门、祭坛入口）继续节点演出
        if (door) { enterNode('door', () => openDoorModal(door, def)); return; }
        finishInstant();
      });
      return;
    }

    // 2.5) 事件卡连锁移动（保留兜底：时空孔隙「前进 6 格」）
    if (game.chainMove) {
      cancelLegacyChainMove('即时事件不会盲选第一条邻边');
    }

    // 3) 节点类：门 / 祭坛 / 首脑 / 紧急撤离 / 商店统一经过短过场。
    if (door) { enterNode('door', () => openDoorModal(door, def)); return; }
    if (def && def.type === 'door') { finishInstant(); return; }
    if (def && def.type === 'altar') { enterNode('altar', openAltarRitual); return; }
    if (def && def.type === 'boss') { enterNode('boss', openBossGate); return; }
    if (def && (def.type === 'emergencyExit' || def.type === 'extraction')) { enterNode('emergencyExit', openEmergencyModal); return; }
    if (def && def.type === 'shop') { enterNode('shop', openShop); return; }

    // 4) 空白安全格（无任何事件）：给完整提示页（2026-09-06 留言）
    if (!def) { openBlankSafePage(); return; }

    game.state = 'idle';
    saveGame();
    UI.refresh(game);
  }

  // 空白安全节点提示页：明确告诉玩家这格无事发生（背景图后续再补）
  function openBlankSafePage() {
    game.state = 'modal';
    nodeShell({
      tone: 'safe', icon: '[[icon:check]]', title: '安全地带',
      sub: '空白的安全节点',
      body: `<div class="blank-safe-gain">
        <p class="gain-big">无事发生</p>
        <p class="ov-note">四周静悄悄的——这里没有埋伏，也没有拾获。整理一下背包，准备继续深入。</p>
      </div>`,
      foot: `<button class="ov-btn ok fire-done-btn" data-act="blankSafeDone"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 继续旅程</button>`,
    });
    UI.act('blankSafeDone', () => { UI.hideOverlay(); finishInstant(); });
  }

  // 战斗格 → 遭遇战（encounter 已在场景前组建好传入，保证场景与战斗一致）
  function openBattleCell(def, encounter) {
    game.state = 'modal';
    const list = encounter || buildEncounter(game.layerIdx);
    SDT.Battle.start(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
      risk: list.risk, strategy: list.strategy });
  }

  // 宝箱格 / 事件卡开真宝箱：开完回待机并存档（场景演出后由本函数自行收尾）
  function openChestsOnCell(chests, text) {
    UI.log(`[[icon:archive]] ${text || '回收了' + SDT.Chests.dropText(chests)}`, 'loot');
    SDT.Chests.open(game, chests, () => {
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
    });
  }

  // 即时效果（经场景演出后结算）；after = 效果完成后的续流回调
  // 拾取类在场景里用大字标明结算（v0.22：明确告诉玩家发生了什么）
  function runInstant(def, after) {
    const done = after || finishInstant;
    switch (def.type) {
      case 'coin': {
        // 金币格收益 -1（2026-09-06 设计者定版）；展示与入账同口径（含玩法倍率）
        const base = Math.max(1, (def.n || 1) - 1);
        const n = Math.max(1, Math.round(base * (modeCfg().coinMul || 1)));
        openPickupPage('coin', `+${n} 币`, () => { gainCoins(base); done(); });
        break;
      }
      case 'wood': {
        // 2026-09-06 #11：资源格改为把「木材」以卡牌形式入包（可拖动/点击）
        const card = SDT.Cards.all().find(c => c.id === 'tt-wood');
        const cnt = def.n || 1;
        openPickupPage('wood', `木材卡 ×${cnt}`, () => {
          for (let i = 0; i < cnt && card; i++) game.grantCard(card);
          done();
        });
      } break;
      // 物资格（露天宝箱格，2026-09-09 玩法定版）：70% 小宝箱（随机 1 张）/ 30% 中宝箱（3 选 1）
      case 'chest': openChestsOnCell([Random.random('loot') < 0.7 ? { kind: 'small' } : { kind: 'medium' }]); break;
      case 'rations': {
        // 2026-09-06 #11：口粮同样以卡牌形式入包
        const card = SDT.Cards.all().find(c => c.id === 'tt-rations');
        const cnt = MAP.items.rations.count || 1;
        openPickupPage('rations', `口粮卡 ×${cnt}`, () => {
          for (let i = 0; i < cnt && card; i++) game.grantCard(card);
          done();
        });
      } break;
      case 'key': {
        // 2026-09-09 老板 #1：物资点资源一律以卡牌形式入包（钥匙与木材/口粮同口径）
        const card = SDT.Cards.all().find(c => c.id === 'tt-key');
        openPickupPage('key', `钥匙卡 ×1`, () => {
          if (card) game.grantCard(card);
          done();
        });
      } break;
      case 'fire':
        openFireRest();   // 火堆：回 10 血 + 消耗口袋复原 2 张 + 30% 额外职业卡
        break;
      case 'event': {
        runEventDeck(); done();   // 事件：直接进事件页（选项在右侧）
        break;
      }
      default: done(); break;
    }
  }

  // ---------- 事件卡（第六批桌游事件：只能经事件格触发，背包记录触发历史） ----------
  // 事件卡池 = 卡牌库中类型「事件」的卡；卡牌库无事件卡时退回旧随机事件表。
  function runEventDeck() {
    const deck = SDT.Cards.all().filter(c => c.type === '事件');
    if (!deck.length) {
      const ev = weighted(MAP.randomEvents);
      if (ev.coins) { UI.log(`【事件】${ev.text}`, 'sys'); gainCoins(ev.coins[0] + Math.floor(Random.random('event') * (ev.coins[1] - ev.coins[0] + 1))); }
      else if (ev.item) { UI.log(`【事件】${ev.text}`, 'sys'); game.addItem(pick(MAP.chestTable)); }
      else UI.log(`【事件】${ev.text}`, 'dim');
      return;
    }
    triggerEventCard(pick(deck));
  }

  // 把库里的卡发给玩家（同名堆未满并入现有格；堆满或新卡需要空格——叠放上限见 game.session #7；
  // 珍珠盒扩出来的格子只收资源卡——canAcceptCard 统一判定，Q5 老板定向）
  function grantEventCard(tpl) {
    if (!tpl) return false;
    const canReceive = game.canReceiveCard
      ? game.canReceiveCard(tpl)
      : (game.ownedCards.some(o => o.card.name === tpl.name) || game.canAcceptCard(tpl));
    if (!canReceive) {
      // 2026-09-09 老板 #12：收不下要当场给提示（飘字+音效+日志，口径同 addItem），不能只默默掉在原地
      FX.float('背包已满', game.pos.x, game.pos.y, '#ff6b5e');
      SDT.Sound.sfx('deny');
      UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格${tpl.type !== '资源' ? '，珍珠盒扩格只收资源卡' : ''}），【${esc(tpl.name)}】掉在了原地…`, 'warn');
      return false;
    }
    game.ownedCards.push({ uid: newUid(), card: { ...tpl } });
    UI.log(`[[icon:archive]] 获得卡牌【<b>${esc(tpl.name)}</b>】`, 'loot');
    // 2026-09-07 留言：传说获得要有提示界面——特写揭晓，不再只默默进背包
    if (tpl.rarity === '传说') UI.showLegendGet(tpl);
    // 阿猫的礼物（2026-09-12 实装）：「发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌」
    // 地图侧没有能量概念，只结算附赠卡；战斗内触发走 battle.core fireCatGift（含能量）
    if (tpl.id === 'tt2-apollo') {
      const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c) && c.id !== 'tt2-apollo');
      if (pool.length) {
        const got = pool[Math.floor(Random.random('loot') * pool.length)];
        UI.log('[[icon:bolt]] <b>阿猫的礼物</b>：随机获取触发，附赠另 1 张随机卡牌', 'loot');
        grantEventCard(got);   // 池内已排除自身，无递归风险
      }
    }
    return true;
  }
  // ESM：循环导入下本模块体先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
  function bindRunMixins() {
    game.grantCard = grantEventCard;   // 宝箱等模块发卡（同名并入 / 容量满拒绝）
  }

  // ---------- 火堆（设计者 2026-09-02 定版：回 10 血 + 消耗口袋选 2 张复原 +
  //           30% 几率额外随机获得 1 张职业卡） ----------
  function openFireRest() {
    game.heal(MAP.rules.fireHeal);
    UI.log(`[[icon:fire]] <b>进入火堆</b>：自动回复 <b>${MAP.rules.fireHeal}</b> 点生命（体力不恢复，谨慎消耗）`, 'ok');
    // 2026-09-06 留言：火堆界面的音效删掉（原 levelup 提示音）
    if (Random.random('card') < MAP.rules.fireClassCardChance) {
      UI.log('[[icon:wood]] 营火余烬里翻出了一张先行者掉落的职业卡！', 'loot');
      grantEventCard(SDT.Cards.randomClassCard());
    }
    game.state = 'modal';
    openPocketRestore(2, () => {
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
    });
  }

  // 消耗口袋复原选牌（picks = 最多复原张数；done = 结束回调）
  // 2026-09-09 老板实测：原文字行在整屏场景壳上看不清、也不显示卡面——改为真卡面网格，点卡即复原
  // 需求 #12：消耗的装备不能在火堆复原（与道具一样）——列表里直接滤掉，不可选
  const FIRE_RESTORABLE = (card) => card.type !== '道具' && card.type !== '装备';
  function openPocketRestore(picks, done) {
    game.state = 'modal';
    let left = picks;
    const restorable = () => game.usedPocket.filter(p => FIRE_RESTORABLE(p.card));
    const render = () => {
      const list = restorable();
      const blockedN = game.usedPocket.length - list.length;
      const cardsHTML = list.length
        ? list.map(p => `
            <div class="bt-card fire-restore-card${left <= 0 ? ' off' : ''}" data-act="restoreOne" data-name="${escAttr(p.card.name)}"
              title="${escAttr(p.card.desc || p.card.name)}——点击复原一张回背包">
              ${SDT.Cards.cardHTML(p.card, 'sm')}
              ${p.count > 1 ? `<span class="bt-count" title="同名卡牌还剩 ${p.count} 张">×${p.count}</span>` : ''}
            </div>`).join('')
        : `<p class="ov-empty">（消耗口袋里没有可复原的卡牌${blockedN ? `——另有 ${blockedN} 张道具/装备不可在火堆复原` : ''}）</p>`;
      nodeShell({
        tone: 'fire', icon: '[[icon:fire]]', title: '营火休整',
        sub: `还可从消耗口袋中复原 <b>${left}</b> 张（最多 ${picks} 张）· 点击卡牌复原` +
          (blockedN ? ` · 道具/装备共 ${blockedN} 张不可复原` : ''),
        body: `<div class="bt-hand fire-restore-hand">${cardsHTML}</div>`,
        foot: `<button class="ov-btn ok fire-done-btn" data-act="fireDone"><svg class="ic svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 继续旅程</button>`,
      });
    };
    const finish = () => { UI.hideOverlay(); if (done) done(); };
    UI.act('restoreOne', (d) => {
      const p = game.usedPocket.find(x => x.card.name === d.name && FIRE_RESTORABLE(x.card));
      if (!p || left <= 0) return;
      // 2026-09-06 #18：背包满时不能复原
      if (usedSlots() >= bagCap()) { UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原`, 'warn'); SDT.Sound.sfx('deny'); return; }
      const card = p.card;
      p.count--;
      if (p.count <= 0) game.usedPocket.splice(game.usedPocket.indexOf(p), 1);
      game.ownedCards.push({ uid: newUid(), card: { ...card } });
      left--;
      UI.log(`[[icon:sparkles]] 【<b>${esc(card.name)}</b>】已复原，回到背包`, 'ok');
      if (left <= 0) finish(); else render();
    });
    UI.act('fireDone', finish);
    render();
  }

  // ---------- 角色选择（开局从全部角色中自由选 1，与 5 张初始攻击一起获得 1 张该角色随机卡） ----------
  // 各角色的背景故事与出发任务（角色选择页展示）
  function openClassChoice() {
    preloadAllNodeShellBgs();   // 选角这几秒正好把整页事件背景图预载完（webp 大图打开才请求会黑屏数秒）
    const picks = CHARACTERS.map(c => c.rulesetId).filter(cl => SDT.Cards.classPool(cl).length);
    if (!picks.length) return;
    game.state = 'modal';
    let sel = null;
    let view = 'select'; // 'select' 主选角页 | 'pool' 二级卡池页
    const poolCount = cl => SDT.Cards.classPool(cl).length;
    // 主选角页（2026-09-06 留言重做，排版参考杀戮尖塔 2 选人界面）：
    // 选中角色大幅立绘居右撑满，左侧信息面板（名字/来历/熟练度/故事/任务），
    // 底部全角色头像条，左下角红色返回键、右下角大确认键；卡池收进二级页
    const render = () => {
      if (view === 'pool') return renderPool();
      const story = sel ? characterFor(sel) : null;
      const lv = sel ? SDT.Meta.classLv(sel) : 0;
      const roster = picks.map(cl => ({ cl, c: characterFor(cl) }));
      UI.showOverlay('', `
        <div class="pg cls2-page">
          <div class="cls2-stage">
            ${sel ? `<div class="cls2-fullart">${SDT.Art.classFullArt(sel)}</div>` : ''}
            <aside class="cls2-panel${sel ? '' : ' cls2-none'}">
              ${sel && story ? `
                <h2 class="cls2-name">${esc(story.name)}</h2>
                <div class="cls2-tag">${esc(story.tag)}</div>
                <div class="cls2-lv">[[icon:medal]] ${esc(sel)} · 熟练度 Lv.${lv} · ${SDT.Meta.perkText(lv)}</div>
                <p class="cls2-story">${esc(story.bg)}</p>
                <h3>出发任务</h3>
                <p class="cls2-story">${esc(story.task)}</p>
                <button class="ov-btn cls2-pool-btn" data-act="clsPool">[[icon:cards]] 查看角色卡池（${poolCount(sel)} 张）</button>`
              : '<p class="cls2-hint">[[icon:medal]]<br>从下方选择一名角色</p>'}
            </aside>
          </div>
          <div class="cls2-strip">${roster.map(({ cl, c }) => `
            <button class="cls2-face${cl === sel ? ' sel' : ''}" data-act="selClass" data-cls="${escAttr(cl)}" title="${escAttr(c.name)} · ${escAttr(c.tag)}">
              ${SDT.Art.classArt(cl)}<b>${esc(c.name)}</b>
            </button>`).join('')}</div>
          <button class="cls2-back" data-act="cls2Quit" title="返回标题界面"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 5.5 4 12l6.5 6.5M4.6 12H20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="cls2-confirm" data-act="pickClass" ${sel ? '' : 'disabled'} title="${sel ? `确认 · ${escAttr(characterName(sel))}` : '请先选择角色'}"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </div>`, 'page');
    };
    // 二级页：该角色的卡池全览
    // 2026-09-09 留言重做：骨架对齐卡牌库——浅色展示区 + 左侧悬停大图预览 + 翻页制
    // （一页 10 张大卡，5 列 × 2 行），替换原深蓝 flex 长页滚动。
    // 右上叉号保持删除（底部已有「返回选角」）；卡面点击仍可放大查看
    let poolPage = 0;
    const POOL_PAGE_SIZE = 10;
    const poolPreviewHTML = (c) => {
      if (!c) return '<div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">把鼠标悬停在右侧卡牌上<br>这里会显示大图预览</p>';
      const dmgTxt = SDT.Cards.DMG_TYPES.includes(c.type) ? `<br>伤害词条：<b class="dmg-num">${c.dmg || 0}</b>` : '';
      return `${SDT.Cards.cardHTML(c, 'lg')}<p class="pv-hint">${esc(c.type)} · ${esc(SDT.Cards.rarityOf(c))}${dmgTxt}<br>点击卡面可放大查看</p>`;
    };
    const poolGridHTML = () => {
      const pool = SDT.Cards.classPool(sel);
      const totalPages = Math.max(1, Math.ceil(pool.length / POOL_PAGE_SIZE));
      if (poolPage >= totalPages) poolPage = totalPages - 1;
      const cards = pool.slice(poolPage * POOL_PAGE_SIZE, (poolPage + 1) * POOL_PAGE_SIZE);
      // 分页条跨满网格一行（grid-column:1/-1），与卡牌库同款
      const pager = totalPages > 1 ? `
        <div class="lib-pager">
          <button class="hs-btn sm" data-act="poolPrev"${poolPage <= 0 ? ' disabled' : ''}>‹ 上一页</button>
          <span class="lib-pageinfo">第 ${poolPage + 1} / ${totalPages} 页 · 共 ${pool.length} 张</span>
          <button class="hs-btn sm" data-act="poolNext"${poolPage >= totalPages - 1 ? ' disabled' : ''}>下一页 ›</button>
        </div>` : '';
      return `<div class="lib-grid cls-pool-grid" id="poolGrid">${cards.map((c, i) => `
        <div class="lib-item"><div class="lib-cardwrap" data-act="poolZoom" data-i="${poolPage * POOL_PAGE_SIZE + i}" title="点击放大查看">${SDT.Cards.cardHTML(c)}</div></div>`).join('')}${pager}</div>`;
    };
    // 预解码下一页插画（翻页零解码等待，同卡牌库 warmNextLibPage）
    const warmNextPoolPage = () => {
      const warm = window.SDT?.Art?.warm;
      if (!warm) return;
      const pool = SDT.Cards.classPool(sel);
      const urls = [];
      for (const c of pool.slice((poolPage + 1) * POOL_PAGE_SIZE, (poolPage + 2) * POOL_PAGE_SIZE)) {
        const m = /src="([^"]+)"/.exec((window.SDT.Art.cardIcon && SDT.Art.cardIcon(c)) || '');
        if (m) urls.push(m[1]);
      }
      warm(urls);
    };
    // 翻页/重进只重绘卡格区（整页 showOverlay 会重置预览栏）
    const renderPoolGrid = () => {
      const grid = document.getElementById('poolGrid');
      if (grid) grid.outerHTML = poolGridHTML();
      warmNextPoolPage();
    };
    const renderPool = () => {
      poolPage = 0;
      const pool = SDT.Cards.classPool(sel);
      UI.showOverlay('', `
        <div class="pg cls-pool-page">
          <header class="pg-head">
            <h2>[[icon:cards]] ${esc(characterName(sel))} · 角色卡池（${pool.length} 张）</h2>
            <span class="sub">确认选择「${esc(characterName(sel))}」后，从以下卡池随机获得角色卡（与 5 张「初始攻击」一起带入背包）· 悬停卡面左侧预览大图</span>
          </header>
          <div class="clib-main">
            <aside class="clib-preview" id="poolPreview">${poolPreviewHTML(null)}</aside>
            ${poolGridHTML()}
          </div>
          <footer class="cls-foot">
            <button class="ov-btn" data-act="clsBack">[[icon:medal]] 返回选角</button>
            <button class="ov-btn ok" data-act="pickClass">确 认 · ${esc(characterName(sel))}</button>
          </footer>
        </div>`, 'page');
      warmNextPoolPage();
    };
    // 悬停大图预览（炉石式，同卡牌库）：mouseover 因子元素冒泡重复触发，90ms 去抖
    let poolPreviewTimer = null;
    UI._hoverHandler = (e) => {
      const w = e.target.closest ? e.target.closest('#poolGrid [data-act="poolZoom"]') : null;
      if (!w) return;   // 移出卡面：保留当前预览不动
      const i = Number(w.dataset.i);
      if (poolPreviewTimer) clearTimeout(poolPreviewTimer);
      poolPreviewTimer = setTimeout(() => {
        poolPreviewTimer = null;
        const c = (SDT.Cards.classPool(sel) || [])[i];
        const pv = document.getElementById('poolPreview');
        if (c && pv) { pv.innerHTML = poolPreviewHTML(c); Sfx.tick(); }
      }, 90);
    };
    UI.act('poolZoom', (d) => {
      const list = sel ? SDT.Cards.classPool(sel) : [];
      const c = list[Number(d.i)];
      if (c) UI.showCardZoom(c);
    });
    UI.act('poolPrev', () => { if (poolPage > 0) { poolPage--; renderPoolGrid(); } });
    UI.act('poolNext', () => {
      const totalPages = Math.ceil((SDT.Cards.classPool(sel).length) / POOL_PAGE_SIZE);
      if (poolPage < totalPages - 1) { poolPage++; renderPoolGrid(); }
    });
    UI.act('selClass', (d) => {
      if (d.cls === sel) return;
      sel = d.cls;
      Sfx.tick();
      render();
    });
    UI.act('clsPool', () => {
      if (!sel) return;
      view = 'pool';
      Sfx.tick();
      render();
    });
    UI.act('clsBack', () => {
      view = 'select';
      Sfx.tick();
      render();
    });
    UI.act('cls2Quit', () => {   // 左下角返回键：放弃选角回标题（弹层淡出后 exitToTitle 的弹窗守卫才放行）
      UI.hideOverlay();
      setTimeout(() => exitToTitle(), 240);
    });
    UI.act('pickClass', () => {
      if (!sel) return;
      const cl = sel;
      game.myClass = cl;
      game.characterId = characterFor(cl).id;
      game.classCard = null;
      const card = SDT.Cards.randomClassCard(cl);
      // 2026-09-06：开局获得 2 张本职业卡牌（原 1 张），尽量不重复
      let card2 = SDT.Cards.randomClassCard(cl);
      for (let i = 0; i < 8 && card2 && card && card2.id === card.id; i++) card2 = SDT.Cards.randomClassCard(cl);
      UI.hideOverlay();
      UI.log(`[[icon:medal]] 本局角色：<b>${esc(characterName(cl))}</b>`, 'ok');
      // 熟练度加成：每级（Lv.1 起）生命上限 +1（2026-09-09 需求 #5），立即生效
      const lv = SDT.Meta.classLv(cl);
      if (lv > 1) {
        const bonus = (lv - 1) * 1;
        game.maxHp += bonus; game.hp += bonus;
        UI.log(`[[icon:medal]] ${esc(characterName(cl))} 熟练度 <b>Lv.${lv}</b>：生命上限 +${bonus}（${game.maxHp}）`, 'ok');
      }
      if (card) {
        game.classCard = { ...card };
        game.ownedCards.push({ uid: newUid(), card: game.classCard, brought: 1 });
        UI.log(`[[icon:archive]] 获得角色卡【<b>${esc(card.name)}</b>】（${esc(characterName(cl))}）`, 'loot');
        if (card2 && card2.id !== card.id) {
          game.ownedCards.push({ uid: newUid(), card: { ...card2 }, brought: 1 });
          UI.log(`[[icon:archive]] 获得角色卡【<b>${esc(card2.name)}</b>】（${esc(characterName(cl))}）·第 2 张职业卡已入包`, 'loot');
        }
      }
      // 2026-09-07 留言：选人进局要有过渡动画——复用节点过场（大门场景 + 角色名揭晓）；
      // 启程文案按人物区分（对应各自 tag 的语气）
      const START_LINES = {
        shuangling: '刀锋出鞘，踏雪先行',
        baiqi: '契约既成，答案待启',
        lituan: '口袋里的星图，亮了',
        xuanli: '最后一道防线，就位',
        dengkui: '灯已点亮，照归途',
      };
      const startLine = START_LINES[characterFor(cl).id] || '整备完毕，探索开始';
      showRunTransition({
        tone: 'door', asset: 'scene-door-bg', eyebrow: 'EXPEDITION START',
        title: characterName(cl), detail: startLine, duration: 1600,
      }).then(() => {
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
      });
    });
    render();
  }

  function triggerEventCard(card) {
    game.eventLog = game.eventLog || [];
    game.eventLog.push({ name: card.name, desc: card.desc || '', turn: game.turn });
    UI.log(`[[icon:dice]] 触发事件【<b>${esc(card.name)}</b>】${card.desc ? '· ' + esc(card.desc) : ''}`, 'sys');
    // 主界面大字揭晓：展示事件卡卡面与描述，点击任意处后结算
    game.state = 'modal';
    _set_cardPageOpen(false);
    SDT.Sound.sfx('scene');
    const narrative = eventNarrative(card.id);
    const choices = eventChoiceSpec(card, narrative);
    // 2026-09-10 留言 #18：没有专属图的事件此前全部回落到祭坛图（等于所有事件共用 1 张背景）。
    // 改为从 3 张事件场景图中随机轮换（scene-event-custom-a/b/c，见 css/scenes.css）。
    const GENERIC_EVENT_BGS = ['scene-event-custom-a', 'scene-event-custom-b', 'scene-event-custom-c'];
    const genericBg = GENERIC_EVENT_BGS[Math.floor(Random.random('scene') * GENERIC_EVENT_BGS.length)];
    const sceneMeta = EVENT_SCENE_META[card.id] || ['event-custom', 'scene-event-custom', genericBg];
    // 杀戮尖塔式事件页：整屏事件背景，右侧毛玻璃面板放标题、叙事与选项条
    const optHTML = choices
      ? choices.map((o, i) => `
          <button class="evt-opt ${o.tone || ''}" data-act="evtChoice" data-i="${i}">
            <b>${esc(o.label)}</b>
            ${o.detail ? `<span>${esc(o.detail)}</span>` : ''}
          </button>`).join('')
      : `<button class="evt-opt ok" data-act="evtNext"><b>继 续</b></button>`;
    nodeShell({
      tone: 'event', asset: sceneMeta[2], icon: '[[icon:dice]]', title: card.name,
      sub: esc((narrative && narrative.intro) || card.desc || '神秘事件发生了……'),
      body: optHTML,
    });
    UI.act('evtChoice', (d) => {
      if (!choices) return;
      const choice = choices[+d.i];
      if (!choice) return;
      UI.hideOverlay();
      choice.run();
    });
    UI.act('evtNext', () => {
      if (choices) return;
      UI.hideOverlay();
      applyEventEffect(card);
    });
    UI.refresh(game);
  }

  // 事件分支只覆盖已有资源/效果；未列出的旧事件继续单按钮结算，兼容旧存档与自定义事件卡。
  function eventChoiceSpec(card, narrative = null) {
    if (!card) return null;
    const settle = (run) => () => { run(); game.state = 'idle'; saveGame(); UI.refresh(game); };
    const gainFragment = () => {
      game.fragments = (game.fragments || 0) + 1;
      UI.log(`[[icon:crystal]] 获得彩色令牌碎片（${game.fragments}/2，集齐 2 枚可随员工通行证A合成彩色令牌）`, 'loot');
    };
    // —— 2026-09-09 事件 v2（Q6/C13 老板定向）：描述已按设计者新版对齐的七个事件，
    //     直接走自定义选项（旧 ink 叙事仍作 intro 展示，效果按新卡面结算）——
    const V2 = {
      'tt6-mystery': () => [
        { label: '接收补给', detail: '获得彩色令牌碎片，+2 币', tone: 'ok', run: settle(() => { gainFragment(); gainCoins(2); }) },
      ],
      'tt6-systemsupply': () => [
        { label: '接收补给', detail: '获得彩色令牌碎片，木材卡 ×1', tone: 'ok', run: settle(() => {
          gainFragment();
          const card = SDT.Cards.all().find(c => c.id === 'tt-wood');   // 需求 #10：物资一律以卡牌入包
          if (card) grantEventCard(card);
        }) },
      ],
      'tt6-demondeal': () => [
        { label: '成交', detail: '-5 血，获得 1 个大宝箱', tone: 'danger', run: () => {
          game.hp = Math.max(1, game.hp - 5);
          UI.log('[[icon:demon]] 恶魔收走了 5 点生命力，并丢给你一个军用保险柜', 'warn');
          openChestsOnCell([{ kind: 'large' }], '恶魔的报酬');
        } },
        { label: '拒绝', detail: '无事发生', run: settle(() => { UI.log('你顶住了诱惑，继续赶路', 'sys'); }) },
      ],
      'tt6-airdrop': () => {
        const potionPool = SDT.Cards.all().filter(c => c.type === '道具' && SDT.Cards.isRandomObtainable(c) && (/药水/.test(c.name) || c.name === '能量饮料'));
        const potion = potionPool.length ? potionPool[Math.floor(Random.random('loot') * potionPool.length)] : null;
        const woodCard = SDT.Cards.all().find(c => c.id === 'tt-wood');
        const rationCard = SDT.Cards.all().find(c => c.id === 'tt-rations');
        return [
          { label: '木材', detail: '木材卡 ×1', run: settle(() => { if (woodCard) grantEventCard(woodCard); }) },   // 需求 #10：物资一律以卡牌入包
          { label: '口粮', detail: '口粮卡 ×1', run: settle(() => { if (rationCard) grantEventCard(rationCard); }) },
          { label: '桃', detail: '回复 6 血', tone: 'ok', run: settle(() => { game.heal(6); UI.log('[[icon:heart]] 一颗鲜桃下肚，回复 6 点生命', 'ok'); }) },
          { label: '随机药水', detail: potion ? `获得【${potion.name}】` : '（补给已耗尽）', tone: 'ok', run: settle(() => { if (potion) grantEventCard(potion); }) },
        ];
      },
      'tt6-chestdraw': () => [
        { label: '开箱', detail: '从大、中、小宝箱中随机抽取 1 个', tone: 'ok', run: () => {
          const kinds = ['large', 'medium', 'small'];
          const kind = kinds[Math.floor(Random.random('loot') * kinds.length)];
          openChestsOnCell([{ kind }], '你撬开了一个未知的箱子');
        } },
      ],
      'tt6-goldhammer': () => [
        { label: '收下', detail: "获得卡牌「闪金之锤」", tone: 'ok', run: settle(() => { grantEventCard(SDT.Cards.all().find(c => c.id === 'cmtn0xt0zr7')); }) },
      ],
    };
    if (V2[card.id]) return V2[card.id]();
    if (narrative) return narrative.choices.map(choice => {
      const narrate = () => {
        const result = choice.choose();
        if (result) UI.log(`[[icon:notes]] ${esc(result)}`, 'sys');
      };
      const effects = {
        goldmine_safe: settle(() => { narrate(); gainCoins(3); }),
        goldmine_deep: settle(() => { narrate(); gainCoins(6); game.hp = Math.max(1, game.hp - 3); UI.log('[[icon:tools]] 挖矿过深，获得 6 币但损失 3 血', 'warn'); }),
        airdrop_wood: settle(() => { narrate(); const c = SDT.Cards.all().find(x => x.id === 'tt-wood'); if (c) grantEventCard(c); }),   // 需求 #10：物资以卡牌入包
        airdrop_rations: settle(() => { narrate(); const c = SDT.Cards.all().find(x => x.id === 'tt-rations'); if (c) grantEventCard(c); }),
        airdrop_heal: settle(() => { narrate(); game.heal(3); }),
        chest_small: () => { narrate(); openChestsOnCell([{ kind: 'small' }], '你选择了稳妥的小型物资箱'); },
        chest_medium: () => { narrate(); openChestsOnCell([{ kind: 'medium' }], '你选择了高风险的密封物资箱'); },
        timeskip_move: settle(() => { narrate(); UI.log('[[icon:crystal]] 时空孔隙把你向前卷了 <b>6</b> 格！', 'sys'); game.chainMove = 6; }),
        relief_heal: settle(() => { narrate(); UI.log('[[icon:heart]] 爱心救济站为你处理了伤口', 'ok'); game.heal(6); }),
        mystery_supply: settle(() => { narrate(); grantEventCard(SDT.Cards.all().find(c => c.id === 'tt-token-color')); gainCoins(2); }),
        systemsupply_restock: settle(() => {
          narrate();
          grantEventCard(SDT.Cards.all().find(c => c.id === 'tt-token-color'));
          const c = SDT.Cards.all().find(x => x.id === 'tt-wood');
          if (c) grantEventCard(c);   // 需求 #10：物资以卡牌入包
        }),
        demondeal_trade: settle(() => {
          narrate();
          game.hp = Math.max(1, game.hp - 1);
          UI.log('[[icon:demon]] 恶魔收走了一点生命力（-1 血）', 'warn');
          const legends = SDT.Cards.all().filter(c => c.rarity === '传说' && ['装备', '武术', '法术'].includes(c.type));
          grantEventCard(legends.length ? legends[Math.floor(Random.random('card') * legends.length)] : null);
        }),
        bandits_fight: () => {   // 战斗与开箱路径自管收尾，不走 settle（同 chest_*）
          narrate();
          // 2026-09-11 实机定版：数量随层数缩放（第 1 层 3 只 → 第 3 层起 5 只）——
          // 此前固定 ×5，1-2 层新档（2 费 / 35 血 / 无 AOE）近乎必死
          const gangN = Math.min(5, 3 + game.layerIdx);
          UI.log(`[[icon:swords]] 反抗组织拾荒者一伙（×${gangN}）拦住了去路！`, 'warn');
          game.pendingEventLoot = { text: '密封物资箱 ×2', chests: ['medium', 'medium'] };
          game.state = 'modal';
          const tpl = MAP.monsters.bandit;
          const gang = [];
          for (let i = 0; i < gangN; i++) gang.push(scaledEnemy({ ...tpl }));
          SDT.Battle.start(game, gang, { isBoss: false, layer: game.layerIdx, name: tpl.name });
        },
        goldhammer_strike: () => {
          narrate();
          const enc = MAP.encounters[game.layerIdx] || MAP.encounters[0];
          const tpl = MAP.monsters[enc.pool[Math.floor(Random.random('enemy') * enc.pool.length)]];
          const foe = scaledEnemy({ ...tpl });
          foe.hp -= 5;
          if (foe.hp <= 0) {
            UI.log(`[[icon:tools]] 闪金之锤一击制敌（${foe.name}）！+2 币`, 'coin');
            gainCoins(2);
            game.state = 'idle'; saveGame(); UI.refresh(game);
            return;
          }
          UI.log(`[[icon:tools]] 闪金之锤重击 <b>${esc(foe.name)}</b>（-5 血），战斗打响！`, 'warn');
          game.state = 'modal';
          SDT.Battle.start(game, [foe], { isBoss: false, layer: game.layerIdx, name: foe.name });
        },
      };
      return { label: choice.label, detail: choice.detail, tone: choice.tone, run: effects[choice.effect] || settle(narrate) };
    });
    return null;
  }

  // 事件效果结算（旧版单按钮路径：仅剩自定义/未迁移事件卡会走到这里，tt6 十事件已全部走 ink）
  function applyEventEffect(card) {
    switch (card.id) {
      case 'cmtn7qttxqo4':   // 修鞋铺（2026-09-09 审计补实装）：获得彩色令牌碎片；复原 1 张卡牌
        game.fragments = (game.fragments || 0) + 1;
        UI.log(`[[icon:crystal]] 修鞋铺送了你一枚彩色令牌碎片（${game.fragments}/2）`, 'loot');
        openPocketRestore(1, () => {
          game.state = 'idle';
          saveGame();
          UI.refresh(game);
        });
        return;   // openPocketRestore 自管收尾
      default:
        UI.log('（该事件的效果将在后续版本实装）', 'dim');
    }
    saveGame();
  }

  // ---------- 节点弹窗 ----------
  function openDoorModal(door, cellDef) {
    game.state = 'modal';
    game.discoveredPairs.add(door.pair);
    const target = game.layerData[door.toLayer] || { name: `第${door.toLayer + 1}层` };
    // 2026-09-09 需求 #13：只能在第三层（紧急撤离点）与第四层（终局撤离点）撤离——
    // 环间门不再提供撤离选项，只能向深处走
    nodeShell({
      tone: 'door', icon: '[[icon:door]]', title: '环间门',
      sub: `这道隔离闸门连通 <b>${target.name}</b>——闸门只向深处放行，不能停留`,
      body:
        nodeOpt('goDoor', `${door.reverse ? '返回' : '进入'}${target.name}`, '穿过闸门，前往另一环', 'ok') +
        (cellDef && cellDef.type === 'shop' ? nodeOpt('doorShop', '逛商队', '闸门旁的拾荒商队还在营业') : ''),
    });
    UI.act('goDoor', () => {
      UI.hideOverlay();
      UI.log(`穿过隔离闸门 → <b>${target.name}</b>`, 'sys');
      enterLayer(door.toLayer, door.arriveAt);
    });
    UI.act('doorShop', () => openShop());
    UI.refresh(game);
  }

  // ---------- 第四层终局：祭坛格（弃3激活选奖励）→ 首脑格 → 终局撤离点 ----------
  // 祭坛：弃掉背包 3 张牌激活后二选一奖励；集齐 2 枚彩色令牌碎片可不走弃牌直接换英雄卡。
  // 激活（或兑换）成功才算触发过本格；离开未激活可再来。首脑格必须先激活祭坛。
  function openAltarRitual(def) {
    game.state = 'modal';
    const frags = game.fragments || 0;
    // 碎片不足时不再隐藏选项，改为禁用态并说明原因（2026-09-10 撤离测试：玩家不知道选项为何消失）
    const fragOpt = frags >= 2
      ? nodeOpt('altarFragHero', `献上 2 枚彩色令牌碎片（不弃牌）`, `获得 1 张本职业随机英雄卡（现有碎片 ${frags}）`, 'ok')
      : nodeOpt('altarFragLocked', '献上 2 枚彩色令牌碎片（不弃牌）', `碎片不足（现有 ${frags}/2）——集齐 2 枚后可在任意祭坛直接兑换英雄卡`, '', 'disabled title="彩色令牌碎片不足，无法兑换"');
    nodeShell({
      tone: 'altar', icon: '[[icon:crystal]]', title: '污染祭坛',
      sub: '弃掉背包中 3 张卡牌激活祭坛，任选一项奖励' +
        (frags >= 2 ? '；也可以不弃牌，直接献上 2 枚彩色令牌碎片换取英雄卡' : ''),
      body:
        nodeOpt('altarOn3', '弃 3 张 · 激活祭坛', '激活后二选一：① 复原 3 张消耗卡 + 回复 10 血；② 随机获取 1 张传说卡和 1 张装备卡', 'ok') +
        fragOpt +
        nodeOpt('altarItemRestore', '献祭道具 · 复原卡牌', '献祭 1 张道具卡，从消耗口袋复原 2 张卡牌（不影响其他献祭功能，可重复使用）') +
        nodeOpt('altarLeave', '离开', '祭坛保持沉睡——回到当前格子，稍后再来'),
    });
    const markActivated = () => {
      game.altarActivated = true;
      game.visited = game.visited || {};
      game.visited[game.layerIdx + ',' + game.trackPos] = 1;   // 激活成功才消耗本格
    };
    // 献祭道具复原（2026-09-10 需求）：1 张道具卡 → 从消耗口袋复原 2 张；
    // 独立于弃 3 张激活/碎片兑换——不消耗本格、不影响其他献祭功能，可重复使用
    UI.act('altarItemRestore', () => {
      if (!game.ownedCards.some(o => o.card.type === '道具')) { UI.log('[[icon:bag]] 背包里没有道具卡可供献祭', 'warn'); return; }
      const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).length;
      if (!game.usedPocket.length || !restorableN) { UI.log('[[icon:bag]] 消耗口袋里没有可复原的卡牌——先去战斗吧', 'warn'); return; }
      openBagSacrifice(1, (chosen) => {
        UI.log(`[[icon:crystal]] 献上道具【<b>${esc(chosen[0].card.name)}</b>】——从消耗口袋复原卡牌`, 'loot');
        saveGame();
        openPocketRestore(Math.min(2, restorableN), () => { saveGame(); openAltarRitual(def); });
      }, () => openAltarRitual(def), '道具');
    });
    UI.act('altarOn3', () => {
      if (game.ownedCards.length < 3) { UI.log('[[icon:bag]] 背包卡牌不足 3 张，无法激活祭坛', 'warn'); return; }
      openBagSacrifice(3, (chosen) => {
        markActivated();
        UI.log(`[[icon:crystal]] 献上 ${chosen.map(o => `【${esc(o.card.name)}】`).join('')}——<b>祭坛苏醒了</b>，请选择一项奖励`, 'loot');
        saveGame();
        openAltarReward();
      }, () => openAltarRitual(def));
    });
    UI.act('altarFragHero', () => {
      // 2026-09-10 留言 #30：职业缺失/英雄池为空时此前只写一条侧边日志就 return——
      // 玩家点了按钮界面毫无变化，看起来像「碎片无法激活」。改为弹窗明示，碎片原样保留。
      const pool = game.myClass ? SDT.Cards.classPool(game.myClass).filter(c => c.type === '能力卡') : [];
      if (!pool.length) {
        nodeShell({
          tone: 'altar', icon: '[[icon:crystal]]', title: '碎片兑换 · 暂不可用',
          sub: `${game.myClass ? '【' + esc(game.myClass) + '】职业目前没有可兑换的英雄卡' : '还没有选定职业'}——彩色令牌碎片已原样保留（现有 ${(game.fragments || 0)} 枚）`,
          body: nodeOpt('altarFragBack', '返回祭坛', '换个方式激活，或留着碎片以后再兑'),
        });
        UI.act('altarFragBack', () => openAltarRitual(def));
        UI.refresh(game);
        return;
      }
      const card = pool[Math.floor(Random.random('loot') * pool.length)];
      // 先发牌、后扣碎片：背包满时发卡会被拒收（现场播报），不能白扣 2 枚碎片
      if (!game.grantCard(card)) return;
      game.fragments = (game.fragments || 0) - 2;
      markActivated();
      UI.log(`[[icon:gem]] 献上 2 枚彩色令牌碎片（剩 ${game.fragments}）——获得本职业英雄卡【<b>${esc(card.name)}</b>】；<b>祭坛苏醒了</b>`, 'loot');
      saveGame();
      finishInstant();
    });
    UI.act('altarLeave', () => { UI.hideOverlay(); game.state = 'idle'; saveGame(); UI.refresh(game); });
    UI.refresh(game);
  }

  // 激活后的奖励二选一（弃 3 张已支付）
  function openAltarReward() {
    game.state = 'modal';
    // 2026-09-10 留言 #33：消耗口袋没有可复原卡牌（或全是不可复原的道具/装备）时，
    // 选项①要如实标注——否则选了它只会看到空列表，感觉「无法复原」
    const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).length;
    const restoreOpt = restorableN
      ? nodeOpt('altarRewardRestore', '① 复原 3 张消耗卡 + 回复 10 血', `从消耗口袋挑选卡牌复原回背包（现有 ${restorableN} 张可复原${restorableN < 3 ? '，不足 3 张时全复原' : ''}），并回复 10 点生命`, 'ok')
      : nodeOpt('altarRewardRestoreOff', '① 复原 3 张消耗卡 + 回复 10 血', '消耗口袋里没有可复原的卡牌（道具/装备类消耗不可复原）——此项不可选', '', 'disabled title="消耗口袋里没有可复原的卡牌，请选奖励②"');
    nodeShell({
      tone: 'altar', icon: '[[icon:crystal]]', title: '祭坛回赠 · 二选一',
      sub: '祭坛已苏醒——选择你要的奖励',
      body:
        restoreOpt +
        nodeOpt('altarRewardLoot', '② 传说卡 + 装备卡', '随机获取 1 张传说卡和 1 张装备卡'),
    });
    UI.act('altarRewardRestore', async () => {
      const before = game.hp;
      game.heal(10);
      UI.log(`[[icon:heart]] 祭坛回赠：回复 <b>${Math.max(0, game.hp - before)}</b> 点生命（${game.hp}/${game.maxHp}）`, 'heal');
      UI.hideOverlay();
      openPocketRestore(3, () => { saveGame(); finishInstant(); });
    });
    UI.act('altarRewardLoot', () => {
      const legend = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
      const equips = SDT.Cards.all().filter(c => c.type === '装备' && SDT.Cards.isRandomObtainable(c));
      if (legend.length) game.grantCard(legend[Math.floor(Random.random('loot') * legend.length)]);
      if (equips.length) game.grantCard(equips[Math.floor(Random.random('loot') * equips.length)]);
      UI.log('[[icon:crystal]] 祭坛回赠：随机获得 1 张<b>传说卡</b>和 1 张<b>装备卡</b>（见背包）', 'loot');
      saveGame();
      finishInstant();
    });
    UI.refresh(game);
  }

  // 首脑格：必须先激活祭坛；三首脑任选其一挑战，胜利后终局撤离点放行
  function openBossGate(def) {
    game.state = 'modal';
    if (!game.altarActivated) {
      nodeShell({
        tone: 'altar', icon: '[[icon:skull]]', title: '首脑巢穴 · 封印中',
        sub: '三位首脑被污染祭坛的辐射护盾庇护——先激活祭坛（弃 3 张卡牌），再来挑战',
        body: nodeOpt('bossBounce', '退回', '回到上一格，先去激活祭坛', 'ok'),
      });
      UI.act('bossBounce', () => {
        UI.hideOverlay();
        game.trackPos = Math.max(0, game.trackPos - 1);
        game.pos = cellCenter(game.layerIdx, game.trackPos);
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
      });
      UI.refresh(game);
      return;
    }
    // 2026-09-09 玩法定版：三首脑（5-50 / 4-45 / 8-48）随机一个坐镇，进入本格即告知，
    // 让玩家在编组牌库前就知道要面对谁（编组界面也会再次显示首脑与词缀）。
    const bossIdx = Math.floor(Random.random('boss') * MAP.altar.bosses.length);
    const b = MAP.altar.bosses[bossIdx];
    const aff = b.affix ? MAP.altar.bosses[bossIdx].affixDesc : '';
    nodeShell({
      tone: 'altar', icon: '[[icon:demon]]', title: '首脑巢穴 · 决战',
      sub: `本层首脑：<b>${esc(b.name)}（${b.atk}-${b.hp}）</b>${aff ? ` · 词缀【${esc(b.affixName)}】${esc(aff)}` : ''}——胜利后终局撤离点放行`,
      body:
        nodeOpt('fightBoss', '编组牌库，迎战首脑', '从背包选 15 张招式/装备/能力卡，附加 5 张初始攻击（混沌之眼可多带 5 张）', 'ok') +
        nodeOpt('bossLeave', '暂不挑战', '留在当前格子（本格不消耗，可再来）'),
    });
    UI.act('fightBoss', () => {
      UI.hideOverlay();
      SDT.Battle.start(game, scaledEnemy(b), { isBoss: true, name: b.name });
    });
    UI.act('bossLeave', () => { UI.hideOverlay(); game.state = 'idle'; saveGame(); UI.refresh(game); });
    UI.refresh(game);
  }

  // 背包献祭选卡器（2026-09-06 #26）：从背包选 n 张卡，确认后消耗并回调
  // onCancel：取消时的回流（缺省回祭坛面板）
  function openBagSacrifice(n, done, onCancel, filterType) {
    game.state = 'modal';
    const sel = new Set();
    const back = onCancel || (() => openAltarRitual(curLayer()?.logical?.[game.trackPos]?.def));
    const eligible = filterType ? game.ownedCards.filter(o => o.card.type === filterType) : game.ownedCards;
    const render = () => {
      // 2026-09-10 留言 #31/#32：原文字行看不清也看不到卡面——改为真卡面网格（口径同火堆复原），
      // 点卡选中/取消，选中卡挂黄铜图钉角标
      const rows = eligible.map(o => `
        <div class="bt-card sac-card${sel.has(o.uid) ? ' sel' : ''}" data-act="sacPick" data-uid="${escAttr(o.uid)}"
          title="${escAttr(`${o.card.name}${o.card.cost != null ? ` · ${o.card.cost} 费` : ''}——${o.card.desc || '点击选中/取消'}`)}">
          ${SDT.Cards.cardHTML(o.card, 'sm')}
          ${o.card.cost != null ? `<span class="bt-sac-cost">${o.card.cost} 费</span>` : ''}
        </div>`).join('');
      UI.showOverlay('[[icon:crystal]] 选择要献祭的卡牌', `
        <p class="ov-note">选择 <b>${n}</b> 张${filterType ? `<b>${escAttr(filterType)}</b>卡` : '卡牌'}献祭（已选 <b>${sel.size}</b>）</p>
        <div class="bt-hand sac-hand">${rows || '<p class="ov-empty">背包里没有符合条件的卡牌</p>'}</div>
        <div class="scene-ops">
          <button class="ov-btn ok" data-act="sacConfirm" ${sel.size !== n ? 'disabled' : ''}>[[icon:crystal]] 确认献祭</button>
          <button class="ov-btn" data-act="sacCancel">[[icon:exit]] 取消</button>
        </div>`);
    };
    UI.act('sacPick', (d) => {
      const o = eligible.find(x => x.uid === d.uid);
      if (!o) return;
      if (sel.has(o.uid)) sel.delete(o.uid);
      else if (sel.size < n) sel.add(o.uid);
      Sfx.tick();
      render();
    });
    UI.act('sacCancel', () => { UI.hideOverlay(); back(); });
    UI.act('sacConfirm', () => {
      const chosen = eligible.filter(o => sel.has(o.uid));
      game.ownedCards = game.ownedCards.filter(o => !sel.has(o.uid));
      UI.hideOverlay();
      done(chosen);
    });
    render();
  }

  // 撤离点弹窗（四层定版：只能在第三层紧急撤离、第四层击败首脑后终局撤离）
  //   第三层紧急撤离点：献祭 3 张卡牌后撤离；
  //   第四层终局撤离点：击败首脑后无条件撤离（未击败则锁定）。
  function openEmergencyModal() {
    game.state = 'modal';
    const def = curLayer()?.logical?.[game.trackPos]?.def;
    const isEmergency = def && def.type === 'emergencyExit';
    if (isEmergency) {
      // 第三层 · 紧急撤离点（旧档在第 1/2/4 层生成的撤离点一律停用）
      if (game.layerIdx !== 2) {
        nodeShell({
          tone: 'exit', icon: '[[icon:lock]]', title: '停用的撤离点',
          sub: '撤离信标没有响应——只有第三层的紧急撤离点仍在工作',
          body: nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
        });
        UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
        UI.refresh(game);
        return;
      }
      const sacN = Math.min(3, game.ownedCards.length);
      nodeShell({
        tone: 'exit', icon: '[[icon:cross]]', title: '紧急撤离点',
        sub: '紧急信标过载——撤离前必须献祭 3 张卡牌作为代价',
        body:
          nodeOpt('payExit', `紧急撤离（献祭 ${sacN} 张卡牌）`, '从背包选择 3 张卡牌献祭，带着剩余战利品返回基地', 'ok') +
          nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
      });
      UI.act('payExit', () => {
        if (game.ownedCards.length < 3) {
          UI.log('[[icon:cross]] 背包卡牌不足 3 张，无法支付紧急撤离的代价', 'warn');
          SDT.Sound.sfx('error');
          return;
        }
        UI.hideOverlay();
        openBagSacrifice(3, () => {
          UI.log('[[icon:crystal]] 献祭了 3 张卡牌——紧急信标充能完毕', 'sys');
          doExtract();
        }, () => openEmergencyModal());
      });
      UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
      UI.refresh(game);
      return;
    }
    // 第四层 · 终局撤离点：击败首脑后无条件撤离
    if (game.bossKilled) {
      nodeShell({
        tone: 'exit', icon: '[[icon:exit]]', title: '终局撤离点',
        sub: '污染核心的首脑已被击破——撤离信标无条件放行',
        body:
          nodeOpt('payExit', '立即撤离', '带着全部战利品返回基地', 'ok') +
          nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
      });
    } else {
      nodeShell({
        tone: 'exit', icon: '[[icon:lock]]', title: '终局撤离点',
        sub: '撤离信标被污染核心压制——击败第四层的首脑后才能撤离',
        body: nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
      });
    }
    UI.act('payExit', () => {
      UI.log('启动撤离信标，准备返回基地', 'sys');
      UI.hideOverlay();
      doExtract();
    });
    UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
    UI.refresh(game);
  }

  // 撤离成功 → 「整理入库」交互：把背包中的物品放回仓库（不入库的会丢失）。
  // 「初始攻击」为初始牌不可入库；木材/口粮自动入库；消耗口袋自动回收。
  let extractLeft = null;   // 待整理的卡牌堆 [{card, count}]（撤离整理页暂存）

  function doExtract() {
    syncPlayTime();
    game.state = 'done';
    game.runActive = false;
    clearSave();
    SDT.Sound.sfx('victory');
    SDT.Sound.music('title');
    const B = SDT.Base;
    // 木材/口粮自动入库（纯资源，没有丢弃的意义）；消耗口袋自动回收（复原后回仓库）
    B.deposit(game.inventory);
    B.depositCards(game.usedPocket, true);
    SDT.Meta.track('extract', { coins: game.coins, actions: game.turn - 1, cls: game.myClass });
    // 卡牌堆交给整理界面，由玩家决定入不入库
    const byName = new Map();
    game.ownedCards.forEach(o => {
      if (B.isSha(o.card)) return;              // 「初始攻击」不可入库
      const s = byName.get(o.card.name);
      if (s) s.count++;
      else byName.set(o.card.name, { card: { ...o.card }, count: 1 });
    });
    extractLeft = [...byName.values()];
    renderExtractStash();
  }

  function renderExtractStash() {
    const B = SDT.Base;
    const woodN = game.inventory.filter(i => i.name === '木材').reduce((a, b) => a + b.count, 0);
    const ratN = game.inventory.filter(i => i.name === '口粮').reduce((a, b) => a + b.count, 0);
    const shaN = game.ownedCards.filter(o => B.isSha(o.card)).length;
    const otherN = game.inventory.filter(i => i.name !== '木材' && i.name !== '口粮')
      .reduce((a, b) => a + b.count, 0);
    const room = B.stashRoom();
    const rows = extractLeft.map((s, i) => {
      const fits = s.count <= Math.max(0, room);
      return `<div class="pk-row dep-row">
        <span class="dep-name">[[icon:cards]] <b>${esc(s.card.name)}</b>${s.count > 1 ? ` ×${s.count}` : ''}
          <span class="dim">· 收购 ${SDT.Cards.sellPrice(s.card)} 币/张</span></span>
        <span class="dep-stepper">
          <button class="mini-btn ok" data-act="exStash" data-i="${i}" ${fits ? '' : 'disabled'}
            title="${fits ? '放入仓库' : '仓库容量不足'}">[[icon:archive]] 入库</button>
        </span>
      </div>`;
    }).join('');
    const shaRow = shaN
      ? `<div class="pk-row dep-row locked"><span>[[icon:cards]] [[icon:lock]] <b>初始攻击</b> ×${shaN}
          <span class="dim">· 初始牌不可入库（每局自动携带 ${MAP.rules.starterSha} 张）</span></span>
          <span class="dim">遗落</span></div>`
      : '';
    const totalLeft = extractLeft.reduce((a, b) => a + b.count, 0);
    game.state = 'done';
    _set_cardPageOpen(false);   // 整理页必须点「完成整理」结束（防止 Esc 绕过丢失提醒）
    UI.registerHelp('extract', {
      title: '整理入库说明',
      html: `
        <p class="help-item"><b>背包卡牌</b>点击「入库」放回仓库；仓库容量不足时无法入库，未入库的卡牌将在撤离中丢失。</p>
        <p class="help-item"><b>自动入库</b>木材/口粮自动入库（纯资源没有丢弃的意义）；消耗口袋自动回收（基地/火堆可复原）；「初始攻击」不可入库（每局自动携带）。</p>
        <p class="help-item"><b>仓库容量</b>可在基地「升级」页用 [[icon:wood]] 木材×${MAP.rules.stashUpgradeWood} 扩建 +${MAP.rules.stashUpgradeSlots} 张；仓库里的卡牌下次出发时可以携带。</p>`,
      back: () => renderExtractStash(),
    });
    UI.showOverlay('', `
      <div class="pg hub" id="exMain">
        <header class="hub-head">
          <h2>[[icon:exit]] 撤离成功 · 整理入库</h2>
          ${UI.helpBtn('extract')}
          <span class="sub">把背包中的物品放回仓库——未入库的卡牌将在撤离中丢失</span>
          <span class="pg-spacer"></span>
          <span class="hub-res">
            <span class="res-chip">[[icon:archive]] 仓库容量 <b class="${room <= 0 ? 'fulled' : ''}">${B.stashUsed()}/${B.stashCap()}</b> 张</span>
            <span class="res-chip">[[icon:coin]] 随身币不带回（<b>${game.coins}</b> 币留在局中）</span>
          </span>
        </header>
        <div class="dep-body">
          <section class="hub-card">
            <h3>[[icon:bag]] 背包卡牌</h3>
            <div class="dep-list">${rows || '<p class="ov-empty" style="margin:6px 0 0">背包里没有可入库的卡牌。</p>'}${shaRow}</div>
          </section>
          <section class="hub-card">
            <h3>[[icon:archive]] 自动入库</h3>
            <div class="pk-row"><span>[[icon:wood]] 木材 ×<b>${woodN}</b></span><span class="dim">已入库（扩建背包/仓库用）</span></div>
            <div class="pk-row"><span>[[icon:bread]] 口粮 ×<b>${ratN}</b></span><span class="dim">已入库（升级安全格用）</span></div>
            ${otherN ? `<div class="pk-row"><span>[[icon:bag]] 其余物资 ×<b>${otherN}</b></span><span class="dim">未能带出 · 价值已计入本局得分</span></div>` : ''}
            <div class="pk-row"><span>[[icon:pocket]] 消耗口袋</span><span class="dim">已自动回收（基地可复原）</span></div>
            ${extractLeft.length ? `<button class="ov-btn ok" data-act="exAll" ${room > 0 && totalLeft <= room ? '' : 'disabled'}
              style="width:100%">[[icon:archive]] 全部入库（${Math.min(totalLeft, room)}/${totalLeft} 张可入）</button>` : ''}
            <div class="dep-foot" style="margin-top:10px">
              <button id="btnDeploy" data-act="exFinish">[[icon:check]] 完成整理${extractLeft.length ? `（${totalLeft} 张将丢失）` : ''}</button>
            </div>
          </section>
        </div>
      </div>`, 'page');
    UI.act('exStash', (d) => {
      const s = extractLeft[+d.i];
      if (!s) return;
      const r = B.stashRoom();
      if (r <= 0) return;
      const take = Math.min(s.count, r);
      B.depositCards([{ card: s.card, count: take }]);
      SDT.Meta.track('stash', { count: take });
      Sfx.ding();
      UI.log(`[[icon:archive]] 【<b>${esc(s.card.name)}</b>】×${take} 已放入仓库`, 'loot');
      s.count -= take;
      if (s.count <= 0) extractLeft.splice(+d.i, 1);
      renderExtractStash();
    });
    UI.act('exAll', () => {
      let n = 0;
      const room = B.stashRoom();
      let left = room;
      for (const s of extractLeft.slice()) {
        if (left <= 0) break;
        const take = Math.min(s.count, left);
        B.depositCards([{ card: s.card, count: take }]);
        SDT.Meta.track('stash', { count: take });
        s.count -= take;
        left -= take;
        n += take;
        if (s.count <= 0) extractLeft.splice(extractLeft.indexOf(s), 1);
      }
      if (n) { Sfx.ding(); UI.log(`[[icon:archive]] 共 <b>${n}</b> 张卡牌已放入仓库`, 'loot'); }
      renderExtractStash();
    });
    UI.act('exFinish', () => showExtractDone());
  }

  // 整理完成 → 撤离结算（回基地 / 再出发）
  function showExtractDone() {
    const B = SDT.Base;
    extractLeft = null;
    const woodN = game.inventory.filter(i => i.name === '木材').reduce((a, b) => a + b.count, 0);
    const ratN = game.inventory.filter(i => i.name === '口粮').reduce((a, b) => a + b.count, 0);
    const total = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
    const s = Math.floor(game.elapsed);
    const timeStr = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    UI.log(`<b>[[icon:exit]] 撤离成功！</b>共 ${game.turn - 1} 次行动；运回基地：木材×${woodN}、口粮×${ratN}，仓库现有 ${B.stashUsed()}/${B.stashCap()} 张`, 'ok');
    nodeShell({
      tone: 'exit', icon: '[[icon:exit]]', title: '撤离成功',
      sub: `用时 <b>${timeStr}</b> · 行动 <b>${game.turn - 1}</b> 次 · 剩余生命 <b style="color:#7fdd9c">${game.hp}/${game.maxHp}</b> ·
        本局携带 <b class="gold">${game.coins} 币</b>（留在局中） · 物资价值 <b class="gold">¥${total.toLocaleString()}</b>`,
      body: `
        <p class="ov-note">[[icon:home]] 已运回基地：[[icon:wood]] 木材 ×${woodN} · [[icon:bread]] 口粮 ×${ratN} · [[icon:archive]] 仓库 <b>${B.stashUsed()}/${B.stashCap()}</b> 张 ·
          [[icon:sparkles]] 图鉴 <b>${Object.keys(B.data.collection).length}</b></p>
        <p class="ov-note">下次出发时可以从仓库选择卡牌携带；储备币 <b>${B.data.coins}</b> 币将作为开局币随身带走。</p>`,
      foot: `
        <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
        <button class="ov-btn ok" data-act="again">[[icon:runner]] 再出发</button>`,
    });
    UI.act('goBase', () => { UI.hideOverlay(); openBaseHub('deploy'); });
    UI.act('again', () => { UI.hideOverlay(); openBaseHub('deploy'); });
    UI.refresh(game);
  }

// —— 开发者工具：devTools 面板一键强制进战斗，跳过走格子（2026-09-09 老板任务）——
// BOSS 战自动编满牌库并开打；仅开发调试用，不改变战斗本身的任何规则
function devForceBattle(isBoss) {
  if (game.battleActive || game.state === 'modal') { UI.log('[[icon:lock]] 当前状态无法直接开战，先回到棋盘', 'warn'); return; }
  if (!game.ownedCards || !game.ownedCards.length) { UI.log('[[icon:cards]] 还没有随身卡牌，先开一局再试', 'warn'); return; }
  if (isBoss) {
    const b = MAP.altar.bosses[0];
    SDT.Battle.start(game, scaledEnemy(b), { isBoss: true, returnTo: 'altar', name: b.name });
    UI.log(`[[icon:tools]] 开发者：强制进入 BOSS 战【${esc(b.name)}】`, 'sys');
    const snap = SDT.Battle.getSnapshot();
    if (snap.deckSelection) {
      const cap = Math.min(snap.deckSelection.need, snap.deckSelection.cards.length);
      while (SDT.Battle.getSnapshot().deckSelection.selected.length < cap) {
        const next = SDT.Battle.getSnapshot().deckSelection.cards.find(c => !SDT.Battle.getSnapshot().deckSelection.selected.includes(c.uid));
        if (!next) break;
        SDT.Battle.commands.selectDeckCard(next.uid);
      }
      SDT.Battle.commands.confirmDeck();
    }
  } else {
    const list = buildEncounter(game.layerIdx);
    SDT.Battle.start(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
      risk: list.risk, strategy: list.strategy });
    UI.log('[[icon:tools]] 开发者：强制进入遭遇战', 'sys');
  }
}

export { bindRunMixins, moveTo, openAltarRitual, openClassChoice, openShop, showRunTransition, devForceBattle };
