/* Synchronous Agent command routing and completion tracking. Shared by the eager facade and lazy runner. */
import { normalizeAction, actionId } from './agent.protocol.js';
import { findUiElement } from './agent.surface.js';
import { bindObservedAction, getObservedActionTarget, invokeUiAction } from '../ui/action-dispatch.js';
import { markUiFailure } from './agent.state.js';
import { moveTo, reenterCell } from '../run/game.run.flow.js';
import { startNewGame, game, getActiveSlot } from '../run/game.session.js';

const isThenable = (v) => v && typeof v.then === 'function';
// Promise 只留在内部；act 的受理结果仍可直接 JSON.stringify。
const completions = new WeakMap();
const commandContext = () => [getActiveSlot(), game.discoveredPairs, game.nestRunes,
  game.runActive, game.nestActive];
const sameContext = (context) => {
  const current = commandContext();
  return context.every((value, i) => value === current[i]);
};
const commandError = (id, error) => ({ ok: false, id, code: 'ACTION_THREW', message: String(error?.message || error) });
function completedResult(value, id) {
  if (value === false || value?.ok === false) {
    return { ok: false, id, code: String(value?.code || 'ACTION_REJECTED'),
      message: String(value?.message || '命令被引擎拒绝') };
  }
  return { ok: true, id }; // true / void 及旧命令的其他返回值保持兼容
}
function commandResult(value, id, action) {
  if (!isThenable(value)) return completedResult(value, id);
  const accepted = { ok: true, id, async: true, completed: false };
  const completion = { active: true, context: commandContext(), promise: null };
  // 当场绑定拒绝处理；即使只调用 act 而不调用 step，也没有裸 rejection。
  completion.promise = Promise.resolve(value).then(value => {
    // enterSlot 自身会在 await 后合法换档/换局。仅该真实入口可交回完成瞬间的凭据；
    // 核目标档位与当前身份，不能把别的命令返回的同形对象当作切局授权。
    const proof = value?.commandContext;
    if (value?.ok === true && action?.type === 'ui' && action.name === 'enterSlot' && proof) {
      const fields = ['slot', 'runToken', 'nestToken', 'runActive', 'nestActive'];
      const next = fields.map(key => proof[key]);
      if (fields.every(key => Object.hasOwn(proof, key)) && proof.slot === Number(action.params?.slot)
        && sameContext(next)) completion.context = next;
      else return { ok: false, id, code: 'CONTEXT_CHANGED', message: '进入档位的完成凭据已失效' };
    }
    return completedResult(value, id);
  }, error => commandError(id, error));
  completions.set(accepted, completion);
  return accepted;
}
async function awaitCommand(accepted, options) {
  const completion = completions.get(accepted);
  if (!completion) return accepted;
  const requested = options.commandTimeoutMs;
  const timeoutMs = Number.isFinite(requested) && requested > 0 ? requested : 20000;
  let timer, onAbort;
  try {
    const result = await Promise.race([completion.promise, new Promise(resolve => {
      timer = setTimeout(() => resolve({ ok: false, id: accepted.id, async: true, completed: false,
        code: 'COMMAND_TIMEOUT', message: '命令仍未完成；自动驱动已停止，不能立即重派' }), timeoutMs);
    }), new Promise(resolve => {
      onAbort = () => resolve({ ok: false, id: accepted.id, code: 'RUN_CANCELLED', completed: false });
      options.signal?.addEventListener('abort', onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
    })]);
    if (!sameContext(completion.context)) return { ok: false, id: accepted.id, async: true,
      completed: false, code: 'CONTEXT_CHANGED', message: '对局归属已改变，丢弃旧命令结果' };
    return result;
  } finally {
    completion.active = false;
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', onAbort);
  }
}

function act(input) {
  const norm = normalizeAction(input);
  if (!norm.ok) return { ok: false, code: norm.code, message: norm.message };
  const action = norm.action;
  const observedTarget = getObservedActionTarget(input);
  if (observedTarget) bindObservedAction(action, observedTarget);
  const id = actionId(action);
  const context = commandContext();
  const page = document.getElementById('ovBody')?.firstChild;
  const title = document.getElementById('ovTitle')?.textContent;
  const button = action.type === 'ui' ? findUiElement(action.name, action.params) : null;
  const rememberFailure = (out) => {
    if (!out.ok && sameContext(context) && page === document.getElementById('ovBody')?.firstChild
      && title === document.getElementById('ovTitle')?.textContent
      && (!button || button === findUiElement(action.name, action.params))
      && (action.type === 'ui' || action.type === 'sys')) {
      markUiFailure({ id, params: action.params || {}, ...(action.args ? { args: [...action.args] } : {}) });
    }
  };
  try {
    const out = dispatch(action, id, observedTarget);
    const completion = completions.get(out);
    if (completion) {
      completion.promise = completion.promise.then(result => {
        if (completion.active && sameContext(completion.context)) rememberFailure(result);
        return { ...result, async: true, completed: true };
      });
    } else {
      rememberFailure(out);
    }
    return out;
  } catch (error) {
    // 既有命令面抛错不外溢：驱动方拿到结构化失败换动作即可。
    // 抛错同样记失败记忆（09-26 修复：漏记会让策略在同一钮上连点到熔断）并上报
    // console.error——批跑错误桶能抓到现场
    const msg = String(error?.message || error);
    rememberFailure({ ok: false });
    console.error(`[agent.act] ${id} 抛错: ${msg}`);
    return { ok: false, id, code: 'ACTION_THREW', message: msg };
  }
}

function dispatch(action, id, observedTarget) {
  switch (action.type) {
    case 'ui': {
      // 合成动作（对应真实关闭机制）：卡牌特写点背景关闭 / closeTopOverlayByEsc 同链关层
      if (action.name === 'czClose') {
        const backdrop = /** @type {HTMLElement | null} */ (document.querySelector('#cardZoom .cz-backdrop'));
        if (!backdrop) return { ok: false, id, code: 'UI_ACTION_UNAVAILABLE', message: '卡牌特写未打开' };
        backdrop.click();
        return { ok: true, id };
      }
      if (action.name === 'closeOverlay') {
        const UI = window.SDT?.UI;
        const closed = UI?.closeTopOverlayByEsc?.();
        return closed ? { ok: true, id } : { ok: false, id, code: 'OVERLAY_NOT_CLOSABLE', message: '当前弹层是必选流程，不能关闭' };
      }
      const el = observedTarget || findUiElement(action.name, action.params);
      if (!el) return { ok: false, id, code: 'UI_ACTION_UNAVAILABLE', message: `当前页面没有可点的 ${id}` };
      const UI = window.SDT?.UI;
      const result = invokeUiAction(UI, el, { expected:action });
      if (result.ok) return commandResult(result.value, id, action);
      if (result.reason === 'unavailable') return { ok:false, id, code:'UI_ACTION_UNAVAILABLE', message:'来源动作已失效或不可操作' };
      if (typeof el.click === 'function') { el.click(); return { ok: true, id, via: 'click' }; }
      return { ok: false, id, code: 'UI_ACTION_UNHANDLED', message: `${id} 没有注册回调` };
    }
    case 'move': {
      const out = commandResult(moveTo(action.li, action.idx), id);
      return out.code === 'ACTION_REJECTED' ? { ...out, code: 'MOVE_REJECTED', message: '目标不是合法相邻节点或当前不可移动' } : out;
    }
    case 'battle': {
      if (action.name === 'pickHandSelect' || action.name === 'skipHandSelect') {
        const selection = window.SDT?.Battle?.getSnapshot?.()?.handSelecting;
        if (!selection) return { ok: false, id, code: 'HAND_SELECTION_STALE', message: '当前手牌选择已结束' };
        if (action.name === 'pickHandSelect' && !selection.candidateUids?.includes(action.args[0])) {
          return { ok: false, id, code: 'HAND_SELECTION_UNAVAILABLE', message: '该牌已不是当前合法候选' };
        }
        if (action.name === 'skipHandSelect' && selection.canCancel !== true) {
          return { ok: false, id, code: 'HAND_SELECTION_MANDATORY', message: '当前手牌选择不能跳过' };
        }
      }
      const cmd = window.SDT?.Battle?.commands?.[action.name];
      if (typeof cmd !== 'function') return { ok: false, id, code: 'BATTLE_NOT_READY', message: '战斗模块未加载或命令不存在' };
      const result = cmd(...action.args);
      return commandResult(result, id);
    }
    case 'sys': {
      if (action.name === 'startGame') return commandResult(startNewGame(), id);
      if (action.name === 'reenter') {
        return reenterCell() ? { ok: true, id } : { ok: false, id, code: 'REENTER_REJECTED', message: '当前不可重开节点' };
      }
      if (action.name === 'openBackpack') {
        // 走 game.debug 挂载的 showBackpack（boot 无条件赋值）。调用后校验背包页
        // 真的开了（closeBag 上面）——showBackpack 对非法 state 会静默返回，
        // 不校验会让策略误以为成功、反复空开（3s 失败记忆兜底防死循环）
        const fn = window.SDT?.game?.debug?.showBackpack;
        if (typeof fn !== 'function') return { ok: false, id, code: 'BACKPACK_UNAVAILABLE', message: 'showBackpack 未挂载' };
        fn();
        const opened = !!window.SDT?.game?.debug && !!document.querySelector('#ovBody [data-act="closeBag"]');
        return opened
          ? { ok: true, id }
          : { ok: false, id, code: 'BACKPACK_REJECTED', message: `开背包被拒（state=${window.SDT?.game?.state}）` };
      }
      if (action.name === 'discardCard') {
        const ok = action.args?.[1] != null
          ? window.SDT.game?.discardCard?.(action.args[0], false, action.args[1])
          : window.SDT.game?.discardCard?.(action.args?.[0]);
        return ok ? { ok: true, id } : { ok: false, id, code: 'DISCARD_REJECTED', message: '丢弃失败（卡不存在/初始牌保护/需先开背包）' };
      }
      return { ok: true, id };   // noop
    }
    default:
      return { ok: false, id, code: 'ACTION_TYPE_UNKNOWN', message: '未知动作类型' };
  }
}


export { act, completions, commandContext, sameContext, awaitCommand };
