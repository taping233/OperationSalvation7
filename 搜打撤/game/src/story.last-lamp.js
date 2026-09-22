const STORY_ID = 'last-lamp';
const ENDINGS = Object.freeze(['open_beacon', 'shaded_marker']);
const CHOICES = Object.freeze({ 1: ['continue'], 2: ['continue'], 3: ENDINGS });
const MEMENTOS = Object.freeze({
  open_beacon: 'last_lamp_open_beacon',
  shaded_marker: 'last_lamp_shaded_marker',
});

const clone = value => JSON.parse(JSON.stringify(value));
const fail = (code, message, details) => ({ ok: false, code, message, retryable: false, ...(details ? { details } : {}) });
function makeLastLampEventInstanceId(runId, layerIdx, trackPos) {
  if (typeof runId !== 'string' || !runId || !Number.isInteger(layerIdx) || layerIdx < 0 || !Number.isInteger(trackPos) || trackPos < 0) return null;
  return `r6:last-lamp:v1:${runId}:${layerIdx},${trackPos}`;
}
function validLastLampEventInstanceId(eventInstanceId, runId) {
  if (typeof runId !== 'string' || !runId || typeof eventInstanceId !== 'string') return false;
  const prefix = `r6:last-lamp:v1:${runId}:`;
  if (!eventInstanceId.startsWith(prefix)) return false;
  const match = eventInstanceId.slice(prefix.length).match(/^(0|[1-9]\d*),(0|[1-9]\d*)$/);
  return !!match && makeLastLampEventInstanceId(runId, +match[1], +match[2]) === eventInstanceId;
}

function validRecord(record, segmentId) {
  return !!record && record.segmentId === segmentId && typeof record.runId === 'string' && !!record.runId
    && validLastLampEventInstanceId(record.eventInstanceId, record.runId)
    && CHOICES[segmentId]?.includes(record.choiceId)
    && (segmentId < 3 ? record.mementoId == null : record.mementoId === MEMENTOS[record.choiceId]);
}

function validateLastLampState(story) {
  if (!story || typeof story !== 'object' || Array.isArray(story) ||
      !story.flags || typeof story.flags !== 'object' || Array.isArray(story.flags) ||
      !story.outcomes || typeof story.outcomes !== 'object' || Array.isArray(story.outcomes)) {
    return fail('INVALID_STORY_STATE', '故事档案结构损坏，已保留原数据');
  }
  const hasState = Object.prototype.hasOwnProperty.call(story.outcomes, STORY_ID);
  const state = story.outcomes[STORY_ID];
  if (!hasState) return { ok: true, value: { version: 1, stage: 0, ending: null, segments: {}, runs: {} }, exists: false };
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.version !== 1 ||
      !Number.isInteger(state.stage) || state.stage < 0 || state.stage > 3 ||
      !state.segments || typeof state.segments !== 'object' || Array.isArray(state.segments) ||
      !state.runs || typeof state.runs !== 'object' || Array.isArray(state.runs)) {
    return fail('INVALID_STORY_STATE', '《最后一盏引路灯》档案损坏，已保留原数据');
  }
  const segmentKeys = Object.keys(state.segments).sort();
  const expectedKeys = Array.from({ length: state.stage }, (_, i) => String(i + 1));
  if (JSON.stringify(segmentKeys) !== JSON.stringify(expectedKeys)) return fail('INVALID_STORY_STATE', '故事阶段与段落记录不一致');
  for (let segmentId = 1; segmentId <= state.stage; segmentId++) {
    const record = state.segments[segmentId];
    if (!validRecord(record, segmentId)) return fail('INVALID_STORY_STATE', `故事第 ${segmentId} 段记录损坏`);
    const runRecord = state.runs[record.runId];
    if (!runRecord || runRecord.segmentId !== segmentId || runRecord.eventInstanceId !== record.eventInstanceId || runRecord.choiceId !== record.choiceId) {
      return fail('INVALID_STORY_STATE', '故事段落与探索身份记录不一致');
    }
  }
  if (Object.keys(state.runs).length !== state.stage) return fail('INVALID_STORY_STATE', '故事探索记录数量与阶段不一致');
  if ((state.stage < 3 && state.ending != null) || (state.stage === 3 && !ENDINGS.includes(state.ending)) ||
      (state.stage === 3 && state.segments[3].choiceId !== state.ending)) {
    return fail('INVALID_STORY_STATE', '故事结局与最终选择不一致');
  }
  return { ok: true, value: clone(state), exists: true };
}

function inspectLastLamp(baseSnapshot, { runId, eventInstanceId } = {}) {
  if (!validLastLampEventInstanceId(eventInstanceId, runId)) {
    return fail('INVALID_ARGUMENT', '缺少稳定探索身份或事件实例');
  }
  const checked = validateLastLampState(baseSnapshot?.story);
  if (!checked.ok) return checked;
  const state = checked.value;
  const runRecord = state.runs[runId] || null;
  if (runRecord) {
    const segment = state.segments[runRecord.segmentId];
    return { ok: true, value: {
      kind: segment.eventInstanceId === eventInstanceId ? 'recover' : 'already-read-this-run',
      state, record: clone(segment), segmentId: runRecord.segmentId,
    } };
  }
  if (state.stage >= 3) return { ok: true, value: { kind: 'complete', state, segmentId: 3 } };
  return { ok: true, value: { kind: 'available', state, segmentId: state.stage + 1 } };
}

function prepareLastLampChoice(baseSnapshot, input) {
  const { runId, eventInstanceId, segmentId, choiceId } = input || {};
  const inspected = inspectLastLamp(baseSnapshot, { runId, eventInstanceId });
  if (!inspected.ok) return inspected;
  if (inspected.value.kind !== 'available') return fail('STORY_NOT_AVAILABLE', '本次探索不能再次推进这条故事');
  if (inspected.value.segmentId !== segmentId || !CHOICES[segmentId]?.includes(choiceId)) {
    return fail('INVALID_CHOICE', '故事段落或选项与当前进度不符');
  }
  const afterState = clone(baseSnapshot);
  const state = inspected.value.state;
  const mementoId = segmentId === 3 ? MEMENTOS[choiceId] : null;
  const record = { segmentId, runId, eventInstanceId, choiceId, mementoId };
  state.stage = segmentId;
  state.ending = segmentId === 3 ? choiceId : null;
  state.segments[String(segmentId)] = record;
  state.runs[runId] = { segmentId, eventInstanceId, choiceId };
  afterState.story = { ...afterState.story, flags: { ...afterState.story.flags, [`lastLampRead${segmentId}`]: true },
    outcomes: { ...afterState.story.outcomes, [STORY_ID]: state } };
  const output = { storyId: STORY_ID, segmentId, eventInstanceId, runId, choiceId,
    nextStage: Math.min(3, segmentId + 1), ending: state.ending, mementoId };
  return { ok: true, value: {
    command: 'story.recordLastLampChoice', payload: { storyId: STORY_ID, segmentId, eventInstanceId, runId, choiceId },
    afterState, events: [{ type: 'story.lastLampRecorded', payload: output }], output,
  } };
}

export { CHOICES, ENDINGS, MEMENTOS, STORY_ID, inspectLastLamp, makeLastLampEventInstanceId, prepareLastLampChoice, validLastLampEventInstanceId, validateLastLampState };
