import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game:{}, saveGame:vi.fn() }));
vi.mock('../game/src/run/game.session.js', () => ({ game:fixture.game, MAP:{}, newRun:vi.fn(), saveGame:fixture.saveGame, scaledEnemy:vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({ buildEncounter:vi.fn(), openChestsOnCell:vi.fn(), openShop:vi.fn() }));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openAltarRitual:vi.fn(), openFireRest:vi.fn() }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ runEventDeck:vi.fn() }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ captureBattleContext:vi.fn(), startBattle:vi.fn() }));
vi.mock('../game/src/agent/agent.console.js', () => ({
  agentTabHTML:() => '<p>Agent</p>', keysTabHTML:() => '<p>快捷键</p>',
  bindAgentTab:vi.fn(), bindKeysTab:vi.fn(),
}));
vi.mock('../game/src/agent/agent.data.js', () => ({ dataPanelHTML:() => '<p>跑局数据</p>', bindDataActions:vi.fn() }));

let UI, openDevConsole, cardPages;
beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  Object.keys(fixture.game).forEach(key => delete fixture.game[key]);
  Object.assign(fixture.game, { state:'idle', runActive:true, battleActive:false, coins:0, hp:20, maxHp:30, persistSave:vi.fn() });
  UI = {
    el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody'), ovTitle:document.getElementById('ovTitle') },
    _acts:{}, _inputHandler:null, _hoverHandler:null, _lastMode:null, wipeNextShow:false,
    act(name, handler) { this._acts[name] = handler; },
    showOverlay(title, html, mode) {
      if (this.wipeNextShow) { this._acts = {}; this.wipeNextShow = false; }
      this.el.overlay.hidden = false; this.el.ovTitle.innerHTML = title; this.el.ovBody.innerHTML = html; this._lastMode = mode;
    },
    hideOverlay:vi.fn(function () { this._acts = {}; this._inputHandler = null; this._hoverHandler = null; this.el.overlay.hidden = true; this.el.ovBody.replaceChildren(); }),
    log:vi.fn(), refresh:vi.fn(),
  };
  window.SDT = { UI, Cards:{ all:() => [{ id:'test', name:'测试卡', type:'法术' }] }, Sound:{ sfx:vi.fn() } };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.disabled) UI._acts[button.dataset.act]?.(button.dataset);
  });
  cardPages = await import('../game/src/hub/game.cardslib.common.js');
  ({ openDevConsole } = await import('../game/src/run/game.run.dev.js'));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function closeConsole() { UI._acts.devcClose?.(); }

describe('开发控制台保存来源与关闭生命周期', () => {
  it('战斗发卡走战斗命令并返回战斗，不再只写背包', () => {
    fixture.game.battleActive = true;
    fixture.game.grantCard = vi.fn();
    const dev = vi.fn(() => true), refreshView = vi.fn();
    window.SDT.Battle = { commands:{ dev, refreshView } };
    openDevConsole();
    const input = document.getElementById('devcSearch');
    input.value = '测试'; UI._inputHandler({ target:input });
    document.querySelector('.devc-hit').click();
    expect(dev).toHaveBeenCalledExactlyOnceWith('card', 'test');
    expect(fixture.game.grantCard).not.toHaveBeenCalled();
    expect(refreshView).toHaveBeenCalledOnce();
  });

  it('战斗外发卡成功保存，拒收时不保存', () => {
    fixture.game.grantCard = vi.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
    openDevConsole();
    const input = document.getElementById('devcSearch');
    input.value = '测试'; UI._inputHandler({ target:input });
    document.querySelector('.devc-hit').click();
    document.querySelector('.devc-hit').click();
    expect(fixture.game.persistSave).toHaveBeenCalledOnce();
  });

  it('挂起关闭清理动作表后，控制台仍注册有效关闭动作', () => {
    UI.wipeNextShow = true;
    openDevConsole();
    expect(typeof UI._acts.devcClose).toBe('function');
    closeConsole();
    expect(UI.el.overlay.hidden).toBe(true);
    expect(fixture.game.state).toBe('idle');
  });

  it('恢复原事件节点、直接监听器和领奖回调，不把modal来源丢成禁用地图', () => {
    fixture.game.state = 'modal';
    UI.showOverlay('待领取', '<section id="sourceEvent"><button data-act="claim">领取</button></section>', 'page');
    const node = document.getElementById('sourceEvent');
    const direct = vi.fn(), claim = vi.fn(), originalInput = vi.fn();
    node.addEventListener('click', direct);
    UI.act('claim', claim); UI._inputHandler = originalInput;
    openDevConsole();
    UI._acts.devcTab({ tab:'keys' });
    closeConsole();
    expect(document.getElementById('sourceEvent')).toBe(node);
    expect(UI.el.overlay.hidden).toBe(false);
    expect(UI._lastMode).toBe('page');
    expect(UI._inputHandler).toBe(originalInput);
    expect(fixture.game.state).toBe('modal');
    node.querySelector('button').click();
    expect(claim).toHaveBeenCalledOnce();
    expect(direct).toHaveBeenCalledOnce();
  });

  it('调试与其他页签共用同一开关，搜索输入不重建宿主，资源动作只保存一次', () => {
    openDevConsole();
    const input = document.getElementById('devcSearch');
    input.value = '测试'; UI._inputHandler({ target:input });
    expect(document.getElementById('devcSearch')).toBe(input);
    expect(document.querySelector('.devc-hit')).not.toBeNull();
    UI._acts.devcCoin({ n:'50' });
    expect(fixture.game.coins).toBe(50);
    expect(fixture.game.persistSave).toHaveBeenCalledOnce();
    UI._acts.devcTab({ tab:'data' });
    expect(UI._inputHandler).toBeNull();
    UI._acts.devcTab({ tab:'debug' });
    const returnedInput = document.getElementById('devcSearch');
    expect(returnedInput.value).toBe('测试');
    returnedInput.value = '测试卡'; UI._inputHandler({ target:returnedInput });
    expect(document.getElementById('devcSearch')).toBe(returnedInput);
    expect(document.querySelector('.devc-hit').textContent).toContain('测试卡');
    UI._acts.devcTab({ tab:'data' });
    openDevConsole();
    expect(UI.el.overlay.hidden).toBe(true);
    expect(fixture.game.persistSave).toHaveBeenCalledOnce();
  });

  it('卡牌大页在控制台期间不走旧关闭路由，关闭后恢复其标记', () => {
    UI.showOverlay('卡牌页', '<section class="card-library-page">馆藏</section>', 'page');
    fixture.game.state = 'modal';
    cardPages.setCardPageOpen(true);
    openDevConsole();
    expect(cardPages.cardPageOpen).toBe(false);
    closeConsole();
    expect(cardPages.cardPageOpen).toBe(true);
    expect(document.querySelector('.card-library-page')).not.toBeNull();
  });

  it('点击控制台遮罩只关闭一层，不穿透关闭刚恢复的商店', () => {
    UI.showOverlay('商店', '<section class="shop-replica">货架</section>', 'page');
    fixture.game.state = 'modal';
    const restored = vi.fn();
    document.querySelector('.shop-replica').addEventListener('sdt-dev-console-return', restored);
    const sourceBackdropCloser = vi.fn();
    UI.el.overlay.addEventListener('click', sourceBackdropCloser);
    openDevConsole();
    UI.el.overlay.click();
    expect(document.querySelector('.shop-replica')).not.toBeNull();
    expect(UI.el.overlay.hidden).toBe(false);
    expect(sourceBackdropCloser).not.toHaveBeenCalled();
    expect(restored).toHaveBeenCalledOnce();
  });

  it('战斗关闭重绘实时战斗；迟到的调试render不能重新盖上控制台', () => {
    fixture.game.state = 'battle'; fixture.game.battleActive = true;
    UI.showOverlay('战斗', '<section class="battle-stage">当前战斗</section>', 'battle');
    const refreshView = vi.fn(() => UI.showOverlay('战斗', '<section class="battle-stage">恢复战斗</section>', 'battle'));
    window.SDT.Battle = { commands:{ refreshView, dev:vi.fn() } };
    openDevConsole();
    UI._acts.devcB({ k:'energy' });
    closeConsole();
    vi.advanceTimersByTime(100);
    expect(refreshView).toHaveBeenCalledOnce();
    expect(document.querySelector('.battle-stage')).not.toBeNull();
    expect(document.querySelector('.devc-tabs')).toBeNull();
    expect(fixture.game.state).toBe('battle');
  });
});
