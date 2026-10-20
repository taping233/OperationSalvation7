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
import { observe, settleSignature, bustSigCache, markUiFailure } from './agent.state.js';
import { isTurbo } from '../core/turbo.js';
import { setDriver, getDriver, battleTick, battleActionTick, battleEnd, noteStopReason } from './agent.recorder.js';
import { moveTo, reenterCell } from '../run/game.run.flow.js';
import { startNewGame, game, getActiveSlot } from '../run/game.session.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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
// 高精度时钟（Date.now 在 Windows 粒度 15.6ms，够不着 3ms quiet）
const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
// 亚毫秒让位：Node 走 setImmediate（0.1ms 级）；浏览器回退走 MessageChannel 泵——
// setTimeout(0) 在后台标签被 Chrome 钳到 ~350ms/次（实机实测 10 次 3577ms），
// turbo 步进的 defer 全部吃节流会让每步膨胀到秒级；MessageChannel 不受 timer
// 节流（实机实测 10 次 1ms）。无 MessageChannel 的极简环境再退 setTimeout(0)
const channelPump = (typeof MessageChannel === 'function') ? (() => {
  let ch = null;
  const queue = [];
  return (resolve) => {
    if (!ch) {
      ch = new MessageChannel();   // eslint-disable-line no-undef
      ch.port1.onmessage = () => { const job = queue.shift(); if (job) job(); };
      ch.port1.start?.();
    }
    queue.push(resolve);
    ch.port2.postMessage(null);
  };
})() : null;
const defer = () => (typeof globalThis.setImmediate === 'function')
  ? new Promise(resolve => globalThis.setImmediate(resolve))
  : (channelPump ? new Promise(channelPump) : new Promise(resolve => setTimeout(resolve, 0)));

async function awaitCommand(accepted, options) {
  const completion = completions.get(accepted);
  if (!completion) return accepted;
  const requested = options.commandTimeoutMs;
  const timeoutMs = Number.isFinite(requested) && requested > 0 ? requested : 20000;
  let timer;
  try {
    const result = await Promise.race([completion.promise, new Promise(resolve => {
      timer = setTimeout(() => resolve({ ok: false, id: accepted.id, async: true, completed: false,
        code: 'COMMAND_TIMEOUT', message: '命令仍未完成；自动驱动已停止，不能立即重派' }), timeoutMs);
    })]);
    if (!sameContext(completion.context)) return { ok: false, id: accepted.id, async: true,
      completed: false, code: 'CONTEXT_CHANGED', message: '对局归属已改变，丢弃旧命令结果' };
    return result;
  } finally {
    completion.active = false;
    clearTimeout(timer);
  }
}

function act(input) {
  const norm = normalizeAction(input);
  if (!norm.ok) return { ok: false, code: norm.code, message: norm.message };
  const action = norm.action;
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
      markUiFailure({ id, params: action.params || {} });
    }
  };
  try {
    const out = dispatch(action, id);
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
        return commandResult(result, id, action);
      }
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
async function waitSettle({ quietMs = 0, pollMs = 0, timeoutMs = 0, allowEmpty = false, preStable = false } = {}) {
  const turbo = isTurbo();
  // turbo 性能档（09-26 数量级压缩三件套）：
  // ① 轮询走 setImmediate 亚毫秒让位（Windows setTimeout 被钳到 ~15ms 是旧慢根源）
  // ② 静止期只算轻量签名（无 label DOM 扫描），observe 只在判定时做一次
  // ③ quiet 3ms——turbo 下演出全短路，状态传播只剩 1-2 个宏任务
  const prof = globalThis.__stepProf;
  // preStable（09-26 耗时②）：act 轮询已确认「签名 3ms 未变 + busy/queue 全空」——
  // 严格强于 quiet=1ms 判据，尾部稳定窗直接放行（省一次 1ms+ 等待/步）；
  // modalGap/动作面非空两道守卫仍生效，瞬态页死锁防护不变
  const quiet = preStable ? 0 : (quietMs || (turbo ? 1 : 40));
  const timeout = timeoutMs || (turbo ? 8000 : 20000);
  const deadline = nowMs() + timeout;
  let last = settleSignature();
  const wsEntry = prof ? nowMs() : 0;
  let stableSince = nowMs();
  let iter = 0;
  let modalGapSince = 0;
  for (;;) {
    // 先让位再判定（09-26 关键修复）：判定在 await 前时 quiet=1ms 会被 settleSignature
    // 自身的 DOM 扫描耗时吃掉 → 首轮零 defer 返回 → 事件循环不轮转 → 0ms 揭晓/
    // 转场 timer 永远轮不到（瞬态页死锁根因）。每轮先 defer 保证 timers 有机会跑。
    const td0 = prof ? nowMs() : 0;
    await (turbo ? defer() : sleep(pollMs || 30));
    if (prof) prof.deferMs += nowMs() - td0;
    // 签名降频：defer 间隙只有定时器能改 DOM，签名最多晚 3 轮（<1ms）被发现，
    // 但 75% 的 DOM 扫描省掉了（单局大头）
    const tsp = prof ? nowMs() : 0;
    const sig = (iter++ % 4 === 0) ? settleSignature() : last;
    if (prof) { prof.wsSigMs += nowMs() - tsp; if (iter % 4 === 1) prof.wsSigCalls += 1; }
    const t = nowMs();
    if (sig !== last) { last = sig; stableSince = t; if (prof) prof.wsResets += 1; }
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
        if (prof) { prof.wsOk += 1; prof.wsDurMs += nowMs() - wsEntry; prof.wsIters += iter; }
        return { ok: true, stalled: false, obs: observe() };
      }
      // 弹层开着但动作面空 / modal 空档：继续等渲染
      if (prof) { prof.wsWaitKeys += 1; if (modalGap && !modalGapExpired) prof.wsBlockModal += 1; else prof.wsBlockKeys += 1; }
    }
    if (t >= deadline) { if (prof) prof.wsTimeout += 1; return { ok: false, stalled: true, obs: observe() }; }
  }
}

// 单步：观察 → 决策 → 执行 → 等动作面推进 → 等稳。decide 可以是同步或 async。
// 「等动作面推进」是防重复点击的关键：hideOverlay 是 210ms 淡出、转场页有数百 ms 生命期，
// 这些窗口里旧按钮仍在面上，不等变化就会被驱动反复点同一钮。
async function step(decide, options = {}) {
  const decisionRun = runAbort;
  const decisionCancelled = () => decisionRun !== runAbort || decisionRun?.signal.aborted === true;
  const cancelled = () => ({ obs: observe(), action: null,
    res: { ok: false, code: 'RUN_CANCELLED', message: '自动驱动已停止，未执行旧决策' },
    done: true, stopReason: 'cancelled' });
  // 分相计时探针（--profile 开）：settle/decide/act/交棒四段耗时入 globalThis.__stepProf，
  // 均耗时优化先量再改
  const prof = globalThis.__stepProf;
  const t0 = prof ? nowMs() : 0;
  // preSettled：上一步尾部已 settle 且步间无外部驱动（autoRun 连跑）——跳过前置等待省 quiet 窗
  // carryObs：上一步尾部 settle 的观察——步间只有微任务让位（定时器不跑），状态未变，
  // 直接复用省掉每步的第二次 observe（DOM label 扫描是步耗时大头）
  const first = options.preSettled
    ? { ok: true, stalled: false, obs: options.carryObs || null }
    : await waitSettle(options);
  const obs = first.obs || observe();
  if (decisionCancelled()) return cancelled();
  const context = commandContext();
  const contextChanged = () => ({ obs: observe(), action: null, res: { ok: false, code: 'CONTEXT_CHANGED',
    message: '决策期间对局归属已改变，未执行旧动作' }, done: false, stopReason: 'context-changed' });
  const t1 = prof ? nowMs() : 0;
  let decision;
  try {
    decision = await decide(obs, { signal: decisionRun?.signal });
  } catch (error) {
    if (decisionCancelled()) return cancelled();
    if (!sameContext(context)) return contextChanged();
    return { obs, action: null, res: null, error: String(error?.message || error), done: true };
  }
  if (decisionCancelled()) return cancelled();
  if (!sameContext(context)) return contextChanged();
  if (decision == null) return { obs, action: null, res: null, done: true };
  const t2 = prof ? nowMs() : 0;
  const before = settleSignature();
  const accepted = act(decision);
  const completion = completions.get(accepted);
  const res = completion ? await awaitCommand(accepted, options) : accepted;
  const settledContext = completion?.context || commandContext();
  const staleCommand = () => ({ obs: observe(), action: decision, id: res.id,
    res: { ok: false, id: res.id, code: 'CONTEXT_CHANGED', message: '命令交棒期间对局归属已改变' },
    done: false, stopReason: 'context-changed' });
  bustSigCache();   // 状态已被 act 改写：作废 before 写入的 TTL 缓存，首轮探测立即可见
  if (res.code === 'COMMAND_TIMEOUT' || res.code === 'CONTEXT_CHANGED') {
    return { obs: observe(), action: decision, id: res.id, res, done: false,
      stopReason: res.code === 'COMMAND_TIMEOUT' ? 'command-timeout' : 'context-changed' };
  }
  if (!sameContext(settledContext)) return staleCommand();
  const isWaitAction = decision?.type === 'sys' && decision?.name === 'noop';
  if (res.ok && !isWaitAction) {
    const deadline = nowMs() + (isTurbo() ? 40 : 1500);
    const pl = prof;
    let actPoll = 0;
    let firstCheckMs = 0;
    let idleStuckMs = 0;
    for (;;) {
      // 签名降频 1/4（09-26 均耗时优化）：轮询主成本是 settleSignature 本体（0.35ms/次，
      // 深走战斗快照+DOM 键扫描），40ms 窗口内晚 ~0.5ms 发现推进无碍，签名计算省 3/4
      if (actPoll++ % 4 === 0) {
        const ts = pl ? nowMs() : 0;
        const changed = settleSignature() !== before;
        if (pl) { pl.actLoopSigMs += nowMs() - ts; pl.actLoopCalls += 1; }
        if (changed) { if (pl) pl.actChanged += 1; break; }
        // 引擎空闲快出（09-26 均耗时⑥）：能量/状态/buff 等变化不在签名字段里，这类动作
        // 完成后签名永不改变 → 白等满 40ms 死线（实测 12.6% 步、占 act 段 57%）。
        // busy/queue 全空闲 + 签名 3ms 未动 = 不会有推进了，提前放行；引擎忙时照等满窗
        const nowE = nowMs();
        if (!firstCheckMs) firstCheckMs = nowE;
        const snapNow = window.SDT?.Battle?.getSnapshot?.() || null;
        const engineIdle = !(snapNow && (snapNow.busy || snapNow.actionQueueLength > 0));
        if (engineIdle) {
          if (!idleStuckMs) idleStuckMs = nowE;
          if (nowE - idleStuckMs > 3) { if (pl) pl.actIdleExit += 1; options.preStable = true; break; }
        } else idleStuckMs = 0;
      }
      if (nowMs() >= deadline) { if (pl) pl.actDeadline += 1; break; }
      const td1 = pl ? nowMs() : 0;
      await (isTurbo() ? defer() : sleep(40));
      if (pl) pl.deferMs += nowMs() - td1;
    }
  }
  const t3 = prof ? nowMs() : 0;
  if (!sameContext(settledContext)) return staleCommand();
  const settled = res.ok ? await waitSettle(options) : { ok: true, stalled: false, obs };
  options.preStable = false;   // 单步有效：只作用于 idleExit 后的这一次尾部 settle
  if (!sameContext(settledContext)) return staleCommand();
  if (prof) {
    prof.settle += t1 - t0;
    prof.decide += t2 - t1;
    prof.act += t3 - t2;
    prof.tail += nowMs() - t3;
    prof.steps += 1;
  }
  return { obs: settled.obs || observe(), action: res.action || decision, id: res.id, res, done: false,
    settleStalled: settled.stalled === true };
}

// 连续驱动一局：直到 decide 返回 null / maxSteps /（可选）runEnded 判定。
// 空转熔断：同一动作（含参数）连打且局面不动达到阈值即收口；另加同位置长驻守卫，
// 防 czClose↔inspectStack 之类二周期（id 交替、同 id 计数抓不到）。
let runCancelled = false;
// stopRun 同时打断在途 decide（2026-09-28 代码线）：LLM 端点挂起时旧实现只能等请求
// 自然结束（含 ≤3 次重试），「停止」形同虚设。autoRun 持有本局取消控制器，step 把
// signal 作为 decide 的第二参递下（decide 契约：可选 extras，旧闭包忽略即兼容）。
let runAbort = null;
function stopRun() {
  runCancelled = true;
  try { runAbort?.abort(); } catch { /* 控制器已关闭 */ }
}

// waitLimit：noop 等待门改墙钟（09-26 弃局根因②）。旧口径是步数 60——turbo 下 noop 步进
// 仅 ~2.5ms，60 步窗口只有 ~150ms，而法力奔涌 surgeSleep(850ms×多发) 等引擎内裸定时器
// 不走 clock 短路，busy 窗口可达 3.4s：正常结算被 150ms 步数门误杀成 wait-limit 弃局。
// 墙钟 4000ms 覆盖 4 发奔涌（3.4s）+余量；真死锁仍由它收口（30s 单局硬上限兜底）。
const WAIT_LIMIT_MS = 4000;

async function autoRun({ decide, maxSteps = 800, onStep, until, driver = 'auto', spinLimit = 6, stayLimit = 500, waitLimitMs = WAIT_LIMIT_MS, runTimeoutMs = Infinity, ...options }) {
  // 重入守卫（复核建议）：runAbort 非空=上一局尚未收口。公开门面可被外部同时驱动，
  // 第二局会把首局的 runCancelled 复位、stopRun 只能停最后一局——直接拒绝并如实上报。
  if (runAbort) {
    const trace = [];
    trace.stopReason = 'already-running';
    noteStopReason({ code: 'already-running', steps: 0 });   // SYS-11：重入拒绝也是一次结构化停止
    return trace;
  }
  const trace = [];
  // 先读旧值再写入（INFRA-03）：setDriver 返回的是刚写入的标签，用它当「调用前
  // 旧驱动」会让 finally 把新标签还原回去（human→autoRun 后仍是 greedy）。
  const previousDriver = getDriver();
  setDriver(driver);
  runCancelled = false;
  runAbort = new AbortController();
  // 局级墙钟（2026-09-28 代码线，选入生效）：maxSteps 对 LLM 慢决策不构成时间上限，
  // 控制台等交互驱动方传 runTimeoutMs 兜底；批跑自带 race，无需此参。
  const runDeadlineMs = Number.isFinite(runTimeoutMs) && runTimeoutMs > 0 ? nowMs() + runTimeoutMs : Infinity;
  let seenRunActive = false;
  let spinKey = '';
  let spinCount = 0;
  let waitStartedMs = 0;
  let stayKey = '';
  let stayCount = 0;
  let battleTurnKey = null;
  let battleStall = 0;
  const seenPositions = new Set();   // 本次出行踩过的 (层,格) 集合——无进展守卫
  let noProgressSteps = 0;
  let stepErrors = 0;                // 单步异常自愈：连续 5 次错误停局
  let failKey = '';                   // 连续同 id 失败熔断（瞬态页失败键无限重试的最后防线）
  let failCount = 0;
  let prevBattleActive = false;       // 战斗内埋点：battleActive 下降沿检测（battleEnd 触发）
  let stopReason = 'max-steps';       // 熔断原因入记录（09-26：弃局死因必须可见）
  let lastStep = null;                // SYS-11：卡死疑似点定位（当前场景+等待动作）取自最后一步
  try {
    for (let i = 0; i < maxSteps; i++) {
      if (runCancelled) { stopReason = 'cancelled'; break; }
      if (nowMs() >= runDeadlineMs) { stopReason = 'run-timeout'; break; }
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
      lastStep = result;   // SYS-11：其后所有收口点都能读到当前场景与等待动作
      if (result.stopReason) {
        trace.push({ step: i, id: result.id || null, ok: false, phase: result.obs.phase,
          spin: 0, code: result.res?.code, completed: result.res?.completed });
        onStep?.(result, i);
        stopReason = result.stopReason;
        break;
      }
      options.preSettled = true;   // 首步之后：上一步尾部已 settle，跳过前置等待
      // 战斗内埋点喂食（09-26）：battle 相每步喂观察快照（受击/掉血/能量浪费），
      // 喝药与逃逸动作喂动作名（potions/fleeTurn）——noteBattle 落盘时随流水带出。
      // battleActive 下降沿调 battleEnd() 重置累积器（不能用 turn 做 token——
      // 每回合变化会把跨回合受击观测冲掉，首版实测 hits 恒 0）
      if (result.obs.battle) {
        battleTick(result.obs.battle);
        if (result.action && (result.action.name === 'usePotion' || result.action.name === 'flee')) {
          battleActionTick(result.action.name, result.obs.battle);
        }
        prevBattleActive = true;
      } else if (prevBattleActive) {
        battleEnd();
        prevBattleActive = false;
      }
      options.carryObs = result.obs;
      // 位置键含战斗回合：战斗内 game.turn 静止，跨回合的同一动作（如每回合 endTurn）
      // 不是空转，不能进同键熔断
      const position = `${result.obs.turn}:${result.obs.phase}:${result.obs.battle?.turn ?? '-'}`;
      const isWait = result.action?.type === 'sys' && result.action?.name === 'noop';
      if (isWait) {
        // noop=明确等待（结算窗口）：不碰熔断；卡死按墙钟收口（见 WAIT_LIMIT_MS）
        spinKey = ''; spinCount = 0;
        if (!waitStartedMs) waitStartedMs = nowMs();
        if (nowMs() - waitStartedMs > waitLimitMs) { stopReason = 'wait-limit'; break; }
      } else if (result.res?.ok) {
        waitStartedMs = 0;
        const spin = `${result.id || ''}:${JSON.stringify(result.action?.args ?? result.action?.params ?? null)}@${position}`;
        if (spin === spinKey) spinCount += 1;
        else { spinKey = spin; spinCount = 1; }
      } else {
        // 被引擎拒绝的动作不进同键熔断（09-26）：瞬态页上的 meta 失败键连点
        // 由失败记忆+TTL 管理，失败步清 spin 避免毫秒级假连击杀局
        waitStartedMs = 0;
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
      // noop 等待步不计同位置长驻（09-26 R6）：busy 窗口（奔涌等演出）内 turn/phase 不变、
      // noop 步进仅 5-6ms，500 步 ~3s 会先于 4s wait 墙钟触发 stay 误杀——noop 已有独立
      // 墙钟门，stay 只统计真正执行了动作的步
      if (!isWait) {
        if (position === stayKey) stayCount += 1;
        else { stayKey = position; stayCount = 1; }
      }
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
      // 取消优先于自然收口（复核建议）：stopRun 落在本步 done 时归因 cancelled，
      // 不冒充 decide-null（trace 死因可见性）
      if (runCancelled) { stopReason = 'cancelled'; break; }
      if (result.done) { stopReason = 'decide-null'; break; }
      if (until?.(result)) { stopReason = 'until'; break; }
      if (!isWait && spinCount >= spinLimit) { stopReason = 'spin'; break; }
      if (stayCount >= stayLimit) { stopReason = 'stay'; break; }
      if (battleStall >= 40) { stopReason = 'battle-stall'; break; }
      if (noProgressSteps > 60) { stopReason = 'no-progress'; break; }
      if (failCount >= 10) { stopReason = 'fail-spin'; break; }
      // 终局挂起（09-26 死锁修复④）：死亡/撤离结算页弹出（terminalPending 挂着等确认）
      // = 对局已结束。策略不该再点页面按钮——retryTerminalDeath 会重开局且 death 记录
      // 永不落盘（recordRun 只在结算确认时写），被兜底误记 abandon（实测 V 底 15 局）。
      // 直接收口，死亡口径由 batch 兜底按 terminalPending.kind 纠正
      if (result.obs.phase === 'settlement' || window.SDT?.game?.terminalPending) {
        stopReason = 'terminal-pending'; break;
      }
      // 二周期熔断：最近 12 步呈 X Y X Y X Y… 交替（A↔B 走位 / 走位↔弹层回环）即收口——
      // 通用兜底，任何策略的残余振荡都不再烧满 maxSteps。排除战斗阶段
      //（1 牌/回合的 endTurn 交替是合法节奏，战斗另有 battleStall 守卫）。
      // 窗口 8→12（09-26 门对跳修复配套）：滞环解锁阈值 stallSteps>10 需要 10 次 map
      // 决策才放行前进门（doorStall 26 分破环），8 步窗口会让解锁来不及生效的
      // 「绕圈待解锁」局被误杀——12 步给解锁留出 2 步余量，真死循环多烧 4 步无害
      if (trace.length >= 12 && i >= 11) {
        const s = trace.slice(-12);
        if (s.every(t => t.phase !== 'battle')) {
          const k = s.map(t => `${t.id}|${t.phase}`);
          const alt2 = [0, 2, 4, 6, 8, 10].every(j => k[j] === k[0])
            && [1, 3, 5, 7, 9, 11].every(j => k[j] === k[1]) && k[0] !== k[1];
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
    runAbort = null;             // 本局取消控制器随局销毁，stopRun 不误伤下一局
  }
  // 2026-10-03 老板（SYS-11）：结构化停止原因随局落盘（recorder 消费进 entry.stopReason）
  // ——kind 分类 + 卡死疑似点（当前场景 phase + 等待动作 waitingAction）；trace.stopReason
  // 字符串口径不动，既有消费方零感知。
  noteStopReason({
    code: stopReason,
    phase: lastStep?.obs?.phase ?? null,
    turn: lastStep?.obs?.turn ?? null,
    waitingAction: lastStep?.id ?? null,
    steps: trace.length,
  });
  trace.stopReason = stopReason;
  return trace;
}

export { act, step, autoRun, waitSettle, stopRun };
