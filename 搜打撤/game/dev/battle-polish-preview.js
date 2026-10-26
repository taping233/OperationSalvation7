// Isolated visual candidate. All combat and card rendering use production code.
const controls = document.createElement('div');
document.body.classList.add('polish-preview');
controls.className = 'polish-preview-tools';
controls.innerHTML = '<span>战斗精修 · 样板</span><button id="polishStart">进入样板</button><button id="polishCompare" disabled>查看原版</button><output aria-live="polite">内存测试局</output>';
document.body.append(controls);
const start = controls.querySelector('#polishStart');
const compare = controls.querySelector('#polishCompare');
const output = controls.querySelector('output');
let busy = false;
compare.onclick = () => {
  const polished = document.body.classList.toggle('polish-preview');
  compare.textContent = polished ? '查看原版' : '查看精修';
};
start.onclick = async () => {
  if (busy) return;
  busy = true;
  start.disabled = true;
  try {
    const { game, newRun } = await import('/src/run/game.session.js');
    const { startBattle } = await import('/src/battle/battle-loader.js');
    if (window.SDT.Base?.slot != null) throw new Error('样板禁止使用玩家档位');
    if (await newRun('standard', [], {skipClassChoice:true}) === false) throw new Error('未建立测试局');
    document.getElementById('title').hidden = true;
    game.characterId = 'heixiang';
    game.myClass = '战士';
    game.state = 'idle';
    window.SDT.UI.hideOverlay();
    window.SDT.UI.beginRoom();
    const cards = window.SDT.Cards;
    const library = cards.all();
    const sampleCards = ['tt7-bulwark', 'tt2-block'].map(id => library.find(card => card.id === id));
    if (sampleCards.some(card => !card)) throw new Error('样板卡牌缺失');
    game.ownedCards = [cards.SHA, ...sampleCards, cards.SHA].map((card, i) => ({
      uid: `polish-${i}`, card: { ...card },
    }));
    await startBattle(game, [
      { id: 'bandit', name: '截道拾荒者', hp: 28, atk: 3 },
      { id: 'bandit', name: '截道拾荒者', hp: 24, atk: 4 },
    ], { isBoss: false, layer: 0 });
    document.getElementById('overlay').append(controls);
    controls.removeAttribute('inert');
    controls.removeAttribute('aria-hidden');
    start.hidden = true;
    compare.disabled = false;
    output.textContent = '可出牌 · 可结束回合';
  } catch (error) {
    output.textContent = error.message;
    start.disabled = false;
    console.error(error);
  } finally { busy = false; }
};
