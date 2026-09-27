// E2-only host: real catalog, rules, session, view and commands; no persistence adapter.
import SDT, { sdtDefine } from './core/sdt-facade.js';
import { RULES } from './core/rules.js';
const el = id => document.getElementById(id);
const overlay = el('overlay'), ovBody = el('ovBody'), ovTitle = el('ovTitle');
const state = el('qaState'), evidence = el('qaEvidence'), logEl = el('log');
const storageSnapshot = () => JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)]));
const baseline = storageSnapshot();
const digest = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');
const baselineHash = await digest(baseline);
const actions = new Map(), records = [];
const inputEvidence = document.createElement('output');
inputEvidence.id = 'qaInput'; document.querySelector('.qa-bar').append(inputEvidence);
document.addEventListener('click', event => {
  const target = event.target.closest('[data-act],button');
  inputEvidence.textContent = `最近点击=${target?.dataset.act || target?.textContent || event.target.tagName}；坐标=${event.clientX},${event.clientY}`;
}, true);
const rich = s => String(s).replace(/\[\[icon:[^\]]+\]\]/g, '<span aria-hidden="true">◆</span>');
const disabled = new Set(['btBag', 'btSettings']);
let fixture = null, sample = null, session = null;
const UI = {
  el: { overlay, ovBody, ovTitle }, _lastMode: 'battle',
  showOverlay(title, html, mode) {
    ovTitle.innerHTML = rich(title || ''); ovBody.innerHTML = rich(html);
    for (const node of ovBody.querySelectorAll('[data-act]')) if (disabled.has(node.dataset.act)) node.setAttribute('disabled', '');
    overlay.hidden = false; this._lastMode = mode;
  },
  hideOverlay() { overlay.hidden = true; },
  hideTooltip() { el('qaTip').hidden = true; },
  showTooltip(_x, _y, title, lines) { el('qaTip').textContent = [title, ...(lines || [])].join('\n'); el('qaTip').hidden = false; },
  refresh() { inspect('render'); },
  log(message) { logEl.insertAdjacentHTML('beforeend', `<div>${rich(message)}</div>`); },
  act(name, fn) { actions.set(name, disabled.has(name) ? () => {} : fn); },
};
sdtDefine('UI', UI);
sdtDefine('Icons', { img: () => '<span aria-hidden="true">◆</span>', rich, TYPE_ART: {} });
sdtDefine('Sound', { music() {}, sfx() {}, setDucked() {}, setBoss() {}, musicMuted: false, sfxMuted: false });
sdtDefine('Art', { has: () => false, monsterArt: () => '<span>敌</span>', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] });
sdtDefine('Meta', { track() {} });
const map = await fetch(new URL('../data/map.json', import.meta.url)).then(r => r.json());
sdtDefine('MAP', { ...map, rules: RULES });
// Compose existing pure card slices; never import the cards.js storage adapter.
const { dataSlice } = await import('./cards/cards.data.js');
const { rulesSlice } = await import('./cards/cards.rules.js');
const { cardHTML, cardBackHTML } = await import('./cards/cards.view.js');
const { DATA } = await import('./core/data-loader.js');
const catalog = new Map(Object.entries(dataSlice).filter(([key]) => /^TABLETOP\d*$/.test(key))
  .flatMap(([, cards]) => cards).filter(c => c?.id).map(c => [c.id, c]));
for (const c of DATA.cardsSync.cards) catalog.set(c.id, { ...catalog.get(c.id), ...c });
for (const id of DATA.cardsSync.retire) catalog.delete(id);
const cards = structuredClone([...catalog.values()]);
sdtDefine('Cards', { ...dataSlice, ...rulesSlice, all: () => cards, cardHTML, cardBackHTML,
  CARD_BACKS: [{ id: 'classic', name: '行囊粗布', icon: 'cards', from: '默认卡背' }] });
const { BattleSession } = await import('./battle/battle.core.js');
session = BattleSession;
await import('./battle/battle.view.js');
function inspect(reason) {
  if (!session) return;
  const s = session.getSnapshot(), now = storageSnapshot();
  const card = c => c ? { id: c.id, name: c.name, frozen: Object.isFrozen(c), rulesFrozen: c.rules ? Object.isFrozen(c.rules) : null } : null;
  const record = {
    at: new Date().toISOString(), reason, sample, mode: s.mode, phase: s.phase, energy: s.energy,
    battleToken: s.battleToken, busy: s.busy, actionQueueLength: s.actionQueueLength,
    renderedFoes: Array.from(ovBody.querySelectorAll('.bt-foe')).map(node => ({ index: node.dataset.eidx, name: node.querySelector('.sts-headrow')?.textContent, hp: node.querySelector('.sts-hp > span')?.textContent })),
    foes: s.foes?.map(f => ({ id: f.id, name: f.name, hp: f.hp })), hand: s.hand,
    deck: s.deckSelection ? { selected: s.deckSelection.selected, need: s.deckSelection.need, cards: s.deckSelection.cards.map(e => card(e.card)) } : null,
    infusing: s.infusing ? { card: card(s.infusing.card), picked: s.infusing.picked } : null,
    handSelecting: s.handSelecting ? { act: s.handSelecting.act, n: s.handSelecting.n, srcCard: card(s.handSelecting.srcCard), payment: card(s.handSelecting.payment?.card) } : null,
    storageEqual: now === baseline, storageKeyCount: JSON.parse(now).length, baselineSha256: baselineHash,
  };
  records.push(record); evidence.textContent = JSON.stringify(records, null, 2);
  state.textContent = `样本=${sample || '无'}；能量=${s.energy ?? '—'}；存储快照=${record.storageEqual ? '未变化' : '变化'}；记录 ${records.length} 条（不代表期间无写入尝试）`;
  digest(now).then(hash => { record.currentSha256 = hash; evidence.textContent = JSON.stringify(records, null, 2); });
}
ovBody.addEventListener('click', event => {
  const node = event.target.closest('[data-act]');
  if (node && !node.hasAttribute('disabled') && actions.has(node.dataset.act)) {
    actions.get(node.dataset.act)({ ...node.dataset }); inspect(`click:${node.dataset.act}`);
  }
});
function start(kind) {
  if (fixture?.battleActive) session.commands.flee();
  actions.clear(); logEl.innerHTML = ''; sample = kind;
  const ids = {
    boss: ['tt3sp-silverthorn', 'tt3-frostfall', 'tt7-thundergrudge', 'starter-attack', 'starter-attack'],
    infuse: ['tt3sp-silverthorn', 'starter-attack', 'starter-attack'],
    select: ['tt3-frostfall', 'starter-attack', 'starter-attack'],
    payment: ['tt7-thundergrudge', 'starter-attack', 'starter-attack'],
    boiler: ['tt3eq-boiler', 'starter-attack', 'starter-attack'],
  }[kind];
  const ownedCards = ids.map((id, i) => {
    const source = SDT.Cards.all().find(c => c.id === id);
    if (!source) throw new Error(`Missing catalog card: ${id}`);
    return { uid: `e2-${i}`, card: structuredClone(source) };
  });
  fixture = {
    ownedCards, inventory: [], hp: 50, maxHp: 50, atk: 4, spellPower: 0, coins: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(String(message)); UI.log(message); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {},
    onBattleEnd() { inspect('battle-end'); },
  };
  sdtDefine('game', fixture);
  // The same existing high-HP enemy keeps selection effects from ending a sample early.
  const foe = map.altar.bosses.find(f => f.id === 'boss_general');
  session.start(fixture, [{ ...foe }], { isBoss: kind === 'boss', risk: 'E2 内存样本', devSample: true });
  inspect(`start:${kind}`);
}
document.querySelectorAll('[data-sample]').forEach(button => button.addEventListener('click', () => start(button.dataset.sample)));
el('qaReset').addEventListener('click', () => { session.commands.flee(); overlay.hidden = true; fixture = null; inspect('exit'); });
el('qaInspect').addEventListener('click', () => inspect('manual-evidence'));
inspect('ready');
