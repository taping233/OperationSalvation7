// 2026-10-21 老板实测反馈 12 条第 4 条（C组）：注能界面相同卡牌只展示一张
// （可标注数量），且手中全部卡牌仍然可达。契约：每叠同名候选只展示首张未选
// 副本的槽位；其余副本保留 DOM 与 uid（数字键/点击轮转/撤回路径不变），
// 代表副本被选走后下一张副本自动接替可见；已选区仍逐张展示（既有语义）。
import { beforeEach, describe, expect, it } from 'vitest';
import { renderInfusionSelection } from '../game/src/battle/view/battle.infusion-view.js';

const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const makeCard = (name, extra = {}) => ({ id: `id-${name}`, name, type: '道具', cost: 1, desc: '', ...extra });

let UI, actions, allCards;

function findCard(uid) {
  return allCards[uid] ? { uid, card: allCards[uid] } : null;
}
function slotOf(uid) { return document.querySelector(`.sts-hand > .bt-slot[data-uid="${uid}"]`); }
function cardOf(uid) { return document.querySelector(`.sts-hand .bt-card[data-uid="${uid}"]`); }

function mountHand(uids) {
  const hand = document.querySelector('.sts-hand');
  hand.innerHTML = uids.map(uid =>
    `<div class="bt-slot" data-act="btPlay" data-uid="${uid}"><div class="bt-card" data-uid="${uid}"><span class="hs-card">${allCards[uid]?.name || ''}</span></div></div>`).join('');
}
function render({ hand, picked = [], need = 2 }) {
  const infusion = { uid: 'src', card: makeCard('主卡'), need, picked, selectionId: 's1', fuelUids: [] };
  const snapshot = { battleToken: 'bt-1', hand, infusing: infusion, phase: 'player', busy: false, foes: [{ hp: 10, dead: false }] };
  renderInfusionSelection({
    UI,
    snapshot,
    getSnapshot: () => snapshot,
    findCard,
    infusionFuelReason: () => false,
    targetSide: () => 'enemy',
    commands: {},
    cardHTML: card => `<i>${card.name}</i>`,
    focusedHandUid: null,
  });
}

beforeEach(() => {
  actions = new Map();
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><div class="battle-stage sts"><div class="sts-hand"></div></div></div></div>';
  window.SDT = { Icons: { rich } };
  allCards = {
    src: makeCard('主卡'),
    'fuel-a': makeCard('火箭燃料'),
    'fuel-b': makeCard('火箭燃料'),
    'fuel-c': makeCard('火箭燃料'),
    other: makeCard('绷带'),
  };
  UI = {
    el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') },
    act: (name, fn) => actions.set(name, fn),
    showCardZoom() {},
  };
  // 与实页一致的委托：点手牌槽位按 data-act 分发（隐藏副本在 jsdom 中仍可查可点，
  // 真实浏览器里由代表卡轮转完成同叠逐张选择）。
  UI.el.ovBody.addEventListener('click', event => {
    const button = event.target.closest('[data-act]');
    if (button) actions.get(button.dataset.act)?.(button.dataset);
  });
});

describe('注能候选同名收敛（反馈 #4）', () => {
  it('同名三张只展示首张，代表卡标注 ×3，其余副本留在 DOM 但隐藏', () => {
    const hand = ['src', 'fuel-a', 'fuel-b', 'fuel-c', 'other'];
    mountHand(hand);
    render({ hand });

    expect(slotOf('fuel-a').classList.contains('infusion-dup')).toBe(false);
    expect(slotOf('fuel-a').hasAttribute('aria-hidden')).toBe(false);
    expect(slotOf('fuel-b').classList.contains('infusion-dup')).toBe(true);
    expect(slotOf('fuel-b').getAttribute('aria-hidden')).toBe('true');
    expect(slotOf('fuel-c').classList.contains('infusion-dup')).toBe(true);
    // 隐藏副本仍在 DOM：uid、数字键与点击路径不变（jsdom 可查可点）。
    expect(slotOf('fuel-b')).not.toBeNull();
    expect(cardOf('fuel-b').dataset.uid).toBe('fuel-b');
    // 异名卡不受影响。
    expect(slotOf('other').classList.contains('infusion-dup')).toBe(false);
    // 数量标注只在代表卡上。
    expect(cardOf('fuel-a').querySelector('.infusion-stack-count')?.textContent).toBe('×3');
    expect(cardOf('fuel-b').querySelector('.infusion-stack-count')).toBeNull();
    // 主卡（self 组）候选槽被既有逻辑移除。
    expect(slotOf('src')).toBeNull();
    // 代表卡 aria 维持同名进度语义。
    expect(cardOf('fuel-a').getAttribute('aria-label')).toContain('第1/3张');
    expect(cardOf('fuel-a').getAttribute('aria-label')).toContain('同名已选0张');
  });

  it('选走代表副本后，下一张副本自动接替为可见代表，整叠逐张可达', () => {
    const hand = ['src', 'fuel-a', 'fuel-b', 'other'];
    mountHand(hand);
    render({ hand, picked: ['fuel-a'] });

    // 已选副本按既有规则移出候选区。
    expect(slotOf('fuel-a')).toBeNull();
    // 接替代表：不再隐藏，×2 标注随之迁移。
    expect(slotOf('fuel-b').classList.contains('infusion-dup')).toBe(false);
    expect(slotOf('fuel-b').hasAttribute('aria-hidden')).toBe(false);
    expect(cardOf('fuel-b').querySelector('.infusion-stack-count')?.textContent).toBe('×2');
    // aria 反映已选 1 张。
    expect(cardOf('fuel-b').getAttribute('aria-label')).toContain('同名已选1张');
    // 点击接替代表仍发它自己的 uid（选中/撤回走既有命令）。
    const clicked = [];
    actions.set('btPlay', data => clicked.push(data.uid));
    cardOf('fuel-b').closest('[data-act]').click();
    expect(clicked).toEqual(['fuel-b']);
  });

  it('全部副本已选时叠内不留幽灵槽位', () => {
    const hand = ['src', 'fuel-a', 'fuel-b'];
    mountHand(hand);
    render({ hand, picked: ['fuel-a', 'fuel-b'] });
    expect(slotOf('fuel-a')).toBeNull();
    expect(slotOf('fuel-b')).toBeNull();
  });
});
