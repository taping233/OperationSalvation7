import './base.js';

const Base = () => window.SDT.Base;
const validSlot = slotId => Number.isInteger(slotId) && slotId >= 1 && slotId <= 5;
const clone = value => JSON.parse(JSON.stringify(value));

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezeDeep);
  return Object.freeze(value);
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const failure = (code, message, retryable = false, details) => ({
  ok: false, code, message, retryable, ...(details ? { details } : {}),
});

function validateContext(context) {
  if (!context || !validSlot(context.slotId)) return failure('INVALID_ARGUMENT', 'slotId 必须是 1～5');
  if (typeof context.requestId !== 'string' || !context.requestId.trim()) return failure('INVALID_ARGUMENT', 'requestId 不能为空');
  if (!Number.isInteger(context.expectedRevision) || context.expectedRevision < 0) return failure('INVALID_ARGUMENT', 'expectedRevision 必须是非负整数');
  return null;
}

function readBase(slotId) {
  if (!validSlot(slotId)) return failure('INVALID_ARGUMENT', 'slotId 必须是 1～5');
  const base = Base();
  const state = base._readForCommit(slotId);
  if (!state) {
    const issue = base.issue(slotId);
    return failure(issue === 'tooNew' ? 'INVALID_STATE' : 'SAVE_FAILED',
      issue === 'tooNew' ? '基地存档来自更新版本，当前版本拒绝读取' : '基地存档损坏，已保留原数据', false,
      { issue });
  }
  const snapshot = clone(state);
  const revision = snapshot._m01.revision;
  delete snapshot._m01;
  return { ok: true, value: freezeDeep(snapshot), revision };
}

// 领域模块应在业务校验前调用：已完成请求直接拿回原收据，避免重启后因余额已扣
// 而先被“余额不足”等当前状态校验挡住。value=null 表示这是尚未执行的新请求。
function readBaseReceipt(context, identity) {
  const invalidContext = validateContext(context);
  if (invalidContext) return invalidContext;
  if (!identity || typeof identity.command !== 'string' || !identity.command.trim()) {
    return failure('INVALID_ARGUMENT', 'command 不能为空');
  }
  const current = Base()._readForCommit(context.slotId);
  if (!current) {
    const issue = Base().issue(context.slotId);
    return failure('INVALID_STATE', issue === 'tooNew' ? '基地存档来自更新版本，拒绝读取' : '基地存档损坏，拒绝读取', false, { issue });
  }
  let fingerprint;
  try { fingerprint = stable(identity.payload ?? null); }
  catch { return failure('INVALID_ARGUMENT', 'payload 必须是可序列化纯数据'); }
  const prior = current._m01.requests[`${identity.command.trim()}:${context.requestId}`];
  if (!prior) return { ok: true, value: null, revision: current._m01.revision };
  if (prior.fingerprint !== fingerprint) return failure('REQUEST_ID_CONFLICT', '同一 requestId 的参数与已完成请求不同');
  return clone(prior.result);
}

async function commitBase(context, preparedChange) {
  const invalidContext = validateContext(context);
  if (invalidContext) return invalidContext;
  if (Base().slot == null) return failure('INVALID_STATE', '标题页尚未选择档位，不能提交基地命令');
  if (Base().slot !== context.slotId) return failure('INVALID_STATE', '提交档位与当前游玩档位不一致');
  if (!preparedChange || typeof preparedChange.command !== 'string' || !preparedChange.command.trim() ||
      !Number.isInteger(preparedChange.beforeRevision) || !preparedChange.afterState ||
      typeof preparedChange.afterState !== 'object' || Array.isArray(preparedChange.afterState)) {
    return failure('INVALID_ARGUMENT', 'preparedChange 缺少 command、beforeRevision 或 afterState');
  }

  const base = Base();
  const current = base._readForCommit(context.slotId);
  if (!current) {
    const issue = base.issue(context.slotId);
    return failure('INVALID_STATE', issue === 'tooNew' ? '基地存档来自更新版本，拒绝覆盖' : '基地存档损坏，拒绝覆盖', false, { issue });
  }
  const command = preparedChange.command.trim();
  const requestKey = `${command}:${context.requestId}`;
  let fingerprint;
  try { fingerprint = stable(preparedChange.payload ?? null); }
  catch { return failure('INVALID_ARGUMENT', 'payload 必须是可序列化纯数据'); }
  const prior = current._m01.requests[requestKey];
  if (prior) {
    if (prior.fingerprint !== fingerprint) return failure('REQUEST_ID_CONFLICT', '同一 requestId 的参数与已完成请求不同');
    return clone(prior.result);
  }

  const revision = current._m01.revision;
  if (context.expectedRevision !== revision || preparedChange.beforeRevision !== revision) {
    return failure('STALE_REVISION', '基地状态已变化，请刷新后确认', false,
      { expectedRevision: context.expectedRevision, actualRevision: revision });
  }

  let afterState, events, output;
  try {
    afterState = clone(preparedChange.afterState);
    events = clone(preparedChange.events || []);
    output = preparedChange.output === undefined ? undefined : clone(preparedChange.output);
  } catch {
    return failure('INVALID_ARGUMENT', 'afterState、events 和 output 必须是可序列化纯数据');
  }
  if (!Array.isArray(events) || events.some(event => !event || typeof event.type !== 'string' || !event.type.trim())) {
    return failure('INVALID_ARGUMENT', 'events 必须是带 type 的事件数组');
  }

  const nextRevision = revision + 1;
  const eventIds = events.map((_, index) => `${context.slotId}:${nextRevision}:${index + 1}`);
  const receipt = {
    requestId: context.requestId, command, baseRevision: nextRevision, eventIds,
    ...(output === undefined ? {} : { output }),
  };
  const result = { ok: true, value: receipt, revision: nextRevision };
  delete afterState._m01;
  afterState._m01 = {
    revision: nextRevision,
    requests: { ...current._m01.requests, [requestKey]: { fingerprint, result } },
  };

  try {
    base._writeCommitted(context.slotId, afterState);
  } catch {
    return failure('SAVE_FAILED', '基地存档写入失败', true);
  }
  // 事件只在首次持久化成功后发布；幂等重放从上方直接返回，不会重复演出或发奖。
  events.forEach((event, index) => {
    try {
      window.dispatchEvent(new CustomEvent('sdt:domain-event', { detail: freezeDeep({
        eventId: eventIds[index], type: event.type, slotId: context.slotId,
        revision: nextRevision, payload: event.payload || {},
      }) }));
    } catch { /* 事件消费者故障不反向破坏已经持久化的提交 */ }
  });
  return clone(result);
}

export { readBase, readBaseReceipt, commitBase };
