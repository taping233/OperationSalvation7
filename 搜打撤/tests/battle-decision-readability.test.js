// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import postcss from 'postcss';
import { describe, expect, it } from 'vitest';

const hand = readFileSync(new URL('../game/css/battle-hand-overhaul.css', import.meta.url), 'utf8');
const battle = readFileSync(new URL('../game/css/expedition-battle.css', import.meta.url), 'utf8').split('/* 战斗重建：')[1];
const stage = 'body #overlay .battle-stage.sts.battle-sts';
const reading = 'body:has(#viewport) #overlay .battle-stage.sts.battle-sts .sts-hand';
const liftSelector = `${reading} .bt-slot:is(:hover,:focus-within) .bt-card:not(.aim-lift)`;
function declarations(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]+)\\}`))?.[1] || '';
}

// These assertions guard the CSS contract. Actual crop/collision checks require the built-in browser.
describe('battle decision reading CSS contract', () => {
  it('rests the hand below the edge and raises only the hovered or keyboard-focused card into reading view', () => {
    const slot = declarations(hand, `${stage} .sts-hand .bt-slot`);
    const bottom = Number(slot.match(/bottom:([\d.-]+)px/)?.[1]);
    expect(bottom).toBeLessThan(0);
    expect(slot).toContain('width:220px;height:330px');
    expect(slot).toContain('var(--fx,0px)'); expect(slot).toContain('var(--fy,0px)');
    expect(slot).toContain('var(--frot,0deg)');
    const lifted = declarations(hand, liftSelector);
    const shift = Number(lifted.match(/translateY\(([\d.-]+)px\)/)?.[1]);
    const scale = Number(lifted.match(/scale\(([\d.]+)\)/)?.[1]);
    expect(scale).toBeGreaterThanOrEqual(1.04); expect(scale).toBeLessThanOrEqual(1.08);
    // Conservative source-coordinate envelope for the nine-group edge: fy<=27 and rose frame<=30.
    // This checks the resting/reading distinction, not a claim about actual browser layout.
    expect(1080 - bottom + 27 + shift + 330 * (scale - 1) / 2 + 30).toBeLessThanOrEqual(1080);
    expect(battle).toMatch(/bottom:calc\(var\(--battle-hand-height\) \+ 152px\)/);
    const inspect = declarations(hand, 'body #overlay .battle-stage.battle-sts .sts-hand .bt-slot:is(:hover,:focus-within) .bt-hand-inspect');
    expect(inspect).toContain(`transform:translateY(${shift}px)`);
  });

  it('wins the real winter important transform conflict for hover/focus while leaving inline drag transforms alone', () => {
    const legacySelector = 'body #overlay .battle-stage.sts .sts-hand .bt-slot:hover .bt-card:not(.off):not(.aim-lift)';
    const legacy = postcss.parse(readFileSync(new URL('../game/css/winter.css', import.meta.url), 'utf8'));
    const current = postcss.parse(hand);
    const transformRule = (root, selector) => {
      let found;
      root.walkRules(rule => {
        if (rule.selector === selector) rule.walkDecls('transform', decl => { found = { selector, value: decl.value, important: !!decl.important }; });
      });
      return found;
    };
    const old = transformRule(legacy, legacySelector), lifted = transformRule(current, liftSelector);
    expect(old?.important).toBe(true);
    expect(old?.value).toBe('translateY(-12px) scale(1.04)');
    expect(lifted?.important).toBe(true);
    expect(lifted?.value).toBe('translateY(-156px) rotate(var(--counter-rot,0deg)) scale(1.06)');
    // This bounded comparison uses the two actual conflicting rules. Extra viewport ID wins
    // among important author declarations even if winter is bundled after the hand stylesheet.
    const ids = rule => (rule.selector.match(/#[\w-]+/g) || []).length;
    expect(ids(lifted)).toBeGreaterThan(ids(old));
    const dom = new JSDOM('<body><div id="viewport"></div><div id="overlay"><div class="battle-stage sts battle-sts"><div class="sts-hand"><div class="bt-slot"><div class="bt-card"></div></div></div></div></div></body>');
    const card = dom.window.document.querySelector('.bt-card'), slot = card.parentElement;
    const matches = rule => card.matches(rule.selector.replaceAll(':hover', '.test-hover').replaceAll(':focus-within', '.test-focus-within'));
    for (const mode of ['test-hover', 'test-focus-within']) {
      slot.className = `bt-slot ${mode}`;
      for (const state of ['', 'off']) {
        card.className = `bt-card ${state}`;
        expect(matches(lifted)).toBe(true);
      }
      card.className = 'bt-card aim-lift';
      card.style.transform = 'translate(42px,-220px)';
      expect(matches(lifted)).toBe(false); expect(matches(old)).toBe(false);
      expect(card.style.transform).toBe('translate(42px,-220px)');
    }
    slot.className = 'bt-slot'; card.className = 'bt-card';
    expect(matches(lifted)).toBe(false);
    dom.window.close();
  });

  it('keeps the ordinary secondary instruction under the top bar and above the intent row', () => {
    const caption = declarations(battle, `${stage} .sts-arena-caption`);
    expect(caption).toContain('top:8px');
    expect(caption).toContain('padding:4px 16px');
    expect(caption).toContain('z-index:1');
    expect(declarations(battle, `${stage} .sts-arena-caption span`)).toContain('line-height:1.3');
  });

  it('uses the shared external reading size only inside the battle hand, with full short-rule hover and focus', () => {
    const body = declarations(hand, `${reading} .hs-card .hsc-desc`);
    expect(body).toContain('font-size:var(--card-copy-size,24px)!important');
    expect(body).toContain('line-height:var(--card-copy-leading,1.55)!important');
    const full = declarations(hand, `${reading} .bt-slot:is(:hover,:focus-within) .hs-card:is([data-rule-density="normal"],[data-rule-density="long"]) .hsc-desc`);
    expect(full).toContain('-webkit-line-clamp:unset');
    expect(full).toContain('max-height:none'); expect(full).toContain('overflow:visible!important');
    expect(hand).toContain('transition:transform .16s ease');
    expect(hand).toContain('body.reduce-motion'); expect(hand).toContain('prefers-reduced-motion:reduce');
    expect(hand).toContain('.bt-card.aim-lift { transition:none!important; }');
  });

  it('gives tactical labels one dark backing and keeps both corner action anchors', () => {
    const nameplate = declarations(battle, `${stage}[data-boss='1'] .sts-arena .sts-foe .sts-nameplate`);
    expect(nameplate).toContain('background:var(--tactical-surface)!important');
    expect(nameplate).toContain('border:1px solid var(--tactical-line)!important');
    expect(battle).toContain('.sts-energy-wrap { position:absolute;left:44px;bottom:140px');
    expect(battle).toContain('.sts-tactics { position:absolute;right:30px;bottom:92px');
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
