import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenuSlotPicker } from '../game/src/ui/menu-slots.js';

let picker, readSlot, peek, runs, prepareBaseHub, idle;
beforeEach(() => {
  vi.useFakeTimers();
  idle=[];
  vi.stubGlobal('requestIdleCallback',vi.fn(callback => {idle.push(callback); return idle.length;}));
  vi.spyOn(document,'hidden','get').mockReturnValue(false);
  prepareBaseHub=vi.fn(async () => {});
  document.body.innerHTML='<div id="overlay"><div id="ovBody"></div></div>';
  runs=new Map([[1,{savedAt:10,layerIdx:0,myClass:'侠客'}],[2,{savedAt:20,layerIdx:1,myClass:'牧师'}]]);
  readSlot=vi.fn(slot => runs.get(slot) || null);
  peek=vi.fn(() => ({stats:{},collection:{}}));
  const base={peek,issue:() => null,hasSlot:() => true};
  const UI={ el:{overlay:document.getElementById('overlay')},act:vi.fn(),
    showOverlay:(_heading,html) => {document.getElementById('ovBody').innerHTML=html;} };
  picker=createMenuSlotPicker({ UI, game:{state:'title'},runtime:{},SLOT_COUNT:3,esc:String,readSlot,
    document,readBase:() => base,RunStorage:{issue:() => null,has:() => false},
    readMeta:() => ({ACHIEVEMENTS:[]}),fmtPlayTime:String,prepareBaseHub });
});
afterEach(() => {vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); vi.restoreAllMocks();});

describe('城市选档只读快照', () => {
  it('先显示选档页，空闲预载不再次读取档案或选择档位', async () => {
    const write=vi.spyOn(Storage.prototype,'setItem');
    picker.startNewGame();
    const before=document.body.innerHTML;
    expect(prepareBaseHub).not.toHaveBeenCalled();
    expect(document.querySelectorAll('.slot-card')).toHaveLength(3);
    idle.shift()();
    await Promise.resolve();
    expect(prepareBaseHub).toHaveBeenCalledOnce();
    expect(readSlot).toHaveBeenCalledTimes(3); expect(peek).toHaveBeenCalledTimes(3);
    expect(document.body.innerHTML).toBe(before); expect(write).not.toHaveBeenCalled();
  });
  it('选档页已离开或被新一次打开替换时，旧空闲任务不加载基地', async () => {
    picker.startNewGame(); const previous=idle.shift();
    picker.startNewGame(); const current=idle.shift();
    previous(); await Promise.resolve();
    expect(prepareBaseHub).not.toHaveBeenCalled();
    document.getElementById('ovBody').innerHTML='<section>其他页面</section>';
    current(); await Promise.resolve();
    expect(prepareBaseHub).not.toHaveBeenCalled();
  });
  it('预载失败不阻塞选档，再次进入仍可准备', async () => {
    prepareBaseHub.mockRejectedValueOnce(new Error('offline'));
    picker.startNewGame(); idle.shift()();
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelectorAll('.slot-card-cta')).toHaveLength(3);
    picker.startNewGame(); idle.shift()();
    await Promise.resolve(); await Promise.resolve();
    expect(prepareBaseHub).toHaveBeenCalledTimes(2);
  });
  it('无空闲回调的平台使用短定时回退，后台页面不预载', async () => {
    vi.stubGlobal('requestIdleCallback',undefined);
    picker.startNewGame();
    await vi.advanceTimersByTimeAsync(79);
    expect(prepareBaseHub).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(prepareBaseHub).toHaveBeenCalledOnce();
    vi.spyOn(document,'hidden','get').mockReturnValue(true);
    picker.startNewGame(); await vi.advanceTimersByTimeAsync(80);
    expect(prepareBaseHub).toHaveBeenCalledOnce();
  });
  it('最近档位和三张档案卡共用每档的一次读取', () => {
    picker.startNewGame();
    expect(readSlot.mock.calls).toEqual([[1],[2],[3]]);
    expect(peek.mock.calls).toEqual([[1],[2],[3]]);
    expect(document.querySelectorAll('.slot-card')).toHaveLength(3);
    expect(document.querySelector('.slot-recent .slot-card-name').textContent).toBe('档位 02');
    expect(document.querySelector('.slot-art-2 .si-progress').textContent).toContain('第 2 层');
  });
  it('再次进入重新取存档，不复用旧的最近档位和进度', () => {
    picker.startNewGame();
    runs.set(1,{savedAt:30,layerIdx:3,myClass:'侠客'});
    picker.startNewGame();
    expect(readSlot).toHaveBeenCalledTimes(6); expect(peek).toHaveBeenCalledTimes(6);
    expect(document.querySelector('.slot-recent .slot-card-name').textContent).toBe('档位 01');
    expect(document.querySelector('.slot-art-1 .si-progress').textContent).toContain('第 4 层');
  });
  it('一个档读取失败只降级该卡，保留其余档位与最近档判定', () => {
    vi.spyOn(console,'warn').mockImplementation(() => {});
    readSlot.mockImplementation(slot => {if(slot===1) throw new Error('bad save'); return runs.get(slot) || null;});
    picker.startNewGame();
    expect(readSlot).toHaveBeenCalledTimes(3); expect(peek).toHaveBeenCalledTimes(3);
    expect(document.querySelector('.slot-art-1').textContent).toContain('档案数据异常');
    expect(document.querySelector('.slot-recent .slot-card-name').textContent).toBe('档位 02');
    expect(document.querySelector('.slot-art-1 [data-act="enterSlot"]')).toBeNull();
  });
});
