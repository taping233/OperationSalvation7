import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { beginRoomSave } from './room-footer.js';

// One rendered room owns its callbacks. The room supplies its live-source and
// busy checks; transaction commands still validate the resources at commit.
export function createRoomActions(UI, current, { emptyData = false } = {}) {
  return (name, handler) => UI.act(name, data => {
    if (current()) return handler(emptyData ? data || {} : data);
  });
}

// The effect has already run. Retries save that result, then continue its page.
// A saved result only retries presentation; each intentional retry page adopts ownership.
export function createRoomCheckpoint({ UI, save, isCurrent, renderRetry, complete,
  initialSaved = false, pageRequired = true }) {
  const visible = () => !!UI.el?.overlay && !UI.el.overlay.hidden && !UI.el.overlay.classList.contains('closing');
  const capture = () => ({ body:UI.el?.ovBody, root:UI.el?.ovBody?.firstElementChild,
    overlay:UI.el?.overlay, revision:UI._overlayRevision, page:pageRequired || visible() });
  let owner = capture(), pending = null, saved = initialSaved, finished = false;
  const current = () => isCurrent() && UI.el?.ovBody === owner.body && UI.el?.overlay === owner.overlay &&
    UI._overlayRevision === owner.revision && (owner.page
      ? owner.body?.firstElementChild === owner.root && visible()
      : !visible());
  const retryPage = () => {
    if (!current()) return false;
    try {
      renderRetry({ saved, run, isCurrent:current });
      owner = capture();
    } catch (error) { console.warn('[room] 继续页面未完成', error); }
    return false;
  };
  function run() {
    if (pending) return pending;
    if (!current()) return Promise.resolve(false);
    if (finished) return Promise.resolve(true);
    let release = () => {};
    const work = Promise.resolve().then(async () => {
      if (!current()) return false;
      release = beginRoomSave(owner.page ? owner.root : null, null, saved ? '正在继续…' : '正在保存…');
      if (!saved) saved = await saveRunCheckpoint(save);
      if (!current()) return false;
      if (!saved) return retryPage();
      try {
        const result = await complete(current);
        if (result === false) return retryPage();
        finished = true;
        return true;
      } catch (error) {
        console.warn('[room] 进度已保存，继续呈现未完成', error);
        return retryPage();
      }
    }).finally(() => {
      try { release(); } catch (error) { console.warn('[room] 保存控件恢复未完成', error); }
      if (pending === work) pending = null;
    });
    pending = work;
    return work;
  }
  return { run, isCurrent:current, get saved() { return saved; } };
}
