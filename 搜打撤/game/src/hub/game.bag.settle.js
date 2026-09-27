/* 由 game.bag.js 拆出（2026-09-22 六文件重构批4）：战后结算（battle.js 回调）——
 * bindBagMixins 装配（onBattleEnd：消耗口袋回充 / 掉宝箱续流 / 撤退拾回）。
 * 逐字搬迁；对壳本体的调用经 game.bag.bridge.js 的 bagSlots（禁 import 壳）。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { clearBattleSettlementPending, createRunSavePayload, doDeath, game, getActiveSlot, saveGame, setBattleSettlementPending } from '../run/game.session.js';
import { RunStorage } from './game.storage.js';
import { createBattleSettlementCommands } from './battle-settlement.commands.js';
import { commitBaseAndRun, readSettlementReceipt, recoverSlot } from './recovery.commands.js';
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
  const battleSettlementCommands = createBattleSettlementCommands({
    getBase: () => SDT.Base,
    getRunStorage: () => RunStorage,
    getRecovery: () => ({ commitBaseAndRun, readSettlementReceipt, recoverSlot }),
    getActiveSlot,
  });
  const onBattleEnd = async function (opts, playedUids, win, consumedUids) {
    if (game.nestActive) return;   // 龙巢战斗结算由 game.nest 的总线订阅接管（一图战后流程不适用）
    if (win === false) { doDeath(); return; }
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
    const settle = () => {
      if (settlement.commitPromise) return settlement.commitPromise;
      settlement.commitPromise = (async () => {
        if (!sameRun()) return false;
        // 战后保底传说（2026-09-09 玩法定版）：首脑必得 1 张，荒渊额外掉落概率不变。
        const slewDragon = !opts.isBoss && (opts.foeNames || []).some(n => String(n).includes('巨兽'));
        if (!settlement.rewardsApplied) {
          // 宠物蛋保底计数和完成节点都进入 afterBase/afterRun，不先写任一存档。
          if (win === true && !settlement.slotId && SDT.Base && SDT.Base.data) {
            SDT.Base.data.eggBattles = (SDT.Base.data.eggBattles || 0) + 1;
          }
          if (win === true) {
            game.visited = game.visited || {};
            game.visited[settlement.node.layerIdx + ',' + settlement.node.trackPos] = 1;
          }
          let legends = 0;
          if (opts.isBoss && win === true) legends = 1;
          if (slewDragon && win === true && Random.random('loot') < 0.3) legends += 1;
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
          if (!committed.ok) return retry(new Error(committed.message || committed.code));
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
      if (settlement.phase === 'pocket') await showRunTransition({
        tone: 'exit', asset: 'scene-extract-bg',
        eyebrow: 'TACTICAL RETREAT', title: '全身而退',
        detail: opts.isBoss ? '你撤出了 BOSS战 · 已结算的战利品完好保存' : '撤出战斗 · 打出过的卡照常结算',
        duration: 1050,
      });
      if (!sameRun()) return false;
      if (settlement.phase === 'pocket') UI.log('[[icon:runner]] ' + (opts.isBoss ? '你撤出了 BOSS战' : '你撤出了战斗（打出过的卡照常结算）'), 'sys');
      settlement.phase = 'saving';
      settle();
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
    if (!sameRun()) return false;
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
    foeNames.forEach((n, i) => {
      SDT.Meta.track('kill', { boss: !!opts.isBoss && i === 0, name: n, cls: game.myClass });
    });
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
        battleSummary: { defeated: (opts.foeNames || []).length, hp: game.hp, maxHp: game.maxHp },
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
  }


export { bindBagMixins };
