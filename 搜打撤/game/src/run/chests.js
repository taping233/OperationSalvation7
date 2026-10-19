import { sdtDefine } from '../core/sdt-facade.js';

import { Random } from '../core/random.js';
import { previewCardRewards } from '../core/card-capacity.js';
import { esc, escAttr } from '../core/shared.js';
import { showRewardCardFeedback } from '../ui/reward-card-feedback.js';
import { rewardPickerTitle } from '../ui/reward-picker-heading.js';
import { rewardCardState, rewardProgress, REWARD_RECEIVED } from '../ui/reward-state.js';
import { rewardSceneHTML, rewardExitHTML, rewardClaimHTML } from '../ui/reward-scene-view.js';
import { chestRewardOverviewHTML, chestRewardFrameHTML } from '../ui/chest-reward-overview.js';
import { turboMs, isTurbo } from '../core/turbo.js';
import { serializeChestReward, restoreChestReward } from './chest-reward-save.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { createChestFrameSets, safeOpeningHTML, SAFE_BURST, SAFE_CLOSED } from './chest-opening-art.js';

  const SDT = window.SDT;
  const UI = SDT.UI;

  let G = null;        // game 主对象
  let queue = [];      // 待开宝箱 [{kind}]
  let cur = null;      // 当前宝箱 {kind, cards, coins}
  let idx = 0;         // 已开到第几个
  let onDone = null;   // 全部开完后的续流回调
  let saveContext = null;
  let rewardScreen = 'overview', overviewMode = true;
  let saveBinding = null;
  let parked = false;
  let beforeMapReturn = null, returningToMap = false;
  let rewardZoom = null;
  // Ephemeral presentation only: never serialized into reward/save data.
  const rewardPositions = new WeakMap();
  function rememberRewardPosition() {
    const scroll = UI.el?.ovBody?.querySelector('.reward-v14 .loot-scroll');
    if (!cur || !scroll) return;
    rewardPositions.set(cur, { top:scroll.scrollTop, left:scroll.scrollLeft });
  }
  function restoreRewardPosition() {
    const position = cur && rewardPositions.get(cur);
    const scroll = UI.el?.ovBody?.querySelector('.reward-v14 .loot-scroll');
    if (!position || !scroll) return;
    scroll.scrollTop = position.top; scroll.scrollLeft = position.left;
    if (Number.isInteger(cur.selected)) {
      UI.el.ovBody.querySelector(`[data-act="chestSelect"][data-i="${cur.selected}"]`)?.focus({ preventScroll:true });
    }
  }
  let noticeFailure = null, suspendedBag = null;
  const clearNoticeContext = () => { noticeFailure = null; suspendedBag = null; };
  const closeRewardZoom = () => { rewardZoom?._closeCardZoom?.(true); rewardZoom = null; };
  const bindSave = game => ({ seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos, runToken:game.discoveredPairs, slotId:SDT.Base?.slot });
  const isCurrentRewardRun = () => !parked && !!G && !!saveBinding && saveBinding.seed === G.seed &&
    saveBinding.layerIdx === G.layerIdx && saveBinding.trackPos === G.trackPos &&
    saveBinding.runToken === G.discoveredPairs && saveBinding.slotId === SDT.Base?.slot;
  const persistReward = () => {
    if (!isCurrentRewardRun() || !(saveContext?.onCell || saveContext?.battleSettlement)) return;
    const saved = serializeChestReward(G, queue, idx, cur, saveContext, { screen:rewardScreen });
    if (saved) (G.nodeChestRewards ||= {})[`${G.layerIdx},${G.trackPos}`] = saved;
    G.persistSave?.();
  };
  async function returnToMap() {
    if (!isCurrentRewardRun() || !cur || G.state !== 'modal' || returningToMap) return false;
    returningToMap = true;
    try {
      if (beforeMapReturn && !await beforeMapReturn(saveContext?.battleSettlement)) return false;
      if (!isCurrentRewardRun() || !cur) return false;
      if (overviewMode) rewardScreen = 'overview';
      persistReward();
      closeRewardZoom(); cancelPresentation(); searchSeq++;
      parked = true;
      UI.hideOverlay(); G.state = 'idle'; G.persistSave?.(); UI.refresh(G);
      return true;
    } finally { returningToMap = false; }
  }
  let searchSeq = 0;   // 搜索演出代次：过期定时器不得再渲染（连开多箱/提前结束时防串台）
  let openingTimer = null, openingPresentation = null;

  const CHEST_FRAME_SETS = createChestFrameSets();
  function configureFrameArt(sets) {
    for (const kind of Object.keys(CHEST_FRAME_SETS)) {
      const set = sets?.[kind];
      if (!set || !Array.isArray(set.frames) || !set.frames.every(frame => typeof frame === 'string' && frame)) continue;
      CHEST_FRAME_SETS[kind] = { frames: set.frames.slice(), fps: Math.min(60, Math.max(1, Number(set.fps) || 8)) };
      for (const key of ['effects', 'phases', 'durationsMs']) {
        const list = set[key];
        if (!Array.isArray(list) || list.length !== set.frames.length) continue;
        const valid = key === 'durationsMs' ? list.every(value => Number.isFinite(value) && value > 0)
          : key === 'phases' ? list.every(value => ['charging', 'opening', 'burst', 'settle'].includes(value))
            : list.every(value => typeof value === 'string' && value);
        if (valid) CHEST_FRAME_SETS[kind][key] = list.slice();
      }
    }
  }
  const frameArtOf = box => CHEST_FRAME_SETS[box.isClass ? 'class' : box.kind] || CHEST_FRAME_SETS.medium;
  function cancelPresentation() {
    if (openingTimer != null) clearTimeout(openingTimer);
    openingTimer = null; openingPresentation = null;
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
    if (openingTimer != null) clearTimeout(openingTimer);
    openingTimer = null;
    cur.rewardStage = 'cards';
    persistReward();
    render(); scheduleRevealSfx();
  }
  function beginOpening(context, skip = false) {
    if (!isCurrentPresentation(context)) return;
    if (openingTimer != null) clearTimeout(openingTimer);
    openingTimer = null;
    const image = UI.el.ovBody.querySelector('.ps-chest');
    const effect = UI.el.ovBody.querySelector('.safe-burst');
    const reduced = SDT.Motion?.reduceMotion?.() || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (skip || reduced || isTurbo() || context.frames.length < 2) {
      if (image && context.frames.length) image.src = context.frames.at(-1);
      revealOnce(context); return;
    }
    if (!context.framesReady) { context.pendingOpen = true; return; }
    const tip = UI.el.ovBody.querySelector('.ps-tip');
    if (tip) tip.textContent = '封存解除 · 点击跳过';
    image?.classList.add('chest-opening');
    let frame = 1;
    const step = () => {
      if (!isCurrentPresentation(context)) return;
      if (frame >= context.frames.length) { revealOnce(context); return; }
      if (image) { image.src = context.frames[frame]; image.dataset.chestFrame = String(frame); }
      if (effect && context.effects?.[frame]) effect.src = context.effects[frame];
      const phase = context.phases?.[frame] || (frame >= Math.ceil(context.frames.length * .8) ? 'settle'
        : frame >= Math.floor(context.frames.length * .55) ? 'burst' : 'opening');
      if (context.surface) context.surface.dataset.chestPhase = phase;
      if (phase === 'burst' && !context.burstPlayed) { context.burstPlayed = true; SDT.Sound.sfx('chestBurst'); }
      const holdMs = context.durationsMs?.[frame] ?? 1000 / context.fps;
      frame++;
      openingTimer = setTimeout(step, turboMs(holdMs));
    };
    step();
  }

  const KINDS = () => SDT.MAP.chestKinds;
  const rndInt = (a, b) => a + Math.floor(Random.random('loot') * (b - a + 1));

  const chestArtOf = box => frameArtOf(box).frames[0] || SAFE_CLOSED;

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
    const c = { kind, cards: [], coins: 0, isClass: !!isClass, claimMode:K.pickFrom ? 'one' : 'all' };
    const seen = panelSeen();
    const rollPetEgg = () => {
      // 基础候选到此固定；宠物蛋及后续附赠不参与三选一的永久放弃。
      if (c.claimMode === 'one') {
        if (c.cards.length) c.choiceCount = c.cards.length;
        else c.claimMode = 'all'; // 空职业/随机池只可能留下附赠，不保存无效的 choiceCount:0。
      }
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
    if (K.coins) c.coins = rndInt(K.coins[0], K.coins[1]);
    // BOSS宝箱额外附赠金币/银币/铜币卡之一，直接并入 cards。
    // 注意：币名要先取好再 find——把随机取名写进 find 回调会对每张库卡重新随机
    const lib = SDT.Cards.all();
    if (K.coinCards && K.coinCards.length) {
      const cname = K.coinCards[Math.floor(Random.random('loot') * K.coinCards.length)];
      const coin = lib.find(x => x.name === cname);
      if (coin && !seen.dup(coin)) { seen.add(coin); c.cards.push(coin); }
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

  // 宝箱总览持有整批进度；卡牌弹层的关闭不结束节点或胜利续流。
  function open(game, chests, done, opts) {
    clearNoticeContext();
    cancelPresentation();
    const K = Object.assign({ resourceOnly: false }, opts || {});
    G = game;
    parked = false;
    beforeMapReturn = K.beforeMapReturn || null;
    saveContext = { onCell:!!K.onCell, consumeNode:!!K.consumeNode,
      ...(K.battleSettlement ? { battleSettlement:K.battleSettlement } : {}) };
    saveBinding = bindSave(game);
    queue = chests.map((chest, i) => ({ ...chest, battleSummary: i === 0 ? K.battleSummary || null : null }));
    idx = 0; cur = null; overviewMode = true; rewardScreen = 'overview';
    onDone = done || null;
    G.state = 'modal';
    if (!queue.length) { finishQueue(); return; }
    prepareBox(0);
    persistReward();
    renderChestOffer();
  }

  const boxResolved = box => !!box && box.cards.every((_, i) => box.taken.has(i) || box.lost.has(i))
    && (!box.coins || box.coinsReceived);
  const allBoxesResolved = () => queue.length > 0 && queue.every(box => box.completed || boxResolved(box.reward));
  const cardsResolved = box => !!box && box.rewardStage !== 'chest' && box.rewardStage !== 'opening'
    && box.cards.every((_, i) => box.taken.has(i) || box.lost.has(i));
  const pendingBox = slot => !slot.completed && !cardsResolved(slot.reward);
  function nextPendingBoxIndex() {
    const opened = queue.findIndex(slot => pendingBox(slot) && slot.reward && slot.reward.rewardStage !== 'chest');
    return opened >= 0 ? opened : queue.findIndex(pendingBox);
  }
  const compactNotice = notice => String(notice || '').replaceAll('本次远征背包', '背包').replaceAll('，整理背包后可重试', '');

  function finishQueue() {
    clearNoticeContext();
    closeRewardZoom();
    cancelPresentation();
    if (G.nodeChestRewards) delete G.nodeChestRewards[`${G.layerIdx},${G.trackPos}`];
    searchSeq++;              // 作废未播完的搜索演出，避免收尾后又被旧定时器拉回浮层
    UI.hideOverlay();
    G.state = 'idle';
    cur = null;
    queue = [];   // 清除活动领奖引用，再调用一次原续流。
    saveContext = null;
    saveBinding = null;
    const cb = onDone;
    onDone = null;
    if (cb) cb();
  }

  function prepareBox(index) {
    const slot = queue[index];
    if (!slot || slot.completed) return false;
    if (!slot.reward) slot.reward = Object.assign(rollContents(slot.kind, slot.isClass), {
      selected:null, taken:new Set(), lost:new Set(), coinsReceived:false,
      leaveConfirm:false, notice:'', battleSummary:slot.battleSummary || null, rewardStage:'chest',
    });
    idx = index + 1; cur = slot.reward;
    return true;
  }

  function next() {
    if (!boxResolved(cur)) return;
    queue[idx - 1].completed = true;
    if (!overviewMode) { finishQueue(); return; }
    closePicker();
  }

  function closePicker() {
    rememberRewardPosition();
    closeRewardZoom(); cancelPresentation(); searchSeq++;
    queue[idx - 1].completed = boxResolved(cur);
    cur.leaveConfirm = false;
    rewardScreen = 'overview';
    persistReward(); renderChestOffer();
  }

  function overviewHTML() {
    const nextIndex = nextPendingBoxIndex();
    const openLabel = slot => {
      const box = slot.reward, K = KINDS()[slot.kind] || KINDS().small;
      const hasCoins = box ? box.coins > 0 && !box.coinsReceived : (K.coins?.[1] || 0) > 0;
      return box && box.rewardStage !== 'chest'
        ? hasCoins ? '继续领取并收金币' : '继续领取'
        : hasCoins ? '开箱并收金币' : '打开宝箱';
    };
    const claimedCards = queue.flatMap(slot => slot.reward ? rewardProgress(slot.reward.cards, slot.reward.taken, slot.reward.lost).received : []);
    const complete = allBoxesResolved();
    return chestRewardOverviewHTML({
      title:queue.some(box => box.battleSummary) ? '战斗胜利' : '本次收获',
      source:'奖励总览', complete,
      claimedCards,
      coins:queue.reduce((sum, slot) => {
        sum.total += slot.reward?.coins || 0;
        if (!slot.reward?.coinsReceived) sum.pending += slot.reward?.coins || 0;
        return sum;
      }, { total:0, pending:0 }),
      primaryAction:nextIndex < 0 ? null : { index:nextIndex, label:openLabel(queue[nextIndex]) },
      progress:{ pending:queue.filter(pendingBox).length, total:queue.length },
      notice:claimedCards.length ? `已收下 ${claimedCards.length} 张${complete ? '' : ' · 还有奖励'}` : '',
      boxes:queue.map((slot, index) => {
        const K = KINDS()[slot.kind] || KINDS().small;
        const box = slot.reward;
        const complete = !!slot.completed || cardsResolved(box);
        const choice = box ? box.claimMode === 'one' : !!K.pickFrom;
        return { index, cardCount:box?.cards.length || 0, takenCount:box?.taken?.size || 0, lostCount:box?.lost?.size || 0, choice,
          name:slot.isClass ? '职业补给箱' : K.name, actionLabel:openLabel(slot),
          art:`<img src="${escAttr(chestArtOf(slot))}" alt="" draggable="false">`,
          rule:choice ? `${box?.choiceCount || box?.cards.length || K.pickFrom || 3} 张中选 1 张` : `${box?.cards.length ?? K.cards ?? 0} 张 · 可全部领取`,
          status:complete ? box?.taken?.size ? `已收下 ${box.taken.size} 张`
            : box?.lost?.size ? '卡牌已放弃' : '已完成'
            : box?.taken?.size ? `已收下 ${box.taken.size} 张 · 待领`
              : box && box.rewardStage !== 'chest' ? '待继续领取' : '待开启',
          completed:complete, opened:!!box && box.rewardStage !== 'chest', active:index === idx - 1 };
      }),
      footer:`<span data-card-receive-anchor="bag" aria-label="背包容量">[[icon:bag]] ${G.bagCapacityText?.() || `${G.usedSlots()}/${G.bagCap()} 格`}</span>`,
    });
  }

  function bindOverview() {
    const surface = UI.el?.ovBody?.querySelector('.cqo-overview');
    const active = () => isCurrentRewardRun() && rewardScreen === 'overview' && G.state === 'modal'
      && !!surface && UI.el?.ovBody?.querySelector('.cqo-overview') === surface && !UI.el?.overlay?.hidden;
    const openBox = index => {
      if (!active() || !Number.isInteger(index) || !queue[index] || !pendingBox(queue[index]) || !prepareBox(index)) return;
      if (noticeFailure?.box !== cur) clearNoticeContext();
      collectCoinsOnce(cur);
      rewardScreen = 'cards';
      if (cur.rewardStage === 'chest') {
        cur.rewardStage = 'opening'; persistReward(); renderSearch();
      } else { persistReward(); renderCurrentStage(); }
    };
    UI.act('chestOpen', d => openBox(Number(d.i)));
    UI.act('chestNext', () => openBox(nextPendingBoxIndex()));
    UI.act('chestOverviewCoins', () => {
      if (!active()) return;
      for (const slot of queue) {
        if (slot.reward?.coins && !slot.reward.coinsReceived) collectCoinsOnce(slot.reward);
        if (boxResolved(slot.reward)) slot.completed = true;
      }
      persistReward(); renderChestOffer();
    });
    UI.act('chestReturn', () => { if (active()) return returnToMap(); });
    UI.act('chestOverviewBag', () => { if (active()) bagSlots.showBackpack(); });
    UI.act('chestFinish', () => { if (active() && allBoxesResolved()) finishQueue(); });
  }

  function renderChestOffer() {
    cancelPresentation();
    searchSeq++;
    const nextIndex = nextPendingBoxIndex();
    UI.showOverlay('[[icon:archive]] 奖励总览', chestRewardFrameHTML({ overview:overviewHTML() }), 'chest', {
      initialFocus:nextIndex >= 0 ? `[data-act="chestOpen"][data-i="${nextIndex}"]`
        : allBoxesResolved() ? '[data-act="chestFinish"]' : '[data-act="chestOverviewCoins"]',
    });
    markChestTier(cur);
    bindOverview();
    UI.refresh(G);
  }

  function renderCurrentStage() {
    if (overviewMode && rewardScreen === 'overview') renderChestOffer();
    else if (cur.rewardStage === 'opening') { cur.rewardStage = 'cards'; render(); persistReward(); }
    else render();
  }

  // 搜索物资演出（2026-09-09 老板 #3）：搜刮点/宝箱先演一段「翻检」，
  // 打开后立即开始解封；图片解码就绪后按帧揭晓，点击可跳过。
  // 09-20 老板令：搜索阶段直接上宝箱本体立绘（轻晃=被翻检的手感），
  // 旧提灯图标（没图时代的替身）退役；进度条/提示文字保留
  function renderSearch() {
    cancelPresentation();
    const K = KINDS()[cur.kind];
    const tok = ++searchSeq;
    const frames = frameArtOf(cur);
    const context = openingPresentation = { sequence: tok, box: cur, game: G, seed: G.seed, revealed: false,
      frames:frames.frames.slice(), fps:frames.fps,
      effects:frames.effects?.slice(), phases:frames.phases?.slice(), durationsMs:frames.durationsMs?.slice() };
    context.framesReady = true;
    if (context.frames.length && typeof Image !== 'undefined' && typeof Image.prototype.decode === 'function') {
      context.framesReady = false;
      const images = [...new Set([...context.frames, ...(context.effects || [SAFE_BURST])])].map(src => { const image = new Image(); image.src = src; return image; });
      Promise.all(images.map(image => image.decode())).then(() => {
        if (!isCurrentPresentation(context)) return;
        context.framesReady = true;
        if (context.pendingOpen) beginOpening(context);
      }).catch(() => {
        if (isCurrentPresentation(context)) revealOnce(context);
      });
    }
    globalThis.__probe?.('rs', `tok=${tok} t=${Date.now()} kind=${cur.kind}`);
    const opening = `
      <p class="evt-sts-desc">${cur.isClass ? '职业补给：本职业专属卡牌' : '正在解锁封存物资。'}</p>
      ${safeOpeningHTML({ kind:cur.isClass ? 'class' : cur.kind, src:chestArtOf(cur), animated:context.frames.length > 1,
        effect:context.effects?.[0], effectFrames:!!context.effects })}`;
    UI.showOverlay(`[[icon:archive]] 开启${K.name}`, chestRewardFrameHTML({ overview:overviewHTML(), picker:opening, label:'开启宝箱' }), 'chest');
    UI.act('chestClosePicker', () => { if (isCurrentPresentation(context)) closePicker(); });
    context.surface = UI.el?.ovBody?.querySelector('[data-eps-search]');
    markChestTier(cur);
    // W6-01 事实更正（2026-09-27 R2）：battle.lifecycle.js:135 的三元式
    // sfx(win===true?'victory':…) 本就在战斗结束播放胜利音——评审 rg 审计按字面
    // 「sfx('victory')」检索漏掉了条件表达式。此处不再二次触发（会双响）。
    // 音频面 Accent 缺口的真实修正=W6-02 音量归位（kill/victory 曲线）+W5-01 视觉拍。
    SDT.Sound.sfx('chestShake');
    UI.refresh(G);
    // 体验线切片5（2026-09-28，评估#8）：搜索阶段点击立即揭晓——连开多箱的节奏死点消除；
    // searchSeq 代次保护防串台，揭晓后浮层重绘、监听随之失效
    UI.act('chestReveal', () => beginOpening(context, true));
    beginOpening(context);
  }
  // ---------- 全屏奖励栏：金币与卡牌分别展示、领取 ----------
  const rewardRarity = (card) => SDT.Cards.rarityOf?.(card) || card.rarity;

  function render(grantFailed = false) {
    const K = KINDS()[cur.kind];
    const taken = cur.taken || (cur.taken = new Set());
    const lost = cur.lost || (cur.lost = new Set());
    // 宠物蛋、阿猫附赠追加在基础候选之后，不参与原三选一的永久放弃。
    const choiceCount = cur.choiceCount ?? cur.cards.length;
    const choice = cur.claimMode === 'one';
    const isChoice = index => choice && index < choiceCount;
    const isPick = choice && cur.cards.some((_, i) => isChoice(i) && !taken.has(i) && !lost.has(i));
    const selected = Number.isInteger(cur.selected) ? cur.selected : null;
    const cardsHTML = cur.cards.map((card, i) => {
      const got = taken.has(i), dropped = lost.has(i);
      const fits = G.canReceiveCard ? G.canReceiveCard(card) : true;
      const action = rewardClaimHTML({ index:i, state:rewardCardState(taken, lost, i), choice:isChoice(i), fits, disabled:cur.leaveConfirm });
      return `<article class="reward-unit${selected === i && !got && !dropped ? ' is-pending-target' : ''}${got ? ' got' : dropped ? ' dropped' : ''}" data-reward-rarity="${escAttr(rewardRarity(card))}">
        <button type="button" class="reward-card" data-act="chestSelect" data-i="${i}" aria-label="放大查看${escAttr(card.name || '卡牌')}" title="放大查看">${SDT.Cards.cardHTML(card)}</button>${selected === i && !got && !dropped ? '<span class="reward-target-label">待领取</span>' : ''}${action}</article>`;
    }).join('');
    // 容量预检（2026-09-09 老板定向）：全部收下放不下时先提示清理背包——
    // 按实际顺序模拟同名分堆/占格；成功收到珍珠盒后，后续资源可使用其扩格。
    const rest = rewardProgress(cur.cards, taken, lost).pending;
    let cant = 0, canTake = 0;
    // 逐张判断当前候选；满格仍可能通过同名叠放领取，不能用格数直接禁用。
    const pickNoFit = isPick && !cur.cards.some((c, i) => isChoice(i) && !taken.has(i) && !lost.has(i) && (G.canReceiveCard ? G.canReceiveCard(c) : true));
    if (!isPick) {
      ({ canTake, cant } = previewCardRewards(rest, {
        ownedCards:G.ownedCards, usedSlots:G.usedSlots(), baseCap:SDT.Base.bagCap(), totalCap:G.bagCap(),
      }));
    }
    // 容量失败是当前状态；保留领取事实，并兼容旧存档中的两类容量提示。
    let notice = cur.notice;
    // 实际拒收优先于预测；同一奖励整理后容量状态真变，才允许重新校准。
    if (grantFailed) noticeFailure = { box:cur, notice };
    const actualFailure = noticeFailure?.box === cur && noticeFailure.notice === notice;
    const bulkCapacityNotice = /^(已入背包 \d+ 张)，\d+ 张放不下，整理背包后可重试$/.exec(notice || '');
    if (!actualFailure && bulkCapacityNotice && !isPick) {
      notice = `${bulkCapacityNotice[1]}${cant ? `，${cant} 张放不下，整理背包后可重试` : ''}`;
    } else if (!actualFailure && G.canReceiveCard && rest.some(c => notice === `「${c.name}」当前放不下，整理背包后可重试` && G.canReceiveCard(c))) {
      notice = '';
    }
    const noneFit = rest.length > 0 && !rest.some(card => !G.canReceiveCard || G.canReceiveCard(card));
    const informationalNotice = notice && !bulkCapacityNotice
      && !cur.cards.some(card => notice === `「${card.name}」当前放不下，整理背包后可重试`);
    const capacityNote = actualFailure || informationalNotice ? compactNotice(notice)
      : pickNoFit ? '当前候选都放不下，奖励保留。'
        : cant > 0 ? `预计可收 ${canTake} 张 · ${cant} 张待整理，奖励保留。` : compactNotice(notice);
    const finished = rest.length === 0;
    const leaveConfirmation = cur.leaveConfirm
      ? `<div class="reward-leave-confirm"><p>永久放弃剩余 ${rest.length} 张卡牌？离开后无法找回。</p><button type="button" class="reward-secondary" data-act="chestStay">继续领取</button><button type="button" class="reward-secondary danger" data-act="chestLeave">确认放弃</button></div>`
      : '';
    const ops = finished && !overviewMode ? rewardExitHTML('chestContinue', '继续探索') : '';
    const bulk = !finished && !isPick && !cur.leaveConfirm && rest.length > 1 && (!noneFit || (!overviewMode && cur.coins && !cur.coinsReceived))
      ? '<button type="button" class="reward-secondary" data-act="chestTake">全部收下</button>' : '';
    const outcome = cur.battleSummary?.cardOutcome;
    const details = outcome ? `<details class="loot-outcome"><summary>本战卡牌去向</summary>${[['进入消耗区',outcome.pocket],['直接消散',outcome.gone],['仍在背包',outcome.retained]].map(([label,names]) => `<p><b>${label}</b>：${names.length ? names.map(esc).join('、') : '无'}</p>`).join('')}</details>` : '';
    const coins = !overviewMode && cur.coins ? `<article class="reward-unit reward-coin-unit${cur.coinsReceived ? ' got' : ''}" aria-label="金币奖励"><div class="reward-coin-art" aria-hidden="true">[[icon:coin]]</div><div class="reward-coin-amount">×${cur.coins}</div>${cur.coinsReceived ? '<span class="reward-unit-state">已获得</span>' : `<button type="button" class="reward-claim" data-act="chestCoins"${cur.leaveConfirm ? ' disabled' : ''}>收下</button>`}</article>` : '';
    const finalNotice = [taken.size ? `${taken.size} 张${REWARD_RECEIVED}` : '', lost.size ? `${lost.size} 张已永久放弃` : '',
      !overviewMode && cur.coins ? cur.coinsReceived ? '金币已入账' : '金币待领取' : ''].filter(Boolean).join(' · ') || '已处理';
    const footer = `<span class="reward-capacity">[[icon:bag]] ${G.bagCapacityText?.() || `${G.usedSlots()}/${G.bagCap()} 格`}</span>${!finished ? `<button type="button" class="reward-bag${noneFit ? ' is-primary' : ''}" data-act="chestOpenBag">整理背包</button>` : ''}${!boxResolved(cur) && !cur.leaveConfirm ? '<button type="button" class="reward-bag" data-act="chestReturn">返回地图 · 保留奖励</button>' : ''}${!finished && !cur.leaveConfirm ? '<button type="button" class="reward-bag danger" data-act="chestSkip" data-cancel="false">放弃剩余卡牌</button>' : ''}${capacityNote && !finished && !cur.leaveConfirm ? `<span class="reward-capacity-note" role="status">${esc(capacityNote)}</span>` : ''}${finished ? `<span class="reward-final" role="status">${esc(finalNotice)}</span>` : ''}${leaveConfirmation}`;
    const extraCount = Math.max(0, cur.cards.length - (cur.choiceCount ?? cur.cards.length))
      + (cur.claimMode !== 'one' && cur.eggHit ? 1 : 0);
    const countLabel = `共 ${cur.cards.length} 张${extraCount ? ` · 含额外 ${extraCount} 张` : ''}${overviewMode && cur.cards.length > 4 ? ' · 横向查看全部' : ''}`;
    const picker = rewardSceneHTML({
      title:overviewMode ? rewardPickerTitle({ finished, isPick, choice, count:cur.cards.length, randomSingle:cur.kind === 'small' && !cur.isClass && K.cards === 1 && !K.pickFrom }) : cur.title || (cur.battleSummary ? '战斗胜利' : isPick ? '选择收获' : '搜刮完成'),
      source:`${cur.source || (cur.isClass ? '职业补给' : K.name)}${queue.length > 1 ? ` · ${idx}/${queue.length}` : ''}`,
      countLabel,
      rule:finished ? '' : isPick ? cur.cards.length > choiceCount
        ? '基础卡任选 1 张，其余基础卡永久放弃；附赠可另领'
        : '任选 1 张，其余卡牌永久放弃，无法找回' : cur.cards.length > 1 ? '奖励可分别领取' : '',
      cards:cardsHTML || (coins ? '' : '<p class="reward-empty">这里没有奖励</p>'),
      actions:`${ops}${bulk}`, coins, footer, warning:'', details, count:cur.cards.length + (coins ? 1 : 0),
      className:`reward-v14${overviewMode ? '' : ' reward-standalone-picker'}${taken.size || lost.size ? ' no-anim' : ''}`,
    });
    const body = overviewMode ? chestRewardFrameHTML({ overview:overviewHTML(), picker, label:cur.isClass ? '职业补给' : K.name }) : picker;
    const currentBody = UI.el?.ovBody;
    if (currentBody?.querySelector('.reward-v14') && !UI.el?.overlay?.hidden) {
      rememberRewardPosition();
      const previousScroll = currentBody.querySelector('.loot-scroll');
      const scrollTop = previousScroll?.scrollTop || 0, scrollLeft = previousScroll?.scrollLeft || 0;
      const hadFocus = currentBody.contains(document.activeElement);
      currentBody.innerHTML = SDT.Icons.rich(body);
      const scroll = currentBody.querySelector('.loot-scroll');
      if (scroll) { scroll.scrollTop = scrollTop; scroll.scrollLeft = scrollLeft; }
      if (hadFocus) currentBody.querySelector(`[data-act="chestSelect"][data-i="${selected ?? 0}"]`)?.focus({ preventScroll:true });
    } else {
      UI.showOverlay(`[[icon:archive]] ${cur.battleSummary ? '搜刮！战斗胜利 · ' : '收获 · '}${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, body, 'chest');
    }
    restoreRewardPosition();
    if (cur.leaveConfirm) UI.el.ovBody.querySelector('[data-act="chestStay"]')?.focus({ preventScroll:true });
    markChestTier(cur);
    const renderedBox = cur;
    const surface = UI.el?.ovBody?.querySelector('.reward-v14');
    const isLiveReward = () => isCurrentRewardRun() && cur === renderedBox && G.state === 'modal' &&
      !!surface && UI.el?.ovBody?.querySelector('.reward-v14') === surface && !UI.el?.overlay?.hidden
      && !UI.el?.overlay?.classList?.contains('closing');
    UI.act('chestClosePicker', () => { if (overviewMode && isLiveReward()) closePicker(); });
    UI.act('chestTake', () => { if (isLiveReward() && !isPick && !cur.leaveConfirm) takeAll(); });
    UI.act('chestReturn', () => { if (isLiveReward()) return returnToMap(); });
    UI.act('chestCoins', () => {
      if (!isLiveReward() || cur.leaveConfirm || cur.coinsReceived) return;
      collectCoinsOnce();
      UI.refresh(G);
      render();
    });
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
        footer:available ? rewardClaimHTML({ index:i, choice:isChoice(i), fits, disabled:cur.leaveConfirm, zoom:true }) : '' });
      rewardZoom = document.getElementById('cardZoom');
    });
    UI.act('chestTake1', d => {
      if (isLiveReward() && !cur.leaveConfirm && !isChoice(Number(d.i))) claimRewardAt(Number(d.i));
    });
    UI.act('chestMakeRoom', d => {
      if (!isLiveReward() || cur.leaveConfirm) return;
      const i = Number(d.i), box = cur;
      if (!box.cards[i] || box.taken.has(i) || box.lost.has(i)) return;
      rememberRewardPosition();
      closeRewardZoom();
      box.selected = i;
      const current = () => isCurrentRewardRun() && cur === box && G.state === 'modal'
        && !box.taken.has(i) && !box.lost.has(i);
      bagSlots.organizeReward({ card:box.cards[i], current,
        onReturn:() => { if (current()) render(true); },
        onClaim:() => { if (current()) claimRewardAt(i); },
        onFullBag:() => { if (current()) { render(true); bagSlots.showBackpack(); } },
      });
    });
    UI.act('chestSkip', () => {
      if (!isLiveReward()) return;
      if (cur.cards.some((_, i) => !cur.taken.has(i) && !cur.lost.has(i))) {
        cur.leaveConfirm = true;
        cur.notice = '';
        render();
      } else { if (!overviewMode) collectCoinsOnce(); next(); }
    });
    UI.act('chestStay', () => { if (isLiveReward()) { cur.leaveConfirm = false; render(); } });
    UI.act('chestLeave', () => {
      if (!isLiveReward() || !cur.leaveConfirm) return;
      cur.cards.forEach((_, i) => { if (!cur.taken.has(i)) cur.lost.add(i); });
      if (!overviewMode) collectCoinsOnce();
      UI.log('（未收取的卡牌已永久放弃，无法找回）', 'dim');
      cur.leaveConfirm = false;
      cur.notice = '剩余卡牌已永久放弃';
      persistReward();
      if (overviewMode) closePicker();
      else render();
    });
    UI.act('chestContinue', () => {
      if (!isLiveReward() || cur.cards.some((_, i) => !cur.taken.has(i) && !cur.lost.has(i))) return;
      collectCoinsOnce(); next();
    });
    UI.act('chestOpenBag', () => { if (isLiveReward()) { closeRewardZoom(); bagSlots.showBackpack(); } });
    UI.act('chestPick', d => {
      if (isLiveReward() && isPick && !cur.leaveConfirm && isChoice(Number(d.i))) claimRewardAt(Number(d.i));
    });
    UI.refresh(G);
  }

  // Both direct receipt and in-context organization use the same grant/choice boundary.
  function claimRewardAt(i) {
    if (!isCurrentRewardRun() || !cur || cur.leaveConfirm) return;
    const card = cur.cards[i];
    if (!card || cur.taken.has(i) || cur.lost.has(i)) return;
    const choiceCount = cur.choiceCount ?? cur.cards.length;
    const choice = cur.claimMode === 'one' && i < choiceCount;
    closeRewardZoom();
    cur.selected = i;
    if (!grantRewardCard(card)) {
      cur.notice = `「${card.name}」当前放不下，整理背包后可重试`;
      render(true); return;
    }
    cur.taken.add(i);
    if (choice) cur.cards.forEach((_, other) => { if (other < choiceCount && other !== i) cur.lost.add(other); });
    persistReward();
    cur.notice = `「${card.name}」已入本次远征背包`;
    if (overviewMode && cur.cards.every((_, j) => cur.taken.has(j) || cur.lost.has(j))) closePicker();
    else render();
    showRewardCardFeedback(UI.el?.ovBody, [card], { token:G });
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

  // 附赠先追加到同一快照，再与本体 taken 一起保存；不因当前容量丢弃或重掷。
  function grantRewardCard(card) {
    noticeFailure = null;
    const box = cur;
    return G.grantCard(card, { silent: true, deferAcquiredCard: extra => {
      box.choiceCount ??= box.cards.length;
      box.cards.push({ ...extra });
    } });
  }

  function takeAll() {
    const taken = cur.taken;
    const received = [];
    let grantFailed = false;
    cur.cards.forEach((card, i) => {
      if (taken.has(i) || cur.lost.has(i)) return;
      if (grantRewardCard(card)) { taken.add(i); received.push(card); }
      else grantFailed = true;
    });
    if (!overviewMode) collectCoinsOnce();
    if (!cur.cards.length && !cur.coins) UI.log('（空的——早被别的拾荒者搬空了……）', 'dim');
    const pending = cur.cards.filter((_, i) => !taken.has(i) && !cur.lost.has(i)).length;
    cur.notice = `已入背包 ${taken.size} 张${pending ? `，${pending} 张放不下，整理背包后可重试` : ''}`;
    persistReward();
    if (overviewMode && !pending) closePicker();
    else render(grantFailed);
    showRewardCardFeedback(UI.el?.ovBody, received, { token:G });
  }

  function collectCoinsOnce(box = cur) {
    if (!box || box.coinsReceived) return;
    if (box.coins) G.gainCoins(box.coins);
    box.coinsReceived = true;
    persistReward();
  }

  // 挂起/恢复（2026-09-09 留言 #13）：搜刮界面允许打开背包——
  // suspend 作废未播完的搜索演出计时器（防止中途 render 抢走背包浮层），
  // 背包关闭后 resume 重新渲染当前搜刮面板继续开箱
  const bagCapacityFingerprint = () => JSON.stringify([
    SDT.Base.bagCap(), G.bagCap(), G.usedSlots(), G.inventory?.length || 0,
    G.ownedCards.map(o => [o.card.id, o.card.name, o.card.type, !!o.safe, !!o.stored]),
  ]);
  function suspend() {
    rememberRewardPosition();
    closeRewardZoom();
    cancelPresentation();
    searchSeq++;
    const active = isCurrentRewardRun() && !!(cur || queue.length);
    if (!active || !cur) suspendedBag = null;
    else if (suspendedBag?.box !== cur) suspendedBag = { box:cur, fingerprint:bagCapacityFingerprint() };
    return active;
  }
  function resume() {
    cancelPresentation();
    if (isCurrentRewardRun() && cur) {
      if (suspendedBag?.box === cur && suspendedBag.fingerprint !== bagCapacityFingerprint()) noticeFailure = null;
      suspendedBag = null;
      renderCurrentStage();
    }
  }
  function serialize(game) {
    if (G !== game || !isCurrentRewardRun()) return null;
    return serializeChestReward(game, queue, idx, cur, saveContext, { screen:rewardScreen });
  }
  function restore(game, saved, done, opts = {}) {
    const value = restoreChestReward(game, saved);
    if (!value) return false;
    clearNoticeContext();
    closeRewardZoom();
    cancelPresentation(); searchSeq++;
    G = game; parked = false; queue = value.queue; idx = value.index; cur = value.current;
    overviewMode = !(cur.source || cur.title);
    rewardScreen = overviewMode ? value.screen : 'cards';
    beforeMapReturn = opts.beforeMapReturn || null;
    saveContext = value.context; onDone = done; G.state = 'modal';
    saveBinding = bindSave(game);
    renderCurrentStage(); persistReward(); return true;
  }
  const cancelOnModeChange = event => { if (event.detail !== 'chest') { cancelPresentation(); searchSeq++; } };
  if (typeof document !== 'undefined') document.addEventListener('sdt-overlay-mode', cancelOnModeChange);
  if (import.meta.hot) import.meta.hot.dispose(() => {
    cancelPresentation();
    if (typeof document !== 'undefined') document.removeEventListener('sdt-overlay-mode', cancelOnModeChange);
  });
  sdtDefine('Chests', { rollDrops, dropText, open, rollContents, configureFrameArt, isOpen: () => isCurrentRewardRun() && !!(cur || queue.length), suspend, resume, serialize, restore });

export { SDT };
