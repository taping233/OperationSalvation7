/* Async Agent stepping and autoplay. Loaded only when a caller requests execution. */
import { collectActionKeys, overlayVisible } from './agent.surface.js';
import { observe, settleSignature, bustSigCache } from './agent.state.js';
import { isTurbo } from '../core/turbo.js';
import { battleTick, battleActionTick, battleEnd, noteStopReason } from './agent.recorder.js';
import { game } from '../run/game.session.js';
import { act, completions, commandContext, sameContext, awaitCommand } from './agent.action-router.js';
import { runState } from './agent.run-control.js';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
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
  const decisionRun = runState.abort;
  const decisionCancelled = () => decisionRun !== runState.abort || decisionRun?.signal.aborted === true;
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

// waitLimit：noop 等待门改墙钟（09-26 弃局根因②）。旧口径是步数 60——turbo 下 noop 步进
// 仅 ~2.5ms，60 步窗口只有 ~150ms，而法力奔涌 surgeSleep(850ms×多发) 等引擎内裸定时器
// 不走 clock 短路，busy 窗口可达 3.4s：正常结算被 150ms 步数门误杀成 wait-limit 弃局。
// 墙钟 4000ms 覆盖 4 发奔涌（3.4s）+余量；真死锁仍由它收口（30s 单局硬上限兜底）。
const WAIT_LIMIT_MS = 4000;

/** @typedef {Awaited<ReturnType<typeof step>> | {obs:{phase:string,actions:unknown[],turn:number,run:null},action:null,res:null,error:string,done:boolean}} StepNotice */
/** @param {{decide:Parameters<typeof step>[0],maxSteps?:number,onStep?:(result:StepNotice,index:number)=>void,until?:(result:Awaited<ReturnType<typeof step>>)=>boolean,driver?:string,spinLimit?:number,stayLimit?:number,waitLimitMs?:number,runTimeoutMs?:number,commandTimeoutMs?:number,quietMs?:number,pollMs?:number,timeoutMs?:number,allowEmpty?:boolean,preStable?:boolean,preSettled?:boolean,carryObs?:ReturnType<typeof observe>,signal?:AbortSignal}} options */
async function autoRun({ decide, maxSteps = 800, onStep, until, spinLimit = 6, stayLimit = 500, waitLimitMs = WAIT_LIMIT_MS, ...options }, run, runDeadlineMs) {
  /** @type {{step:number,id:string|null,ok:boolean|null,phase:string,spin:number,error?:string,code?:string,completed?:boolean,stalled?:boolean}[] & {stopReason?:string}} */
  const trace = [];
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
  for (let i = 0; i < maxSteps; i++) {
    if (run.signal.aborted) { stopReason = 'cancelled'; break; }
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
    if (run.signal.aborted) { stopReason = 'cancelled'; break; }
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

export { step, autoRun, waitSettle };
