import { sdtDefine } from '../core/sdt-facade.js';

import { Random } from '../core/random.js';
import { esc, escAttr } from '../core/shared.js';
import { rewardSceneHTML, rewardExitHTML } from '../ui/reward-scene-view.js';
import { turboMs, isTurbo } from '../core/turbo.js';
import { serializeChestReward, restoreChestReward } from './chest-reward-save.js';

  const SDT = window.SDT;
  const UI = SDT.UI;

  let G = null;        // game 主对象
  let queue = [];      // 待开宝箱 [{kind}]
  let cur = null;      // 当前宝箱 {kind, cards, coins}
  let idx = 0;         // 已开到第几个
  let onDone = null;   // 全部开完后的续流回调
  let saveContext = null;
  let saveBinding = null;
  let rewardZoom = null;
  const closeRewardZoom = () => { rewardZoom?._closeCardZoom?.(true); rewardZoom = null; };
  const bindSave = game => ({ seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos, runToken:game.discoveredPairs, slotId:SDT.Base?.slot });
  const isCurrentRewardRun = () => !!G && !!saveBinding && saveBinding.seed === G.seed &&
    saveBinding.layerIdx === G.layerIdx && saveBinding.trackPos === G.trackPos &&
    saveBinding.runToken === G.discoveredPairs && saveBinding.slotId === SDT.Base?.slot;
  const persistReward = () => { if (isCurrentRewardRun() && (saveContext?.onCell || saveContext?.battleSettlement)) G.persistSave?.(); };
  let searchSeq = 0;   // 搜索演出代次：过期定时器不得再渲染（连开多箱/提前结束时防串台）
  let searchTimer = null, openingTimer = null, openingPresentation = null;

  const CHEST_FRAME_SETS = Object.fromEntries(['small', 'medium', 'large', 'class', 'boss'].map(kind => [kind, { frames: [], fps: 8 }]));
  // Current candidate families: only the displayed family is decoded.
  CHEST_FRAME_SETS.small = { fps:24, frames:[
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-03.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-04.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-05.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-06.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-07.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-08.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-09.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-10.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-11.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-12.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-13.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-14.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-15.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-16.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/small-rig-640-v1/frame-17.webp', import.meta.url).href,
  ] };
  CHEST_FRAME_SETS.medium = { fps:24, frames:[
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-03.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-04.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-05.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-06.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-07.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-08.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-09.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-10.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-11.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-12.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-13.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-14.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-15.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-16.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/medium-rig-640-v1/frame-17.webp', import.meta.url).href,
  ] };
  CHEST_FRAME_SETS.large = { fps:24, frames:[
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-03.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-04.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-05.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-06.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-07.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-08.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-09.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-10.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-11.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-12.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-13.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-14.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-15.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-16.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/large-rig-640-v1/frame-17.webp', import.meta.url).href,
  ] };
  CHEST_FRAME_SETS.class = { fps:24, frames:[
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-03.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-04.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-05.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-06.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-07.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-08.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-09.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-10.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-11.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-12.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-13.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-14.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-15.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-16.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/class-rig-640-v1/frame-17.webp', import.meta.url).href,
  ] };
  CHEST_FRAME_SETS.boss = { fps:24, frames:[
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-00.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-01.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-02.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-03.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-04.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-05.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-06.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-07.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-08.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-09.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-10.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-11.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-12.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-13.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-14.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-15.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-16.webp', import.meta.url).href,
    new URL('../../assets/scenes/chests/boss-rig-640-v1/frame-17.webp', import.meta.url).href,
  ] };
  function configureFrameArt(sets) {
    for (const kind of Object.keys(CHEST_FRAME_SETS)) {
      const set = sets?.[kind];
      if (!set || !Array.isArray(set.frames) || !set.frames.every(frame => typeof frame === 'string' && frame)) continue;
      CHEST_FRAME_SETS[kind] = { frames: set.frames.slice(), fps: Math.min(60, Math.max(1, Number(set.fps) || 8)) };
    }
  }
  const frameArtOf = box => CHEST_FRAME_SETS[box.isClass ? 'class' : box.kind] || CHEST_FRAME_SETS.medium;
  function cancelPresentation() {
    if (searchTimer != null) clearTimeout(searchTimer);
    if (openingTimer != null) clearTimeout(openingTimer);
    searchTimer = null; openingTimer = null; openingPresentation = null;
  }
  function isCurrentPresentation(context) {
    return typeof document !== 'undefined' && context === openingPresentation && context.sequence === searchSeq
      && context.box === cur && context.game === G && context.seed === G?.seed
      && isCurrentRewardRun() && !context.revealed && !UI.el?.overlay?.hidden
      && (!context.surface || UI.el?.ovBody?.querySelector('[data-eps-search]') === context.surface);
  }
  function revealOnce(context) {
    if (!isCurrentPresentation(context)) return;
    context.revealed = true;
    if (searchTimer != null) clearTimeout(searchTimer);
    if (openingTimer != null) clearTimeout(openingTimer);
    searchTimer = null; openingTimer = null;
    render(); scheduleRevealSfx();
  }
  function beginOpening(context, skip = false) {
    if (!isCurrentPresentation(context)) return;
    if (searchTimer != null) clearTimeout(searchTimer);
    searchTimer = null;
    if (openingTimer != null) clearTimeout(openingTimer);
    openingTimer = null;
    const image = UI.el.ovBody.querySelector('.ps-chest');
    const reduced = SDT.Motion?.reduceMotion?.() || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (skip || reduced || isTurbo() || context.frames.length < 2) {
      if (image && context.frames.length) image.src = context.frames.at(-1);
      revealOnce(context); return;
    }
    if (!context.framesReady) { context.pendingOpen = true; return; }
    const tip = UI.el.ovBody.querySelector('.ps-tip');
    if (tip) tip.textContent = '正在开启物资匣…（点击跳过）';
    image?.classList.add('chest-opening');
    let frame = 1;
    const step = () => {
      if (!isCurrentPresentation(context)) return;
      if (frame >= context.frames.length) { revealOnce(context); return; }
      if (image) { image.src = context.frames[frame]; image.dataset.chestFrame = String(frame); }
      frame++;
      openingTimer = setTimeout(step, turboMs(1000 / context.fps));
    };
    step();
  }

  const KINDS = () => SDT.MAP.chestKinds;
  const rndInt = (a, b) => a + Math.floor(Random.random('loot') * (b - a + 1));

  // 宝箱立绘（2026-09-20 老板令：奖励界面宝箱要专门放图片和动画）——
  // 五种宝箱各一张 NAI painterly 立绘（近黑底已抠透明），scenes/ 目录自动进预加载清单；
  // 职业宝箱=medium+isClass 的黑色变体，走独立图
  const CHEST_ART = {
    small: new URL('../../assets/scenes/scene-chest-small-anime-v1.webp', import.meta.url).href,
    medium: new URL('../../assets/scenes/scene-chest-medium-anime-v1.webp', import.meta.url).href,
    large: new URL('../../assets/scenes/scene-chest-large-anime-v1.webp', import.meta.url).href,
    boss: new URL('../../assets/scenes/scene-chest-boss-anime-v1.webp', import.meta.url).href,
  };
  const chestArtOf = (cur) => frameArtOf(cur).frames[0] || (cur.isClass
    ? new URL('../../assets/scenes/scene-chest-class-anime-v1.webp', import.meta.url).href
    : (CHEST_ART[cur.kind] || CHEST_ART.medium));

  // W2-05（2026-09-27 R2）：档位色带钩子——弹层 .card.chest 挂 tier-{kind} 类，
  // 视觉（标题底边线/描边/标题字色）在 css/expedition-rewards.css 按 小=古朴灰/
  // 中=稀有蓝/大=传说金 分档；boss/职业箱不挂类保持现状。纯呈现，不改掉落语义。
  const TIER_KINDS = new Set(['small', 'medium', 'large']);
  function markChestTier(cur) {
    const card = document.querySelector('#overlay .card.chest');
    if (!card) return;
    if (!cur?.battleSummary || !UI.el?.ovBody?.querySelector('.reward-head')) card.classList.remove('fx-victory');
    card.classList.remove('tier-small', 'tier-medium', 'tier-large');   // 弹层卡节点跨次复用，先清旧档位再挂（实测会累积）
    if (!cur || !TIER_KINDS.has(cur.kind) || cur.isClass) return;
    card.classList.add('tier-' + cur.kind);
  }

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
    const rollPetEgg = () => {
      const eggRate = SDT.Base.petEggDropChance();
      let eggGranted = false;
      if (Random.random('loot') < eggRate) {
        const egg = (SDT.Cards.all() || []).find(x => x.id === 'pet-egg');
        if (egg && !seen.dup(egg)) {
          seen.add(egg); c.cards.push(egg); c.eggHit = true;
          eggGranted = true;
        }
      }
      // Failed writes keep the legacy in-memory progression; they never reroll
      // or revoke an already determined reward.
      SDT.Base.recordPetEggChestResult({ eggGranted });
    };
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
      rollPetEgg();
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
    // Every chest reward advances the same hard-pity counter, including class chests.
    rollPetEgg();
    // —— 宝箱保底（2026-09-09 试玩反馈；设计者定版权重 60:28:9:3 不动）——
    // 中宝箱（3 选 1）整包全古朴的概率约 21.6%，体验很差：保底至少 1 张「稀有」+；
    // 大宝箱 / 首脑宝箱保底至少 1 张「史诗」+。未达标就重掷最后一张非宠物蛋卡（目标档内挑卡，
    // 该档暂无可用卡则逐档上探；全部失败则保持原结果）。职业宝箱走上面独立分支，不参与。
    const riOfCard = (card) => Math.max(0, SDT.Cards.RARITIES.indexOf(card.rarity));
    const needRi = K.pickFrom ? SDT.Cards.RARITIES.indexOf('稀有')
      : (kind === 'large' || kind === 'boss') ? SDT.Cards.RARITIES.indexOf('史诗') : -1;
    let upgradeIndex = -1;
    for (let i = c.cards.length - 1; i >= 0; i--) {
      if (c.cards[i].id !== 'pet-egg') { upgradeIndex = i; break; }
    }
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
        if (up) {
          if (upgradeIndex >= 0) c.cards[upgradeIndex] = up;
          else c.cards.push(up);
          seen.add(up); c.pity = tier; break;
        }
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
    cancelPresentation();
    const K = Object.assign({ resourceOnly: false }, opts || {});
    G = game;
    saveContext = { onCell:!!K.onCell, consumeNode:!!K.consumeNode,
      ...(K.battleSettlement ? { battleSettlement:K.battleSettlement } : {}) };
    saveBinding = bindSave(game);
    queue = chests.map((chest, i) => ({ ...chest, battleSummary: i === 0 ? K.battleSummary || null : null }));
    idx = 0;
    onDone = done || null;
    G.state = 'modal';
    next();
  }

  function next() {
    closeRewardZoom();
    cancelPresentation();
    if (idx >= queue.length) {
      searchSeq++;              // 作废未播完的搜索演出，避免收尾后又被旧定时器拉回浮层
      UI.hideOverlay();
      G.state = 'idle';
      cur = null;
      queue = [];   // 开完即清：isOpen 用 queue.length 判终态，残留会恒 true 锁死背包
      saveContext = null;
      saveBinding = null;
      const cb = onDone;
      onDone = null;
      if (cb) cb();
      return;
    }
    cur = rollContents(queue[idx].kind, queue[idx].isClass);
    cur.selected = null;
    cur.lost = new Set();
    cur.coinsReceived = false;
    cur.leaveConfirm = false;
    cur.notice = '';
    cur.isClass = !!queue[idx].isClass;
    cur.battleSummary = queue[idx].battleSummary || null;
    idx++;
    persistReward();   // 在揭晓前冻结本箱内容与RNG；刷新不再重掷。
    renderSearch();
  }

  // 搜索物资演出（2026-09-09 老板 #3）：搜刮点/宝箱先演一段「翻检」，
  // 约 0.78s 后才揭晓开出的卡牌，收获不再凭空蹦出来
  // 09-20 老板令：搜索阶段直接上宝箱本体立绘（轻晃=被翻检的手感），
  // 旧提灯图标（没图时代的替身）退役；进度条/提示文字保留
  const SEARCH_MS = 780;
  function renderSearch() {
    cancelPresentation();
    const K = KINDS()[cur.kind];
    const tok = ++searchSeq;
    const frames = frameArtOf(cur);
    const context = openingPresentation = { sequence: tok, box: cur, game: G, seed: G.seed, revealed: false, frames: frames.frames.slice(), fps: frames.fps };
    context.framesReady = true;
    if (context.frames.length && typeof Image !== 'undefined' && typeof Image.prototype.decode === 'function') {
      context.framesReady = false;
      const images = context.frames.map(src => { const image = new Image(); image.src = src; return image; });
      Promise.all(images.map(image => image.decode())).then(() => {
        if (!isCurrentPresentation(context)) return;
        context.framesReady = true;
        if (context.pendingOpen) beginOpening(context);
      }).catch(() => {
        if (isCurrentPresentation(context)) revealOnce(context);
      });
    }
    globalThis.__probe?.('rs', `tok=${tok} t=${Date.now()} kind=${cur.kind}`);
    UI.showOverlay(`[[icon:archive]] 搜寻物资 · ${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, `
      <p class="evt-sts-desc">${cur.isClass ? '职业补给：本职业专属卡牌' : '正在解锁封存物资。'}</p>
      <button type="button" class="pick-search" data-eps-search data-act="chestReveal" title="点击立即揭晓" style="appearance:none;border:0;background:transparent;color:inherit;font:inherit;width:100%;cursor:pointer">
        <img class="chest-prop ps-chest" data-chest-animated="${context.frames.length > 1}" data-chest-frame="0" src="${chestArtOf(cur)}" alt="" draggable="false">
        <span class="ps-tip">正在搜索物资…（点击立即揭晓）</span>
      </button>`, 'chest');
    context.surface = UI.el?.ovBody?.querySelector('[data-eps-search]');
    markChestTier(cur);
    // W6-01 事实更正（2026-09-27 R2）：battle.lifecycle.js:135 的三元式
    // sfx(win===true?'victory':…) 本就在战斗结束播放胜利音——评审 rg 审计按字面
    // 「sfx('victory')」检索漏掉了条件表达式。此处不再二次触发（会双响）。
    // 音频面 Accent 缺口的真实修正=W6-02 音量归位（kill/victory 曲线）+W5-01 视觉拍。
    SDT.Sound.sfx('pick');
    UI.refresh(G);
    const delay = turboMs(SEARCH_MS);
    // 体验线切片5（2026-09-28，评估#8）：搜索阶段点击立即揭晓——连开多箱的节奏死点消除；
    // searchSeq 代次保护防串台，揭晓后浮层重绘、监听随之失效
    UI.act('chestReveal', () => beginOpening(context, true));
    searchTimer = setTimeout(() => {
      globalThis.__probe?.('rv', `tok=${tok} seq=${searchSeq} cur=${!!cur} t=${Date.now()} delay=${delay}`);
      beginOpening(context);
    }, delay);
  }
  // ---------- 开箱浮层：悬在当前画面上的紧凑面板（杀戮尖塔「搜刮!」式） ----------
  // 不再整屏接管：模态卡片直接浮在棋盘/结算画面上，逐卡揭晓后收下继续。
  const rewardRarity = (card) => SDT.Cards.rarityOf?.(card) || card.rarity;

  function render() {
    const K = KINDS()[cur.kind];
    const isPick = !!K.pickFrom;   // 中宝箱：3 选 1
    const taken = cur.taken || (cur.taken = new Set());
    const lost = cur.lost || (cur.lost = new Set());
    const selected = Number.isInteger(cur.selected) ? cur.selected : null;
    const cardsHTML = cur.cards.map((card, i) => {
      const got = taken.has(i), dropped = lost.has(i);
      const fits = G.canReceiveCard ? G.canReceiveCard(card) : true;
      const action = got || dropped
        ? `<span class="reward-unit-state">${got ? '已入背包' : '已散落'}</span>`
        : `<button type="button" class="reward-claim${fits ? '' : ' needs-room'}" data-act="${fits ? isPick ? 'chestPick' : 'chestTake1' : 'chestOpenBag'}" data-i="${i}"${cur.leaveConfirm ? ' disabled' : ''}>${fits ? '收下' : '整理背包'}</button>`;
      return `<article class="reward-unit${got ? ' got' : dropped ? ' dropped' : ''}" data-reward-rarity="${escAttr(rewardRarity(card))}">
        <button type="button" class="reward-card" data-act="chestSelect" data-i="${i}" aria-label="放大查看${escAttr(card.name || '卡牌')}" title="放大查看">${SDT.Cards.cardHTML(card)}</button>${action}</article>`;
    }).join('');
    // 容量预检（2026-09-09 老板定向）：全部收下放不下时先提示清理背包——
    // 同名并入不占格；逐张模拟占格（基础格任意卡 / 珍珠盒扩格仅资源卡），算出放不下的张数
    const rest = cur.cards.filter((c, i) => !taken.has(i) && !lost.has(i));
    let cant = 0, canTake = 0;
    // 三选一（2026-09-19 审计 P2-8）：满包时逐张预检——全部收不下则给警示与「只收金币离开」，
    // 点选被拒时留在面板（旧实现照常 next()，选中的卡被静默吞掉）
    const pickNoFit = isPick && rest.length > 0 && !rest.some(c => (G.canReceiveCard ? G.canReceiveCard(c) : true));
    if (!isPick) {
      const baseCap = SDT.Base.bagCap(), totalCap = G.bagCap();
      let simUsed = G.usedSlots();
      rest.forEach(c => {
        if (G.ownedCards.some(o => o.card.name === c.name)) { canTake++; return; }   // 同名并入
        if (simUsed < baseCap || (c.type === '资源' && simUsed < totalCap)) { simUsed++; canTake++; }
        else cant++;
      });
    }
    // 体验线切片4（2026-09-28，源自 Tarkov value-per-slot 心智模型）：满包时给出"最低价已装卡"参照，
    // 让"值不值得为战利品让路"变成一眼对比（替换操作仍走背包/商店，这里只给判断依据）
    const cheapestOwned = (G.ownedCards || [])
      .filter(o => o.card && !(SDT.Base.isSha ? SDT.Base.isSha(o.card) : false))
      .map(o => ({ name: o.card.name, price: SDT.Cards.sellPrice(o.card) }))
      .sort((a, b) => a.price - b.price)[0];
    const cheapHint = cheapestOwned
      ? ` 背包内最低估值：「${esc(cheapestOwned.name)}」${cheapestOwned.price} 币。`
      : '';
    const warnLine = pickNoFit
      ? `<p class="chest-warn">[[icon:bag]] 背包 ${G.usedSlots()}/${G.bagCap()} 格：当前候选都放不下。整理背包后可返回同一选择。</p>`
      : cant > 0
      ? `<p class="chest-warn">[[icon:bag]] 背包 ${G.usedSlots()}/${G.bagCap()} 格：按当前卡牌顺序预计可收 ${canTake} 张、${cant} 张放不下；批量领取时实际结果按逐张容量判定，放不下的会散落。${cheapHint}</p>`
      : '';
    const finished = rest.length === 0;
    const ops = cur.leaveConfirm
      ? `<div class="reward-leave-confirm"><p>放弃剩余 ${rest.length} 张卡牌？</p><button type="button" class="reward-secondary" data-act="chestStay">继续领取</button><button type="button" class="reward-secondary danger" data-act="chestLeave">确认放弃</button></div>`
      : rewardExitHTML(finished ? 'chestContinue' : 'chestSkip', finished ? '继续探索' : '离开');
    const bulk = !finished && !isPick && !cur.leaveConfirm && rest.length > 1
      ? `<button type="button" class="reward-secondary${cant ? ' danger' : ''}" data-act="chestTake">全部收下${cant ? ` · ${cant} 张可能散落` : ''}</button>` : '';
    const outcome = cur.battleSummary?.cardOutcome;
    const details = outcome ? `<details class="loot-outcome"><summary>本战卡牌去向</summary>${[['进入消耗口袋',outcome.pocket],['直接消散',outcome.gone],['仍在背包',outcome.retained]].map(([label,names]) => `<p><b>${label}</b>：${names.length ? names.map(esc).join('、') : '无'}</p>`).join('')}</details>` : '';
    const coins = cur.coins ? `<div class="reward-coins"><b>[[icon:coin]] +${cur.coins}</b><span>${cur.coinsReceived ? '已获得' : '离开时获得'}</span></div>` : '';
    const footer = `<span class="reward-capacity">[[icon:bag]] ${G.bagCapacityText?.() || `${G.usedSlots()}/${G.bagCap()} 格`}</span><button type="button" class="reward-bag" data-act="chestOpenBag">整理背包</button>${cur.notice && !finished ? `<span class="reward-notice" role="status">${esc(cur.notice)}</span>` : ''}${finished ? `<span class="reward-final" role="status">${taken.size} 张已入背包${lost.size ? ` · ${lost.size} 张已散落` : ''}</span>` : ''}`;
    const body = rewardSceneHTML({
      title:cur.battleSummary ? '战斗胜利' : isPick ? '选择收获' : '搜刮完成',
      source:`${cur.isClass ? '职业补给' : K.name}${queue.length > 1 ? ` · ${idx}/${queue.length}` : ''}`,
      rule:finished ? '' : isPick ? '任选 1 张，其他卡牌留在原地' : cur.cards.length > 1 ? '奖励可分别领取' : '',
      cards:cardsHTML || '<p class="reward-empty">这里没有卡牌</p>',
      actions:`${ops}${bulk}`, coins, footer, warning:warnLine, details, count:cur.cards.length,
      className:`reward-v14${taken.size || lost.size ? ' no-anim' : ''}`,
    });
    const currentBody = UI.el?.ovBody;
    if (currentBody?.querySelector('.reward-v14')) {
      const scrollTop = currentBody.querySelector('.loot-scroll')?.scrollTop || 0;
      const hadFocus = currentBody.contains(document.activeElement);
      currentBody.innerHTML = SDT.Icons.rich(body);
      const scroll = currentBody.querySelector('.loot-scroll');
      if (scroll) scroll.scrollTop = scrollTop;
      if (hadFocus) currentBody.querySelector(`[data-act="chestSelect"][data-i="${selected ?? 0}"]`)?.focus({ preventScroll:true });
    } else {
      UI.showOverlay(`[[icon:archive]] ${cur.battleSummary ? '搜刮！战斗胜利 · ' : '收获 · '}${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, body, 'chest');
    }
    markChestTier(cur);
    const renderedBox = cur;
    const surface = UI.el?.ovBody?.querySelector('.reward-v14');
    const isLiveReward = () => isCurrentRewardRun() && cur === renderedBox && G.state === 'modal' &&
      !!surface && UI.el?.ovBody?.querySelector('.reward-v14') === surface && !UI.el?.overlay?.hidden;
    UI.act('chestTake', () => { if (isLiveReward() && !isPick && !cur.leaveConfirm) takeAll(); });
    UI.act('chestSelect', (d) => {
      if (!isLiveReward()) return;
      const i = Number(d.i);
      if (!Number.isInteger(i) || !cur.cards[i]) return;
      cur.selected = i;
      cur.leaveConfirm = false;
      cur.notice = '';
      const card = cur.cards[i];
      const available = !cur.taken.has(i) && !cur.lost.has(i);
      const fits = G.canReceiveCard ? G.canReceiveCard(card) : true;
      const source = UI.el.ovBody.querySelector(`[data-act="chestSelect"][data-i="${i}"]`);
      UI.showCardZoom?.(card, { from:source, returnFocus:source, hideNote:true, presentation:'expedition',
        footer:available ? `<button class="ov-btn ok" data-act="${fits ? isPick ? 'chestPick' : 'chestTake1' : 'chestOpenBag'}" data-i="${i}">${fits ? '收下' : '整理背包'}</button>` : '' });
      rewardZoom = document.getElementById('cardZoom');
    });
    UI.act('chestTake1', (d) => {
      if (!isLiveReward() || isPick || cur.leaveConfirm) return;
      const i = Number(d.i);
      const card = cur.cards[i];
      if (!card || cur.taken.has(i) || cur.lost.has(i)) return;
      closeRewardZoom();
      cur.selected = i;
      if (G.grantCard(card, { silent: true })) {   // grantEventCard：同名并入 / 容量判定都在里面（搜刮页自带揭晓，不再叠加获得演出）
        cur.taken.add(i);
        persistReward();
        cur.notice = `「${card.name}」已入本次远征背包`;
        render();
      } else { cur.notice = `「${card.name}」当前放不下，整理背包后可重试`; render(); }
    });
    UI.act('chestSkip', () => {
      if (!isLiveReward()) return;
      if (cur.cards.some((_, i) => !cur.taken.has(i) && !cur.lost.has(i))) {
        cur.leaveConfirm = true;
        cur.notice = '';
        render();
      } else { collectCoinsOnce(); next(); }
    });
    UI.act('chestStay', () => { if (isLiveReward()) { cur.leaveConfirm = false; render(); } });
    UI.act('chestLeave', () => {
      if (!isLiveReward() || !cur.leaveConfirm) return;
      cur.cards.forEach((_, i) => { if (!cur.taken.has(i)) cur.lost.add(i); });
      collectCoinsOnce();
      UI.log('（未收取的卡牌留在原地）', 'dim');
      cur.leaveConfirm = false;
      cur.notice = '剩余卡牌已散落';
      render();
    });
    UI.act('chestContinue', () => {
      if (!isLiveReward() || cur.cards.some((_, i) => !cur.taken.has(i) && !cur.lost.has(i))) return;
      collectCoinsOnce(); next();
    });
    UI.act('chestOpenBag', () => { if (isLiveReward()) { closeRewardZoom(); document.getElementById('bagBtnFloat')?.click(); } });
    UI.act('chestPick', (d) => {
      if (!isLiveReward() || !isPick || cur.leaveConfirm) return;
      const i = Number(d.i);
      const card = cur.cards[i];
      if (!card || cur.taken.has(i) || cur.lost.has(i)) return;
      closeRewardZoom();
      cur.selected = i;
      // 放不下时留在面板（grantCard 内部已播报「背包已满」）：玩家可腾格重选或走「只收金币离开」，
      // 不得照常 next()——否则三选一被静默吞卡（2026-09-19 审计 P2-8）
      if (!G.grantCard(card, { silent: true })) { cur.notice = `「${card.name}」当前放不下，整理背包后可重试`; render(); return; }
      cur.taken.add(i);
      cur.cards.forEach((_, other) => { if (other !== i) cur.lost.add(other); });
      collectCoinsOnce();
      cur.notice = `「${card.name}」已入本次远征背包`;
      render();
    });
    UI.refresh(G);
  }

  // 逐卡揭晓音效：史诗叮鸣、传说号角；揭晓卡带过冲 pop（game-feel）
  function scheduleRevealSfx() {
    const sequence = searchSeq;
    const revealed = cur;
    (cur.cards || []).forEach((c, i) => {
      setTimeout(() => {
        // 测试环境拆除后定时器仍触发（逐卡揭晓音效定时器无清理通道）：document 已删时安全短路；浏览器内不可达，行为逐字不变。
        if (typeof document === "undefined" || !isCurrentRewardRun() || sequence !== searchSeq || cur !== revealed || cur.taken?.has(i)) return;
        const hand = UI.el?.ovBody?.querySelector('.loot-scroll .reward-objects');
        if (!hand) return;
        SDT.Sound.sfx('reveal');
        const rarity = rewardRarity(c);
        if (rarity === '传说' || rarity === '棱彩') SDT.Sound.sfx('legend');
        else if (rarity === '史诗') SDT.Sound.sfx('ding');
        const cards = hand.children;
        const el = cards[i] || cards[cards.length - 1];
        if (el && SDT.Motion && !['史诗', '传说', '棱彩'].includes(rarity)) SDT.Motion.pop(el);
      }, 140 + i * 170);
    });
  }

  function takeAll() {
    const taken = cur.taken;
    cur.cards.forEach((card, i) => {
      if (taken.has(i) || cur.lost.has(i)) return;
      if (G.grantCard(card, { silent: true })) taken.add(i);
      else cur.lost.add(i);   // 原批量规则：放不下的卡散落；结果留在原位供核对
    });
    collectCoinsOnce();
    if (!cur.cards.length && !cur.coins) UI.log('（空的——早被别的拾荒者搬空了……）', 'dim');
    cur.notice = `已入背包 ${taken.size} 张${cur.lost.size ? `，放不下散落 ${cur.lost.size} 张` : ''}`;
    persistReward();
    render();
  }

  function collectCoinsOnce() {
    if (!cur || cur.coinsReceived) return;
    if (cur.coins) G.gainCoins(cur.coins);
    cur.coinsReceived = true;
    persistReward();
  }

  // 挂起/恢复（2026-09-09 留言 #13）：搜刮界面允许打开背包——
  // suspend 作废未播完的搜索演出计时器（防止中途 render 抢走背包浮层），
  // 背包关闭后 resume 重新渲染当前搜刮面板继续开箱
  function suspend() {
    closeRewardZoom();
    cancelPresentation();
    searchSeq++;
    return isCurrentRewardRun() && !!(cur || queue.length);
  }
  function resume() {
    cancelPresentation();
    if (isCurrentRewardRun() && cur) render();
  }
  function serialize(game) {
    if (G !== game || !isCurrentRewardRun()) return null;
    return serializeChestReward(game, queue, idx, cur, saveContext);
  }
  function restore(game, saved, done) {
    const value = restoreChestReward(game, saved);
    if (!value) return false;
    closeRewardZoom();
    cancelPresentation(); searchSeq++;
    G = game; queue = value.queue; idx = value.index; cur = value.current;
    saveContext = value.context; onDone = done; G.state = 'modal';
    saveBinding = bindSave(game);
    render(); persistReward(); return true;
  }
  const cancelOnModeChange = event => { if (event.detail !== 'chest') { cancelPresentation(); searchSeq++; } };
  if (typeof document !== 'undefined') document.addEventListener('sdt-overlay-mode', cancelOnModeChange);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelPresentation();
    if (typeof document !== 'undefined') document.removeEventListener('sdt-overlay-mode', cancelOnModeChange);
  });
  sdtDefine('Chests', { rollDrops, dropText, open, rollContents, configureFrameArt, isOpen: () => isCurrentRewardRun() && !!(cur || queue.length), suspend, resume, serialize, restore });

export { SDT };
