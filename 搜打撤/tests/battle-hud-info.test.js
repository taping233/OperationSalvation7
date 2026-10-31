import { describe, expect, it } from 'vitest';
import { playerCombatStatsHTML, turnForecastHTML } from '../game/src/ui/battle-hud-info.js';
import { renderCombatPiles } from '../game/src/battle/view/battle.piles.view.js';
import { battlePileBodyHTML } from '../game/src/battle/view/battle.decision-content.js';
import guide from '../game/data/beginner-guide.json';

function surface(html) { const host = document.createElement('div'); host.innerHTML = html; return host; }

describe('战斗信息减负与普通牌库', () => {
  it.each(['normal', 'boss'])('%s只保留一个消耗牌堆入口和不自动洗回说明', mode => {
    const piles = renderCombatPiles({ mode, drawCount:['draw'], graveCount:['played', 'consumed'], pileTip:pile => `${pile.length}张`, cardBackHTML:'back', escAttr:x => x });
    const host = surface(piles.rest);
    expect(host.querySelectorAll('.bt-pile')).toHaveLength(1);
    expect(host.querySelector('[data-act=btGrave] b').textContent).toBe('2');
    expect(host.textContent).toContain('消耗牌堆');
    expect(piles.rest).toContain('[[icon:consumed-pile]]');
    expect(host.querySelector('.bt-pilecard').textContent).toBe('back');
    expect(host.textContent).not.toMatch(/弃牌|墓地/);
    expect(host.querySelector('[data-act=btGrave]').getAttribute('aria-label')).toContain('不自动洗回，仅由卡牌效果取回');
    expect(host.querySelector('[title], [data-ui-tip], [data-ui-tip-title], [data-ui-tip-text]')).toBeNull();
  });
  it('攻法伤保留强化后的实际总值，来源转入共享说明而不重复护甲徽章', () => {
    const player = { atk:3, spellPower:2 }, status = { atkUp:4, spellUp:1 };
    const host = surface(playerCombatStatsHTML(player, { armor:5, shield:8, guard:true }, status));
    expect(host.textContent).toContain('攻 7'); expect(host.textContent).toContain('法伤 3');
    expect(host.textContent).toContain('盾 8'); expect(host.textContent).toContain('格挡中');
    expect(host.textContent).not.toContain('含+'); expect(host.textContent).not.toContain('甲 5');
    const tips = [...host.querySelectorAll('[data-ui-tip]')];
    expect(tips.every(el => el.tabIndex === 0)).toBe(true);
    expect(tips[0].dataset.uiTipText).toContain('攻击强化 +4');
    expect(tips[1].dataset.uiTipText).toContain('法术强化 +1');
    expect(player).toEqual({ atk:3, spellPower:2 });
  });

  it('承伤、余血和致死保留常驻，估算显示不触发悬停或键盘聚焦', () => {
    const forecast = { damage:9, hpAfter:0, lethal:true, note:'未计随从攻击与回合末触发' };
    const host = surface(turnForecastHTML(forecast));
    expect(host.textContent).toContain('估算承伤 9'); expect(host.textContent).toContain('余 0 生命');
    expect(host.textContent).toContain('可能致死'); expect(host.textContent).not.toContain(forecast.note);
    expect(host.querySelector('[title],[data-ui-tip],[data-ui-tip-title],[data-ui-tip-text],[tabindex]')).toBeNull();
  });

  it.each([99, 98, 0])('普通牌库徽章读取实际剩余%s，保留原消耗区而不引入弃牌循环', count => {
    const draw = Array.from({ length:count }, (_, i) => `draw-${i}`), consumed = ['used'];
    const before = JSON.stringify({ draw, consumed });
    const piles = renderCombatPiles({ mode:'normal', drawCount:draw, discardCount:[], graveCount:consumed, pileTip:pile => `${pile.length}张`, cardBackHTML:'back', escAttr:x => x });
    const deck = surface(piles.draw).querySelector('[data-act=btDeck]');
    expect(deck.querySelector('b').textContent).toBe(String(count));
    expect(deck.getAttribute('aria-label')).toContain('仅抽牌效果取牌');
    expect(deck.title).toBe('');
    expect(deck.querySelector('[data-ui-tip]')).toBeNull(); expect(deck.hasAttribute('data-ui-tip')).toBe(false);
    expect(piles.rest).toContain('btGrave'); expect(piles.rest).not.toContain('弃牌堆');
    expect(JSON.stringify({ draw, consumed })).toBe(before);
  });

  it('首脑战牌库和消耗牌堆保留点击、计数及读屏说明，不显示悬浮说明', () => {
    const piles = renderCombatPiles({ mode:'boss', drawCount:['a','b'], graveCount:['c'], pileTip:pile => `${pile.length}张`, cardBackHTML:'back', escAttr:x => x });
    const host = surface(piles.draw + piles.rest);
    const draw = host.querySelector('[data-act=btDeck]'), consumed = host.querySelector('[data-act=btGrave]');
    expect(draw.tagName).toBe('BUTTON'); expect(consumed.tagName).toBe('BUTTON');
    expect(draw.getAttribute('aria-label')).toContain('牌库：2张');
    expect(draw.querySelector('b').textContent).toBe('2'); expect(consumed.querySelector('b').textContent).toBe('1');
    expect(host.querySelector('[title], [data-ui-tip], [data-ui-tip-title], [data-ui-tip-text]')).toBeNull();
  });

  it('普通牌库逐张显示相同牌，空库保留返回而不构造假卡', () => {
    const entries = Array.from({ length:99 }, (_, i) => ({ uid:`sha-${i}`, card:{ id:'starter-attack', name:'初始攻击', type:'武术', desc:'攻击' } }));
    const filled = battlePileBodyHTML({ cards:entries, cardHTML:c => c.name, kind:'deck', isBoss:false });
    expect(filled.stacks).toHaveLength(99); expect(filled.stacks.every(stack => stack.count === 1)).toBe(true);
    expect(surface(filled.html).querySelector('.battle-pile-count')).toBeNull();
    expect(surface(filled.html).querySelector('[data-battle-pile-view]').dataset.pileTotal).toBe('99');
    const empty = surface(battlePileBodyHTML({ cards:[], cardHTML:c => c.name, kind:'deck', isBoss:false }).html);
    expect(empty.querySelector('.battle-pile-empty').textContent).toBe('牌库已空');
    expect(empty.querySelectorAll('.battle-pile-card')).toHaveLength(0);
    expect(empty.querySelector('[data-act="btDeckBack"]')).not.toBeNull();
  });

  it('指南说明临时5库和效果抽牌，背包入口位于地图', () => {
    const battle = guide.pages.find(page => page.id === 'battle');
    expect(battle.steps.map(step => step.text).join('')).toContain('5 张临时初始攻击');
    expect(battle.steps.map(step => step.text).join('')).toContain('开局和每回合不自动抽牌');
    const loot = guide.pages.find(page => page.id === 'loot');
    expect(loot.steps[1].text).toContain('每个珍珠盒提供 9 格资源专用空间');
    expect(loot.controls[0]).toEqual({ key: 'B', text: '地图上打开背包' });
  });
});
