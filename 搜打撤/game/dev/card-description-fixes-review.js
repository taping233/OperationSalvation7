// 仅构造内存入口；战斗、道具、装备与动画均由现行生产代码执行。
import '../src/main.js';
import { game, newUid, _set_active_slot, setLobby } from '../src/run/game.session.js';
import { startBattle } from '../src/battle/battle-loader.js';

const SDT = window.SDT;
const UI = SDT.UI;
_set_active_slot(null);
SDT.Sound.setMuted?.(true);

const controls = document.createElement('nav');
controls.setAttribute('aria-label', '卡面修复隔离验收');
controls.style.cssText = 'position:fixed;left:8px;top:8px;z-index:100000;display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;background:#14212bea;color:#fff;font:13px sans-serif;border:1px solid #607887';
controls.innerHTML = '<strong>隔离构造场景，不读写玩家档位</strong><button type="button" data-review-start>构造普通战</button><button type="button" data-review-record disabled>记录当前状态</button><span data-review-status>仅构造一次；刷新页面可重置。</span>';
document.body.append(controls);

const output = document.createElement('details');
output.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100000;width:440px;max-width:calc(100vw - 16px);color:#fff;background:#14212bea;border:1px solid #607887;font:12px monospace';
const summary = document.createElement('summary');
summary.textContent = '当前状态记录（仅输出到此页面）';
const pre = document.createElement('pre');
pre.style.cssText = 'margin:8px;max-height:220px;overflow:auto;white-space:pre-wrap;user-select:text';
pre.textContent = '尚未记录。';
output.append(summary, pre);
document.body.append(output);

const startButton = controls.querySelector('[data-review-start]');
const recordButton = controls.querySelector('[data-review-record]');
const status = controls.querySelector('[data-review-status]');
let battleApi = null;

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  try {
    // 不调用 newRun / Base.prepareDeparture / Base.save，不装载任何玩家档位。
    // 只从现行公共卡库复制卡牌；不改牌面、rules、费用或伤害结果。
    const catalog = SDT.Cards.all();
    const ids = ['tt3-mind-potion', 'tt3-python-potion', 'tt3sp-doom',
      'tt3-fly-arrowhawk', 'tt2-frostsword', 'tt3-blood-arrow', 'tt3-frost-slash',
      ...Array(5).fill('starter-attack')];
    const ownedCards = ids.map(id => {
      const card = catalog.find(candidate => candidate.id === id);
      if (!card) throw new Error(`当前卡库缺少 ${id}`);
      return { uid: newUid(), card: structuredClone(card), safe: false };
    });
    _set_active_slot(null);
    SDT.Sound.setMuted?.(true);
    setLobby(false);
    const title = document.getElementById('title');
    if (title) title.hidden = true;
    UI.hideOverlay({ immediate: true });
    Object.assign(game, {
      state: 'idle', runActive: false, battleActive: false,
      hp: 100, maxHp: 100, atk: 5, spellPower: 2, coins: 0,
      characterId: 'heixiang', myClass: '战士',
      ownedCards, inventory: [], usedPocket: [], cardOrder: [], eventLog: [],
      nestActive: false, nestRunes: [], nestEquipped: [],
    });
    const targets = [
      { id: 'infantry', name: '首脑训练靶', hp: 200, atk: 1, affix: 'grow', affixName: '军威' },
      { id: 'infantry', name: '普通训练靶甲', hp: 200, atk: 1 },
      { id: 'infantry', name: '普通训练靶乙', hp: 200, atk: 1 },
      { id: 'infantry', name: '普通训练靶丙', hp: 200, atk: 1 },
      { id: 'infantry', name: '攻击6训练靶', hp: 200, atk: 6 },
    ];
    const started = await startBattle(game, targets, { isBoss: false, devSample: true });
    if (started === false) throw new Error('生产战斗入口未启动；刷新页面后重试。');
    battleApi = await import('../src/battle/core/battle.core.js');
    // The production modal makes unrelated body children inert. Keep the
    // developer recorder inside its active surface without changing game input.
    UI.el.overlay.append(controls, output);
    for (const node of [controls, output]) {
      node.inert = false;
      node.removeAttribute('aria-hidden');
    }
    recordButton.disabled = false;
    status.textContent = '已构造普通战。血箭/寒霜斩可通过真实出牌施加流血/冰冻；刷新可重置。';
  } catch (error) {
    status.textContent = `构造失败：${error.message}（刷新页面重试）`;
  }
});

recordButton.addEventListener('click', () => {
  if (!battleApi) return;
  const s = battleApi.BattleSession.getSnapshot();
  const cardName = uid => battleApi.viewApi.findCard(uid)?.card?.name || '未知卡';
  const projection = {
    mode: s.mode, turn: s.turn, phase: s.phase, busy: s.busy, actionQueueLength: s.actionQueueLength,
    player: { hp: s.player?.hp, maxHp: s.player?.maxHp, atk: s.player?.atk, spellPower: s.player?.spellPower,
      defense: s.pdef, status: s.pstat?.status },
    energy: s.energy, maxEnergy: s.maxEnergy,
    hand: s.hand.map(cardName), consumed: s.consumed.map(cardName), grave: s.grave.map(cardName),
    bag: (s.potionBar || []).map(item => ({ name: item.name, count: item.count, usable: item.usable, why: item.why })),
    equipped: s.equipped.map(item => ({ name: item.name, used: item.used })),
    foes: s.foes.map((foe, index) => ({ index, name: foe.name, hp: foe.hp, maxHp: foe.maxHp,
      atk: foe.atk, affix: foe.affix, dead: foe.dead, status: foe.status, defense: foe.defense })),
  };
  pre.textContent = JSON.stringify(projection, null, 2);
  output.open = true;
});
