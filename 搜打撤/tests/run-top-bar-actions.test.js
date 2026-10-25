import { afterEach, describe, expect, it, vi } from 'vitest';
import { configureRunTopBar, installRunTopBar, refreshRunTopBar, setRunTopBarBattleStats } from '../game/src/ui/run-top-bar.js';
import { updateMapHealthHud } from '../game/src/ui/map-health-hud.js';
import { createBattleStageView } from '../game/src/battle/view/battle.stage-view.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

describe('shared map and battle top bar actions', () => {
  it('地图到战斗再返回时优先真实战斗快照，同值缓存不丢数字格式或根节点', async () => {
    await import('../game/src/core/sdt-facade.js');
    const { hudMethods } = await import('../game/src/ui/hud.js');
    document.body.classList.remove('lobby');
    document.body.innerHTML = `<main id="viewport"><button id="btnHome"></button><button id="btnMute"></button><button id="heroAva"></button>
      <div id="hpHud"><div class="hp-hud-body"><b id="hpText"></b><div id="hpBarWrap"><i id="hpBar"></i></div></div><span id="mapHealthTip"></span></div>
      <div id="resHud"><b id="charCoins"></b><b id="charAtk"></b></div></main><div id="overlay" hidden><div id="ovBody"></div></div>`;
    const el = Object.fromEntries(['viewport','overlay','ovBody','heroAva','hpText','hpBar','hpBarWrap','charCoins','charAtk'].map(id => [id, document.getElementById(id)]));
    for (const id of ['layerZh','layerEn','statTurn','statValue']) el[id] = document.createElement('span');
    const UI = { el, _lastMode:'map', _roomActive:false, popNum() {}, endRoom() {} };
    const game = { state:'idle', turn:1, hp:18, maxHp:30, coins:0, atk:4, myClass:'', runActive:true, battleActive:false, inventory:[] };
    const controller = installRunTopBar(UI), refresh = () => hudMethods.refresh.call(UI, game);
    refresh();
    const text = el.hpText, current = text.querySelector('.hp-current'), rest = text.querySelector('.hp-rest');
    expect(current).not.toBeNull(); expect(rest).not.toBeNull();
    game.battleActive = true; game.hp = 29; UI._lastMode = 'battle'; el.overlay.hidden = false;
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail:'battle' }));
    setRunTopBarBattleStats(UI, { battleToken:1, player:{hp:18,maxHp:30,atk:4}, pstat:{status:{}} });
    refresh();
    expect(text.textContent).toBe('18/30');
    expect(text.querySelector('.hp-current')).toBe(current); expect(text.querySelector('.hp-rest')).toBe(rest);
    expect(controller.bar.parentNode).toBe(el.overlay);
    game.battleActive = false; game.hp = 18; UI._lastMode = 'map'; el.overlay.hidden = true;
    document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
    refresh();
    expect(controller.bar.parentNode).toBe(el.viewport);
    expect(document.getElementById('hpText')).toBe(text);
    expect(text.querySelector('.hp-current')).toBe(current); expect(text.querySelector('.hp-rest')).toBe(rest);
    text.textContent = '18/30'; refresh();
    expect(text.querySelector('.hp-current')?.textContent).toBe('18');
    expect(text.querySelector('.hp-rest')?.textContent).toBe('/30');
    expect(game.hp).toBe(18);
  });
  it('opens registered battle settings from navigation and keeps item controls in the following flow row', () => {
    document.body.innerHTML = '<main id="viewport"><button id="btnHome"></button><button id="btnMute"></button></main><div id="overlay" hidden><div id="ovBody"></div></div>';
    const UI = { el:{viewport:document.getElementById('viewport'), overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody')},
      showOverlay(_title, html) { this._lastMode = 'battle'; this.el.overlay.hidden = false; this.el.ovBody.innerHTML = html; document.dispatchEvent(new CustomEvent('sdt-overlay-mode')); } };
    const header = installRunTopBar(UI), stageView = createBattleStageView({UI, rich:html=>html});
    const view = {token:1,assetKey:'normal',isBoss:false,phase:'player',combatState:{tone:'self',label:'你的行动'},turn:1,mode:'normal',locked:false,
      potionsHTML:'<div class="bt-potions"><button data-act="btPotion">药水</button></div>',drawHTML:'',restHTML:'',skillHTML:'',pageHTML:'',forecastHTML:'',energy:3,maxEnergy:3,energyArt:''};
    const {owner} = stageView.show(view);
    const button = header.bar.querySelector('#btnBattleOptions'), action=vi.fn();
    UI._acts={btSettings:action};
    expect([...header.bar.querySelector('.run-top-actions').children].map(node=>node.id)).toEqual(['btnHome','btnMute','btnBattleOptions']);
    expect(button.hidden).toBe(false); button.click(); expect(action).toHaveBeenCalledOnce();
    expect(owner.topbar.querySelector(':scope > .bt-potions')).not.toBeNull();
    owner.stage.inert=true; button.click(); expect(action).toHaveBeenCalledOnce(); owner.stage.inert=false;
    stageView.show({...view,turn:2}); expect(header.bar.querySelector('#btnBattleOptions')).toBe(button);
    button.click(); expect(action).toHaveBeenCalledTimes(2);
    UI._lastMode='settings'; document.dispatchEvent(new CustomEvent('sdt-overlay-mode'));
    expect(button.hidden).toBe(true); button.click(); expect(action).toHaveBeenCalledTimes(2);
    UI._lastMode='battle'; document.dispatchEvent(new CustomEvent('sdt-overlay-mode'));
    stageView.show({...view,potionsHTML:''}); expect(owner.topbar.querySelector('.bt-potions')).toBeNull();
  });
  it('retains one set of live controls, routes real actions, and updates readable details', () => {
    document.body.classList.remove('lobby');
    document.body.innerHTML = `<main id="viewport"><button id="btnHome"></button><button id="btnMute"></button>
      <button id="heroAva">人物</button><div id="hpHud"><div class="hp-hud-body"><b id="hpText"></b><i id="hpBar"></i></div><span id="mapHealthTip"></span></div>
      <div id="resHud"><button class="res-gold"><b id="charCoins"></b></button><button class="res-atk"><b id="charAtk"></b></button></div></main>
      <div id="overlay" hidden><div id="ovBody"></div></div>`;
    const UI = { el:{ viewport:document.getElementById('viewport'), overlay:document.getElementById('overlay') } };
    let game = { characterId:'wu', myClass:'侠客', hp:8, maxHp:20, coins:7, atk:4 };
    const sound = { muted:false, setMuted:vi.fn(value => { sound.muted = value; }) }, openLeaveMenu = vi.fn();
    const actions = { readState:() => ({ game }), readSound:() => sound, openLeaveMenu, document };
    configureRunTopBar(UI, actions); configureRunTopBar(UI, actions);
    const controller = installRunTopBar(UI);
    expect(installRunTopBar(UI)).toBe(controller);
    updateMapHealthHud(document.getElementById('hpHud'), { hp:8, maxHp:20, active:true, instant:true });
    const home = document.getElementById('btnHome'), mute = document.getElementById('btnMute');
    home.click(); expect(openLeaveMenu).toHaveBeenCalledOnce();
    mute.click(); expect(sound.setMuted).toHaveBeenCalledExactlyOnceWith(true);
    document.querySelector('.res-gold').click();
    expect(controller.bar.querySelector('.run-top-detail').textContent).toContain('7 币');
    controller.bar.querySelector('[data-run-action="close"]').click();
    document.getElementById('heroAva').click();
    expect(controller.bar.querySelector('.run-top-detail').hidden).toBe(true);
    UI.el.overlay.hidden = false; UI._lastMode = 'battle';
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail:'battle' }));
    expect(controller.bar.parentNode).toBe(UI.el.overlay);
    game = { ...game, coins:11, atk:6, battleActive:true };
    setRunTopBarBattleStats(UI, { battleToken:1, player:{ ...game, hp:5 }, pstat:{ status:{ atkUp:3 } } });
    refreshRunTopBar(UI, game);
    expect(document.getElementById('charAtk').textContent).toBe('9');
    expect(document.getElementById('hpText').textContent).toBe('5/20');
    document.querySelector('.res-atk').click();
    expect(controller.bar.querySelector('.run-top-detail').textContent).toContain('当前攻击 9');
    controller.bar.querySelector('[data-run-action="close"]').click();
    mute.click(); expect(sound.setMuted.mock.calls.map(([value]) => value)).toEqual([true, false]);
    document.getElementById('hpHud').click();
    expect(document.getElementById('hpHud').hasAttribute('aria-expanded')).toBe(false);
    home.click(); expect(openLeaveMenu).toHaveBeenCalledTimes(2);
    expect(document.getElementById('btnHome')).toBe(home);
    const eventExit=vi.fn(); UI._acts={eventExit}; UI._lastMode='page'; UI.el.ovBody=document.createElement('div'); UI.el.overlay.append(UI.el.ovBody);
    UI.el.ovBody.innerHTML='<div class="event-themed"><button data-act="eventExit">返回地图</button></div>';
    refreshRunTopBar(UI,game); home.click(); expect(eventExit).toHaveBeenCalledOnce(); expect(openLeaveMenu).toHaveBeenCalledTimes(2);
    expect(home.getAttribute('aria-label')).toBe('返回地图');
    UI.el.ovBody.replaceChildren(); refreshRunTopBar(UI,game); home.click(); expect(openLeaveMenu).toHaveBeenCalledTimes(3);
  });
});
