import { esc } from '../core/shared.js';
import { MAP, game, newRun, saveGame, scaledEnemy } from './game.session.js';
import { buildEncounter, openChestsOnCell, openShop } from './game.run.scenes.js';
import { openAltarRitual, openFireRest } from './game.run.altar.js';
import { runEventDeck } from './game.run.flow.js';
import { captureBattleContext, startBattle } from '../battle/battle-loader.js';
import { agentTabHTML, bindAgentTab, keysTabHTML, bindKeysTab } from '../agent/agent.console.js';
import { dataPanelHTML, bindDataActions } from '../agent/agent.data.js';
import { cardPageOpen, setCardPageOpen } from '../hub/game.cardslib.common.js';

const SDT = window.SDT;
const UI = window.SDT.UI;

async function devForceBattle(isBoss) {
  if (game.battleActive || game.state === 'modal') { UI.log('[[icon:lock]] 当前状态无法直接开战，先回到棋盘', 'warn'); return; }
  if (!game.ownedCards?.length) { UI.log('[[icon:cards]] 还没有随身卡牌，先开一局再试', 'warn'); return; }
  const currentContext = captureBattleContext(game);
  if (isBoss) {
    const b = MAP.altar.bosses[0];
    const started = await startBattle(game, scaledEnemy(b), { isBoss: true, returnTo: 'altar', name: b.name });
    if (started === false || !currentContext()) return false;
    // 2026-10-03 老板（SYS-11）：强制开战入干预履历（boot 调试按钮/验收场景共用本入口）
    SDT.Agent?.recorder?.noteIntervention?.('debug-command', `强制进入BOSS战:${b.name}`);
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
  const started = await startBattle(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
    risk: list.risk, strategy: list.strategy });
  if (started === false || !currentContext()) return false;
  SDT.Agent?.recorder?.noteIntervention?.('debug-command', '强制进入遭遇战');   // SYS-11 干预履历
  UI.log('[[icon:tools]] 开发者：强制进入遭遇战', 'sys');
}

const DEV_NODE_LABEL = {
  battle: '遭遇战', boss: 'BOSS 战', shop: '商店', 'chest-small': '小宝箱', 'chest-medium': '中宝箱',
  'chest-large': '大宝箱', event: '事件', fire: '火堆', altar: '祭坛',
};


async function devEnsureRun() {
  if (game.battleActive) { UI.log('[[icon:lock]] 战斗进行中——先打完或退出战斗再跳节点', 'warn'); return false; }
  if (game.runActive) return true;
  if (await newRun('standard') === false) return false;
  document.getElementById('title').hidden = true;
  // 节点测试绕过了正常的选人流程；补齐一个真实角色，避免战斗 HUD 落入“未选择人物”。
  game.characterId = 'heixiang';
  game.myClass = '战士';
  UI.log('[[icon:tools]] 开发者：已开一局<b>测试局</b>（不占档位、不写存档）', 'sys');
  return true;
}

async function devJumpNode(kind) {
  const label = DEV_NODE_LABEL[kind];
  if (!label) { UI.log(`[[icon:question]] 未知节点类型：${esc(kind)}`, 'warn'); return; }
  if (!await devEnsureRun()) return;
  if (!UI.el.overlay.hidden) UI.hideOverlay();
  game.state = 'idle';
  UI.beginRoom();
  // 2026-10-03 老板（SYS-11）：调试跳节点=场景注入，入干预履历；战斗/BOSS 类由
  // devForceBattle 自报（debug-command），此处不双计。
  if (kind !== 'battle' && kind !== 'boss') {
    SDT.Agent?.recorder?.noteIntervention?.('scene-inject', `跳转节点:${label}`);
  }
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

let activeConsole = null;
function openDevConsole(originCheckpoint) {
  const overlay = UI.el.overlay, body = UI.el.ovBody;
  if (activeConsole?.isCurrent()) { activeConsole.close(); return; }
  activeConsole?.dispose();
  const visible = !overlay.hidden && !overlay.classList.contains('closing') && !overlay.dataset.uiClosing;
  // 冷入口在请求开始时已记录来源；直接场景调用仍同步捕获自己的来源。
  const origin = originCheckpoint || {
    visible, state:game.state, battleActive:game.battleActive, cardPageOpen,
    html:visible ? body.innerHTML : '', nodes:visible ? [...body.childNodes] : [],
    title:UI.el.ovTitle?.innerHTML || '', mode:UI._lastMode,
    acts:{ ...UI._acts }, input:UI._inputHandler, hover:UI._hoverHandler,
    roomActive:UI._roomActive, bagClose:UI._bagCloseHook,
    returnFocus:UI._overlayReturnFocus, focus:document.activeElement,
  };
  setCardPageOpen(false);
  let rendered = false;
  const session = {
    isCurrent:() => activeConsole === session && !overlay.hidden && !!body.querySelector('#devConsole'),
    dispose() {
      observer.disconnect();
      overlay.removeEventListener('click', backdropClose, true);
      if (activeConsole === session) activeConsole = null;
    },
    close() {
      if (!session.isCurrent()) return false;
      session.dispose();
      setCardPageOpen(origin.cardPageOpen);
      UI._acts = {}; UI._inputHandler = null; UI._hoverHandler = null;
      // The battle model is live; redraw it instead of restoring stale unit DOM.
      if (origin.battleActive && game.battleActive && SDT.Battle?.commands?.refreshView) {
        SDT.Battle.commands.refreshView();
      } else if (origin.visible) {
        UI._roomActive = origin.roomActive;
        UI.showOverlay(origin.title, origin.html, origin.mode);
        // Reuse real nodes so direct listeners, selected controls and reward closures survive.
        body.replaceChildren(...origin.nodes);
        UI._acts = origin.acts; UI._inputHandler = origin.input; UI._hoverHandler = origin.hover;
        UI._bagCloseHook = origin.bagClose; UI._overlayReturnFocus = origin.returnFocus;
        if (origin.state !== 'moving') game.state = origin.state;
        if (origin.focus?.isConnected) origin.focus.focus?.({ preventScroll:true });
        body.firstElementChild?.dispatchEvent(new CustomEvent('sdt-dev-console-return'));
      } else {
        UI.hideOverlay();
        if (game.state === 'modal') game.state = origin.state === 'modal' ? 'idle' : origin.state;
      }
      UI.refresh(game);
      return true;
    },
  };
  const backdropClose = event => {
    if (event.target !== overlay || !session.isCurrent()) return;
    event.preventDefault(); event.stopImmediatePropagation(); session.close();
  };
  const observer = new MutationObserver(() => {
    if (rendered && activeConsole === session && !body.querySelector('#devConsole')) session.dispose();
  });
  activeConsole = session;
  overlay.addEventListener('click', backdropClose, true);
  observer.observe(body, { childList:true });
  // 控制台升级为全局开发枢纽（四页签：调试/Agent/数据/快捷键）；
  // 「调试」页签的写操作仍只在对局/战斗中生效（各动作自带守卫）。
  let tab = 'debug';
  const query = { q: '' };
  const hitCards = () => {
    const q = query.q.trim().toLowerCase();
    return q ? SDT.Cards.all().filter(card => (card.name || '').toLowerCase().includes(q)).slice(0, 8) : [];
  };
  const devBattle = () => !!(game.battleActive && SDT.Battle?.commands?.dev);
  const routeInfo = () => {
    const plan=game.routePlan || /** @type {Partial<import('../hub/game.store.types.js').RoutePlan>} */ ({});
    return `mapSeed=${esc(game.mapSeed ?? '—')} · snapshot=${esc(game.routeVersion ? 'v2' : 'v1')} · routeVersion=${esc(game.routeVersion ?? 'none')} · status=${esc(plan.status ?? 'legacy')} · fallbackReason=${esc(plan.fallbackReason ?? 'none')}`;
  };
  const hitsHTML = () => {
    const hits = hitCards();
    return hits.length ? hits.map((card, i) => `<button class="hs-btn sm devc-hit" data-act="devcCard" data-i="${i}">【${esc(card.name)}】· ${esc(card.type)} · ${esc(card.rarity || '')}</button>`).join('') : '<span class="dim">输入卡名后点结果发卡（同名堆叠规则照常生效）</span>';
  };
  const renderHits = () => {
    const box = document.getElementById('devcHits');
    if (box) box.innerHTML = hitsHTML();
  };
  const notInRun = () => !game.runActive && !game.battleActive;
  const debugBody = () => `
    <div class="devc-grid">
      <p class="ov-note">资源修改和战斗外发卡写入本局存档；战斗内发卡为临时卡，战后消散。执行记录写入左侧日志。</p>
      ${notInRun() ? '<p class="ov-note">资源/发卡/战斗调试仅在对局或战斗中生效——先开一局再回来。</p>' : ''}
      <section class="devc-sec"><b class="devc-h">资源 <span class="devc-scope">写入本局存档</span></b><div class="devc-btns">
        <button class="hs-btn" data-act="devcCoin" data-n="50">+50 币</button><button class="hs-btn" data-act="devcCoin" data-n="200">+200 币</button>
        <button class="hs-btn" data-act="devcHeal" data-n="10">回 10 血</button><button class="hs-btn" data-act="devcHeal" data-n="999">回满血</button>
      </div></section>
      <section class="devc-sec"><b class="devc-h">指定卡牌 <span class="devc-scope">${devBattle() ? '当前战斗临时卡；道具进入快捷栏' : '发牌写入本局'}</span></b>
        <input id="devcSearch" class="clib-search" placeholder="输入卡名搜索，如：江湖救急" value="${esc(query.q)}">
        <div class="devc-hits" id="devcHits">${hitsHTML()}</div>
      </section>
      ${devBattle() ? `<section class="devc-sec"><b class="devc-h">战斗调试 <span class="devc-scope">仅当前战斗</span></b><div class="devc-btns">
        <button class="hs-btn" data-act="devcB" data-k="energy">能量回满</button><button class="hs-btn" data-act="devcB" data-k="draw" data-n="2">抽 2 张</button>
        <button class="hs-btn" data-act="devcB" data-k="heal">生命回满</button><button class="hs-btn" data-act="devcB" data-k="freezeAll">冰冻敌人×2回合</button>
        <button class="hs-btn" data-act="devcB" data-k="damageAll" data-n="10">全体 10 伤</button><button class="hs-btn" data-act="devcB" data-k="win" title="调试辅助：跳过正常战斗结算，不计入真实战斗胜率结论">直接胜利<span class="devc-aux">辅助</span></button>
      </div>
      <p class="ov-note">「直接胜利」是调试辅助结果，不能当自然推进看待。</p></section>` : ''}
      <p class="ov-note" data-route-debug>${routeInfo()}</p>
    </div>`;
  const TABS = [
    { id: 'debug', name: '调试' },
    { id: 'agent', name: 'Agent' },
    { id: 'data', name: '数据' },
    { id: 'keys', name: '快捷键' },
  ];
  const tabsHTML = () => `<div class="devc-tabs">${TABS.map(t =>
    `<button class="hs-btn sm${t.id === tab ? ' ok' : ''}" data-act="devcTab" data-tab="${t.id}">${t.name}</button>`).join('')}</div>`;
  const bodyOf = () => tab === 'debug' ? debugBody()
    : tab === 'agent' ? agentTabHTML()
    : tab === 'data' ? `<div class="devc-shell-note">开发壳视图：数据与「跑局数据」页<b>同源</b>（同一记录与统计规则），本页签只多这层开发入口标注。</div>${dataPanelHTML()}`
    : keysTabHTML();
  const bindTab = () => {
    if (tab === 'debug') {
      // 2026-10-03 老板（SYS-11）：控制台资源/发卡改写入干预履历（dev-console）；战斗调试
      // devcB 不在此记——SDT.Battle.commands.dev 漏斗自报（debug-command），避免双计。
      UI.act('devcCoin', data => { if (!session.isCurrent() || notInRun()) return; const n = +data.n || 50; game.coins += n; SDT.Agent?.recorder?.noteIntervention?.('dev-console', `加币:${n}`); UI.log(`[[icon:coin]] 开发者：+${n} 币（现有 ${game.coins}）`, 'coin'); saveGameDev(); render(); });
      UI.act('devcHeal', data => { if (!session.isCurrent() || notInRun()) return; const n = +data.n || 10; game.hp = n >= 999 ? game.maxHp : Math.min(game.maxHp, game.hp + n); SDT.Agent?.recorder?.noteIntervention?.('dev-console', n >= 999 ? '回满血' : `回血:${n}`); UI.log(`[[icon:heart]] 开发者：生命 ${game.hp}/${game.maxHp}`, 'ok'); saveGameDev(); render(); });
      UI.act('devcCard', data => {
        if (!session.isCurrent() || notInRun()) return;
        const card = hitCards()[+data.i];
        if (!card) return;
        if (devBattle()) {
          if (SDT.Battle.commands.dev('card', card.id)) session.close();
          return;
        }
        if (game.grantCard?.(card)) {
          SDT.Agent?.recorder?.noteIntervention?.('dev-console', `发卡:${card.name}`);
          saveGameDev();
        }
        render();
      });
      UI.act('devcB', data => { if (!session.isCurrent() || !devBattle()) return; SDT.Battle.commands.dev(data.k, data.n); setTimeout(() => { if (session.isCurrent()) render(); }, 80); });
    } else if (tab === 'agent') {
      bindAgentTab(render);
    } else if (tab === 'data') {
      bindDataActions(render);
    } else {
      bindKeysTab(render);
    }
  };
  const inputHandler = event => {
    if (event.target.id !== 'devcSearch') return;
    query.q = event.target.value;
    // 只重绘结果列表，绝不重建 overlay：输入法组合期间拆掉宿主 input 会掐断
    // 组合输入，中文打不进去（同卡牌库页搜索「只重绘卡格保持焦点」的口径）。
    renderHits();
  };
  const render = () => {
    if (activeConsole !== session || (rendered && !session.isCurrent())) return;
    UI._acts = {};
    UI.showOverlay('[[icon:tools]] 开发者控制台', `
      <section id="devConsole" data-dev-console>
      <div class="devc-topbar">
        <span class="devc-badge">开发工具 · 操作可能影响存档</span>
        <span class="devc-badge sub">Ctrl+L 开关</span>
      </div>
      ${tabsHTML()}
      ${bodyOf()}
      <div class="ov-btns"><button class="ov-btn ok" data-act="devcClose">关闭（Esc / Ctrl+L）</button></div></section>`, 'discover');
    rendered = true;
    UI._inputHandler = tab === 'debug' ? inputHandler : null;
    UI._hoverHandler = null;
    UI.act('devcClose', session.close);
    UI.act('devcTab', d => { if (TABS.some(t => t.id === d.tab)) { tab = d.tab; render(); } });
    bindTab();
  };
  render();
}

export { devForceBattle, devJumpNode, openDevConsole };
