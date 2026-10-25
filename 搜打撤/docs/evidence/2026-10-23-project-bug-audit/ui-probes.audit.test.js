import { expect, it, vi } from 'vitest';
const fixture=vi.hoisted(()=>({game:{runActive:false,battleActive:false,state:'title'},newRun:vi.fn(),openFireRest:vi.fn()}));
vi.mock('../../../game/src/run/game.session.js',()=>({MAP:{},game:fixture.game,newRun:fixture.newRun,saveGame:vi.fn(),scaledEnemy:vi.fn()}));
vi.mock('../../../game/src/run/game.run.scenes.js',()=>({buildEncounter:vi.fn(),openChestsOnCell:vi.fn(),openShop:vi.fn()}));
vi.mock('../../../game/src/run/game.run.altar.js',()=>({openAltarRitual:vi.fn(),openFireRest:fixture.openFireRest}));
vi.mock('../../../game/src/run/game.run.flow.js',()=>({runEventDeck:vi.fn()}));
vi.mock('../../../game/src/battle/battle-loader.js',()=>({captureBattleContext:vi.fn(),startBattle:vi.fn()}));
vi.mock('../../../game/src/agent/agent.console.js',()=>({agentTabHTML:vi.fn(),bindAgentTab:vi.fn(),keysTabHTML:vi.fn(),bindKeysTab:vi.fn()}));
vi.mock('../../../game/src/agent/agent.data.js',()=>({dataPanelHTML:vi.fn(),bindDataActions:vi.fn()}));
vi.mock('../../../game/src/hub/game.cardslib.common.js',()=>({cardPageOpen:false,setCardPageOpen:vi.fn()}));

it('UI-1: 开发者跳节点应保留选人页刚确认的无/刺客',async()=>{
  document.body.innerHTML='<section id="title"></section><section id="overlay" hidden></section>';
  window.SDT={UI:{log:vi.fn(),hideOverlay:vi.fn(),beginRoom:vi.fn(),el:{overlay:document.getElementById('overlay')}}};
  fixture.newRun.mockImplementation(async()=>{Object.assign(fixture.game,{runActive:true,characterId:'wu',myClass:'刺客',classCard:{name:'无'}});});
  const {devJumpNode}=await import('../../../game/src/run/game.run.dev.js');
  await devJumpNode('fire');
  expect(fixture.openFireRest).toHaveBeenCalledOnce();
  expect(fixture.game.characterId).toBe('wu');
  expect(fixture.game.myClass).toBe('刺客');
});
