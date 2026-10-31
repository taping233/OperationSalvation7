// 事件选中是阅读状态；真正结算仍交给原有 data-act 回调。
let eventChoiceSelection = null;
const bindings = new WeakMap();

export function disposeEventChoiceSelection(root) {
  if (root) bindings.get(root)?.dispose();
}

/** @param {null | ((option:HTMLButtonElement) => {ok:boolean,value?:unknown})} dispatch */
export function wireEventChoiceSelection(root, key, owner = key, dispatch = null) {
  disposeEventChoiceSelection(root);
  const options = [...root.querySelectorAll('.node-summary .evt-opt[data-act]')];
  if (options.length < 2) { eventChoiceSelection = null; return; }
  const confirm = root.querySelector('.event-choice-confirm');
  const state = confirm?.closest('.event-choice-state');
  const stateHome = state?.parentElement;
  const clear = root.querySelector('.event-choice-clear');
  const name = root.querySelector('[data-event-choice-name]');
  const detail = root.querySelector('[data-event-choice-detail]');
  if (!confirm || !clear || !name || !detail) return;
  let selected = eventChoiceSelection?.key === key && eventChoiceSelection.owner === owner ? eventChoiceSelection.index : -1;
  let executing = false;
  let forwarding = false;
  let live = true;
  const controller = new AbortController();
  const binding = { dispose:() => {
    if (!live) return;
    live = false;
    controller.abort();
    // The selected option temporarily hosts the shared confirmation bar.
    // Put it back before reconciling this page's original structure.
    stateHome?.append(state);
    root.removeAttribute('aria-busy');
    delete root.dataset.eventChoiceBusy;
    if (root._clearEventChoice === clearChoice) delete root._clearEventChoice;
    if (bindings.get(root) === binding) bindings.delete(root);
  } };
  bindings.set(root, binding);
  const current = () => live && bindings.get(root) === binding && root.isConnected
    && !root.closest('[hidden], .closing, [data-ui-closing]');
  const sync = () => {
    const option = options[selected];
    options.forEach((item, index) => {
      item.classList.toggle('is-selected', index === selected);
      item.setAttribute('aria-pressed', String(index === selected));
    });
    name.textContent = option?.querySelector('b')?.textContent || '未选择';
    detail.textContent = option?.querySelector('span')?.textContent || (option ? '结果未知' : '');
    confirm.disabled = !option || option.disabled || executing;
    clear.disabled = !option || executing;
    root.setAttribute('aria-busy', String(executing));
    root.dataset.eventChoiceBusy = String(executing);
    const label = confirm.querySelector('small');
    if (label) label.textContent = executing ? '正在处理…' : '确认选择';
    confirm.setAttribute('aria-label', option ? `确认选择：${option.querySelector('b')?.textContent || ''}` : '确认选择');
    (option?.closest('.illustrated-choice-unit') || stateHome)?.append(state);
  };
  const choose = index => {
    if (!current() || executing || index < 0 || options[index]?.disabled) return;
    selected = selected === index ? -1 : index;
    eventChoiceSelection = selected < 0 ? null : { key, owner, index };
    sync();
  };
  root.querySelector('.node-summary').addEventListener('click', event => {
    const option = event.target.closest('.evt-opt[data-act]');
    if (!option || forwarding) return;
    event.preventDefault();
    event.stopPropagation();
    choose(options.indexOf(option));
  }, { signal:controller.signal });
  clear.addEventListener('click', () => {
    if (!current() || executing) return;
    selected = -1;
    eventChoiceSelection = null;
    sync();
    options[0]?.focus({ preventScroll:true });
  }, { signal:controller.signal });
  confirm.addEventListener('click', async () => {
    const option = options[selected];
    if (!current() || !option || executing || option.disabled) return;
    executing = true;
    const submittedSelection = eventChoiceSelection;
    sync();
    if (dispatch) {
      const retry = message => {
        if (!current()) return;
        executing = false;
        sync();
        const notice = root.querySelector('[data-event-capacity]');
        if (notice) notice.textContent = message;
        else detail.textContent = message;
      };
      try {
        const action = dispatch(option);
        if (!action.ok) { retry('操作尚未完成，请重试。'); return; }
        const result = await action.value;
        if (!current()) return;
        if (result === false || (result && typeof result === 'object' && 'ok' in result && result.ok === false)) {
          const message = result && typeof result === 'object' && 'message' in result && typeof result.message === 'string'
            ? result.message : '操作尚未完成，请重试。';
          retry(message);
          return;
        }
        if (eventChoiceSelection === submittedSelection) eventChoiceSelection = null;
      } catch (error) {
        retry(error instanceof Error ? error.message : '操作尚未完成，请重试。');
      }
      return;
    }
    eventChoiceSelection = null;
    forwarding = true;
    try { option.click(); } finally { forwarding = false; }
  }, { signal:controller.signal });
  const clearChoice = () => {
    if (!current() || executing) return;
    selected = -1; eventChoiceSelection = null; sync();
  };
  root._clearEventChoice = clearChoice;
  if (selected < 0 || options[selected]?.disabled) selected = -1;
  sync();
}
