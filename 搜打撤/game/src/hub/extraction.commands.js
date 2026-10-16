import { clone, fail } from './commands.shared.js';
import { RULE_CONFIG } from '../core/rule-config.js';

function validStack(stack) {
  return !!stack && typeof stack === 'object' && !Array.isArray(stack) &&
    !!stack.card && typeof stack.card === 'object' && !Array.isArray(stack.card) &&
    typeof stack.card.name === 'string' && Number.isInteger(stack.count) && stack.count > 0;
}

function validateSelections(selections) {
  if (!Array.isArray(selections)) return fail('INVALID_ARGUMENT', '入库选择必须是卡牌数量列表');
  for (const selection of selections) {
    if (!selection || typeof selection !== 'object' || Array.isArray(selection) ||
        typeof selection.name !== 'string' || !selection.name.trim() ||
        !Number.isSafeInteger(selection.count) || selection.count <= 0) {
      return fail('INVALID_ARGUMENT', '入库选择须包含卡牌名称和正整数数量');
    }
  }
  return { ok: true };
}

export function validatePendingExtraction(pending) {
  if (!pending || typeof pending !== 'object' || Array.isArray(pending)) return fail('INVALID_EXTRACTION', '撤离整理记录结构无效');
  if (pending.version !== 1 || typeof pending.runId !== 'string' || !pending.runId.trim() || pending.phase !== 'organizing') {
    return fail('INVALID_EXTRACTION', '撤离整理记录版本、身份或阶段无效');
  }
  if (!Number.isInteger(pending.requestSeq) || pending.requestSeq < 0 ||
      !Array.isArray(pending.remainingCards) || !pending.remainingCards.every(validStack) ||
      !Array.isArray(pending.keptPocket) || !pending.keptPocket.every(validStack)) {
    return fail('INVALID_EXTRACTION', '撤离整理卡牌或请求序号无效');
  }
  if (!Number.isInteger(pending.totalPocketCount) || pending.totalPocketCount < 0 ||
      !Number.isInteger(pending.lostPocketCount) || pending.lostPocketCount < 0 ||
      pending.lostPocketCount > pending.totalPocketCount ||
      pending.keptPocket.reduce((sum, stack) => sum + stack.count, 0) + pending.lostPocketCount !== pending.totalPocketCount) {
    return fail('INVALID_EXTRACTION', '撤离消耗区概率结果计数无效');
  }
  const resources = pending.resources;
  if (!resources || typeof resources !== 'object' || Array.isArray(resources) ||
      !Number.isInteger(resources.wood) || resources.wood < 0 ||
      !Number.isInteger(resources.rations) || resources.rations < 0) {
    return fail('INVALID_EXTRACTION', '撤离自动入库物资快照无效');
  }
  return { ok: true };
}

const stackInto = (list, stack) => {
  if (!stack || !stack.card || !stack.count) return;
  const found = list.find(item => item.card.name === stack.card.name);
  if (found) found.count += stack.count;
  else list.push({ card: { ...stack.card }, count: stack.count });
};

function addXp(base, cls, amount, characterFor, addXpToProgress) {
  if (!cls || amount <= 0) return;
  const character = characterFor(cls);
  const group = character ? 'characters' : 'classes';
  const key = character ? character.id : cls;
  base[group] ||= {};
  base[group][key] ||= { lv: 1, xp: 0 };
  base[group][key] = addXpToProgress(base[group][key], amount).after;
}

// 2026-10-03 老板（SYS-02）：首探量与撤离经验公式各只留一份——加经验与结算回执
// 都从这里取数，页面/记录/Agent 不再各自用 turn 反推（SYS-01 口径原样保留）。
export function firstExploreMoves(game) {
  // 2026-10-03 老板（SYS-01）：撤离经验只统计首次有效探索量——explored 是 moveTo 写入的
  // 首踏入格打标（visited 类字段先例），重复进出已探索格的安全往返不再产生经验；
  // 旧档会话无 explored 字段（null）回退旧口径 turn-1，存量进度不缩水；步数统计（turn）保留作展示。
  return (game.explored && typeof game.explored === 'object')
    ? Object.keys(game.explored).length
    : Math.max(0, (Number(game.turn) || 0) - 1);
}

export function extractionXp(moves, xpMul) {
  return Math.round((20 + moves * 2) * (Number(xpMul) || 1));
}

// 整理命令按名称堆叠候选；只有真实入库才会扣减 remainingCards。
// 在 finish 清理 pending 前固化差集，不把初攻、未入库卡或仓库往局持有计入本局。
function savedExtractionCards(game, remaining, isSha) {
  const candidates = [];
  for (const entry of game.ownedCards || []) {
    if (entry?.card && !isSha(entry.card)) stackInto(candidates, { card: entry.card, count: 1 });
  }
  const leftByName = new Map(remaining.map(stack => [stack.card.name, stack.count]));
  return clone(candidates.map(stack => ({ card: stack.card,
    count: Math.max(0, stack.count - (leftByName.get(stack.card.name) || 0)),
  })).filter(stack => stack.count > 0));
}

// 2026-10-03 老板（SYS-02）：一次远征的「真实回执」——结算命令链在 extractFinish 提交时构造，
// 随既有事务收据持久化（base._m01.requests 的 output，journal 幂等语义不变，不新增存储机制）；
// 结算页、跑局记录、Agent 导出三方读同一份事实。只读持久态（pending 的净带回/散失）
// 与终局态（game 的结局/层/行动/时长），刷新后从存档重建 attempt 仍得到同一结果；
// 已提交过的事务 replay 直接返回存档收据原值，回执不重复累计。
export function buildExtractionReceipt({ game, pending, isSha = () => false, xpMul = 1 }) {
  const moves = firstExploreMoves(game);
  const remaining = pending && Array.isArray(pending.remainingCards) ? pending.remainingCards : [];
  const remainingCount = remaining.reduce((n, s) => n + (s.count || 0), 0);
  const ownedNonSha = (game.ownedCards || []).filter(o => o && o.card && !isSha(o.card)).length;
  const pocketTotal = pending && Number.isInteger(pending.totalPocketCount) ? pending.totalPocketCount : 0;
  const pocketLost = pending && Number.isInteger(pending.lostPocketCount) ? pending.lostPocketCount : 0;
  const resources = pending && pending.resources ? pending.resources : {};
  return {
    version: 1,
    outcome: game.bossKilled ? 'clear' : 'extract',   // clear=击破首脑后的终局撤离，extract=保本/紧急撤离
    bossKilled: !!game.bossKilled,
    layersReached: Number.isInteger(game.layerIdx) ? game.layerIdx + 1 : null,
    actions: Math.max(0, (Number(game.turn) || 0) - 1),
    firstExplore: { moves, xp: extractionXp(moves, xpMul) },
    savedCards: savedExtractionCards(game, remaining, isSha),   // 随事务回执保留最终入库集合，供跑局记录使用
    netTake: {
      cardsStashed: Math.max(0, ownedNonSha - remainingCount),   // 本局真实入库张数（与携出候选、仓库原持有区分）
      pocketKept: Math.max(0, pocketTotal - pocketLost),
      wood: Number.isInteger(resources.wood) ? resources.wood : 0,
      rations: Number.isInteger(resources.rations) ? resources.rations : 0,
    },
    losses: {
      lostCount: remainingCount,   // 完成整理时未入库的卡牌即散失
      lostNotable: remaining.filter(s => s.card && (s.card.rarity === '传说' || s.card.rarity === '史诗'))
        .slice(0, 6).map(s => ({ name: s.card.name, rarity: s.card.rarity, count: s.count || 1 })),
      pocketLost,
    },
    runCoins: Number.isInteger(game.coins) ? game.coins : null,   // 随身币不带回，只作本局记录
    durationSec: Math.max(0, Math.floor(Number(game.elapsed) || 0)),
  };
}

function calculateBaseAndPending({ game, runId, random, baseSnapshot, baseApi, characterFor, addXpToProgress, xpMul }) {
  const keptPocket = [];
  let lostPocketCount = 0;
  let totalPocketCount = 0;
  (game.usedPocket || []).forEach(stack => {
    const count = stack.count || 1;
    totalPocketCount += count;
    for (let i = 0; i < count; i++) {
      if (random() < RULE_CONFIG.extraction.pocketKeepChance) stackInto(keptPocket, { card: stack.card, count: 1 });
      else lostPocketCount++;
    }
  });
  const byName = new Map();
  (game.ownedCards || []).forEach(entry => {
    const card = entry && entry.card;
    if (!card || baseApi.isSha(card)) return;
    const stack = byName.get(card.name);
    if (stack) stack.count++;
    else byName.set(card.name, { card: { ...card }, count: 1 });
  });
  const resources = { wood: 0, rations: 0 };
  (game.inventory || []).forEach(item => {
    const count = item.count || 1;
    if (item.name === '木材') resources.wood += count;
    else if (item.name === '口粮') resources.rations += count;
  });
  const pending = {
    version: 1, runId, phase: 'organizing', requestSeq: 0,
    remainingCards: [...byName.values()], keptPocket, lostPocketCount, totalPocketCount, resources,
  };
  const base = clone(baseSnapshot);
  base.wood += resources.wood;
  base.rations += resources.rations;
  keptPocket.forEach(stack => {
    if (!baseApi.isSha(stack.card) && stack.card.rarity !== '职业') stackInto(base.pocket, stack);
  });
  base.stats.extracts++;   // 09-24 定版：撤离不再解锁研究所（改钥匙开门，见 game.nest.openNestPrep）
  base.stats.bestRunCoins = Math.max(base.stats.bestRunCoins, game.coins || 0);
  const elapsedNow = Math.max(0, Number(game.elapsed) || 0);
  const elapsedSynced = Math.max(0, Number(game.elapsedSynced) || 0);
  const playDelta = Math.max(0, elapsedNow - elapsedSynced);
  base.stats.playSeconds = Math.max(0, Number(base.stats.playSeconds) || 0) + playDelta;
  addXp(base, game.myClass, extractionXp(firstExploreMoves(game), xpMul), characterFor, addXpToProgress);
  return { pending, base, elapsedSynced: elapsedNow };
}

export function createExtractionCommands({
  getActiveSlot, runStore, baseApi, recovery, game, random,
  makePocketStream = null, restoreRandom = () => {},
  characterFor = () => null, addXpToProgress = () => ({ after: { lv: 1, xp: 0 } }), xpMultiplier = () => 1,
}) {
  let beginAttempt = null;
  const inFlight = new Map();
  const readCurrent = async slotId => {
    if (getActiveSlot() !== slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    const beforeRecovery = runStore.readIdentity(slotId);
    let beforeRunId = beforeRecovery.ok ? beforeRecovery.value.runId : null;
    if (!beforeRunId && beforeRecovery.code === 'RECOVERY_REQUIRED') {
      try { beforeRunId = JSON.parse(globalThis.localStorage.getItem(runStore.key(slotId)) || 'null')?._r2?.runId || null; }
      catch { return fail('RUN_UNREADABLE', '无法读取撤离前的对局身份'); }
    }
    if (!beforeRunId) return beforeRecovery;
    const recovered = await recovery.recoverSlot(slotId);
    if (!recovered.ok) return recovered;
    if (getActiveSlot() !== slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    const identity = runStore.readIdentity(slotId);
    if (!identity.ok) return identity;
    if (identity.value.runId !== beforeRunId) return fail('STALE_RUN', '对局身份已变化，撤离整理请求已取消');
    const run = runStore.read(slotId);
    const base = baseApi._readForCommit(slotId);
    if (!run || !base) return fail('INVALID_STATE', '无法读取撤离整理所需的基地或对局快照');
    return { ok: true, slotId, identity: identity.value, run, base };
  };
  const makeAttempt = (slotId, current, requestId, command, payload, afterBase, afterRun, local = {}) => ({
    slotId, context: { slotId, requestId, expectedBaseRevision: current.base._m01.revision, expectedRunRevision: current.identity.revision },
    command, payload, runId: current.identity.runId, afterBase, afterRun, ...local,
  });
  const commitAttempt = async attempt => {
    if (getActiveSlot() !== attempt.slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    const recovered = await recovery.recoverSlot(attempt.slotId);
    if (!recovered.ok) return recovered;
    if (getActiveSlot() !== attempt.slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    const receipt = await recovery.readSettlementReceipt(attempt.context, {
      command: attempt.command, payload: attempt.payload, runId: attempt.runId,
    });
    if (!receipt.ok) return receipt;
    if (getActiveSlot() !== attempt.slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    if (receipt.value) return { ok: true, value: receipt.value, replayed: true };
    const identity = runStore.readIdentity(attempt.slotId);
    const base = baseApi._readForCommit(attempt.slotId);
    if (!identity.ok || identity.value.runId !== attempt.runId || !base) return fail('STALE_RUN', '对局身份已变化，撤离整理请求已取消');
    if (identity.value.revision !== attempt.context.expectedRunRevision || base._m01.revision !== attempt.context.expectedBaseRevision) {
      return fail('STALE_REVISION', '存档修订已变化，请重试以重新读取当前整理快照', true);
    }
    const committed = await recovery.commitBaseAndRun(attempt.context, {
      command: attempt.command, payload: attempt.payload, runId: attempt.runId,
      afterBase: attempt.afterBase, afterRun: attempt.afterRun, output: attempt.output,
    });
    // 原子提交锁内再次校验修订，也可能在此拒绝尚未写日志的请求。
    return !committed.ok && committed.code === 'STALE_REVISION'
      ? { ...committed, retryable: true, message: '存档修订已变化，请重试以重新读取当前整理快照' }
      : committed;
  };
  const applyAttempt = attempt => {
    const pendingRunId = game.pendingExtraction?.runId;
    const isFreshBegin = attempt.command === 'extractStart' && !pendingRunId;
    if (getActiveSlot() !== attempt.slotId || (!isFreshBegin && pendingRunId !== attempt.runId)) return false;
    if (attempt.afterRun !== null) {
      const identity = runStore.readIdentity(attempt.slotId);
      if (!identity.ok || identity.value.runId !== attempt.runId) return false;
    }
    baseApi._refreshExternal(getActiveSlot());
    if (attempt.afterRun?.pendingExtraction) game.pendingExtraction = attempt.afterRun.pendingExtraction;
    if (attempt.afterRun === null) { game.pendingExtraction = null; game.runActive = false; }
    if (attempt.elapsedSynced != null) game.elapsedSynced = attempt.elapsedSynced;
    if (attempt.randomState) restoreRandom(attempt.randomState);
    return true;
  };
  const readPending = async slotId => {
    const current = await readCurrent(slotId);
    if (!current.ok) return current;
    const pending = current.run.pendingExtraction;
    const checked = validatePendingExtraction(pending);
    if (!checked.ok || pending.runId !== current.identity.runId) return fail('INVALID_EXTRACTION', '撤离整理记录与对局身份不匹配');
    return { ...current, pending };
  };

  async function begin() {
    const slotId = getActiveSlot();
    if (!slotId) {
      const result = calculateBaseAndPending({ game, runId: 'ephemeral', random, baseSnapshot: baseApi.data,
        baseApi, characterFor, addXpToProgress, xpMul: xpMultiplier() });
      Object.assign(baseApi.data, result.base);
      return { ok: true, value: result.pending, ephemeral: true };
    }
    const current = await readCurrent(slotId);
    if (!current.ok) return current;
    if (current.run.pendingExtraction) {
      const pending = current.run.pendingExtraction;
      const checked = validatePendingExtraction(pending);
      if (!checked.ok || pending.runId !== current.identity.runId) return fail('INVALID_EXTRACTION', '已有撤离整理记录无法匹配当前对局');
      if (beginAttempt?.runId === current.identity.runId) { restoreRandom(current.run.rngState); beginAttempt = null; }
      return { ok: true, value: pending, existing: true };
    }
    if (beginAttempt && (beginAttempt.slotId !== slotId || beginAttempt.runId !== current.identity.runId)) beginAttempt = null;
    if (!beginAttempt) {
      const stream = makePocketStream ? makePocketStream(current.run.rngState || { seed: current.run.seed }) : null;
      const result = calculateBaseAndPending({ game, runId: current.identity.runId,
        random: stream ? stream.random : random, baseSnapshot: current.base, baseApi, characterFor,
        addXpToProgress, xpMul: xpMultiplier() });
      const randomState = stream ? stream.snapshot() : null;
      const afterRun = { ...current.run, pendingExtraction: result.pending, battle: null, nestActive: false,
        elapsed: result.elapsedSynced, elapsedSynced: result.elapsedSynced,
        ...(randomState ? { rngState: randomState } : {}) };
      beginAttempt = makeAttempt(slotId, current, `terminal:extract:${current.identity.runId}:0`, 'extractStart',
        { pendingExtraction: result.pending, rngState: randomState }, result.base, afterRun,
        { pending: result.pending, randomState, elapsedSynced: result.elapsedSynced });
    }
    const attempt = beginAttempt;
    const receipt = await commitAttempt(attempt);
    if (!receipt.ok) {
      // STALE_REVISION 只在日志写入前拒绝；下一次重读后可重新准备。
      // 已开始写入或结果不明的失败仍保留令牌，继续恢复同一事务。
      if (receipt.code === 'STALE_REVISION' && beginAttempt === attempt) beginAttempt = null;
      return { ...receipt, runId: attempt.runId };
    }
    applyAttempt(attempt);
    beginAttempt = null;
    return { ok: true, value: attempt.pending };
  }

  function prepareCardAttempt(current, selections) {
    const pending = current.pending;
    const next = clone(pending);
    const afterBase = clone(current.base);
    // 符文与卡牌共占仓容；用本次提交快照计数，不能依赖整理页的旧内存余量。
    const used = (afterBase.runes || []).length + (afterBase.stash || []).reduce((n, stack) => n + (stack.count || 1), 0);
    let room = Math.max(0, baseApi.stashCap() - used);
    let count = 0;
    for (const selection of selections) {
      const stack = next.remainingCards.find(item => item.card.name === selection.name);
      const take = Math.min(stack?.count || 0, selection.count, room);
      if (!stack || take <= 0) continue;
      stackInto(afterBase.stash, { card: stack.card, count: take });
      stack.count -= take;
      room -= take;
      count += take;
    }
    if (!count) return { ok: true, unchanged: true, value: pending, pending };
    next.remainingCards = next.remainingCards.filter(stack => stack.count > 0);
    next.requestSeq++;
    afterBase.stats.stashTotal += count;
    const afterRun = { ...current.run, battle: null, pendingExtraction: next };
    return { ok: true, attempt: makeAttempt(current.slotId, current,
      `terminal:extract:${pending.runId}:${pending.requestSeq}`, 'extractStash',
      { selections: clone(selections), requestSeq: pending.requestSeq }, afterBase, afterRun,
      { nextPending: next, count }) };
  }

  async function updateCards(selections, expectedRunId = game.pendingExtraction?.runId, expectedSlotId = getActiveSlot()) {
    const checkedSelections = validateSelections(selections);
    if (!checkedSelections.ok) return checkedSelections;
    // 在异步读档前冻结本次有效输入；后续调用方修改原数组不能污染待提交快照。
    selections = selections.map(selection => ({ name: selection.name, count: selection.count }));
    const slotId = getActiveSlot();
    if (!slotId) {
      if (expectedSlotId !== null) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
      const checked = validatePendingExtraction(game.pendingExtraction);
      if (!checked.ok) return checked;
      const attempt = prepareCardAttempt({ slotId: null, identity: { runId: game.pendingExtraction.runId, revision: 0 }, run: { pendingExtraction: game.pendingExtraction },
        base: clone(baseApi.data), pending: game.pendingExtraction }, selections);
      if (!attempt.ok || attempt.unchanged) return attempt;
      Object.assign(baseApi.data, attempt.attempt.afterBase);
      game.pendingExtraction = attempt.attempt.nextPending;
      return { ok: true, value: game.pendingExtraction, count: attempt.attempt.count, ephemeral: true };
    }
    if (expectedSlotId !== slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    if (expectedRunId !== game.pendingExtraction?.runId) return fail('STALE_RUN', '当前整理页已过期，请重新载入撤离整理');
    const key = `${slotId}:${expectedRunId}`;
    let attempt = inFlight.get(key);
    if (!attempt) {
      const current = await readPending(slotId);
      if (!current.ok) return current;
      if (current.pending.runId !== expectedRunId) return fail('STALE_RUN', '当前整理页已过期，请重新载入撤离整理');
      const prepared = prepareCardAttempt(current, selections);
      if (!prepared.ok || prepared.unchanged) return prepared;
      attempt = prepared.attempt;
      inFlight.set(key, attempt);
    }
    if (attempt.command !== 'extractStash') return fail('REQUEST_PENDING', '完成整理正在等待重试，请点击「完成整理」继续恢复', true);
    const receipt = await commitAttempt(attempt);
    // 日志前的修订拒绝可丢弃；after-base/after-run 等中断或未确认结果必须
    // 保留同一令牌，经恢复日志和 receipt 重放保证卡牌只入库一次。
    if (!receipt.ok) {
      if (receipt.code === 'STALE_REVISION' && inFlight.get(key) === attempt) inFlight.delete(key);
      return receipt;
    }
    applyAttempt(attempt);
    inFlight.delete(key);
    return { ok: true, value: attempt.nextPending, count: attempt.count, replayed: !!receipt.replayed };
  }

  async function finish(expectedRunId = game.pendingExtraction?.runId, expectedSlotId = getActiveSlot()) {
    const slotId = getActiveSlot();
    if (!slotId) {
      if (expectedSlotId !== null) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
      // 2026-10-03 老板（SYS-02）：测试投影局也产回执（内存态），页面与记录走同一条读数路径
      const receipt = game.pendingExtraction
        ? buildExtractionReceipt({ game, pending: game.pendingExtraction, isSha: baseApi.isSha, xpMul: xpMultiplier() })
        : null;
      game.pendingExtraction = null; game.runActive = false;
      return { ok: true, ephemeral: true, ...(receipt ? { receipt } : {}) };
    }
    if (expectedSlotId !== slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    if (expectedRunId !== game.pendingExtraction?.runId) return fail('STALE_RUN', '当前整理页已过期，请重新载入撤离整理');
    const key = `${slotId}:${expectedRunId}`;
    let attempt = inFlight.get(key);
    if (!attempt) {
      const current = await readPending(slotId);
      if (!current.ok) return current;
      if (current.pending.runId !== expectedRunId) return fail('STALE_RUN', '当前整理页已过期，请重新载入撤离整理');
      // 2026-10-03 老板（SYS-02）：结算回执随 extractFinish 事务收据持久化（output 位）——
      // 重试/刷新后重建 attempt 重算结果一致；已提交过则经 readSettlementReceipt 原样重放，不重复累计。
      const receipt = buildExtractionReceipt({ game, pending: current.pending, isSha: baseApi.isSha, xpMul: xpMultiplier() });
      attempt = makeAttempt(slotId, current, `terminal:extract:${expectedRunId}:${current.pending.requestSeq}:finish`,
        'extractFinish', { requestSeq: current.pending.requestSeq }, current.base, null, { output: { receipt } });
      inFlight.set(key, attempt);
    }
    if (attempt.command !== 'extractFinish') return fail('REQUEST_PENDING', '上一项整理正在重试，请稍后再操作', true);
    const receipt = await commitAttempt(attempt);
    if (!receipt.ok) {
      if (receipt.code === 'STALE_REVISION' && inFlight.get(key) === attempt) inFlight.delete(key);
      return receipt;   // 其余失败与 updateCards 一样保留恢复令牌
    }
    applyAttempt(attempt);
    inFlight.delete(key);
    return { ok: true, value: receipt.value, replayed: !!receipt.replayed };
  }

  return Object.freeze({ begin, updateCards, finish });
}
