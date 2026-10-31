import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenuFeedbackPages } from '../game/src/ui/menu-feedback.js';
import { createMenuLeaveFlow } from '../game/src/ui/menu-leave.js';
import { createMenuSlotPicker } from '../game/src/ui/menu-slots.js';
import { createGameMenuPages } from '../game/src/ui/game.menu.pages.js';

vi.mock('../game/src/ui/region-transition.js',()=>({transitionRegion:(_root,update)=>{update();return Promise.resolve(true);},cancelRegionTransition:()=>{}}));
let previousFacade;
beforeEach(() => { previousFacade = window.SDT; });
afterEach(() => { window.SDT = previousFacade; vi.restoreAllMocks(); });
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
function fixture() {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  const game = { state:'idle', runActive:true, layerData:[], ownedCards:[] };
  window.SDT = { ...window.SDT, game };
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') }, _acts:{}, _overlayRevision:0,
    act(name, callback) { this._acts[name] = callback; },
    showOverlay(title, html) { this._overlayRevision++; this.el.overlay.hidden = false; this.el.ovBody.innerHTML = html; },
    hideOverlay:vi.fn(), refresh:vi.fn(), log:vi.fn(), clearLog:vi.fn(), confirmAction:vi.fn() };
  return { UI, game };
}

describe('menu leaf flow boundaries', () => {
  it('assembled run menu opens the real guide and returns to the same run', async () => {
    const { UI, game } = fixture();
    const menu = createGameMenuPages({ SDT:window.SDT, UI, game, runtime:{}, esc:String,
      getActiveSlot:() => 1 }, {});
    menu.openLeaveMenu();
    UI._acts.leaveGuide();
    const guide = UI.el.ovBody.querySelector('.beginner-guide');
    expect(guide).not.toBeNull();
    const navigation = guide.querySelector('.bg-nav'), article = guide.querySelector('.bg-page');
    expect(UI.el.ovBody.querySelector('.leave-run-panel')).toBeNull();
    await UI._acts.guideNext();
    expect(UI.el.ovBody.querySelector('.beginner-guide')).toBe(guide);
    expect(guide.querySelector('.bg-nav')).toBe(navigation);
    expect(guide.querySelector('.bg-page')).toBe(article);
    expect(guide.dataset.guidePage).toBe('1');
    expect(guide.querySelector('[data-act="guidePage"][aria-current="step"]').dataset.pageIndex).toBe('1');
    const back = UI._acts.guideBack;
    expect(await back()).toBe(true);
    expect(UI.el.ovBody.querySelector('.leave-run-panel')).not.toBeNull();
    expect(game.runActive).toBe(true);
    expect(back()).toBe(false);
  });

  it('feedback deletion uses shared confirmation and leaves a cancelled or replaced inbox intact', async () => {
    const { UI, game } = fixture();
    const remove = vi.fn(async () => true);
    const desktop = () => ({ readSuggestions:async () => ({ ok:true, list:[{ ts:'one', text:'保留原文', done:false }] }), deleteSuggestion:remove });
    const feedback = createMenuFeedbackPages({ UI, game, document, desktop, esc:String,
      getActiveSlot:() => 1, readSound:() => ({ sfx:vi.fn() }), readIcons:() => ({ rich:String }) });
    feedback.openSuggestionInbox(true);
    for(let i=0;i<8;i++) await Promise.resolve();
    UI.confirmAction.mockResolvedValueOnce(false);
    await UI._acts.sugDel({ ts:'one' });
    expect(UI.confirmAction).toHaveBeenCalledWith(expect.objectContaining({ confirmLabel:'删除留言', onConfirm:expect.any(Function) }));
    expect(remove).not.toHaveBeenCalled();
    let confirmation;
    const gate = deferred();
    UI.confirmAction.mockImplementationOnce(options => { confirmation = options; return gate.promise; });
    const pending = UI._acts.sugDel({ ts:'one' });
    UI.el.ovBody.innerHTML = '<section>后来的页面</section>';
    expect(await confirmation.onConfirm()).toBe(false);
    gate.resolve(false); await pending;
    expect(remove).not.toHaveBeenCalled();
    expect(UI.el.ovBody.textContent).toBe('后来的页面');
  });

  it('deletion blocks new reads while pending and ignores reads started before the write', async () => {
    const {UI,game}=fixture(), staleRead=deferred(), confirmation=deferred();
    const row={ts:'one',text:'待删除原文',done:false};
    const read=vi.fn().mockImplementationOnce(()=>staleRead.promise).mockResolvedValueOnce({ok:true,list:[row]});
    const remove=vi.fn(async()=>true); let options;
    UI.confirmAction.mockImplementation(value=>{options=value;return confirmation.promise;});
    const flow=createMenuFeedbackPages({UI,game,document,desktop:()=>({readSuggestions:read,deleteSuggestion:remove}),esc:String,
      getActiveSlot:()=>1,readSound:()=>({sfx:vi.fn()}),readIcons:()=>({rich:String})});
    flow.openSuggestionInbox(); UI._acts.sugRetry(); for(let i=0;i<8;i++) await Promise.resolve();
    const pending=UI._acts.sugDel({ts:'one'});
    const before=document.getElementById('sugBox').innerHTML;
    UI._acts.sugRetry();
    expect(read).toHaveBeenCalledTimes(2); expect(document.getElementById('sugBox').innerHTML).toBe(before);
    expect(await options.onConfirm()).toBe(true); confirmation.resolve(true); await pending;
    expect(remove).toHaveBeenCalledOnce(); expect(document.getElementById('sugBox').textContent).not.toContain(row.text);
    staleRead.resolve({ok:true,list:[row]}); for(let i=0;i<8;i++) await Promise.resolve();
    expect(document.getElementById('sugBox').textContent).not.toContain(row.text);
  });

  it('a save-exit completion cannot close the page that replaced its source', async () => {
    const { UI, game } = fixture();
    const save = deferred(), saveSession = vi.fn(() => save.promise), showTitle = vi.fn();
    const flow = createMenuLeaveFlow({ UI, game, document, getActiveSlot:() => 1,
      saveSession, showTitle, esc:String });
    flow.openLeaveMenu();
    const pending = UI._acts.leaveSave();
    expect(await UI._acts.leaveSave()).toBe(false);
    expect(saveSession).toHaveBeenCalledOnce();
    UI.el.ovBody.innerHTML = '<section>后来的页面</section>';
    save.resolve({ ok:true });
    expect(await pending).toBe(false);
    expect(showTitle).not.toHaveBeenCalled();
    expect(UI.hideOverlay).not.toHaveBeenCalled();
  });

  it('invalid saved-map preflight never launches, loads or mutates the base', async () => {
    const { UI, game } = fixture();
    const base = { peek:() => null, issue:() => null, hasSlot:() => false, use:vi.fn() };
    const loadGame = vi.fn(), setActiveSlot = vi.fn(), hideTitle = vi.fn();
    const slots = createMenuSlotPicker({ UI, game, document, SLOT_COUNT:1, esc:String,
      readSlot:() => ({ savedAt:1 }), readBase:() => base, readMeta:() => ({ ACHIEVEMENTS:[] }),
      fmtPlayTime:String, pickLatestSlot:() => null, getActiveSlot:() => 1,
      RunStorage:{ issue:() => null, has:() => true }, preflightRunMap:() => ({ ok:false, message:'无法恢复地图' }),
      loadGame, setActiveSlot, hideTitle });
    slots.startNewGame();
    expect(await UI._acts.enterSlot({ slot:'1' })).toBe(false);
    expect(base.use).not.toHaveBeenCalled();
    expect(loadGame).not.toHaveBeenCalled();
    expect(setActiveSlot).not.toHaveBeenCalled();
    expect(hideTitle).not.toHaveBeenCalled();
    expect(document.getElementById('slotRestoreError').textContent).toContain('无法恢复地图');
  });
});
