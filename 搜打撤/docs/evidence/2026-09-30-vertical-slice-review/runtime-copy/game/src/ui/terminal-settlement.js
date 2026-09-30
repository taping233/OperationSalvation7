/* terminal-settlement.js —— 终局安全提交编排（death / abandon 共用）。
 *
 * 09-29 jscpd 收敛批（PENDING #12 档一）：game.session.death.js 与 game.menu.js
 * 原各自复制同一套「终局结算未保存 → 重试」编排（25 行×2），差异仅
 * command / retryAct / payload 附加字段 / finish 是否透传 levelsGained。
 * finish 由调用方包装以抹平参数差异；terminalCommands 由调用方注入
 * （menu 允许为空，此时走「服务不可用」重试分支）。
 * UI 走参数注入（与 game.menu 控制器同契约，terminal-settlement.test 依赖
 * mock UI 通道；勿改回顶层 window.SDT 解引用——facade-snapshot-drift 守卫）。
 */
import { esc } from '../core/shared.js';

export function runTerminalSettlement({ token, current, game, UI, finish, command, retryAct, slotId, extraPayload, terminalCommands }) {
  const showRetry = message => {
    if (!current()) return;
    token.busy = false;
    token.promise = null;
    UI.showOverlay('[[icon:cross]] 终局结算未保存', `<p class="ov-note">${esc(message || '基地与对局尚未完成结算，原对局仍保留。')}</p><button class="ov-btn ok" data-act="${retryAct}">重试结算</button>`);
    UI.act(retryAct, () => { if (current() && !token.busy) return run(); });
    UI.refresh(game);
  };
  const run = async () => {
    if (!current() || token.busy) return false;
    token.busy = true;
    token.promise = (async () => {
      try {
        if (token.ephemeral) {
          const projected = terminalCommands.projectEphemeral({ command, cards: token.cards, ...extraPayload });
          return finish(projected?.levelsGained);
        }
        if (!terminalCommands) { showRetry('终局安全提交服务不可用'); return false; }
        if (!token.attempt) {
          const created = await terminalCommands.createAttempt({ ...(slotId !== undefined ? { slotId } : {}), command, cards: token.cards, ...extraPayload });
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
