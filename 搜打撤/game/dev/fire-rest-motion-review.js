// Only seeds an in-memory campfire. Production controller, input and motion run unchanged.
import '../src/main.js';
import { game, newUid, _set_active_slot, setLobby } from '../src/run/game.session.js';
import { openFireRest } from '../src/run/game.run.altar.js';

const SDT = window.SDT, UI = SDT.UI;
_set_active_slot(null);
const tools = document.createElement('nav');
tools.style.cssText = 'position:fixed;left:12px;bottom:10px;z-index:100000;display:flex;gap:10px;padding:10px;background:#14212bea;color:#eee;font:14px sans-serif';
tools.setAttribute('aria-label','营火演出隔离验收');
tools.innerHTML = '<button type="button" data-review-fire>重置营火场景</button><button type="button" data-review-hold>定格当前演出</button><output>内存场景，不写入玩家档位</output>';
document.body.append(tools);
let held = false;
const report = () => {
  tools.querySelector('output').textContent = `生命 ${game.hp}/${game.maxHp} · 背包 ${game.ownedCards?.length || 0} · 消耗区 ${game.usedPocket?.reduce((n,item) => n+item.count,0) || 0} · ${held ? '动画定格' : '正常播放'} · 无玩家档位`;
};
tools.querySelector('[data-review-fire]').addEventListener('click', () => {
  if (document.querySelector('.fire-rest-feedback')) return;
  _set_active_slot(null); setLobby(false); held = false;
  UI.hideOverlay({ immediate:true });
  document.getElementById('title').hidden = true;
  const cards = ['tt3-ice-spike','tt3-holy-shield'].map(id => SDT.Cards.all().find(card => card.id === id));
  if (cards.some(card => !card)) throw new Error('验收卡牌缺失');
  Object.assign(game, { state:'idle', runActive:true, battleActive:false,
    hp:18,maxHp:30,atk:4,coins:0,characterId:'heixiang',myClass:'战士',
    layerIdx:0,trackPos:0,visited:{},nodeRewards:{},discoveredPairs:new Set(),
    layerData:[{logical:[{def:{type:'fire'}}]}],
    ownedCards:[],inventory:[],usedPocket:cards.map(card => ({uid:newUid(),card:{...card},count:1})),
    cardOrder:[],eventLog:[],nestActive:false,nestRunes:[],nestEquipped:[],
  });
  UI.beginRoom(); UI.refresh(game); openFireRest();
  UI.el.overlay.append(tools); tools.inert = false; tools.removeAttribute('aria-hidden');
  report();
});
tools.querySelector('[data-review-hold]').addEventListener('click', () => {
  const animations = document.querySelector('.fire-rest-feedback')?.getAnimations({subtree:true}) || [];
  if (!animations.length) return;
  // Freeze a sampled frame for screenshots; settlement/timeout remain production behavior.
  for (const animation of animations) { animation.pause(); animation.currentTime = 620; }
  held = true; report();
});
document.addEventListener('click', () => requestAnimationFrame(report));
