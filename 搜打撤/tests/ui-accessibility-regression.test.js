import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (name) => readFileSync(resolve(process.cwd(), 'game/src', name), 'utf8');

describe('核心卡牌交互的键盘与读屏契约', () => {
  it('照相馆照片只保留单一按钮焦点，编辑工具由开发者模式控制', () => {
    const cards = source('hub/game.cardslib.page.js');
    expect(cards).toContain('<button type="button" class="lib-cardwrap studio-photo');
    expect(cards).toContain('aria-label="查看照片：');
    expect(cards).toContain('let libEditMode = false');
    expect(cards).toContain('const editorTools = game.devMode ?');
    expect(cards).toContain("libAct('libEditMode'");
    expect(cards).toMatch(/function libAct\(name, callback\)\s*\{[^}]*isCurrentLibPage\(session\)[\s\S]*?UI\.act\(name, action\);/);
    expect(cards).toMatch(/const editorTools = game\.devMode/);
  });

  it('战斗手牌提供 button 语义和 Enter/Space 操作', () => {
    // 2026-09-22 battle.view 拆片：断言串随片走，壳+六片拼接后仍断言「战斗源码含 X」
    const battle = ['battle/view/battle.view.js', 'battle/view/battle.overlays.js', 'battle/view/battle.layers.js', 'battle/view/battle.vfx.js',
      'battle/view/battle.anim.view.js', 'battle/view/battle.aim.js', 'battle/view/battle.hover.js']
      .map((f) => source(f)).join('\n');
    // One keyboard stop lives on the card face; the layout wrapper is a group.
    expect(battle).toContain("setHandAttribute(rec.card, 'role', 'group')");
    expect(battle).toContain("setHandAttribute(rec.card, 'tabindex', -1)");
    expect(battle).toContain("setHandAttribute(face, 'role', 'button')");
    expect(battle).toContain("setHandAttribute(face, 'tabindex', 0)");
    expect(battle).toContain("e.key !== 'Enter' && e.key !== ' '");
    expect(battle).toContain("setHandAttribute(face, 'aria-disabled'");
    expect(battle).toContain('node.getAttribute(name) !== String(value)');
    expect(battle).toContain('node.setAttribute(name, String(value))');
  });
});
