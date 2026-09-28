// @ts-check

import { clone, fail } from './commands.shared.js';

/** @typedef {{ [key: string]: unknown, stats?: Record<string, unknown>, runes?: unknown[], _m01?: { revision?: unknown } }} NestBaseSnapshot */
/** @typedef {{ runId: string, revision: number }} NestRunIdentity */
/** @typedef {{ ok: true, value: NestRunIdentity } | { ok: false, code: string, message?: string }} NestIdentityResult */
/** @typedef {{ ok: false, code: string, message?: string, retryable?: boolean }} NestFailure */
/** @typedef {{ ok: true, value: unknown, revision?: number } | NestFailure} NestRecoveryResult */
/** @typedef {{ requestId: string, expectedBaseRevision: number, expectedRunRevision: number, slotId: number }} NestContext */
/** @typedef {{ command: string, runId: string, payload: { runId: string }, afterBase: NestBaseSnapshot, afterRun: null, output: NestSettlementOutput, context: NestContext }} NestAttempt */
/** @typedef {{ labTotalScore: number, labBestScore: number, labRuns: number, playSeconds: number }} NestSettlementOutput */
/** @typedef {{ replay: true, receipt: unknown }} NestReplay */
/** @typedef {{ ok: true, value: NestAttempt | NestReplay } | NestFailure} NestCreateAttemptResult */
/** @typedef {{ replay: boolean, receipt?: unknown }} NestSettlementValue */
/** @typedef {{ ok: true, value: NestSettlementValue } | NestFailure} NestSettlementResult */
/** @typedef {{ getActiveSlot: () => number | null, getBase: () => { _readForCommit: (slotId: number) => NestBaseSnapshot | null }, getRunStorage: () => { readIdentity: (slotId: number) => NestIdentityResult }, getRecovery: () => { recoverSlot: (slotId: number) => Promise<NestRecoveryResult>, readSettlementReceipt: (context: NestContext, identity: { command: string, payload: { runId: string }, runId: string }) => Promise<NestRecoveryResult>, commitBaseAndRun: (context: NestContext, prepared: Omit<NestAttempt, 'context'>) => Promise<NestRecoveryResult> } }} NestSettlementPorts */
/** @typedef {{ slotId: number, runId: string, runes: unknown[], score: number, elapsedDelta: number }} NestSettlementInput */

const COMMAND = 'nest.extract';

/**
 * Commits the lab rewards and removal of its run through the existing recoverable Base/Run pair.
 * Attempts are cached only while retryable so a retry can recover an uncertain journal result.
 * @param {NestSettlementPorts} ports
 */
export function createNestSettlementCommands({ getActiveSlot, getBase, getRunStorage, getRecovery }) {
  /** @type {Map<string, NestAttempt>} */
  const attempts = new Map();
  /** @type {Map<string, Promise<NestSettlementResult>>} */
  const inFlight = new Map();

  /** @param {number} slotId @param {string} runId */
  const keyOf = (slotId, runId) => `${slotId}:${runId}`;
  /** @param {number} slotId */
  const currentSlot = slotId => getActiveSlot() === slotId;

  /** @param {NestSettlementInput} input @returns {Promise<NestCreateAttemptResult>} */
  async function createAttempt(input) {
    const { slotId, runId } = input;
    if (!Number.isInteger(slotId) || slotId < 1 || slotId > 5 || !runId) return fail('INVALID_ARGUMENT', '研究所撤离身份无效');
    if (!currentSlot(slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');

    const recovery = getRecovery();
    const recovered = await recovery.recoverSlot(slotId);
    if (!recovered.ok) return recovered;
    if (!currentSlot(slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');

    // Look up the stable request receipt before requiring a live Run record: afterRun:null
    // deliberately deletes that record, and an interrupted commit may have just recovered it.
    const payload = { runId };
    const receiptContext = { slotId, requestId: `nest-extract:${runId}`, expectedBaseRevision: 0, expectedRunRevision: 0 };
    const prior = await recovery.readSettlementReceipt(receiptContext, { command: COMMAND, payload, runId });
    if (!prior.ok) return prior;
    if (prior.value) return { ok: true, value: { replay: true, receipt: prior.value } };
    if (!currentSlot(slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');

    const runStore = getRunStorage();
    const identity = runStore.readIdentity(slotId);
    if (!identity.ok) return identity;
    if (identity.value.runId !== runId) return fail('STALE_RUN', '研究所对局已变化，撤离已取消');

    const base = getBase();
    let beforeBase;
    try { beforeBase = base._readForCommit(slotId); }
    catch { return fail('STORAGE_READ_FAILED', '无法读取研究所撤离所需的基地快照', true); }
    const beforeRevision = beforeBase?._m01?.revision;
    if (!beforeBase || typeof beforeRevision !== 'number' || !Number.isInteger(beforeRevision)) {
      return fail('RECOVERY_BLOCKED', '基地事务版本不可用');
    }

    const context = {
      slotId,
      requestId: `nest-extract:${runId}`,
      expectedBaseRevision: beforeRevision,
      expectedRunRevision: identity.value.revision,
    };
    if (!currentSlot(slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');

    const finalIdentity = runStore.readIdentity(slotId);
    let finalBase;
    try { finalBase = base._readForCommit(slotId); }
    catch { return fail('STORAGE_READ_FAILED', '无法复核研究所撤离快照', true); }
    if (!finalIdentity.ok || finalIdentity.value.runId !== runId ||
        finalIdentity.value.revision !== identity.value.revision ||
        !finalBase || finalBase._m01?.revision !== context.expectedBaseRevision) {
      return fail('STALE_REVISION', '基地或研究所进度已变化，请重试撤离', true);
    }

    const afterBase = clone(finalBase);
    afterBase.runes = [...(Array.isArray(afterBase.runes) ? afterBase.runes : []), ...clone(input.runes)];
    afterBase.stats = afterBase.stats && typeof afterBase.stats === 'object' ? afterBase.stats : {};
    const stats = afterBase.stats;
    const score = Number(input.score) || 0;
    stats.labTotalScore = (Number(stats.labTotalScore) || 0) + score;
    stats.labBestScore = Math.max(Number(stats.labBestScore) || 0, score);
    stats.labRuns = (Number(stats.labRuns) || 0) + 1;
    const elapsedDelta = Math.max(0, Number(input.elapsedDelta) || 0);
    stats.playSeconds = Math.max(0, Number(stats.playSeconds) || 0) + elapsedDelta;

    const output = {
      labTotalScore: Number(stats.labTotalScore) || 0,
      labBestScore: Number(stats.labBestScore) || 0,
      labRuns: Number(stats.labRuns) || 0,
      playSeconds: Number(stats.playSeconds) || 0,
    };
    return {
      ok: true,
      value: {
        context,
        command: COMMAND,
        runId,
        payload,
        afterBase,
        afterRun: null,
        output,
      },
    };
  }

  /** @param {NestAttempt} attempt @returns {Promise<NestSettlementResult>} */
  async function commitAttempt(attempt) {
    const { context, runId, payload } = attempt;
    if (!currentSlot(context.slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');
    const recovery = getRecovery();
    const recovered = await recovery.recoverSlot(context.slotId);
    if (!recovered.ok) return recovered;
    if (!currentSlot(context.slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');

    const prior = await recovery.readSettlementReceipt(context, { command: COMMAND, payload, runId });
    if (!prior.ok) return prior;
    if (prior.value) return { ok: true, value: { replay: true, receipt: prior.value } };

    const identity = getRunStorage().readIdentity(context.slotId);
    let base;
    try { base = getBase()._readForCommit(context.slotId); }
    catch { return fail('STORAGE_READ_FAILED', '无法复核研究所撤离快照', true); }
    if (!identity.ok || identity.value.runId !== runId || identity.value.revision !== context.expectedRunRevision ||
        !base || base._m01?.revision !== context.expectedBaseRevision) {
      return fail('STALE_REVISION', '基地或研究所进度已变化，请重新进入后重试撤离', true);
    }
    if (!currentSlot(context.slotId)) return fail('STALE_SLOT', '档位已切换，研究所撤离已取消');

    const committed = await recovery.commitBaseAndRun(context, {
      command: COMMAND,
      runId,
      payload,
      afterBase: attempt.afterBase,
      afterRun: null,
      output: attempt.output,
    });
    if (!committed.ok) return committed;
    return { ok: true, value: { replay: false, receipt: committed.value } };
  }

  /** @param {NestSettlementInput} input @returns {Promise<NestSettlementResult>} */
  async function settle(input) {
    let snapshot;
    try { snapshot = { ...input, runes: clone(input.runes) }; }
    catch { return fail('INVALID_ARGUMENT', '带回符文必须是可序列化数据'); }
    const key = keyOf(snapshot.slotId, snapshot.runId);
    const pending = inFlight.get(key);
    if (pending) return pending;
    /** @type {Promise<NestSettlementResult>} */
    const work = (async () => {
      let attempt = attempts.get(key);
      if (!attempt) {
        const created = await createAttempt(snapshot);
        if (!created.ok) return created;
        if ('replay' in created.value) return { ok: /** @type {true} */ (true), value: created.value };
        attempt = created.value;
        attempts.set(key, attempt);
      }
      const result = await commitAttempt(attempt);
      if (result.ok || ['STALE_SLOT', 'STALE_RUN', 'STALE_REVISION'].includes(result.code)) {
        attempts.delete(key);
      }
      return result;
    })();
    inFlight.set(key, work);
    try { return await work; }
    finally { if (inFlight.get(key) === work) inFlight.delete(key); }
  }

  return Object.freeze({ settle });
}
