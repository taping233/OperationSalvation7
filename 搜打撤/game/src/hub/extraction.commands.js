import { clone, fail } from './commands.shared.js';

function validStack(stack) {
  return !!stack && typeof stack === 'object' && !Array.isArray(stack) &&
    !!stack.card && typeof stack.card === 'object' && !Array.isArray(stack.card) &&
    typeof stack.card.name === 'string' && Number.isInteger(stack.count) && stack.count > 0;
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
    return fail('INVALID_EXTRACTION', '撤离消耗口袋概率结果计数无效');
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

function calculateBaseAndPending({ game, runId, random, baseSnapshot, baseApi, characterFor, addXpToProgress, xpMul }) {
  const keptPocket = [];
  let lostPocketCount = 0;
  let totalPocketCount = 0;
  (game.usedPocket || []).forEach(stack => {
    const count = stack.count || 1;
    totalPocketCount += count;
    for (let i = 0; i < count; i++) {
      if (random() < 1 / 3) stackInto(keptPocket, { card: stack.card, count: 1 });
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
  addXp(base, game.myClass, Math.round((20 + Math.max(0, game.turn - 1) * 2) * xpMul), characterFor, addXpToProgress);
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
      return fail('STALE_REVISION', '存档修订已变化，撤离整理可重新载入后重试', true);
    }
    return recovery.commitBaseAndRun(attempt.context, {
      command: attempt.command, payload: attempt.payload, runId: attempt.runId,
      afterBase: attempt.afterBase, afterRun: attempt.afterRun, output: attempt.output,
    });
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
    if (!receipt.ok) return { ...receipt, runId: attempt.runId };
    applyAttempt(attempt);
    beginAttempt = null;
    return { ok: true, value: attempt.pending };
  }

  function prepareCardAttempt(current, selections) {
    const pending = current.pending;
    const next = clone(pending);
    const afterBase = clone(current.base);
    let room = Math.max(0, baseApi.stashCap() - (afterBase.stash || []).reduce((n, stack) => n + (stack.count || 1), 0));
    let count = 0;
    for (const selection of selections || []) {
      const stack = next.remainingCards.find(item => item.card.name === selection.name);
      const take = Math.min(stack?.count || 0, Math.max(0, Number(selection.count) || 0), room);
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
    const receipt = await commitAttempt(attempt);
    if (!receipt.ok) return receipt;
    applyAttempt(attempt);
    inFlight.delete(key);
    return { ok: true, value: attempt.nextPending, count: attempt.count, replayed: !!receipt.replayed };
  }

  async function finish(expectedRunId = game.pendingExtraction?.runId, expectedSlotId = getActiveSlot()) {
    const slotId = getActiveSlot();
    if (!slotId) {
      if (expectedSlotId !== null) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
      game.pendingExtraction = null; game.runActive = false; return { ok: true, ephemeral: true };
    }
    if (expectedSlotId !== slotId) return fail('STALE_SLOT', '档位已切换，撤离整理请求已取消');
    if (expectedRunId !== game.pendingExtraction?.runId) return fail('STALE_RUN', '当前整理页已过期，请重新载入撤离整理');
    const key = `${slotId}:${expectedRunId}`;
    let attempt = inFlight.get(key);
    if (!attempt) {
      const current = await readPending(slotId);
      if (!current.ok) return current;
      if (current.pending.runId !== expectedRunId) return fail('STALE_RUN', '当前整理页已过期，请重新载入撤离整理');
      attempt = makeAttempt(slotId, current, `terminal:extract:${expectedRunId}:${current.pending.requestSeq}:finish`,
        'extractFinish', { requestSeq: current.pending.requestSeq }, current.base, null);
      inFlight.set(key, attempt);
    }
    if (attempt.command !== 'extractFinish') return fail('REQUEST_PENDING', '上一项整理正在重试，请稍后再操作', true);
    const receipt = await commitAttempt(attempt);
    if (!receipt.ok) return receipt;
    applyAttempt(attempt);
    inFlight.delete(key);
    return { ok: true, value: receipt.value, replayed: !!receipt.replayed };
  }

  return Object.freeze({ begin, updateCards, finish });
}
