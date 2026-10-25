import { afterEach, expect, it, vi } from 'vitest';
import { createMenuSlotPicker } from '../game/src/ui/menu-slots.js';
import { bindSlotArchive } from '../game/src/ui/save-management.js';
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();});
function fixture(){
  document.body.innerHTML='<section id="overlay"><div id="ovBody"></div></section>';
  return {el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},_acts:{},act(name,fn){this._acts[name]=fn;},
    showOverlay(_title,html){this.el.ovBody.innerHTML=html;},log:vi.fn(),hideOverlay:vi.fn(),confirmAction:vi.fn()};
}
it.each(['existing','empty','broken'])('真实选档生成器为%s档位提供备份与恢复入口',state=>{
  const UI=fixture();const slots=createMenuSlotPicker({UI,game:{state:'title'},document,SLOT_COUNT:1,esc:String,
    readSlot:()=>{if(state==='broken')throw new Error('unreadable');return state==='existing'?{savedAt:1,hp:10,maxHp:20}:null;},
    readBase:()=>({peek:()=>null,issue:()=>null,hasSlot:()=>false}),readMeta:()=>({ACHIEVEMENTS:[]}),fmtPlayTime:String,
    pickLatestSlot:()=>null,RunStorage:{has:()=>false,issue:()=>null},saveArchive:{}});
  slots.startNewGame();
  for(const action of ['exportSlotArchive','importSlotArchive','recoverSlotImport']){
    expect(UI.el.ovBody.querySelector(`[data-act="${action}"][data-slot="1"]`)).not.toBeNull();
    expect(UI._acts[action]).toBeTypeOf('function');
  }
});
it('导出服务拒绝被消费并在当前页显示错误',async()=>{
  const UI=fixture();UI.el.ovBody.innerHTML='<main class="slot-page"></main>';const onError=vi.fn();
  bindSlotArchive({UI,saveArchive:{exportSlot:vi.fn().mockRejectedValue(new Error('磁盘不可读'))},onError});
  expect(await UI._acts.exportSlotArchive({slot:'1'})).toBe(false);expect(onError).toHaveBeenCalledWith('磁盘不可读');
});
it('选档页正在关闭时旧导出与导入动作失效',async()=>{
  const UI=fixture();UI.el.ovBody.innerHTML='<main class="slot-page"></main>';const archive={exportSlot:vi.fn()};
  bindSlotArchive({UI,saveArchive:archive,onError:vi.fn()});UI.el.overlay.classList.add('closing');
  expect(await UI._acts.exportSlotArchive({slot:'1'})).toBe(false);UI._acts.importSlotArchive({slot:'1'});
  expect(archive.exportSlot).not.toHaveBeenCalled();
});
