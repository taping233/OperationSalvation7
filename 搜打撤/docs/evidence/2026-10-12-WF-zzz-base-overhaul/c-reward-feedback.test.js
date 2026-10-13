// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { bindRewardFeedback } from '../../../game/src/hub/hub.reward-feedback.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(command) {
  let received = false;
  const base = { slot:1, data:{ wood:2, rations:0, keys:0, stash:[] }, isBackUnlocked:() => false };
  const meta = { isClaimed:() => received, isUnlocked:() => true, isCollClaimed:() => false, ACHIEVEMENTS:[{id:'a',name:'真实目标'}], COLL_MILESTONES:[] };
  const cards = { CARD_BACKS:[] };
  document.body.innerHTML = '<div id="ovBody"><div id="hubMain"><section class="hub-archive-v3"><main class="av12-content"><button data-act="claimAch" data-id="a">领取奖励</button><button class="on" data-act="archiveV12Record">目标</button></main></section></div></div>';
  document.body.insertAdjacentHTML('beforeend','<div id="log"><div class="log-line warn">旧错误：上次存档失败</div></div>');
  const root = document.querySelector('.hub-archive-v3');
  const delegate = document.getElementById('ovBody');
  const log = document.getElementById('log');
  const ui = {el:{ovBody:delegate,log}};
  const run = vi.fn(() => command({base, root, delegate, meta, cards, ui, log, mark:() => { received=true; }}));
  // UI.init installs the original action dispatcher at ovBody before archive binding.
  delegate.addEventListener('click', event => { if (event.target.closest('[data-act="claimAch"]')) run(); });
  bindRewardFeedback({root,base,meta,cards,ui});
  bindRewardFeedback({root,base,meta,cards,ui});
  return {root,base,meta,cards,ui,run,button:root.querySelector('[data-act="claimAch"]')};
}

it('reports the committed marker and actual randomized stash delta; confirmation does not claim again', async () => {
  const {root,button,run}=setup(({base,mark}) => {base.data.wood+=3;base.data.stash.push({card:{id:'random-card',name:'实际抽中的卡牌'},count:1});mark();});
  button.click(); await Promise.resolve();
  const panel=root.querySelector('.reward-receipt');
  expect(panel.dataset.outcome).toBe('claimed');
  expect(panel.textContent).toContain('木材 ×3');
  expect(panel.textContent).toContain('实际抽中的卡牌 ×1');
  expect(panel.textContent).toContain('后勤 · 卡牌仓库');
  button.click(); await Promise.resolve();
  expect(root.querySelector('.reward-receipt')).toBe(panel);
  panel.querySelector('[data-reward-close]').click();
  expect(run).toHaveBeenCalledTimes(2);
  expect(root.querySelector('.reward-receipt')).toBeNull();
  expect(document.activeElement).toBe(root.querySelector('[data-act="archiveV12Record"]'));
});

it('preserves a failed unclaimed reward and the original concrete error; Esc only closes receipt', async () => {
  const {root,button,run}=setup(() => {document.body.insertAdjacentHTML('beforeend','<p id="original-error">存档写入失败</p>');});
  button.click(); await Promise.resolve();
  const panel=root.querySelector('.reward-receipt');
  expect(panel.dataset.outcome).toBe('unclaimed');
  expect(panel.textContent).toContain('尚未领取');
  expect(document.querySelector('#original-error').textContent).toBe('存档写入失败');
  panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(root.querySelector('.reward-receipt')).toBeNull();
  expect(run).toHaveBeenCalledOnce();
  expect(button.disabled).toBe(false);
});

it('does not publish receipt after a slot change or from a detached listener', async () => {
  const {root,button}=setup(({base,mark}) => {mark();base.slot=2;});
  button.click(); await Promise.resolve();
  expect(root.querySelector('.reward-receipt')).toBeNull();
  root.remove();button.click();await Promise.resolve();
  expect(document.querySelector('.reward-receipt')).toBeNull();
});

it('waits for the real ovBody delegation phase even with a capture checkpoint and render replacing the archive', () => {
  // Native listeners may checkpoint microtasks before reaching the next ancestor.
  // Force that checkpoint: the old capture+queueMicrotask scheme reports false here.
  vi.stubGlobal('queueMicrotask', callback => callback());
  const order=[];
  const {root,button,run}=setup(({base,delegate,meta,cards,mark}) => {
    order.push('original-ovBody-command');
    expect(document.querySelector('.reward-receipt')).toBeNull();
    base.data.wood+=2;mark();
    delegate.innerHTML='<div id="hubMain"><section class="hub-archive-v3"><main class="av12-content"><button class="on" data-act="archiveV12Record">下一项</button></main></section></div>';
    bindRewardFeedback({root:delegate.querySelector('.hub-archive-v3'),base,meta,cards});
  });
  root.addEventListener('click', () => {
    order.push('archive-capture');
    expect(document.querySelector('.reward-receipt')).toBeNull();
  },true);
  button.dispatchEvent(new MouseEvent('click',{bubbles:true}));
  expect(order).toEqual(['archive-capture','original-ovBody-command']);
  expect(document.querySelector('.reward-receipt').dataset.outcome).toBe('claimed');
  expect(document.querySelector('.reward-receipt').textContent).toContain('木材 ×2');
  expect(run).toHaveBeenCalledOnce();
});

it('shows only the new actual warning from this original delegated failure', () => {
  const {root,button}=setup(({log}) => {
    const entry=document.createElement('div');
    entry.className='log-line warn';entry.innerHTML='仓库容量不足——先卖出或扩建<b>卡牌仓库</b>再来领取';
    log.prepend(entry);
  });
  button.click();
  const panel=root.querySelector('.reward-receipt');
  expect(panel.dataset.outcome).toBe('unclaimed');
  expect(panel.textContent).toContain('仓库容量不足——先卖出或扩建卡牌仓库再来领取');
  expect(panel.textContent).not.toContain('旧错误');
});

it('does not copy a previous warning when the original delegated failure emits no new warning', () => {
  const {root,button}=setup(() => {});
  button.click();
  const panel=root.querySelector('.reward-receipt');
  expect(panel.dataset.outcome).toBe('unclaimed');
  expect(panel.textContent).toContain('尚未领取');
  expect(panel.textContent).not.toContain('旧错误');
  expect(panel.textContent).not.toContain('存档失败');
});

it('closes only the visible receipt before an existing parent overlay capture return handler', () => {
  const {root,button,base,run}=setup(({base,mark}) => {base.data.wood+=2;mark();});
  root.dataset.archiveView='rewards';
  const overlayReturn=vi.fn(() => {root.dataset.archiveView='cards';});
  document.getElementById('ovBody').addEventListener('keydown',overlayReturn,true);
  button.click();
  const panel=root.querySelector('.reward-receipt');
  const wood=base.data.wood;
  panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(overlayReturn).not.toHaveBeenCalled();
  expect(root.dataset.archiveView).toBe('rewards');
  expect(root.querySelector('.reward-receipt')).toBeNull();
  expect(base.data.wood).toBe(wood);
  expect(run).toHaveBeenCalledOnce();
  root.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(overlayReturn).toHaveBeenCalledOnce();
});

it('leaves composing Escape and a genuinely higher card zoom to the existing parent capture handler', () => {
  const {root,button}=setup(({mark}) => mark());
  const overlayReturn=vi.fn(event => {
    if(event.isComposing) return;
    document.getElementById('cardZoom')?.remove();
  });
  document.getElementById('ovBody').addEventListener('keydown',overlayReturn,true);
  button.click();
  const panel=root.querySelector('.reward-receipt');
  panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,isComposing:true}));
  expect(root.querySelector('.reward-receipt')).toBe(panel);
  document.body.insertAdjacentHTML('beforeend','<div id="cardZoom">上层卡牌详情</div>');
  panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(overlayReturn).toHaveBeenCalledTimes(2);
  expect(document.getElementById('cardZoom')).toBeNull();
  expect(root.querySelector('.reward-receipt')).toBe(panel);
  panel.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  expect(root.querySelector('.reward-receipt')).toBeNull();
  expect(overlayReturn).toHaveBeenCalledTimes(2);
});

it.each([
  {label:'0格实际存在的卡牌奖励',room:0,reward:{card:'actual-card'},expectCapacity:true},
  {label:'0格纯资源奖励',room:0,reward:{wood:2},expectCapacity:false},
  {label:'空间足够的卡牌奖励',room:2,reward:{card:'actual-card'},expectCapacity:false},
  {label:'0格但不可核实卡牌',room:0,reward:{card:'missing-card'},expectCapacity:false},
])('without a log, shows only verified present capacity facts: $label', ({room,reward,expectCapacity}) => {
  const {root,button,base,meta,cards,ui}=setup(() => {});
  ui.el.log=null;
  base.stashRoom=() => room;
  meta.ACHIEVEMENTS[0].reward=reward;
  cards.all=() => [{id:'actual-card',name:'真实现役卡'}];
  button.click();
  const panel=root.querySelector('.reward-receipt');
  expect(panel.dataset.outcome).toBe('unclaimed');
  expect(panel.textContent.includes('仓库当前剩余 0 格')).toBe(expectCapacity);
  expect(panel.textContent).not.toContain('存档失败');
});
