import {describe,expect,it,vi} from 'vitest';
import map from '../game/data/map.json';

window.SDT={UI:{log(){},showOverlay(){},act(){},refresh(){},hideOverlay(){},el:{ovBody:{querySelector(){return null;}}}},Sound:{sfx(){}},Art:{monsterArt(){return'';}},Chests:{}};
const game={layerIdx:1,state:'idle'}; let values=[],started=null;
vi.mock('../game/src/game.session.js',()=>({MAP:{...map,rollCount:([a])=>a},game,bagCap:()=>9,newUid:()=>'',pick:a=>a[0],saveGame(){},scaledEnemy:x=>x,usedSlots:()=>0}));
vi.mock('../game/src/shared.js',()=>({esc:String,escAttr:String}));
vi.mock('../game/src/sound.js',()=>({tone(){}}));
vi.mock('../game/src/game.cardslib.js',()=>({Sfx:{tick(){}},_set_cardPageOpen(){},cardHTML(){return'';}}));
vi.mock('../game/src/game.run.data.js',()=>({IMMEDIATE_SCENES:new Set(),NODE_BG:{},PICKUP_BG:{},PRELOAD_SCENES:{},SCENES:{},SCENE_META:{}}));
vi.mock('../game/src/random.js',()=>({Random:{random:()=>values.shift()??0}}));
vi.mock('../game/src/game.run.shop.js',()=>({createShopController:()=>({openShop(){}})}));
vi.mock('../game/src/battle-loader.js',()=>({startBattle:async(_game,foes,opts)=>{started={foes,opts};return true;}}));
vi.mock('../game/src/bag-return-hook.js',()=>({setBagReturnHook(){}}));
const scenes=await import('../game/src/game.run.scenes.js');

describe('R7-a real scenes encounter-to-opts chain',()=>{
  it('builds L2 mixed group and forwards identity into battle opts',async()=>{
    values=[.99]; const list=scenes.buildEncounter(1);
    expect(list.map(x=>x.id)).toEqual(['archer','cavalry']); expect(list.encounterId).toBe('l2-archer-cavalry');
    await scenes.openBattleCell(null,list);
    expect(started.foes).toBe(list); expect(started.opts).toMatchObject({encounterId:'l2-archer-cavalry',encounterKind:'group',rewardKind:'normal'});
  });
  it('keeps L4 elite roll before mixed group selection',()=>{
    values=[.05]; expect(scenes.buildEncounter(3).map(x=>x.id)).toEqual(['dragon']);
    values=[.99,.99]; expect(scenes.buildEncounter(3).map(x=>x.id)).toEqual(['fire_el','grass_el']);
  });
});
