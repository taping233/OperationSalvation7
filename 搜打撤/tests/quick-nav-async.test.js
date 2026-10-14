import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  game: { state: 'modal', runActive: false, battleActive: false, nestActive: false },
  openBaseHub: vi.fn(), openCardLibrary: vi.fn(), openSettings: vi.fn(), log: vi.fn(), cancelCard: vi.fn(),
}));
vi.mock('../game/src/run/game.session.js', () => ({ game: h.game, openSettings: h.openSettings, openSuggestionInbox: vi.fn(), openDataPageUi: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: h.openBaseHub }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ openCardLibrary: h.openCardLibrary, cancelPendingCardPageOpen: h.cancelCard }));
import { jump } from '../game/src/ui/quick-nav.js';
import { beginPageEntryCancellation, cancelPendingPageEntries } from '../game/src/ui/page-entry-cancellation.js';

beforeEach(() => {
  vi.clearAllMocks(); h.game.runActive = h.game.battleActive = h.game.nestActive = false;
  window.SDT = { UI: { log: h.log } };
});
afterEach(() => cancelPendingPageEntries());

describe('快捷进入的异步结果', () => {
  it('等待真实页面结果；异步 false 不报告成功', async () => {
    let finish;
    h.openBaseHub.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const opened = jump('hubDeploy');
    finish(false);
    expect(await opened).toBe(false);
    expect(h.openBaseHub).toHaveBeenCalledWith('deploy');
  });

  it('捕获异步 rejection 并留下可读错误，无未处理异常', async () => {
    h.openCardLibrary.mockRejectedValueOnce(new Error('offline'));
    expect(await jump('cardslib')).toBe(false);
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining('offline'), 'warn');
  });

  it('同步目标接管导航先取消旧基地/照相馆请求', async () => {
    const cancel = vi.fn(() => true);
    beginPageEntryCancellation('hub', cancel);
    expect(await jump('settings')).toBe(true);
    expect(cancel).toHaveBeenCalledOnce(); expect(h.openSettings).toHaveBeenCalledOnce();
  });

  it('状态守卫仍拒绝对局中的基地与设置，不开始新导航', async () => {
    h.game.runActive = true;
    expect(await jump('hubDeploy')).toBe(false);
    expect(await jump('settings')).toBe(false);
    expect(h.openBaseHub).not.toHaveBeenCalled(); expect(h.openSettings).not.toHaveBeenCalled();
  });
});
