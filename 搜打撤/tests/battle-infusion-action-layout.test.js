import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));

const actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, _lastMode: null,
  showOverlay(title, html, mode) { this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {},
  act: (name, fn) => actions.set(name, fn),
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { forecastEnemyTurn } = await import('../game/src/battle/view/battle.turn-forecast.js');
const { renderCombatPiles } = await import('../game/src/battle/view/battle.piles.view.js');
const battleRuntime = await import('../game/src/battle/runtime/battle.runtime.js');
const Aim = await import('../game/src/battle/view/battle.aim.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const originalRaf = window.requestAnimationFrame;
const originalAnimate = Element.prototype.animate;
let frames, game;
const stage = () => UI.el.ovBody.querySelector('.battle-stage');
const bar = () => UI.el.ovBody.querySelector('.battle-decision[data-decision-kind="infusion"]') || stage()?.querySelector(':scope > .bt-infuse');
const snapshot = () => BattleSession.getSnapshot();
function flush() { for (let i = 0; frames.length && i < 30; i++) frames.shift()(performance.now()); }
async function settle() {
  for (let i = 0; i < 100; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!snapshot().busy && !snapshot().actionQueueLength) { flush(); return; }
  }
  throw new Error('Infusion action did not settle');
}
function start({ name = '血蝠风暴', potion = false, cardId = 'tt3sp-bloodstorm' } = {}) {
  const infusion = { ...Cards.all().find(card => card.id === cardId), name };
  game = {
    ownedCards: [
      { uid: 'infusion', card: infusion }, { uid: 'fuel-a', card: Cards.SHA }, { uid: 'fuel-b', card: Cards.SHA },
      ...(potion ? [{ uid: 'potion', card: Cards.all().find(card => card.id === 'tt3-iceheart-potion') }] : []),
    ],
    inventory: [], usedPocket: [], hp: 30, maxHp: 30, atk: 4, spellPower: 0, coins: 0,
    myClass: null, state: 'idle', battleActive: false, log: vi.fn(), heal() {}, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [0, 1].map(i => ({ id: `foe-${i}`, name: `靶子${i}`, hp: 100, atk: 1 })), { isBoss: false });
  flush();
}
beforeEach(() => {
  frames = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button && !button.closest('[inert]')) actions.get(button.dataset.act)?.(button.dataset);
  });
});
afterEach(async () => {
  Aim.cancelAim(); Aim.cancelClickSelection();
  clearFeedback();
  if (game?.battleActive) BattleSession.commands.flee();
  await settle();
  frames = []; actions.clear(); window.requestAnimationFrame = originalRaf; Element.prototype.animate = originalAnimate;
});

describe('shared infusion action bar', () => {
  it('keeps the card face usable to reduce a full selection and restores add controls', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    const before = snapshot();
    for (let i = 0; i < 2; i++) { bar().querySelector('.infusion-card-face').click(); flush(); }
    const face = bar().querySelector('.infusion-card-face');
    expect(snapshot().infusing.picked).toHaveLength(2);
    expect(face.disabled).toBe(false);
    expect(face.getAttribute('aria-pressed')).toBe('true');
    expect(face.getAttribute('aria-label')).toContain('减少一张');
    expect(bar().querySelector('.infusion-material-note').textContent).toContain('材料已齐');
    expect(bar().querySelector('.infusion-quantity [data-act="btInfuseAdd"]').title).toContain('材料已齐');
    face.focus(); face.click(); flush();
    expect(snapshot().infusing.picked).toHaveLength(1);
    expect(document.activeElement.dataset.act).toBe('btInfuseAdjust');
    expect(bar().querySelector('.infusion-quantity [data-act="btInfuseAdd"]').disabled).toBe(false);
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    expect(snapshot().energy).toBe(before.energy);
    expect(snapshot().hand).toEqual(before.hand);
    bar().querySelector('.infusion-quantity [data-act="btInfuseRemove"]').click(); flush();
    expect(bar().querySelector('.infusion-card-face').getAttribute('aria-pressed')).toBe('false');
    expect(bar().querySelector('.infusion-material').classList.contains('is-selected')).toBe(false);
  });

  it('uses the same full-selection action for number keys and card faces', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    for (let i = 0; i < 2; i++) { document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', bubbles:true})); flush(); }
    bar().querySelector('.infusion-card-face').click(); flush();
    expect(snapshot().infusing.picked).toHaveLength(1);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', bubbles:true})); flush();
    expect(snapshot().infusing.picked).toHaveLength(2);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', bubbles:true})); flush();
    expect(snapshot().infusing.picked).toHaveLength(1);
  });

  it.each(['tt7-holyheal', 'tt3sp-bloodstorm'])('describes the actual pointer and keyboard infusion entrances for %s', cardId => {
    start({ cardId });
    const card = stage().querySelector('.bt-card[data-uid="infusion"]');
    expect(card.getAttribute('aria-label')).toContain('点「注能」按钮选材料');
    expect(card.getAttribute('aria-label')).toContain('鼠标按卡面拿起，Esc 取消');
    expect(card.getAttribute('aria-label')).toContain('聚焦卡面按 Enter 选材料');
    card.querySelector('[data-act="btInfuseStart"]').click(); flush();
    expect(snapshot().infusing.uid).toBe('infusion');
    expect(snapshot().energy).toBe(9);
    expect(snapshot().hand).toContain('infusion');
  });

  it('does not consume browser shortcuts or editable text as material selection', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', [modifier]:true, bubbles:true})); flush();
      expect(snapshot().infusing.picked).toEqual([]);
    }
    const editor = document.createElement('div'); editor.contentEditable = 'true'; editor.setAttribute('contenteditable','true');
    bar().append(editor); editor.dispatchEvent(new KeyboardEvent('keydown', {key:'1', bubbles:true})); flush();
    expect(snapshot().infusing.picked).toEqual([]);
    document.dispatchEvent(new KeyboardEvent('keydown', {key:'1', bubbles:true})); flush();
    expect(snapshot().infusing.picked).toHaveLength(1);
  });

  it('keeps a usable material focus when adding the last copy disables its button', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    for (let i = 0; i < 2; i++) {
      const add = bar().querySelector('.infusion-quantity [data-act="btInfuseAdd"]'); add.focus(); add.click(); flush();
    }
    expect(snapshot().infusing.picked).toHaveLength(2);
    expect(document.activeElement.dataset.act).toBe('btInfuseInspect');
    expect(document.activeElement.matches(':disabled')).toBe(false);
    expect(snapshot().energy).toBe(9);
  });

  it('rejects covered battle actions and closing infusion actions without changing resources', () => {
    start(); const oldGrave = actions.get('btGrave');
    BattleSession.commands.beginInfusion('infusion'); flush();
    oldGrave(); flush(); expect(snapshot().graveOpen).not.toBe(true); expect(bar()).not.toBeNull();
    UI.el.overlay.classList.add('closing'); actions.get('btInfuseAdd')({i:'0'}); actions.get('btInfuseCancel')(); flush();
    expect(snapshot().infusing.picked).toEqual([]); expect(snapshot().energy).toBe(9);
    UI.el.overlay.classList.remove('closing'); actions.get('btInfuseCancel')(); flush();
    expect(snapshot().infusing).toBeFalsy();
    BattleSession.commands.beginInfusion('infusion'); flush(); expect(snapshot().infusing.picked).toEqual([]);
  });

  it('invalidates pile callbacks after returning and reopening the same pile', () => {
    start(); actions.get('btGrave')(); flush();
    const oldBack = actions.get('btGraveBack'), oldInspect = actions.get('btInspectPile');
    oldBack(); flush(); actions.get('btGrave')(); flush();
    const page = UI.el.ovBody.querySelector('.battle-decision');
    oldBack(); oldInspect({i:'0'}); flush();
    expect(UI.el.ovBody.querySelector('.battle-decision')).toBe(page);
    actions.get('btGraveBack')(); flush(); expect(UI.el.ovBody.querySelector('.battle-decision')).toBeNull();
  });

  it('disables direct play for a required infusion card, retaining selection and resources', () => {
    start({ cardId: 'tt12-raydragon', name: '龙焰射线' });
    BattleSession.commands.beginInfusion('infusion'); flush();
    const direct = bar().querySelector('[data-act="btInfuseDirect"]');
    expect(direct.disabled).toBe(true);
    expect(direct.textContent).toBe('必须注能后打出');
    expect(direct.title).toContain('未注能时没有效果');
    direct.click(); flush();
    expect(snapshot().infusing.uid).toBe('infusion');
    expect(snapshot().energy).toBe(9); expect(snapshot().hand).toContain('infusion');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    BattleSession.commands.selectInfusion('fuel-a'); flush();
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(false);
  });

  it('groups all copy separately from the three original actions and explains the real material cost', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    expect(bar().querySelector('[data-infusion-workspace]')).not.toBeNull();
    expect(bar().textContent).toContain('选择 2 张材料');
    expect(bar().textContent).toContain('已选 0/2');
    expect(bar().textContent).toContain('材料进入消耗牌堆，不自动洗回，仅由卡牌效果取回');
    expect(bar().textContent).toContain('道具、装备不可在火堆复原');
    expect(bar().querySelector('.infusion-rules').textContent).toContain('触发 2 次');
    expect([...bar().querySelectorAll('.infusion-footer button')].map(button => button.dataset.act)).toEqual(['btInfuseCancel', 'btInfuseDirect', 'btInfuseGo']);
    expect(bar().querySelector('[data-act="btInfuseDirect"]').dataset.uid).toBe('infusion');
  });

  it('puts material controls before artwork and folds duplicate source artwork across updates', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    const source = bar().querySelector('.infusion-source-details');
    expect(source.open).toBe(false);
    expect(source.querySelector('.infusion-source-card')).not.toBeNull();
    expect(bar().querySelector('.infusion-rules').closest('details')).toBeNull();
    const material = bar().querySelector('.infusion-material');
    expect([...material.children].map(node => node.className)).toEqual([
      'infusion-material-heading', 'infusion-quantity', 'infusion-card-face',
    ]);
    expect(material.querySelector('.infusion-quantity').textContent).toContain('已选 / 持有');
    source.open = true;
    material.querySelector('.infusion-quantity [data-act="btInfuseAdd"]').click(); flush();
    expect(bar().querySelector('.infusion-source-details').open).toBe(true);
    expect(bar().querySelector('.infusion-quantity b').textContent).toBe('1');
    bar().querySelector('.infusion-quantity [data-act="btInfuseRemove"]').click(); flush();
    expect(bar().querySelector('.infusion-quantity b').textContent).toBe('0');
    bar().querySelector('[data-act="btInfuseCancel"]').click(); flush();
    BattleSession.commands.beginInfusion('infusion'); flush();
    expect(bar().querySelector('.infusion-source-details').open).toBe(false);
  });

  it('updates exact material counts and preserves the disabled, cancel and reentry paths', () => {
    start(); BattleSession.commands.beginInfusion('infusion'); flush();
    const before = snapshot();
    expect(bar().querySelector('.infusion-progress').textContent).toBe('已选 0/2');
    expect(bar().querySelector('.infusion-progress small')).toBeNull();
    expect(bar().querySelector('[data-act="btInfuseGo"]').textContent).toBe('还需 2 张材料');
    expect(bar().querySelector('.infusion-destination').textContent).toContain('仅由卡牌效果取回；战后进入消耗区');
    expect(bar().querySelector('.infusion-destination').textContent).toContain('道具、装备不可在火堆复原');
    expect(bar().querySelector('.infusion-footer p').textContent).toBe('下一步选目标，有效打出后才消耗');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    BattleSession.commands.selectInfusion('fuel-a'); flush();
    expect(bar().textContent).toContain('已选 1/2');
    expect(bar().querySelector('.infusion-progress small')).toBeNull();
    expect(bar().textContent).not.toContain('还差');
    expect(bar().querySelector('[data-act="btInfuseGo"]').textContent).toBe('还需 1 张材料');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
    BattleSession.commands.selectInfusion('fuel-b'); flush();
    expect(bar().textContent).toContain('已选 2/2');
    expect(bar().querySelector('.infusion-progress small').textContent).toBe('材料已齐');
    expect(bar().querySelector('[data-act="btInfuseGo"]').textContent).toBe('确认材料 · 选择目标');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(false);
    bar().querySelector('[data-act="btInfuseCancel"]').click(); flush();
    expect(bar()).toBeNull(); expect(snapshot().infusing).toBeNull();
    expect(snapshot().energy).toBe(before.energy); expect(snapshot().hand).toEqual(before.hand);
    BattleSession.commands.beginInfusion('infusion'); flush();
    expect(bar().textContent).toContain('已选 0/2');
    expect(bar().querySelector('[data-act="btInfuseGo"]').disabled).toBe(true);
  });

  it('still dispatches direct play without consuming the selected materials', async () => {
    start(); BattleSession.commands.beginInfusion('infusion'); BattleSession.commands.selectInfusion('fuel-a'); flush();
    bar().querySelector('[data-act="btInfuseDirect"]').click(); flush();
    expect(snapshot().pendingTarget.uid).toBe('infusion'); expect(snapshot().energy).toBe(9);
    stage().querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
    expect(snapshot().infusing).toBeNull(); expect(bar()).toBeNull();
    expect(snapshot().hand).toEqual(expect.arrayContaining(['fuel-a', 'fuel-b']));
    expect(snapshot().hand).not.toContain('infusion'); expect(snapshot().energy).toBe(7);
  });

  it('still confirms the selected materials and spends them only after target confirmation', async () => {
    start(); BattleSession.commands.beginInfusion('infusion');
    BattleSession.commands.selectInfusion('fuel-a'); BattleSession.commands.selectInfusion('fuel-b'); flush();
    bar().querySelector('[data-act="btInfuseGo"]').click(); flush();
    expect(snapshot().pendingTarget.uid).toBe('infusion');
    expect(snapshot().hand).toEqual(expect.arrayContaining(['fuel-a', 'fuel-b']));
    stage().querySelector('.bt-foe[data-eidx="0"]').click(); await settle();
    expect(snapshot().hand).not.toContain('fuel-a'); expect(snapshot().hand).not.toContain('fuel-b');
    expect(snapshot().energy).toBe(7); expect(bar()).toBeNull();
    expect(game.log).toHaveBeenCalledWith(expect.stringContaining('战后进消耗区；道具、装备不可在火堆复原'), 'sys');
  });

  function prepareInfusedDrop() {
    start(); BattleSession.commands.beginInfusion('infusion');
    BattleSession.commands.selectInfusion('fuel-a'); BattleSession.commands.selectInfusion('fuel-b');
    BattleSession.commands.confirmInfusion(); flush();
    const card = stage().querySelector('.bt-card[data-uid="infusion"]');
    card.getBoundingClientRect = () => ({ left: 200, top: 800, width: 220, height: 300 });
    UI.el.overlay.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1920, height: 1080 });
    const field = document.createElement('div'); stage().append(field);
    document.elementFromPoint = () => field;
    const pointer = (type, x, y) => {
      const event = new MouseEvent(type, { button: 0, clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: 1 });
      return event;
    };
    Aim.startAim(pointer('pointerdown', 320, 950), card);
    return { field, pointer, drop: () => window.dispatchEvent(pointer('pointerup', 800, 500)) };
  }

  it('previews infused area damage without spending, then consumes materials and energy once on an empty-field drop', async () => {
    const { pointer, drop } = prepareInfusedDrop();
    window.dispatchEvent(pointer('pointermove', 800, 500)); flush();
    expect(stage().querySelectorAll('.bt-fpreview')).toHaveLength(2);
    expect(snapshot().energy).toBe(9);
    expect(snapshot().hand).toEqual(expect.arrayContaining(['infusion', 'fuel-a', 'fuel-b']));
    expect(snapshot().foes.map(foe => foe.hp)).toEqual([100, 100]);
    drop(); drop(); await settle();
    expect(snapshot().energy).toBe(7);
    expect(snapshot().hand).not.toContain('fuel-a'); expect(snapshot().hand).not.toContain('fuel-b');
    expect(snapshot().hand).not.toContain('infusion');
    expect(snapshot().foes.every(foe => foe.hp < 100)).toBe(true);
    expect(stage().querySelectorAll('.bt-fpreview')).toHaveLength(0);
  });

  it.each(['invalid', 'escape'])('keeps infused materials and energy intact on %s area-drop cancellation', async kind => {
    const { pointer, drop } = prepareInfusedDrop();
    window.dispatchEvent(pointer('pointermove', 800, 500)); flush();
    if (kind === 'invalid') { document.elementFromPoint = () => stage().querySelector('.sts-hud'); drop(); }
    else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(snapshot().energy).toBe(9);
    expect(snapshot().hand).toEqual(expect.arrayContaining(['infusion', 'fuel-a', 'fuel-b']));
    expect(snapshot().foes.map(foe => foe.hp)).toEqual([100, 100]);
    expect(stage().querySelectorAll('.bt-fpreview')).toHaveLength(0);
  });

  it.each(['energy', 'material'])('revalidates %s at final infused area drop without partial spending', async kind => {
    const { drop } = prepareInfusedDrop();
    if (kind === 'energy') battleRuntime.set$energy(0);
    else battleRuntime.set$hand(snapshot().hand.filter(uid => uid !== 'fuel-a'));
    const before = snapshot();
    drop(); await settle();
    expect(snapshot().energy).toBe(before.energy);
    expect(snapshot().hand).toEqual(before.hand);
    expect(snapshot().foes.map(foe => foe.hp)).toEqual([100, 100]);
  });

  it('escapes long card names and keeps counters correct through an ordinary rerender', () => {
    const name = '<img src=x onerror=alert(1)>很长的注能规则牌名';
    start({ name }); BattleSession.commands.beginInfusion('infusion'); flush();
    render();
    expect(bar().querySelector('.infusion-source h4').textContent).toContain(name);
    expect(bar().querySelector('.infusion-source h4 img')).toBeNull();
    expect(bar().querySelectorAll('[data-act="btInfuseCancel"]')).toHaveLength(1);
  });

  it('uses the same two groups for targeted items and preserves cancellation without spending the item', () => {
    start({ potion: true }); BattleSession.commands.usePotion('potion'); flush();
    expect(bar().classList.contains('bt-pick')).toBe(true);
    expect(bar().querySelector('.bt-infuse-copy').textContent).toContain('点击一名敌人');
    expect(bar().querySelectorAll('.bt-infuse-actions button')).toHaveLength(1);
    bar().querySelector('[data-act="btPickCancel"]').click(); flush();
    expect(snapshot().pendingItem).toBeNull(); expect(bar()).toBeNull();
    expect(game.ownedCards.some(entry => entry.uid === 'potion')).toBe(true);
  });

  it('hides the whole potion rail only during infusion and restores it after cancellation', () => {
    const selector = '#overlay .battle-stage.sts:has(>.bt-infuse:not(.bt-pick))>.bt-potions';
    const style = document.createElement('style');
    postcss.parse(readFileSync('game/css/battle-stage.css', 'utf8')).walkRules(rule => {
      if (rule.selector === selector) style.textContent = rule.toString();
    });
    expect(style.textContent).toContain('display:none'); document.head.appendChild(style);
    const potions = () => stage()?.querySelector(':scope > .bt-potions');
    try {
      start({ potion: true }); expect(window.getComputedStyle(potions()).display).not.toBe('none');
      BattleSession.commands.beginInfusion('infusion'); flush();
      expect(potions().closest('[inert]')).toBe(stage());
      bar().querySelector('[data-act="btInfuseCancel"]').click(); flush();
      expect(window.getComputedStyle(potions()).display).not.toBe('none');
      BattleSession.commands.usePotion('potion'); flush();
      expect(bar().classList.contains('bt-pick')).toBe(true);
      expect(window.getComputedStyle(potions()).display).not.toBe('none');
      bar().querySelector('[data-act="btPickCancel"]').click(); flush();
      expect(window.getComputedStyle(potions()).display).not.toBe('none');
    } finally { style.remove(); }
  });
});

describe('visible forecast uncertainty', () => {
  it('keeps the damage estimate visible and exposes excluded actions through focused details', () => {
    start();
    const before = snapshot(), expected = forecastEnemyTurn(before);
    expect(before.allies).toHaveLength(0);
    render();
    const forecast = stage().querySelector('.bt-turn-forecast');
    expect(forecast.querySelector('.bt-forecast-damage').textContent).toBe(`估算承伤 ${expected.damage}`);
    expect(forecast.querySelector('.bt-forecast-hp>b').textContent).toBe(String(expected.hpAfter));
    expect(forecast.querySelector('.bt-forecast-note')).toBeNull();
    expect(forecast.tabIndex).toBe(0);
    expect(forecast.dataset.uiTipText).toBe(expected.note); expect(forecast.classList.contains('lethal')).toBe(expected.lethal);
    expect(snapshot()).toEqual(before);
  });

  it('does not let an old lethal confirmation end the turn after returning to play', () => {
    start(); game.hp=1; render(); actions.get('btEnd')();
    const oldContinue=actions.get('btRiskContinue'); actions.get('btRiskBack')();
    const before=snapshot(); oldContinue(); flush();
    expect(snapshot().turn).toBe(before.turn); expect(snapshot().phase).toBe(before.phase);
    expect(snapshot().busy).toBe(false); expect(game.hp).toBe(1);
  });
  it('ignores detached settings inputs after returning to the battlefield', () => {
    start(); const mute=vi.fn();window.SDT.Sound.setMusicMuted=mute;
    actions.get('btSettings')();const input=document.getElementById('btSetMusic');
    actions.get('btSettingsBack')();input.checked=false;input.dispatchEvent(new Event('change',{bubbles:true}));
    expect(mute).not.toHaveBeenCalled();
    actions.get('btSettings')();const current=document.getElementById('btSetMusic');
    current.checked=false;current.dispatchEvent(new Event('change',{bubbles:true}));expect(mute).toHaveBeenCalledWith(true);
  });
  it('keeps old settings and rules returns from dismissing newer secondary pages', () => {
    start(); actions.get('btSettings')();
    const oldSettingsBack=actions.get('btSettingsBack'); oldSettingsBack();
    actions.get('btBossRules')(); const rules=UI.el.ovBody.querySelector('.battle-decision');
    oldSettingsBack(); expect(UI.el.ovBody.querySelector('.battle-decision')).toBe(rules);
    const oldRulesBack=actions.get('btRulesBack');oldRulesBack();
    BattleSession.commands.beginInfusion('infusion');flush();
    const infusion=bar();oldRulesBack();expect(bar()).toBe(infusion);expect(snapshot().infusing.uid).toBe('infusion');
  });

  it('keeps possible-death language and the same estimate in the confirmation dialog', () => {
    start(); game.hp = 1; render();
    const expected = forecastEnemyTurn(snapshot()); expect(expected.lethal).toBe(true);
    stage().querySelector('[data-act="btEnd"]').click();
    expect(UI.el.ovBody.textContent).toContain(`估算承伤 ${expected.damage}`);
    expect(UI.el.ovBody.textContent).not.toContain('预计承伤');
    expect(UI.el.ovBody.querySelector('.battle-decision-head h3').textContent).toBe('回合结束可能致死');
    expect(UI.el.ovBody.querySelector('[data-act="btRiskBack"]')).not.toBeNull();
    expect(UI.el.ovBody.querySelector('[data-act="btRiskContinue"]')).not.toBeNull();
    UI.el.ovBody.querySelector('[data-act="btRiskBack"]').click();
    expect(stage().querySelector('.bt-forecast-warning').textContent).toBe('可能致死');
    expect(game.hp).toBe(1);
  });
});

describe('infusion reading and nonshrinking CSS contract', () => {
  const css = postcss.parse(readFileSync('game/css/battle-stage.css', 'utf8'));
  function declarations(selector) {
    const found = {};
    css.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { found[decl.prop] = decl.value; }); });
    return found;
  }
  const prefix = '#overlay .battle-stage.sts';
  it('keeps the shared bar below the top header with wrapping copy and a separate action group', () => {
    expect(declarations(`${prefix}>.bt-infuse`)).toMatchObject({ top: '112px', left: '56px', right: '56px', display: 'flex', 'flex-wrap': 'wrap', 'font-size': '20px' });
    expect(declarations(`${prefix} .bt-infuse-copy`)).toMatchObject({ flex: '1 1 720px', 'min-width': '0', display: 'grid', 'overflow-wrap': 'anywhere' });
    expect(declarations(`${prefix} .bt-infuse-actions`)).toMatchObject({ flex: '0 0 auto', display: 'flex', 'flex-wrap': 'wrap', 'max-width': '100%' });
  });
  it('gives every action a readable minimum hit size and prevents vertical word wrapping or flex crushing', () => {
    expect(declarations(`${prefix} .bt-infuse-actions .mini-btn`)).toMatchObject({ flex: '0 0 auto', 'min-width': '96px', 'min-height': '48px', 'white-space': 'nowrap', margin: '0', font: '600 20px/1.3 var(--font-ui,sans-serif)' });
    expect(declarations(`${prefix} .bt-infuse-actions .mini-btn:disabled`)).toMatchObject({ opacity: '1', cursor: 'default' });
  });
  it('keeps the forecast limitation readable in the existing auto-sized tactics column', () => {
    expect(declarations(`${prefix} .bt-forecast-note`)).toMatchObject({ display: 'block', 'font-size': '18px', 'font-weight': '400', 'line-height': '1.4' });
    expect(declarations(`${prefix} .sts-tactics`)).toMatchObject({ 'grid-row': '3', 'align-self': 'end' });
  });
});


describe('discovery source presentation and restoration copy', () => {
  const showDiscover = (options, deckBottomUids = null) => render({ ...snapshot(), discovering: {
    options, n: 1, act: null, ...(deckBottomUids ? { deckBottom: true, deckBottomUids } : {}),
  } });
  it('projects both owned and temporary deck-bottom UIDs without changing cards or discovery state', () => {
    start(); battleRuntime.set$shaTransform('不朽斩');
    battleRuntime.granted.push({ uid: 'source-temp', card: { ...Cards.SHA } });
    const options = [{ ...Cards.SHA }, { ...Cards.SHA }];
    const beforeOptions = JSON.stringify(options), beforeOwned = JSON.stringify(game.ownedCards), before = snapshot();
    showDiscover(options, ['fuel-a', 'source-temp']);
    const candidates = [...UI.el.ovBody.querySelectorAll('[data-act="btDiscover"]')];
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(candidate.getAttribute('aria-label')).toContain('不朽斩');
      expect(candidate.textContent).toContain('不朽斩');
      expect(candidate.textContent).not.toContain('初始攻击');
    }
    expect(candidates[0].getAttribute('aria-label')).toContain('随身牌来源');
    expect(candidates[1].getAttribute('aria-label')).toContain('本场临时牌来源');
    expect(UI.el.ovBody.textContent).toContain('来自当前牌库底 · 选中牌以本场副本入手。使用或消耗后进入消耗牌堆');
    expect(JSON.stringify(options)).toBe(beforeOptions);
    expect(JSON.stringify(game.ownedCards)).toBe(beforeOwned);
    expect(snapshot()).toEqual(before);
  });
  it('shows pouch origin and immediate casting without calling it a temporary reward', () => {
    start();
    const state = { ...snapshot(), discovering: { options:[{ ...Cards.SHA }], n:1, act:'pouch', pouchUid:'pouch', pred:null } };
    const before = JSON.stringify(state);
    render(state);
    expect(UI.el.ovBody.textContent).toContain('取出后立即施放，无需另付该法术费用');
    expect(UI.el.ovBody.textContent).toContain('背包原牌随之消耗');
    expect(UI.el.ovBody.textContent).not.toContain('战后消散');
    expect(JSON.stringify(state)).toBe(before);
  });
  it.each(['play', 'potion'])('keeps random free-cast discovery distinct from pouch origin: %s', act => {
    start();
    render({ ...snapshot(), discovering: { options:[{ ...Cards.SHA }], n:1, act } });
    expect(UI.el.ovBody.textContent).toContain('选择 1 张免费施放');
    expect(UI.el.ovBody.textContent).toContain('本场生成。使用或消耗后进入消耗牌堆，不自动洗回，仅由卡牌效果取回');
    expect(UI.el.ovBody.textContent).not.toContain('背包原牌随之消耗');
  });
  it('keeps the random-discovery temporary-card copy and supplied faces unchanged', () => {
    start(); battleRuntime.set$shaTransform('不朽斩');
    showDiscover([{ ...Cards.SHA }]);
    const candidate = UI.el.ovBody.querySelector('[data-act="btDiscover"]');
    expect(candidate.getAttribute('aria-label')).toContain('初始攻击');
    expect(candidate.title).not.toContain('来源');
    expect(UI.el.ovBody.textContent).toContain('本场生成。使用或消耗后进入消耗牌堆，不自动洗回，仅由卡牌效果取回');
    expect(UI.el.ovBody.textContent).not.toContain('来自当前牌库底');
  });
  it('falls back to the supplied face without inventing ownership for an unresolved source UID', () => {
    start(); showDiscover([{ ...Cards.SHA }], ['unknown-source']);
    const candidate = UI.el.ovBody.querySelector('[data-act="btDiscover"]');
    expect(candidate.textContent).toContain('初始攻击');
    expect(candidate.title).not.toContain('随身牌来源');
    expect(candidate.title).not.toContain('本场临时牌来源');
  });
  it('states the item and equipment exceptions on the ordinary-battle grave badge', () => {
    const piles = renderCombatPiles({ mode: 'normal', drawCount: [], discardCount: [], graveCount: ['spent'],
      pileTip: () => '', cardBackHTML: '', escAttr: value => value });
    const host = document.createElement('div'); host.innerHTML = piles.rest;
    expect(host.querySelector('.bt-pile:last-child').title).toBe('消耗牌堆：（不自动洗回，仅由卡牌效果取回；点击查看）');
  });
});

describe('focused infusion workspace layout contract', () => {
  const css = postcss.parse(readFileSync('game/css/battle-infusion.css', 'utf8'));
  function declarations(selector) {
    const found = {};
    css.walkRules(rule => { if (rule.selector === selector) rule.walkDecls(decl => { found[decl.prop] = decl.value; }); });
    return found;
  }
  it('keeps source rules beside an independently scrolling material grid', () => {
    expect(declarations('body #overlay [data-infusion-workspace]')).toMatchObject({ display:'grid', 'grid-template-columns':'300px minmax(0,1fr)', 'min-height':'0' });
    expect(declarations('body #overlay .infusion-materials')).toMatchObject({ overflow:'auto', 'min-height':'0', display:'grid', 'overscroll-behavior':'contain' });
    expect(declarations('body #overlay .infusion-selection-summary')).toMatchObject({ display:'none' });
    expect(declarations('body #overlay .infusion-card-face .hs-card')).toMatchObject({ 'font-size':'13px' });
  });
  it('keeps quantity buttons distinct and selection visibly outlined', () => {
    expect(declarations('body #overlay .infusion-quantity>button')).toMatchObject({ width:'48px', height:'46px', flex:'none' });
    expect(declarations('body #overlay .infusion-material.is-selected')).toMatchObject({ 'border-color':'#c3e3e5' });
    expect(declarations('body #overlay .infusion-card-face .hs-card')).toMatchObject({ 'pointer-events':'none' });
  });
});
