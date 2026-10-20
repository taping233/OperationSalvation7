// Battle-entry command replay. A trusted local prepare(fixture) rebuilds the declared fixture;
// packets are data, never restoration scripts or arbitrary mid-battle save states.
import { Random } from '../core/random.js';
import { step, waitSettle } from './agent.runner.js';
import { normalizeAction } from './agent.protocol.js';
import { plainData, readReplayState, firstDifference, stateSummary, fingerprintOf } from './agent.replay-state.js';

const FORMAT = 'sdt-agent-battle-replay';
let active = false;
const fail = (code, extra = {}) => ({ ok: false, code, ...extra });
const resultState = result => plainData({ ok: result.res?.ok ?? null, code: result.res?.code ?? null,
  async: result.res?.async ?? false, completed: result.res?.completed ?? true,
  stopReason: result.stopReason ?? null, stalled: result.settleStalled === true, error: result.error ?? null });

function fixtureOf(value) {
  if (!value || typeof value.id !== 'string' || !value.id.trim() || !Object.hasOwn(value, 'params')) {
    throw new TypeError('Replay requires a serializable fixture { id, params }');
  }
  return plainData(value);
}

function battleCommand(value) {
  const normalized = normalizeAction(value);
  if (!normalized.ok || normalized.action.type !== 'battle') throw new TypeError('Replay only accepts battle commands');
  return plainData(normalized.action);
}

async function settledState(options) {
  const settled = await waitSettle(options);
  if (!settled.ok || !settled.obs.settle) throw new Error('Battle has not settled');
  return readReplayState(settled.obs);
}

/** Rebuild a trusted fixture before recording. This explicitly resets its test battle, not a player save. */
async function capture({ fixture, fingerprint, prepare, decide, maxCommands = 100, stepOptions = {} } = {}) {
  if (active) return fail('REPLAY_BUSY');
  active = true;
  let packet;
  try {
    const identity = fingerprintOf(fingerprint), setup = fixtureOf(fixture);
    if (typeof prepare !== 'function' || typeof decide !== 'function'
        || !Number.isInteger(maxCommands) || maxCommands < 1 || maxCommands > 1000) {
      return fail('CAPTURE_OPTIONS_INVALID');
    }
    await prepare(plainData(setup));
    const initial = await settledState(stepOptions);
    const battle = initial.battle;
    if (initial.phase !== 'battle' || battle?.turn !== 1 || battle.busy || battle.actionQueueLength
        || battle.phase !== 'player' || battle.pendingTarget || battle.infusing || battle.discovering
        || battle.handSelecting || battle.choosing || battle.deckSelection) return fail('BATTLE_ENTRY_REQUIRED');
    packet = { format: FORMAT, schema: 1, fingerprint: identity, fixture: setup,
      boundary: 'trusted-fixture-battle-entry', nonRuleStreams: ['agent-policy', 'recording', 'visual'],
      initial, initialSummary: stateSummary(initial), initialRng: plainData(Random.snapshot()),
      checkpoint: plainData(window.SDT?.Battle?.serialize?.() || null), commands: [], replayable: true };
    for (let index = 0; index < maxCommands; index++) {
      let before, action, decisionRng;
      const result = await step(async obs => {
        before = readReplayState(obs);
        const rngBefore = plainData(Random.snapshot());
        const choice = await decide(obs);
        const changed = firstDifference(before, readReplayState());
        if (changed) throw new Error(`Decision changed rule state at ${changed.path}`);
        decisionRng = { before: rngBefore, after: plainData(Random.snapshot()) };
        if (choice == null) return null;
        action = battleCommand(choice);
        return action;
      }, { ...stepOptions });
      if (!action) {
        if (result.error || result.stopReason) { packet.replayable = false; return fail('CAPTURE_STOPPED', { packet, result }); }
        return { ok: true, packet, stopReason: 'decide-null' };
      }
      const after = readReplayState();
      packet.commands.push({ index, action, before, after, beforeSummary: stateSummary(before),
        afterSummary: stateSummary(after), decisionRng, rngAfter: plainData(Random.snapshot()), result: resultState(result) });
      if (result.res?.ok !== true || result.res?.completed === false || result.stopReason || result.error || result.settleStalled) {
        packet.replayable = false;
        return fail('CAPTURE_STOPPED', { packet, result });
      }
      if (after.phase !== 'battle') return { ok: true, packet, stopReason: 'battle-ended' };
    }
    return { ok: true, packet, stopReason: 'max-commands' };
  } catch (error) {
    if (packet) packet.replayable = false;
    return fail('CAPTURE_INVALID', { message: String(error?.message || error), ...(packet ? { packet } : {}) });
  } finally { active = false; }
}

/** Rebuild using a trusted local adapter, then execute only recorded commands; stop on the first difference. */
async function play(input, { prepare, fingerprint, stepOptions = {} } = {}) {
  if (active) return fail('REPLAY_BUSY');
  active = true;
  let executed = 0;
  try {
    const packet = plainData(input);
    if (packet.format !== FORMAT || packet.schema !== 1 || packet.replayable !== true
        || packet.boundary !== 'trusted-fixture-battle-entry' || !Array.isArray(packet.commands)
        || packet.commands.length > 1000 || typeof prepare !== 'function') return fail('REPLAY_PACKET_INVALID', { executed });
    const versionDifference = firstDifference(packet.fingerprint, fingerprintOf(fingerprint));
    if (versionDifference) return fail('REPLAY_FINGERPRINT_MISMATCH', { executed, difference: versionDifference });
    fixtureOf(packet.fixture);
    packet.commands.forEach((entry, index) => {
      if (entry.index !== index || !entry.before || !entry.after || !entry.result) throw new TypeError('Invalid replay entry');
      battleCommand(entry.action);
      if (entry.result.ok !== true || entry.result.completed === false || entry.result.stopReason
          || entry.result.stalled || entry.result.error) throw new TypeError('Replay contains an unsuccessful command');
    });
    await prepare(plainData(packet.fixture), { checkpoint: plainData(packet.checkpoint) });
    let actual = await settledState(stepOptions);
    let difference = firstDifference(packet.initial, actual);
    if (difference) return fail('REPLAY_DIVERGED', { executed, index: -1, stage: 'initial', difference });
    for (const entry of packet.commands) {
      difference = firstDifference(entry.before, actual);
      if (difference) return fail('REPLAY_DIVERGED', { executed, index: entry.index, stage: 'before', difference });
      const result = await step(() => entry.action, { ...stepOptions });
      executed++;
      if (result.res?.ok !== true || result.res?.completed === false || result.stopReason || result.error || result.settleStalled) {
        return fail('REPLAY_DIVERGED', { executed, index: entry.index, stage: 'result',
          difference: firstDifference(entry.result, resultState(result)) });
      }
      difference = firstDifference(entry.result, resultState(result));
      if (difference) return fail('REPLAY_DIVERGED', { executed, index: entry.index, stage: 'result', difference });
      actual = readReplayState();
      difference = firstDifference(entry.after, actual);
      if (difference) return fail('REPLAY_DIVERGED', { executed, index: entry.index, stage: 'after', difference });
    }
    return { ok: true, executed, final: stateSummary(actual) };
  } catch (error) {
    return fail('REPLAY_INVALID', { executed, message: String(error?.message || error) });
  } finally { active = false; }
}

export { capture, play };
