/* game.session.death.js —— 受击反馈与终局结算（自 game.session.js 拆出，2026-09-25）。
 * doDeath 的 terminal pending 流程：构造结算 token、两键提交（创建/重试/落库）、
 * 失败掠夺面板与熟练度结算。与会话存档互不反向依赖：会话侧经 createDeathSettlement
 * 工厂注入档位/代数/结算命令与背包抢运统计（battle.exec-play 同款手法），
 * 本模块不 import 任何 game.session.* 模块。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { runTerminalSettlement } from '../ui/terminal-settlement.js';
import { characterName } from '../core/characters.js';
import { firstExploreMoves } from '../hub/extraction.commands.js';
import { esc } from '../core/shared.js';
import { uiDisclosure } from '../ui/ui-disclosure.js';

// 终局失败车队横幅（LEG-6b，2026-09-26 W1 批件）：挂「撤离失败」终局页顶部作正脸
// 结算演出（判负撤离与倒下共用本页，均为失败语义）。素材只读引用，不改结算语义。
const RUN_FAIL_BANNER = new URL('../../assets/scenes/ui-loop-0925/rewards-convoy-fail.webp', import.meta.url).href;

function cardsAfterRescue(owned, rescued) {
  const counts = new Map();
  rescued.forEach(entry => counts.set(entry.card, (counts.get(entry.card) || 0) + (entry.count || 1)));
  return owned.filter(entry => {
    if (!entry?.card) return false;
    const count = counts.get(entry.card) || 0;
    if (!count) return true;
    counts.set(entry.card, count - 1); return false;
  });
}
function resourceNames(entries) {
  const counts = new Map();
  entries.forEach(entry => {
    if (entry.card?.type === '资源') counts.set(entry.card.name, (counts.get(entry.card.name) || 0) + (entry.count || 1));
  });
  return [...counts].map(([name,count]) => `${esc(name)} ×${count}`).join('、');
}
function snapshotBattleReview(summary, isBoss) {
  if (!summary || !Number.isInteger(summary.round) || summary.round < 1) return null;
  return { round:summary.round, isBoss,
    foes:(summary.remainingFoes || []).map(foe => ({name:String(foe.name || '敌人'),hp:Number(foe.hp) || 0,maxHp:Number(foe.maxHp) || 0})),
    hits:(summary.damageTaken || []).map(hit => ({source:String(hit.source || '未命名来源'),damage:Math.max(0,Number(hit.damage) || 0)})),
    coverage:String(summary.damageCoverage || '记录敌方直接攻击与回合末中毒；其他卡牌或反噬伤害未归因。') };
}
function battleReviewHTML(token) {
  const review = token.battleReview;
  if (!review) return `<section class="doom-review" aria-label="本次结束原因"><b>结束原因</b><p>${esc(token.endReason)}</p><small>本次没有战斗摘要，不推算敌人状态或承伤来源。</small></section>`;
  const sources = new Map();
  review.hits.forEach(hit => sources.set(hit.source,(sources.get(hit.source) || 0) + hit.damage));
  const damage = [...sources].sort((a,b) => b[1]-a[1]).map(([name,n]) => `${esc(name)} ${n}`).join('、');
  return `<section class="doom-review" aria-label="战斗复盘"><b>战斗复盘 · 最后第 ${review.round} 回合</b><p>${review.isBoss ? '首脑' : '敌方'}剩余：${review.foes.length ? review.foes.map(foe => `${esc(foe.name)} ${Math.max(0,foe.hp)}/${foe.maxHp} 生命`).join('、') : '无存活敌人'}</p>${uiDisclosure({label:'承伤来源与记录范围',className:'doom-damage-details',content:`<p>已归因承伤：${damage || '未记录到已覆盖来源的生命伤害'}</p><small>${esc(review.coverage)}</small>`})}</section>`;
}

// 2026-10-03 老板（SYS-11）：死亡局也产「真实回执」——字段与 extraction.commands 的
// buildExtractionReceipt 同形（version/outcome/netTake/losses/firstExplore…），跑局记录
// 的死亡收益读回执口径、不再从 G 现场反推。死亡口径：只有安全抢运清单（rescuedCards，
// 即 run.death 事务提交进基地仓库的同一批）计入 netTake.cardsStashed；消耗区/随身物资/币
// 全部散失；首探经验不发（撤离经验只在撤离链发放，+5 熟练度走 terminal 链的另一本账）。
export function buildDeathReceipt({ game, rescuedCards }) {
  const rescuedList = (rescuedCards || []).filter(c => c && c.card);
  const rescuedCount = rescuedList.reduce((n, c) => n + (c.count || 1), 0);
  const lostCards = cardsAfterRescue(game.ownedCards || [], rescuedList);
  const pocketLost = (game.usedPocket || []).reduce((n, s) => n + (s.count || 1), 0);
  return {
    version: 1,
    outcome: 'death',
    bossKilled: !!game.bossKilled,
    layersReached: Number.isInteger(game.layerIdx) ? game.layerIdx + 1 : null,
    actions: Math.max(0, (Number(game.turn) || 0) - 1),
    firstExplore: { moves: firstExploreMoves(game), xp: 0 },
    netTake: {
      cardsStashed: rescuedCount,   // 抢运入库张数（与 applyCards 提交清单一致）
      pocketKept: 0,
      wood: 0,
      rations: 0,
    },
    losses: {
      lostCount: lostCards.length,
      lostNotable: lostCards.filter(o => o.card.rarity === '传说' || o.card.rarity === '史诗')
        .slice(0, 6).map(o => ({ name: o.card.name, rarity: o.card.rarity, count: 1 })),
      pocketLost,
    },
    runCoins: Number.isInteger(game.coins) ? game.coins : null,   // 随身币不带回，只作本局记录
    durationSec: Math.max(0, Math.floor(Number(game.elapsed) || 0)),
  };
}

export function createDeathSettlement({
  game, runtime, terminalCommands,
  getActiveSlot, getTerminalGeneration, nextTerminalGeneration,
  cardStacks, safeUsed, safeCap, pearlBoxId,
}) {
  const fxAt = () => ({ x: game.pos.x, y: game.pos.y });

  game.heal = function (n) {
    if (game.hp >= game.maxHp) { UI.log('[[icon:heart]] 生命值已满', 'dim'); return; }
    const real = Math.min(n, game.maxHp - game.hp);
    game.hp += real;
    SDT.Sound.sfx('heal');
    UI.log(`[[icon:heart]] 恢复 <b>${real}</b> 点生命（${game.hp}/${game.maxHp}）`, 'heal');
    UI.refresh(game);
  };

  game.damage = function (n, reason) {
    game.hp -= n;
    const p = fxAt();
    // 三档反馈（game-feel）：玩家受伤=large（顿帧+受击音）；≥10 与战斗内重击口径一致
    SDT.FX.feedback(p.x, p.y, {
      tier: n >= 10 ? 'large' : 'medium', sfx: 'strike',
    });
    UI.log(`[[icon:heart]] ${reason ? reason : ''}损失 <b>${n}</b> 点生命（${Math.max(0, game.hp)}/${game.maxHp}）`, 'warn');
    if (game.hp <= 0) doDeath({ reason: reason || '非战斗生命损失' });
    UI.refresh(game);
  };

  function doDeath({ battleSummary = null, battleIsBoss = false, reason = '' } = {}) {
    if (!game.runActive) return false;
    if (game.terminalPending) return game.terminalPending.promise || false;
    const slotId = getActiveSlot();
    const sourceBase = SDT.Base;
    if (slotId && sourceBase?.slot != null && sourceBase.slot !== slotId) return false;
    const generation = nextTerminalGeneration();
    const why = game.surrenderedRun ? '你选择了撤离' : '你倒下了';
    const lost = game.inventory.reduce((a, b) => a + (Number(b.value) || 0) * (Number(b.count) || 0), 0);
    // W3-01（2026-09-27 R2，定向解冻批件）：XP 快照——receipt 只回 levelsGained 无
    // 绝对值，「本局 +N」= 提交后 Meta 现读 − 提交前此快照。零新增统计口径。
    // 注意 classSummary(cls) 返回全职业数组（meta.js 按 classList().map），须 .find 取本职业。
    const cls = game.myClass;
    const sumBefore = cls ? SDT.Meta.classSummary(cls).find(c => c.cls === cls) : null;
    const boxSafe = game.ownedCards.some(o => o.safe && o.card && o.card.id === pearlBoxId);
    const saved = cardStacks(true);
    // 珍珠盒抢运只覆盖盒中资源（stored 且非 pouchOf）：锦囊（pouchOf）不在盒中，其宿主锦囊
    // 不安全时里面的法术随锦囊一起丢——此前只看 stored&&boxSafe，把不安全锦囊里的法术
    // 也错误抢运回基地（09-30 深审 ROOT-05）
    const cards = game.ownedCards.filter(o => o.safe || (o.stored && !o.pouchOf && boxSafe)).map(o => ({ card: o.card, count: 1 }));
    const token = { kind: 'death', generation, slotId, cards, deathClass: game.myClass, saved, lost, why,
      partnerName: sourceBase?.carriedPet?.()?.name || '随行伙伴',
      looseItems: game.inventory.filter(item => item.count > 0).map(item => `${esc(item.name)} ×${item.count}`).join('、'),
      lostResources: resourceNames(cardsAfterRescue(game.ownedCards, cards)),
      savedResources: resourceNames(cards),
      endReason: game.surrenderedRun ? '你主动选择撤离，按失败结算' : reason || (battleSummary ? '战斗中生命归零' : '生命归零；未提供具体受伤来源'),
      battleReview: snapshotBattleReview(battleSummary, battleIsBoss),
      needBefore: sumBefore?.need,
      xpBefore: sumBefore ? sumBefore.xp : null, lvBefore: sumBefore ? sumBefore.lv : null,
      hadCards: game.ownedCards.length > 0, attempt: null, busy: false, promise: null, ephemeral: !slotId,
      // 2026-10-03 老板（SYS-11）：死亡回执在倒下瞬间快照（结算不改写这些值），随 token 走到
      // finish 交给 recordRun——重试/重放路径同一份事实，收益口径不再反推
      receipt: buildDeathReceipt({ game, rescuedCards: cards }) };
    game.terminalPending = token;
    game.state = 'terminalPending';

    const current = () => game.terminalPending === token && token.generation === getTerminalGeneration() && getActiveSlot() === token.slotId
      && (!slotId || (SDT.Base === sourceBase && (sourceBase.slot == null || sourceBase.slot === slotId)));
    const announceLevelUps = levels => {
      if (!levels || !game.myClass) return;
      const meta = SDT.Meta;
      for (let i = 0; i < levels; i++) SDT.Sound.sfx('levelup');
      UI.log(`[[icon:medal]] <b>${characterName(game.myClass)}</b> 熟练度提升！现在是 <b>Lv.${meta.classLv(game.myClass)}</b>（出征 ${meta.perkText(meta.classLv(game.myClass))}）`, 'ok');
    };
    const finish = (levels = 0) => {
      if (!current()) return false;
      game.terminalPending = null;
      game.state = 'done';
      game.runActive = false;
      game.surrenderedRun = false;
      // 2026-10-03 老板（SYS-11）：死亡收益读回执口径（netTake/losses/首探随 token.receipt），
      // savedCards 仍作 carried 既有口径；无回执调用（旧测试兜底）行为不变
      SDT.Agent?.recorder?.recordRun('death', { why: token.why, savedCards: token.saved, receipt: token.receipt });   // 跑局统计（数据分析系统）
    SDT.Sound.sfx('extractionFail');
      SDT.Sound.music('title');
      if (token.ephemeral) {
        UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');
        announceLevelUps(levels);
      } else {
        announceLevelUps(levels);
        try { Promise.resolve(SDT.Meta.checkUnlocks()).catch(() => {}); } catch { /* 提交已完成，成就提示不能回滚终局 */ }
      }
      // A5-DEATH-02（2026-10-03）：抢运张数与死亡回执同口径——token.cards（doDeath 抢运清单，
      // 含珍珠盒中 stored 资源卡，每条 count:1）即 buildDeathReceipt 的 rescuedCards，页面
      // 「抢运回基地 N 张」与回执 netTake.cardsStashed 恒等；原 token.saved 是 cardStacks(true)
      // 的安全格堆叠口径，盒中卡入盒不入安全格，盒入安全格存卡时两式劈叉（页面 N < 回执 M）。
      const savedN = token.cards.reduce((a, b) => a + (b.count || 1), 0);
      // XP 快照仅覆盖本次失败结算，累计进度另列；不能据此反推整局经验来源。
      let xpRow = '';
      const cls = token.deathClass;
      const sumAfter = cls ? SDT.Meta.classSummary(cls).find(c => c.cls === cls) : null;
      if (sumAfter && token.xpBefore != null) {
        const pct = sumAfter.need ? Math.min(100, sumAfter.xp / sumAfter.need * 100) : 0;
        const gained = sumAfter.lv === token.lvBefore ? Math.max(0, sumAfter.xp - token.xpBefore)
          : sumAfter.lv === token.lvBefore + 1 && token.needBefore != null ? token.needBefore - token.xpBefore + sumAfter.xp : null;
        const rewardCopy = gained == null ? '本次失败结算奖励已发放' : `本次失败结算 <b class="gold">+${gained} XP</b>`;
        if (token.ephemeral) {
          const lvNow = token.lvBefore + (levels || 0);
          if (levels > 0) xpRow = `<div class="doom-xp"><p class="doom-xp-h">熟练度提升！Lv.${token.lvBefore} → Lv.${lvNow}（测试投影 · 不写档）</p></div>`;
        } else if (sumAfter.lv > token.lvBefore) {
          xpRow = `<div class="doom-xp doom-xp-up"><p class="doom-xp-h">熟练度提升！Lv.${token.lvBefore} → Lv.${sumAfter.lv}</p><div class="doom-xp-bar" aria-label="熟练度 ${pct.toFixed(0)}%"><i style="width:${pct.toFixed(1)}%"></i></div><p class="doom-xp-note">${rewardCopy} · 当前累计进度 Lv.${sumAfter.lv}：${sumAfter.xp}/${sumAfter.need}</p></div>`;
        } else {
          xpRow = `<div class="doom-xp"><p class="doom-xp-h">熟练度成长</p><div class="doom-xp-bar" aria-label="熟练度 ${pct.toFixed(0)}%"><i style="width:${pct.toFixed(1)}%"></i></div><p class="doom-xp-note">${rewardCopy} · 当前累计进度 Lv.${sumAfter.lv}：${sumAfter.xp}/${sumAfter.need} · 差 <b>${sumAfter.need - sumAfter.xp}</b> 点升级</p></div>`;
        }
      }
      UI.log(savedN
        // A5-DEATH-02：savedN 为回执口径（token.cards，含珍珠盒 stored 卡），不说「安全格中」
        ? `<b>[[icon:skull]] ${token.why}……</b>[[icon:lock]] ${esc(token.partnerName)}抢运回基地的 <b>${savedN}</b> 张卡牌（含珍珠盒内的卡），其余全部丢失`
        : `<b>[[icon:skull]] ${token.why}……</b>安全格里没有卡牌，全部战利品丢失`, 'warn');
      // Counts retain the receipt's separate owned-card and consumed-pocket categories.
      const deathLoss = token.receipt?.losses;
      const lossDetails = `${deathLoss?.lostNotable?.length ? `<p class="ov-note">散失的关键卡：${deathLoss.lostNotable.map(c => `【${esc(c.name)}】`).join('、')}</p>` : ''}${token.lostResources ? `<p class="ov-note">其中资源卡散失：${token.lostResources}</p>` : ''}`;
      UI.showOverlay('撤离失败', `
        <div class="doom-panel ui-design-system">
          <img class="battle-banner" src="${RUN_FAIL_BANNER}" alt="" draggable="false">
          <p class="doom-sub">${esc(token.endReason)} · 远征到此为止</p>
          ${token.ephemeral ? '<p class="ov-note">开发测试档未选择存档槽；基地奖励仅暂存于内存。</p>' : ''}
          <div class="doom-stats" aria-label="本次损失与保留">
            <div class="doom-stat"><span class="ds-k">卡牌散失</span><b class="ds-v bad">${deathLoss?.lostCount || 0} 张</b><span class="doom-stat-note">消耗区另散失 ${deathLoss?.pocketLost || 0} 张${token.lost > 0 ? ` · 散装物资估值损失 ${token.lost.toLocaleString()}` : ''}</span></div>
            <div class="doom-stat"><span class="ds-k">抢运回基地</span><b class="ds-v good">${savedN} 张</b><span class="doom-stat-note">安全格占用 ${safeUsed()}/${safeCap()}</span></div>
          </div>
          ${battleReviewHTML(token)}
          ${xpRow}
          ${uiDisclosure({label:'物资明细与保留规则',className:'doom-details',content:`
            <div class="doom-details-body">
              ${lossDetails}
              <p class="ov-note doom-material-note">散装物资估值损失：<b>${token.lost.toLocaleString()}</b>（不含卡牌）。<br>散装物资散失：${token.looseItems || '无'}。资源卡按卡牌清单计数。${token.savedResources ? `<br>已抢运资源卡：${token.savedResources}。` : ''}</p>
              ${token.saved.length
                ? `<div class="doom-loot"><p class="doom-loot-h">${esc(token.partnerName)}抢运回基地</p><div class="doom-cards">${token.saved.slice(0, 6).map((s, i) =>
                    `<span class="doom-card" style="--i:${i}">${SDT.Cards.cardHTML(s.card, 'sm')}</span>`).join('')}${token.saved.length > 6 ? `<span class="doom-more">还有 ${token.saved.length - 6} 张</span>` : ''}</div></div>`
                : (token.hadCards ? '<p class="ov-note">安全格里没有卡牌。把卡存进背包安全格（基地用口粮升级），倒下时才抢得回来。</p>' : '')}
              <p class="ov-note">木材、口粮、钥匙资源卡入基地仓库后，需在仓库“使用”才折入基地材料数字；散装木材与口粮仅在成功撤离时直接折入。</p>
            </div>`})}
          <div class="doom-btns"><button class="ov-btn" data-act="goBase">回基地</button><button class="ov-btn ok" data-act="again">再出发</button></div>
        </div>`, 'doom');
      UI.act('goBase', () => runtime.openBaseHub('deploy'));
      UI.act('again', () => runtime.openBaseHub('deploy'));
      UI.refresh(game);
      return true;
    };
    return runTerminalSettlement({
      token, current, game, UI, finish,
      command: 'run.death', retryAct: 'retryTerminalDeath',
      slotId: token.slotId, extraPayload: { deathClass: token.deathClass },
      terminalCommands,
    });
  }

  return { doDeath };
}
