import { CHARACTERS, characterFor, characterName } from './characters.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { FX, MAP, bagCap } from './game.session.js';
import { tone } from './sound.js';
import { escAttr } from './shared.js';
import { cellCenter, clearSave, curLayer, enterLayer, gainCoins, game, modeCfg, newUid, pick, rndDice, saveGame, scaledEnemy, syncPlayTime, usedSlots, weighted } from './game.session.js';
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
  // 掷骰序号：每次 roll 自增。作用：作废旧一掷的 5s 看门狗——连续快掷时，
  // 旧看门狗醒来会命中新一掷的 rolling 窗口（state==='rolling' 检查挡不住它），
  // 叠加一次 moveBy 造成两条步进链并发（棋子乱跳 + 落格双重结算 + 双重存档）。
  let rollSeq = 0;
  function roll() {
    if (game.state !== 'idle') return;
    game.state = 'rolling';
    const seq = ++rollSeq;
    SDT.Sound.sfx('dice');
    // 体力系统（2026-09-06）：每掷一次骰子 -1，≤10 警告，0 时无法撤离
    if (game.stamina == null) game.stamina = MAP.rules.staminaMax;
    game.stamina = Math.max(0, game.stamina - 1);
    if (game.stamina === 0) UI.log('[[icon:hourglass]] <b>体力耗尽！</b>你已无法撤离——立刻寻找补给或降低消耗', 'warn');
    else if (game.stamina <= MAP.rules.staminaWarn) UI.log(`[[icon:hourglass]] <b>体力告急</b>：仅剩 ${game.stamina} 点`, 'warn');
    const fixed = game.devMode && game.nextDice > 0;
    const n = fixed ? game.nextDice : rndDice();
    UI.el.diceFace.classList.add('rolling');
    UI.drawDice(n); // 立方体带整圈翻转的 transition，滚到 n 点朝前的朝向
    setTimeout(() => {
      UI.el.diceFace.classList.remove('rolling');
      UI.popNum(UI.el.diceFace);
      game.dice = n;
      game.diceHistory.push(n);
      game.turn++;
      SDT.Meta.track('action');
      UI.log(`[[icon:dice]] 掷出 <b>${n}</b> 点${fixed ? '（开发者固定）' : ''}，顺时针移动 ${n} 格`, 'sys');
      UI.refresh(game);
      moveBy(n);
    }, 640);
    // 防卡死看门狗（2026-09-06 #30）：动画中断导致停留在 rolling 时强制续行
    // （seq 检查：只认自己这一掷，已被新一掷作废的旧看门狗直接退场）
    setTimeout(() => {
      if (game.state === 'rolling' && seq === rollSeq) {
        UI.el.diceFace.classList.remove('rolling');
        moveBy(n);
      }
    }, 5000);
  }

  function moveBy(n) {
    game.state = 'moving';
    const layer = curLayer();
    const count = layer.logical.length; // 火堆合并后按逻辑格计数，避免越界
    const target = (game.trackPos + n) % count;
    preloadCellScene(layer, target);
    game.moveTarget = target;
    const stepIn = () => {
      if (game.trackPos === target) { game.hop = 0; game.moveTarget = null; resolveCell(); return; }
      const next = (game.trackPos + 1) % count;
      animateStep(next, () => {
        game.trackPos = next;
        game.pos = cellCenter(game.layerIdx, next);
        stepIn();
      });
    };
    stepIn();
  }

  function animateStep(idx, done) {
    const from = { ...game.pos }, to = cellCenter(game.layerIdx, idx);
    game.hop = 1;
    const t0 = performance.now(), dur = MAP.rules.stepMs;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      game.pos.x = from.x + (to.x - from.x) * p;
      game.pos.y = from.y + (to.y - from.y) * p;
      game.hop = 1 - p;
      if (p < 1) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
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
    game.state = 'modal';
    return new Promise(resolve => {
      let done = false;
      let timer = null;
      const finish = () => {
        if (done) return;
        done = true;
        if (timer) clearTimeout(timer);
        UI.hideOverlay();
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
      const n = game.chainMove;
      game.chainMove = 0;
      moveBy(n);
      return;
    }
    game.state = 'idle';
    saveGame();
    UI.refresh(game);
  }

  // 拾取页：杀戮尖塔式右栏——拾获叙事 + 大字收益 + 继续按钮
  function openPickupPage(kind, gain, onDone) {
    const f = SCENES[kind];
    nodeShell({ tone: 'pickup', asset: PICKUP_BG[kind], icon: f.icon, title: f.title,
      sub: pick(f.lines),
      body: `<p class="gain-big">${gain}</p>
        <button class="evt-opt ok" data-act="pickupGo"><b>继 续</b></button>` });
    UI.act('pickupGo', () => { UI.hideOverlay(); onDone(); });
  }

  // ---------- 遭遇组建（设计者 2026-09-02 定版：按环层抽怪，1-3 只，越内层越强） ----------
  function buildEncounter(layerIdx) {
    const enc = MAP.encounters[layerIdx] || MAP.encounters[0];
    let pool = enc.pool, size = enc.size;
    let strategy = enc.strategy || '';
    let risk = enc.risk || (MAP.layers[layerIdx] && MAP.layers[layerIdx].risk) || '中';
    if (enc.elite && Random.random('enemy') < enc.elite.chance) { pool = enc.elite.pool; size = enc.elite.size; strategy = enc.elite.strategy || strategy; risk = '精英'; }
    const n = size[0] + Math.floor(Random.random('enemy') * (size[1] - size[0] + 1));
    const list = [];
    for (let i = 0; i < n; i++) {
      const tpl = MAP.monsters[pool[Math.floor(Random.random('enemy') * pool.length)]];
      list.push(scaledEnemy({ ...tpl }));
    }
    // 2026-09-06 #6：外层遭遇含掠夺者(3-3)时，敌人数量至少 3（掠夺者成群出没）
    if (layerIdx === 0 && list.some(e => e.id === 'bandit') && list.length < 3) {
      while (list.length < 3) {
        const tpl = MAP.monsters[pool[Math.floor(Random.random('enemy') * pool.length)]];
        list.push(scaledEnemy({ ...tpl }));
      }
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

    // 杀戮尖塔式房间切换：从落脚开始到本格全部结算完成，地图始终由全屏房间页取代。
    UI.beginRoom();

    // 落点脉冲（按事件类型着色）
    const PULSE_COL = { coin: '#f5c542', chest: '#f5c542', key: '#f5c542', fire: '#f2854a',
      shop: '#52d273', battle: '#ff6b5e', rations: '#7fdd9c', wood: '#c8956a',
      event: '#41d0a8', emergencyExit: '#52d273' };
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
        if (altarE) { enterNode('altar', () => openAltarEntranceModal(altarE, def)); return; }
        finishInstant();
      });
      return;
    }

    // 2.5) 事件卡连锁移动（保留兜底：时空孔隙「前进 6 格」）
    if (game.chainMove) {
      const n = game.chainMove;
      game.chainMove = 0;
      moveBy(n);
      return;
    }

    // 3) 节点类：门 / 祭坛入口 / 紧急撤离 / 商店统一经过短过场。
    if (door) { enterNode('door', () => openDoorModal(door, def)); return; }
    if (altarE) { enterNode('altar', () => openAltarEntranceModal(altarE, def)); return; }
    if (def && def.type === 'emergencyExit') { enterNode('emergencyExit', openEmergencyModal); return; }
    if (def && def.type === 'shop') { enterNode('shop', openShop); return; }

    game.state = 'idle';
    saveGame();
    UI.refresh(game);
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
      case 'chest': openChestsOnCell([{ kind: 'small' }]); break;   // 物资格：开 1 个小型遗留物资箱
      case 'rations': {
        // 2026-09-06 #11：口粮同样以卡牌形式入包
        const card = SDT.Cards.all().find(c => c.id === 'tt-rations');
        const cnt = MAP.items.rations.count || 1;
        openPickupPage('rations', `口粮卡 ×${cnt}`, () => {
          for (let i = 0; i < cnt && card; i++) game.grantCard(card);
          done();
        });
      } break;
      case 'key': openPickupPage('key', `钥匙 ×1`, () => { game.addItem(MAP.items.key); done(); }); break;
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

  // 把库里的卡发给玩家（同名并入现有格不受容量限制，与商店购买同规则）
  function grantEventCard(tpl) {
    if (!tpl) return false;
    if (!game.ownedCards.some(o => o.card.name === tpl.name) && usedSlots() >= bagCap()) {
      UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格），【${esc(tpl.name)}】掉在了原地…`, 'warn');
      return false;
    }
    game.ownedCards.push({ uid: newUid(), card: { ...tpl } });
    UI.log(`[[icon:archive]] 获得卡牌【<b>${esc(tpl.name)}</b>】`, 'loot');
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
    SDT.Sound.sfx('levelup');
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
  function openPocketRestore(picks, done) {
    game.state = 'modal';
    let left = picks;
    const render = () => {
      const rows = game.usedPocket.length
        ? game.usedPocket.map((p, i) => `
            <div class="pk-row"><span>[[icon:cards]] <b>${esc(p.card.name)}</b>${p.count > 1 ? ` ×${p.count}` : ''}</span>
            <button class="mini-btn ok" data-act="restoreOne" data-i="${i}" ${left <= 0 ? 'disabled' : ''}>复原一张</button></div>`).join('')
        : '<p class="ov-empty" style="margin:2px 0 0">（消耗口袋是空的——对小怪用过的卡牌会进入这里）</p>';
      nodeShell({
        tone: 'fire', icon: '[[icon:fire]]', title: '营火休整',
        sub: `还可从消耗口袋中复原 <b>${left}</b> 张（最多 ${picks} 张）`,
        body: `<div class="pk-list">${rows}</div>`,
        foot: `<button class="ov-btn ok" data-act="fireDone">[[icon:runner]] 继续旅程</button>`,
      });
    };
    const finish = () => { UI.hideOverlay(); if (done) done(); };
    UI.act('restoreOne', (d) => {
      const p = game.usedPocket[+d.i];
      if (!p || left <= 0) return;
      // 2026-09-06 #18：背包满时不能复原
      if (usedSlots() >= bagCap()) { UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原`, 'warn'); SDT.Sound.sfx('deny'); return; }
      const card = p.card;
      p.count--;
      if (p.count <= 0) game.usedPocket.splice(+d.i, 1);
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
    const picks = CHARACTERS.map(c => c.rulesetId).filter(cl => SDT.Cards.classPool(cl).length);
    if (!picks.length) return;
    game.state = 'modal';
    let sel = null;
    let view = 'select'; // 'select' 主选角页 | 'pool' 二级卡池页
    const poolCount = cl => SDT.Cards.classPool(cl).length;
    // 主选角页：左侧全角色网格，右侧大幅立绘 + 背景故事 + 出发任务；卡池收进二级页
    const render = () => {
      if (view === 'pool') return renderPool();
      const story = sel ? characterFor(sel) : null;
      const lv = sel ? SDT.Meta.classLv(sel) : 0;
      UI.showOverlay('[[icon:medal]] 选择你的角色', `
        <div class="pg cls-page">
          <header class="pg-head">
            <h2>[[icon:medal]] 选择你的角色</h2>
            <span class="sub">本次对战从全部角色中自由选择 1 个 · 确认后获得 2 张该角色的随机卡牌（与 5 张「初始攻击」、1 张「火球」一起带入背包）</span>
          </header>
          <div class="cls-body">
            <div class="cls-grid">${picks.map(cl => `
              <button class="cls-pick${cl === sel ? ' sel' : ''}" data-act="selClass" data-cls="${escAttr(cl)}" title="查看 ${escAttr(cl)}">
                <span class="cls-pick-art">${SDT.Art.classArt(cl)}</span>
                <b>${esc(characterName(cl))}</b>
                <span class="cls-pick-lv">熟练度 Lv.${SDT.Meta.classLv(cl)}</span>
              </button>`).join('')}</div>
            <aside class="cls-detail hub-card">
              ${sel && story ? `
                <div class="cls-figure">${SDT.Art.classFullArt(sel)}</div>
                <div class="cls-detail-head">
                  <div class="cls-detail-meta">
                    <b class="cls-detail-name">${esc(characterName(sel))}</b>
                    <span class="cls-detail-tag">${esc(story.tag)}</span>
                    <span class="cls-detail-lv">熟练度 Lv.${lv} · ${SDT.Meta.perkText(lv)}</span>
                  </div>
                </div>
                <h3>背景故事</h3>
                <p class="cls-story">${esc(story.bg)}</p>
                <h3>出发任务</h3>
                <p class="cls-story">${esc(story.task)}</p>
                <button class="ov-btn cls-pool-btn" data-act="clsPool">[[icon:cards]] 查看角色卡池（${poolCount(sel)} 张）</button>
              ` : `
                <p class="cls-empty">[[icon:medal]]<br>从左侧选择一个角色<br>查看立绘、背景故事与出发任务</p>
              `}
            </aside>
          </div>
          <footer class="cls-foot">
            <button class="ov-btn ok" data-act="pickClass" ${sel ? '' : 'disabled'}>${sel ? `确 认 · ${esc(characterName(sel))}` : '请先选择角色'}</button>
          </footer>
        </div>`, 'page');
    };
    // 二级页：该角色的卡池全览
    const renderPool = () => {
      const pool = SDT.Cards.classPool(sel);
      UI.showOverlay(`[[icon:cards]] ${esc(characterName(sel))} · 角色卡池`, `
        <div class="pg cls-page cls-pool-page">
          <header class="pg-head">
            <h2>[[icon:cards]] ${esc(characterName(sel))} · 角色卡池（${pool.length} 张）</h2>
            <span class="sub">确认选择「${esc(characterName(sel))}」后，从以下卡池中随机获得 1 张（与 5 张「初始攻击」一起带入背包）</span>
          </header>
          <div class="cls-pool cls-pool-full">${pool.map(c => SDT.Cards.cardHTML(c, 'sm')).join('')}</div>
          <footer class="cls-foot">
            <button class="ov-btn" data-act="clsBack">[[icon:medal]] 返回选角</button>
            <button class="ov-btn ok" data-act="pickClass">确 认 · ${esc(characterName(sel))}</button>
          </footer>
        </div>`, 'page');
    };
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
      // 熟练度加成：每级（Lv.1 起）生命上限 +2，立即生效
      const lv = SDT.Meta.classLv(cl);
      if (lv > 1) {
        const bonus = (lv - 1) * 2;
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
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
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
    const sceneMeta = EVENT_SCENE_META[card.id] || ['event-custom', 'scene-event-custom', 'scene-event-custom'];
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
    if (narrative) return narrative.choices.map(choice => {
      const narrate = () => {
        const result = choice.choose();
        if (result) UI.log(`[[icon:notes]] ${esc(result)}`, 'sys');
      };
      const effects = {
        goldmine_safe: settle(() => { narrate(); gainCoins(3); }),
        goldmine_deep: settle(() => { narrate(); gainCoins(6); game.hp = Math.max(1, game.hp - 3); UI.log('[[icon:tools]] 挖矿过深，获得 6 币但损失 3 血', 'warn'); }),
        airdrop_wood: settle(() => { narrate(); game.addItem(MAP.items.wood, 1); }),
        airdrop_rations: settle(() => { narrate(); game.addItem(MAP.items.rations, 1); }),
        airdrop_heal: settle(() => { narrate(); game.heal(3); }),
        chest_small: () => { narrate(); openChestsOnCell([{ kind: 'small' }], '你选择了稳妥的小型物资箱'); },
        chest_medium: () => { narrate(); openChestsOnCell([{ kind: 'medium' }], '你选择了高风险的密封物资箱'); },
        timeskip_move: settle(() => { narrate(); UI.log('[[icon:crystal]] 时空孔隙把你向前卷了 <b>6</b> 格！', 'sys'); game.chainMove = 6; }),
        relief_heal: settle(() => { narrate(); UI.log('[[icon:heart]] 爱心救济站为你处理了伤口', 'ok'); game.heal(6); }),
        mystery_supply: settle(() => { narrate(); grantEventCard(SDT.Cards.all().find(c => c.name === '彩色令牌')); gainCoins(2); }),
        systemsupply_restock: settle(() => { narrate(); grantEventCard(SDT.Cards.all().find(c => c.name === '彩色令牌')); game.addItem(MAP.items.wood, 1); }),
        demondeal_trade: settle(() => {
          narrate();
          game.hp = Math.max(1, game.hp - 1);
          UI.log('[[icon:demon]] 恶魔收走了一点生命力（-1 血）', 'warn');
          const legends = SDT.Cards.all().filter(c => c.rarity === '传说' && ['装备', '武术', '法术'].includes(c.type));
          grantEventCard(legends.length ? legends[Math.floor(Random.random('card') * legends.length)] : null);
        }),
        bandits_fight: () => {   // 战斗与开箱路径自管收尾，不走 settle（同 chest_*）
          narrate();
          UI.log('[[icon:swords]] 掠夺者一伙（×5）拦住了去路！', 'warn');
          game.pendingEventLoot = { text: '密封物资箱 ×2', chests: ['medium', 'medium'] };
          game.state = 'modal';
          const tpl = MAP.monsters.bandit;
          const gang = [];
          for (let i = 0; i < 5; i++) gang.push(scaledEnemy({ ...tpl }));
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
      default:
        UI.log('（该事件的效果将在后续版本实装）', 'dim');
    }
    saveGame();
  }

  // ---------- 节点弹窗 ----------
  function openDoorModal(door, cellDef) {
    game.state = 'modal';
    game.discoveredPairs.add(door.pair);
    const target = MAP.layers[door.toLayer];
    nodeShell({
      tone: 'door', icon: '[[icon:door]]', title: '环间门',
      sub: `这道隔离闸门连通 <b>${target.name}</b>，可自由往返${door.exit ? '；也可选择就此撤离' : ''}`,
      body:
        nodeOpt('goDoor', `${door.reverse ? '返回' : '进入'}${target.name}`, '穿过闸门，前往另一环', 'ok') +
        (door.exit ? nodeOpt('extractNow', '就此撤离', '带着背包立即结算撤离', 'ok') : '') +
        (cellDef && cellDef.type === 'shop' ? nodeOpt('doorShop', '逛商队', '闸门旁的拾荒商队还在营业') : '') +
        nodeOpt('stayHere', '留下', '留在当前格子，稍后再决定'),
    });
    UI.act('extractNow', () => { UI.hideOverlay(); doExtract(); });
    UI.act('goDoor', () => {
      UI.hideOverlay();
      UI.log(`穿过隔离闸门 → <b>${target.name}</b>`, 'sys');
      enterLayer(door.toLayer, door.arriveAt);
    });
    UI.act('doorShop', () => openShop());
    UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
    UI.refresh(game);
  }

  function openAltarEntranceModal(altarE, cellDef) {
    game.state = 'modal';
    game.discoveredPairs.add(altarE.pair);
    nodeShell({
      tone: 'altar', icon: '[[icon:crystal]]', title: '污染核心入口',
      sub: '污染核心盘踞着三只变异体首脑：锈蚀将军(5-50) / 辐射领主(8-48) / 兽群之主(4-45)，各怀词缀，小心应对',
      body:
        nodeOpt('enterAltar', '深入污染区', '踏入辐射结晶之中，挑战盘踞的变异体首脑', 'ok') +
        (cellDef && cellDef.type === 'shop' ? nodeOpt('doorShop', '逛商队', '入口处的拾荒商队还在营业') : '') +
        nodeOpt('stayHere', '留下', '留在当前格子，稍后再决定'),
    });
    UI.act('enterAltar', () => {
      // 2026-09-06 #27：BOSS 牌库需 15 张，无法准备 → 被赶出祭坛退回上一格
      const selectable = game.ownedCards.filter(o => !['道具', '资源', '事件', '生物'].includes(o.card.type) && o.card.name !== '初始攻击').length
        + Math.min(game.ownedCards.filter(o => o.card.name === '初始攻击').length, MAP.rules.starterSha);
      if (selectable < MAP.rules.bossDeckSize) {
        UI.log(`[[icon:crystal]] 可用卡牌不足 <b>${MAP.rules.bossDeckSize}</b> 张（现有 ${selectable}），无法挑战污染核心——被赶出了祭坛`, 'warn');
        SDT.Sound.sfx('error');
        game.layerIdx = game.layerIdx;   // 保持当前层
        game.trackPos = Math.max(0, game.trackPos - 1);
        game.pos = cellCenter(game.layerIdx, game.trackPos);
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
        return;
      }
      game.altarFrom = { li: game.layerIdx, idx: game.trackPos, pair: altarE.pair };
      game.pos = { ...game.centerPos[0] };   // 中央祭坛结点
      UI.hideOverlay();
      UI.log('踏入<b>污染核心</b>……盖革计数器的咔嗒声密了起来', 'sys');
      openAltarModal();
    });
    UI.act('doorShop', () => openShop());
    UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
    UI.refresh(game);
  }

  // 背包献祭选卡器（2026-09-06 #26）：从背包选 n 张卡，确认后消耗并回调
  function openBagSacrifice(n, done) {
    game.state = 'modal';
    const sel = new Set();
    const render = () => {
      const rows = game.ownedCards.map(o => `
        <button class="pk-row sac-row${sel.has(o.uid) ? ' sac-sel' : ''}" data-act="sacPick" data-uid="${escAttr(o.uid)}">
          <span>[[icon:cards]] <b>${esc(o.card.name)}</b>${o.card.cost != null ? ` · ${o.card.cost} 费` : ''}</span>
          <span>${sel.has(o.uid) ? '[[icon:cross]] 已选' : ''}</span>
        </button>`).join('');
      UI.showOverlay('[[icon:crystal]] 选择要献祭的卡牌', `
        <p class="ov-note">选择 <b>${n}</b> 张卡牌献祭（已选 <b>${sel.size}</b>）</p>
        <div class="sac-list">${rows}</div>
        <div class="scene-ops">
          <button class="ov-btn ok" data-act="sacConfirm" ${sel.size !== n ? 'disabled' : ''}>[[icon:crystal]] 确认献祭</button>
          <button class="ov-btn" data-act="sacCancel">[[icon:exit]] 取消</button>
        </div>`);
    };
    UI.act('sacPick', (d) => {
      const o = game.ownedCards.find(x => x.uid === d.uid);
      if (!o) return;
      if (sel.has(o.uid)) sel.delete(o.uid);
      else if (sel.size < n) sel.add(o.uid);
      Sfx.tick();
      render();
    });
    UI.act('sacCancel', () => { UI.hideOverlay(); openAltarModal(); });
    UI.act('sacConfirm', () => {
      const chosen = game.ownedCards.filter(o => sel.has(o.uid));
      game.ownedCards = game.ownedCards.filter(o => !sel.has(o.uid));
      UI.hideOverlay();
      done(chosen);
    });
    render();
  }

  function openAltarModal() {
    game.state = 'modal';
    const bosses = MAP.altar.bosses.map(b => scaledEnemy(b));
    const btns = bosses.map((b, i) => {
      const aff = b.affix ? MAP.altar.bosses[i].affixDesc : '';
      return `<button class="evt-opt danger withart" data-act="fightBoss" data-i="${i}">
        <span class="evt-opt-art">${SDT.Art.has(b.id) ? SDT.Art.monsterArt(b.id) : ''}</span>
        <span class="evt-opt-txt"><b>${esc(b.name)}（${b.atk}-${b.hp}）</b><span>${esc(aff || 'BOSS 战使用过的卡牌不会消耗')}</span></span>
      </button>`;
    }).join('');
    const eliteTip = modeCfg().enemyMul !== 1 ? ` · 精英 ×${modeCfg().enemyMul}` : '';
    nodeShell({
      tone: 'altar', icon: '[[icon:crystal]]', title: '污染核心 · 变异巢穴',
      sub: `选择挑战的 BOSS（BOSS战使用过的卡牌不会消耗${eliteTip}）`,
      body: btns +
        nodeOpt('altarSacrificeLegend', '献祭 3 张卡牌', '消耗背包中 3 张卡牌，随机获取 1 张传说卡') +
        nodeOpt('altarSacrificeHero', '献祭 5 张卡牌', '消耗背包中 5 张卡牌，获得 1 张本职业英雄卡') +
        nodeOpt('altarRestore3', '复原消耗卡', '从消耗口袋中选择 3 张卡牌复原回背包') +
        nodeOpt('leaveAltar', '撤离污染区', '退回入口格，从长计议'),
    });
    UI.act('fightBoss', (d) => {
      const b = MAP.altar.bosses[+d.i];
      SDT.Battle.start(game, scaledEnemy(b), { isBoss: true, returnTo: 'altar', name: b.name });
    });
    UI.act('leaveAltar', () => {
      UI.hideOverlay();
      const f = game.altarFrom;
      if (f) {
        game.layerIdx = f.li; game.trackPos = f.idx;
        game.pos = cellCenter(f.li, f.idx);
      }
      game.state = 'idle';
      UI.log('退出污染核心，回到入口格', 'dim');
      UI.refresh(game);
    });
    // 2026-09-06 #26：献祭换卡与消耗卡复原
    UI.act('altarSacrificeLegend', () => {
      openBagSacrifice(3, (chosen) => {
        const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
        const card = pool.length ? pick(pool) : null;
        if (card) game.grantCard(card);
        UI.log(`[[icon:crystal]] 献祭 ${chosen.map(o => `【${esc(o.card.name)}】`).join('')}，祭坛回赠传说卡【<b>${esc(card ? card.name : '???')}</b>】`, 'loot');
        saveGame();
        openAltarModal();
      });
    });
    UI.act('altarSacrificeHero', () => {
      openBagSacrifice(5, (chosen) => {
        const pool = SDT.Cards.classPool(game.myClass).filter(c => c.type === '英雄卡');
        const card = pool.length ? pick(pool) : null;
        if (card) game.grantCard(card);
        UI.log(`[[icon:crystal]] 献祭 ${chosen.map(o => `【${esc(o.card.name)}】`).join('')}，祭坛回赠本职业英雄卡【<b>${esc(card ? card.name : '???')}</b>】`, 'loot');
        saveGame();
        openAltarModal();
      });
    });
    UI.act('altarRestore3', () => {
      openPocketRestore(3, () => {
        saveGame();
        openAltarModal();
      });
    });
    UI.refresh(game);
  }

  function openEmergencyModal() {
    game.state = 'modal';
    const can = game.coins >= MAP.rules.emergencyExitCost;
    nodeShell({
      tone: 'exit', icon: '[[icon:cross]]', title: '紧急撤离点',
      sub: `花费 <b>${MAP.rules.emergencyExitCost}</b> 币立即撤离（你有 <b class="gold">${game.coins}</b> 币）`,
      body:
        nodeOpt('payExit', '花币撤离', `支付 ${MAP.rules.emergencyExitCost} 币，立即结算撤离`, can ? 'ok' : '') +
        nodeOpt('stayHere', '留下', '继续探索本环，撤离点随时还在'),
    });
    UI.act('payExit', () => {
      if (game.coins < MAP.rules.emergencyExitCost) { UI.log('币不够，无法紧急撤离', 'warn'); SDT.Sound.sfx('error'); return; }
      game.coins -= MAP.rules.emergencyExitCost;
      UI.log(`支付 ${MAP.rules.emergencyExitCost} 币，启动紧急撤离`, 'sys');
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
    // 体力系统（2026-09-06 #29）：体力为 0 时撤离失败
    if ((game.stamina == null ? MAP.rules.staminaMax : game.stamina) <= 0) {
      UI.log('[[icon:hourglass]] <b>体力耗尽</b>——你瘫倒在撤离信标旁，撤离失败！', 'warn');
      SDT.Sound.sfx('error');
      UI.hideOverlay();
      game.state = 'idle';
      UI.refresh(game);
      return;
    }
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

export { bindRunMixins, openAltarModal, openClassChoice, openShop, roll, showRunTransition };
