import { expect, it, vi } from 'vitest';
import { createMenuSlotPicker } from '../../../game/src/ui/menu-slots.js';

it('UI-2: 现行选档页应提供已绑定的整档导出与导入入口',()=>{
  document.body.innerHTML='<section id="overlay"><div id="ovBody"></div></section>';
  const UI={el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},_acts:{},
    act(name,fn){this._acts[name]=fn;},showOverlay(_title,html){this.el.ovBody.innerHTML=html;},
    log:vi.fn(),hideOverlay:vi.fn(),clearLog:vi.fn(),confirmAction:vi.fn()};
  const slots=createMenuSlotPicker({UI,game:{state:'title'},document,SLOT_COUNT:1,esc:String,
    readSlot:()=>({savedAt:1,hp:10,maxHp:20,coins:1}),
    readBase:()=>({peek:()=>({stats:{playSeconds:100}}),issue:()=>null,hasSlot:()=>true}),
    readMeta:()=>({ACHIEVEMENTS:[]}),fmtPlayTime:String,pickLatestSlot:()=>null,getActiveSlot:()=>1,
    RunStorage:{issue:()=>null,has:()=>true},saveArchive:{exportSlot:vi.fn(),importSlot:vi.fn(),recoverImport:vi.fn()}});
  slots.startNewGame();
  const controls=[...UI.el.ovBody.querySelectorAll('[data-act]')].map(node=>node.dataset.act);
  console.log('AUDIT UI-2',JSON.stringify({registered:Object.keys(UI._acts),controls}));
  expect(Object.hasOwn(UI._acts,'exportSlotArchive')).toBe(true);
  expect(Object.hasOwn(UI._acts,'importSlotArchive')).toBe(true);
  expect(controls).toContain('exportSlotArchive');
  expect(controls).toContain('importSlotArchive');
});
