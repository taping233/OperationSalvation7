/* ============================================================
 * agent.scenes.runtime.js —— 按需加载的固定验收剧本实现
 *
 * 目的：把「实机验收一步步驱动」压成一次调用。每个场景 = 前置 + 驱动 +
 * 断言，跑完返回结构化报告（pass / 断言清单 / 终态摘要），验收直接落证据。
 * 全部走既有命令面（autoRun / dev 跳节点），不模拟鼠标；断言读权威状态。
 *
 * 用法（内置浏览器 console / iab-drive 一行式）：
 *   SDT.Agent.scenes.list()                        // 场景清单
 *   await SDT.Agent.scenes.run('battle')           // 单场景（测试局直跳）
 *   await SDT.Agent.scenes.run('fullrun')          // greedy 完整局（默认 turbo）
 * 外部 evaluate 只回原始值：JSON.stringify(await SDT.Agent.scenes.run(...))。
 * 协议详情见 docs/agent-protocol.md「验收剧本」节。
 * ============================================================ */
import { observe, phaseOf } from './agent.state.js';
import { autoRun, waitSettle } from './agent.runner.js';
import { greedyPolicy, strategicPolicy } from './agent.policy.js';
import { isTurbo, setTurbo } from '../core/turbo.js';
import { game, startNewGame, newRun } from '../run/game.session.js';
import { devJumpNode } from '../run/game.run.dev.js';
import * as recorder from './agent.recorder.js';
import { SCENE_CATALOG } from './agent.scenes.catalog.js';

const nowMs = () => (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

// ---------- 通用：ui 动作查找（名匹配即可，disabled 不进动作面） ----------
const findUi = (obs, name) => (obs.actions || []).find(a => a.type === 'ui' && a.name === name);
const hasUi = (obs, name) => !!findUi(obs, name);
const overlayClosed = (obs) => !obs.ui?.open;

// ---------- BFS：layerData 邻接上找目标集的下一步（真实逐格 moveTo 用） ----------
function bfsFirstStep(targets) {
  const from = `${game.layerIdx},${game.trackPos}`;
  if (targets.has(from)) return null;
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const [li, idx] = cur.split(',').map(Number);
    for (const [nli, nidx] of game.layerData?.[li]?.logical?.[idx]?.next || []) {
      const key = `${nli},${nidx}`;
      if (prev.has(key)) continue;
      prev.set(key, cur);
      if (targets.has(key)) {
        let step = key;
        let back = cur;
        while (back !== from) { step = back; back = prev.get(step); }
        return step.split(',').map(Number);
      }
      queue.push(key);
    }
  }
  return null;
}

// 第三层（layerIdx===2）紧急撤离点集合——只有第三层的信标还在工作（altar 定版）
function findLayer2Exits() {
  const out = new Set();
  const layer = game.layerData?.[2];
  (layer?.logical || []).forEach((cell, idx) => {
    if (cell?.def?.type === 'emergencyExit') out.add(`2,${idx}`);
  });
  return out;
}

// 测试局直跳第三层入口：撤离链验收只关心撤离段，前两层推进由 fullrun 覆盖。
// IAB 自刷窗口 ~90s，全图走三层必撞刷（实机实测三次被杀）；直改坐标不走
// moveTo（测试局无档位语义，与 devJumpNode 的直跳同级），逐格仍走真实 moveTo
function skipToLayer2Start() {
  game.layerIdx = 2;
  game.trackPos = 0;
  game.visited = game.visited || {};
}

// 测试局起步（game.run.dev.devEnsureRun 同口径）：newRun 不占档位、不写存档，
// 补真实角色避免 HUD 落入「未选择人物」。startNewGame 在有旧档时会弹存档槽页，
// 策略可能误点「进入档位」走进玩家正式档（走图写档）——长链路场景一律用测试局
async function ensureTestRun() {
  if (game.runActive && !game.battleActive && !game.terminalPending) return true;
  const ok = await newRun('standard') !== false;
  if (ok) {
    document.getElementById('title').hidden = true;
    game.characterId = 'heixiang';
    game.myClass = '战士';
    // 首胜「卡牌是消耗品」教学页对场景验收无意义，且首胜后异步弹出会打断长链路
    // （实测两度 spin 熔断在这页）——预设一次性标志让它不弹（内存标志，不写存档）
    try { if (window.SDT?.Base?.data) window.SDT.Base.data.ammoTaught = true; } catch { /* Base 未就绪 */ }
    // 血量撑到 500：撤离链验收的是撤离/献祭/结算链路，不是战斗强度——
    // 第三层遭遇战 greedy 满血 30 也会被打死（实机实测「撤离失败」收束），
    // 血厚保证活着走到撤离点。仅测试局内存值，不写存档
    game.maxHp = 500;
    game.hp = 500;
    // newRun 尾部会挂选人页 modal（dev 链路里被 devJumpNode 的 beginRoom 顶掉）——
    // 同款处理：state 回 idle 后 beginRoom 盖掉，角色已直接指定
    game.state = 'idle';
    window.SDT.UI.beginRoom();
  }
  return ok;
}

// ---------- 报告终态摘要（JSON-safe） ----------
function finalSnapshot() {
  const obs = observe();
  return {
    phase: obs.phase,
    runActive: !!obs.run?.active,
    hp: obs.run?.hp ?? null,
    coins: obs.run?.coins ?? null,
    layer: obs.run?.layer ?? null,
    node: obs.run?.node ?? null,
    fought: recorder.getBattleCount(),
    overlay: obs.ui?.title || null,
  };
}

// 清场专用 decide：教学/搜刮/必选页 greedy 不一定点得掉（“知道了”不在它的
// PREDIT 词表里，实测残留“卡牌是消耗品”页）——收口钮 → 确认类文案 → Esc 链递进
const DRAIN_CONFIRM = /(知道|确认|继续|关闭|好的|收到|返回|领取|带走|收下|跳过|完成|开始|出发|离开|获得)/;
function drainDecide() {
  return (obs) => {
    // 已干净也不能返回 null——那会让 autoRun 立即 decide-null 收口，
    // until 的「连续两次干净」永远数不满；noop 等待步让 until 继续数
    if (!obs.ui?.open) return { type: 'sys', name: 'noop' };
    const acts = obs.actions || [];
    for (const name of ['evtNext', 'pickupGo', 'fireDone', 'closeShop', 'chestReveal', 'chestContinue', 'chestSkip', 'chestLeave', 'helpBack', 'lastLampFinish']) {
      const a = acts.find(x => x.type === 'ui' && x.name === name);
      if (a) return a;
    }
    const confirm = acts.find(x => x.type === 'ui' && DRAIN_CONFIRM.test(x.label || ''));
    if (confirm) return confirm;
    return { type: 'ui', name: 'closeOverlay' };
  };
}

// ---------- dev 直跳场景模板：devJumpNode(kind) → greedy 驱动 → seen+收口断言 ----------
async function runDevKind(kind, { check, options, seen, finishOk, awaitReady, prepare }) {
  // 前置清场：上一场景可能把弹层/战斗留在半截（战后搜刮页、首胜教学页等）。
  // 教学页在结算异步链尾、上个场景完全收口之后才弹，waitSettle 在「弹层关着」
  // 时就放行挡不住它——用墙钟稳定窗：连续 1500ms 干净才算清完，窗口内冒出
  // 弹层/战斗就重置计时并进 drain（战利品页可晚于战斗离场才出现）。
  {
    const t0 = nowMs();
    let lastClean = -1;
    while (nowMs() - t0 < 7000) {
      const dirty = !!observe().ui?.open || game.battleActive || game.terminalPending
        || game.state === 'battleSettlement' || !!window.SDT?.Chests?.isOpen?.();
      if (!dirty) {
        if (lastClean < 0) lastClean = nowMs();
        else if (nowMs() - lastClean >= 1500) break;
      } else {
        lastClean = -1;
        let cleanStreak = 0;
        await autoRun({
          decide: drainDecide(),
          maxSteps: 80, spinLimit: 40, runTimeoutMs: 45000, driver: 'scene:drain',
          until: (r) => {
            cleanStreak = (!r.obs.ui?.open && !r.obs.battle) ? cleanStreak + 1 : 0;
            return cleanStreak >= 2;
          },
        });
        await waitSettle({ timeoutMs: 5000 });
      }
    }
  }
  const prePhase = phaseOf();
  check(`前置可跳节点（${kind}）`, !game.battleActive && !game.terminalPending && !observe().ui?.open,
    `进入时 phase=${prePhase}${game.battleActive ? '（战斗中）' : ''}${game.terminalPending ? '（结算挂起）' : ''}${observe().ui?.open ? `（弹层残留：${observe().ui.title}）` : ''}`);
  if (prepare) {
    try { prepare(); }
    catch (error) { check('前置准备', false, String(error?.message || error)); }
  }
  await devJumpNode(kind);
  await waitSettle({ timeoutMs: 15000 });
  // devForceBattle 是 async（await startBattle）而 devJumpNode 不等它：开战类场景
  // 必须等战斗真正挂上再驱动，否则 autoRun 会在接敌过场页空转到 spin 熔断
  if (awaitReady) {
    const deadline = nowMs() + 15000;
    while (!awaitReady() && nowMs() < deadline) await waitSettle({ timeoutMs: 2000 });
    check('目标就绪（前置完成）', !!awaitReady());
  }
  let seenTarget = false;
  // seen 必须在 decide 的入参 obs 上判：until 收到的 r.obs 是步尾 settle 后的
  // 画面，一闪而过的页面（事件页 1s 内被 greedy 点穿，实测 t=545ms 弹 t=1557ms 关）
  // 在那里永远看不到——decide 看到的画面才是决策真相
  const innerDecide = greedyPolicy({ resetSlots: true });
  const decide = (obs, extras) => {
    if (seen(obs)) seenTarget = true;
    return innerDecide(obs, extras);
  };
  const trace = await autoRun({
    decide,
    maxSteps: options.maxSteps ?? 600,
    runTimeoutMs: options.runTimeoutMs ?? 120000,
    spinLimit: 40,   // 搜刮点多箱队列每箱一页+780ms 演出,战斗掉落+格子搜刮点可叠十几页连点(默认 6 严重误杀)
    driver: `scene:${kind}`,
    until: (r) => seenTarget && finishOk(r.obs),
  });
  check(`目标页出现过（${kind}）`, seenTarget);
  check('无单步异常', !trace.some(t => t.phase === 'error'), `stopReason=${trace.stopReason} steps=${trace.length}`);
  return { stopReason: trace.stopReason, steps: trace.length };
}

// ---------- 场景：单场遭遇战 ----------
async function sceneBattle(ctx) {
  const battlesBefore = recorder.getBattleCount();
  const out = await runDevKind('battle', {
    ...ctx,
    awaitReady: () => game.battleActive,
    seen: (obs) => obs.phase === 'battle',
    finishOk: (obs) => obs.phase !== 'battle' && !obs.battle,
  });
  ctx.check('战斗已结算离场', !game.battleActive);
  ctx.check('战斗计数增长', recorder.getBattleCount() > battlesBefore,
    `${battlesBefore} → ${recorder.getBattleCount()}`);
  ctx.check('生命值 sane', Number.isFinite(game.hp) && game.hp >= 0, `hp=${game.hp}`);
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：BOSS 战（dev 面板自动编组后开战） ----------
async function sceneBoss(ctx) {
  const out = await runDevKind('boss', {
    ...ctx,
    awaitReady: () => game.battleActive,
    seen: (obs) => obs.phase === 'battle',
    finishOk: (obs) => obs.phase !== 'battle' && !obs.battle,
  });
  ctx.check('BOSS 战已结算离场', !game.battleActive);
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：商店 ----------
async function sceneShop(ctx) {
  const out = await runDevKind('shop', {
    ...ctx,
    seen: (obs) => hasUi(obs, 'closeShop'),
    finishOk: overlayClosed,
  });
  ctx.check('商店面板已收口', overlayClosed(observe()));
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：事件 ----------
// 事件面有三族：lastLamp* 故事事件（runEventDeck 优先抽）、evtChoice/evtNext 卡堆
// 事件、resPick*/eventCardPick/eventRecode* 特殊页——seen 必须全覆盖；分支可能
// 带战斗，时序预算放宽到 180s（实机实测 lastLamp 分支连战斗 200s+ 超过 120s 默认）
const EVENT_ACT = /^(evtChoice|evtNext|resPick|resSkip|lastLamp|eventCardPick|eventRecode)/;
async function sceneEvent(ctx) {
  const out = await runDevKind('event', {
    ...ctx,
    options: { runTimeoutMs: 180000, ...ctx.options },
    // 测试局事件卡堆常为空——runEventDeck 会走旧随机表分支（纯日志不弹页，
    // 实机实测 greedy 直接开始走图跑满 190s）。先塞一张事件卡保证弹页链路，
    // 与真实对局同源（事件卡都从 grantCard 进堆）
    prepare: () => {
      const hasEventCard = (game.ownedCards || []).some(o => o.card?.type === '事件');
      if (!hasEventCard) {
        const ev = window.SDT.Cards.all().find(c => c.type === '事件');
        if (!ev || !game.grantCard?.(ev)) throw new Error('塞事件卡失败（测试局无卡牌接收面）');
      }
    },
    seen: (obs) => (obs.actions || []).some(a => a.type === 'ui' && EVENT_ACT.test(a.name)),
    finishOk: overlayClosed,
  });
  ctx.check('事件页已收口', overlayClosed(observe()));
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：火堆 ----------
async function sceneFire(ctx) {
  const out = await runDevKind('fire', {
    ...ctx,
    seen: (obs) => hasUi(obs, 'fireDone'),
    finishOk: overlayClosed,
  });
  ctx.check('火堆页已收口', overlayClosed(observe()));
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：祭坛 ----------
async function sceneAltar(ctx) {
  const out = await runDevKind('altar', {
    ...ctx,
    seen: (obs) => /祭坛|仪式/.test(obs.ui?.title || '') || hasUi(obs, 'sacPick') || hasUi(obs, 'flowContinue'),
    finishOk: overlayClosed,
  });
  ctx.check('祭坛页已收口', overlayClosed(observe()));
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：搜刮点 ----------
async function sceneChest(ctx) {
  const out = await runDevKind('chest-medium', {
    ...ctx,
    seen: (obs) => hasUi(obs, 'chestSkip') || hasUi(obs, 'pickupGo'),
    finishOk: overlayClosed,
  });
  ctx.check('搜刮点页已收口', overlayClosed(observe()));
  return { ...out, final: finalSnapshot() };
}

// ---------- 场景：冒烟一条龙（标题真实开局 → 走格 → 打完首战） ----------
async function sceneSmoke(ctx) {
  const { check, options } = ctx;
  check('前置在标题页', phaseOf() === 'title', `phase=${phaseOf()}（冷启动验收须先加载到标题页）`);
  const battlesBefore = recorder.getBattleCount();
  const start = startNewGame();
  check('开局受理', start !== false);
  await waitSettle({ timeoutMs: 15000 });
  let seenBattle = false;
  const smokeGreedy = greedyPolicy({ resetSlots: true });
  // 存档槽页守卫：有旧档时 startNewGame 会弹槽页，greedy 可能点「进入档位」
  // 走进玩家正式档（走图写档）——见槽页一律 slotBack 退回标题并如实判失败，
  // 绝不碰 enterSlot/overwriteSlot/newSlot（都会动玩家档位）
  const smokeDecide = (obs, extras) => {
    if (obs.phase === 'battle') seenBattle = true;   // decide 入参=决策真相（同 runDevKind）
    const acts = obs.actions || [];
    if (acts.some(a => a.type === 'ui' && (a.name === 'enterSlot' || a.name === 'overwriteSlot' || a.name === 'newSlot'))) {
      const back = acts.find(a => a.type === 'ui' && a.name === 'slotBack');
      if (back) return back;
    }
    return smokeGreedy(obs, extras);
  };
  const trace = await autoRun({
    decide: smokeDecide,
    maxSteps: options.maxSteps ?? 900,
    runTimeoutMs: options.runTimeoutMs ?? 180000,
    spinLimit: 40,
    driver: 'scene:smoke',
    until: (r) => seenBattle && r.obs.phase !== 'battle' && recorder.getBattleCount() > battlesBefore,
  });
  check('未误入存档槽页', !(observe().actions || []).some(a => a.type === 'ui' && (a.name === 'enterSlot' || a.name === 'overwriteSlot')),
    '开局链遇到旧档槽页时已退回；如复现请先人工清理档位页');
  check('角色已选定', !!game.characterId, `characterId=${game.characterId || '无'}`);
  check('完成首战', recorder.getBattleCount() > battlesBefore,
    `${battlesBefore} → ${recorder.getBattleCount()}`);
  check('无单步异常', !trace.some(t => t.phase === 'error'), `stopReason=${trace.stopReason} steps=${trace.length}`);
  return { stopReason: trace.stopReason, steps: trace.length, final: finalSnapshot() };
}

// ---------- 场景：撤离结算链（开局 → BFS 走到第三层紧急撤离点 → 献祭撤离 → 结算） ----------
// 关当前弹层的一个动作（找不到返回 null，调用方继续自己的流程）——
// 与 drainDecide 的差别：没有 noop 分支，专供「顺路关弹层」的场景 decide 复用
function closeTopOverlayAction(obs) {
  const acts = obs.actions || [];
  for (const name of ['evtNext', 'pickupGo', 'fireDone', 'closeShop', 'chestTake', 'chestSkip', 'helpBack', 'lastLampFinish', 'ammoTeachOk']) {
    const a = acts.find(x => x.type === 'ui' && x.name === name);
    if (a) return a;
  }
  const confirm = acts.find(x => x.type === 'ui' && DRAIN_CONFIRM.test(x.label || ''));
  if (confirm) return confirm;
  return acts.find(x => x.type === 'ui' && x.name === 'closeOverlay') || null;
}

async function sceneExtract(ctx) {
  const { check, options } = ctx;
  const greedy = greedyPolicy({ resetSlots: true });
  let exitSeen = false;
  let sacrificed = false;

  const decide = (obs) => {
    const acts = obs.actions || [];
    // 撤离面板：直接点撤离（第三层信标 + 卡牌 ≥3 时才在动作面上）
    const payExit = acts.find(a => a.type === 'ui' && a.name === 'payExit');
    if (payExit) { exitSeen = true; return payExit; }
    // 献祭选卡：逐张选，选满后 sacConfirm 才会出现在动作面（disabled 不进清单）
    const sacConfirm = acts.find(a => a.type === 'ui' && a.name === 'sacConfirm');
    if (sacConfirm) { sacrificed = true; return sacConfirm; }
    const sacPick = acts.find(a => a.type === 'ui' && a.name === 'sacPick');
    if (sacPick) return sacPick;
    // 战斗外的弹层（搜刮点奖励页/首胜教学页等）顺手关掉——greedy 点不掉
    // 「知道了」类按钮会原地 spin。closeOverlay 兜底被拒（必选过场页）时不连发：
    // fail-spin 10 连拒实测 171ms 就熔死在接敌过场页——noop 等它自己过去
    if (obs.ui?.open && obs.phase !== 'battle') {
      const closer = closeTopOverlayAction(obs);
      if (closer && closer.name !== 'closeOverlay') return closer;
      return { type: 'sys', name: 'noop' };
    }
    // 地图相：BFS 奔第三层紧急撤离点；无路（未过层/门后）时交给 greedy 推进
    if (obs.phase === 'map' && !exitSeen) {
      const targets = findLayer2Exits();
      if (targets.size) {
        const step = bfsFirstStep(targets);
        if (step) return { type: 'move', li: step[0], idx: step[1] };
      }
    }
    return greedy(obs);
  };

  // 前置：测试局（不占档不写档）→ 找一局第三层生成了紧急撤离点的（随机图，最多重开 3 次），
  // 进图后直跳第三层入口（skipToLayer2Start），撤离段全程真实逐格 moveTo
  let exits = new Set();
  for (let attempt = 1; attempt <= 3; attempt++) {
    const started = await ensureTestRun();
    check('测试局就绪', started, `第 ${attempt} 次 newRun`);
    if (!started) return { final: finalSnapshot() };
    await waitSettle({ timeoutMs: 15000 });
    for (let i = 0; i < 100 && !(game.runActive && game.state === 'idle'); i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    check('已进图（runActive+idle）', game.runActive && game.state === 'idle',
      `runActive=${game.runActive} state=${game.state}`);
    if (!options.fullWalk) skipToLayer2Start();
    exits = findLayer2Exits();
    if (exits.size) break;
    // 本局第三层无撤离点：收掉测试局再重开（dropRun 未导出，直接清 runActive 同测试局丢弃语义）
    game.runActive = false;
    game.state = 'idle';
  }
  check('第三层生成紧急撤离点', exits.size > 0, exits.size ? `目标格：${[...exits].join(' ')}` : '连续 3 局未生成，属随机图边界');

  const trace = await autoRun({
    decide,
    maxSteps: options.maxSteps ?? 1500,
    runTimeoutMs: options.runTimeoutMs ?? 360000,
    spinLimit: 40,
    driver: 'scene:extract',
  });

  check('撤离面板出现过', exitSeen);
  check('献祭完成', sacrificed);
  check('对局已收束（回基地/结算）', !game.runActive, `phase=${phaseOf()}`);
  check('无单步异常', !trace.some(t => t.phase === 'error'), `stopReason=${trace.stopReason} steps=${trace.length}`);
  return {
    stopReason: trace.stopReason, steps: trace.length, final: finalSnapshot(),
    traceHead: trace.slice(0, 30).map(t => `${t.step}|${t.id}|${t.phase}|ok=${t.ok}`),
  };
}

// ---------- 场景：greedy 完整局（strategic 打到撤离或死亡） ----------
async function sceneFullrun(ctx) {
  const { check, options } = ctx;
  // 测试局起步：startNewGame 在有旧档时弹存档槽页，策略可能误入玩家正式档（写档风险）
  const started = await ensureTestRun();
  check('测试局就绪', started);
  if (!started) return { final: finalSnapshot() };
  await waitSettle({ timeoutMs: 15000 });
  const runsBefore = new Set(recorder.listRuns().map(run => run.id));
  const trace = await autoRun({
    decide: strategicPolicy({ resetSlots: true }),
    maxSteps: options.maxSteps ?? 3000,
    runTimeoutMs: options.runTimeoutMs ?? 300000,
    spinLimit: 40,
    driver: 'scene:fullrun',
  });
  const LEGAL = ['run-end', 'terminal-pending', 'until', 'decide-null'];
  check('自然收口（撤离或死亡）', LEGAL.includes(trace.stopReason),
    `stopReason=${trace.stopReason}`);
  check('无单步异常', !trace.some(t => t.phase === 'error'), `steps=${trace.length}`);
  const runsAfter = recorder.listRuns();
  const freshRuns = runsAfter.filter(run => !runsBefore.has(run.id));
  check('跑局记录落盘', freshRuns.length > 0,
    `新增 ${freshRuns.length} 条；缓存 ${runsBefore.size} → ${runsAfter.length}`);
  return { stopReason: trace.stopReason, steps: trace.length, final: finalSnapshot() };
}

// 场景描述留在轻量清单；本模块只持有首次验收时需要的驱动实现。
const SCENE_RUNNERS = {
  smoke: sceneSmoke, battle: sceneBattle, boss: sceneBoss, shop: sceneShop, event: sceneEvent,
  fire: sceneFire, altar: sceneAltar, chest: sceneChest, extract: sceneExtract, fullrun: sceneFullrun,
};

// ---------- 执行器：turbo 管理 / console.error 捕获 / 报告装配（防重入由轻量门面持有） ----------
async function executeScene(name, options = {}) {
  const def = SCENE_CATALOG[name];
  if (!Object.hasOwn(SCENE_RUNNERS, name)) {
    return { ok: false, pass: false, code: 'UNKNOWN_SCENE',
      message: `未知场景：${name}（可用：${Object.keys(SCENE_CATALOG).join(', ')}）` };
  }
  const prevTurbo = isTurbo();
  const useTurbo = !!(options.turbo ?? def.turbo);
  const assertions = [];
  const errors = [];
  const check = (n, pass, detail = '') => {
    assertions.push({ name: n, pass: !!pass, detail: String(detail).slice(0, 200) });
    return !!pass;
  };
  // console.error 捕获：实机报错是验收重点，随报告带出（≤40 条，不打断场景）。
  // [SDT.Icons] missing bitmap 是启动期图集渐进预热告警（每局必刷十条上下），
  // 不过滤会淹没真错误；图集缺失归 assets:audit / card-art-coverage 管。
  const rawError = console.error.bind(console);
  console.error = (...args) => {
    const text = args.map(String).join(' ');
    if (errors.length < 40 && !text.startsWith('[SDT.Icons] missing bitmap')) errors.push(text.slice(0, 200));
    rawError(...args);
  };
  const t0 = nowMs();
  try {
    setTurbo(useTurbo);
    const report = await SCENE_RUNNERS[name]({ check, options, errors });
    return {
      ok: true,
      scene: name,
      title: def.title,
      pass: assertions.length > 0 && assertions.every(a => a.pass),
      turbo: useTurbo,
      assertions,
      errors: errors.slice(0, 10),
      durationMs: Math.round(nowMs() - t0),
      ...report,
    };
  } catch (error) {
    check('场景未抛异常', false, String(error?.message || error));
    return {
      ok: false, scene: name, title: def.title, pass: false, turbo: useTurbo,
      code: 'SCENE_THREW', assertions, errors: errors.slice(0, 10),
      durationMs: Math.round(nowMs() - t0),
    };
  } finally {
    console.error = rawError;
    setTurbo(prevTurbo);
  }
}

export { executeScene };
