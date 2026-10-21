import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunEventController } from '../game/src/run/game.run.events.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const narrative = text => ({ intro:text, choices:[{ label:'继续', effect:'continue', choose:() => '已记录' }] });
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function harness() {
  document.body.innerHTML = '<div id="overlay"><div id="body"><div class="flow-transition"></div></div></div>';
  const game = { state:'idle', layerIdx:0, trackPos:1, nodeRewards:{}, visited:{}, seed:1 };
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('body') }, _overlayRevision:1,
    acts:{}, act(name, handler) { UI.acts[name] = handler; }, refresh:vi.fn(), hideOverlay:vi.fn(), log:vi.fn() };
  const nodeShell = vi.fn(spec => { UI._overlayRevision++; UI.el.overlay.hidden = false;
    UI.el.overlay.classList.remove('closing'); delete UI.el.overlay.dataset.uiClosing;
    UI.el.ovBody.innerHTML = `<section><h1>${spec.title}</h1><p>${spec.sub || ''}</p>${spec.body}</section>`; });
  const story = deferred(), commit = deferred(); let back;
  const ports = { game, UI, nodeShell, enterNode:async () => true, getActiveSlot:() => 1,
    RunStorage:{ readIdentity:() => ({ ok:true, value:{ runId:'run-1' } }) },
    storyCommands:{ inspect:() => ({ ok:true, value:{ kind:'available', segmentId:1 }, revision:1 }), record:vi.fn(() => commit.promise) },
    lastLampNarrative:vi.fn(() => story.promise), captureRunContext:() => () => true,
    createCardChoice:() => ({ resume:() => false }), setBagReturnHook:fn => { back = fn; },
    saveGame:vi.fn(() => true), consumeCurrentCell:vi.fn(), finishInstant:vi.fn(), sound:vi.fn() };
  return { ...ports, story, commit, controller:createRunEventController(ports), back:() => back?.() };
}
const success = { ok:true, value:{ output:{ segmentId:1, choiceId:'continue' } } };
afterEach(() => { document.body.innerHTML = ''; });

describe('lazy event story continuation ownership', () => {
  it('drops late narrative after another same-node page takes ownership', async () => {
    const h = harness(), opening = h.controller.runEventDeck(); await flush();
    h.nodeShell({ title:'背包', body:'' }); h.story.resolve(narrative('旧故事')); await opening;
    expect(h.UI.el.ovBody.textContent).toBe('背包'); expect(h.UI.acts.lastLampChoice).toBeUndefined();
    expect(h.consumeCurrentCell).not.toHaveBeenCalled();
  });
  it('does not resurrect a narrative after a replacement page opens then closes', async () => {
    const h = harness(), opening = h.controller.runEventDeck(); await flush();
    h.nodeShell({ title:'背包', body:'' }); h.UI._overlayRevision++; h.UI.el.ovBody.innerHTML = ''; h.UI.el.overlay.hidden = true;
    h.story.resolve(narrative('旧故事')); await opening; expect(h.UI.el.ovBody.textContent).toBe('');
  });
  it('allows the original completed transition to finish clearing naturally', async () => {
    const h = harness(); h.UI.el.overlay.dataset.uiClosing = '1';
    const opening = h.controller.runEventDeck(); await flush();
    h.UI._overlayRevision++; h.UI.el.ovBody.innerHTML = ''; h.UI.el.overlay.hidden = true;
    h.story.resolve(narrative('当前故事')); await opening;
    expect(h.UI.el.ovBody.textContent).toContain('当前故事'); expect(h.UI.acts.lastLampChoice).toBeTypeOf('function');
  });
  it('a newer event request invalidates the old same-node story await', async () => {
    const h = harness(), next = deferred(); h.lastLampNarrative.mockImplementationOnce(() => h.story.promise).mockImplementationOnce(() => next.promise);
    const first = h.controller.runEventDeck(); await flush(); const second = h.controller.runEventDeck(); await flush();
    next.resolve(narrative('新故事')); await second; h.story.resolve(narrative('旧故事')); await first;
    expect(h.UI.el.ovBody.textContent).toContain('新故事'); expect(h.UI.el.ovBody.textContent).not.toContain('旧故事');
  });
  it.each(['page', 'closing', 'uiClosing', 'detached'])('retains committed story facts without late UI or node effects after %s', async change => {
    const h = harness(); h.story.resolve(narrative('故事')); await h.controller.runEventDeck();
    const result = h.UI.acts.lastLampChoice({ i:0 }); expect(h.storyCommands.record).toHaveBeenCalledOnce();
    if (change === 'page') h.nodeShell({ title:'设置', body:'' });
    if (change === 'closing') h.UI.el.overlay.classList.add('closing');
    if (change === 'uiClosing') h.UI.el.overlay.dataset.uiClosing = '1';
    if (change === 'detached') h.UI.el.overlay.remove();
    const before = h.nodeShell.mock.calls.length; h.commit.resolve(success); await result;
    expect(h.nodeShell).toHaveBeenCalledTimes(before); expect(h.sound).not.toHaveBeenCalled();
    expect(h.consumeCurrentCell).not.toHaveBeenCalled(); expect(h.saveGame).not.toHaveBeenCalled();
  });
  it('old choice callbacks cannot commit after another page takes ownership', async () => {
    const h = harness(); h.story.resolve(narrative('故事')); await h.controller.runEventDeck();
    const staleChoice = h.UI.acts.lastLampChoice; h.nodeShell({ title:'背包', body:'' });
    await staleChoice({ i:0 }); expect(h.storyCommands.record).not.toHaveBeenCalled();
  });
  it('does not project a failed commit into another page', async () => {
    const h = harness(); h.story.resolve(narrative('故事')); await h.controller.runEventDeck();
    const result = h.UI.acts.lastLampChoice({ i:0 }); h.nodeShell({ title:'设置', body:'' });
    h.commit.resolve({ ok:false, message:'save failed' }); await result;
    expect(h.UI.el.ovBody.textContent).toBe('设置'); expect(h.UI.acts.lastLampChoiceRetry).toBeUndefined();
  });
  it('keeps bag-return rendering independent from the old presentation snapshot', async () => {
    const h = harness(); h.story.resolve(narrative('故事')); await h.controller.runEventDeck();
    h.commit.resolve(success); await h.UI.acts.lastLampChoice({ i:0 });
    const staleFinish = h.UI.acts.lastLampFinish; h.nodeShell({ title:'背包', body:'' });
    staleFinish(); expect(h.consumeCurrentCell).not.toHaveBeenCalled();
    h.back(); h.UI.acts.lastLampFinish(); expect(h.consumeCurrentCell).toHaveBeenCalledOnce();
    expect(h.finishInstant).toHaveBeenCalledOnce();
  });
});
