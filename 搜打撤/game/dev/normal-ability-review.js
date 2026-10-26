// Real battle entry with the review HTML's memory-only storage.
const controls = document.createElement('div');
controls.className = 'cohesion-review-controls';
controls.innerHTML = '<button id="normalAbilityStart">普通战能力卡样板</button><output>等待启动</output>';
document.body.append(controls);
controls.querySelector('button').onclick = async () => {
  try {
    const { game, newRun } = await import('/src/run/game.session.js');
    const { startBattle } = await import('/src/battle/battle-loader.js');
    if (window.SDT.Base?.slot != null) throw new Error('样板禁止使用玩家档位');
    if (await newRun('standard') === false) throw new Error('未建立测试局');
    document.getElementById('title').hidden = true;
    game.characterId = 'heixiang'; game.myClass = '战士'; game.state = 'idle';
    window.SDT.UI.hideOverlay(); window.SDT.UI.beginRoom();
    const ability = window.SDT.Cards.all().find(card => card.id === 'tt8-hero-mage');
    if (!ability) throw new Error('缺少正式能力卡');
    game.ownedCards = [{ uid: 'normal-review-ability', card: { ...ability } }];
    await startBattle(game, [{ id: 'bandit', name: '截道拾荒者', hp: 100, atk: 1 }], { isBoss: false, layer: 0 });
    controls.querySelector('output').textContent = '生产控制器 · 内存测试局';
    controls.querySelector('button').disabled = true;
  } catch (error) { controls.querySelector('output').textContent = error.message; console.error(error); }
};
