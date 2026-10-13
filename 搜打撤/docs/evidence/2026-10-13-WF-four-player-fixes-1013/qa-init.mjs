import fs from 'node:fs';
const root = '.tmp/WF-four-player-fixes-1013/runtime/game';
const html = fs.readFileSync(`${root}/index.html`, 'utf8').replace('</body>', '<script type="module" src="./four-player-qa.js"></script></body>');
fs.writeFileSync(`${root}/four-player-qa.html`, html);
fs.writeFileSync(`${root}/four-player-qa.js`, `
await import('./src/main.js');
const { game, saveGame, newUid } = await import('./src/run/game.session.js');
const { openPocketRestore, openChestsOnCell } = await import('./src/run/game.run.scenes.js');
const { runEventDeck } = await import('./src/run/game.run.flow.js');
const { showBackpack } = await import('./src/hub/game.bag.js');
const { BattleSession } = await import('./src/battle/core/battle.core.js');
const { SceneMusicPlayer } = await import('./src/audio/sound.music.player.js');
const { Howl } = await import('howler');
const { SDT } = window;
const originalAll = SDT.Cards.all;
const cards = originalAll();
const byId = id => cards.find(c => c.id === id);
const panel = document.createElement('aside');
panel.id = 'fixQA'; panel.style.cssText = 'position:fixed;z-index:9999;left:8px;bottom:8px;background:#102535;color:white;padding:8px;font-size:12px;display:flex;gap:6px';
panel.innerHTML = '<b>隔离构造场景</b><button id="qaRestore">复原</button><button id="qaPotions">药摊</button><button id="qaGuard">格挡</button><button id="qaBoss">首脑0初始</button><button id="qaCurse">诅咒目标</button><button id="qaChest">宝箱</button><button id="qaCap">容量</button><button id="qaNine">九牌</button><button id="qaAudio">音乐回退</button><button id="qaBag">背包</button><output id="qaResult">待验</output>';
document.body.append(panel);
const overlay = document.getElementById('overlay');
const mountPanel = () => { panel.removeAttribute('inert'); (overlay.hidden ? document.body : overlay).append(panel); };
new MutationObserver(mountPanel).observe(overlay,{attributes:true,attributeFilter:['hidden']});
mountPanel();
const report = message => { document.getElementById('qaResult').textContent = message; };
const prepare = () => {
  if (!game.runActive) throw new Error('须先真实新档出征');
  SDT.Cards.all = originalAll;
  game.hp = game.maxHp = 50; game.inventory = []; game.ownedCards = []; game.usedPocket = []; game.battleActive = false;
  SDT.UI.hideOverlay({ immediate:true }); SDT.UI.beginRoom();
};
document.getElementById('qaRestore').onclick = () => {
  prepare(); game.usedPocket = [{ card:byId('tt2-block'), count:3 }];
  SDT.UI.showOverlay('祭坛回赠', '<button data-act="qaRestoreGo">复原3张</button>', 'page');
  SDT.UI.act('qaRestoreGo', () => {
    SDT.UI.hideOverlay();
    openPocketRestore(3, () => { game.state='idle'; saveGame(); SDT.UI.refresh(game); report('复原完成：'+game.ownedCards.length+'张，口袋'+game.usedPocket.length); }, { tone:'altar' });
  });
};
document.getElementById('qaPotions').onclick = async () => {
  prepare();
  const li = game.layerData.findIndex(layer => layer.logical.some((cell,i) => cell.def.type==='event' && !(liKey(layer,i))));
  function liKey(layer,i) { return game.visited[game.layerData.indexOf(layer)+','+i]; }
  if(li < 0) throw new Error('没有未完成事件节点');
  game.layerIdx=li; game.trackPos=game.layerData[li].logical.findIndex((cell,i)=>cell.def.type==='event' && !game.visited[li+','+i]);
  game.state='idle'; saveGame();
  SDT.Cards.all = () => cards.filter(c => c.id==='ev19-potions' || c.type==='道具');
  await runEventDeck(); report('药摊构造完成');
};
document.getElementById('qaGuard').onclick = () => {
  prepare(); game.ownedCards = [{ uid:newUid(), card:byId('tt2-block') }];
  BattleSession.start(game, [{ id:'qa-guard-foe', name:'格挡到期靶子', hp:100, atk:8 }], { isBoss:false, name:'G11构造验证' });
  report('50HP／敌攻8');
};
document.getElementById('qaBag').onclick = () => { showBackpack(); report('背包卡数'+game.ownedCards.length); };
document.getElementById('qaBoss').onclick = () => {
  prepare(); game.ownedCards=[{uid:newUid(),card:byId('tt12-backupcell')},{uid:newUid(),card:byId('tt3-longsword')}];
  BattleSession.start(game,[{id:'qa-boss',name:'补给靶首脑',hp:100,atk:1}],{isBoss:true,name:'G08补给验证'});
};
document.getElementById('qaCurse').onclick = () => {
  prepare(); game.atk=7;game.ownedCards=['诅咒之刃','霜月斩'].map(name=>({uid:newUid(),card:cards.find(c=>c.name===name)}));
  BattleSession.start(game,[{id:'qa-kill',name:'原目标',hp:1,atk:4},{id:'qa-other',name:'旁人',hp:30,atk:4}],{isBoss:false,name:'G05原目标验证'});
};
document.getElementById('qaChest').onclick = () => {
  prepare();const li=game.layerData.findIndex(layer=>layer.logical.some(c=>c.def.type==='chest'));
  if(li<0)throw new Error('没有宝箱节点');game.layerIdx=li;game.trackPos=game.layerData[li].logical.findIndex(c=>c.def.type==='chest');game.state='idle';saveGame();
  openChestsOnCell([{kind:'small'}],'G03宝箱构造',{consumeNode:true});
};
document.getElementById('qaCap').onclick = () => {
  prepare();game.ownedCards=[{uid:newUid(),card:byId('tt2-pearlbox')}];
  game.inventory=Array.from({length:15},(_,i)=>({name:'容量物资'+i,count:1,value:1}));showBackpack();report('通用16满／资源9空');
};
document.getElementById('qaNine').onclick = () => {
  prepare();game.ownedCards=['tt2-block','tt3-longsword','tt3-qi-wave','tt3-frost-slash','tt3-ice-spike','tt3-venom-arrow','tt3-fireball','tt3-skewer','tt12-backupcell'].map(id=>({uid:newUid(),card:byId(id)}));
  BattleSession.start(game,[{id:'qa-nine',name:'九牌阅读靶子',hp:100,atk:8}],{isBoss:false,name:'G09九牌阅读验证'});
};
let qaAudioPlayer=null;
document.getElementById('qaAudio').onclick = () => {
  qaAudioPlayer?.dispose();let attempts=0;
  qaAudioPlayer=new SceneMusicPlayer((scene,cb,opts)=>{
    attempts++;
    if(!opts?.html5)return {state:()=> 'unloaded',playing:()=>false,volume:()=>0,mute(){},pause(){},unload(){},fade(){},load(){cb.error(null,'Decoding audio data failed.');}};
    return new Howl({src:[new URL('./assets/music-demo/02-explore-ashline.ogg',import.meta.url).href],format:['opus'],html5:true,preload:false,volume:0,
      onload(){report('HTML5回退已加载／尝试'+attempts);cb.load();},onplay(){report('HTML5回退已播放（静音验加载）／尝试'+attempts);cb.play();},onloaderror:cb.error,onplayerror:cb.playError,onunlock:cb.unlock});
  },{onError:(scene,error)=>report('回退失败：'+error)});
  qaAudioPlayer.set('board',{enabled:true,volume:0});
};
window.addEventListener('beforeunload',()=>qaAudioPlayer?.dispose());
`);
console.log('isolated QA harness created; no shared source modified');
