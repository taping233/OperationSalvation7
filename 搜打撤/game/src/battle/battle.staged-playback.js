import { clearFeedback, waitForFeedback, waitMs } from './battle.feedback.js';
import { demoMs } from './battle.pace.js';

export const STAGED_BOSS_DEFEAT = Symbol('staged boss defeat');

export function actionCancellationError(signal) {
  const reason = signal?.reason;
  if (reason instanceof Error) return reason;
  const error = new Error(String(reason || 'battle action cancelled'));
  error.name = 'BattleActionCancelledError';
  return error;
}

export function throwIfActionCancelled(signal) {
  if (signal?.aborted) throw actionCancellationError(signal);
}

// Walk a rule generator one presentation beat at a time. Battle logic stays in
// the generator; this module owns only waits, cues and cancellation boundaries.
export function createStagedPlayback({ session, getBattleToken, getFloats, foeIdx, render, finish }) {
  return async function runStagedSteps(steps, signal) {
    const battleToken = getBattleToken();
    const generation = session.generation;
    const ensureCurrentBattle = () => {
      throwIfActionCancelled(signal);
      if (getBattleToken() !== battleToken || session.generation !== generation) {
        throw actionCancellationError(signal);
      }
    };
    const releaseDeathFx = async () => {
      if (!session.stagedDeathFx.size) return;
      await waitMs(demoMs(180), signal);
      ensureCurrentBattle();
      session.stagedDeathFx.clear();
      render();
    };

    session.stagedResolutionDepth++;
    let result;
    let pendingCue;
    let cueWindups = 0;
    try {
      while (true) {
        ensureCurrentBattle();
        const floatStart = getFloats().length;
        const next = steps.next();
        if (next.done) { result = next.value; break; }
        const step = next.value;
        if (step.kind === 'windup') {
          const windupCue = step.cue ? { ...step.cue, replayAttacker: cueWindups++ > 0 } : null;
          pendingCue = windupCue;
          const floats = getFloats();
          for (let i = 0; i < step.targets.length; i++) {
            const foe = step.targets[i];
            const unit = foeIdx(foe);
            if (unit >= 0 && !foe.dead) floats.push({ unit, text: '', cls: 'windupfx', ...(i === 0 && windupCue ? { cue: windupCue } : {}) });
          }
          render();
          await waitForFeedback(signal);
          await waitMs(demoMs(step.cue?.windupMs ?? 130), signal);
          continue;
        }
        if (step.kind === 'hit') {
          const cue = step.cue || pendingCue;
          if (cue) {
            let firstDamageCue = true;
            const floats = getFloats();
            for (let i = floatStart; i < floats.length; i++) {
              const feedback = floats[i];
              if (feedback.hpBefore == null || feedback.unit === 'self') continue;
              feedback.cue = firstDamageCue ? cue : { ...cue, attacker: null };
              firstDamageCue = false;
            }
          }
          pendingCue = null;
        }
        render();
        await waitForFeedback(signal);
        await releaseDeathFx();
      }
      render();
      await waitForFeedback(signal);
      await releaseDeathFx();
    } catch (error) {
      if (error === STAGED_BOSS_DEFEAT) {
        render();
        await waitForFeedback(signal);
        await waitMs(demoMs(220), signal);
        ensureCurrentBattle();
        finish(true);
        throw actionCancellationError(signal);
      }
      if (signal?.aborted && getBattleToken() === battleToken && session.generation === generation) {
        clearFeedback();
        render();
      }
      throw error;
    } finally {
      if (getBattleToken() === battleToken && session.generation === generation) {
        session.stagedResolutionDepth--;
        if (session.stagedResolutionDepth === 0 && session.stagedDeathFx.size) {
          session.stagedDeathFx.clear();
          render();
        }
      }
    }
    ensureCurrentBattle();
    return result;
  };
}
