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
  let result = '';
  postcss.parse(css).walkRules(rule => {
    // Exact selectors keep a shared comma rule from masking a later standalone override.
    if (!result && rule.selector === selector) result = rule.nodes.filter(node => node.type === 'decl')
      .map(node => `${node.prop}:${node.value}${node.important ? '!important' : ''}`).join(';');
  });
  return result;
}

// These assertions guard the CSS contract. Actual crop/collision checks require the built-in browser.
describe('battle decision reading CSS contract', () => {
  it('keeps straight shared-card hosts and distinct resting and reading states', () => {
    const slot = declarations(battle, `${stage} .bt-slot`);
    expect(slot).toContain('var(--fx,0px)');
    expect(slot).toContain('260px * var(--fs,1)');
    expect(slot).not.toContain('rotate(');
    expect(declarations(battle, `${stage} .bt-card:not(.aim-lift)`)).toContain('var(--hand-rest,284px)');
    expect(declarations(battle, liftSelector)).toContain('translateY(0)');
    expect(declarations(battle, liftSelector)).toContain('scale(1.05)');
    expect(hand).not.toMatch(/bt-hand-inspect/);
  });

  it('keeps the stable bottom bridge behind the card and disables it during dragging', () => {
    const bridge = declarations(battle, `${stage} .bt-slot::after`);
    expect(bridge).toContain('z-index:-1');
    expect(bridge).toContain('top:calc(390px * var(--fs,1))');
    expect(declarations(battle, `${stage} .bt-slot`)).toContain('390px * var(--fs,1) + 56px');
    expect(bridge).toContain('pointer-events:auto');
    expect(declarations(battle, `${stage} .bt-slot:has(.aim-lift)::after`)).toContain('pointer-events:none');
    expect(battle).not.toContain('.bt-rest-hit');
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
    expect(declarations(battle, `${stage} .bt-card`)).toContain('transition:transform .16s');
    expect(battle).toContain('prefers-reduced-motion:reduce');
    expect(declarations(battle, `${stage} .bt-card.aim-lift`)).toContain('transition:none');
  });

  it('keeps object labels on a local dark reading surface and career controls at the player feet', () => {
    expect(declarations(battle, `${stage} .sts-nameplate`)).toContain('background:var(--battle-panel)');
    expect(declarations(battle, `${stage} .sts-hp>span`)).toContain('font-size:22px');
    expect(declarations(battle, `${stage} .sts-intent`)).toContain('position:relative');
    expect(declarations(battle, `${stage} .sts-intent`)).not.toContain('100% + 120px');
    expect(declarations(battle, `${stage} .sts-resource-dock`)).toContain('max-width:260px');
    expect(declarations(battle, `${stage} .sts-energy>b`)).toContain('font-size:52px');
    expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('left:50%');
    expect(declarations(battle, `${stage} #btSelf>.sts-hand-tools`)).toContain('bottom:-142px');
  });

  it('labels a folded card without changing the shared printed face or intercepting the card input', () => {
    const restName = declarations(battle, `${stage} .bt-rest-name`);
    expect(restName).toContain('top:54px');
    expect(restName).toContain('var(--hand-visible-width,174px)');
    expect(restName).toContain('pointer-events:none');
    expect(restName).toContain('width:min(var(--hand-visible-width,174px),174px)');
    expect(restName).toContain('border-top:2px');
    expect(restName).not.toContain('border-left:2px');
    expect(battle).toContain('.bt-slot:is(:hover,:has(:focus-visible)) .bt-rest-name');
    expect(battle).toContain('.bt-card:is(.click-selected,.aim-lift) .bt-rest-name{opacity:0}');
    expect(battle).not.toMatch(/\.hsc-(?:name|cost|desc)\s*\{/);
    expect(battle).not.toContain('!important');
  });

  it('keeps compact enemy HUDs, wrapping compound intentions and local details outside layout flow', () => {
    expect(declarations(battle, `${stage} .sts-nameplate`)).toContain('padding:10px 12px');
    expect(declarations(battle, `${stage} .sts-headrow>b`)).toContain('overflow-wrap:anywhere');
    expect(declarations(battle, `${stage} .sts-intent`)).toContain('flex-wrap:wrap');
    expect(declarations(battle, `${stage} .bt-intent-part`)).toContain('display:inline-grid');
    expect(declarations(battle, `${stage} .bt-intent-condition`)).toContain('grid-column:1/-1');
    expect(declarations(battle, `${stage} .bt-intent-condition`)).toContain('white-space:nowrap');
    expect(declarations(battle, `${stage} .bt-intent-condition`)).toContain('word-break:keep-all');
    expect(declarations(battle, `${stage} .bt-intent-detail`)).toContain('display:none');
    expect(declarations(battle, `${stage} .bt-intent-detail`)).toContain('position:absolute');
    expect(declarations(battle, `${stage} .bt-intent-detail`)).toContain('overflow:auto');
    expect(declarations(battle, `${stage} .sts-stats>.sts-stat`)).toContain('white-space:nowrap');
  });

  it('keeps piles and tactics in distinct auto-sized rows when the lethal forecast grows', () => {
    const hud = declarations(battle, `${stage} .sts-hud`);
    expect(hud).toContain('display:grid');
    expect(hud).toContain('grid-template-rows:minmax(0,1fr) auto auto');
    expect(hud).toContain('gap:14px 0');
    expect(hud).toContain('padding:0 48px 40px');
    const piles = declarations(battle, `${stage} .sts-hud-r`);
    expect(piles).toContain('position:static'); expect(piles).toContain('grid-row:2');
    expect(piles).toContain('flex-wrap:wrap'); expect(piles).not.toContain('bottom:284px');
    const tactics = declarations(battle, `${stage} .sts-tactics`);
    expect(tactics).toContain('position:static'); expect(tactics).toContain('grid-row:3');
    expect(tactics).not.toContain('bottom:40px');
    expect(declarations(battle, `${stage} .sts-hand`)).toContain('position:absolute');
  });

  it('keeps skill copy and detail controls readable while the existing disabled action stays legible', () => {
    expect(declarations(battle, `${stage} .battle-skill-status`)).toContain('font-size:20px');
    expect(declarations(battle, `${stage} .battle-skill-copy>span`)).toContain('font-size:20px');
    expect(declarations(battle, `${stage} .battle-skill-availability`)).toContain('font-size:20px');
    expect(declarations(battle, `${stage} .bt-slam-btn:disabled`)).toContain('opacity:1');
    expect(declarations(battle, `${stage} .bt-slam-btn[data-skill-state="unaffordable"] .battle-skill-availability`)).toContain('color:');
    const details = declarations(battle, `${stage} .bt-detail-chip,${stage} .bt-infchip`);
    expect(details).toContain('font-size:20px'); expect(details).toContain('min-height:40px');
    expect(declarations(battle, `${stage} .bt-infchip`)).toContain('top:56px');
    expect(declarations(battle, `${stage} .bt-turn-forecast b`)).toContain('font-size:30px');
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
