/* ============================================================
 * agent.runner.js —— act() 动作路由 + settle 等待 + step/autoRun 循环
 *
 * act 全部走既有命令面，不模拟鼠标：
 *   ui     → UI._acts/_baseActs 回调（与点击分发同一张表），夹具退化 el.click()
 *   move   → run/game.run.flow 的 moveTo（相邻校验在引擎内）
 *   battle → SDT.Battle.commands 白名单命令
 *   sys    → startGame（标题起步）/ reenter（重开脚下格）
 * settle：签名连续两次不变且战斗非 busy 才算静止；turbo 下轮询间隔缩短。
 * ============================================================ */
import { normalizeAction, actionId } from './agent.protocol.js';
import { findUiElement } from './agent.surface.js';
import { observe, settleSignature } from './agent.state.js';
import { isTurbo } from './agent.turbo.js';
import { setDriver } from './agent.recorder.js';
import { moveTo, reenterCell } from '../run/game.run.flow.js';
import { startNewGame } from '../run/game.session.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isThenable = (v) => v && typeof v.then === 'function';

function act(input) {
  const norm = normalizeAction(input);
  if (!norm.ok) return { ok: false, code: norm.code, message: norm.message };
  const action = norm.action;
  const id = actionId(action);
  try {
    return dispatch(action, id);
  } catch (error) {
    // 既有命令面抛错不外溢：驱动方拿到结构化失败换动作即可
    return { ok: false, id, code: 'ACTION_THREW', message: String(error?.message || error) };
  }
}

function dispatch(action, id) {
  switch (action.type) {
    case 'ui': {
      // 合成动作（对应真实关闭机制）：卡牌特写点背景关闭 / closeTopOverlayByEsc 同链关层
      if (action.name === 'czClose') {
        const backdrop = document.querySelector('#cardZoom .cz-backdrop');
        if (!backdrop) return { ok: false, id, code: 'UI_ACTION_UNAVAILABLE', message: '卡牌特写未打开' };
        backdrop.click();
        return { ok: true, id };
      }
      if (action.name === 'closeOverlay') {
        const UI = window.SDT?.UI;
        const closed = UI?.closeTopOverlayByEsc?.();
        return closed ? { ok: true, id } : { ok: false, id, code: 'OVERLAY_NOT_CLOSABLE', message: '当前弹层是必选流程，不能关闭' };
      }
      const el = findUiElement(action.name, action.params);
      if (!el) return { ok: false, id, code: 'UI_ACTION_UNAVAILABLE', message: `当前页面没有可点的 ${id}` };
      const UI = window.SDT?.UI;
      const fn = UI?._acts?.[action.name] || UI?._baseActs?.[action.name];
      if (fn) {
        // 与 ovBody 点击分发同参：回调拿按钮 dataset（photo-zoom 源按钮多传元素）
        const result = el.hasAttribute('data-photo-zoom-source') ? fn(el.dataset, el) : fn(el.dataset);
        return { ok: true, id, async: isThenable(result) };
      }
      if (typeof el.click === 'function') { el.click(); return { ok: true, id, via: 'click' }; }
      return { ok: false, id, code: 'UI_ACTION_UNHANDLED', message: `${id} 没有注册回调` };
    }
    case 'move': {
      const ok = moveTo(action.li, action.idx);
      return ok ? { ok: true, id } : { ok: false, id, code: 'MOVE_REJECTED', message: '目标不是合法相邻节点或当前不可移动' };
    }
    case 'battle': {
      const cmd = window.SDT?.Battle?.commands?.[action.name];
      if (typeof cmd !== 'function') return { ok: false, id, code: 'BATTLE_NOT_READY', message: '战斗模块未加载或命令不存在' };
      const result = cmd(...action.args);
      return { ok: true, id, async: isThenable(result) };
    }
    case 'sys': {
      if (action.name === 'startGame') { startNewGame(); return { ok: true, id }; }
      if (action.name === 'reenter') {
        return reenterCell() ? { ok: true, id } : { ok: false, id, code: 'REENTER_REJECTED', message: '当前不可重开节点' };
      }
      return { ok: true, id };   // noop
    }
    default:
      return { ok: false, id, code: 'ACTION_TYPE_UNKNOWN', message: '未知动作类型' };
  }
}

// 静止等待：签名连续 quietMs 不变 + 动作面非空（或允许空）即视为 settle。
// 全程 cap 超时兜底——超时也返回当前观察值并标记 stalled，绝不无限挂起。
async function waitSettle({ quietMs = 0, pollMs = 0, timeoutMs = 0, allowEmpty = false } = {}) {
  const turbo = isTurbo();
  const quiet = quietMs || (turbo ? 10 : 40);
  const poll = pollMs || (turbo ? 10 : 30);
  const timeout = timeoutMs || (turbo ? 8000 : 20000);
  const deadline = Date.now() + timeout;
  let last = settleSignature();
  let stableSince = Date.now();
  for (;;) {
    await sleep(poll);
    const obs = observe();
    const now = Date.now();
    const sig = settleSignature();
    const settled = obs.settle && (allowEmpty || obs.actions.length > 0 || obs.phase === 'idle' || obs.phase === 'title');
    if (sig !== last) { last = sig; stableSince = now; continue; }
    if (settled && now - stableSince >= quiet) return { ok: true, stalled: false, obs };
    if (now >= deadline) return { ok: false, stalled: true, obs };
  }
}

// 单步：观察 → 决策 → 执行 → 等动作面推进 → 等稳。decide 可以是同步或 async。
// 「等动作面推进」是防重复点击的关键：hideOverlay 是 210ms 淡出、转场页有数百 ms 生命期，
// 这些窗口里旧按钮仍在面上，不等变化就会被驱动反复点同一钮。
async function step(decide, options = {}) {
  await waitSettle(options);
  const obs = observe();
  let decision;
  try {
    decision = await decide(obs);
  } catch (error) {
    return { obs, action: null, res: null, error: String(error?.message || error), done: true };
  }
  if (decision == null) return { obs, action: null, res: null, done: true };
  const before = settleSignature();
  const res = act(decision);
  const isWaitAction = decision?.type === 'sys' && decision?.name === 'noop';
  if (res.ok && !isWaitAction) {
    const deadline = Date.now() + (isTurbo() ? 400 : 1500);
    while (settleSignature() === before && Date.now() < deadline) await sleep(isTurbo() ? 15 : 40);
  }
  const settled = res.ok ? await waitSettle(options) : { ok: true, stalled: false, obs };
  return { obs: settled.obs || observe(), action: res.action || decision, id: res.id, res, done: false };
}

// 连续驱动一局：直到 decide 返回 null / maxSteps /（可选）runEnded 判定。
// 空转熔断：同一动作（含参数）连打且局面不动达到阈值即收口；另加同位置长驻守卫，
// 防 czClose↔inspectStack 之类二周期（id 交替、同 id 计数抓不到）。
let runCancelled = false;
function stopRun() { runCancelled = true; }

async function autoRun({ decide, maxSteps = 800, onStep, until, driver = 'auto', spinLimit = 6, stayLimit = 500, waitLimit = 60, ...options }) {
  const trace = [];
  const previousDriver = setDriver(driver);
  runCancelled = false;
  let seenRunActive = false;
  let spinKey = '';
  let spinCount = 0;
  let waitCount = 0;
  let stayKey = '';
  let stayCount = 0;
  let battleTurnKey = null;
  let battleStall = 0;
  try {
    for (let i = 0; i < maxSteps; i++) {
      if (runCancelled) break;
      const result = await step(decide, options);
      // 位置键含战斗回合：战斗内 game.turn 静止，跨回合的同一动作（如每回合 endTurn）
      // 不是空转，不能进同键熔断
      const position = `${result.obs.turn}:${result.obs.phase}:${result.obs.battle?.turn ?? '-'}`;
      const isWait = result.action?.type === 'sys' && result.action?.name === 'noop';
      if (isWait) {
        // noop=明确等待（结算窗口）：独立计数、不碰熔断；持续卡死仍由 waitLimit 收口
        waitCount += 1;
        spinKey = ''; spinCount = 0;
        if (waitCount > waitLimit) break;
      } else {
        waitCount = 0;
        const spin = `${result.id || ''}:${JSON.stringify(result.action?.args ?? result.action?.params ?? null)}@${position}`;
        if (spin === spinKey) spinCount += 1;
        else { spinKey = spin; spinCount = 1; }
      }
      // 战斗冻结守卫：战斗回合不前进的非 noop 步连续累计即收口（动作轮换躲得过同键熔断）
      if (!isWait && result.obs.phase === 'battle') {
        const bt = result.obs.battle?.turn;
        if (battleTurnKey != null && bt === battleTurnKey) battleStall += 1;
        else battleStall = 0;
        battleTurnKey = bt ?? battleTurnKey;
      } else {
        battleTurnKey = null;
        battleStall = 0;
      }
      if (position === stayKey) stayCount += 1;
      else { stayKey = position; stayCount = 1; }
      trace.push({ step: i, id: result.id || null, ok: result.res?.ok ?? null, phase: result.obs.phase, spin: spinCount });
      onStep?.(result, i);
      if (result.obs.run?.active) seenRunActive = true;
      if (result.error || result.done) break;
      if (until?.(result)) break;
      if ((!isWait && spinCount >= spinLimit) || stayCount >= stayLimit || battleStall >= 40) break;
      // 一局收口：见过对局进行中，之后回到无对局的空闲/标题/基地态即终
      if (seenRunActive && !result.obs.run?.active && ['idle', 'title', 'hub'].includes(result.obs.phase)) break;
    }
  } finally {
    setDriver(previousDriver);   // 驱动标签只在本局生效，收口还原为 human
  }
  return trace;
}

export { act, step, autoRun, waitSettle, stopRun };
