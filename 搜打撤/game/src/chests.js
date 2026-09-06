
import { Random } from './random.js';

  const SDT = window.SDT;
  const UI = SDT.UI;

  let G = null;        // game 主对象
  let queue = [];      // 待开宝箱 [{kind}]
  let cur = null;      // 当前宝箱 {kind, cards, coins}
  let idx = 0;         // 已开到第几个
  let onDone = null;   // 全部开完后的续流回调

  const KINDS = () => SDT.MAP.chestKinds;
  const rndInt = (a, b) => a + Math.floor(Random.random('loot') * (b - a + 1));

  // 掷一个宝箱的完整内容：cards=开出的卡（中宝箱为 3 选 1 候选），coins=内含币
  function rollContents(kind, isClass) {
    const K = KINDS()[kind] || KINDS().small;
    const c = { kind, cards: [], coins: 0, isClass: !!isClass };
    // 职业宝箱：只掉落本职业的职业卡牌（2026-09-06）
    if (isClass && kind !== 'boss') {
      const pool = (G && G.myClass ? SDT.Cards.classPool(G.myClass) : []).filter(x => x.rarity === '职业');
      const n0 = K.pickFrom || K.cards || 0;
      for (let i = 0; i < n0; i++) {
        if (!pool.length) break;
        c.cards.push(pool[Math.floor(Random.random('loot') * pool.length)]);
      }
      if (K.coins) c.coins = rndInt(K.coins[0], K.coins[1]);
      return c;
    }
    // 随机卡池（2026-09-05 设计者定版爆率）：只开 武术/法术/装备/道具/资源 五类，
    // 稀有度 古朴:稀有:史诗 = 2.25:1.5:1，资源/道具再 ×0.8；传说/职业/初始不直接生成
    // （统一走 SDT.Cards.randomDropCard，职业卡只能从职业卡池获取）；同一宝箱内尽量不重复
    const taken = new Set();
    const n = K.pickFrom || K.cards || 0;
    for (let i = 0; i < n; i++) {
      const card = SDT.Cards.randomDropCard(taken);
      if (card) { taken.add(card.id); c.cards.push(card); }
    }
    if (K.coins) c.coins = rndInt(K.coins[0], K.coins[1]);
    // BOSS宝箱：金币/银币/铜币其一 + 30% 金色令牌（都是卡牌，直接并入 cards）
    // 注意：币名要先取好再 find——把随机取名写进 find 回调会对每张库卡重新随机
    const lib = SDT.Cards.all();
    if (K.coinCards && K.coinCards.length) {
      const cname = K.coinCards[Math.floor(Random.random('loot') * K.coinCards.length)];
      const coin = lib.find(x => x.name === cname);
      if (coin) c.cards.push(coin);
    }
    if (K.tokenChance && Random.random('loot') < K.tokenChance) {
      const token = lib.find(x => x.name === '金色令牌');
      if (token) { c.cards.push(token); c.tokenHit = true; }
    }
    return c;
  }

  // ---------- 掉落掷骰：opts = { isBoss, layer } → 宝箱实例 [{kind}] ----------
  function rollDrops(opts) {
    if (opts && opts.isBoss) return [{ kind: 'boss' }];
    const tables = SDT.MAP.layerChests;
    const li = opts && typeof opts.layer === 'number' ? opts.layer : 0;
    const table = tables[li] || tables[0];
    const combo = table[Math.floor(Random.random('loot') * table.length)];
    const out = [];
    combo.forEach(part => {
      const n = Array.isArray(part.n) ? rndInt(part.n[0], part.n[1]) : (part.n || 0);
      for (let i = 0; i < n; i++) {
        // 职业宝箱（2026-09-06）：黑箱，出现概率为普通宝箱的 1/3，只掉落职业卡牌
        const isClass = Random.random('loot') < 1 / 3;
        out.push({ kind: part.k, isClass });
      }
    });
    if (out.some(c => c.isClass)) UI.log('[[icon:archive]] 出现黑色<b>职业宝箱</b>——只掉落职业卡牌！', 'loot');
    return out;
  }

  // 掉落摘要文案：小宝箱×2、大宝箱×1
  function dropText(chests) {
    const counts = {};
    chests.forEach(c => { const k = c.kind + (c.isClass ? ':cls' : ''); counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts)
      .map(([k, n]) => `<b>${n}</b> 个${k.endsWith(':cls') ? '职业·' : ''}${KINDS()[k.split(':')[0]].name}`)
      .join('，');
  }

  // ---------- 开箱 UI（逐个弹窗，全部开完调 onDone） ----------
  function open(game, chests, done) {
    G = game;
    queue = chests.slice();
    idx = 0;
    onDone = done || null;
    G.state = 'modal';
    next();
  }

  function next() {
    if (idx >= queue.length) {
      UI.hideOverlay();
      G.state = 'idle';
      cur = null;
      const cb = onDone;
      onDone = null;
      if (cb) cb();
      return;
    }
    cur = rollContents(queue[idx].kind, queue[idx].isClass);
    cur.isClass = !!queue[idx].isClass;
    idx++;
    render();
    scheduleRevealSfx();
  }

  // ---------- 开箱浮层：悬在当前画面上的紧凑面板（杀戮尖塔「搜刮!」式） ----------
  // 不再整屏接管：模态卡片直接浮在棋盘/结算画面上，逐卡揭晓后收下继续。
  const riOf = (card) => Math.max(0, SDT.Cards.RARITIES.indexOf(card.rarity));

  function render() {
    const K = KINDS()[cur.kind];
    const isPick = !!K.pickFrom;   // 中宝箱：3 选 1
    const cardsHTML = cur.cards.map((card, i) => `
      <div class="bt-card chest-fly rl-${riOf(card)}${cur.isClass ? ' cls-chest' : ''}" style="animation-delay:${i * 160}ms"
        ${isPick ? `data-act="chestPick" data-i="${i}" title="点击收下这张"` : 'title="收下时放入背包"'}>
        ${SDT.Cards.cardHTML(card, 'sm')}
      </div>`).join('');
    const lootLine = isPick
      ? `从随机 <b>${cur.cards.length}</b> 张卡牌中选择 <b>1</b> 张 · 另含 [[icon:coin]] <b>${cur.coins}</b> 币`
      : `开出 <b>${cur.cards.length}</b> 张卡牌${cur.coins ? ` · [[icon:coin]] <b>${cur.coins}</b> 币` : ''}` +
        (cur.tokenHit ? ' · <b class="gold">[[icon:sparkles]] 金色令牌！</b>' : '');
    const ops = isPick
      ? '<p class="ov-note">点击一张卡牌收下，其余两张散落在风中……</p>'
      // 2026-09-06 留言：全部收下移到右边，左侧加跳过（散落不要了）
      : `<div class="scene-ops chest-ops"><button class="ov-btn" data-act="chestSkip">跳过</button><button class="ov-btn ok" data-act="chestTake">[[icon:archive]] 全部收下${cur.coins ? `（含 ${cur.coins} 币）` : ''}</button></div>`;
    UI.showOverlay(`[[icon:archive]] 搜刮！${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, `
      ${cur.isClass ? '<p class="evt-sts-desc cls-chest-note">黑色职业宝箱：只掉落<b>职业卡牌</b></p>' : ''}
      <p class="evt-sts-desc">${lootLine}</p>
      ${cur.cards.length ? `<div class="bt-hand">${cardsHTML}</div>` : '<p class="ov-empty">（卡牌库是空的，什么也没开出）</p>'}
      ${ops}`, 'chest');
    UI.act('chestTake', takeAll);
    UI.act('chestSkip', () => {
      if (cur.coins) G.gainCoins(cur.coins);   // 币是无主物，跳过也收；卡牌散落
      UI.log('（你留下开出的卡牌，转身走了……）', 'dim');
      next();
    });
    UI.act('chestPick', (d) => {
      const card = cur.cards[+d.i];
      if (card) G.grantCard(card);
      if (cur.coins) G.gainCoins(cur.coins);
      next();
    });
    UI.refresh(G);
  }

  // 逐卡揭晓音效：史诗叮鸣、传说号角；揭晓卡带过冲 pop（game-feel）
  function scheduleRevealSfx() {
    (cur.cards || []).forEach((c, i) => {
      setTimeout(() => {
        const hand = document.querySelector('.bt-hand');
        if (!hand) return;
        SDT.Sound.sfx('reveal');
        if (c.rarity === '传说') SDT.Sound.sfx('legend');
        else if (c.rarity === '史诗') SDT.Sound.sfx('ding');
        const cards = hand.children;
        const el = cards[i] || cards[cards.length - 1];
        if (el && SDT.Motion) SDT.Motion.pop(el);
      }, 140 + i * 170);
    });
  }

  function takeAll() {
    cur.cards.forEach(card => G.grantCard(card));
    if (cur.coins) G.gainCoins(cur.coins);
    if (!cur.cards.length && !cur.coins) UI.log('（空的——早被别的拾荒者搬空了……）', 'dim');
    next();
  }

  window.SDT = window.SDT || {};
  window.SDT.Chests = { rollDrops, dropText, open, rollContents, isOpen: () => !!(cur || queue.length) };

export { G, SDT, UI, render };
