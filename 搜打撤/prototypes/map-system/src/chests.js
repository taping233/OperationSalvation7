
  const SDT = window.SDT;
  const UI = SDT.UI;

  let G = null;        // game 主对象
  let queue = [];      // 待开宝箱 [{kind}]
  let cur = null;      // 当前宝箱 {kind, cards, coins}
  let idx = 0;         // 已开到第几个
  let onDone = null;   // 全部开完后的续流回调

  const KINDS = () => SDT.MAP.chestKinds;
  const rndInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  // ---------- 随机卡池（商店随机槽同源：排除衍生与传说特例卡） ----------
  function buildPool() {
    return SDT.Cards.all().filter(c =>
      c.rarity !== '衍生' && SDT.Cards.isRandomObtainable(c));
  }

  // 按稀有度权重（SHOP_WEIGHTS）抽 1 张，优先避开同宝箱已出的卡
  function pickCard(pool, weights, totalW, taken) {
    const avail = taken && taken.size ? pool.filter(c => !taken.has(c.id)) : pool;
    const use = avail.length ? avail : pool;
    if (!use.length) return null;
    for (let tries = 0; tries < 50; tries++) {
      let roll = Math.random() * totalW;
      let rarity = null;
      for (const [r, w] of weights) { roll -= w; if (roll <= 0) { rarity = r; break; } }
      if (!rarity) rarity = weights[0][0];
      const sub = use.filter(c => c.rarity === rarity);
      if (sub.length) return sub[Math.floor(Math.random() * sub.length)];
    }
    return use[Math.floor(Math.random() * use.length)];
  }

  // 掷一个宝箱的完整内容：cards=开出的卡（中宝箱为 3 选 1 候选），coins=内含币
  function rollContents(kind) {
    const K = KINDS()[kind] || KINDS().small;
    const c = { kind, cards: [], coins: 0 };
    const pool = buildPool();
    const weights = Object.entries(SDT.Cards.SHOP_WEIGHTS);
    const totalW = weights.reduce((a, b) => a + b[1], 0);
    const taken = new Set();
    const n = K.pickFrom || K.cards || 0;
    for (let i = 0; i < n; i++) {
      const card = pickCard(pool, weights, totalW, taken);
      if (card) { taken.add(card.id); c.cards.push(card); }
    }
    if (K.coins) c.coins = rndInt(K.coins[0], K.coins[1]);
    // BOSS宝箱：金币/银币/铜币其一 + 30% 金色令牌（都是卡牌，直接并入 cards）
    // 注意：币名要先取好再 find——把随机取名写进 find 回调会对每张库卡重新随机
    const lib = SDT.Cards.all();
    if (K.coinCards && K.coinCards.length) {
      const cname = K.coinCards[Math.floor(Math.random() * K.coinCards.length)];
      const coin = lib.find(x => x.name === cname);
      if (coin) c.cards.push(coin);
    }
    if (K.tokenChance && Math.random() < K.tokenChance) {
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
    const combo = table[Math.floor(Math.random() * table.length)];
    const out = [];
    combo.forEach(part => {
      const n = Array.isArray(part.n) ? rndInt(part.n[0], part.n[1]) : (part.n || 0);
      for (let i = 0; i < n; i++) out.push({ kind: part.k });
    });
    return out;
  }

  // 掉落摘要文案：小宝箱×2、大宝箱×1
  function dropText(chests) {
    const counts = {};
    chests.forEach(c => { counts[c.kind] = (counts[c.kind] || 0) + 1; });
    return Object.entries(counts)
      .map(([k, n]) => `<b>${n}</b> 个${KINDS()[k].name}`)
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
    cur = rollContents(queue[idx].kind);
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
      <div class="bt-card chest-fly rl-${riOf(card)}" style="animation-delay:${i * 160}ms"
        ${isPick ? `data-act="chestPick" data-i="${i}" title="点击收下这张"` : 'title="收下时放入背包"'}>
        ${SDT.Cards.cardHTML(card, 'sm')}
      </div>`).join('');
    const lootLine = isPick
      ? `从随机 <b>${cur.cards.length}</b> 张卡牌中选择 <b>1</b> 张 · 另含 [[icon:coin]] <b>${cur.coins}</b> 币`
      : `开出 <b>${cur.cards.length}</b> 张卡牌${cur.coins ? ` · [[icon:coin]] <b>${cur.coins}</b> 币` : ''}` +
        (cur.tokenHit ? ' · <b class="gold">[[icon:sparkles]] 金色令牌！</b>' : '');
    const ops = isPick
      ? '<p class="ov-note">点击一张卡牌收下，其余两张散落在风中……</p>'
      : `<div class="scene-ops"><button class="ov-btn ok" data-act="chestTake">[[icon:archive]] 全部收下${cur.coins ? `（含 ${cur.coins} 币）` : ''}</button></div>`;
    UI.showOverlay(`[[icon:archive]] 搜刮！${K.name} · 第 ${idx} / ${queue.length}`, `
      <p class="evt-sts-desc">${lootLine}</p>
      ${cur.cards.length ? `<div class="bt-hand">${cardsHTML}</div>` : '<p class="ov-empty">（卡牌库是空的，什么也没开出）</p>'}
      ${ops}`, 'chest');
    UI.act('chestTake', takeAll);
    UI.act('chestPick', (d) => {
      const card = cur.cards[+d.i];
      if (card) G.grantCard(card);
      if (cur.coins) G.gainCoins(cur.coins);
      next();
    });
    UI.refresh(G);
  }

  // 逐卡揭晓音效：史诗叮鸣、传说号角
  function scheduleRevealSfx() {
    (cur.cards || []).forEach((c, i) => {
      setTimeout(() => {
        if (!document.querySelector('.bt-hand')) return;
        SDT.Sound.sfx('reveal');
        if (c.rarity === '传说') SDT.Sound.sfx('legend');
        else if (c.rarity === '史诗') SDT.Sound.sfx('ding');
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
  window.SDT.Chests = { rollDrops, dropText, open, rollContents };

export { G, SDT, UI, render };
