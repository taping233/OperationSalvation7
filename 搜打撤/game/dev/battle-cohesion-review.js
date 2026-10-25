// Development-only production battle fixture. Storage is replaced in this page's
// head before the application starts; no player save or preference is touched.
const controls = document.createElement('div');
controls.className = 'cohesion-review-controls';
controls.innerHTML = '<button type="button" id="cohesionStart">黑像 × 截道拾荒者</button><button type="button" id="cohesionHide">隐藏面板</button><output id="cohesionStatus">等待启动</output>';
document.body.append(controls);
const start = controls.querySelector('#cohesionStart');
const status = controls.querySelector('#cohesionStatus');
document.querySelector('#cohesionHide').addEventListener('click', () => { controls.hidden = true; });
start.addEventListener('click', async () => {
  start.disabled = true;
  try {
    if (!document.getElementById('title')?.dataset.controlsBound) throw new Error('主界面尚未准备好');
    const { game, newRun } = await import('/src/run/game.session.js');
    const { startBattle } = await import('/src/battle/battle-loader.js');
    if (window.SDT.Base?.slot != null) throw new Error('只读样板不能使用玩家档位');
    if (await newRun('standard') === false) throw new Error('测试局未建立');
    document.getElementById('title').hidden = true;
    game.characterId = 'heixiang';
    game.myClass = '战士';
    game.state = 'idle';
    window.SDT.UI.hideOverlay();
    window.SDT.UI.beginRoom();
    const foes = [0, 1, 2].map(() => ({ id:'bandit', name:'截道拾荒者', hp:3, atk:3 }));
    const ok = await startBattle(game, foes, { isBoss:false, layer:0, name:'战斗统一样板' });
    if (ok === false) throw new Error('战斗未进入');
    status.textContent = '生产控制器 · 三敌 · 独立内存存储';
    document.body.dataset.cohesionReady = 'true';
  } catch (error) {
    status.textContent = error.message;
    console.error('[cohesion-review]', error);
    start.disabled = false;
  }
});
