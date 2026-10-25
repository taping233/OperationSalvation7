import { initRewardInteraction } from '../ui/reward-interaction.js';
import { beginRoomSave } from '../ui/room-footer.js';
import { createRoomActions } from '../ui/room-actions.js';
import { sdtDefine } from '../core/sdt-facade.js';

import { Random } from '../core/random.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { previewCardRewards } from '../core/card-capacity.js';
import { esc, escAttr } from '../core/shared.js';
import { showRewardCardFeedback, showRewardCompletionReceipt } from '../ui/reward-card-feedback.js';
import { rewardPickerTitle } from '../ui/reward-picker-heading.js';
import { rewardCardState, rewardProgress } from '../ui/reward-state.js';
import { rewardCardUnitHTML, rewardSceneHTML, rewardExitHTML, rewardClaimHTML, patchRewardScene, restoreRewardActionFocus } from '../ui/reward-scene-view.js';
import { chestRewardOverviewHTML, chestRewardFrameHTML, patchChestRewardOverview } from '../ui/chest-reward-overview.js';
import { serializeChestReward, restoreChestReward } from './chest-reward-save.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { createChestFrameSets, SAFE_CLOSED } from './chest-opening-art.js';

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
  let beforeMapReturn = null, beforeComplete = null, returningToMap = false;
  let rewardMutation = false;
  let rewardZoom = null;
  let overviewPosition = null;
  let overviewRevision = 0;
  // Ephemeral presentation only: never serialized into reward/save data.
  const rewardPositions = new WeakMap();
  let rewardViewVersion = 0;
  function rememberRewardPosition() {
    const scroll = UI.el?.ovBody?.querySelector('.reward-v14 .loot-scroll');
    if (!cur || !scroll) return;
    const row = scroll.querySelector('.reward-objects');
    rewardPositions.set(cur, { top:scroll.scrollTop, left:scroll.scrollLeft, rowTop:row?.scrollTop || 0, rowLeft:row?.scrollLeft || 0 });
  }
  function restoreRewardPosition() {
    const position = cur && rewardPositions.get(cur);
    const scroll = UI.el?.ovBody?.querySelector('.reward-v14 .loot-scroll');
    if (!position || !scroll) return;
    scroll.scrollTop = position.top; scroll.scrollLeft = position.left;
    const row = scroll.querySelector('.reward-objects');
    if (row) { row.scrollTop = position.rowTop; row.scrollLeft = position.rowLeft; }
  }
  let noticeFailure = null, suspendedBag = null, returnNotice = '';
  const clearNoticeContext = () => { noticeFailure = null; suspendedBag = null; returnNotice = ''; };
  const closeRewardZoom = () => { rewardZoom?._closeCardZoom?.(true); rewardZoom = null; };
  const bindSave = game => ({ seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos, runToken:game.discoveredPairs, slotId:SDT.Base?.slot });
  const matchesRewardRun = (game, binding) => !!game && !!binding && binding.seed === game.seed &&
    binding.layerIdx === game.layerIdx && binding.trackPos === game.trackPos &&
    binding.runToken === game.discoveredPairs && binding.slotId === SDT.Base?.slot;
  const isCurrentRewardRun = () => !parked && matchesRewardRun(G, saveBinding);
  const persistReward = async () => {
    if (!isCurrentRewardRun() || !(saveContext?.onCell || saveContext?.battleSettlement)) return;
    const saved = serializeChestReward(G, queue, idx, cur, saveContext, { screen:rewardScreen });
    if (saved) (G.nodeChestRewards ||= {})[`${G.layerIdx},${G.trackPos}`] = saved;
    const game = G, binding = saveBinding;
    const persisted = !!saved && await saveRunCheckpoint(() => game.persistSave?.());
    if (game !== G || binding !== saveBinding || !matchesRewardRun(game, binding)) return false;
    returnNotice = persisted ? '' : '奖励进度尚未保存成功，请重试保存；暂勿刷新页面。';
    return persisted;
  };
  async function returnToMap() {
    if (!isCurrentRewardRun() || !cur || G.state !== 'modal' || returningToMap) return false;
    const binding = saveBinding, box = cur, game = G, body = UI.el?.ovBody;
    const surfaceNow = () => UI.el?.ovBody?.querySelector('.cqo-overview, .reward-v14');
    let surface = surfaceNow();
    const ownsReturn = () => G === game && binding === saveBinding && box === cur && matchesRewardRun(game, binding)
      && UI.el?.ovBody === body && !!surface && surfaceNow() === surface && !UI.el?.overlay?.hidden
      && !UI.el?.overlay?.classList?.contains('closing');
    // Settlement may redraw this page, but cannot reclaim a replacement page.
    const view = {
      isCurrent: () => !parked && ownsReturn(),
      resume: () => {
        if (!view.isCurrent()) return false;
        resume(); surface = surfaceNow(); return true;
      },
    };
    const keepReward = () => {
      if (!ownsReturn()) return false;
      parked = false; game.state = 'modal';
      returnNotice = '奖励尚未保存成功，请重试返回地图；暂勿刷新页面。';
      rewardScreen = 'cards'; render();
      return false;
    };
    returningToMap = true;
    const finishSave = beginRoomSave(surface);
    try {
      if (beforeMapReturn && !await beforeMapReturn(saveContext?.battleSettlement, view)) return false;
      if (!view.isCurrent()) return false;
      if (overviewMode) rewardScreen = 'overview';
      const saved = await saveRunCheckpoint(persistReward);
      if (!ownsReturn()) return false;
      if (!saved) return keepReward();
      parked = true; game.state = 'idle';
      const mapSaved = await saveRunCheckpoint(() => game.persistSave?.());
      if (!ownsReturn()) return false;
      if (!mapSaved) return keepReward();
      returnNotice = '';
      closeRewardZoom(); searchSeq++;
      UI.hideOverlay(); UI.refresh(G);
      return true;
    } finally { returningToMap = false; finishSave(); }
  }
  let searchSeq = 0;   // 奖励页代次：旧页揭晓音效不得跨组或跨页播放。

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
  const KINDS = () => SDT.MAP.chestKinds;
  const rndInt = (a, b) => a + Math.floor(Random.random('loot', 'reward') * (b - a + 1));

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
      if (Random.random('loot', 'reward') < eggRate) {
        const egg = (SDT.Cards.all() || []).find(x => x.id === 'pet-egg');
        if (egg && !seen.dup(egg)) {
          seen.add(egg); c.cards.push(egg); c.eggHit = true;
          eggGranted = true;
        }
      }
      // Failed writes keep the legacy in-memory progression; they never reroll
      // or revoke an already determined reward.
      const slot = SDT.Base.slot;
      Promise.resolve(SDT.Base.recordPetEggChestResult({ eggGranted })).then(result => {
        if (result?.persisted === false && slot && SDT.Base.slot === slot) {
          UI.log('[[icon:cross]] 伙伴蛋保底计数尚未保存；本次奖励已固定，请重试保存', 'warn');
        }
      });
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
          const card = pool[Math.floor(Random.random('loot', 'reward') * pool.length)];
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
      const cname = K.coinCards[Math.floor(Random.random('loot', 'reward') * K.coinCards.length)];
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
      let roll = Random.random('loot', 'reward') * total;
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
      const isClass = Random.random('loot', 'reward') < classChestChance();
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
    overviewPosition = null;
    clearNoticeContext();

    const K = Object.assign({ resourceOnly: false }, opts || {});
    G = game;
    parked = false;
    beforeMapReturn = K.beforeMapReturn || null;
    beforeComplete = K.beforeComplete || null;
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
    presentRewardBox(0);
  }

  const boxResolved = box => !!box && box.cards.every((_, i) => box.taken.has(i) || box.lost.has(i))
    && (!box.coins || box.coinsReceived);
  const allBoxesResolved = () => queue.length > 0 && queue.every(box => box.completed || boxResolved(box.reward));
  const cardsResolved = box => !!box && box.rewardStage !== 'chest' && box.rewardStage !== 'opening'
    && box.cards.every((_, i) => box.taken.has(i) || box.lost.has(i));
  const pendingBox = slot => !slot.completed && (!cardsResolved(slot.reward) || !!(slot.reward?.coins && !slot.reward.coinsReceived));
  function nextPendingBoxIndex() {
    const opened = queue.findIndex(slot => pendingBox(slot) && slot.reward && slot.reward.rewardStage !== 'chest');
    return opened >= 0 ? opened : queue.findIndex(pendingBox);
  }
  const compactNotice = notice => {
    const text = String(notice || '').replaceAll('本次远征背包', '背包').replaceAll('，整理背包后可重试', '');
    if (/^(已入背包 \d+ 张|「.+」已入背包)$/.test(text)) return '';
    if (/^(已入背包 \d+ 张，\d+ 张放不下|「.+」当前放不下)$/.test(text)) return '暂时无法领取';
    return text;
  };

  async function finishQueue() {
    if (rewardMutation) return false;
    // 普通节点先保存“已完成且没有待领奖”的稳定点，再释放领奖引用。
    // 战斗的额外奖励和 Base+Run 提交继续由原完成回调持有，不提前写普通存档。
    if (saveContext?.onCell && !saveContext.battleSettlement) {
      const game = G, binding = saveBinding;
      const key = `${game.layerIdx},${game.trackPos}`;
      const hadNode = Object.hasOwn(game.nodeChestRewards || {}, key);
      const previousNode = game.nodeChestRewards?.[key];
      rewardMutation = true;
      const persisted = await saveRunCheckpoint(() => {
        if (beforeComplete?.() === false) return false;
        parked = true;
        game.state = 'idle';
        if (game.nodeChestRewards) delete game.nodeChestRewards[key];
        return game.persistSave?.();
      });
      rewardMutation = false;
      if (G !== game || saveBinding !== binding || !matchesRewardRun(game, binding)) return false;
      if (!persisted) {
        parked = false; game.state = 'modal';
        if (hadNode) (game.nodeChestRewards ||= {})[key] = previousNode;
        returnNotice = '奖励进度尚未保存成功，请重试保存；暂勿刷新页面。';
        if (cur) renderCurrentStage(); else renderChestOffer();
        return false;
      }
    }
    clearNoticeContext();
    closeRewardZoom();

    if (G.nodeChestRewards) delete G.nodeChestRewards[`${G.layerIdx},${G.trackPos}`];
    searchSeq++;              // 作废旧页揭晓音效。
    UI.hideOverlay();
    G.state = 'idle';
    cur = null;
    queue = [];   // 清除活动领奖引用，再调用一次原续流。
    saveContext = null;
    saveBinding = null;
    beforeComplete = null;
    const cb = onDone;
    onDone = null;
    if (cb) cb();
    return true;
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
    if (!overviewMode || allBoxesResolved()) return finishQueue();
    return closePicker();
  }

  // Opening, resuming and advancing use one presentation path; grants stay below.
  function presentRewardBox(index) {
    if (!prepareBox(index)) return false;
    closeRewardZoom(); searchSeq++;
    if (noticeFailure?.box !== cur) clearNoticeContext();
    collectCoinsOnce(cur);
    rewardScreen = 'cards';
    cur.rewardStage = 'cards';
    const saving = persistReward(); render(); scheduleRevealSfx(); return saving;
  }

  function closePicker() {
    rememberRewardPosition(); closeRewardZoom(); searchSeq++;
    queue[idx - 1].completed = boxResolved(cur);
    cur.leaveConfirm = false;
    const pending = nextPendingBoxIndex();
    if (boxResolved(cur) && pending >= 0) return presentRewardBox(pending);
    rewardScreen = 'cards';
    const saving = persistReward(); render(); return saving;
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
    const complete = !queue.length || allBoxesResolved();
    return chestRewardOverviewHTML({
      title:queue.some(box => box.battleSummary) ? '战斗胜利' : '本次收获',
      source:'', complete,
      coins:queue.reduce((sum, slot) => {
        sum.total += slot.reward?.coins || 0;
        if (!slot.reward?.coinsReceived) sum.pending += slot.reward?.coins || 0;
        return sum;
      }, { total:0, pending:0 }),
      primaryAction:nextIndex < 0 ? null : { index:nextIndex, label:openLabel(queue[nextIndex]) },
      notice:returnNotice,
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
      footer:`<span data-card-receive-anchor="bag" aria-label="背包容量">[[icon:bag]] ${G.bagCapacityText?.() || `${G.usedSlots()}/${G.bagCap()} 格`}</span>${returnNotice ? '<button type="button" class="cqo-button" data-act="chestRetrySave">重试保存</button>' : ''}`,
    });
  }

  function bindOverview() {
    const surface = UI.el?.ovBody?.querySelector('.cqo-overview');
    const revision = overviewRevision;
    const active = () => revision === overviewRevision && !rewardMutation && isCurrentRewardRun() && rewardScreen === 'overview' && G.state === 'modal'
      && !!surface && UI.el?.ovBody?.querySelector('.cqo-overview') === surface && !UI.el?.overlay?.hidden;
    const act = createRoomActions(UI, active);
    const openBox = index => {
      if (!active() || !Number.isInteger(index) || !queue[index] || !pendingBox(queue[index]) || !prepareBox(index)) return;
      const trigger = surface.querySelector(`[data-act="chestOpen"][data-i="${index}"]`);
      overviewPosition = { top:surface.querySelector('.cqo-rewards')?.scrollTop || 0, index, action:trigger ? 'chestOpen' : 'chestNext' };
      if (noticeFailure?.box !== cur) clearNoticeContext();
      collectCoinsOnce(cur);
      rewardScreen = 'cards';
      cur.rewardStage = 'cards';
      const saving = persistReward(); render(); scheduleRevealSfx(); return saving;
    };
    UI.act('chestOpen', d => openBox(Number(d.i)));
    UI.act('chestNext', () => openBox(nextPendingBoxIndex()));
    act('chestOverviewCoins', () => {
      for (const slot of queue) {
        if (slot.reward?.coins && !slot.reward.coinsReceived) collectCoinsOnce(slot.reward);
        if (boxResolved(slot.reward)) slot.completed = true;
      }
      const saving = persistReward(); renderChestOffer(); return saving;
    });
    act('chestReturn', returnToMap);
    act('chestRetrySave', async () => { await persistReward(); if (active()) renderChestOffer(); });
    act('chestOverviewBag', () => { bagSlots.showBackpack(); });
    act('chestFinish', () => { if (!queue.length || allBoxesResolved()) return finishQueue(); });
  }

  function renderChestOffer() {

    searchSeq++;
    const revision = ++overviewRevision;
    const nextIndex = nextPendingBoxIndex();
    const initialFocus = nextIndex >= 0 ? `[data-act="chestOpen"][data-i="${nextIndex}"]`
      : allBoxesResolved() ? '[data-act="chestFinish"]' : '[data-act="chestOverviewCoins"]';
    const body = UI.el?.ovBody;
    const previous = body?.querySelector('.cqo-overview');
    const focused = previous?.contains(document.activeElement)
      ? /** @type {HTMLElement} */ (document.activeElement.closest('[data-act]')) : null;
    const focusedAction = focused?.dataset.act, focusedIndex = focused?.dataset.i;
    const html = chestRewardFrameHTML({ overview:overviewHTML() });
    const retained = !UI.el?.overlay?.hidden
      && !UI.el?.overlay?.matches('.closing, [data-ui-closing], [data-ui-motion-screen="close"]')
      && patchChestRewardOverview(body, SDT.Icons.rich(html));
    if (!retained) UI.showOverlay('[[icon:archive]] 奖励总览', html, 'chest', { initialFocus });
    markChestTier(cur);
    bindOverview();
    const surface = UI.el?.ovBody?.querySelector('.cqo-overview');
    // A local refresh keeps the live scroll position, rather than an older picker return snapshot.
    const position = retained ? null : overviewPosition;
    if (surface && retained && focused && (!focused.isConnected || focused.matches(':disabled'))) {
      requestAnimationFrame(() => {
        if (revision !== overviewRevision || UI.el?.ovBody?.querySelector('.cqo-overview') !== surface || rewardScreen !== 'overview') return;
        const same = [.../** @type {NodeListOf<HTMLElement>} */ (surface.querySelectorAll('[data-act]:not(:disabled)'))]
          .find(button => button.dataset.act === focusedAction && button.dataset.i === focusedIndex);
        (same || /** @type {HTMLElement} */ (surface.querySelector(initialFocus))
          || /** @type {HTMLElement} */ (surface.querySelector('[data-act="chestReturn"], [data-act="chestFinish"]')))?.focus({ preventScroll:true });
      });
    }
    if (surface && position) {
      const scroll = surface.querySelector('.cqo-rewards'); if (scroll) scroll.scrollTop = position.top;
      requestAnimationFrame(() => {
        if (revision !== overviewRevision || UI.el?.ovBody?.querySelector('.cqo-overview') !== surface || rewardScreen !== 'overview') return;
        const same = surface.querySelector(`[data-act="chestOpen"][data-i="${position.index}"]:not(:disabled)`);
        /** @type {HTMLElement} */ (same || surface.querySelector('[data-act="chestNext"], [data-act="chestFinish"]'))?.focus({preventScroll:true});
      });
    }
    UI.refresh(G);
  }

  function renderCurrentStage() {
    if (overviewMode && rewardScreen === 'overview') {
      const pending = nextPendingBoxIndex();
      if (pending >= 0) presentRewardBox(pending);
      else { rewardScreen = 'cards'; render(); }
    }
    else if (cur.rewardStage === 'opening' || cur.rewardStage === 'chest') { cur.rewardStage = 'cards'; render(); persistReward(); }
    else render();
  }

  const rewardRarity = (card) => SDT.Cards.rarityOf?.(card) || card.rarity;

  function render(grantFailed = false, focusIntent = null) {
    const K = KINDS()[cur.kind];
    const taken = cur.taken || (cur.taken = new Set());
    const lost = cur.lost || (cur.lost = new Set());
    // 宠物蛋、阿猫附赠追加在基础候选之后，不参与原三选一的永久放弃。
    const choiceCount = cur.choiceCount ?? cur.cards.length;
    const choice = cur.claimMode === 'one';
    const isChoice = index => choice && index < choiceCount;
    const isPick = choice && cur.cards.some((_, i) => isChoice(i) && !taken.has(i) && !lost.has(i));
    const selected = Number.isInteger(cur.selected) ? cur.selected : null;
    const progress = rewardProgress(cur.cards, taken, lost);
    const chosenCard = choice ? cur.cards.find((_, i) => isChoice(i) && taken.has(i)) : null;
    const bonusPending = choice ? cur.cards.filter((_, i) => !isChoice(i) && !taken.has(i) && !lost.has(i)).length : 0;
    const cardsHTML = cur.cards.map((card, i) => {
      const got = taken.has(i), dropped = lost.has(i);
      const fits = G.canReceiveCard ? G.canReceiveCard(card) : true;
      const category = isChoice(i) ? 'choice' : choice ? 'bonus' : 'loot';
      const action = rewardClaimHTML({ index:i, cardName:card.name, state:rewardCardState(taken, lost, i), choice:isChoice(i), fits, disabled:cur.leaveConfirm, claimMode:cur.claimMode, bonus:category === 'bonus' });
      const heading = choice && cur.cards.length > choiceCount && i === 0 ? `<header class="reward-group-heading reward-choice-heading" data-reward-group="choice"><strong>候选</strong></header>`
        : choice && i === choiceCount ? `<header class="reward-group-heading reward-bonus-heading" data-reward-group="bonus"><strong>附赠</strong><span>${bonusPending || '已领取'}</span></header>` : '';
      return heading + rewardCardUnitHTML({ card, face:SDT.Cards.cardHTML(card), index:i, readAction:'chestSelect', action,
        className:`${selected === i && !got && !dropped ? 'is-pending-target' : ''}${got ? ' got' : dropped ? ' dropped' : ''}`,
        rarity:rewardRarity(card), category, listItem:!choice });
    }).join('');
    // 容量预检（2026-09-09 老板定向）：全部收下放不下时先提示清理背包——
    // 按实际顺序模拟同名分堆/占格；成功收到珍珠盒后，后续资源可使用其扩格。
    const rest = progress.pending;
    let cant = 0;
    if (!isPick) {
      ({ cant } = previewCardRewards(rest, {
        ownedCards:G.ownedCards, usedSlots:G.usedSlots(), baseCap:SDT.Base.bagCap(), totalCap:G.bagCap(),
      }));
    }
    // 容量失败是当前状态；保留领取事实，并兼容旧存档中的两类容量提示。
    let notice = returnNotice || cur.notice;
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
    const capacityNote = actualFailure || informationalNotice ? compactNotice(notice) : '';
    const finished = rest.length === 0;
    const leaveConfirmation = cur.leaveConfirm
      ? `<div class="reward-leave-confirm"><p>永久放弃剩余 ${rest.length} 张卡牌？离开后无法找回。</p><button type="button" class="reward-secondary" data-act="chestStay">继续领取</button><button type="button" class="reward-secondary danger" data-act="chestLeave">确认放弃</button></div>`
      : '';
    const ops = cur.leaveConfirm ? '' : finished ? rewardExitHTML('chestContinue', '继续探索') : rewardExitHTML('chestReturn', '返回地图');
    const bulk = !finished && !isPick && !cur.leaveConfirm && rest.length > 1 && (!noneFit || (!overviewMode && cur.coins && !cur.coinsReceived))
      ? '<button type="button" class="reward-secondary" data-act="chestTake">全部收下</button>' : '';
    const coins = !overviewMode && cur.coins ? `<article class="reward-unit reward-coin-unit${cur.coinsReceived ? ' got' : ''}" aria-label="金币奖励"><div class="reward-coin-art" aria-hidden="true">[[icon:coin]]</div><div class="reward-coin-amount">×${cur.coins}</div>${cur.coinsReceived ? '<span class="reward-unit-state">已获得</span>' : `<button type="button" class="reward-claim" data-act="chestCoins"${cur.leaveConfirm ? ' disabled' : ''}>收下</button>`}</article>` : '';
    const footer = `<span class="reward-capacity">[[icon:bag]] ${G.bagCapacityText?.() || `${G.usedSlots()}/${G.bagCap()} 格`}</span>${returnNotice ? '<button type="button" class="reward-bag" data-act="chestRetrySave">重试保存</button>' : ''}${!finished ? `<button type="button" class="reward-bag${noneFit ? ' is-primary' : ''}" data-act="chestOpenBag">整理背包</button>` : ''}${!finished && !cur.leaveConfirm ? `<details class="reward-secondary-options"><summary>其他操作</summary><button type="button" class="reward-bag danger" data-act="chestSkip" data-cancel="false">放弃剩余卡牌</button></details>` : ''}${capacityNote && !finished && !cur.leaveConfirm ? `<span class="reward-capacity-note" role="status">${esc(capacityNote)}</span>` : ''}${leaveConfirmation}`;
    const extraCount = Math.max(0, cur.cards.length - (cur.choiceCount ?? cur.cards.length))
      + (cur.claimMode !== 'one' && cur.eggHit ? 1 : 0);
    const countLabel = [isPick && extraCount ? `附赠 ${extraCount} 张` : '', cur.coinsReceived && cur.coins ? `金币 +${cur.coins}` : ''].filter(Boolean).join(' · ');
    const picker = rewardSceneHTML({
      title:overviewMode ? rewardPickerTitle({ finished, isPick, choice, count:cur.cards.length, randomSingle:cur.kind === 'small' && !cur.isClass && K.cards === 1 && !K.pickFrom }) : cur.title || (cur.battleSummary ? '战斗胜利' : isPick ? '选择收获' : '搜刮完成'),
      source:`${cur.source || (cur.isClass ? '职业补给' : K.name)}${queue.length > 1 ? ` · ${idx}/${queue.length}` : ''}`,
      countLabel,
      claimMode:cur.claimMode,
      progress:{ total:cur.cards.length, pending:rest.length, received:progress.takenCount, choiceCount, choicePending:isPick, choiceName:chosenCard?.name || '', bonusPending },
      cards:cardsHTML || (coins ? '' : '<p class="reward-empty">这里没有奖励</p>'),
      actions:`${ops}${bulk}`, coins, footer, warning:returnNotice ? `<p class="reward-notice" role="status">${esc(returnNotice)}</p>` : '', count:cur.cards.length + (coins ? 1 : 0),
      className:`reward-v14${overviewMode ? '' : ' reward-standalone-picker'}${taken.size || lost.size ? ' no-anim' : ''}`,
    });
    const body = picker;
    const currentBody = UI.el?.ovBody;
    const active = currentBody?.contains(document.activeElement) ? document.activeElement.closest('[data-act]') : null;
    const focus = focusIntent || (active ? { action:/** @type {HTMLElement} */ (active).dataset.act, index:/** @type {HTMLElement} */ (active).dataset.i } : null);
    if (currentBody?.querySelector('.reward-v14') && !UI.el?.overlay?.hidden) {
      rememberRewardPosition();
      if (!patchRewardScene(currentBody, SDT.Icons.rich(body))) currentBody.innerHTML = SDT.Icons.rich(body);
    } else {
      UI.showOverlay(`[[icon:archive]] ${cur.battleSummary ? '搜刮！战斗胜利 · ' : '收获 · '}${cur.isClass ? '职业·' : ''}${K.name} · 第 ${idx} / ${queue.length}`, body, 'chest');
    }
    restoreRewardPosition();
    if (focusIntent || (focus && !active?.isConnected)) restoreRewardActionFocus(UI.el.ovBody, focus);
    else if (!focus && rewardPositions.has(cur) && Number.isInteger(cur.selected)) {
      /** @type {HTMLElement} */ (UI.el.ovBody.querySelector(`[data-act="chestSelect"][data-i="${cur.selected}"]`))?.focus({ preventScroll:true });
    }
    if (cur.leaveConfirm) /** @type {HTMLElement} */ (UI.el.ovBody.querySelector('[data-act="chestStay"]'))?.focus({ preventScroll:true });
    markChestTier(cur);
    const renderedBox = cur;
    const renderedVersion = ++rewardViewVersion;
    const surface = UI.el?.ovBody?.querySelector('.reward-v14');
    initRewardInteraction(surface);
    const isLiveReward = () => !rewardMutation && renderedVersion === rewardViewVersion && isCurrentRewardRun() && cur === renderedBox && G.state === 'modal' &&
      !!surface && UI.el?.ovBody?.querySelector('.reward-v14') === surface && !UI.el?.overlay?.hidden
      && !UI.el?.overlay?.classList?.contains('closing');
    const act = createRoomActions(UI, isLiveReward);
    UI.act('chestClosePicker', () => { if (overviewMode && isLiveReward()) return closePicker(); });
    act('chestTake', () => { if (!isPick && !cur.leaveConfirm) return takeAll(); });
    act('chestReturn', returnToMap);
    act('chestRetrySave', async () => { await persistReward(); if (isLiveReward()) render(); });
    act('chestCoins', () => {
      if (cur.leaveConfirm || cur.coinsReceived) return;
      const saving = collectCoinsOnce();
      UI.refresh(G);
      render();
      return saving;
    });
    act('chestSelect', (d) => {
      const i = Number(d.i);
      if (!Number.isInteger(i) || !cur.cards[i]) return;
      cur.selected = i;
      cur.leaveConfirm = false;
      cur.notice = '';
      const card = cur.cards[i];
      const available = !cur.taken.has(i) && !cur.lost.has(i);
      const fits = G.canReceiveCard ? G.canReceiveCard(card) : true;
      const source = /** @type {HTMLElement} */ (UI.el.ovBody.querySelector(`[data-act="chestSelect"][data-i="${i}"]`));
      UI.showCardZoom?.(card, { from:source, returnFocus:source, hideNote:true, presentation:'expedition',
        footer:available ? rewardClaimHTML({ index:i, cardName:card.name, choice:isChoice(i), fits, disabled:cur.leaveConfirm, zoom:true, claimMode:cur.claimMode, bonus:choice && !isChoice(i) }) : '' });
      rewardZoom = document.getElementById('cardZoom');
    });
    act('chestTake1', d => {
      if (!cur.leaveConfirm && !isChoice(Number(d.i))) return claimRewardAt(Number(d.i));
    });
    act('chestMakeRoom', d => {
      if (cur.leaveConfirm) return;
      const i = Number(d.i), box = cur;
      if (!box.cards[i] || box.taken.has(i) || box.lost.has(i)) return;
      rememberRewardPosition();
      closeRewardZoom();
      box.selected = i;
      bagSlots.showBackpack();
    });
    act('chestSkip', () => {
      if (cur.cards.some((_, i) => !cur.taken.has(i) && !cur.lost.has(i))) {
        cur.leaveConfirm = true;
        cur.notice = '';
        render();
      } else { if (!overviewMode) collectCoinsOnce(); return next(); }
    });
    act('chestStay', () => { cur.leaveConfirm = false; render(); });
    act('chestLeave', () => {
      if (!cur.leaveConfirm) return;
      cur.cards.forEach((_, i) => { if (!cur.taken.has(i)) cur.lost.add(i); });
      if (!overviewMode) collectCoinsOnce();
      UI.log('（未收取的卡牌已永久放弃，无法找回）', 'dim');
      cur.leaveConfirm = false;
      cur.notice = '剩余卡牌已永久放弃';
      const saving = persistReward();
      if (overviewMode) return closePicker();
      render(); return saving;
    });
    act('chestContinue', () => {
      if (cur.cards.some((_, i) => !cur.taken.has(i) && !cur.lost.has(i))) return;
      collectCoinsOnce(); return next();
    });
    act('chestOpenBag', () => { closeRewardZoom(); bagSlots.showBackpack(); });
    act('chestPick', d => {
      if (isPick && !cur.leaveConfirm && isChoice(Number(d.i))) return claimRewardAt(Number(d.i));
    });
    UI.refresh(G);
  }

  // Both direct receipt and in-context organization use the same grant/choice boundary.
  async function claimRewardAt(i) {
    if (rewardMutation || !isCurrentRewardRun() || !cur || cur.leaveConfirm) return;
    const card = cur.cards[i];
    if (!card || cur.taken.has(i) || cur.lost.has(i)) return;
    const choiceCount = cur.choiceCount ?? cur.cards.length;
    const choice = cur.claimMode === 'one' && i < choiceCount;
    closeRewardZoom();
    cur.selected = i;
    let granted;
    rewardMutation = true;
    try { granted = grantRewardCard(card); }
    finally { rewardMutation = false; }
    if (!granted) {
      cur.notice = `「${card.name}」当前放不下，整理背包后可重试`;
      render(true, { action:choice ? 'chestPick' : 'chestTake1', index:String(i) }); return;
    }
    cur.taken.add(i);
    if (choice) cur.cards.forEach((_, other) => { if (other < choiceCount && other !== i) cur.lost.add(other); });
    const box = cur, game = G, binding = saveBinding;
    rewardMutation = true;
    let persisted;
    try { persisted = await persistReward(); } finally { rewardMutation = false; }
    if (cur !== box || G !== game || saveBinding !== binding || !isCurrentRewardRun()) return;
    cur.notice = `「${card.name}」已入本次远征背包`;
    if (persisted !== false && !saveContext?.battleSettlement && overviewMode && queue.length === 1 && cur.kind === 'small' && cur.cards.length === 1 && cur.claimMode !== 'one' && allBoxesResolved()) {
      if (await finishQueue()) showRewardCompletionReceipt([card]);
      return;
    }
    if (overviewMode && cur.cards.every((_, j) => cur.taken.has(j) || cur.lost.has(j))) await closePicker();
    else render(false, { action:choice ? 'chestPick' : 'chestTake1', index:String(i) });
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
    rewardMutation = true;
    try {
      cur.cards.forEach((card, i) => {
        if (taken.has(i) || cur.lost.has(i)) return;
        if (grantRewardCard(card)) { taken.add(i); received.push(card); }
        else grantFailed = true;
      });
    } finally { rewardMutation = false; }
    if (!overviewMode) collectCoinsOnce();
    if (!cur.cards.length && !cur.coins) UI.log('（空的——早被别的拾荒者搬空了……）', 'dim');
    const pending = cur.cards.filter((_, i) => !taken.has(i) && !cur.lost.has(i)).length;
    cur.notice = `已入背包 ${taken.size} 张${pending ? `，${pending} 张放不下，整理背包后可重试` : ''}`;
    const saving = persistReward();
    const closing = overviewMode && !pending ? closePicker() : null;
    if (!closing) render(grantFailed);
    showRewardCardFeedback(UI.el?.ovBody, received, { token:G });
    return closing || saving;
  }

  function collectCoinsOnce(box = cur) {
    if (!box || box.coinsReceived) return;
    box.coinsReceived = true;
    if (box.coins) G.gainCoins(box.coins);
    return persistReward();
  }

  // 挂起/恢复（2026-09-09 留言 #13）：搜刮界面允许打开背包——
  // suspend 作废旧页揭晓音效，恢复时只重绘已确定的奖励。
  // 背包关闭后 resume 重新渲染当前搜刮面板继续领取。
  const bagCapacityFingerprint = () => JSON.stringify([
    SDT.Base.bagCap(), G.bagCap(), G.usedSlots(), G.inventory?.length || 0,
    G.ownedCards.map(o => [o.card.id, o.card.name, o.card.type, !!o.safe, !!o.stored]),
  ]);
  function suspend() {
    rememberRewardPosition();
    closeRewardZoom();

    searchSeq++;
    const active = isCurrentRewardRun() && !!(cur || queue.length);
    if (!active || !cur) suspendedBag = null;
    else if (suspendedBag?.box !== cur) suspendedBag = { box:cur, fingerprint:bagCapacityFingerprint() };
    return active;
  }
  function resume() {

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
    searchSeq++;
    G = game; parked = false; queue = value.queue; idx = value.index; cur = value.current;
    overviewMode = !(cur.source || cur.title);
    rewardScreen = value.screen === 'overview' ? 'overview' : 'cards';
    beforeMapReturn = opts.beforeMapReturn || null;
    beforeComplete = opts.beforeComplete || null;
    saveContext = value.context; onDone = done; G.state = 'modal';
    saveBinding = bindSave(game);
    if (overviewMode) collectCoinsOnce(cur);
    persistReward(); renderCurrentStage(); return true;
  }
  const cancelOnModeChange = event => { if (event.detail !== 'chest') { searchSeq++; } };
  if (typeof document !== 'undefined') document.addEventListener('sdt-overlay-mode', cancelOnModeChange);
  if (import.meta.hot) import.meta.hot.dispose(() => {

    if (typeof document !== 'undefined') document.removeEventListener('sdt-overlay-mode', cancelOnModeChange);
  });
  export const Chests = sdtDefine('Chests', { rollDrops, dropText, open, rollContents, configureFrameArt, isOpen: () => isCurrentRewardRun() && !!(cur || queue.length), suspend, resume, serialize, restore });

export { SDT };
