import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let h;
beforeEach(async () => {
  vi.resetModules();
  document.body.innerHTML = '<main id="viewport"><div id="title" hidden></div><div id="exitScr" hidden></div><div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  localStorage.setItem('sdt-rmb-hint','1');
  h = {slot:1, handlers:{}, saved:null, game:{state:'idle', runActive:true, nestActive:false, battleActive:false,
    seed:'source-run', discoveredPairs:new Set(), nestRunes:[], layerIdx:0, trackPos:1, layerData:[{name:'来源对局'}], ownedCards:[]}};
  h.base = {slot:1, data:{stash:[],pocket:[]}, peek:() => ({stash:[],pocket:[],stats:{},collection:{}}),
    use:slot => {h.base.slot=slot;}, issue:() => null, applyStoredCardRenames:async () => ({changed:false,persisted:true}), flushWrites:async () => ({ok:true})};
  const overlay = document.getElementById('overlay'), ovBody = document.getElementById('ovBody');
  h.UI = {el:{overlay,ovBody}, log:vi.fn(), refresh:vi.fn(), clearLog:vi.fn(),
    showScreen:el => {if(el) el.hidden=false;}, hideScreen:el => {if(el) el.hidden=true;},
    hideOverlay:() => {overlay.hidden=true; ovBody.replaceChildren();},
    showOverlay:(_title,html) => {overlay.hidden=false; ovBody.innerHTML=html;},
    act:(name,run) => {h.handlers[name]=run;}, registerHelp(){}, helpBtn:() => ''};
  h.mountHub = vi.fn(() => {ovBody.innerHTML='<section id="hubMain">目标档位基地</section>'; return true;});
  vi.doMock('../game/src/run/game.session.js', () => ({game:h.game,getActiveSlot:() => h.slot,startNewGame:() => h.menu.startNewGame()}));
  vi.doMock('../game/src/ui/page-loading.js', () => ({runPageLoading:({open}) => Promise.resolve().then(open)}));
  vi.doMock('../game/src/hub/game.cardslib.common.js', () => ({cardPageOpen:false,setCardPageOpen:vi.fn()}));
  vi.doMock('../game/src/hub/game.hub.runtime.js', () => ({openBaseHub:h.mountHub}));
  const {openBaseHub} = await import('../game/src/hub/game.hub.js');
  const {createGameMenuController} = await import('./helpers/menu-controller.js');
  h.hub = openBaseHub;
  h.save = vi.fn(async () => {
    h.saved=JSON.stringify({runActive:h.game.runActive,nestActive:h.game.nestActive,battleActive:h.game.battleActive,
      seed:h.game.seed,nestRunes:h.game.nestRunes,battle:h.game.battleActive ? {checkpoint:'source-battle'} : null});
    return {ok:true};
  });
  window.SDT = {game:h.game,Base:h.base,UI:h.UI,Sound:{music:vi.fn(),sfx:vi.fn()},Cards:{},Meta:{ACHIEVEMENTS:[],isUnlocked:() => false},Icons:{img:() => ''}};
  h.menu = createGameMenuController({SDT:window.SDT,UI:h.UI,game:h.game,
    runtime:{resize(){},openBaseHub},SLOT_COUNT:2,esc:String,saveSession:h.save,
    getActiveSlot:() => h.slot,setActiveSlot:slot => {h.slot=slot;},
    readSlot:slot => slot===1 && h.saved ? JSON.parse(h.saved) : null,
    RunStorage:{has:() => false,issue:() => null},preflightRunMap:() => ({ok:true}),loadGame:vi.fn()});
});
afterEach(() => {
  for (const source of ['run/game.session','ui/page-loading','hub/game.cardslib.common','hub/game.hub.runtime']) vi.doUnmock(`../game/src/${source}.js`);
  vi.resetModules();
});

it.each(['nestActive','battleActive'])('save/title/choose another slot can pass the real hub guard after %s', async flag => {
  h.game[flag]=true;
  expect(await h.hub('deploy')).toBe(false);
  expect(h.mountHub).not.toHaveBeenCalled();
  h.menu.openLeaveMenu();
  expect(await h.handlers.leaveSave()).toBe(true);
  const stored=h.saved;
  expect(JSON.parse(stored)).toMatchObject({runActive:true,[flag]:true,seed:'source-run'});
  h.menu.startNewGame();
  await h.handlers.enterSlot({slot:2});
  expect(h.mountHub).toHaveBeenCalledExactlyOnceWith('deploy');
  expect(document.getElementById('hubMain')?.textContent).toBe('目标档位基地');
  expect(h.slot).toBe(2);
  expect(h.game).toMatchObject({runActive:false,nestActive:false,battleActive:false});
  expect(h.saved).toBe(stored);
  expect(h.save).toHaveBeenCalledOnce();
});

it.each(['nestActive','battleActive'])('failed save keeps %s active and never exposes another slot', async flag => {
  h.game[flag]=true;
  h.save.mockResolvedValue({ok:false});
  h.menu.openLeaveMenu();
  expect(await h.handlers.leaveSave()).toBe(false);
  expect(h.game).toMatchObject({runActive:true,[flag]:true,state:'modal'});
  expect(h.slot).toBe(1);
  expect(document.querySelector('.leave-run-status').textContent).toContain('未能保存');
  expect(h.mountHub).not.toHaveBeenCalled();
});
