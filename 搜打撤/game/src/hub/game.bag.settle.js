/* 由 game.bag.js 拆出（2026-09-22 六文件重构批4）：战后结算（battle.js 回调）——
 * bindBagMixins 装配（onBattleEnd：消耗区回充 / 掉宝箱续流 / 撤退拾回）。
 * 逐字搬迁；对壳本体的调用经 game.bag.bridge.js 的 bagSlots（禁 import 壳）。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { RULE_CONFIG } from '../core/rule-config.js';
import { clearBattleSettlementPending, createRunSavePayload, doDeath, game, getActiveSlot, saveGame, setBattleSettlementPending } from '../run/game.session.js';
import { RunStorage } from './game.storage.js';
import { createBattleSettlementCommands } from './battle-settlement.commands.js';
import { commitBaseAndRun, readSettlementReceipt, recoverSlot } from './recovery.commands.js';
import { Random } from '../core/random.js';
import { on as busOn } from '../core/event-bus.js';
import { showRunTransition } from '../run/game.run.js';
import { bagSlots } from './game.bag.bridge.js';
import { validBattleRewardContinuation } from '../run/chest-reward-save.js';
let restoreBattleReward = null;
export const resumeBattleRewards = saved => restoreBattleReward?.(saved) || false;
  // ---------- 战后结算（battle.js 回调） ----------
  // win = true 胜利 / false 战败 / null 撤退。
  // 小怪战：使用过的卡进消耗区；BOSS 战：卡牌完好保留；
  // 注能消耗的卡（consumedUids）：无论战斗类型都进消耗区（可在火堆复原）。
  // 胜利 100% 掉宝箱（按所在环层 / BOSS 固定 BOSS宝箱），开完宝箱再续流。
  // ESM：循环导入下本模块体可能先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
  function bindBagMixins() {
  // Esc/遮罩关背包的唯一收口（迭代评审 09-20 C-P1）：ui.js 的 Esc 分支回调 bagSlots.closeBackpack，
  // 复位 game.state——此前直接 hideOverlay 会把状态卡死在 modal、地图/路线全部无响应。
  // 晚绑定注册避免 ui→bag 静态成环（bag.js:2 的 UI 取自 window.SDT 门面）
  UI._bagCloseHook = bagSlots.closeBackpack;
  const settlements = new WeakMap();
  const battleSettlementCommands = createBattleSettlementCommands({
    getBase: () => SDT.Base,
    getRunStorage: () => RunStorage,
    getRecovery: () => ({ commitBaseAndRun, readSettlementReceipt, recoverSlot }),
    getActiveSlot,
  });
  const onBattleEnd = async function (opts, playedUids, win, consumedUids) {
    if (game.nestActive) return;   // 龙巢战斗结算由 game.nest 的总线订阅接管（一图战后流程不适用）
    if (win === false) { doDeath({ battleSummary: opts?.battleSummary, battleIsBoss: !!opts?.isBoss }); return; }
    // battle.engine 为每次开战创建独立 opts；同一场结束通知和失败重试共用这份记录。
    let settlement = settlements.get(opts);
    if (!settlement) {
      const slotId = getActiveSlot();
      const identity = slotId ? RunStorage.readIdentity(slotId) : null;
      const node = { layerIdx: game.layerIdx, trackPos: game.trackPos, isBoss: !!opts.isBoss,
        ...(typeof opts.encounterId === 'string' ? { encounterId: opts.encounterId } : {}) };
      settlement = { phase: 'new', promise: null, commitPromise: null, slotId, runId: identity?.ok ? identity.value.runId : null,
        ownerSeed: game.seed, runToken: game.discoveredPairs,
        node, receiptChecked: false, attempt: null, rewardsApplied: false };
      settlements.set(opts, settlement);
    }
    const sameRun = () => {
      if (getActiveSlot() !== settlement.slotId) return false;
      if (game.seed !== settlement.ownerSeed || game.discoveredPairs !== settlement.runToken) return false;
      if (!settlement.slotId) return true;
      const identity = RunStorage.readIdentity(settlement.slotId);
      if (!identity.ok) return !!settlement.attempt && game.discoveredPairs === settlement.savingRunToken && identity.code === 'RECOVERY_REQUIRED';
      if (!settlement.runId) settlement.runId = identity.value.runId;
      return identity.value.runId === settlement.runId;
    };
    if (!sameRun()) return false;

    if (settlement.promise) return settlement.promise;
    if (settlement.phase === 'done' || settlement.phase === 'chests') return;
    const retry = error => {
      if (!sameRun()) return false;
      if (error) console.error('[battle:settle] 战后结算未完成', error);
      UI.log('[[icon:cross]] 战后结算未保存，请重试；本场奖励不会重新发放', 'warn');
      game.state = settlement.slotId && win === true ? 'battleSettlement' : 'modal';
      UI.showOverlay('战后结算未完成', '<div class="ov-btns"><button class="ov-btn ok" data-act="battleSettleRetry">重试保存战后奖励</button></div>', 'discover');
      settlement.retryButton = UI.el?.ovBody?.querySelector('[data-act="battleSettleRetry"]');
      settlement.retryAction = () => onBattleEnd(opts, playedUids, win, consumedUids);
      UI.act('battleSettleRetry', settlement.retryAction);
      return false;
    };
    const run = async () => {
    if (!sameRun()) return false;
    if (settlement.phase === 'new' && win === true && settlement.slotId && !settlement.receiptChecked) {
      game.state = 'battleSettlement';
      const prior = await battleSettlementCommands.readReceipt({ slotId: settlement.slotId, node: settlement.node });
      if (!sameRun()) return false;
      if (!prior.ok) return retry(new Error(prior.message || prior.code));
      settlement.receiptChecked = true;
      if (prior.replay) {
        settlement.phase = 'done';
        UI.log('[[icon:cross]] 本节点结算已由另一个会话完成，请重新载入当前档位', 'warn');
        return false;
      }
      const currentIdentity = RunStorage.readIdentity(settlement.slotId);
      if (!currentIdentity.ok) return retry(new Error(currentIdentity.message || currentIdentity.code));
      if (settlement.runId && currentIdentity.value.runId !== settlement.runId) return false;
      settlement.runId = currentIdentity.value.runId;
      if (!sameRun()) return false;
      game.state = 'idle';
    }
    if (settlement.phase === 'new') {
    // Display-only receipt lives in the WeakMap; it is never part of a run save or attempt.
    settlement.cardOutcome = { pocket: [], gone: [], retained: [] };
    if (win !== true) UI.hideOverlay();   // 胜利保留战场短反馈，随后直接进入领奖。
    // 用过或被消耗的卡统一进入消耗区，不按职业、初始攻击或衍生稀有度排除。
    const movedUids = new Set();
    const toPocket = (uids, why) => {
      const moved = [];
      uids.forEach(uid => {
        if (movedUids.has(uid)) return;
        const i = game.ownedCards.findIndex(o => o.uid === uid);
        const card = i >= 0 ? game.ownedCards[i].card : opts.spentCards?.find(entry => entry.uid === uid)?.card;
        if (!card) return;
        if (i >= 0) game.ownedCards.splice(i, 1);
        movedUids.add(uid);
        moved.push(card);
        settlement.cardOutcome.pocket.push(card.name);
      });
      moved.forEach(card => bagSlots.pocketAdd(card));
      if (moved.length && why) {
        UI.log(`[[icon:archive]] ${why}：<b>${moved.length}</b> 张卡牌进入消耗区，复原后可再用`, 'sys');
      }
      return moved.length;
    };
    // Item 16 定版：所有战斗（含 BOSS）的消耗牌都进消耗区，撤离点统一 1/3 结算
    if (playedUids && playedUids.length) {
      toPocket(playedUids, '使用过的卡牌');
    }
    if (consumedUids && consumedUids.length) {
      toPocket(consumedUids, '注能消耗的卡牌');
    }
    settlement.cardOutcome.retained = game.ownedCards.map(owned => owned.card.name);
    settlement.phase = 'pocket';
    }
    // 「卡牌是消耗品」一次性教学（2026-09-19 关卡审查）：
    // 用过的牌统一进入消耗区，复原回背包后可再使用。
    // 新手首层打光 5 张初始攻击就会陷入无攻击牌死局。首胜结算后弹一次说明（按档位只弹一次）。
    // 2026-09-19 留言 #17：重做成大版图解页——卡面实物 + 箭头流向 + 图标分栏，不再挤小字
    const teachAmmoOnce = () => {
      const B = SDT.Base;
      if (!B || !B.data || B.data.ammoTaught) return;
      B.markAmmoTaught();   // 2026-09-29 收敛：内存推进+尝试保存的旧语义移入 Base 命令
      game.state = 'modal';
      const shaCard = SDT.Cards.all().find(c => c.id === SDT.Cards.SHA.id) || SDT.Cards.SHA;
      // 2026-10-02 老板：左列「入口袋」图换真正会进消耗区的普通牌（镭射，TT10 定版）——
      // 卡面仅举例，所有用过的牌按同一规则进入消耗区。
      const pocketCard = SDT.Cards.all().find(c => c.id === 'tt3sp-silverthorn')
        || (Array.isArray(SDT.Cards.TABLETOP10) && SDT.Cards.TABLETOP10.find(c => c.id === 'tt3sp-silverthorn'))
        || shaCard;
      UI.showOverlay('[[icon:cards]] 卡牌是消耗品', `
        <div class="ammo-teach">
          <section class="at-col">
            <div class="at-flow">
              <span class="at-card">${SDT.Cards.cardHTML(pocketCard, 'sm')}</span>
              <span class="at-arrow">➜</span>
              <span class="at-node"><span class="at-ico">[[icon:pocket]]</span><b>消耗区</b></span>
            </div>
            <p class="at-txt">所有用过的牌都进<b>消耗区</b>，复原后可以再用。</p>
          </section>
          <section class="at-col">
            <div class="at-flow">
              <span class="at-card">${SDT.Cards.cardHTML(shaCard, 'sm')}</span>
              <span class="at-arrow">➜</span>
              <span class="at-node"><span class="at-ico">[[icon:pocket]]</span><b>复原后可再用</b></span>
            </div>
            <p class="at-txt">复原回背包，就能再用。具体方法在背包查看。</p>
          </section>
          <section class="at-col">
            <div class="at-flow">
              <span class="at-node"><span class="at-ico">[[icon:archive]]</span><b>多开箱</b></span>
              <span class="at-dot">·</span>
              <span class="at-node"><span class="at-ico">[[icon:bag]]</span><b>常逛商店</b></span>
            </div>
            <p class="at-txt">牌快用完时，去宝箱或商店补牌。</p>
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
    const settle = () => {
      if (settlement.commitPromise) return settlement.commitPromise;
      settlement.commitPromise = (async () => {
        if (!sameRun()) return false;
        // 战后保底传说（2026-09-09 玩法定版）：首脑必得 1 张，荒渊额外掉落概率不变。
        const slewDragon = !opts.isBoss && (opts.foeNames || []).some(n => String(n).includes('巨兽'));
        if (!settlement.rewardsApplied) {
          // 宠物蛋保底计数和完成节点都进入 afterBase/afterRun，不先写任一存档。
          // 无档位胜利的计数（2026-09-29 收敛）经宠物蛋命令走内存推进+尝试保存的旧语义。
          if (win === true && !settlement.slotId && SDT.Base && SDT.Base.data) {
            SDT.Base.recordEggBattle();
          }
          if (win === true) {
            game.visited = game.visited || {};
            game.visited[settlement.node.layerIdx + ',' + settlement.node.trackPos] = 1;
          }
          let legends = 0;
          if (opts.isBoss && win === true) legends = 1;
          if (slewDragon && win === true && Random.random('loot') < RULE_CONFIG.rewards.beastLegendaryChance) legends += 1;
          if (legends > 0) UI.log('[[icon:trophy]] 首脑宝库开启：额外奖励 <b>1 张传说卡</b>！', 'loot');
          for (let i = 0; i < legends; i++) {
            const pool = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
            const card = pool.length ? pool[Math.floor(Random.random('loot') * pool.length)] : null;
            if (card) game.grantCard(card);
          }
          settlement.rewardsApplied = true;
        }
        settlement.phase = 'saving';

        if (win === true && settlement.slotId && SDT.Base && SDT.Base.data) {
          game.state = 'battleSettlement';
          settlement.savingRunToken = game.discoveredPairs;
          setBattleSettlementPending(settlement.slotId, settlement.runId);
          if (!settlement.attempt) {
            const afterRun = createRunSavePayload();
            if (!afterRun) return retry(new Error('路线快照校验失败'));
            settlement.elapsedCheckpoint = afterRun.elapsed;
            const elapsedDelta = Math.max(0, (+game.elapsed || 0) - (+game.elapsedSynced || 0));
            const prepared = await battleSettlementCommands.createAttempt({
              slotId: settlement.slotId, node: settlement.node, afterRun, elapsedDelta,
              victoryProgress: settlement.victoryProgress,
            });
            if (!sameRun()) return false;
            if (!prepared.ok) return retry(new Error(prepared.message || prepared.code));
            if (prepared.replay) {
              settlement.phase = 'done';
              UI.log('[[icon:cross]] 本节点结算已由另一个会话完成，请重新载入当前档位', 'warn');
              return false;
            }
            settlement.attempt = prepared.attempt;
          }
          const committed = await battleSettlementCommands.commitAttempt(settlement.attempt);
          if (!sameRun()) return false;
          if (!committed.ok) {
            if (settlement.victoryProgress) settlement.progressNeedsPublication = true;
            return retry(new Error(committed.message || committed.code));
          }
          if (settlement.victoryProgress && !settlement.progressPublished &&
              (!committed.replay || settlement.progressNeedsPublication)) {
            settlement.progressPublished = true;
            if (typeof SDT.Meta.publishBattleProgress === 'function') {
              try {
                SDT.Meta.publishBattleProgress(committed.receipt?.output?.progression?.levelUps || []);
              } catch (error) {
                console.error('[battle:progress] 战斗进度已保存，但升级/成就提示未完成', error);
              }
            }
          }
          clearBattleSettlementPending(settlement.slotId, settlement.runId);
          game.elapsedSynced = settlement.elapsedCheckpoint;
          game.state = 'idle';
        } else {
          // 无档位胜利和非胜利仍保留原有内存/普通保存语义，不创建永久结算键。
          game.state = 'idle';
          if (saveGame() === false && getActiveSlot()) return retry();
        }

        settlement.phase = 'done';
        if (settlement.retryAction && UI._acts?.battleSettleRetry === settlement.retryAction) {
          UI.act('battleSettleRetry', undefined);
        }
        if (settlement.retryButton && UI.el?.ovBody?.contains(settlement.retryButton)) {
          // Only this settlement's layer; no delayed close may outlive the following teaching layer.
          UI.hideOverlay({ immediate: true });
        }
        settlement.retryButton = null;
        settlement.retryAction = null;
        UI.refresh(game);
        teachAmmoOnce();   // 首胜后一次性说明「卡牌是消耗品」
        return true;
      })().catch(error => sameRun() ? retry(error) : false).finally(() => { settlement.commitPromise = null; });
      return settlement.commitPromise;
    };
    if (settlement.phase === 'saving') return settle();
    if (win !== true) {   // 撤退：不发宝箱、不发事件奖励
      game.pendingEventLoot = null;
      // 2026-09-07 留言：撤退要有文案和动画——复用启程过渡（撤离点场景）
      if (settlement.phase === 'pocket') {
        const shown = await showRunTransition({
          tone: 'exit', asset: 'scene-extract-bg',
          eyebrow: 'TACTICAL RETREAT', title: '全身而退',
          detail: opts.isBoss ? '你撤出了 BOSS战 · 已结算的战利品完好保存' : '撤出战斗 · 打出过的卡照常结算',
          duration: 1050,
        });
        // M1（U10 2026-09-29）：resolve(false)=过场非当前（被新过场顶替/上下文失效/测试环境拆除），
        // 屏幕已易主——静默终止本续流，不再 UI.log/续结算（teardown 后此处续流摸 document 抛错的根因）。
        // showRunTransition 契约上 resolve 值严格为布尔（scenes.js 仅 resolve(false)/resolve(true)），故用 === false 精判。
        if (shown === false) return false;
      }
      if (!sameRun()) return false;
      if (settlement.phase === 'pocket') UI.log('[[icon:runner]] ' + (opts.isBoss ? '你撤出了 BOSS战' : '你撤出了战斗（打出过的卡照常结算）'), 'sys');
      settlement.phase = 'saving';
      settle();
      return;
    }
    if (settlement.phase === 'pocket') {
      const shown = await SDT.Battle?.presentVictory?.(opts, sameRun);
      // 画面已易主时停止旧续流；无视图端口的逻辑环境不增加等待。
      if (shown === false) return false;
    }
    if (!sameRun()) return false;
    if (settlement.phase === 'pocket') settlement.phase = 'transitioned';
    if (settlement.phase === 'transitioned') {
    UI.log(opts.isBoss ? '[[icon:trophy]] <b>BOSS战胜利！</b>' : '[[icon:trophy]] 战斗胜利！', 'ok');
    // 需求 #13：击败首脑后，第四层终局撤离点无条件放行
    // 2026-10-02 老板：日志「第五层」系旧五层布局残留，主图四层定版后统一为「第四层」
    if (opts.isBoss && win === true && !game.bossKilled) {
      game.bossKilled = true;
      UI.log('[[icon:exit]] 首脑已击破——第四层的<b>终局撤离点</b>已解锁，可无条件撤离', 'loot');
    }
    // A slot-backed victory defers kill/XP progress into the recoverable Base+Run attempt.
    // No-slot play retains the historical in-memory Meta path at this point in the flow.
    const foeNames = (opts.foeNames && opts.foeNames.length) ? opts.foeNames : [opts.name || '敌人'];
    if (settlement.slotId && SDT.Base && SDT.Base.data) {
      settlement.victoryProgress = {
        foeNames: foeNames.slice(), isBoss: !!opts.isBoss, classId: game.myClass,
        xpMultiplier: typeof SDT.Meta.xpMultiplier === 'function' ? SDT.Meta.xpMultiplier() : 1,
      };
    } else if (!settlement.progressRecorded) {
      foeNames.forEach((name, index) => {
        SDT.Meta.track('kill', { boss: !!opts.isBoss && index === 0, name, cls: game.myClass });
      });
      settlement.progressRecorded = true;
    }
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
    const afterRewards = async () => {
      if (settlement.phase === 'done') return true;
      if (!sameRun()) return false;
      settlement.phase = 'saving';
      return await settle();   // Item 16：BOSS 战后不再进入整理背包
    };
    settlement.allChests ||= settlement.eventChests.concat(SDT.Chests.rollDrops(opts));
    const all = settlement.allChests;
    if (all.length) {
      UI.log(`[[icon:archive]] 战利品掉落：${SDT.Chests.dropText(all)}`, 'loot');
      SDT.Chests.open(game, all, afterRewards, {
        battleSettlement: {
          version:1, slotId:settlement.slotId, runId:settlement.runId, node:settlement.node,
          opts:{ isBoss:!!opts.isBoss, foeNames:(opts.foeNames?.length ? opts.foeNames : [opts.name || '敌人']).slice(),
            ...(opts.name ? { name:opts.name } : {}), ...(opts.encounterId ? { encounterId:opts.encounterId } : {}) },
          victoryProgress:settlement.victoryProgress || null, progressRecorded:!!settlement.progressRecorded,
        },
        battleSummary: { defeated: (opts.foeNames || []).length, hp: game.hp, maxHp: game.maxHp, cardOutcome: settlement.cardOutcome },
      });
      if (settlement.phase === 'rewardsReady') settlement.phase = 'chests';
      return;
    }
    return afterRewards();
    };
    settlement.promise = run().catch(retry).finally(() => { settlement.promise = null; });
    return settlement.promise;
  };
  // 战斗结束改经总线广播订阅（批次 5）；G.onBattleEnd 保留为无订阅方时的回退路径
  busOn('battle:end', onBattleEnd);
  game.onBattleEnd = onBattleEnd;
  restoreBattleReward = saved => {
    const continuation = saved?.context?.battleSettlement;
    if (!validBattleRewardContinuation(continuation, game) || continuation.slotId !== getActiveSlot()) return false;
    if (continuation.slotId) {
      const identity = RunStorage.readIdentity(continuation.slotId);
      if (!identity.ok || identity.value.runId !== continuation.runId) return false;
    }
    const opts = { ...continuation.opts };
    const settlement = { phase:'chests', promise:null, commitPromise:null,
      slotId:continuation.slotId, runId:continuation.runId, node:{ ...continuation.node },
      ownerSeed:game.seed, runToken:game.discoveredPairs, receiptChecked:true,
      attempt:null, rewardsApplied:false, victoryProgress:continuation.victoryProgress,
      progressRecorded:continuation.progressRecorded };
    settlements.set(opts, settlement);
    return SDT.Chests.restore(game, saved, () => {
      // The saved bag already contains card consumption and any claimed rewards.
      // Re-enter only the existing idempotent Base+Run victory transaction.
      if (settlement.phase === 'done') return true;
      settlement.phase = 'saving';
      return onBattleEnd(opts, [], true, []);
    });
  };
  }


export { bindBagMixins };
