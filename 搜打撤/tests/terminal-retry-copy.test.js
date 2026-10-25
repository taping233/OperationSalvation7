import { battleRules } from './helpers/environment-fixtures.js';
// terminal-retry-copy.test.js —— SYS-10（2026-10-03 老板）存档失败提示钉现状：
// 终局失败页必须说人话（进度保留在哪、重试为什么安全），不裸露实现术语/原始异常。
// 幂等机制本身不在此重建——tests/terminal-persistence.test.js 三失败点矩阵 +
// tests/terminal-death.test.js 整链用例已钉「失败重试只落一次」，这里只锁玩家可见文案。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';

import { runTerminalSettlement } from '../game/src/ui/terminal-settlement.js';

const canvasCtx = new Proxy({}, { get: () => () => canvasCtx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => canvasCtx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music: vi.fn(), sfx: vi.fn(), setDucked: vi.fn() },
  FX: { feedback: vi.fn() },
  MAP: { rules: { playerMaxHp: 50, playerAtk: 4, fireHeal: 5, ...battleRules(2, 10, 10, 0, 5, 1) } },
};
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');
installImmediateWebLocks();
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const session = await import('../game/src/run/game.session.js');
const { game, saveGame } = session;
const logs = [];

beforeEach(() => {
  Object.assign(window.SDT.UI, {
    log: vi.fn((...a) => { logs.push(a.join(' ')); }), refresh: vi.fn(), clearLog: vi.fn(), hideOverlay: vi.fn(),
    hideScreen: vi.fn(), showScreen: vi.fn(), showOverlay: vi.fn(), act: vi.fn(),
    registerHelp: vi.fn(), helpBtn: () => '',
  });
  window.SDT.Nest = { renderNestMap: vi.fn() };
});

/** 直驱 runTerminalSettlement 的最小注入，收下失败页标题/正文供断言。 */
function drive({ terminalCommands, token = { busy: false, promise: null, attempt: null } }) {
  const overlays = [];
  const actions = new Map();
  const done = runTerminalSettlement({
    token, current: () => true, game: {},
    UI: {
      showOverlay: (title, html) => overlays.push({ title, html }),
      act: (name, fn) => actions.set(name, fn),
      refresh: () => {},
    },
    finish: () => true,
    command: 'run.death', retryAct: 'retryCopyProbe', extraPayload: {},
    terminalCommands,
  });
  return { done, overlays, actions };
}

describe('终局失败页人话文案（SYS-10）', () => {
  it('结算通道未就绪：不再出现「服务不可用」术语，页面说明进度保留与重试安全', async () => {
    const { done, overlays, actions } = drive({ terminalCommands: null });
    await done;
    const page = overlays.at(-1);
    expect(page.title).toContain('终局结算未保存');
    expect(page.html).not.toContain('服务不可用');
    expect(page.html).toContain('还保留');              // 进度保留说明
    expect(page.html).toContain('不会重复扣牌');         // 重试幂等承诺
    expect(page.html).toContain('重试结算');             // 能做哪一步：重试按钮在
    expect(typeof actions.get('retryCopyProbe')).toBe('function');
  });

  it('意外异常不透传原始 message（注入英文 QuotaExceededError 不再上屏），控制台留痕', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { done, overlays } = drive({
      token: { busy: false, promise: null, ephemeral: true, cards: [] },
      terminalCommands: { projectEphemeral: () => { throw new Error('The quota has been exceeded.'); } },
    });
    await done;
    errSpy.mockRestore();
    expect(overlays.at(-1).html).not.toContain('The quota has been exceeded');
    expect(overlays.at(-1).html).toContain('意外问题');
    expect(overlays.at(-1).html).toContain('不会重复扣牌');
  });

  it('命令域失败消息继续展示（人话中文），并叠加进度保留/重试安全说明', async () => {
    const { done, overlays } = drive({
      terminalCommands: { createAttempt: async () => ({ ok: false, message: '存档已恢复，请重新确认终局操作' }) },
    });
    await done;
    const page = overlays.at(-1);
    expect(page.html).toContain('存档已恢复，请重新确认终局操作');
    expect(page.html).toContain('还保留');
    expect(page.html).toContain('不会重复扣牌');
  });
});

describe('常规存档写失败提示（saveGame，注入配额满）', () => {
  it('写失败不落盘、主档原样，日志给出人话原因与处置建议', async () => {
    window.localStorage.clear();
    RunStorage.readForLoad(2);   // clear 后重置写基线，防跨用例基线残留触发 STALE_SLOT
    window.SDT.Base.use(2);
    (await window.SDT.Base.reset(2));
    (await window.SDT.Base.save());
    session._set_active_slot(2);
    logs.length = 0;
    await session.newRun('standard', [], { skipClassChoice: true });
    await RunStorage.flushWrites();
    game.state = 'idle';
    const runKey = RunStorage.key(2);
    const raw = window.localStorage.getItem(runKey);
    const proto = Object.getPrototypeOf(window.localStorage);
    const spy = vi.spyOn(proto, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    });
    const saving = saveGame();
    expect(saving).toBeInstanceOf(Promise);
    await expect(saving).resolves.toBe(false);
    spy.mockRestore();
    expect(window.localStorage.getItem(runKey)).toBe(raw);   // 主档字节未变
    expect(logs.join('\n')).toContain('对局存档写入失败（存储空间可能已满）');
    expect(logs.join('\n')).toContain('请导出存档或删除旧档位');   // 处置建议
  });
});
