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
  it('中途收回仍以自然布局为基准，动画结束才解锁背景并归还焦点', () => {
    const zoom = openPhoto();
    expect(zoom.style.getPropertyValue('--cz-photo-from-transform')).toContain('scale(0.25)');
    naturalRect = { left: 30, top: 20, width: 60, height: 60 };
    zoom.querySelector('.cz-close').click();
    expect(zoom.classList.contains('cz-photo-closing-to-source')).toBe(true);
    expect(zoom.style.getPropertyValue('--cz-photo-to-transform')).toBe('translate(-475px, -275px) scale(0.25)');
    expect(UI.el.overlay.inert).toBe(true);
    vi.advanceTimersByTime(319);
    expect(zoom.isConnected).toBe(true);
    vi.advanceTimersByTime(81);
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
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const zoom = openPhoto();
    zoom.querySelector('.cz-close').click();
    expect(zoom.isConnected).toBe(false);
    expect(UI.el.overlay.inert).toBe(false);
    expect(document.activeElement).toBe(opener);
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
