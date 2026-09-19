/* ============================================================
 * game.run.flow.js —— 走格子主流程：移动事务、落脚结算、即时/事件节点（架构批次 4）
 *
 * 由 game.run.js 拆出。层位最高（L2）：依赖 scenes（L0）与 altar（L1），不被二者依赖。
 * ============================================================ */
import { esc } from './shared.js';
import { MAP, cellCenter, curLayer, gainCoins, game, markSeen, modeCfg, pick, saveGame, scaledEnemy, weighted } from './game.session.js';
import { tone } from './sound.js';
import { _set_cardPageOpen } from './game.cardslib.js';
import { EVENT_SCENE_META } from './game.run.data.js';
import { Random } from './random.js';
import { eventNarrative } from './narrative.js';
import { buildEncounter, cancelLegacyChainMove, enterNode, finishInstant, grantEventCard, nodeShell, openBattleCell, openBlankSafePage, openChestsOnCell, openPickupPage, openPocketRestore, openShop } from './game.run.scenes.js';
import { openDoorModal, openFireRest, openAltarRitual, openBossGate, openEmergencyModal } from './game.run.altar.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

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
export function moveTo(toLi, toIdx) {
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
    if (game.cam?.frameMode === 'routes') game.cam.frameExploration(game);
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
  UI.refresh(game);
  game.pos = { ...from };
  // rAF 在后台页可能被暂停；看门狗确保事务最终回到稳定节点。
  watchdog = setTimeout(finish, MOVE_DURATION + 700);
  if (moveUsesReducedMotion()) finish();
  else frame(tick);
  return true;
}

function resolveCell() {
  const layer = curLayer(), idx = game.trackPos;
  const lc = layer.logical[idx];
  const def = lc ? lc.def : undefined;
  const door = (layer.doors || []).find(d => d.at === idx);
  const altarE = (layer.altarEntrances || []).find(a => a.at === idx);

  // 一次性内容防重刷（2026-09-09 玩法定版：任何格子只能触发一次）：
  // 战斗/宝箱/拾取/事件/火堆/商店/祭坛/首脑结算过一次就标记，回头路再次踏入只提示不重触发。
  // 仍可通行/使用的格：门/紧急撤离/终局撤离（通路）、空白格；
  // 祭坛已激活但奖励未领取时可重进（只开回赠面板领奖，见 openAltarRitual）。
  // 走过的格子会在地图上标绿（renderer 按 visited 绘制）。
  game.visited = game.visited || {};
  const vKey = game.layerIdx + ',' + idx;
  const repeatable = !def || door || altarE ||
    ['emergencyExit', 'extraction'].includes(def.type) ||
    (def.type === 'altar' && game.altarActivated && game.altarRewardPending);
  if (game.visited[vKey] && !repeatable) {
    UI.log('[[icon:map]] 这里已经来过了——能拿的都拿走了，什么也没有。', 'sys');
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

  // 1) 战斗格：先给出短暂接敌过场，再进入遭遇战。
  if (def && def.type === 'battle') {
    const encounter = buildEncounter(game.layerIdx);
    enterNode('battle', () => openBattleCell(def, encounter));
    return;
  }

  // 2) 即时效果类（币/木材/宝箱/口粮/钥匙/火堆/事件）：拾取或场景演出后再继续
  const INSTANT_TYPES = ['coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event', 'resource'];
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

// 物资格（2026-09-16 Item 17 定版）：按爆率（与商店/宝箱同源权重）刷新 2 张随机资源卡，二选一带走
function openResourcePick(done) {
  const weights = SDT.Cards.DROP_WEIGHTS;
  const pool = SDT.Cards.all().filter(c => c.type === '资源' && SDT.Cards.isRandomObtainable(c));
  const pickOne = (taken) => {
    const avail = pool.filter(c => !(taken && taken.has(c.name)));
    const total = avail.reduce((sum, c) => sum + (weights[c.rarity] || 2), 0);
    if (!total) return null;
    let roll = Random.random('loot') * total;
    for (const c of avail) { roll -= (weights[c.rarity] || 2); if (roll <= 0) return c; }
    return avail[avail.length - 1] || null;
  };
  const first = pickOne(null);
  const second = first ? pickOne(new Set([first.name])) : null;
  const cards = [first, second].filter(Boolean);
  if (!cards.length) { done(); return; }
  game.state = 'modal';
  UI.showOverlay('[[icon:gem]] 物资格 · 二选一', `
    <p class="ov-note">按爆率刷新了 2 张随机资源卡——选择 1 张带走，另一张留在原地。</p>
    <div class="ov-btns">
      ${cards.map((c, i) => `<button class="ov-btn ${i === 0 ? 'ok' : ''}" data-act="resPick${i}">[[icon:${c.id === 'tt-key' ? 'key' : c.id === 'tt-wood' ? 'wood' : 'cards'}]] 【${esc(c.name)}】· ${esc(c.rarity)}</button>`).join('')}
    </div>
    <div class="ov-btns"><button class="ov-btn" data-act="resSkip">都不要，继续赶路</button></div>`, 'discover');
  cards.forEach((c, i) => UI.act('resPick' + i, () => {
    grantEventCard(c);
    UI.hideOverlay();
    UI.log(`[[icon:gem]] 物资格：带走了【<b>${esc(c.name)}</b>】`, 'loot');
    done();
  }));
  UI.act('resSkip', () => { UI.hideOverlay(); done(); });
}

// 空白安全节点提示页：明确告诉玩家这格无事发生（背景图后续再补）
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
        for (let i = 0; i < cnt && card; i++) grantEventCard(card);
        done();
      });
    } break;
    // 物资格（露天宝箱格，2026-09-09 玩法定版）：70% 小宝箱（随机 1 张）/ 30% 中宝箱（3 选 1）
    case 'chest': openChestsOnCell([Random.random('loot') < 0.7 ? { kind: 'small' } : { kind: 'medium' }], null, { resourceOnly: true }); break;
    // 物资格（2026-09-16 Item 17 定版）：按爆率刷新 2 张随机资源卡，二选一带走
    case 'resource': openResourcePick(done); break;
    case 'rations': {
      // 2026-09-06 #11：口粮同样以卡牌形式入包
      const card = SDT.Cards.all().find(c => c.id === 'tt-rations');
      const cnt = MAP.items.rations.count || 1;
      openPickupPage('rations', `口粮卡 ×${cnt}`, () => {
        for (let i = 0; i < cnt && card; i++) grantEventCard(card);
        done();
      });
    } break;
    case 'key': {
      // 2026-09-09 老板 #1：物资点资源一律以卡牌形式入包（钥匙与木材/口粮同口径）
      const card = SDT.Cards.all().find(c => c.id === 'tt-key');
      openPickupPage('key', `钥匙卡 ×1`, () => {
        if (card) grantEventCard(card);
        done();
      });
    } break;
    case 'fire':
      openFireRest();   // 火堆：回 10 血 + 消耗口袋复原 2 张 + 30% 额外职业卡
      break;
    case 'event': {
      // 事件页开着时不得回 idle：同步 done() 会把 modal 覆盖成 idle，玩家此时可移动、
      // 后到的事件页会顶掉前者（2026-09-13 实测奖励丢失）。收尾由事件页关闭点兜底。
      runEventDeck();
      break;
    }
    default: done(); break;
  }
}

// ---------- 事件卡（第六批桌游事件：只能经事件格触发，背包记录触发历史） ----------
// 事件卡池 = 卡牌库中类型「事件」的卡；卡牌库无事件卡时退回旧随机事件表。
// 导出供开发者节点测试面板（game.run.js devJumpNode）直接进事件页，玩法口径与事件格一致。
export function runEventDeck() {
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
function triggerEventCard(card) {
  game.eventLog = game.eventLog || [];
  game.eventLog.push({ name: card.name, desc: card.desc || '', turn: game.turn });
  // 封顶：eventLog 随对局只增不减，而每次落盘都会全量 JSON.stringify——
  // 长局会让每次 persistSave 的同步序列化越来越慢。留 200 条足够回溯。
  if (game.eventLog.length > 200) game.eventLog = game.eventLog.slice(-200);
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
  let evtSettled = false;   // 防连点：事件选项二次触发会重复发奖（2026-09-13 实测连点3次入包2张）
  UI.act('evtChoice', (d) => {
    if (!choices || evtSettled) return;
    const choice = choices[+d.i];
    if (!choice) return;
    evtSettled = true;
    UI.hideOverlay();
    choice.run();
    if (game.state !== 'modal') finishInstant();   // 选项未自开新页时兜底收尾（幂等）
  });
  UI.act('evtNext', () => {
    if (choices || evtSettled) return;
    evtSettled = true;
    UI.hideOverlay();
    applyEventEffect(card);
    if (game.state !== 'modal') finishInstant();   // 同上（旧事件 default 分支此前漏收尾）
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
        { label: '能量饮料', detail: '回复 6 血', tone: 'ok', run: settle(() => { game.heal(6); UI.log('[[icon:heart]] 一罐能量饮料下肚，回复 6 点生命', 'ok'); }) },
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
