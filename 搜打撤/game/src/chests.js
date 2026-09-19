import { sdtDefine } from './sdt-facade.js';

import { Random } from './random.js';

  const SDT = window.SDT;
  const UI = SDT.UI;

  let G = null;        // game 主对象
  let queue = [];      // 待开宝箱 [{kind}]
  let cur = null;      // 当前宝箱 {kind, cards, coins}
  let idx = 0;         // 已开到第几个
  let onDone = null;   // 全部开完后的续流回调
  let searchSeq = 0;   // 搜索演出代次：过期定时器不得再渲染（连开多箱/提前结束时防串台）

  const KINDS = () => SDT.MAP.chestKinds;
  const rndInt = (a, b) => a + Math.floor(Random.random('loot') * (b - a + 1));

  // 同一面板去重（2026-09-13 老板口径：同一个选择面板内不许重复）：
  // 除同 id 外，卡名相同的不同版本（如「冰冻药水」有法术/道具两张）在面板里
  // 看起来也是同一张牌，一并算重复。ids 同时喂给 cards.js 随机池排除
  // （pickOfRarity / randomDropCard 的 taken 按 id 判重）。
  function panelSeen() {
    const ids = new Set(), names = new Set();
    return {
      ids,
      dup: (card) => !card || ids.has(card.id) || names.has(card.name),
      add: (card) => { ids.add(card.id); names.add(card.name); },
    };
  }

  // 掷一个宝箱的完整内容：cards=开出的卡（中宝箱为 3 选 1 候选），coins=内含币
  function rollContents(kind, isClass) {
    const K = KINDS()[kind] || KINDS().small;
    const c = { kind, cards: [], coins: 0, isClass: !!isClass };
    const seen = panelSeen();
    // 职业宝箱：只掉落本职业的职业卡牌（2026-09-06）
    if (isClass && kind !== 'boss') {
      const pool = (G && G.myClass ? SDT.Cards.classPool(G.myClass) : []).filter(x => x.rarity === '职业');
      const n0 = K.pickFrom || K.cards || 0;
      // 职业卡池很浅（每个职业只有 4 张）：三选一不去重时撞出重复牌的概率高达 62.5%。
      // 挑不满就少给几张（池子里有多少给多少），不拿重复牌凑数。
      for (let i = 0; i < Math.min(n0, pool.length); i++) {
        let pick = null;
        for (let guard = 0; guard < 40; guard++) {
          const card = pool[Math.floor(Random.random('loot') * pool.length)];
          if (!seen.dup(card)) { pick = card; break; }
        }
        if (!pick) break;
        seen.add(pick);
        c.cards.push(pick);
      }
      if (K.coins) c.coins = rndInt(K.coins[0], K.coins[1]);
      return c;
    }
    // 随机卡池（2026-09-08 定版爆率）：只开 武术/法术/装备/道具/资源 五类，
    // 稀有度 古朴:稀有:史诗:传说 = 60:28:9:3，同稀有度内均分、道具 ×0.7；
    // 初始/职业/衍生/棱彩/生物不直接生成
    // （统一走 SDT.Cards.randomDropCard，职业卡只能从职业卡池获取）；同一宝箱内不重复
    const n = K.pickFrom || K.cards || 0;
    for (let i = 0; i < n; i++) {
      let card = null;
      for (let guard = 0; guard < 40 && !card; guard++) {
        // mode 由流程层读门面后传入（2026-09-11 架构批次 1：cards 数据模块不读全局会话）
        const got = SDT.Cards.randomDropCard(seen.ids, (SDT.game && SDT.game.mode) || null, K.resourceOnly ? '资源' : null);
        if (!got) break;
        // 只撞卡名（不同版本的同一张牌）时，记下 id 再抽一张，别停下
        if (seen.dup(got)) { seen.ids.add(got.id); continue; }
        card = got;
      }
      if (!card) break;
      seen.add(card);
      c.cards.push(card);
    }
    // 宠物蛋（2026-09-09 需求 #2）：0.7% 基础爆率 + 软保底（2026-09-19 老板定向）——
    // 每次开箱未出蛋 +3% 累进、出蛋归零；计数存基地档位（跨局累计，不占格）
    const pityN = (SDT.Base.data.eggPity || 0) + 1;
    if (Random.random('loot') < 0.007 + 0.03 * (pityN - 1)) {
      const egg = (SDT.Cards.all() || []).find(x => x.id === 'pet-egg');
      if (egg && !seen.dup(egg)) {
        seen.add(egg); c.cards.push(egg); c.eggHit = true;
        SDT.Base.data.eggPity = 0;
      } else {
        SDT.Base.data.eggPity = pityN;   // 面板重复等异常未实际出蛋：保底照常累计
      }
    } else {
      SDT.Base.data.eggPity = pityN;
    }
    SDT.Base.save();
    // —— 宝箱保底（2026-09-09 试玩反馈；设计者定版权重 60:28:9:3 不动）——
    // 中宝箱（3 选 1）整包全古朴的概率约 21.6%，体验很差：保底至少 1 张「稀有」+；
    // 大宝箱 / 首脑宝箱保底至少 1 张「史诗」+。未达标就重掷最后一张（目标档内挑卡，
    // 该档暂无可用卡则逐档上探；全部失败则保持原结果）。职业宝箱走上面独立分支，不参与。
    const riOfCard = (card) => Math.max(0, SDT.Cards.RARITIES.indexOf(card.rarity));
    const needRi = K.pickFrom ? SDT.Cards.RARITIES.indexOf('稀有')
      : (kind === 'large' || kind === 'boss') ? SDT.Cards.RARITIES.indexOf('史诗') : -1;
    if (needRi > 0 && c.cards.length && !c.cards.some(x => riOfCard(x) >= needRi)) {
      const tiers = [SDT.Cards.RARITIES[needRi], '传说', '史诗', '稀有']
        .filter(r => riOfCard({ rarity: r }) >= needRi);
      for (const tier of tiers) {
        let up = null;
        for (let guard = 0; guard < 20 && !up; guard++) {
          const cand = SDT.Cards.pickOfRarity(tier, seen.ids);
          if (!cand) break;
          if (seen.dup(cand)) { seen.ids.add(cand.id); continue; }   // 只撞卡名（不同版本）→ 记下再挑一张
          up = cand;
        }
        if (up) { c.cards[c.cards.length - 1] = up; seen.add(up); c.pity = tier; break; }
      }
    }
    if (K.coins) c.coins = rndInt(K.coins[0], K.coins[1]);
    // BOSS宝箱：金币/银币/铜币其一 + 30% 员工通行证B（都是卡牌，直接并入 cards）
    // 注意：币名要先取好再 find——把随机取名写进 find 回调会对每张库卡重新随机
    // 追加卡也要查重：员工通行证B 本身可被随机开出，原实现会「随机 1 张 + 30% 再发 1 张」同名牌双份
    const lib = SDT.Cards.all();
    if (K.coinCards && K.coinCards.length) {
      const cname = K.coinCards[Math.floor(Random.random('loot') * K.coinCards.length)];
      const coin = lib.find(x => x.name === cname);
      if (coin && !seen.dup(coin)) { seen.add(coin); c.cards.push(coin); }
    }
    if (K.tokenChance && Random.random('loot') < K.tokenChance) {
      const token = lib.find(x => x.id === 'tt-token-gold');
      if (token && !seen.dup(token)) { seen.add(token); c.cards.push(token); c.tokenHit = true; }
    }
    return c;
  }

  // ---------- 掉落掷骰：opts = { isBoss, layer } → 宝箱实例 [{kind}] ----------
  // 职业宝箱概率（需求 #3/#4）：基础 25%；携带宠物「猎鹰宝宝」时提高至 35%
  const classChestChance = () => {
    const B = window.SDT.Base;
    const pet = B && B.carriedPet && B.carriedPet();
    return (pet && pet.effect && pet.effect.classChest) || 0.25;
  };
  function rollDrops(opts) {
    if (opts && opts.isBoss) return [{ kind: 'boss' }];
    // 巨兽「荒渊」（第 3/4 层精英，2026-09-09 玩法定版）：固定奖励 2 个大宝箱
    // （30% 概率额外 1 张传说卡在战后结算 game.bag.js settle 里判发）
    const names = (opts && opts.foeNames) || [];
    if (names.some(n => String(n).includes('巨兽'))) return [{ kind: 'large' }, { kind: 'large' }];
    const specs = SDT.MAP.layerChests;
    const li = opts && typeof opts.layer === 'number' ? opts.layer : 0;
    const spec = specs[li] || specs[0];
    const out = [];
    const weighted = (list, pick) => {
      const total = list.reduce((s, e) => s + e.w, 0);
      let roll = Random.random('loot') * total;
      for (const e of list) { roll -= e.w; if (roll <= 0) return pick(e); }
      return pick(list[list.length - 1]);
    };
    if (spec.fixed) {
      spec.fixed.forEach(part => {
        for (let i = 0; i < (part.n || 0); i++) out.push({ kind: part.k, isClass: false });
      });
      return out;
    }
    const chests = weighted(spec.count, e => e.n);
    for (let i = 0; i < chests; i++) {
      const kind = weighted(spec.types, e => e.k);
      // 职业宝箱（2026-09-06）：黑箱，只掉落职业卡牌；2026-09-09 降到 25%，猎鹰宝宝 35%
      const isClass = Random.random('loot') < classChestChance();
      out.push({ kind, isClass });
    }
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
  function open(game, chests, done, opts) {
    const K = Object.assign({ resourceOnly: false }, opts || {});
    G = game;
    queue = chests.slice();
    idx = 0;
    onDone = done || null;
    G.state = 'modal';
    next();
  }

  function next() {
    if (idx >= queue.length) {
      searchSeq++;              // 作废未播完的搜索演出，避免收尾后又被旧定时器拉回浮层
      UI.hideOverlay();
      G.state = 'idle';
      cur = null;
      queue = [];   // 开完即清：isOpen 用 queue.length 判终态，残留会恒 true 锁死背包
      const cb = onDone;
      onDone = null;
      if (cb) cb();
      return;
    }
    cur = rollContents(queue[idx].kind, queue[idx].isClass);
    cur.isClass = !!queue[idx].isClass;
    idx++;
    renderSearch();
  }

  // 搜索物资演出（2026-09-09 老板 #3）：搜刮点/宝箱先演一段「翻检」，
  // 约 0.78s 后才揭晓开出的卡牌，收获不再凭空蹦出来
  const SEARCH_MS = 780;
  function renderSearch() {
    const K = KINDS()[cur.kind];
    const tok = ++searchSeq;
    UI.showOverlay(`[[icon:archive]] 搜刮！${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, `
      <p class="evt-sts-desc">${cur.isClass ? '黑色职业宝箱：只掉落<b>职业卡牌</b>' : '你俯身翻检箱子——灰尘、锈迹，还有别的东西。'}</p>
      <div class="pick-search">
        <span class="ps-lantern">[[icon:lantern]]</span>
        <span class="ps-ground"><i></i></span>
        <p class="ps-tip">正在搜索物资…</p>
      </div>`, 'chest');
    SDT.Sound.sfx('pick');
    UI.refresh(G);
    setTimeout(() => {
      if (tok !== searchSeq || !cur) return;   // 已开下一个/已收尾 → 不再揭晓
      render();
      scheduleRevealSfx();
    }, SEARCH_MS);
  }

  // ---------- 开箱浮层：悬在当前画面上的紧凑面板（杀戮尖塔「搜刮!」式） ----------
  // 不再整屏接管：模态卡片直接浮在棋盘/结算画面上，逐卡揭晓后收下继续。
  const riOf = (card) => Math.max(0, SDT.Cards.RARITIES.indexOf(card.rarity));

  function render() {
    const K = KINDS()[cur.kind];
    const isPick = !!K.pickFrom;   // 中宝箱：3 选 1
    const taken = cur.taken || (cur.taken = new Set());
    const cardsHTML = cur.cards.map((card, i) => {
      const got = taken.has(i);
      const act = isPick ? `data-act="chestPick" data-i="${i}" title="点击收下这张"`
        : got ? '' : `data-act="chestTake1" data-i="${i}" title="点击拾取进背包"`;
      return `<div class="bt-card chest-fly rl-${riOf(card)}${cur.isClass ? ' cls-chest' : ''}${got ? ' got' : ''}" style="animation-delay:${i * 160}ms"
        ${act}>
        ${SDT.Cards.cardHTML(card)}${got ? '<span class="chest-got-mark">已收</span>' : ''}
      </div>`;
    }).join('');
    const lootLine = isPick
      ? `从随机 <b>${cur.cards.length}</b> 张卡牌中选择 <b>1</b> 张 · 另含 [[icon:coin]] <b>${cur.coins}</b> 币`
      : `开出 <b>${cur.cards.length}</b> 张卡牌${cur.coins ? ` · [[icon:coin]] <b>${cur.coins}</b> 币` : ''}` +
        (cur.tokenHit ? ' · <b class="gold">[[icon:sparkles]] 员工通行证B！</b>' : '') +
        (cur.eggHit ? ' · <b class="gold">[[icon:paw]] 宠物蛋！</b>' : '');
    // 容量预检（2026-09-09 老板定向）：全部收下放不下时先提示清理背包——
    // 同名并入不占格；逐张模拟占格（基础格任意卡 / 珍珠盒扩格仅资源卡），算出放不下的张数
    const rest = cur.cards.filter((c, i) => !taken.has(i));
    let cant = 0, canTake = 0;
    // 三选一（2026-09-19 审计 P2-8）：满包时逐张预检——全部收不下则给警示与「只收金币离开」，
    // 点选被拒时留在面板（旧实现照常 next()，选中的卡被静默吞掉）
    const pickNoFit = isPick && !rest.some(c => (G.canReceiveCard ? G.canReceiveCard(c) : true));
    if (!isPick) {
      const baseCap = SDT.Base.bagCap(), totalCap = G.bagCap();
      let simUsed = G.usedSlots();
      rest.forEach(c => {
        if (G.ownedCards.some(o => o.card.name === c.name)) { canTake++; return; }   // 同名并入
        if (simUsed < baseCap || (c.type === '资源' && simUsed < totalCap)) { simUsed++; canTake++; }
        else cant++;
      });
    }
    const warnLine = pickNoFit
      ? `<p class="chest-warn">[[icon:bag]] 背包已满（${G.usedSlots()}/${G.bagCap()} 格）——选中的卡收不下：按 B 打开背包腾出格子再选，或只收${cur.coins ? `${cur.coins} 币` : '卡牌散落'}离开</p>`
      : cant > 0
      ? `<p class="chest-warn">[[icon:bag]] 背包已满（${G.usedSlots()}/${G.bagCap()} 格，珍珠盒扩格只收资源卡）——只能再收 <b>${canTake}</b> 张：可单点卡牌拾取，或按 B 打开背包把卡牌拖入安全格/存入珍珠盒腾出格子，或全部收下（放不下的 <b>${cant}</b> 张将散落）</p>`
      : '';
    const ops = isPick
      ? (pickNoFit
        ? `<div class="scene-ops chest-ops"><button class="ov-btn" data-act="chestSkip">${cur.coins ? '只收金币并离开' : '放弃卡牌并离开'}</button></div>`
        : '')   // 2026-09-15 老板：说明文字收敛——页脚一句已覆盖，不再重复提示
      // 2026-09-06 留言：全部收下移到右边，左侧加跳过（散落不要了）
      // 2026-09-09 老板定向：满包预检提示 + 单卡拾取（放不下的卡强收时散落，不再静默）
      : `<div class="scene-ops chest-ops"><button class="ov-btn" data-act="chestSkip">${cur.coins ? '只收金币并离开' : '放弃卡牌并离开'}</button><button class="ov-btn ok${cant > 0 ? ' warn' : ''}" data-act="chestTake">[[icon:archive]] 全部收下${cant > 0 ? `（${cant} 张放不下）` : cur.coins ? `（含 ${cur.coins} 币）` : ''}</button></div>`;
    UI.showOverlay(`[[icon:archive]] 搜刮！${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, `
      <div class="loot-manifest"><div><span>FIELD SUPPLY / ${String(idx).padStart(2, '0')}</span><b>${isPick ? '选一件，继续前行。' : '发现补给，整理收获。'}</b></div><div class="loot-capacity"><small>背包占用</small><b>${G.usedSlots()} <em>/ ${G.bagCap()}</em></b></div></div>
      ${cur.isClass ? '<p class="evt-sts-desc cls-chest-note">黑色职业宝箱：只掉落<b>职业卡牌</b></p>' : ''}
      <p class="evt-sts-desc">${lootLine}</p>
      ${warnLine}
      ${cur.cards.length ? `<div class="bt-hand${taken.size ? ' no-anim' : ''}" data-n="${cur.cards.length}">${cardsHTML}</div>` : '<p class="ov-empty">（卡牌库是空的，什么也没开出）</p>'}
      <div class="loot-footer-note">${isPick ? '点击一张收下' : '点击卡牌可逐张收取'} · 未收取的卡牌将散落</div>${ops}`, 'chest');
    UI.act('chestTake', takeAll);
    UI.act('chestTake1', (d) => {
      const card = cur.cards[+d.i];
      if (!card || cur.taken.has(+d.i)) return;
      if (G.grantCard(card, { silent: true })) {   // grantEventCard：同名并入 / 容量判定都在里面（搜刮页自带揭晓，不再叠加获得演出）
        cur.taken.add(+d.i);
        render();
      }
      // 收不下（背包满）时 grantCard 内部已 warn 日志，卡保持可点不动
    });
    UI.act('chestSkip', () => {
      if (cur.coins) G.gainCoins(cur.coins);   // 币是无主物，跳过也收；卡牌散落
      UI.log('（你留下开出的卡牌，转身走了……）', 'dim');
      next();
    });
    UI.act('chestPick', (d) => {
      const card = cur.cards[+d.i];
      if (!card) return;
      // 放不下时留在面板（grantCard 内部已播报「背包已满」）：玩家可腾格重选或走「只收金币离开」，
      // 不得照常 next()——否则三选一被静默吞卡（2026-09-19 审计 P2-8）
      if (!G.grantCard(card, { silent: true })) return;
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
    const taken = cur.taken;
    cur.cards.forEach((card, i) => {
      if (taken && taken.has(i)) return;   // 已单卡拾取过的不重复入包
      G.grantCard(card, { silent: true });   // 搜刮页自带揭晓，不叠加获得演出
    });
    if (cur.coins) G.gainCoins(cur.coins);
    if (!cur.cards.length && !cur.coins) UI.log('（空的——早被别的拾荒者搬空了……）', 'dim');
    next();
  }

  // 挂起/恢复（2026-09-09 留言 #13）：搜刮界面允许打开背包——
  // suspend 作废未播完的搜索演出计时器（防止中途 render 抢走背包浮层），
  // 背包关闭后 resume 重新渲染当前搜刮面板继续开箱
  function suspend() {
    searchSeq++;
    return !!(cur || queue.length);
  }
  function resume() {
    if (cur) render();
  }
  sdtDefine('Chests', { rollDrops, dropText, open, rollContents, isOpen: () => !!(cur || queue.length), suspend, resume });

export { G, SDT, UI, render };
