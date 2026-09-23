import { characterFor } from './characters.js';
import { addXpToProgress } from './meta.js';

const clone = value => JSON.parse(JSON.stringify(value));
const failure = (code, message, retryable = false) => ({ ok: false, code, message, retryable });

function applyCards(base, cards, isSha) {
  for (const item of cards || []) {
    const card = item && item.card;
    if (!card || isSha(card)) continue;
    const count = Math.max(1, Number(item.count) || 1);
    const stack = base.stash.find(x => x.card && x.card.name === card.name);
    if (stack) stack.count = (Number(stack.count) || 0) + count;
    else base.stash.push({ card: clone(card), count });
  }
}

/** Build stable death/abandonment attempts without capturing Base or storage during module evaluation. */
export function createTerminalCommands({ getBase, getRunStorage, getRecovery, getActiveSlot, syncPlayTime = () => {} }) {
  const currentSlot = slotId => getActiveSlot() === slotId;

  function projectEphemeral({ command, cards = [], deathClass = null }) {
    const base = getBase().data;
    base.stash ||= [];
    applyCards(base, cards, getBase().isSha);
    let levelsGained = 0;
    if (command === 'run.death') {
      base.stats ||= {};
      base.stats.deaths = (Number(base.stats.deaths) || 0) + 1;
      if (deathClass) {
        const character = characterFor(deathClass);
        const progressMap = character ? (base.characters ||= {}) : (base.classes ||= {});
        const progressKey = character ? character.id : deathClass;
        progressMap[progressKey] ||= { lv: 1, xp: 0 };
        const progress = addXpToProgress(progressMap[progressKey], 5);
        progressMap[progressKey] = { ...progress.after };
        levelsGained = progress.levelsGained;
      }
    }
    return Object.freeze({ levelsGained });
  }

  async function createAttempt({ slotId, command, cards = [], deathClass = null }) {
    if (!Number.isInteger(slotId) || slotId < 1 || slotId > 5 || !['run.death', 'run.abandon'].includes(command)) {
      return failure('INVALID_ARGUMENT', '终局结算参数无效');
    }
    if (!currentSlot(slotId)) return failure('STALE_SLOT', '档位已切换，请重新进入当前对局');
    const recovery = getRecovery();
    const runStore = getRunStorage();
    // Capture identity before the first await. A same-slot new run must never inherit this call's old card payload.
    const startingIdentity = runStore.readIdentity(slotId);
    if (!startingIdentity.ok) {
      const recovered = await recovery.recoverSlot(slotId);
      if (!recovered.ok) return recovered;
      return failure('RETRY_REQUIRED', '存档已恢复，请重新确认终局操作');
    }
    const recovered = await recovery.recoverSlot(slotId);
    if (!recovered.ok) return recovered;
    if (!currentSlot(slotId)) return failure('STALE_SLOT', '档位已切换，旧结算已取消');

    const runIdentity = runStore.readIdentity(slotId);
    if (!runIdentity.ok || runIdentity.value.runId !== startingIdentity.value.runId ||
        runIdentity.value.revision !== startingIdentity.value.revision) return failure('STALE_RUN', '对局已变化，旧结算已取消');
    // Keep the legacy elapsed-time checkpoint, after recovery and same-run validation so it cannot write across runs.
    syncPlayTime();
    const base = getBase();
    let afterBase;
    try { afterBase = base._readForCommit(slotId); }
    catch { return failure('STORAGE_READ_FAILED', '无法读取基地结算快照', true); }
    if (!afterBase || !Number.isInteger(afterBase._m01?.revision)) return failure('RECOVERY_BLOCKED', '基地事务版本不可用');

    const safeCards = clone(cards);
    const runId = runIdentity.value.runId;
    const payload = { cards: safeCards, deathClass: command === 'run.death' ? (deathClass || null) : null };
    const requestId = `terminal:${command}:${runId}`;
    const context = {
      slotId, requestId, expectedBaseRevision: afterBase._m01.revision,
      expectedRunRevision: runIdentity.value.revision,
    };
    const receipt = await recovery.readSettlementReceipt(context, { command, payload, runId });
    if (!receipt.ok) return receipt;
    if (receipt.value) return { ok: true, replay: true, receipt: receipt.value, attempt: null };

    // readSettlementReceipt is lock-protected; reject a slot/run switch before returning the attempt.
    if (!currentSlot(slotId)) return failure('STALE_SLOT', '档位已切换，旧结算已取消');
    const stillCurrent = runStore.readIdentity(slotId);
    if (!stillCurrent.ok || stillCurrent.value.runId !== runId || stillCurrent.value.revision !== runIdentity.value.revision) {
      return failure('STALE_RUN', '对局已变化，旧结算已取消');
    }
    if (receipt.revision !== afterBase._m01.revision) return failure('STALE_REVISION', '基地已变化，请重试终局结算', true);

    try {
      afterBase = clone(afterBase);
      afterBase.stash ||= [];
      applyCards(afterBase, safeCards, base.isSha);
      let levelsGained = 0;
      if (command === 'run.death') {
        afterBase.stats ||= {};
        afterBase.stats.deaths = (Number(afterBase.stats.deaths) || 0) + 1;
        if (deathClass) {
          const character = characterFor(deathClass);
          const progressMap = character ? (afterBase.characters ||= {}) : (afterBase.classes ||= {});
          const progressKey = character ? character.id : deathClass;
          progressMap[progressKey] ||= { lv: 1, xp: 0 };
          const progress = addXpToProgress(progressMap[progressKey], 5);
          progressMap[progressKey] = { ...progress.after };
          levelsGained = progress.levelsGained;
        }
      }
      const attempt = Object.freeze({
        context: Object.freeze(context), command, runId, payload: Object.freeze(payload),
        afterBase: Object.freeze(afterBase), output: Object.freeze({ levelsGained }),
      });
      return { ok: true, replay: false, attempt };
    } catch { return failure('INVALID_ARGUMENT', '终局数据无法序列化'); }
  }

  async function commitAttempt(attempt) {
    if (!attempt || !attempt.context || !attempt.runId) return failure('INVALID_ARGUMENT', '终局结算请求无效');
    const slotId = attempt.context.slotId;
    if (!currentSlot(slotId)) return failure('STALE_SLOT', '档位已切换，旧结算已取消');
    const recovery = getRecovery();
    const recovered = await recovery.recoverSlot(slotId);
    if (!recovered.ok) return recovered;
    if (!currentSlot(slotId)) return failure('STALE_SLOT', '档位已切换，旧结算已取消');

    // A retry may already have removed the run. Check its stable receipt before requiring a live run identity.
    const prior = await recovery.readSettlementReceipt(attempt.context, {
      command: attempt.command, payload: attempt.payload, runId: attempt.runId,
    });
    if (!prior.ok) return prior;
    if (prior.value) return { ok: true, replay: true, receipt: prior.value };

    const runStore = getRunStorage();
    const liveRun = runStore.readIdentity(slotId);
    if (!liveRun.ok || liveRun.value.runId !== attempt.runId ||
        liveRun.value.revision !== attempt.context.expectedRunRevision) {
      return failure('STALE_RUN', '对局已变化，旧结算已取消');
    }
    if (!currentSlot(slotId)) return failure('STALE_SLOT', '档位已切换，旧结算已取消');
    const result = await recovery.commitBaseAndRun(attempt.context, {
      command: attempt.command, runId: attempt.runId, payload: attempt.payload,
      afterBase: attempt.afterBase, afterRun: null, output: attempt.output,
    });
    if (!result.ok) return result;
    return { ok: true, replay: false, receipt: result.value };
  }

  return Object.freeze({ createAttempt, commitAttempt, projectEphemeral });
}
