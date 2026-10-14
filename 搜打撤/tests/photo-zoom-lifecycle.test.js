import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

let UI, SDT, source, opener, naturalRect;
const card = { id: 'photo-test', name: '照片测试', type: '法术', cost: 2, desc: '测试规则' };
beforeAll(async () => {
  SDT = (await import('../game/src/core/sdt-facade.js')).default;
  ({ UI } = await import('../game/src/ui/ui.js'));
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><button id="open">查看大图</button><div id="source"></div></div>';
  source = document.querySelector('#source');
  opener = document.querySelector('#open');
  opener.focus();
  const sourceRect = { left: 50, top: 50, right: 200, bottom: 200, width: 150, height: 150 };
  source.getClientRects = () => [sourceRect];
  source.getBoundingClientRect = () => sourceRect;
  naturalRect = { left: 300, top: 100, right: 900, bottom: 700, width: 600, height: 600 };
  SDT.UiScale = { scale: () => 1, rect: el => el === source ? sourceRect : naturalRect };
  SDT.Art = { cardIcon: () => '<img src="/photo.png" alt="照片测试">', decodeIn: () => {} };
  SDT.Cards = { DMG_TYPES: ['法术'], rarityOf: () => '稀有', cardHTML: () => '<div class="hs-card">原卡牌</div>' };
  SDT.Sound = { sfx: () => {} };
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  UI.el.overlay = document.querySelector('#overlay');
});
afterEach(() => {
  document.querySelector('#cardZoom')?._closeCardZoom(true);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function openPhoto(extra = {}) {
  UI.showCardZoom(card, { presentation: 'photo', from: source, returnFocus: opener, ...extra });
  return document.querySelector('#cardZoom');
}

describe('照片弹层收回生命周期', () => {
  it('文字引用入口没有缩略图时，已加载的实际图片决定比例', () => {
    SDT.Art.cardIcon = () => '<img src="/wide-photo.png" alt="照片测试">';
    const zoom = openPhoto({ from: undefined });
    const image = zoom.querySelector('.cz-photo-image img');
    Object.defineProperties(image, { naturalWidth: { value: 1441 }, naturalHeight: { value: 1092 } });
    image.dispatchEvent(new Event('load'));
    expect(+zoom.style.getPropertyValue('--cz-photo-ratio')).toBeCloseTo(1441 / 1092);
  });
  it('图片加载时兼容竖图，已关闭的弹层不会再更新比例', () => {
    const zoom = openPhoto({ from: undefined });
    const image = zoom.querySelector('.cz-photo-image img');
    Object.defineProperties(image, { naturalWidth: { value: 800 }, naturalHeight: { value: 1200 } });
    image.dispatchEvent(new Event('load'));
    expect(+zoom.style.getPropertyValue('--cz-photo-ratio')).toBeCloseTo(2 / 3);
    zoom._closeCardZoom(true);
    zoom.style.setProperty('--cz-photo-ratio', '1');
    image.dispatchEvent(new Event('load'));
    expect(zoom.style.getPropertyValue('--cz-photo-ratio')).toBe('1');
  });
  it('照相馆样板取片入场持续420ms，背签延后出现，收回仍沿原时序', () => {
    const zoom = openPhoto({ photoMotion: 'atelier' });
    expect(zoom.classList.contains('cz-photo-atelier')).toBe(true);
    expect(zoom.style.getPropertyValue('--cz-photo-motion-ms')).toBe('420ms');
    expect(zoom.style.getPropertyValue('--cz-photo-info-delay')).toBe('100ms');
    vi.advanceTimersByTime(300);
    expect(zoom.classList.contains('cz-photo-flipping')).toBe(true);
    vi.advanceTimersByTime(140);
    expect(zoom.classList.contains('cz-photo-flipping')).toBe(false);
    zoom.querySelector('.cz-close').click();
    expect(zoom.style.getPropertyValue('--cz-photo-motion-ms')).toBe('120ms');
    vi.advanceTimersByTime(179);
    expect(zoom.isConnected).toBe(true);
    vi.advanceTimersByTime(1);
    expect(zoom.isConnected).toBe(false);
    expect(UI.el.overlay.inert).toBe(false);
  });
  it('未选择照相馆预设时保留原照片入场', () => {
    const zoom = openPhoto();
    expect(zoom.classList.contains('cz-photo-atelier')).toBe(false);
    expect(zoom.style.getPropertyValue('--cz-photo-motion-ms')).toBe('140ms');
    expect(zoom.style.getPropertyValue('--cz-photo-info-delay')).toBe('0ms');
  });
  it('中途收回仍以自然布局为基准，动画结束才解锁背景并归还焦点', () => {
    const zoom = openPhoto();
    expect(zoom.style.getPropertyValue('--cz-photo-from-transform')).toContain('scale(0.25)');
    naturalRect = { left: 30, top: 20, width: 60, height: 60 };
    zoom.querySelector('.cz-close').click();
    expect(zoom.classList.contains('cz-photo-closing-to-source')).toBe(true);
    expect(zoom.style.getPropertyValue('--cz-photo-to-transform')).toBe('translate(-475px, -275px) scale(0.25)');
    expect(UI.el.overlay.inert).toBe(true);
    // 10-04 studio-cover 批收回时序：photoCloseMs=120ms + 60ms 容错 → 180ms 移除（旧值 340ms 系改版前口径）
    vi.advanceTimersByTime(179);
    expect(zoom.isConnected).toBe(true);
    vi.advanceTimersByTime(100);
    expect(zoom.isConnected).toBe(false);
    expect(UI.el.overlay.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
  it('来源消失时淡出，并在关闭开始时保存尚未防抖写入的备注', () => {
    const save = vi.fn(() => true);
    const zoom = openPhoto({ noteEditable: true, onNoteSave: save });
    const note = zoom.querySelector('textarea');
    note.value = '尚未到自动保存时间';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    source.remove();
    zoom.querySelector('.cz-close').click();
    expect(zoom.classList.contains('cz-photo-closing-fallback')).toBe(true);
    expect(save).toHaveBeenCalledWith('尚未到自动保存时间');
    vi.advanceTimersByTime(400);
    expect(document.querySelector('#cardZoom')).toBeNull();
  });
  it('备注保存失败显示暂存状态，重试成功才显示已存档', () => {
    const save = vi.fn(() => ({ ok: false, persisted: false, note: '暂存编辑', code: 'WRITE_FAILED' }));
    const zoom = openPhoto({ noteEditable: true, onNoteSave: save });
    const note = zoom.querySelector('textarea');
    note.value = '暂存编辑';
    note.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(240);
    expect(zoom.querySelector('.cz-note-status').textContent).toBe('未存档，已暂存本次会话');
    expect(zoom.querySelector('.cz-note').classList.contains('has')).toBe(false);
    expect(note.value).toBe('暂存编辑');
    save.mockImplementation(() => ({ ok: true, persisted: true, note: '暂存编辑' }));
    note.dispatchEvent(new Event('blur'));
    expect(zoom.querySelector('.cz-note-status').textContent).toBe('已存档');
    expect(zoom.querySelector('.cz-note').classList.contains('has')).toBe(true);
  });
  it('重开未落盘备注与未落盘清空时不盖已存档章', () => {
    const save = () => ({ ok: false, persisted: false, note: '', code: 'WRITE_FAILED' });
    const zoom = openPhoto({ noteEditable: true, note: '暂存编辑', notePending: true, onNoteSave: save });
    expect(zoom.querySelector('.cz-note-status').textContent).toBe('未存档，已暂存本次会话');
    expect(zoom.querySelector('.cz-note').classList.contains('has')).toBe(false);
    const note = zoom.querySelector('textarea');
    note.value = '';
    note.dispatchEvent(new Event('blur'));
    expect(zoom.querySelector('.cz-note-status').textContent).toBe('未存档，已暂存本次会话');
    expect(zoom.querySelector('.cz-note').classList.contains('has')).toBe(false);
  });
  it('收回中重新打开会取消旧弹层，默认卡牌展示不受影响', () => {
    const old = openPhoto();
    old.querySelector('.cz-close').click();
    UI.showCardZoom(card);
    const next = document.querySelector('#cardZoom');
    expect(old.isConnected).toBe(false);
    expect(document.querySelectorAll('#cardZoom')).toHaveLength(1);
    expect(next.querySelector('.hs-card')).not.toBeNull();
    expect(next.querySelector('.cz-photo-paper')).toBeNull();
    vi.advanceTimersByTime(600);
    expect(next.isConnected).toBe(true);
  });
  it('来源被滚动容器裁切时，展开和收回都使用居中过渡', () => {
    const clip = document.createElement('div');
    clip.style.overflow = 'auto';
    clip.getBoundingClientRect = () => ({ left: 0, top: 220, right: 300, bottom: 500 });
    UI.el.overlay.append(clip);
    clip.append(source);
    const zoom = openPhoto();
    expect(zoom.style.getPropertyValue('--cz-photo-from-transform')).toBe('');
    zoom.querySelector('.cz-close').click();
    expect(zoom.classList.contains('cz-photo-closing-fallback')).toBe(true);
    vi.advanceTimersByTime(400);
    expect(zoom.isConnected).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
  it('减少动态效果偏好下立即关闭且恢复背景操作', () => {
    // 走权威判定（core/motion.js）的真实用户路径：设置页写入 sdt-reduce-motion +
    // refreshReduceMotion()。旧实现只读 matchMedia、无视该设置开关（2026-09-28 修复）。
    localStorage.setItem('sdt-reduce-motion', '1');
    SDT.Motion.refreshReduceMotion();
    try {
      const zoom = openPhoto();
      zoom.querySelector('.cz-close').click();
      expect(zoom.isConnected).toBe(false);
      expect(UI.el.overlay.inert).toBe(false);
      expect(document.activeElement).toBe(opener);
    } finally {
      localStorage.removeItem('sdt-reduce-motion');
      SDT.Motion.refreshReduceMotion();   // 偏好复位，不泄漏进后续用例
    }
  });
  it('系统 prefers-reduced-motion（无设置开关）同样立即关闭', () => {
    // 媒体查询分支的独立钉（复核建议）：权威口径 = 设置开关 || 媒体查询
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    SDT.Motion.refreshReduceMotion();
    try {
      const zoom = openPhoto();
      zoom.querySelector('.cz-close').click();
      expect(zoom.isConnected).toBe(false);
    } finally {
      vi.unstubAllGlobals();
      SDT.Motion.refreshReduceMotion();
    }
  });
  it.each(['.cz-photo-layout', '.cz-photo-main', '.cz-photo-info', '.cz-hint', '.cz-backdrop'])('点击照片外的 %s 可收回', selector => {
    const zoom = openPhoto();
    zoom.querySelector(selector).click();
    expect(zoom.classList.contains('cz-photo-closing')).toBe(true);
    vi.advanceTimersByTime(400);
    expect(zoom.isConnected).toBe(false);
  });
  it('点击照片、编辑背签和使用词条不会误收回', () => {
    const zoom = openPhoto({ noteEditable: true, onNoteSave: () => true });
    zoom.querySelector('.cz-photo-paper').click();
    zoom.querySelector('textarea').click();
    const term = document.createElement('span');
    term.dataset.term = '测试词条';
    zoom.querySelector('.cz-photo-rules').append(term);
    term.click();
    expect(zoom.classList.contains('cz-photo-closing')).toBe(false);
    expect(zoom.isConnected).toBe(true);
  });
});
