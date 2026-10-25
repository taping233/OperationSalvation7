import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createEventLifecycle, createLazyEventEntry } from '../game/src/run/event-lifecycle.js';
import { createEventCardChoiceController } from '../game/src/run/event-card-choice.js';
import { beginPageEntryCancellation, cancelPendingPageEntries, releasePageEntryCancellation } from '../game/src/ui/page-entry-cancellation.js';

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
function harness(options = {}) {
  document.body.innerHTML = '<div id="overlay"><div id="body"></div></div>';
  const game = { state:'idle', seed:1, layerIdx:0, trackPos:1, layerData:[], discoveredPairs:new Set(),
    runActive:true, nodeRewards:{}, visited:{}, ownedCards:[], canReceiveCard:() => true, usedSlots:() => 0, bagCap:() => 9 };
  const context = { slot:1, run:1 };
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('body') }, _overlayRevision:0,
    acts:{}, act(name, fn) { UI.acts[name] = fn; }, refresh:vi.fn(), log:vi.fn(), showCardReward:vi.fn(),
    hideOverlay:vi.fn(() => { UI.el.overlay.hidden = true; }) };
  const nodeShell = vi.fn(spec => { UI._overlayRevision++; UI.el.overlay.hidden = false;
    UI.el.ovBody.innerHTML = `<section><h1>${spec.title}</h1>${spec.sub || ''}${spec.body || ''}${spec.foot || ''}</section>`; });
  const card = { id:'potion', name:'药水', type:'道具' };
  const saveGame = vi.fn(() => true), grantEventCard = vi.fn(c => { game.ownedCards.push({ card:c }); return true; });
  const createCardChoice = vi.fn(ports => createEventCardChoiceController({ ...ports,
    SDT:{ Cards:{ all:() => [card], cardHTML:c => c.name }, Base:{ bagCap:() => 9 } } }));
  const ports = { game, UI, nodeShell, nodeOpt:(act, label) => `<button data-act="${act}">${label}</button>`,
    setBagReturnHook:vi.fn(), saveGame, getActiveSlot:() => context.slot, createCardChoice, grantEventCard,
    consumeCurrentCell:vi.fn(() => { game.visited['0,1'] = 1; }),
    captureRunContext:() => { const { slot, run } = context, seed = game.seed; return () => context.slot === slot && context.run === run && game.seed === seed; } };
  const lifecycle = createEventLifecycle(ports), gate = deferred();
  const runtime = { runEventDeck:vi.fn(() => true) }, load = vi.fn(() => gate.promise), create = vi.fn(() => runtime);
  const entry = createLazyEventEntry({ ...ports, lifecycle, load, create, timeout:100, ...options });
  return { ...ports, context, lifecycle, gate, runtime, load, create, entry, card };
}
const pendingReward = () => ({ version:1, type:'event-choice', eventId:'ev19-potions', cardIds:['potion'], paidCoins:0, taken:null });
afterEach(() => { cancelPendingPageEntries(); vi.useRealTimers(); document.body.innerHTML = ''; });

describe('lazy event entry ownership', () => {
  it('keeps both restore outcomes synchronous and never downloads for restore', () => {
    const h = harness();
    expect(h.entry.resumeEventCardChoice()).toBe(false);
    h.game.nodeRewards['0,1'] = pendingReward();
    expect(h.entry.resumeEventCardChoice()).toBe(true);
    expect(h.createCardChoice).toHaveBeenCalledOnce(); expect(h.load).not.toHaveBeenCalled();
  });
  it('does not promote a title-state entry into a live modal request', async () => {
    const h = harness(); h.game.state = 'title';
    expect(await h.entry.runEventDeck()).toBe(false); expect(h.game.state).toBe('title');
    expect(h.load).not.toHaveBeenCalled(); expect(h.nodeShell).not.toHaveBeenCalled();
  });
  it.each(['false', 'throw'])('shares unsaved received rewards across lazy/restore paths (%s)', async mode => {
    const h = harness(); const reward = h.game.nodeRewards['0,1'] = pendingReward();
    expect(await h.entry.runEventDeck()).toBe(true);
    h.saveGame.mockImplementation(() => { if (mode === 'throw') throw new Error('save'); return false; });
    await h.UI.acts.eventCardPick({ i:'0' });
    expect(reward.taken).toBe(0); expect(h.game.ownedCards).toHaveLength(1);
    expect(h.entry.resumeEventCardChoice()).toBe(true);
    expect(h.UI.el.ovBody.textContent).toContain('不会再次发牌');
    h.saveGame.mockReturnValue(true); await h.UI.acts.eventCardSaveRetry(); await flush();
    expect(h.game.ownedCards).toHaveLength(1); expect(h.game.state).toBe('idle');
    expect(h.createCardChoice).toHaveBeenCalledOnce(); expect(h.load).not.toHaveBeenCalled();
  });
  it('shows immediate cancellable feedback, deduplicates entry and releases before transition', async () => {
    const h = harness(); const first = h.entry.runEventDeck();
    expect(h.UI.el.ovBody.textContent).toContain('正在进入事件');
    expect(h.entry.runEventDeck()).toBe(first); await flush(); expect(h.load).toHaveBeenCalledOnce();
    h.runtime.runEventDeck.mockImplementation(current => {
      h.nodeShell({ title:'真实节点过场' }); h.game.state = 'idle'; return current();
    });
    h.gate.resolve({}); expect(await first).toBe(true); await flush();
    expect(h.runtime.runEventDeck).toHaveBeenCalledOnce(); expect(h.UI.hideOverlay).not.toHaveBeenCalled();
    expect(await h.entry.runEventDeck()).toBe(true); expect(h.load).toHaveBeenCalledOnce();
  });
  it.each(['eventEntryCancel', 'eventExit', 'global'])('Stop through %s completes without waiting for the import', async action => {
    const h = harness(); const opening = h.entry.runEventDeck(); await flush();
    if (action === 'global') cancelPendingPageEntries(); else h.UI.acts[action]();
    expect(await opening).toBe(false); expect(h.game.state).toBe('idle');
    h.gate.resolve({}); await flush(); expect(h.create).not.toHaveBeenCalled();
    expect(h.game.nodeRewards).toEqual({}); expect(h.saveGame).not.toHaveBeenCalled();
  });
  it.each(['slot', 'run', 'title', 'page', 'hidden', 'closing', 'uiClosing', 'detached', 'overlay'])('late import cannot replace changed %s ownership', async change => {
    const h = harness(); const opening = h.entry.runEventDeck(); await flush();
    if (change === 'slot' || change === 'run') h.context[change]++;
    if (change === 'title') h.game.state = 'title';
    if (change === 'page') h.nodeShell({ title:'背包' });
    if (change === 'hidden') h.UI.el.overlay.hidden = true;
    if (change === 'closing') h.UI.el.overlay.classList.add('closing');
    if (change === 'uiClosing') h.UI.el.overlay.dataset.uiClosing = '1';
    if (change === 'detached') h.UI.el.overlay.remove();
    if (change === 'overlay') h.UI.el.overlay = document.createElement('div');
    h.gate.resolve({}); expect(await opening).toBe(false); expect(h.create).not.toHaveBeenCalled();
    expect(h.UI.hideOverlay).not.toHaveBeenCalled(); expect(h.saveGame).not.toHaveBeenCalled();
  });
  it.each(['slot', 'run'])('synchronous %s restore cancels old loader before capturing reward callbacks', async kind => {
    const h = harness(); const opening = h.entry.runEventDeck(); await flush(); h.context[kind]++;
    const reward = h.game.nodeRewards['0,1'] = pendingReward();
    expect(h.entry.resumeEventCardChoice()).toBe(true); await flush();
    const first = h.UI.acts.eventCardPick({ i:'0' }); h.UI.acts.eventCardPick({ i:'0' }); await first;
    expect(reward.taken).toBe(0); expect(h.game.ownedCards).toHaveLength(1); expect(h.game.state).toBe('idle');
    expect(await opening).toBe(false); h.gate.resolve({}); await flush(); expect(h.create).not.toHaveBeenCalled();
  });
  it('cancels the previous entry owner before mounting its own loader', async () => {
    const h = harness(); const cancel = () => { releasePageEntryCancellation('previous', cancel); h.UI.hideOverlay(); return true; };
    beginPageEntryCancellation('previous', cancel);
    const opening = h.entry.runEventDeck();
    expect(h.UI.el.overlay.hidden).toBe(false); h.gate.resolve({}); expect(await opening).toBe(true);
  });
  it('rejected import exposes retry, keeps domain state and retries one module load', async () => {
    const h = harness(); const first = h.entry.runEventDeck(); await flush(); h.gate.reject(new Error('offline'));
    expect(await first).toBe(false); expect(h.UI.el.ovBody.textContent).toContain('事件载入未完成');
    expect(h.game.nodeRewards).toEqual({}); expect(h.saveGame).not.toHaveBeenCalled();
    h.load.mockResolvedValue({}); const retry = h.UI.acts.eventEntryRetry(); expect(await retry).toBe(true);
    expect(h.load).toHaveBeenCalledTimes(2); expect(h.runtime.runEventDeck).toHaveBeenCalledOnce();
  });
  it('factory failure is retryable without an unhandled entry rejection', async () => {
    const h = harness(); h.create.mockImplementationOnce(() => { throw new Error('factory'); });
    const first = h.entry.runEventDeck(); h.gate.resolve({}); expect(await first).toBe(false);
    expect(h.UI.el.ovBody.textContent).toContain('事件载入未完成');
    h.load.mockResolvedValue({}); expect(await h.UI.acts.eventEntryRetry()).toBe(true);
  });
  it.each(['resolve', 'reject'])('timeout allows retry and ignores the old late %s', async late => {
    vi.useFakeTimers(); const h = harness(); const first = h.entry.runEventDeck(); await flush();
    await vi.advanceTimersByTimeAsync(101); expect(await first).toBe(false);
    h.load.mockResolvedValue({}); expect(await h.UI.acts.eventEntryRetry()).toBe(true);
    h.gate[late](late === 'resolve' ? {} : new Error('late')); await flush();
    expect(h.runtime.runEventDeck).toHaveBeenCalledOnce();
    expect(await h.entry.runEventDeck()).toBe(true); expect(h.load).toHaveBeenCalledTimes(2);
  });
  it('retry/leave callbacks cannot act after another page replaces the failure page', async () => {
    const h = harness(); const opening = h.entry.runEventDeck(); await flush(); h.gate.reject(new Error('offline')); await opening;
    const retry = h.UI.acts.eventEntryRetry, leave = h.UI.acts.eventEntryCancel;
    h.nodeShell({ title:'设置' }); retry(); expect(leave()).toBe(false);
    expect(h.UI.el.ovBody.textContent).toContain('设置'); expect(h.load).toHaveBeenCalledOnce();
  });
  it('rejects settlement reentry before cancelling another pending page entry', async () => {
    const h = harness(), record = h.game.nodeRewards['0,1'] = { version:1, type:'event', eventId:'fixed' };
    h.lifecycle.eventSettling.add(record); const cancel = vi.fn();
    beginPageEntryCancellation('other', cancel);
    expect(await h.entry.runEventDeck()).toBe(false); expect(cancel).not.toHaveBeenCalled();
    releasePageEntryCancellation('other', cancel); expect(h.load).not.toHaveBeenCalled();
  });
  it('keeps settlement reentry from invalidating the active request', () => {
    const h = harness(), record = h.game.nodeRewards['0,1'] = { version:1, type:'event', eventId:'fixed' };
    const current = h.lifecycle.beginRequest(); h.lifecycle.eventSettling.add(record);
    expect(h.lifecycle.beginRequest()).toBe(null); expect(current()).toBe(true);
  });
  it('keeps event decks and story services outside the static flow dependency', () => {
    const flow = readFileSync('game/src/run/game.run.flow.js', 'utf8');
    expect(flow).toContain("load:() => import('./event-runtime.js')");
    expect(flow).not.toMatch(/import\s+[^;]+from ['"][^'"]*(game\.run\.events|event-runtime|home\/narrative|home\/story\.commands|event-option-state)/);
    expect(flow).toContain('export function resumeEventCardChoice()');
  });
});
