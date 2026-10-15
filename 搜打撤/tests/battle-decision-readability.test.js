// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const hand = readFileSync(new URL('../game/css/battle-hand-overhaul.css', import.meta.url), 'utf8');
const battle = readFileSync(new URL('../game/css/battle-stage.css', import.meta.url), 'utf8');
const stage = '#overlay .battle-stage.sts';
const liftSelector = `${stage} .bt-slot:is(:hover,:has(:focus-visible)) .bt-card:not(.aim-lift)`;
function declarations(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || '';
}

// These assertions guard the CSS contract. Actual crop/collision checks require the built-in browser.
describe('battle decision reading CSS contract', () => {
  it('keeps straight shared-card hosts and distinct resting and reading states', () => {
    const slot = declarations(battle, `${stage} .bt-slot`);
    expect(slot).toContain('var(--fx,0px)');
    expect(slot).toContain('260px * var(--fs,1)');
    expect(slot).not.toContain('rotate(');
    expect(declarations(battle, `${stage} .bt-card:not(.aim-lift)`)).toContain('var(--hand-rest,24px)');
    expect(declarations(battle, liftSelector)).toContain('translateY(0)');
    expect(hand).not.toMatch(/bt-hand-inspect/);
  });

  it('puts the resting hover bridge behind the visible card so it cannot swallow a play gesture', () => {
    const bridge = declarations(battle, `${stage} .bt-slot::after`);
    expect(bridge).toContain('z-index:-1');
    expect(bridge).toContain('top:calc(390px * var(--fs,1))');
  });

  it('retires the winter hover conflict and leaves inline drag transforms alone', () => {
    const legacySelector = 'body #overlay .battle-stage.sts .sts-hand .bt-slot:hover .bt-card:not(.off):not(.aim-lift)';
    const legacy = postcss.parse(readFileSync(new URL('../game/css/winter.css', import.meta.url), 'utf8'));
    const old = [];
    legacy.walkRules(rule => { if (rule.selector === legacySelector) old.push(rule); });
    expect(old).toHaveLength(0);
    const dom = new JSDOM('<div class="bt-card aim-lift"></div>');
    const card = dom.window.document.querySelector('.bt-card');
    card.style.transform = 'translate(42px,-220px)';
    expect(card.matches('.bt-card:not(.aim-lift)')).toBe(false);
    expect(card.style.transform).toBe('translate(42px,-220px)');
    dom.window.close();
  });

  it('keeps the secondary instruction below the header in a separate interaction-free lane', () => {
    const caption = declarations(battle, `${stage} .sts-arena-caption`);
    expect(caption).toContain('left:50%');
    expect(caption).toContain('z-index:12');
    expect(caption).toContain('pointer-events:none');
  });

  it('keeps card copy sizing out of the hand skin while detail reading keeps the shared tokens', () => {
    // 2026-10-15 卡面全局改造（WF-card-face-global-1015）：手牌恢复原卡框，卡面阅读
    // 字号与短规则节选由共用卡面 CSS 管理，手牌皮肤不得再覆写 .hsc-desc；完整规则
    // 阅读面仍走 .bt-hand-detail 弹层并沿用共享字号令牌（见下一定义与末个用例）。
    expect(hand).not.toMatch(/hsc-desc/);
    expect(declarations(battle, `${stage} .bt-card`)).toContain('transition:transform .2s');
    expect(battle).toContain('prefers-reduced-motion:reduce');
    expect(declarations(battle, `${stage} .bt-card.aim-lift`)).toContain('transition:none');
  });

  it('keeps labels unboxed, resources compact, and career controls beside the player', () => {
    expect(declarations(battle, `${stage} .sts-nameplate`)).toContain('background:none');
    expect(declarations(battle, `${stage} .sts-resource-dock`)).toContain('max-width:260px');
    expect(declarations(battle, `${stage} .sts-energy>b`)).toContain('font-size:52px');
    expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('left:-90px');
  });

  it('keeps full long rules scrollable and uses the same copy tokens with fixed footer controls', () => {
    const full = declarations(hand, 'body #overlay .bt-hand-detail-rules');
    expect(full).toContain('font-size:var(--card-copy-size,24px)');
    expect(full).toContain('line-height:var(--card-copy-leading,1.55)');
    expect(declarations(hand, 'body #overlay .bt-hand-detail-copy')).toContain('overflow:auto');
    expect(declarations(hand, 'body #overlay .bt-hand-detail-use')).toContain('min-height:64px');
    expect(declarations(hand, 'body #overlay .bt-hand-detail-close')).toContain('min-height:48px');
  });
});
