// Reuse the existing isolated review's exact stylesheet order, without running
// its scripts or copying its large page template. Storage isolation is in HTML.
const styleResponse = await fetch('/dev/hand-draw-review.html');
if (!styleResponse.ok) throw new Error('隔离回归样式清单加载失败');
const styleSource = new DOMParser().parseFromString(await styleResponse.text(), 'text/html');
await Promise.all([...styleSource.querySelectorAll('link[rel="stylesheet"], style')].map(source => {
  const style = document.importNode(source, true);
  const loaded = style.tagName === 'LINK' ? new Promise((resolve, reject) => {
    style.onload = resolve;
    style.onerror = () => reject(new Error(`样式加载失败：${style.getAttribute('href')}`));
  }) : Promise.resolve();
  document.head.append(style);
  return loaded;
}));
const { default:SDT, sdtDefine } = await import('/src/core/sdt-facade.js');
await import('/src/core/icons-bitmap.js');
await import('/src/core/art.js');
await import('/src/ui/ui-scale.js');
sdtDefine('Sound', { sfx(){}, music(){}, setDucked(){}, setBoss(){} });
sdtDefine('Meta', { track(){} });
sdtDefine('Motion', { reduceMotion:() => false });
sdtDefine('MAP', { rules:{ battleEnergy:2, battleHandMax:10, bossDeckSize:15, starterSha:0, battleStartDraw:1, battleTurnDraw:1 }, items:{} });
const { UI } = await import('/src/ui/ui.js');
UI.el = { overlay:document.querySelector('#overlay'), ovBody:document.querySelector('#ovBody'), ovTitle:document.querySelector('#ovTitle') };
UI.refresh = () => {};
UI.log = () => {};
UI.el.ovBody.addEventListener('click', event => {
  const button = event.target.closest('[data-act]');
  if (button && !button.disabled && !button.closest('[inert]')) UI._acts[button.dataset.act]?.(button.dataset);
});
await import('/src/cards/cards.js');
SDT.Cards.ensureSha(); SDT.Cards.ensureStarters(); SDT.Cards.ensureTabletop(); SDT.Cards.ensureDmgTypes(); SDT.Cards.ensureEffectFields();
const { BattleSession } = await import('/src/battle/core/battle.core.js');
await import('/src/battle/view/battle.view.js');
const controls = document.querySelector('#fixtureControls');
const status = document.querySelector('#fixtureStatus');
const output = document.querySelector('#fixtureEvidence');
let game = null, input = '', lastLog = '';
function renderStatus() {
  if (!game) return;
  const snapshot = BattleSession.getSnapshot();
  output.textContent = `能量 ${snapshot.energy}/${snapshot.maxEnergy} · 扰敌在手 ${snapshot.hand.includes('review-provoke')} · 阶段 ${snapshot.phase}\n`
    + `敌人索引/HP：${snapshot.foes.map((foe, index) => `${index}:${foe.hp}${foe.dead ? '(死亡)' : ''}`).join(' / ')} · 排除实例 ${snapshot.pendingTarget?.excludedTargetIndex ?? '无'}\n`
    + `目标提示：${snapshot.pendingTarget?.hint || '无'}\n最近输入：${input || '无'}\n战斗日志：${lastLog || '无'}`;
}
function start(count) {
  if (![2, 3].includes(count)) return;
  input = ''; lastLog = '';
  game = {
    ownedCards:[{ uid:'review-provoke', card:SDT.Cards.all().findLast(card => card.id === 'tt7-provoke') }],
    inventory:[], usedPocket:[], hp:30, maxHp:30, atk:4, spellPower:0, coins:0, myClass:null,
    state:'idle', battleActive:false, heal(){}, addItem(){}, onBattleEnd(){},
    log(message){ lastLog = String(message).replace(/<[^>]+>/g, ''); },
  };
  sdtDefine('game', game);
  BattleSession.start(game, Array.from({ length:count }, () => ({ id:'grass_el', name:'滋生异变体', hp:12, atk:5, behavior:'curse' })), { isBoss:false });
  status.textContent = `${count}只同种敌人 · 手动点扰敌，再点敌人 · Esc取消 · 不连接存档`;
  renderStatus();
}
controls.querySelectorAll('[data-count]').forEach(button => {
  button.disabled = false;
  button.addEventListener('click', () => start(Number(button.dataset.count)));
});
for (const type of ['pointerdown', 'click']) UI.el.ovBody.addEventListener(type, event => {
  input = `${event.type} trusted=${event.isTrusted} enemy=${event.target.closest('[data-eidx]')?.dataset.eidx ?? '-'} card=${event.target.closest('[data-uid]')?.dataset.uid ?? '-'}`;
}, true);
status.textContent = '点击按钮开始；未自动开战或选择目标。';
function sizeControls() { controls.style.zoom = String(1 / SDT.UiScale.scale()); }
sizeControls();
window.addEventListener('resize', sizeControls);
const timer = setInterval(renderStatus, 200);
window.addEventListener('pagehide', () => clearInterval(timer), { once:true });
