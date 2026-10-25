// @vitest-environment node
import postcss from 'postcss';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { readCssSource } from './helpers/css-source.js';

const css = postcss.parse(readCssSource(new URL('../game/css/expedition-rewards.css', import.meta.url), 'utf8'));
const doom = 'body #overlay.fx-doom';

function declarations(selector) {
  const values = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  return values;
}

// Layout contracts only. Real containing-block/clipping and scroll input need the built-in browser.
describe('终局结算的阅读与固定操作契约', () => {
  it('失败报告替换720px窄壳，标题和主滚动区有确定高度边界', () => {
    expect(declarations(`${doom} .card:has(.doom-panel)`)).toMatchObject({
      width:'min(1240px,94%)', height:'min(760px,94%)', 'max-height':'94%',
      position:'relative', display:'flex', 'flex-direction':'column', overflow:'hidden',
    });
    expect(declarations(`${doom} .card:has(.doom-panel) > #ovTitle`).font).toContain('34px/');
    expect(declarations(`${doom} .card:has(.doom-panel) > #ovBody`)).toMatchObject({
      position:'static', flex:'1 1 auto', 'min-height':'0', overflow:'hidden',
    });
    expect(declarations(`${doom} .doom-panel`)).toMatchObject({
      position:'static', width:'100%', height:'100%', 'max-height':'none',
      overflow:'auto', 'overscroll-behavior':'contain', 'scrollbar-gutter':'stable', animation:'none',
    });
  });

  it('失败两按钮脱离正文滚动区，底部留足空间且不延时隐藏', () => {
    const shell = declarations(`${doom} .card:has(.doom-panel)`);
    const footer = declarations(`${doom} .doom-panel .doom-btns`);
    const button = declarations(`${doom} .doom-panel .doom-btns .ov-btn`);
    expect(footer).toMatchObject({ position:'absolute', inset:'auto 36px 24px', animation:'none' });
    expect(button).toMatchObject({ 'min-height':'64px', 'white-space':'normal' });
    expect(Number(shell.padding.split(' ')[2].replace('px','')))
      .toBeGreaterThanOrEqual(24 + 64 + 16 + 1);
    expect(declarations(`${doom} .doom-panel .doom-btns .ov-btn.ok`)).toMatchObject({
      background:'#b7dcd0', color:'#10282a',
    });
  });

  it('损失、资源卡规则、经验和复盘统一22px，不再落到11.5px小字', () => {
    const copy = declarations(`${doom} .doom-panel :is(.ov-note,.doom-xp-note,.doom-more,.doom-review p,.doom-review small)`);
    expect(copy).toMatchObject({ font:'400 22px/1.6 var(--font-ui)', 'overflow-wrap':'anywhere' });
    expect(22 * 1188 / 1920).toBeGreaterThanOrEqual(13);
    expect(declarations(`${doom} .doom-panel :is(.doom-xp-h,.doom-loot-h,.doom-review > b)`).font).toContain('24px/');
    expect(declarations(`${doom} .doom-panel .ds-k`).font).toContain('20px/');
    expect(declarations(`${doom} .doom-panel .ds-v`).font).toContain('32px/');
    expect(copy['max-height']).toBeUndefined();
    expect(copy['text-overflow']).toBeUndefined();
    expect(copy.display).not.toBe('none');
  });

  it('uses two quiet summary columns and keyboard-focusable native detail headings', () => {
    expect(declarations(`${doom} .doom-panel .doom-stats`)['grid-template-columns']).toBe('repeat(2,minmax(0,1fr))');
    expect(declarations(`${doom} .doom-panel .doom-stat`)).toMatchObject({ background:'none',border:'0',padding:'0' });
    expect(declarations(`${doom} .doom-panel summary`).cursor).toBe('pointer');
    expect(declarations(`${doom} .doom-panel summary:focus-visible`).outline).toContain('var(--feedback-blue)');
    expect(declarations(`${doom} .doom-panel .doom-stat-note`).font).toContain('22px/');
  });

  it('长损失与复盘在无抢运和六卡抢运两态都保留完整文本和终局入口', () => {
    const loss = '散失：卡牌19张（含传说、史诗卡）· 消耗区散失12张；其中资源卡散失：木材×10、口粮×10';
    const rule = '木材、口粮、钥匙资源卡入基地仓库后，需在仓库“使用”才折入基地材料数字；散装木材与口粮仅在成功撤离时直接折入。';
    const review = '已归因承伤：污染熔兽40、中毒12、灼烧5；记录敌方直接攻击与回合末中毒、灼烧，其他卡牌或反噬伤害未归因。';
    for (const count of [0, 6]) {
      const dom = new JSDOM(`<body><div id="overlay" class="room-view fx-doom"><div class="card room"><h2 id="ovTitle">撤离失败</h2><div id="ovBody"><div class="doom-panel"><p class="ov-note doom-loss-row">${loss}</p><p class="ov-note doom-material-note">${rule}</p><section class="doom-review"><p>${review}</p></section>${count ? `<div class="doom-loot"><div class="doom-cards">${'<span class="doom-card">已抢运卡牌</span>'.repeat(count)}</div></div>` : '<p class="ov-note">安全格里没有卡牌，全部战利品丢失</p>'}<div class="doom-btns"><button class="ov-btn" data-act="goBase">回基地</button><button class="ov-btn ok" data-act="again">再出发</button></div></div></div></div></div></body>`);
      const doc = dom.window.document;
      expect(doc.querySelector('.doom-loss-row').textContent).toBe(loss);
      expect(doc.querySelector('.doom-material-note').textContent).toBe(rule);
      expect(doc.querySelector('.doom-review p').textContent).toBe(review);
      expect(doc.querySelectorAll('.doom-card')).toHaveLength(count);
      expect([...doc.querySelectorAll('.doom-btns [data-act]')].map(el => el.dataset.act)).toEqual(['goBase', 'again']);
      dom.window.close();
    }
  });



  it('结算作用域不命中普通奖励、入城补给条列或战斗舞台，也不改全局缩放', () => {
    const dom = new JSDOM('<body><div id="overlay"><div class="card page"><div class="entry-supply-strips reward-replica"></div><div class="battle-stage sts"></div><div class="reward-v14"></div></div></div></body>');
    expect(dom.window.document.querySelector(`${doom} .card:has(.doom-panel)`)).toBeNull();
    css.walkRules(rule => {
      if (rule.selector.startsWith(doom)) {
        rule.walkDecls('zoom', () => { throw new Error('Terminal reports must use the shared UI scale'); });
      }
    });
    dom.window.close();
  });
});
