import { register as registerFlow } from './flow-scenarios.js';
import { register as registerSaveRules } from './save-rule-scenarios.js';
const identity = 'e7-20260927-01a0e1da';
function assertIsolatedOrigin() {
  if (location.origin !== 'http://127.0.0.1:52971' || !new URL(location.href).searchParams.has('e7') || localStorage.getItem('e7-acceptance-owner') !== identity) throw Error('E7 隔离守卫未通过');
}
assertIsolatedOrigin();
const panel = document.createElement('details'); panel.id = 'e7-panel'; panel.open = true;
panel.style.cssText = 'position:fixed;z-index:2147483647;right:8px;top:8px;width:370px;max-height:45vh;overflow:auto;background:#101d28f5;color:white;padding:8px;font:12px system-ui;border:1px solid #7ac;';
panel.innerHTML = '<summary>E7 QA · 样本准备/注入（可收起）</summary><div id="e7-buttons"></div><pre id="e7-evidence" style="white-space:pre-wrap;max-height:180px;overflow:auto"></pre>';
document.documentElement.append(panel);
panel.addEventListener('keydown', event => event.stopPropagation());
panel.addEventListener('keyup', event => event.stopPropagation());
const overlayHost = document.getElementById('overlay');
const placePanel = () => {
  const parent = overlayHost && !overlayHost.hidden ? overlayHost : document.documentElement;
  if (panel.parentElement !== parent) parent.append(panel);
  panel.removeAttribute('inert');
};
if (overlayHost) { new MutationObserver(placePanel).observe(overlayHost, {attributes:true, attributeFilter:['hidden']}); placePanel(); }
const output = panel.querySelector('pre'), buttons = panel.querySelector('div');
let sequence = 0, activeFault = null;
const pendingEvidence = new Set(), evidenceErrors = [];
const nativeSet = Storage.prototype.setItem, nativeRemove = Storage.prototype.removeItem;
const keysFor = slot => ({ run: `sdt-save-v2-slot${slot}`, base: `sdt-base-v2-slot${slot}`, journal: `sdt-tx-v1-slot${slot}` });
function safeData(value) { return JSON.parse(JSON.stringify(value, (_k, v) => v instanceof Set ? [...v] : v instanceof Map ? [...v] : v)); }
function record(event, data = {}) {
  const entry = { sequence: ++sequence, event, origin: location.origin, data: safeData(data) };
  output.textContent = JSON.stringify(entry, null, 2);
  const task = fetch('/__e7__/evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) })
    .then(response => { if (!response.ok) throw Error('HTTP ' + response.status); })
    .catch(e => { evidenceErrors.push({ sequence:entry.sequence, message:e.message }); output.textContent += '\n证据持久化失败：' + e.message; })
    .finally(() => pendingEvidence.delete(task));
  pendingEvidence.add(task);
  return entry;
}
function validateKey(slot, key) { assertIsolatedOrigin(); if (![1, 2, 3, 4, 5].includes(slot) || !Object.values(keysFor(slot)).includes(key)) throw Error('非测试slot/key'); }
function armStorageFault(config) {
  validateKey(config.slot, config.key);
  if (!['setItem', 'removeItem'].includes(config.method) || !Number.isInteger(config.times) || config.times < 1 || config.times > 50) throw Error('故障配置非法');
  activeFault = { ...config, hits: 0 }; record('storage-fault-arm', activeFault); return activeFault;
}
for (const [method, original] of [['setItem', nativeSet], ['removeItem', nativeRemove]]) {
  Storage.prototype[method] = function(key, ...args) {
    const isLocal = this === localStorage, testKey = /^sdt-(save-v2|base-v2|tx-v1)-slot[1-5]$/.test(key);
    if (isLocal && testKey) {
      if (activeFault?.method === method && activeFault.key === key && activeFault.hits < activeFault.times) {
        activeFault.hits++; record('storage-fault-hit', { ...activeFault }); throw new DOMException('E7 controlled storage fault', 'QuotaExceededError');
      }
      const result = original.call(this, key, ...args);
      record('storage-write', { method, key, value: args[0] ?? null }); return result;
    }
    return original.call(this, key, ...args);
  };
}
function readSlots() { return Object.fromEntries([1,2,3,4,5].map(slot => [slot, Object.fromEntries(Object.entries(keysFor(slot)).map(([kind,key]) => [kind,localStorage.getItem(key)]))])); }
function register(id, label, handler) {
  const button = document.createElement('button'); button.id = 'e7-' + id; button.textContent = label;
  button.style.cssText = 'font:12px system-ui;margin:3px;padding:5px;background:#29475a;color:white;border:1px solid #789;';
  button.onclick = async () => { assertIsolatedOrigin(); button.disabled = true; try { record('qa-action', { id, label }); const result = await handler(); if (result !== undefined) record('qa-result:' + id, result); } catch(e) { record('qa-error:' + id, { message:e.message, stack:e.stack }); } finally { button.disabled = false; } };
  buttons.append(button);
}
const ctx = {
  register, record, assertIsolatedOrigin, getSDT: () => window.SDT, getGame: () => window.SDT?.game,
  armStorageFault, disarmStorageFault: () => { const last = activeFault; activeFault = null; nativeSet.call(sessionStorage, 'e7-next-storage-fault', JSON.stringify({ enabled:false })); record('storage-fault-disarm', last); },
  configureModuleFault: async ({mode}) => { const result = await (await fetch('/__e7__/module?mode='+encodeURIComponent(mode))).json(); record('module-control', result); return result; },
  readSlots, writeSample(slot, sample) { for (const [kind,value] of Object.entries(sample)) { const key = keysFor(slot)[kind]; validateKey(slot,key); if (value === undefined || value === null) throw Error('QA 不删除存储键'); nativeSet.call(localStorage,key,typeof value === 'string' ? value : JSON.stringify(value)); } record('sample-written', {slot,sample:readSlots()[slot]}); },
};
try { const next = JSON.parse(sessionStorage.getItem('e7-next-storage-fault') || 'null'); if (next && next.enabled !== false) armStorageFault(next); } catch(e) { record('preboot-fault-error',{message:e.message}); }
register('snapshot','记录原串与当前状态', () => ({ slots:readSlots(),state:window.SDT?.game?.state,slot:window.SDT?.game?.slot,battleActive:window.SDT?.game?.battleActive,fault:activeFault }));
register('flush','确认所有证据已写入',async () => { await Promise.allSettled([...pendingEvidence]); return {pending:pendingEvidence.size,errors:evidenceErrors}; });
register('fault-off','解除存储故障',ctx.disarmStorageFault);
register('module-release','释放模块延迟',()=>ctx.configureModuleFault({mode:'release'}));
registerFlow(ctx); registerSaveRules(ctx);
record('qa-bootstrap',{identity,entry:location.pathname,query:location.search});
window.addEventListener('DOMContentLoaded', () => setTimeout(() => record('production-entry-loaded', { state: window.SDT?.game?.state, overlayReady: !!window.SDT?.UI?.el?.overlay }), 0), {once:true});
