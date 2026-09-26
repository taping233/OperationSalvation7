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
import { findUiElement, collectActionKeys, overlayVisible } from './agent.surface.js';
import { observe, settleSignature, markUiFailure } from './agent.state.js';
import { isTurbo } from './agent.turbo.js';
import { setDriver } from './agent.recorder.js';
import { moveTo, reenterCell } from '../run/game.run.flow.js';
import { startNewGame, game } from '../run/game.session.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const isThenable = (v) => v && typeof v.then === 'function';
// 高精度时钟（Date.now 在 Windows 粒度 15.6ms，够不着 3ms quiet）
const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
// 亚毫秒让位：Node 走 setImmediate（0.1ms 级），浏览器回退 setTimeout(0)
const defer = () => (typeof globalThis.setImmediate === 'function')
  ? new Promise(resolve => globalThis.setImmediate(resolve))
  : new Promise(resolve => setTimeout(resolve, 0));

function act(input) {
  const norm = normalizeAction(input);
  if (!norm.ok) return { ok: false, code: norm.code, message: norm.message };
  const action = norm.action;
  const id = actionId(action);
  try {
    const out = dispatch(action, id);
    // ui/sys 被引擎拒绝 → 记失败键回观察面（同页面内策略绕开，换页自动失效）
    if (!out.ok && (action.type === 'ui' || action.type === 'sys')) {
      markUiFailure({ id, params: action.params || {} });
    }
    return out;
  } catch (error) {
    // 既有命令面抛错不外溢：驱动方拿到结构化失败换动作即可。
    // 抛错同样记失败记忆（09-26 修复：漏记会让策略在同一钮上连点到熔断）并上报
    // console.error——批跑错误桶能抓到现场
    const msg = String(error?.message || error);
    if (action.type === 'ui' || action.type === 'sys') markUiFailure({ id, params: action.params || {} });
    console.error(`[agent.act] ${id} 抛错: ${msg}`);
    return { ok: false, id, code: 'ACTION_THREW', message: msg };
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
      if (action.name === 'discardCard') {
        const ok = window.SDT.game?.discardCard?.(action.args?.[0]);
        return ok ? { ok: true, id } : { ok: false, id, code: 'DISCARD_REJECTED', message: '丢弃失败（卡不存在/初始牌保护/需先开背包）' };
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
  // turbo 性能档（09-26 数量级压缩三件套）：
  // ① 轮询走 setImmediate 亚毫秒让位（Windows setTimeout 被钳到 ~15ms 是旧慢根源）
  // ② 静止期只算轻量签名（无 label DOM 扫描），observe 只在判定时做一次
  // ③ quiet 3ms——turbo 下演出全短路，状态传播只剩 1-2 个宏任务
  const quiet = quietMs || (turbo ? 1 : 40);
  const timeout = timeoutMs || (turbo ? 8000 : 20000);
  const deadline = nowMs() + timeout;
  let last = settleSignature();
  let stableSince = nowMs();
  let iter = 0;
  let modalGapSince = 0;
  for (;;) {
    // 先让位再判定（09-26 关键修复）：判定在 await 前时 quiet=1ms 会被 settleSignature
    // 自身的 DOM 扫描耗时吃掉 → 首轮零 defer 返回 → 事件循环不轮转 → 0ms 揭晓/
    // 转场 timer 永远轮不到（瞬态页死锁根因）。每轮先 defer 保证 timers 有机会跑。
    await (turbo ? defer() : sleep(pollMs || 30));
    // 签名降频：defer 间隙只有定时器能改 DOM，签名最多晚 3 轮（<1ms）被发现，
    // 但 75% 的 DOM 扫描省掉了（单局大头）
    const sig = (iter++ % 4 === 0) ? settleSignature() : last;
    const t = nowMs();
    if (sig !== last) { last = sig; stableSince = t; }
    else if (t - stableSince >= quiet) {
      // 瞁态①「modal 但弹层还没挂上/刚摘掉」（showRunTransition 等 0ms 定时器窗口）——
      // 快 settle 会抓到这个空档让 decide 拿到零动作误停，必须等；但超过 300ms 的
      // modal 空档是死态（cleanup 没回标题等历史坑会空等 8s×每步）——限时放行
      const modalGap = game.state === 'modal' && !overlayVisible();
      if (modalGap) {
        if (!modalGapSince) modalGapSince = t;
      } else {
        modalGapSince = 0;
      }
      const modalGapExpired = modalGap && (t - modalGapSince > 300);
      // 判据②只防「弹层开着但按钮还没渲染出来」：overlay 本就关着（地图相/战斗相/
      // 标题相——动作来自 move/battle/sys 而非 data-act）直接放行
      if ((!modalGap || modalGapExpired) && (allowEmpty || collectActionKeys().length > 0 || !overlayVisible())) {
        return { ok: true, stalled: false, obs: observe() };
      }
      // 弹层开着但动作面空 / modal 空档：继续等渲染
    }
    if (t >= deadline) return { ok: false, stalled: true, obs: observe() };
  }
}

// 单步：观察 → 决策 → 执行 → 等动作面推进 → 等稳。decide 可以是同步或 async。
// 「等动作面推进」是防重复点击的关键：hideOverlay 是 210ms 淡出、转场页有数百 ms 生命期，
// 这些窗口里旧按钮仍在面上，不等变化就会被驱动反复点同一钮。
async function step(decide, options = {}) {
  // preSettled：上一步尾部已 settle 且步间无外部驱动（autoRun 连跑）——跳过前置等待省 quiet 窗
  // carryObs：上一步尾部 settle 的观察——步间只有微任务让位（定时器不跑），状态未变，
  // 直接复用省掉每步的第二次 observe（DOM label 扫描是步耗时大头）
  const first = options.preSettled
    ? { ok: true, stalled: false, obs: options.carryObs || null }
    : await waitSettle(options);
  const obs = first.obs || observe();
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
    const deadline = nowMs() + (isTurbo() ? 40 : 1500);
    while (settleSignature() === before && nowMs() < deadline) await (isTurbo() ? defer() : sleep(40));
  }
  const settled = res.ok ? await waitSettle(options) : { ok: true, stalled: false, obs };
  return { obs: settled.obs || observe(), action: res.action || decision, id: res.id, res, done: false,
    settleStalled: settled.stalled === true };
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
  const seenPositions = new Set();   // 本次出行踩过的 (层,格) 集合——无进展守卫
  let noProgressSteps = 0;
  let stepErrors = 0;                // 单步异常自愈：连续 5 次错误停局
  let failKey = '';                   // 连续同 id 失败熔断（瞬态页失败键无限重试的最后防线）
  let failCount = 0;
  let stopReason = 'max-steps';       // 熔断原因入记录（09-26：弃局死因必须可见）
  try {
    for (let i = 0; i < maxSteps; i++) {
      if (runCancelled) { stopReason = 'cancelled'; break; }
      let result;
      try {
        result = await step(decide, options);
      } catch (error) {
        // 异常自愈（09-26 机制）：单步抛错=跳过该步继续，错误进 trace；连续 5 次判局内风暴停局
        stepErrors += 1;
        const msg = String(error?.message || error);
        trace.push({ step: i, id: null, ok: false, phase: 'error', spin: 0, error: msg });
        onStep?.({ obs: { phase: 'error', actions: [], turn: -1, run: null },
          action: null, res: null, error: msg, done: false }, i);
        if (stepErrors >= 5) { stopReason = 'step-errors'; break; }
        continue;
      }
      stepErrors = 0;
      options.preSettled = true;   // 首步之后：上一步尾部已 settle，跳过前置等待
      options.carryObs = result.obs;
      // 位置键含战斗回合：战斗内 game.turn 静止，跨回合的同一动作（如每回合 endTurn）
      // 不是空转，不能进同键熔断
      const position = `${result.obs.turn}:${result.obs.phase}:${result.obs.battle?.turn ?? '-'}`;
      const isWait = result.action?.type === 'sys' && result.action?.name === 'noop';
      if (isWait) {
        // noop=明确等待（结算窗口）：独立计数、不碰熔断；持续卡死仍由 waitLimit 收口
        waitCount += 1;
        spinKey = ''; spinCount = 0;
        if (waitCount > waitLimit) { stopReason = 'wait-limit'; break; }
      } else if (result.res?.ok) {
        waitCount = 0;
        const spin = `${result.id || ''}:${JSON.stringify(result.action?.args ?? result.action?.params ?? null)}@${position}`;
        if (spin === spinKey) spinCount += 1;
        else { spinKey = spin; spinCount = 1; }
      } else {
        // 被引擎拒绝的动作不进同键熔断（09-26）：瞬态页上的 meta 失败键连点
        // 由失败记忆+TTL 管理，失败步清 spin 避免毫秒级假连击杀局
        waitCount = 0;
        spinKey = ''; spinCount = 0;
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
      trace.push({ step: i, id: result.id || null, ok: result.res?.ok ?? null, phase: result.obs.phase, spin: spinCount, stalled: result.settleStalled === true });
      onStep?.(result, i);
      if (result.obs.run?.active) seenRunActive = true;
      // 无进展守卫（09-26 收窄到地图相）：连续 60 步没踩上任何新 (层,格)——两格回环/
      // 门回环收口。只计 map 相：合法的多步弹层（商店/事件15+步）不误杀
      if (result.obs.run?.active && result.obs.phase === 'map') {
        const posKey = `${result.obs.run.layer ?? '?'}:${result.obs.run.node ?? '?'}`;
        if (seenPositions.has(posKey)) noProgressSteps += 1;
        else { seenPositions.add(posKey); noProgressSteps = 0; }
      }
      // 连续同 id 失败熔断（09-26）：瞬态页上失败键被 TTL 过期后重选、点失败、刷新 TTL
      // 的死循环——同 id 连续失败 ≥10 次收口（不依赖 sig/spin）
      if (result.res && result.res.ok === false && result.id) {
        if (result.id === failKey) failCount += 1; else { failKey = result.id; failCount = 1; }
      } else { failKey = ''; failCount = 0; }
      if (result.error) { stopReason = 'step-exception'; break; }
      if (result.done) { stopReason = 'decide-null'; break; }
      if (until?.(result)) { stopReason = 'until'; break; }
      if (!isWait && spinCount >= spinLimit) { stopReason = 'spin'; break; }
      if (stayCount >= stayLimit) { stopReason = 'stay'; break; }
      if (battleStall >= 40) { stopReason = 'battle-stall'; break; }
      if (noProgressSteps > 60) { stopReason = 'no-progress'; break; }
      if (failCount >= 10) { stopReason = 'fail-spin'; break; }
      // 二周期熔断：最近 8 步呈 X Y X Y X Y X Y 交替（A↔B 走位 / 走位↔弹层回环）即收口——
      // 通用兜底，任何策略的残余振荡都不再烧满 maxSteps。排除战斗阶段
      //（1 牌/回合的 endTurn 交替是合法节奏，战斗另有 battleStall 守卫）
      if (trace.length >= 8 && i >= 7) {
        const s = trace.slice(-8);
        if (s.every(t => t.phase !== 'battle')) {
          const k = s.map(t => `${t.id}|${t.phase}`);
          const alt2 = k[0] === k[2] && k[0] === k[4] && k[0] === k[6]
            && k[1] === k[3] && k[1] === k[5] && k[1] === k[7] && k[0] !== k[1];
          if (alt2) { stopReason = 'alt2-cycle'; break; }
        }
      }
      // 一局收口：见过对局进行中，之后回到无对局的空闲/标题/基地态即终
      if (seenRunActive && !result.obs.run?.active && ['idle', 'title', 'hub'].includes(result.obs.phase)) {
        stopReason = 'run-end';
        break;
      }
    }
  } finally {
    setDriver(previousDriver);   // 驱动标签只在本局生效，收口还原为 human
  }
  trace.stopReason = stopReason;
  return trace;
}

export { act, step, autoRun, waitSettle, stopRun };
