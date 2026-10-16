// @vitest-environment node
import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const css = postcss.parse(readFileSync(new URL('../game/css/expedition-rewards.css', import.meta.url), 'utf8'));
const altar = readFileSync(new URL('../game/src/run/game.run.altar.js', import.meta.url), 'utf8');
const picker = 'body #overlay .card.discover:has(.sac-hand)';
const ledger = 'body #overlay #exMain.result-pg .pk-row:not(.dep-row)';
function declarations(selector) {
  const values = {};
  css.walkRules(rule => {
    if (rule.selectors.includes(selector)) rule.walkDecls(decl => { values[decl.prop] = decl.value; });
  });
  return values;
}

// Static size and semantic contracts. Actual clipping/scroll input belongs to built-in-browser QA.
describe('共用献祭选卡器的阅读与命中范围', () => {
  it('专属壳脱离1180px宽限制，正文高度有界且只滚候选区', () => {
    expect(declarations(picker)).toMatchObject({
      display:'flex', 'flex-direction':'column', width:'min(1480px,94%)', height:'94%',
      'max-width':'none', 'max-height':'94%', 'min-height':'0', overflow:'hidden',
    });
    expect(declarations(`${picker} > #ovBody`)).toMatchObject({
      display:'flex', 'flex-direction':'column', flex:'1 1 auto', 'min-height':'0', overflow:'hidden',
    });
    expect(declarations(`${picker} .sac-hand`)).toMatchObject({
      display:'grid', 'grid-template-columns':'repeat(5,minmax(0,240px))', gap:'28px',
      flex:'1 1 auto', 'min-height':'0', 'max-height':'none', overflow:'auto',
      'overscroll-behavior':'contain', 'scrollbar-gutter':'stable',
    });
    // Five 240px cards, four gaps, padding and stable gutter fit the fixed logical layout.
    expect(5 * 240 + 4 * 28 + 24 + 20).toBeLessThan(1480 - 72);
    expect(declarations(`${picker} .sac-hand > .ov-empty`)['grid-column']).toBe('1/-1');
  });

  it('提示和主操作采用22px阅读档，操作条不进入候选滚动区', () => {
    expect(declarations(`${picker} > #ovTitle`).font).toContain('32px/');
    expect(declarations(`${picker} :is(.ov-note,.ov-empty)`).font).toBe('400 22px/1.6 var(--font-ui)');
    expect(22 * 1188 / 1920).toBeGreaterThanOrEqual(13);
    expect(declarations(`${picker} .scene-ops`)).toMatchObject({ display:'flex', flex:'none' });
    expect(declarations(`${picker} .scene-ops .ov-btn`)).toMatchObject({
      'min-height':'64px', 'min-width':'180px', font:'600 22px/1.4 var(--font-ui)',
    });
    const dom = new JSDOM('<body><div id="overlay"><div class="card discover"><div id="ovBody"><p class="ov-note">选择3张卡牌</p><div class="bt-hand sac-hand"><button class="sac-card" data-act="sacPick"><span class="hs-card"></span></button></div><div class="scene-ops"><button data-act="sacConfirm" disabled>确认献祭</button><button data-act="sacCancel">取消</button></div></div></div></div></body>');
    const doc = dom.window.document;
    expect(doc.querySelector('.scene-ops').parentElement).toBe(doc.querySelector('#ovBody'));
    expect(doc.querySelector('.sac-hand .scene-ops')).toBeNull();
    expect(doc.querySelector('[data-act="sacConfirm"]').disabled).toBe(true);
    dom.window.close();
  });

  it('卡面和按钮使用同一宽度，保留费用、选中和键盘焦点状态', () => {
    expect(declarations(`${picker} .sac-card`)).toMatchObject({
      appearance:'none', display:'block', width:'100%', 'min-width':'0', padding:'0', border:'0',
    });
    expect(declarations(`${picker} .sac-card .hs-card`)).toMatchObject({ width:'100%', margin:'0' });
    expect(declarations(`${picker} .sac-card .bt-sac-cost`)['font-size']).toBe('18px');
    expect(declarations(`${picker} .sac-card.sel`).outline).toContain('3px solid');
    expect(declarations(`${picker} .sac-card:focus-visible`).outline).toContain('3px dashed');
    expect(altar).toContain('class="bt-card sac-card${sel.has(o.uid)');
    expect(altar).toContain('data-act="sacPick"');
    expect(altar).toContain('aria-pressed="${sel.has(o.uid)}"');
    expect(altar).toContain('class="bt-sac-cost">${o.card.cost} 费');
    expect(altar.match(/openBagSacrifice\(/g)).toHaveLength(4); // Three callers plus the shared definition.
  });

  it('普通发现、奖励和研究所不匹配献祭样式，也不改变全局缩放或点击语义', () => {
    const dom = new JSDOM('<body><div id="overlay"><div class="card discover"><div class="bt-hand"><button class="bt-card"></button></div></div><div class="card chest"><div class="reward-v14"></div></div><div class="card page"><div class="reward-replica entry-supply-strips"></div><div class="battle-stage sts"></div><button data-act="rc3">符文法阵</button></div></div></body>');
    expect(dom.window.document.querySelector(picker)).toBeNull();
    css.walkRules(rule => {
      if (rule.selector.startsWith(picker)) {
        rule.walkDecls(decl => {
          expect(['zoom', 'pointer-events', 'cursor']).not.toContain(decl.prop);
        });
      }
    });
    dom.window.close();
  });
});

describe('成功撤离自动入库的两列账目', () => {
  it('标签不拆字，只有说明列可缩窄换行，保留既有22px阅读档', () => {
    expect(declarations(ledger)).toMatchObject({ display:'grid', 'grid-template-columns':'max-content minmax(0,1fr)', 'align-items':'start' });
    expect(declarations(`${ledger} > span:first-child`)).toMatchObject({ 'white-space':'nowrap', 'overflow-wrap':'normal' });
    expect(declarations(`${ledger} > span:last-child`)['min-width']).toBe('0');
    expect(declarations('body #overlay #exMain.result-pg :is(.res-chip,.result-summary span:last-child,.hub-card-tip,.pk-row,.dim,.ov-note,.ov-empty)')['font-size']).toBe('22px');
  });

  it('统一覆盖木材、口粮、物资与消耗区，不影响左侧初始攻击说明或其他页面', () => {
    const rows = ['木材 ×0', '口粮 ×0', '其余物资 ×3', '消耗区'];
    const dom = new JSDOM(`<body><div id="overlay"><div id="exMain" class="result-pg"><div class="pk-row dep-row locked"><span>初始攻击 · 初始牌不可入库</span><span class="dim">遗落</span></div>${rows.map(label => `<div class="pk-row"><span>${label}</span><span class="dim">每张1/3概率保留 · 带回2张 · 散失14张</span></div>`).join('')}</div><div class="pk-row"><span>其他页面</span><span>说明</span></div></div></body>`);
    expect([...dom.window.document.querySelectorAll(ledger)].map(el => el.firstElementChild.textContent)).toEqual(rows);
    expect(dom.window.document.querySelector(`${ledger}.dep-row`)).toBeNull();
    dom.window.close();
  });
});
