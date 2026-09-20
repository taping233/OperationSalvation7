import { esc } from './shared.js';
import { MAP, game, newRun, saveGame, scaledEnemy } from './game.session.js';
import { buildEncounter, openChestsOnCell, openShop } from './game.run.scenes.js';
import { openAltarRitual, openFireRest } from './game.run.altar.js';
import { runEventDeck } from './game.run.flow.js';
import { startBattle } from './battle-loader.js';

const SDT = window.SDT;
const UI = window.SDT.UI;

async function devForceBattle(isBoss) {
  if (game.battleActive || game.state === 'modal') { UI.log('[[icon:lock]] 当前状态无法直接开战，先回到棋盘', 'warn'); return; }
  if (!game.ownedCards?.length) { UI.log('[[icon:cards]] 还没有随身卡牌，先开一局再试', 'warn'); return; }
  if (isBoss) {
    const b = MAP.altar.bosses[0];
    await startBattle(game, scaledEnemy(b), { isBoss: true, returnTo: 'altar', name: b.name });
    UI.log(`[[icon:tools]] 开发者：强制进入 BOSS 战【${esc(b.name)}】`, 'sys');
    const snap = SDT.Battle.getSnapshot();
    if (snap.deckSelection) {
      const cap = Math.min(snap.deckSelection.need, snap.deckSelection.cards.length);
      while (SDT.Battle.getSnapshot().deckSelection.selected.length < cap) {
        const current = SDT.Battle.getSnapshot().deckSelection;
        const next = current.cards.find(card => !current.selected.includes(card.uid));
        if (!next) break;
        SDT.Battle.commands.selectDeckCard(next.uid);
      }
      SDT.Battle.commands.confirmDeck();
    }
    return;
  }
  const list = buildEncounter(game.layerIdx);
  await startBattle(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
    risk: list.risk, strategy: list.strategy });
  UI.log('[[icon:tools]] 开发者：强制进入遭遇战', 'sys');
}

const DEV_NODE_LABEL = {
  battle: '遭遇战', boss: 'BOSS 战', shop: '商店', 'chest-small': '小宝箱', 'chest-medium': '中宝箱',
  'chest-large': '大宝箱', event: '事件', fire: '火堆', altar: '祭坛',
};

function devEnsureRun() {
  if (game.battleActive) { UI.log('[[icon:lock]] 战斗进行中——先打完或退出战斗再跳节点', 'warn'); return false; }
  if (game.runActive) return true;
  document.getElementById('title').hidden = true;
  newRun('standard');
  // 节点测试绕过了正常的选人流程；补齐一个真实角色，避免战斗 HUD 落入“未选择人物”。
  game.characterId = 'heixiang';
  game.myClass = '战士';
  UI.log('[[icon:tools]] 开发者：已开一局<b>测试局</b>（不占档位、不写存档）', 'sys');
  return true;
}

function devJumpNode(kind) {
  const label = DEV_NODE_LABEL[kind];
  if (!label) { UI.log(`[[icon:question]] 未知节点类型：${esc(kind)}`, 'warn'); return; }
  if (!devEnsureRun()) return;
  if (!UI.el.overlay.hidden) UI.hideOverlay();
  game.state = 'idle';
  UI.beginRoom();
  UI.log(`[[icon:tools]] 开发者：跳转节点【<b>${label}</b>】`, 'sys');
  switch (kind) {
    case 'battle': devForceBattle(false); break;
    case 'boss': devForceBattle(true); break;
    case 'shop': openShop('dev'); break;
    case 'event': runEventDeck(); break;
    case 'fire': openFireRest(); break;
    case 'altar': openAltarRitual(); break;
    default: openChestsOnCell([{ kind: kind.replace('chest-', '') }], `开发者测试：${label}`); break;
  }
}

function saveGameDev() {
  if (game.runActive && typeof game.persistSave === 'function') game.persistSave();
  else saveGame();
}

function openDevConsole() {
  if (!game.runActive && !game.battleActive) { UI.log('[[icon:lock]] 开发者控制台需要在对局/战斗中使用', 'warn'); return; }
  const query = { q: '' };
  const hitCards = () => {
    const q = query.q.trim().toLowerCase();
    return q ? SDT.Cards.all().filter(card => (card.name || '').toLowerCase().includes(q)).slice(0, 8) : [];
  };
  const devBattle = () => !!(game.battleActive && SDT.Battle?.commands?.dev);
  const render = () => {
    const hits = hitCards();
    UI.showOverlay('[[icon:tools]] 开发者控制台', `
      <p class="ov-note">调试用面板（Ctrl+L 开关）——修改会立即写入本局存档，别在正经挑战里用。</p>
      <div class="devc-grid">
        <section class="devc-sec"><b class="devc-h">资源</b><div class="devc-row">
          <button class="hs-btn" data-act="devcCoin" data-n="50">+50 币</button><button class="hs-btn" data-act="devcCoin" data-n="200">+200 币</button>
          <button class="hs-btn" data-act="devcHeal" data-n="10">回 10 血</button><button class="hs-btn" data-act="devcHeal" data-n="999">回满血</button>
        </div></section>
        <section class="devc-sec"><b class="devc-h">指定卡牌</b>
          <input id="devcSearch" class="clib-search" placeholder="输入卡名搜索，如：江湖救急" value="${esc(query.q)}">
          <div class="devc-hits">${hits.length ? hits.map((card, i) => `<button class="hs-btn sm devc-hit" data-act="devcCard" data-i="${i}">【${esc(card.name)}】· ${esc(card.type)} · ${esc(card.rarity || '')}</button>`).join('') : '<span class="dim">输入卡名后点结果发卡（同名堆叠规则照常生效）</span>'}</div>
        </section>
        ${devBattle() ? `<section class="devc-sec"><b class="devc-h">战斗调试</b><div class="devc-row">
          <button class="hs-btn" data-act="devcB" data-k="energy">能量回满</button><button class="hs-btn" data-act="devcB" data-k="draw" data-n="2">抽 2 张</button>
          <button class="hs-btn" data-act="devcB" data-k="heal">生命回满</button><button class="hs-btn" data-act="devcB" data-k="freezeAll">冰冻敌人×2回合</button>
          <button class="hs-btn" data-act="devcB" data-k="damageAll" data-n="10">全体 10 伤</button><button class="hs-btn" data-act="devcB" data-k="win">直接胜利</button>
        </div></section>` : ''}
      </div><div class="ov-btns"><button class="ov-btn ok" data-act="devcClose">关闭（Esc / Ctrl+L）</button></div>`, 'discover');
    UI._inputHandler = event => {
      if (event.target.id !== 'devcSearch') return;
      query.q = event.target.value;
      render();
      const input = document.getElementById('devcSearch');
      if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
    };
  };
  UI.act('devcCoin', data => { const n = +data.n || 50; game.coins += n; UI.log(`[[icon:coin]] 开发者：+${n} 币（现有 ${game.coins}）`, 'coin'); saveGameDev(); render(); });
  UI.act('devcHeal', data => { const n = +data.n || 10; game.hp = n >= 999 ? game.maxHp : Math.min(game.maxHp, game.hp + n); UI.log(`[[icon:heart]] 开发者：生命 ${game.hp}/${game.maxHp}`, 'ok'); saveGameDev(); render(); });
  UI.act('devcCard', data => { const card = hitCards()[+data.i]; if (card && game.grantCard) game.grantCard(card); render(); });
  UI.act('devcB', data => { SDT.Battle.commands.dev(data.k, data.n); setTimeout(render, 80); });
  UI.act('devcClose', () => {
    // 战斗本身也承载在 overlay 中；关闭调试面板时必须重绘战斗，不能按普通弹窗隐藏。
    if (game.battleActive && SDT.Battle?.commands?.refreshView) SDT.Battle.commands.refreshView();
    else { UI.hideOverlay(); UI.refresh(game); }
  });
  render();
}

export { devForceBattle, devJumpNode, openDevConsole };
