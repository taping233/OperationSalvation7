import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { altarRitualHTML, altarRewardHTML, entrySupplyIntroHTML } from '../game/src/ui/node-decision-view.js';
import { uiDecisionChoice, uiDecisionFacts } from '../game/src/ui/ui-decision.js';
const show = html => { document.body.innerHTML = html; };
const visibleText = () => {
  const copy = document.body.cloneNode(true);
  copy.querySelectorAll('details').forEach(node => node.remove());
  return copy.textContent;
};
const ritual = overrides => altarRitualHTML({ fragments:2, capacity:'16/16 格', availableCards:3, hasItem:true, itemUsed:false, restorable:5, ...overrides });

describe('shared node decision pages', () => {
  it('ritual retains all costs, rewards, capacity and irreversible consequences without opening help', () => {
    show(ritual());
    const text = visibleText();
    for (const fact of ['16/16 格', '3 张', '2 枚', '永久失去', '只能选一次', '复原至多 3 张', '回复 10 血', '1 张传说卡', '1 张装备卡', '本职业随机能力卡', '放不下时不扣碎片', '献祭 1 张道具', '每座祭坛限一次']) expect(text).toContain(fact);
    expect(document.querySelectorAll('.ui-choice')).toHaveLength(3);
    expect(document.querySelector('.ui-disclosure').open).toBe(false);
    expect(document.querySelector('.event-choice-confirm')).toBeNull();
  });
  it('unavailable alternatives keep a readable visible reason', () => {
    show(ritual({fragments:1,hasItem:false,availableCards:1}));
    expect(document.querySelector('[data-act="altarFragLocked"]').disabled).toBe(true);
    expect(document.querySelector('[data-act="altarItemNoItem"]').disabled).toBe(true);
    expect(visibleText()).toContain('碎片不足：现有 1/2 枚');
    expect(visibleText()).toContain('背包里没有道具卡');
    expect(visibleText()).toContain('可献祭卡不足 3 张');
  });
  it('used item offering stays disabled and short pools state the actual maximum', () => {
    show(ritual({ itemUsed:true }));
    expect(document.querySelector('[data-act="altarItemUsed"]').disabled).toBe(true);
    show(ritual({restorable:1}));
    expect(document.querySelector('[data-act="altarItemRestore"]').textContent).toContain('至多 1 张');
  });
  it('reward choice distinguishes quantity, capacity, once-only choice and saved pending rewards', () => {
    show(altarRewardHTML({capacity:'16/16 格',restorable:1}));
    const text = visibleText();
    for (const fact of ['16/16 格','复原至多 1 张','回复 10 血','只能选一次','另一项不可领取','离开可保留','随机获取各 1 张','放不下的奖励保留待领']) expect(text).toContain(fact);
    expect(document.querySelector('[data-act="altarRewardRestore"]').disabled).toBe(false);
  });
  it('empty restore pool keeps the alternative visible and disabled', () => {
    show(altarRewardHTML({capacity:'0/16 格',restorable:0}));
    expect(document.querySelector('[data-act="altarRewardRestoreOff"]').disabled).toBe(true);
    expect(visibleText()).toContain('没有可复原的卡牌');
    expect(document.querySelector('[data-act="altarRewardLoot"]').disabled).toBe(false);
  });
  it('entry supplies show exact total, capacity and route gate once, before explanation', () => {
    show(entrySupplyIntroHTML({count:3, character:'白塔', capacity:'16/16 格'}));
    expect(visibleText()).toContain('3 张');
    expect(visibleText()).toContain('16/16 格');
    expect(visibleText()).toContain('白塔的职业卡');
    expect(visibleText().match(/全部领取后才能继续探索/g)).toHaveLength(1);
    expect(document.querySelector('[data-act="clsEntryReveal"]')).not.toBeNull();
  });
  it('shared text and attributes are escaped', () => {
    show(uiDecisionChoice({ action:'" onclick="bad',label:'<img src=x>',detail:'<script>bad</script>',disabled:true }) + uiDecisionFacts([['<b>label</b>','<img src=x>']]));
    expect(document.querySelector('img,script')).toBeNull();
    expect(document.querySelector('button').hasAttribute('onclick')).toBe(false);
    expect(document.querySelector('button').getAttribute('aria-disabled')).toBe('true');
  });
  it('production altar page identities retain the dedicated altar icon and source action guards', () => {
    const source = readFileSync('game/src/run/game.run.altar.js','utf8');
    expect(source).toContain("icon: '[[icon:altar]]', title: '污染祭坛'");
    expect(source).toContain("icon: '[[icon:altar]]', title: '祭坛回赠 · 二选一'");
    expect(source).toContain("altarPageBinding('altarOn3')");
    expect(source).toContain("altarPageBinding('altarRewardLeave')");
  });
});
