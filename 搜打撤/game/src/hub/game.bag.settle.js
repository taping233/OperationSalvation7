/* 由 game.bag.js 拆出（2026-09-22 六文件重构批4）：战后结算（battle.js 回调）——
 * bindBagMixins 装配（onBattleEnd：消耗口袋回充 / 掉宝箱续流 / 撤退拾回）。
 * 逐字搬迁；对壳本体的调用经 game.bag.bridge.js 的 bagSlots（禁 import 壳）。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { doDeath, game, getActiveSlot, prepareRunSnapshot, saveGame } from '../run/game.session.js';
import { RunStorage } from './game.storage.js';
import { recoverSlotIfPending, readSettlementReceipt, commitBaseAndRun } from './recovery.commands.js';
import { Random } from '../core/random.js';
import { on as busOn } from '../core/event-bus.js';
import { showRunTransition } from '../run/game.run.js';
import { bagSlots } from './game.bag.bridge.js';
  // ---------- 战后结算（battle.js 回调） ----------
  // win = true 胜利 / false 战败 / null 撤退。
  // 小怪战：使用过的卡进消耗口袋；BOSS 战：卡牌完好保留；
  // 注能消耗的卡（consumedUids）：无论战斗类型都进消耗口袋（可在火堆复原）。
  // 胜利 100% 掉宝箱（按所在环层 / BOSS 固定 BOSS宝箱），开完宝箱再续流。
  // ESM：循环导入下本模块体可能先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
  function bindBagMixins() {
  // Esc/遮罩关背包的唯一收口（迭代评审 09-20 C-P1）：ui.js 的 Esc 分支回调 bagSlots.closeBackpack，
  // 复位 game.state——此前直接 hideOverlay 会把状态卡死在 modal、地图/路线全部无响应。
  // 晚绑定注册避免 ui→bag 静态成环（bag.js:2 的 UI 取自 window.SDT 门面）
  UI._bagCloseHook = bagSlots.closeBackpack;
  const settlements = new WeakMap();
  let settlementRequestSeq = 0;
  const promptBattleLootResume = () => {
    game.state = 'modal';
    UI.showOverlay('战利品恢复未完成', '<div class="ov-btns"><button class="ov-btn ok" data-act="battleLootResume">重试恢复战利品</button></div>', 'discover');
    UI.act('battleLootResume', () => game.resumeBattleLoot());
    return false;
  };
  const openStagedChests = (pending, settlement, opts) => {
    let identityWarningShown = false;
    const isCurrent = () => {
      if (getActiveSlot() !== pending.slotId || game.pendingBattleLoot !== pending) return false;
      const identity = RunStorage.readIdentity(pending.slotId);
      if (!identity.ok) {
        if (!identityWarningShown) { identityWarningShown = true; promptBattleLootResume(); }
        return false;
      }
      identityWarningShown = false;
      return identity.value.runId === pending.runId;
    };
    if (!isCurrent()) return false;
    settlement.phase = 'chests';
    const finish = () => {
      if (!isCurrent()) return false;
      settlement.phase = 'saving';
      game.pendingBattleSettlement = pending.finalRequestId;
      return onBattleEnd(opts, [], true, []);
    };
    if (!pending.chests?.queue?.length || pending.chests.index >= pending.chests.queue.length) {
      // A stage commit can complete in the same onBattleEnd promise. Resume the
      // final commit after that promise clears, including a reload after the last chest.
      setTimeout(finish, 0);
      return true;
    }
    const opened = SDT.Chests.openPrepared(game, pending.chests, finish,
      { isCurrent, persist: () => saveGame() === true });
    return opened === false ? promptBattleLootResume() : opened;
  };
  const onBattleEnd = async function (opts, playedUids, win, consumedUids) {
    if (game.nestActive) return;   // 龙巢战斗结算由 game.nest 的总线订阅接管（一图战后流程不适用）
    if (win === false) { doDeath(); return; }
    // battle.engine 为每次开战创建独立 opts；同一场结束通知和失败重试共用这份记录。
    let settlement = settlements.get(opts);
    if (!settlement) {
      const slotId = getActiveSlot();
      const identity = slotId ? RunStorage.readIdentity(slotId) : null;
      const requestNonce = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${(++settlementRequestSeq).toString(36)}`;
      settlement = { phase: 'new', promise: null, slotId, initialIdentity: identity, identityChecked: false, runId: identity?.ok ? identity.value.runId : null,
        runRevision: identity?.ok ? identity.value.revision : null,
        rewardsApplied: false, runSaved: false, baseSaved: false, requestId: `battle:${identity?.ok ? identity.value.runId : 'memory'}:${requestNonce}` };
      settlements.set(opts, settlement);
    }
    const retry = error => {
      if (error) console.error('[battle:settle] 战后结算未完成', error);
      UI.log('[[icon:cross]] 战后结算未保存，请重试；本场奖励不会重新发放', 'warn');
      game.state = 'modal';
      UI.showOverlay('战后结算未完成', '<div class="ov-btns"><button class="ov-btn ok" data-act="battleSettleRetry">重试保存战后奖励</button></div>', 'discover');
      UI.act('battleSettleRetry', () => { onBattleEnd(opts, playedUids, win, consumedUids); });
      return false;
    };
    const sameRun = () => {
      if (getActiveSlot() !== settlement.slotId) {
        if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
        return false;
      }
      if (!settlement.slotId) return true;
      const identity = settlement.identityChecked ? RunStorage.readIdentity(settlement.slotId) : settlement.initialIdentity;
      settlement.identityChecked = true;
      if (!identity?.ok) return identity?.code === 'RECOVERY_REQUIRED' && !!settlement.runId ? true : null;
      if (!settlement.runId) {
        settlement.runId = identity.value.runId;
        settlement.runRevision = identity.value.revision;
        return true;
      }
      const same = identity.value.runId === settlement.runId;
      if (!same && game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
      return same;
    };
    const ensureSameRun = () => {
      const state = sameRun();
      return state === null ? retry(new Error('无法读取当前对局身份，请重试结算')) : state;
    };
    if (settlement.phase === 'done' || settlement.phase === 'chests') return settlement.promise || undefined;
    if (win === true) game.pendingBattleSettlement = settlement.requestId;
    if (!ensureSameRun()) return false;
    if (settlement.promise) return settlement.promise;
    const run = async () => {
    if (!ensureSameRun()) return false;
    if (settlement.phase === 'new') {
    UI.hideOverlay();
    // Item 16（2026-09-16 老板定版）：局内满足条件的牌 100% 进入消耗口袋（招式和装备）——
    // 「1/3 保留」改到离开对局（撤离结算）时统一结算，见 game.run.altar doExtract。
    // 衍生卡（如 闪金之锤）不能进消耗口袋（2026-09-15 留言）；职业卡与初始攻击仍直接消散。
    const toPocket = (uids, why) => {
      const moved = [];
      let gone = 0;
      uids.forEach(uid => {
        const i = game.ownedCards.findIndex(o => o.uid === uid);
        if (i < 0) return;   // 战斗内临时卡（初始攻击/发现/随机卡）战后消散，自动跳过
        const card = game.ownedCards[i].card;
        game.ownedCards.splice(i, 1);
        if (card.rarity === '职业' || SDT.Base.isSha(card)) { gone++; return; }
        if (card.rarity === '衍生') { gone++; return; }
        moved.push(card);
      });
      moved.forEach(card => bagSlots.pocketAdd(card));
      if ((moved.length || gone) && why) {
        UI.log(`[[icon:archive]] ${why}：<b>${moved.length}</b> 张卡牌进入消耗口袋` +
          (gone ? `，<b>${gone}</b> 张消散了（本局无法再用）` : '（本局无法再用）') +
          '，撤离结算时只有 1/3 能带回基地', 'sys');
      }
      return moved.length;
    };
    // Item 16 定版：所有战斗（含 BOSS）的消耗牌都进消耗口袋，撤离点统一 1/3 结算
    if (playedUids && playedUids.length) {
      toPocket(playedUids, '使用过的卡牌');
    }
    if (consumedUids && consumedUids.length) {
      toPocket(consumedUids, '注能消耗的卡牌');
    }
    settlement.phase = 'pocket';
    }
    // 「卡牌是消耗品」一次性教学（2026-09-19 关卡审查）：
    // 打出的卡不回背包、初始攻击/职业卡直接消散——这条核心规则此前只有战后台志提到过，
    // 新手首层打光 5 张初始攻击就会陷入无攻击牌死局。首胜结算后弹一次说明（按档位只弹一次）。
    // 2026-09-19 留言 #17：重做成大版图解页——卡面实物 + 箭头流向 + 图标分栏，不再挤小字
    const teachAmmoOnce = () => {
      const B = SDT.Base;
      if (!B || !B.data || B.data.ammoTaught) return;
      B.data.ammoTaught = true;
      if (getActiveSlot()) B.save();
      game.state = 'modal';
      const shaCard = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
      UI.showOverlay('[[icon:cards]] 卡牌是消耗品', `
        <div class="ammo-teach">
          <section class="at-col">
            <div class="at-flow">
              <span class="at-card">${SDT.Cards.cardHTML(shaCard, 'sm')}</span>
              <span class="at-arrow">➜</span>
              <span class="at-node"><span class="at-ico">[[icon:pocket]]</span><b>消耗口袋</b></span>
            </div>
            <p class="at-txt">普通卡打出后<b>不会回到背包</b>，先进入消耗口袋——可在火堆/修鞋铺复原；撤离结算只有 <b class="gold">1/3</b> 能带回基地。</p>
          </section>
          <section class="at-col">
            <div class="at-flow">
              <span class="at-card">${SDT.Cards.cardHTML(shaCard, 'sm')}</span>
              <span class="at-arrow">➜</span>
              <span class="at-node gone"><span class="at-ico">[[icon:skull]]</span><b>直接消散</b></span>
            </div>
            <p class="at-txt">【初始攻击】与职业卡打出后<b>直接消散</b>——补给站的初始攻击 1 币 1 张，路过记得补弹。</p>
          </section>
          <section class="at-col">
            <div class="at-flow">
              <span class="at-node"><span class="at-ico">[[icon:archive]]</span><b>多开箱</b></span>
              <span class="at-dot">·</span>
              <span class="at-node"><span class="at-ico">[[icon:bag]]</span><b>常逛商店</b></span>
            </div>
            <p class="at-txt">弹药有限——多开宝箱、常逛商店补牌。祝顺利撤离。</p>
          </section>
        </div>
        <div class="ov-btns"><button class="ov-btn ok" data-act="ammoTeachOk">[[icon:check]] 知道了</button></div>`, 'discover');
      UI.act('ammoTeachOk', () => {
        UI.hideOverlay();
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
      });
      UI.refresh(game);
    };
    // 开完宝箱后的续流：普通战/首脑战（第四层 boss 格发起）都回待机
    const settle = async (stageOnly = false) => {
      if (!ensureSameRun()) return false;
      game.state = 'modal'; // block movement and ordinary saves until the pair receipt is durable
      const pendingLoot = game.pendingBattleLoot;
      if (!stageOnly && win === true && settlement.slotId && pendingLoot?.stageCommitted) {
        const recovered = await recoverSlotIfPending(settlement.slotId);
        if (!recovered.ok) return retry(new Error(recovered.message));
        if (!ensureSameRun()) return false;
        const identity = RunStorage.readIdentity(settlement.slotId);
        if (!identity.ok) return retry(new Error(identity.message || '无法读取当前对局身份'));
        if (identity.value.runId !== pendingLoot.runId) {
          if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
          return false;
        }
        const base = SDT.Base._readForCommit(settlement.slotId);
        if (!base) return retry(new Error('无法读取基地存档'));
        const context = settlement.context || (settlement.context = {
          slotId: settlement.slotId, requestId: pendingLoot.finalRequestId,
          expectedBaseRevision: base._m01.revision, expectedRunRevision: identity.value.revision,
        });
        const payload = { battleRunId: pendingLoot.runId, stageRequestId: pendingLoot.stageRequestId };
        const receipt = await readSettlementReceipt(context, { command: 'battle.settle', payload, runId: pendingLoot.runId });
        if (!receipt.ok) return retry(new Error(receipt.message));
        if (!ensureSameRun()) return false;
        if (!receipt.value) {
          if (!settlement.rewardsApplied) {
            for (const card of pendingLoot.legends || []) game.grantCard(card);
            settlement.rewardsApplied = true;
          }
          const elapsed = Math.max(0, +game.elapsed || 0);
          const elapsedSynced = Math.max(0, +game.elapsedSynced || 0);
          game.pendingBattleLoot = null;
          const preparedRun = prepareRunSnapshot();
          game.pendingBattleLoot = pendingLoot;
          if (!preparedRun.ok) return retry(new Error(preparedRun.message || '无法构造战后快照'));
          const latestIdentity = RunStorage.readIdentity(settlement.slotId);
          const latestBase = SDT.Base._readForCommit(settlement.slotId);
          if (!latestIdentity.ok || !latestBase) return retry(new Error('结算期间存档无法读取，请重试'));
          if (latestIdentity.value.runId !== pendingLoot.runId) {
            if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
            return false;
          }
          context.expectedBaseRevision = latestBase._m01.revision;
          context.expectedRunRevision = latestIdentity.value.revision;
          const afterBase = JSON.parse(JSON.stringify(latestBase));
          afterBase.stats ||= {};
          afterBase.stats.playSeconds = Math.max(0, +afterBase.stats.playSeconds || 0) + Math.max(0, elapsed - elapsedSynced);
          const committed = await commitBaseAndRun(context, {
            command: 'battle.settle', runId: pendingLoot.runId, payload,
            afterBase, afterRun: preparedRun.value,
            output: { battleRunId: pendingLoot.runId, elapsedSynced: elapsed },
          });
          if (!committed.ok) return retry(new Error(committed.message));
          if (!ensureSameRun()) return false;
          game.elapsedSynced = elapsed;
        } else {
          const persistedElapsed = Number(receipt.value.output?.elapsedSynced);
          if (Number.isFinite(persistedElapsed)) game.elapsedSynced = persistedElapsed;
        }
        game.pendingBattleLoot = null;
        settlement.phase = 'done';
        if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
        game.state = 'idle';
        UI.refresh(game);
        teachAmmoOnce();
        return true;
      }
      // 战后保底传说（2026-09-09 玩法定版）：
      //   ① 首脑战胜利：额外 1 张传说卡；
      //   ② 击败巨兽「荒渊」（第 3/4 层精英）：30% 概率额外 1 张传说卡。
      // 都在整理背包之后结算（先让玩家清背包空间再领取）。
      const slewDragon = !opts.isBoss && (opts.foeNames || []).some(n => String(n).includes('巨兽'));
      // 宠物蛋保底新档（2026-09-19 老板拍板）：每打赢一场战斗，蛋的爆率永久 +0.2%
      //（叠加在 0.7% 基础 + 每空开箱 +3% 之上；计数存基地档位跨局累计）
      if (stageOnly && win === true) {
        game.visited = game.visited || {};
        game.visited[game.layerIdx + ',' + game.trackPos] = 1;
      }
      if (!stageOnly && !settlement.rewardsApplied && win === true) {
        game.visited = game.visited || {};
        game.visited[game.layerIdx + ',' + game.trackPos] = 1;
      }
      let legends = 0;
      if (!stageOnly && !settlement.rewardsApplied && opts.isBoss && win === true) {
        legends = 1;
      }
      if (!stageOnly && !settlement.rewardsApplied && slewDragon && win === true && Random.random('loot') < 0.3) legends += 1;
      if (legends > 0) UI.log('[[icon:trophy]] 首脑宝库开启：额外奖励 <b>1 张传说卡</b>！', 'loot');
      for (let i = 0; i < legends; i++) {
        const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
        const card = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
        if (card) game.grantCard(card);
      }
      if (!stageOnly) settlement.rewardsApplied = true;
      settlement.phase = 'saving';
      if (!settlement.baseSaved && win === true && settlement.slotId && SDT.Base && SDT.Base.data) {
        // A pending pair is completed before reading or writing any newer snapshot. Its receipt
        // lets same-page retries finish without applying the battle reward a second time.
        const recovered = await recoverSlotIfPending(settlement.slotId);
        if (!recovered.ok) return retry(new Error(recovered.message));
        if (!ensureSameRun()) return false;
        const base = SDT.Base._readForCommit(settlement.slotId);
        const runIdentity = RunStorage.readIdentity(settlement.slotId);
        if (!base) return retry(new Error('无法读取基地存档，请重试结算'));
        if (!runIdentity.ok) return retry(new Error(runIdentity.message || '无法读取当前对局身份，请重试结算'));
        if (runIdentity.value.runId !== settlement.runId) {
          if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
          return false;
        }
        const context = settlement.context || (settlement.context = {
          slotId: settlement.slotId, requestId: settlement.requestId,
          expectedBaseRevision: base._m01.revision,
          expectedRunRevision: runIdentity.value.revision,
        });
        const command = stageOnly ? 'battle.stage' : 'battle.settle';
        const payload = { battleRunId: settlement.runId, win: true };
        const receipt = await readSettlementReceipt(context, { command, payload, runId: settlement.runId });
        if (!receipt.ok) return retry(new Error(receipt.message));
        if (!ensureSameRun()) return false;
        if (receipt.value) {
          settlement.levelsGained = Number(receipt.value.output?.levelsGained) || 0;
          const persistedElapsed = Number(receipt.value.output?.elapsedSynced);
          if (Number.isFinite(persistedElapsed)) game.elapsedSynced = persistedElapsed;
        }
        if (!receipt.value) {
          if (runIdentity.value.revision !== settlement.runRevision) return retry(new Error('对局已在其他页面更新，请重新载入后继续'));
          const preparedRun = prepareRunSnapshot();
          if (!preparedRun.ok) return retry(new Error(preparedRun.message || '无法构造对局结算快照'));
          const savedIdentity = RunStorage.readIdentity(settlement.slotId);
          const latestBase = SDT.Base._readForCommit(settlement.slotId);
          if (!savedIdentity.ok) return retry(new Error(savedIdentity.message || '无法读取当前对局身份，请重试结算'));
          if (savedIdentity.value.runId !== settlement.runId) {
            if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
            return false;
          }
          if (savedIdentity.value.revision !== settlement.runRevision || !latestBase) return retry(new Error('对局已在其他页面更新，请重新载入后继续'));
          context.expectedBaseRevision = latestBase._m01.revision;
          context.expectedRunRevision = savedIdentity.value.revision;
          const afterBase = JSON.parse(JSON.stringify(latestBase));
          afterBase.eggBattles = (Number(afterBase.eggBattles) || 0) + 1;
          if (settlement.eggPity === undefined) settlement.eggPity = Number(SDT.Base.data.eggPity) || 0;
          afterBase.eggPity = settlement.eggPity;
          settlement.levelsGained = SDT.Meta.applyBattleKillsToBase(afterBase, settlement.foeNames || ['敌人'], !!opts.isBoss, game.myClass, SDT.Meta.xpMultiplier());
          afterBase.stats ||= {};
          const elapsed = Math.max(0, +game.elapsed || 0);
          const elapsedSynced = Math.max(0, +game.elapsedSynced || 0);
          afterBase.stats.playSeconds = Math.max(0, +afterBase.stats.playSeconds || 0) + Math.max(0, elapsed - elapsedSynced);
          const committed = await commitBaseAndRun(context, {
            command, runId: settlement.runId, payload,
            afterBase, afterRun: preparedRun.value,
            output: { battleRunId: settlement.runId, levelsGained: settlement.levelsGained, elapsedSynced: elapsed },
          });
          if (!committed.ok) return retry(new Error(committed.message));
          if (!ensureSameRun()) return false;
          settlement.levelsGained = Number(committed.value?.output?.levelsGained) || settlement.levelsGained;
          game.elapsedSynced = elapsed;
          settlement.runSaved = true;
        }
        settlement.baseSaved = true;
        SDT.Meta.checkUnlocks();
        if (!settlement.levelsNotified) {
          SDT.Meta.notifyBattleProgressLevels(game.myClass, settlement.levelsGained);
          settlement.levelsNotified = true;
        }
      } else {
        // No selected slot is a development-only memory flow; retain its in-memory semantics.
        if (win === true && !settlement.baseSaved && SDT.Base?.data) {
          SDT.Base.data.eggBattles = (SDT.Base.data.eggBattles || 0) + 1;
          SDT.Meta.applyBattleKillsToBase(SDT.Base.data, settlement.foeNames || ['敌人'], !!opts.isBoss, game.myClass, SDT.Meta.xpMultiplier());
          settlement.baseSaved = true;
          SDT.Meta.checkUnlocks();
        }
        if (!settlement.runSaved) {
          if (saveGame() === false && getActiveSlot()) return retry();
          settlement.runSaved = true;
        }
        if (!settlement.baseSaved && win === true && SDT.Base?.data) {
          if (SDT.Base.save() === false) return retry();
          settlement.baseSaved = true;
        }
      }
      if (stageOnly) {
        const staged = game.pendingBattleLoot;
        if (!staged) return retry(new Error('战利品暂存数据丢失'));
        const stagedIdentity = RunStorage.readIdentity(settlement.slotId);
        if (!stagedIdentity.ok) return retry(new Error(stagedIdentity.message || '无法读取当前对局身份'));
        settlement.stageMode = false;
        settlement.stageRequestId = settlement.requestId;
        settlement.requestId = staged.finalRequestId;
        settlement.context = null;
        settlement.runRevision = stagedIdentity.value.revision;
        if (game.pendingBattleSettlement === staged.stageRequestId) game.pendingBattleSettlement = false;
        return openStagedChests(staged, settlement, opts);
      }
      settlement.phase = 'done';
      if (game.pendingBattleSettlement === settlement.requestId) game.pendingBattleSettlement = false;
      game.state = 'idle';
      UI.refresh(game);
      teachAmmoOnce();   // 首胜后一次性说明「卡牌是消耗品」（见上方 teachAmmoOnce 注释）
      return true;
    };
    if (settlement.phase === 'saving') return settle(!!settlement.stageMode);
    if (win !== true) {   // 撤退：不发宝箱、不发事件奖励
      game.pendingEventLoot = null;
      // 2026-09-07 留言：撤退要有文案和动画——复用启程过渡（撤离点场景）
      if (settlement.phase === 'pocket') await showRunTransition({
        tone: 'exit', asset: 'scene-extract-bg',
        eyebrow: 'TACTICAL RETREAT', title: '全身而退',
        detail: opts.isBoss ? '你撤出了 BOSS战 · 已结算的战利品完好保存' : '撤出战斗 · 打出过的卡照常结算',
        duration: 1050,
      });
      if (!ensureSameRun()) return false;
      if (settlement.phase === 'pocket') UI.log('[[icon:runner]] ' + (opts.isBoss ? '你撤出了 BOSS战' : '你撤出了战斗（打出过的卡照常结算）'), 'sys');
      settlement.phase = 'saving';
      await settle();
      return;
    }
    if (settlement.phase === 'pocket') await showRunTransition({
      tone: opts.isBoss ? 'altar' : 'battle',
      asset: 'scene-battle-bg',
      eyebrow: opts.isBoss ? 'TARGET ELIMINATED' : 'AREA SECURED',
      title: opts.isBoss ? '首脑已击破' : '战斗胜利',
      detail: opts.isBoss ? '污染反应正在消退 · 准备整理战利品' : '威胁解除 · 正在回收战利品',
      duration: opts.isBoss ? 1350 : 1050,
    });
    if (!ensureSameRun()) return false;
    if (settlement.phase === 'pocket') settlement.phase = 'transitioned';
    if (settlement.phase === 'transitioned') {
    UI.log(opts.isBoss ? '[[icon:trophy]] <b>BOSS战胜利！</b>' : '[[icon:trophy]] 战斗胜利！', 'ok');
    // 需求 #13：击败首脑后，第五层终局撤离点无条件放行
    if (opts.isBoss && win === true && !game.bossKilled) {
      game.bossKilled = true;
      UI.log('[[icon:exit]] 首脑已击破——第五层的<b>终局撤离点</b>已解锁，可无条件撤离', 'loot');
    }
    // 击杀统计/经验：按击败的敌人数计（BOSS 逐个记名，供祭坛征服者成就）
    const foeNames = (opts.foeNames && opts.foeNames.length) ? opts.foeNames : [opts.name || '敌人'];
    settlement.foeNames = foeNames.slice();
    // 事件奖励（如盗匪横行的中宝箱 ×2，开真宝箱）
    let eventChests = [];
    if (game.pendingEventLoot) {
      const loot = game.pendingEventLoot;
      game.pendingEventLoot = null;
      if (loot.items && loot.items.length) {
        UI.log(`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>`, 'loot');
        loot.items.forEach(it => game.addItem(it));
      }
      if (loot.chests && loot.chests.length) {
        UI.log(`[[icon:archive]] 事件奖励：<b>${esc(loot.text)}</b>`, 'loot');
        eventChests = loot.chests.map(k => ({ kind: k }));
      }
    }
    settlement.eventChests = eventChests;
    settlement.phase = 'rewardsReady';
    }
    // 战胜 100% 掉宝箱（按所在环层 / BOSS 宝箱）
    const afterRewards = () => {
      if (!ensureSameRun()) return false;
      settlement.phase = 'saving';
      return settle().catch(retry);   // Item 16：BOSS 战后不再进入整理背包
    };
    settlement.allChests ||= settlement.eventChests.concat(SDT.Chests.rollDrops(opts));
    const all = settlement.allChests;
    if (win === true && settlement.slotId) {
      if (!game.pendingBattleLoot) {
        const chests = SDT.Chests.prepareBattle(all, { game,
          battleSummary: { defeated: (opts.foeNames || []).length, hp: game.hp, maxHp: game.maxHp },
        });
        const slewDragon = !opts.isBoss && (opts.foeNames || []).some(n => String(n).includes('巨兽'));
        let legendCount = opts.isBoss ? 1 : 0;
        if (slewDragon && Random.random('loot') < 0.3) legendCount++;
        const legends = [];
        for (let i = 0; i < legendCount; i++) {
          const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
          const card = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
          if (card) legends.push({ ...card });
        }
        game.pendingBattleLoot = {
          version: 1, slotId: settlement.slotId, runId: settlement.runId,
          stageRequestId: settlement.requestId, finalRequestId: `${settlement.requestId}:final`,
          opts: { isBoss: !!opts.isBoss, foeNames: (opts.foeNames || []).slice(), name: opts.name || null },
          legends, chests, stageCommitted: true,
        };
      }
      settlement.stageMode = true;
      settlement.phase = 'saving';
      return settle(true);
    }
    if (all.length) {
      UI.log(`[[icon:archive]] 战利品掉落：${SDT.Chests.dropText(all)}`, 'loot');
      SDT.Chests.open(game, all, afterRewards, {
        deferBaseSave: true,
        battleSummary: { defeated: (opts.foeNames || []).length, hp: game.hp, maxHp: game.maxHp },
      });
      if (settlement.phase === 'rewardsReady') settlement.phase = 'chests';
      return;
    }
    afterRewards();
    };
    settlement.promise = run().catch(retry).finally(() => { settlement.promise = null; });
    return settlement.promise;
  };
  // 战斗结束改经总线广播订阅（批次 5）；G.onBattleEnd 保留为无订阅方时的回退路径
  busOn('battle:end', onBattleEnd);
  game.onBattleEnd = onBattleEnd;
  game.resumeBattleLoot = () => {
    const pending = game.pendingBattleLoot;
    if (!pending) return false;
    const identity = RunStorage.readIdentity(pending.slotId);
    if (getActiveSlot() !== pending.slotId || !identity.ok || identity.value.runId !== pending.runId) return promptBattleLootResume();
    const opts = pending.opts || {};
    const settlement = { phase: 'chests', promise: null, slotId: pending.slotId,
      initialIdentity: identity, identityChecked: true, runId: pending.runId,
      runRevision: identity.value.revision, rewardsApplied: false,
      runSaved: true, baseSaved: true, requestId: pending.finalRequestId };
    settlements.set(opts, settlement);
    return openStagedChests(pending, settlement, opts);
  };
  }


export { bindBagMixins };
