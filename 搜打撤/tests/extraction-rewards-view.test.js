import { describe, expect, it } from 'vitest';
import { extractionDoneHTML, extractionStashHTML } from '../game/src/ui/extraction-rewards-view.js';
import { esc } from '../game/src/core/shared.js';
import { readCssSource } from './helpers/css-source.js';
const cardHTML = c => `<div class="hs-card">${esc(c.name)}</div>`;
const common = { id: 'c', name: '普通卡', rarity: '古朴' }, rare = { id: 'l', name: '传说卡', rarity: '传说' };
const show = opts => { document.body.innerHTML = extractionStashHTML({ cardHTML, ...opts }); };

describe('extraction reward presentation', () => {
  it('has one truthful partial-capacity action and distinguishes viewing from depositing', () => {
    show({ remainingCards: [{ card:common,count:5 },{card:rare,count:14}],room:7,stashUsed:21,stashCap:28 });
    expect(document.querySelector('[data-act=exAll]')).toBeNull();
    const smart=document.querySelector('[data-act=exSmart]');
    expect(smart.disabled).toBe(false); expect(smart.textContent).toContain('入库 7 张');
    expect(document.querySelector('.exr-finish-note').textContent).toContain('将丢失 19 张');
    expect(document.querySelector('[data-act=exFinish]').textContent).toContain('放弃 19 张');
    // Rarity sorting keeps original indices for all commands and read-only detail clicks.
    expect(document.querySelector('[data-act=exInspect]').dataset.i).toBe('1');
    expect(document.querySelector('[data-act=exStash]').dataset.i).toBe('1');
    expect(document.querySelector('[data-act=exInspect]')).not.toBe(document.querySelector('[data-act=exStash]'));
  });
  it('offers all-in only when the complete candidate set fits', () => {
    show({ remainingCards:[{card:common,count:5}],room:5 });
    expect(document.querySelector('[data-act=exAll]').textContent).toContain('5 张');
    expect(document.querySelector('[data-act=exAll]').disabled).toBe(false);
    expect(document.querySelector('[data-act=exSmart]')).toBeNull();
  });
  it('keeps full-storage cards inspectable while disabling all deposit paths', () => {
    show({ remainingCards:[{card:rare,count:5}],room:0 });
    expect(document.querySelector('[data-act=exInspect]').disabled).toBe(false);
    expect(document.querySelector('[data-act=exStash]').disabled).toBe(true);
    expect(document.querySelector('[data-act=exSmart]').disabled).toBe(true);
    expect(document.querySelector('[data-act=exFinish]').disabled).toBe(false);
  });
  it('preserves 2/5 partial-stack clarity and all-count availability', () => {
    show({ remainingCards:[{card:common,count:5}],room:2 });
    const button=document.querySelector('[data-act=exStash]');
    expect(button.textContent).toContain('可入库 2/5 张');
    expect(button.getAttribute('aria-label')).toContain('可入库 2/5 张');
    expect(button.disabled).toBe(false);
  });
  it('separates saved cards, recoverable cards, and probability versus rule losses', () => {
    show({ savedCards:[{card:rare,count:7}],pocketKept:20,pocketLost:58,pocketRuleLost:9,keptPocket:[{card:common,count:20}] });
    expect(document.querySelector('.exr-saved-shelf').textContent).toContain('本次已入库 7 张');
    expect(document.querySelector('.exr-pocket').textContent).toContain('待复原20 张');
    expect(document.querySelector('.exr-pocket').textContent).toContain('概率散失 49 张');
    expect(document.querySelector('.exr-pocket').textContent).toContain('9 张不可带回');
    expect(document.querySelector('[data-act=exPocketInspect]').textContent).toContain('普通卡');
    expect(document.querySelector('[data-act=exFinish]').textContent).not.toContain('放弃');
  });
  it('final gallery reads only receipt savedCards and retains full loss totals', () => {
    document.body.innerHTML=extractionDoneHTML({ cardHTML,stashUsed:28,stashCap:28,receipt:{
      outcome:'clear',savedCards:[{card:rare,count:7}],netTake:{cardsStashed:7,pocketKept:20},
      losses:{lostCount:12,pocketLost:58,pocketRuleLost:9,lostNotable:[{name:'遗失史诗',count:1}]},
    }});
    expect(document.querySelectorAll('[data-act=exDoneInspect]')).toHaveLength(1);
    expect(document.querySelector('.exr-loot').textContent).toContain('传说卡');
    expect(document.querySelector('.exr-loot').textContent).not.toContain('遗失史诗');
    expect(document.querySelector('.exr-loss').textContent).toContain('未入库 12 张');
    expect(document.querySelector('.exr-loss').textContent).toContain('消耗区散失 58 张');
    expect(document.querySelectorAll('[data-act=goBase]')).toHaveLength(1);
    expect(document.body.textContent).not.toContain('满载而归');
  });
  it('has an honest zero-saved state and escapes card metadata', () => {
    document.body.innerHTML=extractionDoneHTML({cardHTML,receipt:{netTake:{cardsStashed:0}}});
    expect(document.body.textContent).toContain('本次没有卡牌入库');
    show({remainingCards:[{card:{name:'<img src=x onerror=evil()>',rarity:'史诗'},count:1}],room:1});
    expect(document.querySelector('img')).toBeNull();
    expect(document.body.textContent).toContain('<img src=x onerror=evil()>');
  });
});

// The legacy full-page shell hides all h2 elements. This flow must explicitly restore its success heading.
it('restores its success heading and full-size shell without reopening unrelated page headings', () => {
  const css=readCssSource('game/css/extraction-rewards.css','utf8');
  document.body.innerHTML=`<style>#overlay .card.page h2{display:none}${css}</style><div id="overlay"><div class="card page"><h2 id="ovTitle">Legacy title</h2><div id="ovBody">${extractionStashHTML({cardHTML})}</div></div></div>`;
  expect(getComputedStyle(document.querySelector('.exr-success-title')).display).toBe('block');
  expect(getComputedStyle(document.querySelector('#ovTitle')).display).toBe('none');
  expect(getComputedStyle(document.querySelector('#ovBody')).maxWidth).toBe('none');
});


it('keeps rules and loss details folded while irreversible decisions remain visible', () => {
  show({remainingCards:[{card:rare,count:5}],room:2,pocketKept:3,pocketLost:7});
  expect(document.querySelector('.exr-pocket-list').open).toBe(false);
  expect(document.querySelector('.exr-left-behind').open).toBe(false);
  expect(document.querySelector('.exr-pocket-loss').closest('details')).not.toBeNull();
  expect(document.querySelector('.exr-finish-note').closest('details')).toBeNull();
  expect(document.querySelector('.exr-finish-note').textContent).toContain('永久失去');
  expect(document.querySelector('.exr-notice').textContent).toBe('');
  expect(document.querySelector('.exr-deposit small')).toBeNull();
  document.body.innerHTML=extractionDoneHTML({cardHTML,receipt:{netTake:{cardsStashed:0},losses:{lostCount:5,pocketLost:7}}});
  expect(document.querySelector('.exr-loss').open).toBe(false);
  expect(document.querySelector('.exr-expedition-details').open).toBe(false);
  expect(document.querySelector('.exr-run-facts').closest('details')).not.toBeNull();
});

it('renders mixed resource totals directly without combining pocket and warehouse cards', () => {
  document.body.innerHTML=extractionDoneHTML({cardHTML,receipt:{savedCards:[{card:rare,count:2}],netTake:{cardsStashed:2,pocketKept:3,wood:9,rations:4}}});
  expect(document.querySelector('.exr-section-title h3').textContent).toBe('已入库 2 张');
  expect(document.querySelector('.exr-resources').textContent).toContain('×9');
  expect(document.querySelector('.exr-resources').textContent).toContain('×4');
  expect(document.querySelector('.exr-pocket-count').textContent).toBe('3 张');
  expect(document.querySelectorAll('[data-act=exDoneInspect]')).toHaveLength(1);
});


it('labels brought counts as historical rather than attributing the remaining stack', () => {
  show({remainingCards:[{card:common,count:3}],savedCards:[{card:common,count:2}],room:0,broughtByName:new Map([[common.name,2]])});
  const history=document.querySelector('.exr-brought');
  expect(history.textContent).toBe('出发曾带入 ×2');
  expect(history.title).toContain('不代表剩余卡的来源');
  expect(history.title).toContain('不区分携入或局内获得');
  expect(document.querySelector('.exr-finish-note').textContent).toContain('带入卡同样适用');
  expect(document.querySelector('.exr-finish-note').textContent).not.toContain('含出发带入卡');
  expect(document.querySelector('.exr-item-meta').textContent).toContain('×3');
});


it('estimate wording is explicit and loss confirmation escapes every name with bounded scrolling', () => {
  show({ remainingCards: [{ card: { ...common, name: '<script>unsafe</script>' }, count: 12 }], room: 2, confirmFinish: true });
  const smart = document.querySelector('[data-act=exSmart]');
  expect(smart.textContent).toContain('按估值入库 2 张');
  expect(smart.title).toContain('同估值按背包原次序');
  expect(smart.title).toContain('不表示卡牌可以出售');
  expect(document.querySelector('.exr-sort-note').textContent).toBe('按估值从高到低');
  expect(document.querySelector('.exr-confirm-list').textContent).toContain('<script>unsafe</script>×12');
  expect(document.querySelector('script')).toBeNull();
  expect(document.querySelector('[data-act=exFinish]')).toBeNull();
  expect(document.querySelector('[data-act=exCancelFinish]').classList.contains('exr-primary')).toBe(true);
  expect(document.querySelector('[data-act=exConfirmFinish]').textContent).toBe('确认放弃 12 张并完成');
  const css = readCssSource('game/css/extraction-rewards.css', 'utf8');
  expect(css).toMatch(/\.exr-confirm-list\s*\{[^}]*max-height:120px;[^}]*overflow-y:auto/);
  expect(document.querySelector('.exr-confirm-actions').closest('.exr-confirm-list')).toBeNull();
});
