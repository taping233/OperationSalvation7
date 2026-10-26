// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { beginPageEntryCancellation, cancelPendingPageEntries, releasePageEntryCancellation } from '../game/src/ui/page-entry-cancellation.js';

afterEach(() => cancelPendingPageEntries());

describe('页面载入取消仲裁', () => {
  it('新目标取消旧目标；旧尾部收官不移除新取消口', () => {
    const old = vi.fn(() => { releasePageEntryCancellation('hub', old); return true; });
    const next = vi.fn(() => { releasePageEntryCancellation('cardslib', next); return true; });
    beginPageEntryCancellation('hub', old);
    beginPageEntryCancellation('cardslib', next);
    expect(old).toHaveBeenCalledOnce();
    releasePageEntryCancellation('hub', old);
    expect(cancelPendingPageEntries()).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('所有目标均收到取消；已就绪的淡出不吞掉真实返回键', () => {
    const ready = vi.fn(() => { releasePageEntryCancellation('hub', ready); return false; });
    beginPageEntryCancellation('hub', ready);
    expect(cancelPendingPageEntries()).toBe(false);
    expect(ready).toHaveBeenCalledOnce();
    expect(cancelPendingPageEntries()).toBe(false);
  });

  it('只接受自己的解除口，旧 owner callback 不能移除新的注册', () => {
    const old = vi.fn(() => false);
    const current = vi.fn(() => { releasePageEntryCancellation('hub', current); return true; });
    beginPageEntryCancellation('hub', old);
    beginPageEntryCancellation('hub', current);
    releasePageEntryCancellation('hub', old);
    expect(cancelPendingPageEntries()).toBe(true);
    expect(current).toHaveBeenCalledOnce(); expect(old).not.toHaveBeenCalled();
  });
});
