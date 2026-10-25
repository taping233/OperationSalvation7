import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../game/src/battle/runtime/battle.clock.js', () => ({ schedulePresentationMs:() => () => {} }));
import { createBattleStageView } from '../game/src/battle/view/battle.stage-view.js';
import { ownsHandPageFeedback, updateHandAcquisitionFeedback } from '../game/src/battle/view/battle.effect-feedback.js';

const rich = text => text.replace(/\[\[icon:[^\]]+\]\]/g, '');
let UI, presenter;
function view({ lethal = false, active = false, page = false } = {}) {
  return {
    token:7, assetKey:'battle-normal', isBoss:false, phase:'player', combatState:{tone:'self',label:'你的行动'}, turn:1,
    energy:3, maxEnergy:3, energyArt:'/energy.webp', mode:'normal', locked:false, potions:[], potionsHTML:'<div class="bt-potions"><div class="bt-potion" role="button" data-act="btPotion" data-uid="potion">药水</div></div>',
    drawHTML:'<button class="bt-pile" data-act="btDeck"><b>12</b></button>',
    restHTML:'<button class="bt-pile" data-act="btGrave"><b>2</b></button>',
    skillHTML:`<span class="battle-skill-help"><button class="bt-slam-btn${active ? ' active' : ''}" data-act="btSlam" data-skill-state="${active ? 'targeting' : 'ready'}"><img src="/skill.webp" alt=""><span>3</span></button></span>`,
    pageHTML:page ? '<div class="bt-hand-page has-more" role="group" aria-label="当前第 1 栏"><span>第 1/2 栏</span><div class="battle-hand-page-nav"><button data-act="btHandPrev" data-hand-page-step="-1" disabled>上一栏</button><button data-act="btHandNext" data-hand-page-step="1">下一栏</button></div></div>' : '',
    forecastHTML:`<p class="bt-turn-forecast${lethal ? ' lethal' : ''}" aria-live="polite"><span>余 <b>${lethal ? 0 : 40}</b> 生命</span>${lethal ? '<span class="bt-forecast-warning">可能致死</span>' : ''}</p>`,
  };
}
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="body"></div></div>';
  UI = {
    el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('body') }, _lastMode:'battle',
    showOverlay(_title, html, mode) { this.el.ovBody.innerHTML = rich(html); this._lastMode = mode; },
  };
  presenter = createBattleStageView({ UI, rich, ownsHandPageFeedback });
});

afterEach(() => document.dispatchEvent(new Event('sdt-overlay-close')));

describe('allocation-light stage validation', () => {
  it('uses previous desired class ownership after a whole component is externally cloned', () => {
    const {owner} = presenter.show(view({lethal:true}));
    const old = owner.stage.querySelector('.bt-turn-forecast'), clone = old.cloneNode(true);
    clone.classList.add('fx-pulse'); old.replaceWith(clone);
    presenter.show(view());
    expect(owner.stage.querySelector('.bt-turn-forecast')).toBe(clone);
    expect(clone.classList.contains('lethal')).toBe(false);
    expect(clone.classList.contains('fx-pulse')).toBe(true);
    expect(clone.querySelector('b').textContent).toBe('40');
    expect(clone.querySelector('.bt-forecast-warning')).toBeNull();
  });
  it('carries cold class ownership down sibling traversal after a descendant clone', () => {
    const {owner} = presenter.show(view({active:true}));
    const old = owner.stage.querySelector('.bt-slam-btn'), clone = old.cloneNode(true);
    clone.classList.add('fx-hit'); old.replaceWith(clone);
    presenter.show(view());
    expect(owner.stage.querySelector('.bt-slam-btn')).toBe(clone);
    expect(clone.classList.contains('active')).toBe(false);
    expect(clone.classList.contains('fx-hit')).toBe(true);
    expect(clone.dataset.skillState).toBe('ready');
  });
  it('validates attributes and all siblings synchronously after external edits', () => {
    const input = view({page:true}), {owner} = presenter.show(input);
    const forecast = owner.stage.querySelector('.bt-turn-forecast');
    forecast.setAttribute('aria-live','off'); forecast.setAttribute('disabled','');
    forecast.insertAdjacentHTML('afterbegin','<i>wrong</i><em>extra</em>');
    forecast.insertAdjacentHTML('beforeend','<aside>trailing</aside><aside>trailing</aside>');
    const energy = owner.stage.querySelector('.sts-energy'); energy.setAttribute('role','button');
    presenter.show(input);
    expect(forecast.getAttribute('aria-live')).toBe('polite');
    expect(forecast.hasAttribute('disabled')).toBe(false);
    expect(forecast.children).toHaveLength(1);
    expect(forecast.firstElementChild.tagName).toBe('SPAN');
    expect(forecast.textContent).toBe('余 40 生命');
    expect(energy.getAttribute('role')).toBe('group');
  });
  it('repairs injected controlled states without erasing runtime effects or confirmation ownership', () => {
    const input = view(), {owner} = presenter.show(input);
    const cases = [['.bt-potion','off'],['.bt-potion','need-target'],['.bt-slam-btn','active'],
      ['.bt-turn-forecast','lethal'],['.sts-phase-dot','foe']];
    for (const [selector, state] of cases) owner.stage.querySelector(selector).classList.add(state, 'fx-hit');
    expect(owner.stage.querySelector('.sts-options,[data-act="btFlee"]')).toBeNull();
    presenter.show(input);
    for (const [selector, state] of cases) {
      const node = owner.stage.querySelector(selector);
      expect(node.classList.contains(state), `${selector} removes ${state}`).toBe(false);
      expect(node.classList.contains('fx-hit')).toBe(true);
    }
    expect(owner.stage.querySelector('.sts-options,[data-act="btFlee"]')).toBeNull();
  });

  it('retains only the real feedback-owned badge through warm updates, new arrivals and paging', () => {
    const input = view({page:true}), {owner} = presenter.show(input), stage = owner.stage;
    const visible = document.createElement('div'), records = [{slot:visible, group:{uids:['visible']}}];
    const snapshot = {battleToken:7, hand:['visible','hidden-a']};
    const feedback = events => updateHandAcquisitionFeedback(stage, snapshot, records, new Map(), events);
    feedback([{kind:'draw', uid:'hidden-a', battleToken:7}]);
    const page = stage.querySelector('.bt-hand-page'), badge = page.querySelector('.bt-hand-page-new');
    const icon = badge.querySelector('svg'), label = page.getAttribute('aria-label');
    expect(ownsHandPageFeedback(page, badge)).toBe(true);
    stage._battleToken = 8; expect(ownsHandPageFeedback(page, badge)).toBe(false); stage._battleToken = 7;
    UI.el.overlay.hidden = true; expect(ownsHandPageFeedback(page, badge)).toBe(false); UI.el.overlay.hidden = false;
    // Neither an identical clone nor a matching node in a different component owns the exemption.
    const fake = badge.cloneNode(true), misplaced = badge.cloneNode(true);
    page.append(fake); stage.querySelector('.sts-energy').append(misplaced);
    presenter.show(input);
    expect(page.querySelector('.bt-hand-page-new')).toBe(badge);
    expect(badge.querySelector('svg')).toBe(icon); expect(badge.getAttribute('role')).toBe('status');
    expect(fake.isConnected).toBe(false); expect(misplaced.isConnected).toBe(false);
    expect(page.getAttribute('aria-label')).toBe(label);
    feedback([]); expect(page.querySelector('.bt-hand-page-new')).toBe(badge);

    snapshot.hand.push('hidden-b');
    presenter.show(input); feedback([{kind:'draw',uid:'hidden-b',battleToken:7}]);
    expect(page.querySelector('.bt-hand-page-new')).toBe(badge); expect(badge.textContent).toBe('新增 2');
    presenter.show({...input,pageHTML:input.pageHTML.replace('第 1/2', '第 2/2')});
    records[0].group.uids = ['hidden-a']; feedback([]);
    expect(page.querySelector('.bt-hand-page-new')).toBe(badge); expect(badge.textContent).toBe('新增 1');
    expect(page.textContent).toContain('第 2/2 栏'); expect(badge.querySelector('svg')).toBe(icon);
    records[0].group.uids = ['hidden-a','hidden-b']; feedback([]);
    expect(badge.isConnected).toBe(false); expect(page.getAttribute('aria-label')).not.toContain('新增');
    presenter.show(input); expect(page.querySelector('.bt-hand-page-new')).toBeNull();
  });

});
