// @ts-check
import { clone, fail, freezeDeep, validSlot } from './commands.shared.js';

/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementNode} BattleSettlementNode */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementContext} BattleSettlementContext */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementPayload} BattleSettlementPayload */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementReceipt} BattleSettlementReceipt */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementAttempt} BattleSettlementAttempt */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementBaseSnapshot} BattleSettlementBaseSnapshot */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementRunSnapshot} BattleSettlementRunSnapshot */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementCommands} BattleSettlementCommands */
/** @typedef {import('./battle-settlement.commands.types.js').CreateBattleSettlementCommandsOptions} CreateBattleSettlementCommandsOptions */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementFailure} BattleSettlementFailure */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementBaseRead} BattleSettlementBaseRead */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementReceiptLookup} BattleSettlementReceiptLookup */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementAttemptResult} BattleSettlementAttemptResult */
/** @typedef {import('./battle-settlement.commands.types.js').BattleSettlementCommitResult} BattleSettlementCommitResult */

const COMMAND = 'battle.win';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }

/** @param {BattleSettlementNode} node */
function validateNode(node) {
  if (!node || !Number.isInteger(node.layerIdx) || node.layerIdx < 0 || node.layerIdx > 3 ||
      !Number.isInteger(node.trackPos) || node.trackPos < 0 || typeof node.isBoss !== 'boolean' ||
      (node.encounterId !== undefined && node.encounterId !== null && typeof node.encounterId !== 'string')) {
    return fail('INVALID_ARGUMENT', '战斗节点身份无效');
  }
  return null;
}

/** @param {BattleSettlementNode} node */
function nodeKey(node) { return `${node.layerIdx},${node.trackPos}`; }

/** @param {string} runId @param {BattleSettlementNode} node */
function requestId(runId, node) { return `battle-win:${runId}:${nodeKey(node)}`; }

/** @param {BattleSettlementNode} node @returns {BattleSettlementPayload} */
function payloadFor(node) {
  return Object.freeze({ layerIdx: node.layerIdx, trackPos: node.trackPos, isBoss: node.isBoss, encounterId: node.encounterId ?? null });
}

/**
 * Persist ordinary expedition victory rewards and the completed run checkpoint as one recoverable pair.
 * The stable map-node request identity permits receipt lookup after journal recovery without rerolling loot.
 * @param {CreateBattleSettlementCommandsOptions} options
 * @returns {BattleSettlementCommands}
 */
export function createBattleSettlementCommands(options) {
  const getBase = options.getBase;
  const getRunStorage = options.getRunStorage;
  const getRecovery = options.getRecovery;
  const getActiveSlot = options.getActiveSlot;

  /** @param {number} slotId @param {BattleSettlementNode} node */
  function validateScope(slotId, node) {
    const invalidNode = validateNode(node);
    if (invalidNode) return invalidNode;
    if (!validSlot(slotId)) return fail('INVALID_ARGUMENT', 'slotId 必须为 1～5');
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    return null;
  }

  /** @param {number} slotId */
  /** @param {number} slotId @returns {Promise<BattleSettlementFailure|null>} */
  async function recover(slotId) {
    const result = await getRecovery().recoverSlot(slotId);
    return result.ok === true ? null : result;
  }

  /** @param {number} slotId */
  function readIdentity(slotId) {
    return getRunStorage().readIdentity(slotId);
  }

  /** @param {number} slotId */
  /** @param {number} slotId @returns {BattleSettlementBaseRead} */
  function readBase(slotId) {
    let value;
    try { value = getBase()._readForCommit(slotId); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取基地结算快照', true); }
    if (!value) return fail('STORAGE_READ_FAILED', '无法读取基地结算快照', false, { issue: getBase().issue(slotId) });
    const revision = value._m01?.revision;
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 0) return fail('RECOVERY_BLOCKED', '基地事务版本不可用');
    return { ok: true, value: /** @type {BattleSettlementBaseSnapshot} */ (clone(value)), revision };
  }

  /** @param {BattleSettlementNode} node @param {BattleSettlementContext} context @param {string} runId */
  /** @param {BattleSettlementContext} context @param {BattleSettlementNode} node @param {string} runId @returns {Promise<import('./battle-settlement.commands.types.js').BattleSettlementReceiptLookup>} */
  async function lookup(context, node, runId) {
    const payload = payloadFor(node);
    const result = await getRecovery().readSettlementReceipt(context, { command: COMMAND, payload, runId });
    if (result.ok === false) return result;
    if (!result.value) return { ok: true, value: null, replay: false };

    const liveIdentity = readIdentity(context.slotId);
    if (liveIdentity.ok === false || liveIdentity.value.runId !== runId ||
        liveIdentity.value.revision !== result.value.runRevision) {
      return fail('STALE_RUN', '本场结算已完成，但对局已继续变化；请重新载入当前对局');
    }
    let liveRun;
    try { liveRun = getRunStorage().read(context.slotId); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取已结算对局', true); }
    if (!liveRun || liveRun.visited?.[nodeKey(node)] !== 1) {
      return fail('RECOVERY_BLOCKED', '结算收据与已完成节点不匹配');
    }
    if (getActiveSlot() !== context.slotId || getBase().slot !== context.slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    return { ok: true, value: /** @type {BattleSettlementReceipt} */ (result.value), replay: true };
  }

  /** @param {{slotId:number,node:BattleSettlementNode}} input @returns {Promise<BattleSettlementReceiptLookup>} */
  async function readReceipt(input) {
    const invalid = validateScope(input?.slotId, input?.node);
    if (invalid) return invalid;
    const slotId = input.slotId;
    let node;
    try { node = freezeDeep(clone(input.node)); }
    catch { return fail('INVALID_ARGUMENT', '战斗节点身份无法序列化'); }
    const startingIdentity = readIdentity(slotId);
    if (startingIdentity.ok === false) {
      if (startingIdentity.code !== 'RECOVERY_REQUIRED') return startingIdentity;
      const recovered = await recover(slotId);
      return recovered || fail('RETRY_REQUIRED', '存档已恢复，请重新确认本场结算');
    }
    const recovered = await recover(slotId);
    if (recovered) return recovered;
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    const currentIdentity = readIdentity(slotId);
    if (!currentIdentity.ok || currentIdentity.value.runId !== startingIdentity.value.runId ||
        currentIdentity.value.revision !== startingIdentity.value.revision) return fail('STALE_RUN', '对局已变化，请重新载入后继续');
    const base = readBase(slotId);
    if (base.ok === false) return base;
    const context = {
      slotId, requestId: requestId(currentIdentity.value.runId, node),
      expectedBaseRevision: base.revision, expectedRunRevision: currentIdentity.value.revision,
    };
    const prior = await lookup(context, node, currentIdentity.value.runId);
    if (prior.ok === false) return prior;
    const afterIdentity = readIdentity(slotId);
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    if (afterIdentity.ok === false || afterIdentity.value.runId !== currentIdentity.value.runId ||
        afterIdentity.value.revision !== currentIdentity.value.revision) return fail('STALE_RUN', '对局已变化，请重新载入后继续');
    return prior;
  }

  /** @param {{slotId:number,node:BattleSettlementNode,afterRun:BattleSettlementRunSnapshot,elapsedDelta:number}} input @returns {Promise<BattleSettlementAttemptResult>} */
  async function createAttempt(input) {
    const invalid = validateScope(input?.slotId, input?.node);
    if (invalid) return invalid;
    if (!Number.isFinite(input.elapsedDelta) || input.elapsedDelta < 0) return fail('INVALID_ARGUMENT', 'elapsedDelta 必须是非负有限数');
    const slotId = input.slotId;
    const elapsedDelta = input.elapsedDelta;
    let node, snapshot;
    try {
      node = freezeDeep(clone(input.node));
      snapshot = clone(input.afterRun);
    } catch { return fail('INVALID_ARGUMENT', '战后对局快照无法序列化'); }
    if (!snapshot || snapshot.layerIdx !== node.layerIdx || snapshot.trackPos !== node.trackPos ||
        !isRecord(snapshot.visited) || snapshot.visited[nodeKey(node)] !== 1) {
      return fail('INVALID_ARGUMENT', 'afterRun 必须包含当前节点坐标及已完成 visited 标记');
    }
    // Capture run ownership before awaiting recovery; never bind a stale snapshot to a newly opened run.
    const startingIdentity = readIdentity(slotId);
    if (startingIdentity.ok === false) {
      if (startingIdentity.code !== 'RECOVERY_REQUIRED') return startingIdentity;
      const recovered = await recover(slotId);
      return recovered || fail('RETRY_REQUIRED', '存档已恢复，请重新确认本场结算');
    }
    const recovered = await recover(slotId);
    if (recovered) return recovered;
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    const liveIdentity = readIdentity(slotId);
    if (liveIdentity.ok === false || liveIdentity.value.runId !== startingIdentity.value.runId ||
        liveIdentity.value.revision !== startingIdentity.value.revision) return fail('STALE_RUN', '对局已变化，旧结算已取消');
    const base = readBase(slotId);
    if (base.ok === false) return base;
    const context = {
      slotId, requestId: requestId(liveIdentity.value.runId, node),
      expectedBaseRevision: base.revision, expectedRunRevision: liveIdentity.value.revision,
    };
    const prior = await lookup(context, node, liveIdentity.value.runId);
    if (prior.ok === false) return prior;
    const stillCurrent = readIdentity(slotId);
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    if (stillCurrent.ok === false || stillCurrent.value.runId !== liveIdentity.value.runId ||
        stillCurrent.value.revision !== liveIdentity.value.revision) return fail('STALE_RUN', '对局已变化，旧结算已取消');
    if (prior.replay) return { ok: true, replay: true, receipt: prior.value };

    const baseSnapshot = clone(base.value);
    const stats = isRecord(baseSnapshot.stats) ? baseSnapshot.stats : {};
    const oldSeconds = Number(stats.playSeconds);
    const nextStats = {
      ...stats,
      playSeconds: (Number.isFinite(oldSeconds) ? oldSeconds : 0) + elapsedDelta,
    };
    const eggBattles = (Number(baseSnapshot.eggBattles) || 0) + 1;
    const afterBase = { ...baseSnapshot, stats: nextStats, eggBattles };
    const payload = payloadFor(node);
    /** @type {BattleSettlementAttempt} */
    const attempt = freezeDeep({
      context, command: COMMAND, runId: liveIdentity.value.runId, payload,
      afterBase, afterRun: clone(snapshot), output: { eggBattles },
    });
    const finalIdentity = readIdentity(slotId);
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    if (finalIdentity.ok === false || finalIdentity.value.runId !== liveIdentity.value.runId ||
        finalIdentity.value.revision !== liveIdentity.value.revision) return fail('STALE_RUN', '对局已变化，旧结算已取消');
    const finalBase = readBase(slotId);
    if (finalBase.ok === false) return finalBase;
    if (finalBase.revision !== base.revision) return fail('STALE_REVISION', '基地已变化，请重试战后结算', true);
    return { ok: true, replay: false, attempt };
  }

  /** @param {BattleSettlementAttempt} attempt @returns {Promise<BattleSettlementCommitResult>} */
  async function commitAttempt(attempt) {
    if (!attempt || attempt.command !== COMMAND || !attempt.context || !attempt.runId ||
        !attempt.payload || !attempt.afterBase || !attempt.afterRun) return fail('INVALID_ARGUMENT', '战斗结算尝试无效');
    const { slotId } = attempt.context;
    if (!validSlot(slotId) || getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    const recovered = await recover(slotId);
    if (recovered) return recovered;
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    const liveIdentity = readIdentity(slotId);
    if (liveIdentity.ok === false || liveIdentity.value.runId !== attempt.runId) return fail('STALE_RUN', '对局已变化，旧结算已取消');
    const prior = await lookup(attempt.context, attempt.payload, attempt.runId);
    if (prior.ok === false) return prior;
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '档位已切换，旧结算已取消');
    const afterLookupIdentity = readIdentity(slotId);
    if (afterLookupIdentity.ok === false || afterLookupIdentity.value.runId !== attempt.runId) return fail('STALE_RUN', '对局已变化，旧结算已取消');
    if (prior.replay) {
      if (afterLookupIdentity.value.revision !== prior.value.runRevision) return fail('STALE_RUN', '本场结算已完成，但对局已继续变化；请重新载入当前对局');
      return { ok: true, replay: true, receipt: prior.value };
    }
    if (afterLookupIdentity.value.revision !== attempt.context.expectedRunRevision) return fail('STALE_RUN', '对局已变化，旧结算已取消');
    const base = readBase(slotId);
    if (base.ok === false) return base;
    if (base.revision !== attempt.context.expectedBaseRevision) return fail('STALE_REVISION', '基地已变化，请重新载入后重试', true);
    const result = await getRecovery().commitBaseAndRun(attempt.context, {
      command: COMMAND, runId: attempt.runId, payload: attempt.payload,
      afterBase: attempt.afterBase, afterRun: attempt.afterRun, output: attempt.output,
    });
    if (result.ok === false) return result;
    if (getActiveSlot() !== slotId || getBase().slot !== slotId) return fail('STALE_SLOT', '结算已落盘，但档位已切换');
    const committedIdentity = readIdentity(slotId);
    if (committedIdentity.ok === false || committedIdentity.value.runId !== attempt.runId ||
        committedIdentity.value.revision !== result.value.runRevision) return fail('STALE_RUN', '结算已落盘，但对局已继续变化');
    return { ok: true, replay: false, receipt: result.value };
  }

  return Object.freeze({ readReceipt, createAttempt, commitAttempt });
}
