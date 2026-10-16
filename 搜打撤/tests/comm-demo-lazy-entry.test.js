import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: () => false }));
let listeners;
let observers;
let mount;
let load;
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.resetModules();
  listeners = [];
  observers = [];
  load = vi.fn();
  mount = vi.fn(() => {
    if (document.getElementById('commDemoPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'commDemoPanel';
    document.body.appendChild(panel);
  });
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><div id="hubMain"></div></div></div>';
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('loading');
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, fn, options) => {
    listeners.push([type, fn, options]);
    return add(type, fn, options);
  });
  vi.stubGlobal('MutationObserver', class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() {}
  });
  vi.doMock('../game/src/ui/comm-feed.js', () => { load(); return { mountCommDemo: mount }; });
  history.replaceState(null, '', '/');
});
afterEach(() => {
  for (const [type, fn, options] of listeners) document.removeEventListener(type, fn, options);
  vi.doUnmock('../game/src/ui/comm-feed.js');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  history.replaceState(null, '', '/');
});

async function start(query = '') {
  history.replaceState(null, '', `/${query}`);
  const runtime = await import('../game/src/ui/transitions-director.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
  return runtime;
}

const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

describe('communication demo lazy startup boundary', () => {
  it('never requests the demo module without its URL parameter and keeps transition startup synchronous', async () => {
    const runtime = await start();
    expect(observers).toHaveLength(2);
    runtime.gateSweep();
    expect(document.getElementById('t1Gate')).not.toBeNull();
    await flush();
    expect(load).not.toHaveBeenCalled();
    expect(mount).not.toHaveBeenCalled();
  });

  it('loads and mounts exactly once for the existing has-parameter semantics', async () => {
    await start('?commDemo=0');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
    expect(load).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll('#commDemoPanel')).toHaveLength(1);
  });

  it('catches a failed dynamic load without blocking the already installed transitions', async () => {
    const failure = new Error('demo unavailable');
    vi.doMock('../game/src/ui/comm-feed.js', async () => { load(); throw failure; });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const runtime = await start('?commDemo');
    expect(observers).toHaveLength(2);
    runtime.gateSweep();
    await vi.waitFor(() => expect(warn).toHaveBeenCalledTimes(1));
    const [message, caught] = warn.mock.calls[0];
    expect(message).toBe('[comm-demo] 演示载入失败');
    expect(caught.cause || caught).toBe(failure); // Vitest wraps a rejected mock module factory.
    expect(mount).not.toHaveBeenCalled();
    expect(document.getElementById('t1Gate')).not.toBeNull();
  });

  it('keeps a cold-loaded demo hidden when a battle starts before the module arrives', async () => {
    const pending = deferred();
    vi.doMock('../game/src/ui/comm-feed.js', async () => {
      load();
      await pending.promise;
      return { mountCommDemo: mount };
    });
    await start('?commDemo=1');
    await vi.waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'battle' }));
    pending.resolve();
    await vi.waitFor(() => expect(mount).toHaveBeenCalledTimes(1));
    expect(document.getElementById('commDemoPanel').style.display).toBe('none');
  });

  it('catches a mount failure as well as a loader failure', async () => {
    const failure = new Error('mount unavailable');
    mount.mockImplementation(() => { throw failure; });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await start('?commDemo=1');
    await vi.waitFor(() => expect(warn).toHaveBeenCalledWith('[comm-demo] 演示载入失败', failure));
  });
});
