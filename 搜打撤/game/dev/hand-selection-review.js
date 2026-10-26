// Production battle with memory-only storage supplied by the review HTML.
const controls = document.createElement('div');
controls.className = 'cohesion-review-controls';
controls.innerHTML = '<button id="handReviewStart">手牌原位选牌样板</button><output id="handReviewStatus">等待启动</output>';
document.body.append(controls);
const output = controls.querySelector('output');
controls.querySelector('#handReviewStart').onclick = async () => {
  try {
    const { game, newRun } = await import('/src/run/game.session.js');
    const { startBattle } = await import('/src/battle/battle-loader.js');
    if (window.SDT.Base?.slot != null) throw new Error('样板禁止使用玩家档位');
    if (await newRun('standard') === false) throw new Error('未建立测试局');
    document.getElementById('title').hidden = true;
    game.characterId = 'heixiang'; game.myClass = '战士'; game.state = 'idle';
    window.SDT.UI.hideOverlay(); window.SDT.UI.beginRoom();
    game.ownedCards = [
      { uid:'review-source', card:{ id:'review-consume', name:'原位消耗', type:'武术', cost:0, desc:'消耗 2 张武术牌，+10甲。' } },
      ...[0, 1, 2].map(i => ({ uid:`review-fuel-${i}`, card:{ ...window.SDT.Cards.SHA } })),
    ];
    await startBattle(game, [{ id:'bandit', name:'截道拾荒者', hp:100, atk:1 }], { isBoss:false, layer:0 });
    output.textContent = '生产控制器 · 内存测试局';
    controls.querySelector('#handReviewStart').disabled = true;
  } catch (error) { output.textContent = error.message; console.error(error); }
};
