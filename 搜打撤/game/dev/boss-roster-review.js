// Production battle entry with memory-only storage provided by the HTML fixture.
import mapData from '../data/map.json' with { type: 'json' };
const panel = document.createElement('aside');
panel.className = 'cohesion-review-controls';
panel.innerHTML = mapData.altar.bosses.slice(-4).map(foe => `<button data-boss="${foe.id}">${foe.name}</button>`).join('')
  + '<output id="bossReviewStatus">等待选择</output>';
document.body.append(panel);
panel.addEventListener('click', async event => {
  const button = event.target.closest('button[data-boss]');
  if (!button) return;
  const status = panel.querySelector('output');
  try {
    const { game, newRun } = await import('/src/run/game.session.js');
    const { startBattle } = await import('/src/battle/battle-loader.js');
    if (window.SDT.Base?.slot != null) throw new Error('验收页禁止使用玩家档位');
    if (game.battleActive) window.SDT.Battle.commands.flee();
    if (await newRun('standard') === false) throw new Error('测试局启动失败');
    const cards = window.SDT.Cards;
    cards.ensureSha();
    game.ownedCards = Array.from({ length:20 }, (_, i) => ({ uid:`boss-review-${i}`, card:{ ...cards.SHA } }));
    game.characterId = 'heixiang'; game.myClass = '战士'; game.hp = 200; game.maxHp = 200;
    game.state = 'idle'; document.getElementById('title').hidden = true;
    window.SDT.UI.hideOverlay(); window.SDT.UI.beginRoom();
    const def = mapData.altar.bosses.find(foe => foe.id === button.dataset.boss);
    const started = await startBattle(game, { ...def, boss:true }, { isBoss:true, directBossStart:true, layer:3, name:def.name });
    if (started === false) throw new Error('战斗未进入');
    status.textContent = `${def.name} · 正式战斗入口 · 内存测试局`;
  } catch (error) { status.textContent = error.message; console.error(error); }
});
