import { Input } from '../core/input.js';
import { esc } from '../core/shared.js';
const ACTION_NAMES = { roll: '切换路线', camRotateL: '镜头左转', camRotateR: '镜头右转', camOverview: '地图全景', camFocus: '定位当前地点', backpack: '打开背包', nodeNumbers: '节点编号', moveConfirm: '确认前往', moveCancel: '取消选择', movePrev: '上一条路线' };
export function inputSettingsHTML() {
  return `<section class="settings-group settings-input"><h3 class="set-h">键盘操作</h3><p class="hint">选择按键后按新键。Esc取消修改，冲突会先询问。</p><label class="chk"><span>启用单字母快捷键</span><input id="setLetterShortcuts" type="checkbox" role="switch" ${Input.lettersEnabled ? 'checked' : ''}></label>${Object.keys(Input.DEFAULT_BINDINGS).map(action => `<div class="setting-binding-row"><span>${esc(ACTION_NAMES[action])}</span><button type="button" data-rebind="${action}">${esc(Input.bindingLabel(action))}</button></div>`).join('')}<p data-binding-status role="status" aria-live="polite"></p><button type="button" data-binding-reset>恢复默认键位</button></section>`;
}
export function bindInputSettings(root, confirmAction) {
  const status = root.querySelector('[data-binding-status]');
  let listening = null;
  let revision = 0;
  const update = () => root.querySelectorAll('[data-rebind]').forEach(button => { button.textContent = Input.bindingLabel(button.dataset.rebind); });
  root.querySelector('#setLetterShortcuts')?.addEventListener('change', event => Input.setLettersEnabled(event.target.checked));
  root.querySelectorAll('[data-rebind]').forEach(button => button.addEventListener('click', () => {
    revision++;
    listening = button.dataset.rebind; root.dataset.keyListening = 'true'; update(); button.textContent = '请按新键…'; status.textContent = 'Esc取消修改';
  }));
  root.querySelector('[data-binding-reset]')?.addEventListener('click', () => { revision++; listening = null; delete root.dataset.keyListening; Input.reset(); update(); status.textContent = '已恢复默认键位'; });
  root.addEventListener('keydown', async event => {
    if (!listening || event.isComposing || event.keyCode === 229) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.key === 'Escape') { listening = null; delete root.dataset.keyListening; update(); status.textContent = '已取消修改'; return; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat || ['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(event.key)) return;
    const action = listening, request = revision, key = event.key;
    listening = null; delete root.dataset.keyListening;
    const conflict = Object.keys(Input.bindings).find(other => other !== action && Input.bindings[other].includes(event.key.toLowerCase()));
    if (conflict) {
      let approved;
      try { approved = await confirmAction({ title: '按键已被使用', message: `此键用于“${ACTION_NAMES[conflict]}”。继续将替换该绑定，并使原动作未绑定。`, confirmLabel: '替换绑定' }); }
      catch { if (request === revision && root.isConnected) { update(); status.textContent = '修改未完成，请重试'; } return; }
      if (request !== revision) return;
      if (!approved || !root.isConnected) { update(); return; }
    }
    if (!root.isConnected) return;
    Input.rebind(action, key); update(); status.textContent = `已修改“${ACTION_NAMES[action]}”`;
  }, true);
}
