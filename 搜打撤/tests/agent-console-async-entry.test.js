import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ jump: vi.fn() }));
vi.mock('../game/src/ui/quick-nav.js', () => ({ jump: h.jump, listPages: () => [{ id: 'hubDeploy', name: '基地', key: '1' }] }));
vi.mock('../game/src/core/shared.js', () => ({ esc: String, escAttr: String }));
import { bindKeysTab } from '../game/src/agent/agent.console.js';

let handler, render, log;
beforeEach(() => {
  h.jump.mockReset();
  document.body.innerHTML = '<div id="ovBody"><section id="devConsole">快捷键</section></div>';
  render = vi.fn(); log = vi.fn();
  window.SDT = { UI: { act(_name, callback) { handler = callback; }, log } };
  bindKeysTab(render);
});

describe('控制台消费异步快捷入口', () => {
  it('Promise false 不冒报成功，来源仍在才重绘', async () => {
    h.jump.mockResolvedValue(false);
    expect(await handler({ page: 'hubDeploy' })).toBe(false);
    expect(render).toHaveBeenCalledOnce(); expect(log).not.toHaveBeenCalled();
  });

  it('等待真正完成后才报告成功，不关闭目标页', async () => {
    let finish; h.jump.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const entry = handler({ page: 'hubDeploy' });
    expect(log).not.toHaveBeenCalled();
    document.getElementById('ovBody').innerHTML = '<section id="hubMain">基地</section>';
    finish(true); await entry;
    expect(log).toHaveBeenCalledOnce(); expect(render).not.toHaveBeenCalled();
    expect(document.getElementById('hubMain')).not.toBeNull();
  });

  it('更新导航或关闭控制台后，旧失败不复活来源页', async () => {
    let finish; h.jump.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const entry = handler({ page: 'hubDeploy' });
    document.getElementById('ovBody').innerHTML = '<section class="settings-page">设置</section>';
    finish(false); await entry;
    expect(render).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
    expect(document.querySelector('.settings-page')).not.toBeNull();
  });
});
