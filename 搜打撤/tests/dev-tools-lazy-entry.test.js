import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { planForPaths } from '../scripts/gate-plan.mjs';

const h = vi.hoisted(() => ({ game: {}, slot: 1 }));
vi.mock('../game/src/run/game.session.js', () => ({ game:h.game, getActiveSlot:() => h.slot,
  MAP:{}, newRun:vi.fn(), saveGame:vi.fn(), scaledEnemy:vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({ buildEncounter:vi.fn(), openChestsOnCell:vi.fn(), openShop:vi.fn() }));
vi.mock('../game/src/run/game.run.altar.js', () => ({ openAltarRitual:vi.fn(), openFireRest:vi.fn() }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ runEventDeck:vi.fn() }));
vi.mock('../game/src/agent/agent.console.js', () => ({ agentTabHTML:() => 'Agent', keysTabHTML:() => 'Keys', bindAgentTab:vi.fn(), bindKeysTab:vi.fn() }));
vi.mock('../game/src/agent/agent.data.js', () => ({ dataPanelHTML:() => 'Data', bindDataActions:vi.fn() }));

const runtimePath = '../game/src/run/game.run.dev.js';
const facade = () => import('../game/src/run/game.run.dev-loader.js');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let UI;
beforeEach(() => {
  vi.resetModules(); vi.doUnmock(runtimePath); h.slot = 1;
  Object.keys(h.game).forEach(key => delete h.game[key]);
  Object.assign(h.game, { state:'modal', runActive:true, battleActive:false, discoveredPairs:[], seed:77 });
  document.body.innerHTML = '<button id="otherFocus">外按钮</button><div id="overlay"><h2 id="ovTitle">来源页</h2><div id="ovBody"><section id="source"><input id="sourceInput"><button data-act="claim">领取</button></section></div></div>';
  UI = {
    el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody'), ovTitle:document.getElementById('ovTitle') },
    _acts:{}, _inputHandler:null, _hoverHandler:null, _lastMode:'page', _overlayRevision:1,
    act(name, handler) { this._acts[name] = handler; },
    showOverlay(title, html, mode) { this.el.overlay.hidden = false; this.el.ovTitle.innerHTML = title; this.el.ovBody.innerHTML = html; this._lastMode = mode; },
    hideOverlay:vi.fn(function () { this.el.overlay.hidden = true; this.el.ovBody.replaceChildren(); }),
    log:vi.fn(), refresh:vi.fn(),
  };
  window.SDT = { UI, game:h.game, Base:{ slot:1 }, Cards:{ all:() => [] }, Sound:{ sfx:vi.fn() } };
});
afterEach(() => { vi.doUnmock(runtimePath); vi.restoreAllMocks(); });

function delayRuntime(runtime = { openDevConsole:vi.fn(), devJumpNode:vi.fn(), devForceBattle:vi.fn() }) {
  const gate = deferred();
  const load = vi.fn(async () => { await gate.promise; return runtime; });
  vi.doMock(runtimePath, load);
  return { gate, load, runtime };
}

function bootKeyHandler(loader, cardPages = {}) {
  const source = readFileSync(path.resolve('game/src/game.boot.js'), 'utf8');
  const ast = parse(source, { sourceType:'module', ecmaVersion:'latest' });
  const bind = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'bindInput');
  const call = bind.body.body.map(node => node.expression).find(node => node?.type === 'CallExpression' &&
    node.callee.object?.name === 'window' && node.callee.property?.name === 'addEventListener' && node.arguments[0]?.value === 'keydown');
  const callback = source.slice(call.arguments[1].start, call.arguments[1].end);
  return new Function('deps', `with (deps) { return ${callback}; }`)({
    openDevConsole:loader.openDevConsole, cancelPendingDevTools:loader.cancelPendingDevTools,
    get devToolsLoading() { return loader.devToolsLoading; }, cardPageLoading:false, baseHubLoading:false,
    cardPageOpen:false, closeCardPageTop:vi.fn(), game:h.game, UI, SDT:{ Input:{ actionFor:() => null } },
    ...cardPages,
  });
}

function startupClosure() {
  const html = readFileSync(path.resolve('game/index.html'), 'utf8');
  const roots = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
    .map(match => path.resolve('game', match[1]));
  const seen = new Set(), pending = [...roots];
  while (pending.length) {
    const file = pending.pop();
    if (seen.has(file) || !file.endsWith('.js')) continue;
    seen.add(file);
    const ast = parse(readFileSync(file, 'utf8'), { sourceType:'module', ecmaVersion:'latest' });
    for (const node of ast.body) {
      if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) continue;
      if (node.source?.value?.startsWith('.')) pending.push(path.resolve(path.dirname(file), node.source.value));
    }
  }
  return { roots, seen };
}

describe('开发工具真正按需加载', () => {
  it('四个 HTML roots 保留同步 Agent 门面，却没有 dev runtime/console eager edge', () => {
    const { roots, seen } = startupClosure();
    expect(roots).toHaveLength(4);
    for (const file of ['run/game.run.dev.js', 'agent/agent.console.js', 'agent/agent.scenes.runtime.js']) {
      expect(seen.has(path.resolve('game/src', file)), file).toBe(false);
    }
    expect(seen.has(path.resolve('game/src/agent/agent.js'))).toBe(true);
    expect(seen.has(path.resolve('game/src/agent/agent.scenes.js'))).toBe(true);
    const scenes = readFileSync(path.resolve('game/src/agent/agent.scenes.runtime.js'), 'utf8');
    expect(scenes).toContain("import { devJumpNode } from '../run/game.run.dev.js';");
  });

  it('普通依赖图直接选择新 loader 专测，boot 仍要求既有全量门', () => {
    const root = path.resolve('.');
    const local = planForPaths(['game/src/run/game.run.dev-loader.js'], { root });
    expect(local.mode).toBe('quick');
    expect(local.tests).toContain('tests/dev-tools-lazy-entry.test.js');
    expect(planForPaths(['game/src/game.boot.js'], { root }).mode).toBe('full');
  });

  it('启动不预取，重复节点调用与跨入口仅请求一个模块，runtime 返回值被保留', async () => {
    const { gate, load, runtime } = delayRuntime();
    runtime.devJumpNode.mockReturnValue('node-result'); runtime.devForceBattle.mockResolvedValue('battle-result');
    const loader = await facade();
    expect(load).not.toHaveBeenCalled();
    const first = loader.devJumpNode('shop');
    expect(loader.devJumpNode('shop')).toBe(first);
    const newer = loader.devForceBattle(false);
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(runtime.devJumpNode).not.toHaveBeenCalled();
    gate.resolve();
    expect(await first).toBe(false); expect(await newer).toBe('battle-result');
    expect(runtime.devForceBattle).toHaveBeenCalledWith(false);
    expect(await loader.devJumpNode('shop')).toBe('node-result');
    expect(load).toHaveBeenCalledOnce();
  });

  it('冷 Ctrl+L 重复按取消；按键长按和输入法不再触发加载，旧请求不盖页', async () => {
    const { gate, load, runtime } = delayRuntime();
    const loader = await facade(), key = bootKeyHandler(loader);
    key(new KeyboardEvent('keydown', { key:'l', ctrlKey:true, repeat:true, cancelable:true }));
    expect(load).not.toHaveBeenCalled();
    key(new KeyboardEvent('keydown', { key:'l', ctrlKey:true, isComposing:true, cancelable:true }));
    expect(load).not.toHaveBeenCalled();
    key(new KeyboardEvent('keydown', { key:'l', ctrlKey:true, cancelable:true }));
    expect(loader.devToolsLoading).toBe(true);
    key(new KeyboardEvent('keydown', { key:'L', ctrlKey:true, cancelable:true }));
    expect(loader.devToolsLoading).toBe(false);
    gate.resolve(); await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    await Promise.resolve(); expect(runtime.openDevConsole).not.toHaveBeenCalled();
    expect(document.getElementById('source')).not.toBeNull();
  });

  it('冷 Esc 只取消等待的一层，输入法 Esc 不取消或关闭原卡牌页', async () => {
    const { gate, runtime } = delayRuntime();
    const loader = await facade(), closeCardPageTop = vi.fn();
    const key = bootKeyHandler(loader, { cardPageLoading:true, closeCardPageTop });
    const request = loader.openDevConsole();
    key(new KeyboardEvent('keydown', { key:'Escape', isComposing:true, cancelable:true }));
    expect(loader.devToolsLoading).toBe(true);
    const escape = new KeyboardEvent('keydown', { key:'Escape', cancelable:true });
    key(escape);
    expect(escape.defaultPrevented).toBe(true); expect(closeCardPageTop).not.toHaveBeenCalled();
    expect(loader.devToolsLoading).toBe(false);
    gate.resolve(); expect(await request).toBe(false);
    expect(runtime.openDevConsole).not.toHaveBeenCalled();
  });

  it.each(['root', 'overlay', 'revision', 'slot', 'base', 'baseSlot', 'run', 'context', 'UI', 'battle'])('%s 变更使旧加载结果失效', async kind => {
    const { gate, runtime } = delayRuntime();
    const loader = await facade(), request = loader.openDevConsole();
    if (kind === 'root') UI.el.ovBody.innerHTML = '<section id="newPage">新页</section>';
    if (kind === 'overlay') UI.el.overlay.hidden = true;
    if (kind === 'revision') UI._overlayRevision += 1;
    if (kind === 'slot') h.slot = 2;
    if (kind === 'base') window.SDT.Base = { slot:1 };
    if (kind === 'baseSlot') window.SDT.Base.slot = 2;
    if (kind === 'run') h.game.discoveredPairs = [];
    if (kind === 'context') (await import('../game/src/battle/battle-loader.js')).invalidateBattleContext(h.game);
    if (kind === 'UI') window.SDT.UI = { ...UI };
    if (kind === 'battle') h.game.battleActive = true;
    gate.resolve(); expect(await request).toBe(false);
    expect(runtime.openDevConsole).not.toHaveBeenCalled(); expect(loader.devToolsLoading).toBe(false);
  });

  it('来源改变后再次同入口是新请求，旧加载结果不能取消或代替它', async () => {
    const { gate, load, runtime } = delayRuntime();
    const loader = await facade(), first = loader.openDevConsole();
    UI.el.ovBody.innerHTML = '<section id="newSource">新来源页</section>';
    const second = loader.openDevConsole();
    gate.resolve();
    expect(await first).toBe(false); expect(await second).toBeUndefined();
    expect(runtime.openDevConsole).toHaveBeenCalledOnce();
    expect(runtime.openDevConsole.mock.calls[0][0].nodes[0]).toBe(document.getElementById('newSource'));
    expect(load).toHaveBeenCalledOnce();
  });

  it('共享导航仲裁取消旧请求，重开可复用在途模块而不让旧 finally 清新请求', async () => {
    const { gate, load, runtime } = delayRuntime();
    const loader = await facade(), first = loader.openDevConsole();
    const pages = await import('../game/src/ui/page-entry-cancellation.js');
    const cancelNewPage = vi.fn(() => true);
    pages.beginPageEntryCancellation('test-navigation', cancelNewPage);
    expect(loader.devToolsLoading).toBe(false);
    const second = loader.openDevConsole();
    expect(cancelNewPage).toHaveBeenCalledOnce();
    gate.resolve(); expect(await first).toBe(false); expect(await second).toBeUndefined();
    expect(runtime.openDevConsole).toHaveBeenCalledOnce(); expect(load).toHaveBeenCalledOnce();
    pages.releasePageEntryCancellation('test-navigation', cancelNewPage);
  });

  it('加载失败无裸 rejection、原页不变且下次允许真正重试', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gate } = delayRuntime();
    const loader = await facade(), original = document.getElementById('source');
    const request = loader.openDevConsole();
    gate.reject(new Error('offline'));
    expect(await request).toBe(false);
    expect(document.getElementById('source')).toBe(original); expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('重试'), 'warn');
    const openDevConsole = vi.fn();
    vi.doMock(runtimePath, () => ({ openDevConsole, devJumpNode:vi.fn(), devForceBattle:vi.fn() }));
    expect(await loader.openDevConsole()).toBeUndefined();
    expect(openDevConsole).toHaveBeenCalledOnce(); expect(loader.devToolsLoading).toBe(false);
  });

  it('已缓存 runtime 的异步/同步失败也被捕获，不产生裸 rejection', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.doMock(runtimePath, () => ({
      openDevConsole:vi.fn(), devJumpNode:() => { throw new Error('node failure'); },
      devForceBattle:async () => { throw new Error('battle failure'); },
    }));
    const loader = await facade();
    await loader.openDevConsole();
    expect(await loader.devJumpNode('shop')).toBe(false);
    expect(await loader.devForceBattle(false)).toBe(false);
    expect(UI.log).toHaveBeenCalledTimes(2);
    expect(document.getElementById('source')).not.toBeNull();
  });

  it('请求开始的真实 DOM、动作/输入/hover/焦点在关闭后恢复，warm toggle 即时生效', async () => {
    const gate = deferred();
    vi.doMock(runtimePath, async () => { await gate.promise; return vi.importActual(runtimePath); });
    const loader = await facade(), source = document.getElementById('source'), input = document.getElementById('sourceInput');
    const claim = vi.fn(), direct = vi.fn(), oldInput = vi.fn(), oldHover = vi.fn();
    source.addEventListener('click', direct); UI.act('claim', claim); UI._inputHandler = oldInput; UI._hoverHandler = oldHover;
    const bagClose = UI._bagCloseHook = vi.fn(), returnFocus = UI._overlayReturnFocus = source.querySelector('button');
    UI._roomActive = true;
    const cards = await import('../game/src/hub/game.cardslib.common.js');
    cards.setCardPageOpen(true);
    input.focus(); input.value = '原输入';
    const request = loader.openDevConsole();
    document.getElementById('otherFocus').focus(); gate.resolve(); await request;
    expect(document.getElementById('devConsole')).not.toBeNull();
    expect(cards.cardPageOpen).toBe(false);
    const close = loader.openDevConsole();
    expect(document.getElementById('source')).toBe(source); await close;
    expect(input.value).toBe('原输入'); expect(document.activeElement).toBe(input);
    expect(UI._acts.claim).toBe(claim); expect(UI._inputHandler).toBe(oldInput); expect(UI._hoverHandler).toBe(oldHover);
    expect(UI._bagCloseHook).toBe(bagClose); expect(UI._overlayReturnFocus).toBe(returnFocus); expect(UI._roomActive).toBe(true);
    expect(cards.cardPageOpen).toBe(true);
    source.querySelector('button').click(); expect(direct).toHaveBeenCalledOnce();
    UI._acts.claim(); expect(claim).toHaveBeenCalledOnce(); expect(h.game.state).toBe('modal');
  });

  it('战斗来源关闭刷新 live view，不恢复下载前的陈旧战斗 DOM', async () => {
    const loader = await facade(); h.game.battleActive = true; h.game.state = 'battle';
    UI.showOverlay('战斗', '<section class="battle-stage">旧战斗</section>', 'battle');
    const old = UI.el.ovBody.firstElementChild;
    const refreshView = vi.fn(() => UI.showOverlay('战斗', '<section class="battle-stage">实时战斗</section>', 'battle'));
    window.SDT.Battle = { commands:{ refreshView } };
    await loader.openDevConsole(); await loader.openDevConsole();
    expect(refreshView).toHaveBeenCalledOnce(); expect(UI.el.ovBody.firstElementChild).not.toBe(old);
    expect(UI.el.ovBody.textContent).toBe('实时战斗'); expect(h.game.state).toBe('battle');
  });
});
