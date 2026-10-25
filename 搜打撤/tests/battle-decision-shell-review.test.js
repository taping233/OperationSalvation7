import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

vi.mock('../game/src/battle/core/battle.core.js', () => ({
  commands: {}, getSnapshot: () => ({}), AFFIX_META: {}, R: () => ({ battleEnergy: 2 }), findEffectiveCard: () => null,
}));
const UI = { el: {}, showOverlay(_title, html) { this.el.ovBody.innerHTML = html; } };
window.SDT = { UI };
const { showBattleDecision } = await import('../game/src/battle/view/battle.overlays.js');
beforeEach(() => {
  document.body.innerHTML = '<div id="ovBody"></div>';
  UI.el.ovBody = document.getElementById('ovBody');
});
it('编组在操作栏分离前识别，保留专用布局和开战前提示', () => {
  showBattleDecision('编组', '<div class="bt-hand"><button data-act="bossSel">卡牌</button></div><div class="ov-btns"><button data-act="bossGo">开始战斗</button><button data-act="bossCancel">放弃挑战</button></div>', true, { battleToken: 1 });
  expect(document.querySelector('.battle-decision').dataset.decisionKind).toBe('formation');
  expect(document.querySelector('.battle-decision-head span').textContent).toBe('开战前准备');
  expect(document.querySelector('.battle-decision-actions [data-act="bossGo"]')).not.toBeNull();
});
it.each([
  ['discover', '<button data-act="btDiscover">卡牌</button>'],
  ['hand-select', '<button data-act="btPickHand">卡牌</button>'],
  ['choice', '<div class="choice-list"><button>选项</button></div>'],
  ['pile', '<div class="bt-gy-list"></div>'],
  ['bag', '<div class="battle-bag-section"></div>'],
  ['settings', '<div class="bt-settings"></div>'],
])('其他 %s 弹窗继续使用各自类型', (kind, body) => {
  showBattleDecision('决策', `${body}<div class="ov-btns"><button>返回</button></div>`, true, { turn: 3, energy: 1, maxEnergy: 2 });
  expect(document.querySelector('.battle-decision').dataset.decisionKind).toBe(kind);
  expect(document.querySelector('.battle-decision-head span').textContent).toBe(kind === 'pile' ? '0 张' : '第 3 回合 · 能量 1/2');
});
it('首脑规则实际调用模板也把返回键交给固定操作栏', () => {
  const source = readFileSync('game/src/battle/view/battle.view.js', 'utf8');
  const match = source.match(/<button class="ov-btn" data-act="btRulesBack">返回战斗<\/button>/);
  expect(match).not.toBeNull();
  expect(source.slice(0, match.index).endsWith('<div class="ov-btns">')).toBe(true);
  showBattleDecision('首脑规则', '<p>规则</p><div class="ov-btns">' + match[0] + '</div>', 'settings', {});
  expect(document.querySelector('.battle-decision-actions [data-act="btRulesBack"]')).not.toBeNull();
  expect(document.querySelector('.battle-decision').dataset.decisionKind).toBe('rules');
  expect(document.querySelector('.battle-decision').classList.contains('battle-decision-compact')).toBe(true);
});

it('首脑规则短面板限定字号及滚动高度，设置专属规则仍独立', async () => {
  const { default: postcss } = await import('postcss');
  const css = postcss.parse(readCssSource('game/css/expedition-battle.css', 'utf8'));
  const rules = [];
  css.walkRules(rule => rules.push({ selector:rule.selector, declarations:Object.fromEntries(rule.nodes.filter(n => n.type === 'decl').map(n => [n.prop, n.value])) }));
  const geometry = rules.find(rule => rule.selector.includes('.card.room:has(') && rule.selector.includes('[data-decision-kind="rules"]'));
  expect(geometry?.declarations.height).toBe('auto');
  expect(geometry?.declarations['max-height']).toContain('--game-layout-height');
  const text = rules.find(rule => rule.selector.includes('[data-decision-kind="rules"]') && rule.selector.includes('.ov-note'));
  expect(text?.declarations['font-size']).toBe('var(--card-copy-size,24px)');
  expect(text?.declarations['line-height']).toBe('1.55');
  expect(rules.find(rule => rule.selector === '#overlay .battle-decision-content')?.declarations.overflow).toBe('auto');
  expect(rules.some(rule => rule.selector.includes('[data-decision-kind="settings"]'))).toBe(true);
});
