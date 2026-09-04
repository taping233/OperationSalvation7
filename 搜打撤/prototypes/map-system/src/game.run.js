/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { FX, MAP, bagCap } from './game.core.js';
import { BUILD_VERSION, assetUrl } from './asset-url.js';
import { tone } from './sound.js';
import { escAttr } from './shared.js';
import { opts } from './battle.core.js';
import { cellCenter, clearSave, curLayer, enterLayer, gainCoins, game, modeCfg, newUid, pick, rndDice, saveGame, scaledEnemy, syncPlayTime, usedSlots, weighted } from './game.core.js';
import { openBaseHub } from './game.hub.js';
import { Sfx, cardHTML, _set_cardPageOpen } from './game.cardslib.js';
  function roll() {
    if (game.state !== 'idle') return;
    game.state = 'rolling';
    SDT.Sound.sfx('dice');
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
  const SCENES = {
    battle: { icon: '[[icon:swords]]', title: '遭遇战', tone: 'battle', btn: '应 战',
      lines: ['{name}从废墟的阴影中逼近，战斗一触即发！', '脚步声戛然而止——{name}发现了你！',
        '「这片废土是我的猎场。」{name}拦住了去路。', '沙尘翻涌，{name}的轮廓自辐射尘雾中缓缓显形……'] },
    shop: { icon: '[[icon:bag]]', title: '拾荒商队', tone: 'shop', btn: '看看货品',
      lines: ['帆布帐篷下传来砂轮磨刀的声响：「哟，医疗队的稀客！以物易物，童叟无欺。」',
        '商队头目掀开防水布：「旧世界的玩意儿，能换你兜里的币就归你。」'] },
    event: { icon: '[[icon:question]]', title: '奇遇', tone: 'event', btn: '一探究竟',
      lines: ['盖革计数器忽然轻颤，空气里有种说不出的味道……', '脚下的碎砖微微震颤，荒土深处似有目光落在你身上。'] },
    fire: { icon: '[[icon:fire]]', title: '营火休整', tone: 'fire', btn: '坐下歇脚',
      lines: ['废料燃起的篝火噼啪作响，暖意顺着指尖爬了上来。', '有人刚离开不久——灭火的沙土还是新的。'] },
    chest: { icon: '[[icon:archive]]', title: '遗留物资', tone: 'chest', btn: '撬开柜子',
      lines: ['瓦砾半掩着一只落满灰尘的保险柜，锁扣早已锈蚀……', '物资箱的缝隙里透出微光——运气不错。'] },
    coin: { icon: '[[icon:coin]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['路边的瓦砾堆里，有什么东西闪了一下。', '「叮」——一枚旧世界硬币从锈铁皮里滚了出来。'] },
    wood: { icon: '[[icon:wood]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['一根还没被白蚁蛀空的建材斜靠在断墙边，正好能用上。'] },
    rations: { icon: '[[icon:bread]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['压扁的背囊里，居然还有未开封的应急口粮！'] },
    key: { icon: '[[icon:key]]', title: '拾获', tone: 'pick', auto: true,
      lines: ['一把泛着幽光的钥匙躺在碎石缝里——它能打开哪扇门？'] },
    door: { icon: '[[icon:door]]', title: '隔离闸门', tone: 'door', btn: '靠 近',
      lines: ['厚重的隔离闸门无声地滑开，另一侧的光影陌生而深邃。'] },
    altar: { icon: '[[icon:crystal]]', title: '污染核心', tone: 'altar', btn: '深入污染区',
      lines: ['裂谷尽头，紫色的辐射结晶在黑暗中明灭，空气凝重得令人窒息……'] },
    exit: { icon: '[[icon:exit]]', title: '撤离点', tone: 'exit', btn: '前往撤离点',
      lines: ['一枚信号弹拖着尾烟升上天空——营地的回收队就在眼前！'] },
  };
  // 场景契约：assetKey 由美术/CSS 代理消费；本层只保证稳定 ID、容器 class 与 data 属性。
  const SCENE_META = {
    battle: ['battle', 'scene-battle', 'scene-battle-bg'], shop: ['shop', 'scene-shop', 'scene-shop-bg'],
    event: ['event', 'scene-event', 'scene-event-bg'], fire: ['fire', 'scene-fire', 'scene-fire-bg'],
    chest: ['chest', 'scene-chest', 'scene-chest-bg'], door: ['door', 'scene-door', 'scene-door-bg'],
    altar: ['altar', 'scene-altar', 'scene-altar-bg'], exit: ['extract', 'scene-extract', 'scene-extract-bg'],
    coin: ['pickup-coin', 'scene-pickup scene-pickup-coin', 'scene-pickup-coin'], wood: ['pickup-wood', 'scene-pickup scene-pickup-wood', 'scene-pickup-wood'],
    rations: ['pickup-rations', 'scene-pickup scene-pickup-rations', 'scene-pickup-rations'], key: ['pickup-key', 'scene-pickup scene-pickup-key', 'scene-pickup-key'],
  };
  const EVENT_SCENE_META = {
    'tt6-timeskip': ['event-timeskip', 'scene-event-timeskip', 'scene-event-timeskip'], 'tt6-demondeal': ['event-demondeal', 'scene-event-demondeal', 'scene-event-demondeal'],
    'tt6-bandits': ['event-bandits', 'scene-event-bandits', 'scene-event-bandits'], 'tt6-mystery': ['event-mystery', 'scene-event-mystery', 'scene-event-mystery'],
    'tt6-goldmine': ['event-goldmine', 'scene-event-goldmine', 'scene-event-goldmine'], 'tt6-goldhammer': ['event-goldhammer', 'scene-event-goldhammer', 'scene-event-goldhammer'],
    'tt6-relief': ['event-relief', 'scene-event-relief', 'scene-event-relief'], 'tt6-airdrop': ['event-airdrop', 'scene-event-airdrop', 'scene-event-airdrop'],
    'tt6-chestdraw': ['event-chestdraw', 'scene-event-chestdraw', 'scene-event-chestdraw'], 'tt6-systemsupply': ['event-systemsupply', 'scene-event-systemsupply', 'scene-event-systemsupply'],
  };
  const PRELOAD_SCENES = Object.freeze({
    battle: 'battle-normal-anime-v2.png', coin: 'scene-pickup-coin-anime-v2.png',
    wood: 'scene-pickup-wood-anime-v2.png', rations: 'scene-pickup-rations-anime-v2.png',
    key: 'scene-pickup-key-anime-v2.png', fire: 'scene-fire-anime-v2.png',
    shop: 'scene-shop-anime-v2.png', emergencyExit: 'scene-extract-anime-v2.png',
    door: 'scene-door-anime-v2.png', altar: 'scene-altar-anime-v2.png'
  });
  const IMMEDIATE_SCENES = new Set(['battle', 'coin', 'wood', 'rations', 'key', 'fire']);
  let scenePreload = null;
  function preloadScene(name) {
    if (!name || (scenePreload && scenePreload.name === name)) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = assetUrl(`assets/scenes/${name}`);
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
  const NODE_BG = { door: 'scene-door-bg', altar: 'scene-altar-bg', fire: 'scene-fire-bg',
    exit: 'scene-extract-bg', shop: 'scene-shop-bg', event: 'scene-event-bg' };
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
  const PICKUP_BG = { coin: 'scene-pickup-coin', wood: 'scene-pickup-wood',
    rations: 'scene-pickup-rations', key: 'scene-pickup-key' };
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
    if (enc.elite && Math.random() < enc.elite.chance) { pool = enc.elite.pool; size = enc.elite.size; strategy = enc.elite.strategy || strategy; risk = '精英'; }
    const n = size[0] + Math.floor(Math.random() * (size[1] - size[0] + 1));
    const list = [];
    for (let i = 0; i < n; i++) {
      const tpl = MAP.monsters[pool[Math.floor(Math.random() * pool.length)]];
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

    // 杀戮尖塔式房间切换：从落脚开始到本格全部结算完成，地图始终由全屏房间页取代。
    UI.beginRoom();

    // 落点脉冲（按事件类型着色）
    const PULSE_COL = { coin: '#f5c542', chest: '#f5c542', key: '#f5c542', fire: '#f2854a',
      shop: '#52d273', battle: '#ff6b5e', rations: '#7fdd9c', wood: '#c8956a',
      event: '#41d0a8', emergencyExit: '#52d273' };
    FX.pulse(game.pos.x, game.pos.y, PULSE_COL[def && def.type] || '#d8b46a');

    // 1) 战斗格：直接进入遭遇战（无场景演出）
    if (def && def.type === 'battle') {
      openBattleCell(def, buildEncounter(game.layerIdx));
      return;
    }

    // 2) 即时效果类（币/木材/宝箱/口粮/钥匙/火堆/事件）：拾取或场景演出后再继续
    const INSTANT_TYPES = ['coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event'];
    if (def && INSTANT_TYPES.includes(def.type)) {
      runInstant(def, () => {
        // 即时效果完成 → 本格若兼为节点（如带商店的门、祭坛入口）继续节点演出
        if (door) { openDoorModal(door, def); return; }
        if (altarE) { openAltarEntranceModal(altarE, def); return; }
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

    // 3) 节点类：门 / 祭坛入口 / 紧急撤离 / 商店（跳过过渡场景，直接进入节点页）
    if (door) { openDoorModal(door, def); return; }
    if (altarE) { openAltarEntranceModal(altarE, def); return; }
    if (def && def.type === 'emergencyExit') { openEmergencyModal(); return; }
    if (def && def.type === 'shop') { openShop(); return; }

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
        const n = Math.max(1, Math.round((def.n || 1) * (modeCfg().coinMul || 1)));   // 与 gainCoins 同口径（含玩法倍率）
        openPickupPage('coin', `+${n} 币`, () => { gainCoins(def.n || 1); done(); });
        break;
      }
      case 'wood': openPickupPage('wood', `木材 +${def.n || 1}`, () => { game.addItem(MAP.items.wood, def.n || 1); done(); }); break;
      case 'chest': openChestsOnCell([{ kind: 'small' }]); break;   // 物资格：开 1 个小型遗留物资箱
      case 'rations': openPickupPage('rations', `口粮 +${MAP.items.rations.count || 1}`, () => { game.addItem(MAP.items.rations); done(); }); break;
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
      if (ev.coins) { UI.log(`【事件】${ev.text}`, 'sys'); gainCoins(ev.coins[0] + Math.floor(Math.random() * (ev.coins[1] - ev.coins[0] + 1))); }
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
  // ESM：循环导入下本模块体先于 game.core 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
  function bindRunMixins() {
    game.grantCard = grantEventCard;   // 宝箱等模块发卡（同名并入 / 容量满拒绝）
  }

  // ---------- 火堆（设计者 2026-09-02 定版：回 10 血 + 消耗口袋选 2 张复原 +
  //           30% 几率额外随机获得 1 张职业卡） ----------
  function openFireRest() {
    game.heal(MAP.rules.fireHeal);
    UI.log(`[[icon:fire]] 营火休整：清创包扎，回复 <b>${MAP.rules.fireHeal}</b> 点生命`, 'ok');
    if (Math.random() < 0.3) {
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
  const CLASS_STORY = {
    '刺客': {
      tag: '暗巷收刀人',
      bg: '旧城暗巷里最安静的影子，靠一柄短刃替商行"处理麻烦"。没人见过他出刀，只见过结果。',
      task: '潜入最深处的宝库，取回"无面者"的封印钥匙，并在追兵合围前活着撤离。',
    },
    '剑客': {
      tag: '独行的佩剑客',
      bg: '背一柄旧剑走遍十六州，只为找回被师兄带走的那半卷剑谱。剑出鞘时，从不问对方有多少人。',
      task: '循剑谱残页的线索深入遗迹，在藏经阁取得完整剑谱，带剑撤离。',
    },
    '术士': {
      tag: '禁咒的继承者',
      bg: '被学院除名的天才，因钻研禁忌咒文而被通缉。诅咒在他左臂上生长，也给他力量。',
      task: '找到先代术士的祭坛，用一场完整的禁咒仪式压制左臂的诅咒，并夺走祭坛上的秘宝。',
    },
    '法师': {
      tag: '星图测绘员',
      bg: '皇家学院的首席测绘师，毕生绘制"活动地脉"的星图。她相信宝藏的位置写在星星的偏移里。',
      task: '在遗迹深处架设三座测星仪，校准星图并回收古代魔导核心，天亮前撤离。',
    },
    '牧师': {
      tag: '灰袍巡回者',
      bg: '不属于任何教团的灰袍修士，为战乱之地的伤者包扎，也为亡者祷告。他背囊里永远有一格留给别人的药。',
      task: '护送遇险商队余部穿过战区，在圣祠取得愈合金像，全员撤离。',
    },
    '授印者': {
      tag: '守印一族的末裔',
      bg: '古老守印家族的最后一人，掌心生来就有一枚会发烫的封印。家族遗产是责任，也是追杀令。',
      task: '找回被夺走的家族印玺，在封印之地重新落印，将追猎者甩在门后。',
    },
    '降临者': {
      tag: '自云上而来',
      bg: '从没人见过他落地的那一刻——他只是某天出现在坍塌的神殿里，衣角还带着云上的风。他自己也不记得来处。',
      task: '循着本能的指引收拢散落的"天界残片"，在身体被这个世界同化之前离开。',
    },
    '召唤师': {
      tag: '灵契商行的少东家',
      bg: '灵契商行的继承人，能和见过的任何生灵签订临时契约。商行破产了，剩下的只有一柜子契约书。',
      task: '用最后的契约书召回祖辈封存的灵体，护送商行金库余货出境变卖，重振家业。',
    },
    '守卫': {
      tag: '不退的老门卫',
      bg: '为旧王陵守了三十年门的退伍老兵，王陵封了，他没走。他守的从来不是门，是门后的人。',
      task: '在王陵坍塌前护送考古队撤离，顺手把三十年来欠他的那份抚恤金从陵库里"领"回来。',
    },
    '游侠': {
      tag: '风语斥候',
      bg: '在边荒靠给商队带路为生的斥候，认得每一处水源和每一张兽皮下的陷阱。风改变方向时，她比风先知道。',
      task: '抢先在佣兵团之前标定宝藏坐标，布下陷阱迟滞追兵，携带测绘图撤离。',
    },
    '战士': {
      tag: '佣兵团老团长',
      bg: '解散前的"铁砧佣兵团"团长，打过所有能叫上名字的仗。如今兵团只剩他一个人和一面团旗。',
      task: '接下悬赏最高的委托，正面击破盘踞遗迹的匪帮，把团旗插在宝藏堆上再撤离。',
    },
  };
  function openClassChoice() {
    const picks = SDT.Cards.CLASSES.filter(cl => SDT.Cards.classPool(cl).length);
    if (!picks.length) return;
    game.state = 'modal';
    let sel = null;
    let view = 'select'; // 'select' 主选角页 | 'pool' 二级卡池页
    const poolCount = cl => SDT.Cards.classPool(cl).length;
    // 主选角页：左侧全角色网格，右侧大幅立绘 + 背景故事 + 出发任务；卡池收进二级页
    const render = () => {
      if (view === 'pool') return renderPool();
      const story = sel ? CLASS_STORY[sel] : null;
      const lv = sel ? SDT.Meta.classLv(sel) : 0;
      UI.showOverlay('[[icon:medal]] 选择你的角色', `
        <div class="pg cls-page">
          <header class="pg-head">
            <h2>[[icon:medal]] 选择你的角色</h2>
            <span class="sub">本次对战从全部角色中自由选择 1 个 · 确认后获得 1 张该角色的随机卡牌（与 5 张「初始攻击」一起带入背包）</span>
          </header>
          <div class="cls-body">
            <div class="cls-grid">${picks.map(cl => `
              <button class="cls-pick${cl === sel ? ' sel' : ''}" data-act="selClass" data-cls="${escAttr(cl)}" title="查看 ${escAttr(cl)}">
                <span class="cls-pick-art">${SDT.Art.classArt(cl)}</span>
                <b>${esc(cl)}</b>
                <span class="cls-pick-lv">熟练度 Lv.${SDT.Meta.classLv(cl)}</span>
              </button>`).join('')}</div>
            <aside class="cls-detail hub-card">
              ${sel && story ? `
                <div class="cls-figure">${SDT.Art.classFullArt(sel)}</div>
                <div class="cls-detail-head">
                  <div class="cls-detail-meta">
                    <b class="cls-detail-name">${esc(sel)}</b>
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
            <button class="ov-btn ok" data-act="pickClass" ${sel ? '' : 'disabled'}>${sel ? `确 认 · ${esc(sel)}` : '请先选择角色'}</button>
          </footer>
        </div>`, 'page');
    };
    // 二级页：该角色的卡池全览
    const renderPool = () => {
      const pool = SDT.Cards.classPool(sel);
      UI.showOverlay(`[[icon:cards]] ${esc(sel)} · 角色卡池`, `
        <div class="pg cls-page cls-pool-page">
          <header class="pg-head">
            <h2>[[icon:cards]] ${esc(sel)} · 角色卡池（${pool.length} 张）</h2>
            <span class="sub">确认选择「${esc(sel)}」后，从以下卡池中随机获得 1 张（与 5 张「初始攻击」一起带入背包）</span>
          </header>
          <div class="cls-pool cls-pool-full">${pool.map(c => SDT.Cards.cardHTML(c, 'sm')).join('')}</div>
          <footer class="cls-foot">
            <button class="ov-btn" data-act="clsBack">[[icon:medal]] 返回选角</button>
            <button class="ov-btn ok" data-act="pickClass">确 认 · ${esc(sel)}</button>
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
      game.classCard = null;
      const card = SDT.Cards.randomClassCard(cl);
      UI.hideOverlay();
      UI.log(`[[icon:medal]] 本局角色：<b>${esc(cl)}</b>`, 'ok');
      // 熟练度加成：每级（Lv.1 起）生命上限 +2，立即生效
      const lv = SDT.Meta.classLv(cl);
      if (lv > 1) {
        const bonus = (lv - 1) * 2;
        game.maxHp += bonus; game.hp += bonus;
        UI.log(`[[icon:medal]] ${esc(cl)} 熟练度 <b>Lv.${lv}</b>：生命上限 +${bonus}（${game.maxHp}）`, 'ok');
      }
      if (card) {
        game.classCard = { ...card };
        game.ownedCards.push({ uid: newUid(), card: game.classCard, brought: 1 });
        UI.log(`[[icon:archive]] 获得角色卡【<b>${esc(card.name)}</b>】（${esc(cl)}）`, 'loot');
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
    const choices = eventChoiceSpec(card);
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
      sub: esc(card.desc || '神秘事件发生了……'),
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
  function eventChoiceSpec(card) {
    if (!card) return null;
    const settle = (run) => () => { run(); game.state = 'idle'; saveGame(); UI.refresh(game); };
    if (card.id === 'tt6-goldmine') return [
      { label: '收下 3 币', detail: '稳定收益', tone: 'ok', run: settle(() => gainCoins(3)) },
      { label: '冒险挖深', detail: '+6 币，但损失 3 血', tone: 'danger', run: settle(() => { gainCoins(6); game.hp = Math.max(1, game.hp - 3); UI.log('[[icon:tools]] 挖矿过深，获得 6 币但损失 3 血', 'warn'); }) },
    ];
    if (card.id === 'tt6-airdrop') return [
      { label: '木材 ×1', detail: '扩建与仓储路线', run: settle(() => game.addItem(MAP.items.wood, 1)) },
      { label: '口粮 ×1', detail: '为安全格与续航准备', run: settle(() => game.addItem(MAP.items.rations, 1)) },
      { label: '应急处理', detail: '回复 3 血', tone: 'ok', run: settle(() => game.heal(3)) },
    ];
    if (card.id === 'tt6-chestdraw') return [
      { label: '撬开小型物资箱', detail: '低风险：1 张卡 + 1~2 币', run: () => openChestsOnCell([{ kind: 'small' }], '你选择了稳妥的小型物资箱') },
      { label: '赌一把密封物资箱', detail: '高回报：三选一 + 2~3 币', tone: 'ok', run: () => openChestsOnCell([{ kind: 'medium' }], '你选择了高风险的密封物资箱') },
    ];
    return null;
  }

  // 事件效果结算（揭晓弹窗点击继续后执行）
  function applyEventEffect(card) {
    switch (card.id) {
      case 'tt6-timeskip':   // 时空孔隙：前进 6 格（落点照常结算，可能连锁事件）
        UI.log('[[icon:crystal]] 时空孔隙把你向前卷了 <b>6</b> 格！', 'sys');
        game.chainMove = 6;
        break;
      case 'tt6-goldmine':   // 金矿：3 币
        gainCoins(3);
        break;
      case 'tt6-relief':     // 爱心救济站：回复 6 血
        UI.log('[[icon:heart]] 爱心救济站为你处理了伤口', 'ok');
        game.heal(6);
        break;
      case 'tt6-mystery':    // 神秘补给：彩色令牌 + 2 币
        grantEventCard(SDT.Cards.all().find(c => c.name === '彩色令牌'));
        gainCoins(2);
        break;
      case 'tt6-systemsupply': // 系统补给：彩色令牌 + 1 木材
        grantEventCard(SDT.Cards.all().find(c => c.name === '彩色令牌'));
        game.addItem(MAP.items.wood, 1);
        break;
      case 'tt6-airdrop':    // 空中补给：木材/口粮/绷带/碘酒 抽一项（碘酒暂以应急处理代替）
        {
          const roll = Math.floor(Math.random() * 4);
          if (roll === 0) { UI.log('[[icon:archive]] 空投物资：木材 ×1', 'loot'); game.addItem(MAP.items.wood, 1); }
          else if (roll === 1) { UI.log('[[icon:archive]] 空投物资：口粮 ×1', 'loot'); game.addItem(MAP.items.rations, 1); }
          else if (roll === 2) {
            UI.log('[[icon:archive]] 空投物资：绷带', 'loot');
            // 应急绷带在新手卡数据里，不保证已播入卡牌库，从 STARTERS 兜底
            const bandage = SDT.Cards.all().find(c => c.name === '应急绷带') || SDT.Cards.STARTERS.find(c => c.name === '应急绷带');
            grantEventCard(bandage);
          }
          else { UI.log('[[icon:archive]] 空投物资：碘酒（应急处理，回复 3 点生命）', 'loot'); game.heal(3); }
        }
        break;
      case 'tt6-chestdraw': {  // 宝箱：从小、中宝箱中抽 1 个（开真宝箱）
        const kind = Math.random() < 0.5 ? 'small' : 'medium';
        openChestsOnCell([{ kind }], '你撬开了一个遗留物资箱');
        break;
      }
      case 'tt6-demondeal': {  // 恶魔交易：-1 血，获得传奇武器（暂从传说装备/武术中随机）
        game.hp = Math.max(1, game.hp - 1);
        UI.log('[[icon:demon]] 恶魔收走了一点生命力（-1 血）', 'warn');
        const legends = SDT.Cards.all().filter(c => c.rarity === '传说' && ['装备', '武术', '法术'].includes(c.type));
        grantEventCard(legends.length ? legends[Math.floor(Math.random() * legends.length)] : null);
        break;
      }
      case 'tt6-bandits': {  // 盗匪横行：土匪 ×5（多敌事件战斗），战胜奖励中宝箱 ×2（开真宝箱）
        UI.log('[[icon:swords]] 掠夺者一伙（×5）拦住了去路！', 'warn');
        game.pendingEventLoot = { text: '密封物资箱 ×2', chests: ['medium', 'medium'] };
        game.state = 'modal';
        const tpl = MAP.monsters.bandit;
        const gang = [];
        for (let i = 0; i < 5; i++) gang.push(scaledEnemy({ ...tpl }));
        SDT.Battle.start(game, gang, { isBoss: false, layer: game.layerIdx, name: tpl.name });
        return;
      }
      case 'tt6-goldhammer': { // 闪金之锤（事件战斗）：先挥出 5 点伤害，若斩杀敌人 +2 币
        const enc = MAP.encounters[game.layerIdx] || MAP.encounters[0];
        const tpl = MAP.monsters[enc.pool[Math.floor(Math.random() * enc.pool.length)]];
        const foe = scaledEnemy({ ...tpl });
        foe.hp -= 5;
        if (foe.hp <= 0) { UI.log(`[[icon:tools]] 闪金之锤一击制敌（${foe.name}）！+2 币`, 'coin'); gainCoins(2); break; }
        UI.log(`[[icon:tools]] 闪金之锤重击 <b>${esc(foe.name)}</b>（-5 血），战斗打响！`, 'warn');
        game.state = 'modal';
        SDT.Battle.start(game, [foe], { isBoss: false, layer: game.layerIdx, name: foe.name });
        return;
      }
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
      body: btns + nodeOpt('leaveAltar', '撤离污染区', '退回入口格，从长计议'),
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

  // ---------- 商店（卡牌商店：6 随机 + 1 初始 + 1 金疮药 + 1 个 3 币随机卡栏位） ----------
  function generateShopStock() {
    // 随机池排除衍生卡与传说特例卡（unrandom：无法被随机或发现获得；职业卡同此排除）
    const lib = SDT.Cards.all().filter(c => c.rarity !== '衍生' && !c.unrandom);
    const weights = SDT.Cards.SHOP_WEIGHTS;
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    const pickWeightedRarity = () => {
      let roll = Math.random() * total;
      for (const [r, w] of Object.entries(weights)) { roll -= w; if (roll <= 0) return r; }
      return '初始';
    };
    const pickRandomCard = () => {
      for (let tries = 0; tries < 50; tries++) {
        const rar = pickWeightedRarity();
        const pool = lib.filter(c => c.rarity === rar);
        if (pool.length) return pool[Math.floor(Math.random() * pool.length)];
      }
      return lib.length ? lib[Math.floor(Math.random() * lib.length)] : null;
    };
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const c = pickRandomCard();
      slots.push(c ? { card: c, price: SDT.Cards.PRICE[c.rarity] || 2, sold: false }
                   : { empty: true, label: '卡牌库无货' });
    }
    const starters = lib.filter(c => c.rarity === '初始');
    slots.push(starters.length
      ? { card: starters[Math.floor(Math.random() * starters.length)], price: SDT.Cards.PRICE['初始'], sold: false }
      : { empty: true, label: '暂无初始牌' });
    slots.push({ card: SDT.Cards.POTION, price: 3, sold: false });
    // 随机卡栏位（设计者 2026-09-02 定版）：花 3 币购买 1 张随机卡牌
    const mysteryCard = lib.length ? lib[Math.floor(Math.random() * lib.length)] : null;
    slots.push(mysteryCard ? { card: mysteryCard, price: 3, sold: false, mystery: true }
                           : { empty: true, label: '卡牌库无货' });
    return slots;
  }

  function openShop() {
    // 普通商店由落格结算直接打开，此时状态仍是 moving；门/祭坛旁商店则是 modal。
    if (!['idle', 'moving', 'modal'].includes(game.state)) return;
    game.state = 'modal';
    _set_cardPageOpen(false);  // 商店覆盖卡牌页面时结束页面态
    game.shopStock = generateShopStock();
    renderShop();
  }

  function renderShop() {
    const slots = game.shopStock.map((s, i) => {
      if (s.empty) return `<div class="shop-slot"><div class="shop-empty">${s.label || '无货'}</div></div>`;
      if (s.sold) return `<div class="shop-slot sold"><div class="shop-empty">已售出</div></div>`;
      const afford = game.coins >= s.price;
      if (s.mystery) return `<div class="shop-slot"><div class="shop-empty">[[icon:dice]] 随机卡牌</div>
        <button class="mini-btn ok" data-act="buyCard" data-i="${i}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${s.price} 币</button>
      </div>`;
      return `<div class="shop-slot">${cardHTML(s.card)}
        <button class="mini-btn ok" data-act="buyCard" data-i="${i}" ${afford ? '' : 'disabled'}>[[icon:coin]] ${s.price} 币</button>
      </div>`;
    }).join('');
    // 出售区：所有卡牌默认不可出售，只有「可出售」的持有卡牌才能卖给商店
    const sellables = game.ownedCards.filter(o => SDT.Cards.isSellable(o.card));
    const sellItems = sellables.length
      ? sellables.map(o => `
          <div class="bag-card">
            ${cardHTML(o.card, 'sm')}
            <button class="mini-btn ok" data-act="sellCard" data-uid="${o.uid}">出售 ＋${SDT.Cards.sellPrice(o.card)} 币</button>
          </div>`).join('')
      : '<p class="shop-sell-empty">没有可出售的卡牌——只有带「可出售」备注的卡才能卖给商店（默认不可出售）。</p>';
    UI.registerHelp('shop', {
      title: '商店说明',
      html: `
        <p class="help-item"><b>进货</b>商队每次靠站随机卸货：6 张随机卡 + 1 张初始牌 + 金疮药 + 1 个「神秘货箱」栏位（3 币，买到随机卡牌）。</p>
        <p class="help-item"><b>出售</b>默认所有卡牌不可出售；只有带「可出售」备注的卡才能卖给商店，收购价 = 卡面币值。</p>`,
      back: () => renderShop(),
    });
    UI.showOverlay('', `
      <div class="pg shop-pg node-pg sc-shop" data-asset-key="scene-shop-bg">
        <header class="pg-head">
          <h2>[[icon:bag]] 拾荒商队 ${UI.helpBtn('shop')}</h2>
          <span class="pg-spacer"></span>
          <span class="hub-res"><span class="res-chip">[[icon:coin]] <b class="gold">${game.coins}</b> 币</span></span>
        </header>
        <div class="shop-grid">
          ${slots}
          <aside class="shop-side">
            <div class="shop-coinbox">[[icon:coin]] 持有 <b class="gold">${game.coins}</b> 币</div>
            <button class="ov-btn" data-act="closeShop">[[icon:exit]] 离开商店</button>
          </aside>
        </div>
        <h3 class="set-h">出售卡牌</h3>
        <div class="shop-sell">${sellItems}</div>
      </div>`, 'page');
    UI.act('buyCard', (d) => {
      const s = game.shopStock[+d.i];
      if (!s || s.sold || s.empty) return;
      if (game.coins < s.price) { UI.log('币不够，买不起', 'warn'); SDT.Sound.sfx('error'); return; }
      // 新堆叠占 1 格；同名卡并入现有格，不受容量限制
      if (!game.ownedCards.some(o => o.card.name === s.card.name) && usedSlots() >= bagCap()) {
        UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格），买不下这张卡`, 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      game.coins -= s.price;
      s.sold = true;
      game.ownedCards.push({
        uid: newUid(),
        card: { ...s.card },
      });
      UI.log(`[[icon:bag]] 购买卡牌【<b>${esc(s.card.name)}</b>】（- ${s.price} 币，剩 ${game.coins}）`, 'coin');
      saveGame();
      renderShop();
    });
    UI.act('sellCard', (d) => {
      const i = game.ownedCards.findIndex(o => o.uid === d.uid);
      if (i < 0) return;
      const o = game.ownedCards[i];
      if (!SDT.Cards.isSellable(o.card)) { UI.log(`卡牌【${esc(o.card.name)}】不可出售`, 'warn'); return; }
      const price = SDT.Cards.sellPrice(o.card);
      game.ownedCards.splice(i, 1);
      game.coins += price;
      UI.log(`[[icon:coin]] 出售卡牌【<b>${esc(o.card.name)}</b>】（+ ${price} 币，现有 ${game.coins}）`, 'coin');
      saveGame();
      renderShop();
    });
    UI.act('closeShop', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
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

export { bindRunMixins, openAltarModal, openClassChoice, openShop, roll };
