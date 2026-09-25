/* game.session.death.js —— 受击反馈与终局结算（自 game.session.js 拆出，2026-09-25）。
 * doDeath 的 terminal pending 流程：构造结算 token、两键提交（创建/重试/落库）、
 * 失败掠夺面板与熟练度结算。与会话存档互不反向依赖：会话侧经 createDeathSettlement
 * 工厂注入档位/代数/结算命令与背包抢运统计（battle.exec-play 同款手法），
 * 本模块不 import 任何 game.session.* 模块。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from '../core/shared.js';
import { characterName } from '../core/characters.js';

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
    if (game.hp <= 0) doDeath();
    UI.refresh(game);
  };

  function doDeath() {
    if (!game.runActive) return false;
    if (game.terminalPending) return game.terminalPending.promise || false;
    const slotId = getActiveSlot();
    const generation = nextTerminalGeneration();
    const why = game.surrenderedRun ? '你选择了撤离' : '你倒下了';
    const lost = game.inventory.reduce((a, b) => a + b.value * b.count, 0);
    const boxSafe = game.ownedCards.some(o => o.safe && o.card && o.card.id === pearlBoxId);
    const saved = cardStacks(true);
    const cards = game.ownedCards.filter(o => o.safe || (o.stored && boxSafe)).map(o => ({ card: o.card, count: 1 }));
    const token = { kind: 'death', generation, slotId, cards, deathClass: game.myClass, saved, lost, why, attempt: null, busy: false, promise: null, ephemeral: !slotId };
    game.terminalPending = token;
    game.state = 'terminalPending';

    const current = () => game.terminalPending === token && token.generation === getTerminalGeneration() && getActiveSlot() === token.slotId;
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
      SDT.Agent?.recorder?.recordRun('death', { why: token.why, savedCards: token.saved });   // 跑局统计（数据分析系统）
      SDT.Sound.sfx('defeat');
      SDT.Sound.music('title');
      if (token.ephemeral) {
        UI.log('[[icon:info]] 测试结算仅更新内存，没有写入基地存档', 'sys');
        announceLevelUps(levels);
      } else {
        announceLevelUps(levels);
        try { SDT.Meta.checkUnlocks(); } catch { /* 提交已完成，成就提示不能回滚终局 */ }
      }
      const savedN = token.saved.reduce((a, b) => a + b.count, 0);
      UI.log(savedN
        ? `<b>[[icon:skull]] ${token.why}……</b>[[icon:lock]] 宠物抢运回安全格中的 <b>${savedN}</b> 张卡牌，其余全部丢失`
        : `<b>[[icon:skull]] ${token.why}……</b>安全格里没有卡牌，全部战利品丢失`, 'warn');
      UI.showOverlay('[[icon:skull]] 撤离失败', `
        <div class="doom-panel">
          <p class="doom-sub">${token.why === '你倒下了' ? '生命归零 · 远征到此为止' : '战斗中撤离 · 视为失败'}</p>
          ${token.ephemeral ? '<p class="ov-note">开发测试档未选择存档槽；基地奖励仅暂存于内存。</p>' : ''}
          <div class="doom-stats">
            <div class="doom-stat" style="--i:0"><span class="ds-k">损失物资</span><b class="ds-v bad">${token.lost.toLocaleString()}</b></div>
            <div class="doom-stat" style="--i:1"><span class="ds-k">抢运回基地</span><b class="ds-v good">${savedN} 张</b></div>
            <div class="doom-stat" style="--i:2"><span class="ds-k">安全格占用</span><b class="ds-v">${safeUsed()}/${safeCap()}</b></div>
          </div>
          ${token.saved.length
            ? `<div class="doom-loot"><p class="doom-loot-h">[[icon:lock]] 宠物阿七抢运回基地</p><div class="doom-cards">${token.saved.slice(0, 6).map((s, i) =>
                `<span class="doom-card" style="--i:${i}">${SDT.Cards.cardHTML(s.card, 'sm')}</span>`).join('')}${token.saved.length > 6 ? `<span class="doom-more">还有 ${token.saved.length - 6} 张</span>` : ''}</div></div>`
            : '<p class="ov-note">安全格里没有卡牌——把卡存进背包安全格（基地用口粮升级），倒下时才抢得回来。</p>'}
          <div class="doom-btns"><button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button><button class="ov-btn ok" data-act="again">[[icon:skull]] 再出发</button></div>
        </div>`, 'doom');
      UI.act('goBase', () => { UI.hideOverlay(); runtime.openBaseHub('deploy'); });
      UI.act('again', () => { UI.hideOverlay(); runtime.openBaseHub('deploy'); });
      UI.refresh(game);
      return true;
    };
    const showRetry = message => {
      if (!current()) return;
      token.busy = false;
      token.promise = null;
      UI.showOverlay('[[icon:cross]] 终局结算未保存', `<p class="ov-note">${esc(message || '基地与对局尚未完成结算，原对局仍保留。')}</p><button class="ov-btn ok" data-act="retryTerminalDeath">重试结算</button>`);
      UI.act('retryTerminalDeath', () => { if (current() && !token.busy) return run(); });
      UI.refresh(game);
    };
    const run = async () => {
      if (!current() || token.busy) return false;
      token.busy = true;
      token.promise = (async () => {
        try {
          if (token.ephemeral) {
            const projected = terminalCommands.projectEphemeral({ command: 'run.death', cards: token.cards, deathClass: token.deathClass });
            return finish(projected.levelsGained);
          }
          if (!token.attempt) {
            const created = await terminalCommands.createAttempt({ slotId: token.slotId, command: 'run.death', cards: token.cards, deathClass: token.deathClass });
            if (!current()) return false;
            if (!created.ok) { showRetry(created.message); return false; }
            if (created.replay) return finish(created.receipt?.output?.levelsGained || 0);
            token.attempt = created.attempt;
          }
          const committed = await terminalCommands.commitAttempt(token.attempt);
          if (!current()) return false;
          if (!committed.ok) { showRetry(committed.message); return false; }
          return finish(committed.receipt?.output?.levelsGained || 0);
        } catch (error) { showRetry(error && error.message); return false; }
      })();
      return token.promise;
    };
    return run();
  }

  return { doDeath };
}
