import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameMenuController } from './helpers/menu-controller.js';

function mountLeaveMenu({ slot = 1, save } = {}) {
  document.body.innerHTML = '<div id="title" hidden></div><div id="exitScr" hidden></div><div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  const actions = new Map();
  const game = { state:'idle', runActive:true, layerIdx:0, layerData:[{ name:'外围荒地' }], coins:9, ownedCards:[] };
  const saveSession = save || vi.fn(() => ({ ok:true }));
  const UI = {
    showOverlay:vi.fn((title, html) => {
      document.getElementById('ovTitle').textContent = title;
      document.getElementById('ovBody').innerHTML = html;
    }),
    act:(name, handler) => actions.set(name, handler),
    hideOverlay:vi.fn(), refresh:vi.fn(), log:vi.fn(), showScreen:vi.fn(), hideScreen:vi.fn(),
  };
  const depositCards = vi.fn();
  const SDT = { Base:{ peek:() => null, depositCards }, Meta:{ ACHIEVEMENTS:[] },
    Sound:{ sfx:vi.fn(), music:vi.fn() }, Cards:{ cardHTML:() => '' } };
  const controller = createGameMenuController({ SDT, UI, game,
    runtime:{ resize:vi.fn(), openBaseHub:vi.fn() }, SLOT_COUNT:0, esc:String,
    saveSession, getActiveSlot:() => slot, setActiveSlot:vi.fn(),
    readSlot:vi.fn(), terminalCommands:{ projectEphemeral:({ cards }) => depositCards(cards) },
  });
  controller.openLeaveMenu();
  return { actions, game, UI, controller, saveSession, depositCards };
}

beforeEach(() => {
  localStorage.setItem('sdt-rmb-hint', '1');
  document.body.className = '';
});

describe('离开对局：保存结果与分级确认', () => {
  it('打开时不声称已保存，继续游玩只关闭面板', () => {
    const { actions, game, UI, saveSession } = mountLeaveMenu();
    expect(document.getElementById('ovTitle').textContent).toBe('系统菜单');
    expect(document.querySelector('.leave-run-panel').textContent).not.toContain('已保存');
    expect(document.querySelector('.leave-run-actions button').dataset.act).toBe('leaveCancel');
    expect(UI.showOverlay.mock.calls[0][3].initialFocus).toBe('[data-act="leaveCancel"]');
    actions.get('leaveCancel')();
    expect(game.state).toBe('idle');
    expect(game.runActive).toBe(true);
    expect(saveSession).not.toHaveBeenCalled();
    expect(UI.hideOverlay).toHaveBeenCalledOnce();
  });

  it('保存失败保留当前对局与面板，重试成功才回主菜单', async () => {
    const save = vi.fn().mockResolvedValueOnce({ ok:false }).mockResolvedValueOnce({ ok:true });
    const { actions, game, UI } = mountLeaveMenu({ save });
    expect(await actions.get('leaveSave')()).toBe(false);
    expect(game.runActive).toBe(true);
    expect(game.state).toBe('modal');
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(UI.showScreen).not.toHaveBeenCalled();
    expect(document.querySelector('.leave-run-status').hidden).toBe(false);
    expect(document.querySelector('.leave-run-status').textContent).toContain('未能保存');
    expect(document.querySelector('[data-act="leaveSave"]').textContent).toBe('重试保存并退出');
    expect(await actions.get('leaveSave')()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
    expect(game.state).toBe('title');
    expect(UI.hideOverlay).toHaveBeenCalledOnce();
  });

  it('保存处理中防重复点击和取消，只有确认写入后退出', async () => {
    let resolveSave;
    const save = vi.fn(() => new Promise(resolve => { resolveSave = resolve; }));
    const { actions, game, UI } = mountLeaveMenu({ save });
    const first = actions.get('leaveSave')();
    const second = actions.get('leaveSave')();
    actions.get('leaveCancel')();
    expect(save).toHaveBeenCalledOnce();
    expect(document.querySelector('.leave-run-panel').getAttribute('aria-busy')).toBe('true');
    expect([...document.querySelectorAll('.leave-run-panel button')].every(button => button.disabled)).toBe(true);
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    resolveSave({ ok:true });
    await Promise.all([first, second]);
    expect(game.state).toBe('title');
    expect(UI.hideOverlay).toHaveBeenCalledOnce();
  });

  it.each([true, false])('旧保存结果 %s 不关闭或改写替换后的页面', async saved => {
    let resolveSave;
    const save = vi.fn(() => new Promise(resolve => { resolveSave = resolve; }));
    const { actions, game, UI } = mountLeaveMenu({ save });
    const pending = actions.get('leaveSave')();
    UI.showOverlay('其他页面', '<section class="replacement">新的内容</section>');
    game.state = 'replacement';
    resolveSave({ ok:saved });
    expect(await pending).toBe(false);
    expect(game.state).toBe('replacement');
    expect(document.querySelector('.replacement').textContent).toBe('新的内容');
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    expect(UI.showScreen).not.toHaveBeenCalled();
  });

  it.each(['hidden', 'closing'])('面板 %s 后旧保存不退出，新面板仍可保存', async state => {
    let resolveSave;
    const save = vi.fn().mockImplementationOnce(() => new Promise(resolve => { resolveSave = resolve; })).mockResolvedValue({ ok:true });
    const { actions, game, UI, controller } = mountLeaveMenu({ save });
    const pending = actions.get('leaveSave')();
    const overlay = document.getElementById('overlay');
    if (state === 'hidden') overlay.hidden = true;
    else overlay.classList.add('closing');
    game.state = 'idle';
    resolveSave({ ok:true });
    expect(await pending).toBe(false);
    expect(game.state).toBe('idle');
    expect(UI.hideOverlay).not.toHaveBeenCalled();
    overlay.hidden = false; overlay.classList.remove('closing');
    controller.openLeaveMenu();
    expect(await actions.get('leaveSave')()).toBe(true);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('未关联档位不能伪装保存成功；undefined也不能触发退出', async () => {
    const temporary = mountLeaveMenu({ slot:null });
    expect(document.querySelector('[data-act="leaveSave"]').disabled).toBe(true);
    await temporary.actions.get('leaveSave')();
    expect(temporary.saveSession).not.toHaveBeenCalled();
    const skipped = mountLeaveMenu({ save:vi.fn(() => undefined) });
    expect(await skipped.actions.get('leaveSave')()).toBe(false);
    expect(skipped.UI.hideOverlay).not.toHaveBeenCalled();
    expect(skipped.game.runActive).toBe(true);
  });

  it('放弃必须经过独立确认；返回后旧确认动作失效', () => {
    const { actions, game, depositCards } = mountLeaveMenu({ slot:null });
    game.ownedCards = [{ card:{ name:'带入卡' }, safe:true, brought:true }, { card:{ name:'安全所得' }, safe:true }];
    actions.get('leaveAbandon')();
    expect(document.querySelector('[data-leave-step="abandon"]')).not.toBeNull();
    expect(document.querySelector('.leave-run-consequences').textContent).toContain('（1 张）');
    expect(depositCards).not.toHaveBeenCalled();
    const staleConfirm = actions.get('leaveAbandonConfirm');
    actions.get('leaveReviewBack')();
    expect(staleConfirm()).toBe(false);
    expect(game.runActive).toBe(true);
    expect(depositCards).not.toHaveBeenCalled();
    expect(document.querySelector('[data-leave-step="choice"]')).not.toBeNull();
  });
});
