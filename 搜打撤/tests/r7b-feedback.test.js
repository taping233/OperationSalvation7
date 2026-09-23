import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadFeedbackRecord, feedbackExportRecord, readLocalFeedback } from '../game/src/ui/feedback.local.js';
import { createGameMenuController } from '../game/src/ui/game.menu.js';

function setup() {
  document.body.innerHTML = `<div id="title"><button id="titleSettings">设置</button></div><div id="exitScr"></div><span id="gameVersion">v9.1</span><div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div><div id="sugLayer" hidden><h3 id="sugHead"></h3><p id="sugWhere"></p>
    <textarea id="sugText"></textarea><textarea id="sugSteps"></textarea><textarea id="sugExpected"></textarea><textarea id="sugActual"></textarea>
    <button id="sugSaveBtn"></button><button id="sugCancelBtn"></button></div>`;
  const acts = {};
  const overlay = document.getElementById('overlay'), ovBody = document.getElementById('ovBody');
  const UI = { el: { overlay, ovBody, ovTitle: document.getElementById('ovTitle') }, act: (name, fn) => { acts[name] = fn; }, showOverlay(_t, html) { ovBody.innerHTML = html; overlay.hidden = false; }, hideOverlay() { overlay.hidden = true; },
    showScreen(el) { if (el) el.hidden = false; }, hideScreen(el, done) { el.hidden = true; done?.(); }, refresh() {}, log() {} };
  const game = { state: 'title', toggles: { index: false }, devMode: false };
  const SDT = { Icons: { rich: x => x }, Sound: { music() {}, sfx() {}, setMusicMuted() {}, setMusicSource() {}, setSfxMuted() {}, setMusicVolume() {}, setSfxVolume() {}, musicVolume: 1, sfxVolume: 1 },
    Notes: { clearAll() {} }, Cards: { clearAll() {} }, Base: { peek: () => null }, Meta: { ACHIEVEMENTS: [], isUnlocked: () => false } };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[ch]));
  const c = createGameMenuController({ SDT, UI, game, runtime: { resize() {}, syncDevVisibility() {}, rebuildNotes() {} }, SLOT_COUNT: 1, esc,
    readSlot: () => null, loadGame() {}, clearSlot() {}, saveGame() {}, syncPlayTime() {}, clearSave() {}, clearAllSlots() {},
    getActiveSlot: () => null, setActiveSlot() {}, preflightRunMap() {}, hasRun: () => false, RunStorage: {}, ensureBattleReady: async () => {} });
  c.showTitle();
  return { game, controller: c, acts };
}

describe('R7-b 本地反馈', () => {
  let listeners, docAdd, winAdd;
  beforeEach(() => {
    localStorage.clear(); document.body.innerHTML = ''; delete window.sdtDesktop; listeners = [];
    const docOriginal = document.addEventListener.bind(document), winOriginal = window.addEventListener.bind(window);
    docAdd = vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, opts) => { listeners.push([document, type, fn, opts]); docOriginal(type, fn, opts); });
    winAdd = vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => { listeners.push([window, type, fn, opts]); winOriginal(type, fn, opts); });
  });
  afterEach(() => { listeners.forEach(([target, type, fn, opts]) => target.removeEventListener(type, fn, opts)); docAdd.mockRestore(); winAdd.mockRestore(); });

  it('真实控制器DOM右键保存四字段，双击只写一次', async () => {
    setup();
    document.getElementById('title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 10, clientY: 20 }));
    Object.assign(document.getElementById('sugText'), { value: '<b>正文</b>' });
    document.getElementById('sugSteps').value = '步骤'; document.getElementById('sugExpected').value = '期望'; document.getElementById('sugActual').value = '实际';
    const save = document.getElementById('sugSaveBtn'); save.onclick(); save.onclick(); await Promise.resolve();
    const list = JSON.parse(localStorage.getItem('sdt-suggestions-v1'));
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ text: '<b>正文</b>', steps: '步骤', expected: '期望', actual: '实际', version: 'v9.1' });
    expect(document.getElementById('sugWhere').textContent).toContain('本浏览器');
  });

  it('标题→设置→留言库→设置→标题后按可见DOM记录标题页', async () => {
    const { controller, acts, game } = setup();
    controller.openSettings(); acts.openInbox(); await Promise.resolve(); acts.sugBack(); acts.closeSettings();
    expect(document.getElementById('title').hidden).toBe(false); expect(document.getElementById('overlay').hidden).toBe(true); expect(game.state).toBe('idle');
    document.getElementById('titleSettings').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 12, clientY: 14 }));
    document.getElementById('sugText').value = '页面位置'; await document.getElementById('sugSaveBtn').onclick();
    const entry = JSON.parse(localStorage.getItem('sdt-suggestions-v1'))[0];
    expect(entry).toMatchObject({ version: 'v9.1', page: { id: 'state:title', name: '标题页' } });
    expect(entry.target.name).toContain('标题页 · 按钮「设置」');
  });

  it('真实DOM写失败保留输入与弹层，恢复后可重试一次', async () => {
    setup(); document.getElementById('title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    const ta = document.getElementById('sugText'); ta.value = '别丢';
    const original = Storage.prototype.setItem; Storage.prototype.setItem = () => { throw new Error('full'); };
    try { await document.getElementById('sugSaveBtn').onclick(); } finally { Storage.prototype.setItem = original; }
    expect(ta.value).toBe('别丢'); expect(document.getElementById('sugLayer').hidden).toBe(false);
    await document.getElementById('sugSaveBtn').onclick();
    expect(JSON.parse(localStorage.getItem('sdt-suggestions-v1'))).toHaveLength(1);
  });

  it('坏数据保留；导出白名单排除selector、URL与未知字段', () => {
    localStorage.setItem('sdt-suggestions-v1', '{bad');
    expect(readLocalFeedback()).toMatchObject({ ok: false, code: 'INVALID_DATA' });
    expect(localStorage.getItem('sdt-suggestions-v1')).toBe('{bad');
    expect(feedbackExportRecord({ ts: 't', text: 'x', page: { id: 'p', name: '页' }, target: { name: '按钮', selector: '#secret' }, url: 'https://secret', unknown: 1 }))
      .toEqual({ formatVersion: 1, ts: 't', gameVersion: '未知', page: { id: 'p', name: '页' }, target: { name: '按钮' }, at: null, text: 'x', steps: '', expected: '', actual: '' });
  });

  it.each(['{bad', '{"not":"array"}'])('真实留言库DOM显示坏存储且不覆盖原串：%s', async raw => {
    localStorage.setItem('sdt-suggestions-v1', raw); const { controller } = setup();
    controller.openSuggestionInbox(); await Promise.resolve();
    expect(document.getElementById('sugBox').textContent).toContain('原数据已保留');
    expect(localStorage.getItem('sdt-suggestions-v1')).toBe(raw);
  });

  it('坏存储时从右键保存失败并保留原串与输入', async () => {
    const raw = '{bad'; localStorage.setItem('sdt-suggestions-v1', raw); setup();
    document.getElementById('title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    document.getElementById('sugText').value = '不能覆盖'; await document.getElementById('sugSaveBtn').onclick();
    expect(localStorage.getItem('sdt-suggestions-v1')).toBe(raw); expect(document.getElementById('sugText').value).toBe('不能覆盖');
    expect(document.getElementById('sugWhere').textContent).toContain('写入失败');
  });

  it('旧记录只读不回写，四字段恶意HTML均按文本显示且版本未知', async () => {
    const raw = JSON.stringify([{ ts: 'old', text: '<img src=x>', steps: '<b>步</b>', expected: '<i>期</i>', actual: '<script>实</script>' }]);
    localStorage.setItem('sdt-suggestions-v1', raw); const { controller } = setup();
    controller.openSuggestionInbox(); await Promise.resolve();
    const box = document.getElementById('sugBox');
    expect(box.querySelector('img,script,i')).toBeNull(); expect([...box.querySelectorAll('b')].some(el => el.textContent === '步')).toBe(false);
    for (const literal of ['<img src=x>', '<b>步</b>', '<i>期</i>', '<script>实</script>', '版本：未知']) expect(box.textContent).toContain(literal);
    expect(localStorage.getItem('sdt-suggestions-v1')).toBe(raw);
  });

  it('延迟IPC保存时取消并重开，旧回调不禁用或改写新层', async () => {
    let resolve; window.sdtDesktop = { appendSuggestion: () => new Promise(r => { resolve = r; }) };
    const { game } = setup(); document.getElementById('title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    document.getElementById('sugText').value = '旧'; const pending = document.getElementById('sugSaveBtn').onclick();
    document.getElementById('sugCancelBtn').onclick();
    expect(game.state).toBe('title');
    document.getElementById('title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    expect(document.getElementById('sugLayer').hidden).toBe(false); expect(game.state).toBe('modal');
    expect(document.getElementById('sugSaveBtn').disabled).toBe(false);
    document.getElementById('sugText').value = '新'; resolve(true); await pending;
    expect(document.getElementById('sugText').value).toBe('新'); expect(document.getElementById('sugSaveBtn').disabled).toBe(false); expect(game.state).toBe('modal');
  });

  it('storage getter异常转为失败并允许恢复重试', async () => {
    const throwing = { getItem() { throw new DOMException('denied', 'SecurityError'); } };
    expect(readLocalFeedback(throwing)).toMatchObject({ ok: false, code: 'READ_FAILED' });
    setup(); document.getElementById('title').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
    document.getElementById('sugText').value = '保留';
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } });
    try { await document.getElementById('sugSaveBtn').onclick(); } finally { Object.defineProperty(globalThis, 'localStorage', descriptor); }
    expect(document.getElementById('sugText').value).toBe('保留'); expect(document.getElementById('sugSaveBtn').disabled).toBe(false);
    await document.getElementById('sugSaveBtn').onclick(); expect(JSON.parse(localStorage.getItem('sdt-suggestions-v1'))).toHaveLength(1);
  });

  it('单条下载使用安全文件名并回收Blob URL', async () => {
    const revoke = vi.fn(), click = vi.fn();
    downloadFeedbackRecord({ ts: '2026-09-21T06:00:00+08:00', text: 'x' }, { createObjectURL: () => 'blob:one', revokeObjectURL: revoke, click });
    expect(click).toHaveBeenCalledWith('blob:one', expect.stringMatching(/^sdt-feedback-[0-9A-Za-z_-]+\.json$/));
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(revoke).toHaveBeenCalledWith('blob:one');
  });

  it('下载click抛错仍回收URL并返回可重试失败', async () => {
    const revoke = vi.fn();
    expect(downloadFeedbackRecord({ ts: 'x' }, { createObjectURL: () => 'blob:x', revokeObjectURL: revoke, click: () => { throw new Error('blocked'); } }))
      .toMatchObject({ ok: false, code: 'DOWNLOAD_FAILED' });
    await new Promise(resolve => setTimeout(resolve, 0)); expect(revoke).toHaveBeenCalledWith('blob:x');
  });

  it('真实控制器留言库用数组索引区分重复ts的旧记录导出', async () => {
    localStorage.setItem('sdt-suggestions-v1', JSON.stringify([{ ts: 'same', text: '第一条' }, { ts: 'same', text: '第二条' }]));
    const { controller, acts } = setup();
    URL.createObjectURL = vi.fn(() => 'blob:row'); URL.revokeObjectURL = vi.fn();
    const create = URL.createObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    controller.openSuggestionInbox(); await Promise.resolve();
    acts.sugExport({ idx: '1' });
    expect(create).toHaveBeenCalledOnce();
    const blob = create.mock.calls[0][0];
    const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
    expect(text).toContain('第二条');
    click.mockRestore();
  });

  it('真实控制器导出URL创建先失败可见，恢复后重试准确且不写存储', async () => {
    const raw = JSON.stringify([{ ts: 'same', text: '准确正文' }]); localStorage.setItem('sdt-suggestions-v1', raw);
    const { controller, acts } = setup(); controller.openSuggestionInbox(); await Promise.resolve();
    let fail = true, exported;
    URL.createObjectURL = vi.fn(blob => { if (fail) throw new Error('blocked'); exported = blob; return 'blob:ok'; }); URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    acts.sugExport({ idx: '0' }); expect(document.querySelector('[data-act="sugExport"]').textContent).toContain('失败');
    fail = false; acts.sugExport({ idx: '0' }); expect(document.querySelector('[data-act="sugExport"]').textContent).toBe('已导出');
    const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(exported); });
    expect(text).toContain('准确正文'); expect(localStorage.getItem('sdt-suggestions-v1')).toBe(raw);
  });
});
