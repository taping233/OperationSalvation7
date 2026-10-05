// Pure CLI adapter. Task identity, filesystem paths, reports and write locks stay in workflow-task.
const directFields = ['goal', 'paths', 'done-when', 'stage', 'done-when-confirmed', 'check', 'unverified', 'checks-none', 'unverified-none'];
const own = (values, field) => Object.hasOwn(values, field) && values[field] !== undefined;

function text(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`--${field} 必须为非空文字`);
  return value.trim();
}

function repeated(values, field) {
  if (!Array.isArray(values[field]) || !values[field].length) throw new Error(`--${field} 必须提供至少一项`);
  return values[field].map(value => text(value, field));
}

function check(value) {
  const match = value.match(/^(manual|report):(passed|failed|unverified):([\s\S]+)$/);
  if (!match || !match[3].trim()) throw new Error('--check 格式为 manual:<passed|failed|unverified>:<说明> 或 report:<结果>:<项目内报告路径>');
  return { kind: match[1], result: match[2], [match[1] === 'manual' ? 'description' : 'report']: match[3].trim() };
}

/** Return null for --input-only compatibility; callers read that file through the existing route. */
export function taskInputFromValues(action, values = {}) {
  if (!['start', 'update', 'close'].includes(action)) throw new Error('任务输入仅支持 start/update/close');
  const provided = directFields.filter(field => own(values, field));
  if (own(values, 'input')) {
    text(values.input, 'input');
    if (provided.length) throw new Error('--input 不得与任务直接字段混用');
    return null;
  }
  if (!provided.length) throw new Error('提供 --input JSON文件或任务直接字段；start 需要 --goal、--paths、--done-when');

  const input = {};
  if (own(values, 'goal')) input.goal = text(values.goal, 'goal');
  if (own(values, 'paths')) {
    input.paths = text(values.paths, 'paths').split(',').map(value => text(value, 'paths'));
  }
  if (own(values, 'done-when')) input.doneWhen = repeated(values, 'done-when');
  if (own(values, 'stage')) input.stage = text(values.stage, 'stage');
  if (own(values, 'done-when-confirmed')) {
    if (typeof values['done-when-confirmed'] !== 'boolean') throw new Error('--done-when-confirmed 必须为布尔值');
    input.doneWhenConfirmed = values['done-when-confirmed'];
  }
  for (const [field, none, destination] of [['check', 'checks-none', 'checks'], ['unverified', 'unverified-none', 'unverified']]) {
    if (own(values, none)) {
      if (values[none] !== true) throw new Error(`--${none} 必须明确启用`);
      if (own(values, field)) throw new Error(`--${none} 不得与 --${field} 混用`);
      input[destination] = [];
    } else if (own(values, field)) {
      const entries = repeated(values, field);
      input[destination] = field === 'check' ? entries.map(check) : entries;
    }
  }
  if (action === 'start' && ['goal', 'paths', 'doneWhen'].some(field => !Object.hasOwn(input, field))) {
    throw new Error('task start 需要 --goal、--paths 和至少一个 --done-when');
  }
  if (action === 'close') {
    if (['stage', 'checks', 'unverified'].some(field => !Object.hasOwn(input, field))) {
      throw new Error('task close 须明确 --stage、--check/--checks-none、--unverified/--unverified-none');
    }
    if (input.stage === 'complete-uncommitted' && input.doneWhenConfirmed !== true) throw new Error('完成须明确 --done-when-confirmed');
  }
  return input;
}
