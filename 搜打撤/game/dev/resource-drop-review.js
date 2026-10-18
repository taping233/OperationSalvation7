// Isolated memory storage is installed by the review HTML before boot.
import '../src/main.js';
import { game, _set_active_slot } from '../src/run/game.session.js';
import { devJumpNode } from '../src/run/game.run.dev.js';
import { SeededRandomService, setRandomService } from '../src/core/random.js';

const SDT = window.SDT, UI = SDT.UI;
// The shared Vite service may retain canonical transforms while file watching
// is disabled. Load this controller fresh without changing the shared service.
const controllerURL = new URL('/src/run/game.run.flow.js', location.origin);
const response = await fetch(controllerURL + '?review=resource-drop-1018-v2');
if (!response.ok) throw new Error('物资格控制器加载失败');
const source = (await response.text()).replace(/(from\s*['"])((?:\.{1,2}\/|\/)[^'"]+)(['"])/g,
  (_, prefix, path, suffix) => prefix + new URL(path, controllerURL).href + suffix);
if (!source.includes('selected.cards[Math.floor')) throw new Error('物资格控制器不是最新分档算法');
const blob = URL.createObjectURL(new Blob([source], { type:'text/javascript' }));
let reenterCell;
try { ({ reenterCell } = await import(/* @vite-ignore */ blob)); } finally { URL.revokeObjectURL(blob); }
const controls = document.createElement('nav');
controls.style.cssText = 'position:fixed;left:12px;top:12px;z-index:100000;display:flex;align-items:center;gap:8px;background:#18232b;padding:10px;color:white;font:14px sans-serif';
controls.innerHTML = '<span>物资格 · 内存隔离</span><button id="resource-normal">标准分档抽取</button><button id="resource-elite">精英分档抽取</button><button id="resource-reenter">重进原物资格</button><output id="resource-summary"></output>';
document.body.append(controls);
function prepare(mode) {
  _set_active_slot(null);
  SDT.Sound.setMuted?.(true);
  devJumpNode('shop'); UI.hideOverlay({ immediate:true });
  game.state = 'idle'; game.battleActive = false; game.mode = mode;
  game.entrySupply = null; game.nodeRewards = {}; game.nodeChestRewards = {};
  game.ownedCards = []; game.inventory = []; game.usedPocket = [];
  const layer = game.layerData[game.layerIdx];
  const idx = layer.logical.findIndex((node, i) => i > 0 && node && !(layer.doors || []).some(door => door.at === i));
  game.trackPos = idx; layer.logical[idx].def = { type:'resource' }; game.visited = {};
  const random = new SeededRandomService(7), rolls = [0.61, 0.99, 0.89, 0.99];
  setRandomService({ random:stream => stream === 'loot' ? (rolls.shift() ?? 0.1) : random.random(stream),
    reseed() {}, snapshot:() => random.snapshot(), restore:value => random.restore(value) });
  reenterCell();
  const ids = game.nodeRewards[`${game.layerIdx},${game.trackPos}`]?.cardIds || [];
  const counts = {};
  for (const card of SDT.Cards.all().filter(card => card.type === '资源' && SDT.Cards.isRandomObtainable(card)))
    counts[card.rarity] = (counts[card.rarity] || 0) + 1;
  document.querySelector('#resource-summary').textContent = `当前资源池 ${JSON.stringify(counts)}；` + ids.map(id => {
    const card = SDT.Cards.all().find(item => item.id === id); return `${card?.name}（${card?.rarity}）`;
  }).join(' / ');
}
document.querySelector('#resource-normal').onclick = () => prepare('standard');
document.querySelector('#resource-elite').onclick = () => prepare('elite');
document.querySelector('#resource-reenter').onclick = () => { UI.hideOverlay({ immediate:true }); game.state = 'idle'; reenterCell(); };
