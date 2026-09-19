import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (name) => readFileSync(resolve(process.cwd(), 'game/src', name), 'utf8');

describe('核心卡牌交互的键盘与读屏契约', () => {
  it('普通卡牌库只保留卡面焦点，编辑工具由开发者模式控制', () => {
    const cards = source('game.cardslib.js');
    expect(cards).toContain('<button type="button" class="lib-cardwrap"');
    expect(cards).toContain('aria-label="查看卡牌：');
    expect(cards).toMatch(/const editable = !!game\.devMode/);
    expect(cards).toMatch(/const editorTools = game\.devMode/);
  });

  it('宝箱中可拾取的卡牌使用原生按钮', () => {
    const chests = source('chests.js');
    expect(chests).toContain("const tag = act ? 'button' : 'div'");
    expect(chests).toContain('type="button" aria-label=');
  });

  it('战斗手牌提供 button 语义和 Enter/Space 操作', () => {
    const battle = source('battle.view.js');
    expect(battle).toContain("rec.card.setAttribute('role', 'button')");
    expect(battle).toContain('rec.card.tabIndex = 0');
    expect(battle).toContain("e.key !== 'Enter' && e.key !== ' '");
    expect(battle).toContain("rec.card.setAttribute('aria-disabled'");
  });
});
