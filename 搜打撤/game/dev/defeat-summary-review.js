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
let progress={cls:'侠客',lv:3,xp:10,need:130};
sdtDefine('Meta', { classSummary:() => [progress], checkUnlocks(){}, classLv:() => progress.lv, perkText:() => '' });
sdtDefine('Base', { slot:1, carriedPet:() => ({name:'测试伙伴'}) });
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
const { createDeathSettlement } = await import('/src/run/game.session.death.js');
const controls=document.querySelector('#fixtureControls');
const status=document.querySelector('#fixtureStatus');
let generation=0;
async function start(scene) {
  if (!['zero','long','saved'].includes(scene)) return;
  progress={cls:'侠客',lv:3,xp:10,need:130};
  const catalog=SDT.Cards.all();
  const pool=scene === 'long' ? catalog.filter(card => ['传说','史诗'].includes(card.rarity)) : catalog;
  const selected=pool.slice(0,18);
  const game={
    runActive:true,state:'idle',hp:0,maxHp:30,myClass:'侠客',surrenderedRun:false,
    inventory:scene === 'saved' ? [{name:'口粮',count:2,value:3}] : [],
    ownedCards:selected.map((card,index) => ({uid:`review-${index}`,card,safe:scene === 'saved' && index < 2})),
    usedPocket:[{count:37}],turn:12,elapsed:120,terminalPending:null,pos:{x:0,y:0},
  };
  // Deliberately synthetic in-memory commit: no production command backend is imported.
  const terminalCommands={
    createAttempt:async () => ({ok:true,attempt:{testData:true}}),
    commitAttempt:async () => {
      progress={...progress,xp:15};
      return {ok:true,receipt:{output:{levelsGained:0}}};
    },
  };
  const {doDeath}=createDeathSettlement({
    game, terminalCommands,
    runtime:{openBaseHub:destination => {status.textContent=`测试按钮事件：${destination}（仅记录，不跳转、不存档）`;}},
    getActiveSlot:() => 1,getTerminalGeneration:() => generation,nextTerminalGeneration:() => ++generation,
    cardStacks:() => game.ownedCards.filter(entry => entry.safe).map(entry => ({card:entry.card,count:1})),
    safeUsed:() => scene === 'saved' ? 2 : 0,safeCap:() => 2,pearlBoxId:'review-no-pearl',
  });
  await doDeath({battleIsBoss:true,battleSummary:{round:6,remainingFoes:[{name:'变异巢母',hp:17,maxHp:45}],damageTaken:[{source:'变异巢母',damage:43},{source:'中毒',damage:3}]}});
  status.textContent=`测试数据：${scene} · +5 XP · 两按钮只记录事件`;
}
controls.querySelectorAll('[data-scene]').forEach(button => {
  button.disabled=false;
  button.addEventListener('click', () => start(button.dataset.scene));
});
status.textContent='点击场景开始；仅页面内存，不读取或写入真实档案。';
function sizeControls() { controls.style.zoom=String(1/SDT.UiScale.scale()); }
sizeControls();
window.addEventListener('resize',sizeControls);
