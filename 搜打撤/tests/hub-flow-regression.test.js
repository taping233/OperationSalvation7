import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// 2026-09-22 hub 拆分：断言串分布在壳与两个切片，三文件拼接后仍断言「基地源码含 X」
const hub = ['game.hub.js', 'game.hub.depart.js', 'game.hub.pages.js']
  .map((f) => readFileSync(`game/src/${f}`, 'utf8')).join('\n');
const altar = readFileSync('game/src/game.run.altar.js', 'utf8');
const session = readFileSync('game/src/game.session.js', 'utf8');

describe('基地出发与选角回流回归', () => {
  it('选角预览同步初始选择，并支持从整备页取消回流', () => {
    expect(altar).toContain("let sel = previous && picks.includes(previous.rulesetId) ? previous.rulesetId : picks[0];");
    expect(altar).toContain("if (onCancel) { onCancel(); return; }");
    expect(hub).toContain('requestClassChoice({');
    expect(hub).toContain('onCancel: () => renderDepartPrep()');
    expect(hub).toContain('newRun(mode, picks, { skipClassChoice: true })');
    expect(session).toContain('if (!options.skipClassChoice) runtime.openClassChoice()');
  });
});

describe('基地操作键盘语义与危险操作保护', () => {
  it('仓库行使用原生按钮，整备拖拽卡面提供键盘语义与焦点样式', () => {
    // 2026-09-23 对齐 09-20 仓库卡面化拍板（2d5ad9e）：文字行改卡面格，原生按钮语义保留
    expect(hub).toContain('<button type="button" class="stash-cell');
    expect(hub).toContain('role="button" tabindex="0" aria-pressed=');
    expect(hub).toContain("e.key !== 'Enter' && e.key !== ' '");
    expect(readFileSync('game/css/hub.css', 'utf8')).toContain('.dep-card[role="button"]:focus-visible');
  });

  it('职业收藏、高价值/最后一张消费或卖出默认先进入确认页', () => {
    expect(hub).toContain('confirmStashAction(`收藏【${esc(s.card.name)}】会消耗 1 张卡');
    expect(hub).toContain('price >= 5 || s.count === 1');
    expect(hub).toContain('confirmMaterial(`这是仓库里的最后一张${mat.label}卡');
    expect(hub).toContain('stashConfirmCancel');
  });
});
