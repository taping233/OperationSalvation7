// @ts-check
/* terminal-settlement.js —— 终局安全提交编排（death / abandon 共用）。
 *
 * 09-29 jscpd 收敛批（PENDING #12 档一）：game.session.death.js 与 game.menu.js
 * 原各自复制同一套「终局结算未保存 → 重试」编排（25 行×2），差异仅
 * command / retryAct / payload 附加字段 / finish 是否透传 levelsGained。
 * finish 由调用方包装以抹平参数差异；terminalCommands 由调用方注入
 * （menu 允许为空，此时直接走失败重试页）。
 * UI 走参数注入（与 game.menu 控制器同契约，terminal-settlement.test 依赖
 * mock UI 通道；勿改回顶层 window.SDT 解引用——facade-snapshot-drift 守卫）。
 */
import { esc } from '../core/shared.js';

/** 终局安全提交编排的注入契约（与 game.menu 控制器同源）。
 * @param {object} p
 * @param {{busy: boolean, promise: (Promise<boolean>|null), ephemeral?: *, attempt?: *, cards?: *}} p.token
 * @param {() => boolean} p.current  终局态仍成立的守卫（失效即放弃后续提交与提示）
 * @param {() => boolean} [p.finishCurrent]  已提交结果仍属于当前对局的守卫；允许恢复结果呈现
 * @param {object} p.game  传给 UI.refresh 的对局对象
 * @param {{el?: {ovBody?: HTMLElement}, showOverlay: (title: string, html: string) => void, act: (name: string, handler: () => void) => void, refresh: (game: object) => void}} p.UI
 * @param {(levelsGained?: *) => *} p.finish
 * @param {string} p.command
 * @param {string} p.retryAct
 * @param {(number|string)} [p.slotId]
 * @param {object} [p.extraPayload]  追加进 createAttempt/projectEphemeral 的附加字段
 * @param {?({projectEphemeral: (input: object) => *, createAttempt: (input: object) => Promise<{ok: boolean, message?: string, replay?: boolean, attempt?: *, receipt?: {output?: {levelsGained?: number}}}>, commitAttempt: (attempt: *) => Promise<{ok: boolean, message?: string, receipt?: {output?: {levelsGained?: number}}}>})} p.terminalCommands
 */
export function runTerminalSettlement({ token, current, finishCurrent = current, game, UI, finish, command, retryAct, slotId, extraPayload, terminalCommands }) {
  /** @type {*} */
  let completedLevels;
  const resultCurrent = () => current() || finishCurrent();
  /** @type {(message?: string, presentation?: boolean) => void} */
  const showRetry = (message, presentation = false) => {
    if (!(presentation ? resultCurrent() : current())) return;
    token.busy = false;
    token.promise = null;
    // 2026-10-03 老板（SYS-10 存档失败提示人话化）：失败页固定补两件事——进度保留在哪、重试为什么安全
    //（不重复扣牌/发奖由 journal 收据幂等保证，tests/terminal-persistence.test.js 三失败点矩阵钉死）；
    // 刷新兜底是因为待恢复事务会由恢复流程自动续完，普通失败则对局档原样保留。
    UI.showOverlay(presentation ? (token.ephemeral ? '结算已完成' : '结算已保存') : '[[icon:cross]] 终局结算未保存', `<p class="ov-note">${esc(message || '基地与对局尚未完成结算，原对局仍保留。')}</p>` +
      (presentation ? '<p class="ov-note">本次结算已经完成，重试只会重新显示结果，不会再次扣牌或发奖。</p>' :
        '<p class="ov-note">你的对局进度和能抢运的卡牌都还保留在本档位里，不会丢失；下面重试不会重复扣牌、也不会重复发奖。若暂时重试不成，退出游戏再进入也能继续。</p>') +
      `<button class="ov-btn ok" data-terminal-retry data-act="${retryAct}">${presentation ? '重试查看结算' : '重试结算'}</button>` +
      '<p class="ov-note" data-terminal-retry-status role="status" aria-live="polite"></p>');
    const button = /** @type {HTMLButtonElement} */ (UI.el?.ovBody?.querySelector('button[data-terminal-retry]'));
    const status = /** @type {HTMLElement} */ (UI.el?.ovBody?.querySelector('[data-terminal-retry-status]'));
    UI.act(retryAct, () => {
      const overlay = /** @type {HTMLElement} */ (button?.closest('#overlay'));
      if (!(presentation ? resultCurrent() : current()) || token.busy ||
          (button && (!button.isConnected || !UI.el?.ovBody?.contains(button) ||
            (overlay && (overlay.hidden || overlay.classList.contains('closing')))))) return false;
      // Both death and abandon reuse native button states; transaction ownership stays below.
      if (button && button instanceof HTMLButtonElement) {
        button.disabled = true;
        button.setAttribute('aria-busy', 'true');
        button.textContent = presentation ? '正在打开结果…' : '正在结算…';
      }
      if (status) status.textContent = presentation ? '正在重新显示结算，请稍候…' : '正在保存结算，请稍候…';
      if (presentation) {
        token.busy = true;
        token.promise = present(completedLevels);
        return token.promise;
      }
      return run();
    });
    UI.refresh(game);
  };
  /** @param {*} levels */
  const present = async levels => {
    if (!resultCurrent()) return false;
    completedLevels = levels;
    try {
      const result = await finish(levels);
      if (result === false && resultCurrent()) showRetry('结算结果暂时无法显示，请重试查看。', true);
      return result;
    } catch (error) {
      console.error('[terminal] 已完成结算的结果呈现失败：', error);
      showRetry('结算结果暂时无法显示，请重试查看。', true);
      return false;
    }
  };
  const run = async () => {
    if (!current() || token.busy) return false;
    token.busy = true;
    token.promise = (async () => {
      try {
        if (token.ephemeral) {
          // 契约：ephemeral 分支的 terminalCommands 由调用方保证非空（menu 空值走不了 ephemeral）；类型收窄声明该契约。
          const commands = /** @type {NonNullable<typeof terminalCommands>} */ (terminalCommands);
          const projected = commands.projectEphemeral({ command, cards: token.cards, ...extraPayload });
          return present(projected?.levelsGained);
        }
        // 2026-10-03 老板（SYS-10）：「终局安全提交服务不可用」是实现术语，玩家读不懂——改说人话，进度说明由失败页固定行交代。
        if (!terminalCommands) { showRetry('结算通道暂时没有就绪，稍等片刻再点重试即可'); return false; }
        if (!token.attempt) {
          const created = await terminalCommands.createAttempt({ ...(slotId !== undefined ? { slotId } : {}), command, cards: token.cards, ...extraPayload });
          if (!current()) return false;
          if (!created.ok) { showRetry(created.message); return false; }
          if (created.replay) return present(created.receipt?.output?.levelsGained || 0);
          token.attempt = created.attempt;
        }
        const committed = await terminalCommands.commitAttempt(token.attempt);
        if (!current()) return false;
        if (!committed.ok) { showRetry(committed.message); return false; }
        return present(committed.receipt?.output?.levelsGained || 0);
      } catch (error) {
        // 2026-10-03 老板（SYS-10）：意外异常不再把原始 message 直透玩家（注入实测英文 QuotaExceededError 裸露面板），人话兜底+控制台留痕。
        console.error('[terminal] 终局结算意外失败：', error);
        showRetry('结算时遇到意外问题，你的进度没有丢失，请点重试');
        return false;
      }
    })();
    return token.promise;
  };
  return run();
}
