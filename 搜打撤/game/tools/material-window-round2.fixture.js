// Only scenario setup is exposed here. All payment/selection/targeting uses the
// game's normal visible controls after the real startBattle entry below.
const fixtureUrl = '/tools/material-window-round2.html';
const scenes = [
  ['payment', '快意恩仇 · 支付2张', '快意恩仇＋3张初始攻击；拖向敌人后选材料、确认，检查仅扣2张且伤害只结算一次。'],
  ['copies', '快意恩仇 · 多副本', '2张快意恩仇＋4张初始攻击；检查副本切换、材料逐张选取及取消。'],
  ['consume', '铸甲 · 主效果消耗', '铸甲＋2张矿工炸药＋1张初始攻击；对自己使用铸甲，选择1张装备并确认。'],
  ['infusion', '血蝠风暴 · 正常注能', '血蝠风暴＋3张初始攻击；正常注能选择与确认应保持可用。'],
];
const panel = document.createElement('aside');
panel.id = 'material-fixture-controls';
panel.style.cssText = 'position:fixed;top:4px;left:8px;right:8px;z-index:2147483646;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 10px;background:#091722ed;color:#eaf6ff;border:1px solid #6c96aa;border-radius:5px;font:12px/1.4 sans-serif';
panel.innerHTML = '<strong>内存存储隔离 · 真实入口</strong>' + scenes.map(([id, name]) =>
  `<a href="${fixtureUrl}?scene=${id}" style="padding:5px 9px;border:1px solid #80b4cc;color:#eaf6ff;text-decoration:none;border-radius:4px">${name}</a>`).join('')
  + '<button type="button" id="material-fixture-hide">隐藏面板</button><span id="material-fixture-status" role="status">等待真实入口就绪…</span>';
document.body.appendChild(panel);
document.getElementById('material-fixture-hide').onclick = () => { panel.hidden = true; panel.style.display = 'none'; };
const status = document.getElementById('material-fixture-status');
const scene = new URLSearchParams(location.search).get('scene');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function prepare() {
  if (document.documentElement.dataset.materialFixtureStorage !== 'memory') throw new Error('存储隔离未安装，停止准备');
  await import('/src/main.js');
  let SDT;
  for (let attempt = 0; attempt < 300; attempt++) {
    SDT = window.SDT;
    if (SDT?.game?.state === 'title' && document.getElementById('title')?.dataset.controlsBound === 'true') break;
    if (attempt === 299) throw new Error('真实入口30秒内未就绪');
    await wait(100);
  }
  if (!scene) { status.textContent = '入口已就绪；点击场景按钮开始（刷新即清空测试存储）。'; return; }
  if (!scenes.some(([id]) => id === scene)) throw new Error('未知场景');
  const { game, setLobby } = await import('/src/run/game.session.js');
  const { startBattle } = await import('/src/battle/battle-loader.js');
  const card = id => {
    const found = SDT.Cards.all().find(candidate => candidate.id === id);
    if (!found) throw new Error(`缺少原生卡 ${id}`);
    return structuredClone(found);
  };
  const grudge = card('tt7-thundergrudge'), infusion = card('tt3sp-bloodstorm');
  const sha = structuredClone(SDT.Cards.SHA);
  let sources, fuel = scene === 'copies' ? 4 : 3;
  if (scene === 'copies') sources = [grudge, structuredClone(grudge)];
  else if (scene === 'infusion') sources = [infusion];
  else if (scene === 'consume') {
    sources = [card('tt2-turtlearmor'), card('tt3-sapper-bomb'), card('tt3-sapper-bomb')]; fuel = 1;
  } else sources = [grudge];
  const ownedCards = [...sources, ...Array.from({ length: fuel }, () => structuredClone(sha))]
    .map((snapshot, index) => ({ uid: `material-${scene}-${index}`, card: snapshot }));
  Object.assign(game, { ownedCards, inventory: [], usedPocket: [], cardBox: [], cardOrder: [],
    runActive: true, nestActive: false, battleActive: false, state: 'idle', hp: 30, maxHp: 30, atk: 4,
    spellPower: 0, coins: 0, fragments: 0, myClass: '侠客', seed: 1024, layerIdx: 0,
    discoveredPairs: new Set(), pendingExtraction: null, extractionPending: false, terminalPending: false });
  SDT.UI.hideScreen(document.getElementById('title'));
  setLobby(false);
  const started = await startBattle(game, [{ id: 'material-training', name: '材料复核木桩', hp: 200, atk: 1 }],
    { isBoss: false, name: '材料选择复核' });
  if (started === false) throw new Error('真实战斗入口未启动');
  status.textContent = scenes.find(([id]) => id === scene)[2];
}

prepare().catch(error => { status.textContent = `场景未准备：${error.message}`; console.error('[material-window-round2]', error); });
