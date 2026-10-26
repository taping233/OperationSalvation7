// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { RULE_CONFIG } from '../game/src/core/rule-config.js';
import { extractionPocketOutcome } from '../game/src/hub/extraction.commands.js';
import { extractionDoneHTML, extractionStashHTML } from '../game/src/ui/extraction-rewards-view.js';
import { tileHTML } from '../game/src/hub/game.bag.view2.js';
import SDT from '../game/src/core/sdt-facade.js';

// Keep probability, actual retained counts, and key cost truthful across current presentation modules.
const altar = readFileSync('game/src/run/game.run.altar.js', 'utf8');
const bag = readFileSync('game/src/hub/game.bag.js', 'utf8') + readFileSync('game/src/hub/game.bag.view2.js', 'utf8');
const departure = readFileSync('game/src/run/game-session-departure.js', 'utf8');
const render = html => { document.body.innerHTML = html; return document.body.textContent; };

describe('EXP-003 撤离消耗区文案与规则一致', () => {
  it('规则权威为 1/3，整理页按真实待复原卡展示概率，完成页显示实际结果', () => {
    expect(RULE_CONFIG.extraction.pocketKeepChance).toBeCloseTo(1 / 3);
    for (const html of [extractionStashHTML({pocketKept:1})]) {
      expect(render(html)).toContain('逐张 1/3 概率保留');
      expect(document.body.textContent).not.toContain('自动回收');
      expect(document.body.textContent).toContain('用钥匙复原后才能携带');
    }
    expect(altar).toContain('消耗区逐张以 1/3 概率结算');
    expect(bag).toContain('消耗区逐张以 1/3 概率结算');
    expect(bag).toContain('初始攻击和职业卡即使掷中也不带回基地消耗区');
  });

  it('帮助区分概率保留、职业/初始攻击规则损失以及钥匙复原', () => {
    expect(altar).not.toContain('自动回收');
    expect(altar).toContain('初始攻击与职业卡不能带回基地');
    expect(altar).toContain('其余实际保留的卡进入基地消耗区，需用钥匙复原');
  });

  it('当前计数管线展示真实带回/散失，不把规则过滤卡算成待复原', () => {
    const pending = { totalPocketCount: 10, lostPocketCount: 4, keptPocket: [
      { card: { name: '普通卡', rarity: '古朴' }, count: 3 },
      { card: { name: '职业卡', rarity: '职业' }, count: 2 },
      { card: { name: '初始攻击' }, count: 1 },
    ] };
    const pocket = extractionPocketOutcome(pending, card => card.name === '初始攻击');
    expect(pocket).toMatchObject({ keptCount: 3, lostCount: 7, ruleLost: 3 });
    const options = { pocketKept: pocket.keptCount, pocketLost: pocket.lostCount,
      pocketRuleLost: pocket.ruleLost, keptPocket: pocket.keptCards, cardHTML: c => c.name };
    render(extractionStashHTML(options));
    expect(document.querySelector('.exr-pocket-count').textContent).toBe('3 张');
    expect(document.querySelector('.exr-pocket-loss').textContent).toContain('概率散失 4 张');
    expect(document.querySelector('.exr-pocket-loss').textContent).toContain('初始攻击/职业卡 3 张不可带回');
    expect(document.querySelectorAll('[data-act=exPocketInspect]')).toHaveLength(1);
    expect(document.querySelector('[data-act=exPocketInspect]').textContent).toContain('普通卡');
    render(extractionDoneHTML({ receipt: { netTake: { pocketKept: 3 }, losses: { pocketLost: 7, pocketRuleLost: 3 } } }));
    expect(document.querySelector('.exr-receipt-details summary').textContent).toContain('待复原 3 张');
    expect(document.querySelector('.exr-receipt-details').textContent).toContain('消耗区散失 7 张');
    expect(altar).toContain('pocketKept: pocket.keptCount, pocketLost: pocket.lostCount, pocketRuleLost: pocket.ruleLost');
  });

  it('局内背包明确概率与钥匙，不承诺免费复原整袋', () => {
    expect(bag).not.toContain('免费复原');
    expect(bag).not.toContain('基地/火堆可复原');
    expect(bag).toContain('消耗区逐张以 1/3 概率结算');
    expect(bag).toContain('其余实际带回的牌可用钥匙复原');
    expect(bag).toContain('每次随机复原最多 2 张；道具和装备不能在火堆复原');
    expect(bag).toContain('能源结晶按消耗区顺序复原最多 3 张，也能复原道具和装备');
    const previousCards=SDT.Cards;
    SDT.Cards={...previousCards,cardHTML:card=>card.name};
    try {
      for(const [type,status] of [['法术','火堆可复原'],['道具','火堆不可复原'],['装备','火堆不可复原']]) {
        const card={id:type,name:type,type};
        render(tileHTML({card,name:card.name,type,count:3,zone:'pocket'}));
        expect(document.querySelector('.bag-tstate').textContent).toBe(status);
        expect(document.querySelector('.bag-tct').textContent).toBe('×3');
      }
    } finally { SDT.Cards=previousCards; }
  });

  it('结算日志报告实际带回与全部散失，出发提示未复原卡消散', () => {
    expect(altar).toContain('张逐张以 1/3 概率结算；实际带回 ${pocket.keptCount} 张待复原，散失 ${pocket.lostCount} 张');
    expect(departure).toContain('张未复原的卡牌消散了');
  });
});
