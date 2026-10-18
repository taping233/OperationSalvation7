import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { fireRestDecisionHTML } from '../game/src/ui/fire-rest-view.js';
import { uiDisclosure } from '../game/src/ui/ui-disclosure.js';
import { extractionStashHTML } from '../game/src/ui/extraction-rewards-view.js';

const show = overrides => {
  document.body.innerHTML = fireRestDecisionHTML({ heal:10, chance:30, restorable:5, fits:true, capacity:'16/16 格', ...overrides });
};
const visibleText = () => {
  const copy = document.body.cloneNode(true);
  copy.querySelectorAll('details').forEach(el => el.remove());
  return copy.textContent;
};

describe('opt-in winter decision language', () => {
  it('keeps decision facts and irreversible risks outside collapsed explanations', () => {
    show();
    expect(visibleText()).toContain('最多 +10');
    expect(visibleText()).toContain('至多 2 张');
    expect(visibleText()).toContain('30%');
    expect(visibleText()).toContain('16/16 格');
    expect(visibleText()).toContain('可复原 5 张');
    expect(visibleText()).toContain('休整后本处机会即消耗');
    expect(visibleText()).toContain('额外职业卡放不下时不会获得');
    expect(document.querySelector('details').open).toBe(false);
    expect(document.querySelector('[data-act="fireRestGo"]')).not.toBeNull();
    expect(document.querySelector('[data-act="restoreOne"]')).toBeNull();
  });
  it('shows the zero-capacity outcome without expanding help and keeps rest available', () => {
    show({ fits:false });
    expect(visibleText()).toContain('将复原 0 张');
    expect(document.querySelector('[data-act="fireRestGo"]').disabled).toBe(false);
  });
  it('does not claim a capacity failure for an empty restore pool', () => {
    show({ restorable:0, fits:false });
    expect(visibleText()).toContain('可复原 0 张');
    expect(visibleText()).toContain('至多 0 张');
    expect(visibleText()).not.toContain('当前可复原卡均放不下');
  });
  it('escapes labels/capacity and uses native keyboard-operable disclosure markup', () => {
    show({ capacity:'<img src=x onerror=alert(1)>' });
    expect(document.querySelector('img')).toBeNull();
    document.body.innerHTML = uiDisclosure({ label:'<b>说明</b>', content:'<p>解释</p>' });
    expect(document.querySelector('summary b')).toBeNull();
    expect(document.querySelector('summary').textContent).toBe('<b>说明</b>');
    expect(document.querySelector('.ui-disclosure-body').textContent).toBe('解释');
  });
  it('reuses the disclosure in extraction without collapsing capacity or permanent-loss actions', () => {
    document.body.innerHTML = extractionStashHTML({ remainingCards:[{card:{name:'示例牌'},count:3}], room:0, stashUsed:28, stashCap:28, cardHTML:()=>'<div class="hs-card"></div>' });
    expect(document.querySelector('.exr-pocket-list.ui-disclosure')).not.toBeNull();
    expect(document.querySelector('.exr-capacity').closest('details')).toBeNull();
    expect(document.querySelector('.exr-finish-note').closest('details')).toBeNull();
    expect(document.querySelector('[data-act="exFinish"]').textContent).toContain('放弃 3 张');
  });
  it('limits shared styles to opt-in vocabulary and never resizes cards or owns battle interaction', () => {
    const css = readFileSync('game/css/ui-design-system.css','utf8');
    const root = postcss.parse(css);
    root.walkRules(rule => {
      expect(rule.selector).toMatch(/ui-design-system|exr-page|sc-fire|ui-node-decision/);
      expect(rule.selector).not.toMatch(/\.hs-card|\.bt-|\*|:root/);
    });
    expect(css).not.toMatch(/z-index|pointer-events|animation|!important/);
  });
});
