import { describe, expect, it } from 'vitest';
import { buildRunMemento } from '../game/src/run/run-memento.js';
import { buildExtractionReceipt } from '../game/src/hub/extraction.commands.js';
import { extractionDoneHTML } from '../game/src/ui/extraction-rewards-view.js';
import { runMementoHTML } from '../game/src/ui/run-memento-view.js';
import { claimEncounterOpening, commissionGoodsHTML, encounterOpeningHTML } from '../game/src/ui/encounter-presentation.js';

const source = () => ({ layerIdx:1, trackPos:0, turn:4, coins:6,
  layerData:[{ name:'外围荒地', logical:[{}, {}] }, { name:'风雪哨线', logical:[{}] }],
  explored:{ '0,0':1, '0,1':1, '1,0':1, '9,9':1, bogus:1 },
  eventLog:[{ name:'封存储备库' }, { name:'封存储备库' }],
  nodeRewards:{ '0,1':{ type:'closed', commission:{ status:'pending' } } },
  ownedCards:[{ card:{ name:'已带回', rarity:'稀有' } }, { card:{ name:'未入库', rarity:'传说' } }],
});

describe('真实本局纪念', () => {
  it('只统计有效首探地点，重复事件合并；不把未兑付写成交付', () => {
    const game = source(), before = JSON.stringify(game);
    const memento = buildRunMemento(game, [{ card:{ name:'已带回', rarity:'稀有' }, count:1 }]);
    expect(memento.trail).toEqual([{ layer:1, name:'外围荒地', count:2 }, { layer:2, name:'风雪哨线', count:1 }]);
    expect(memento.moments).toEqual(['你接下了运输员的接应凭据，这次还未兑付。', '途中遇见「封存储备库」。']);
    expect(memento.representative).toEqual({ name:'已带回', count:1 });
    expect(JSON.stringify(game)).toBe(before);
  });
  it('回执只选实际入库卡；序列化重放保留同一段纪念', () => {
    const game = source();
    game.nodeRewards['0,1'].commission.status = 'applied';
    const receipt = buildExtractionReceipt({ game, pending:{ remainingCards:[{ card:{ name:'未入库', rarity:'传说' }, count:1 }] } });
    const saved = JSON.parse(JSON.stringify(receipt));
    game.nodeRewards = {}; game.eventLog = [];
    expect(saved.memento.representative.name).toBe('已带回');
    expect(saved.memento.moments[0]).toContain('付清了两格商品');
    const root = document.createElement('div');
    root.innerHTML = extractionDoneHTML({ receipt:saved, cardHTML:card => card.name });
    expect(root.querySelector('[aria-label="本局纪念"]').textContent).toContain('已带回');
    expect(root.querySelector('[data-act="goBase"]')).not.toBeNull();
    expect(root.querySelector('.run-memento').textContent).not.toContain('未入库');
  });
  it('失败局只以抢运清单作纪念物，不虚构撤离决定；旧回执保持可用', () => {
    const game = source();
    const html = runMementoHTML(buildRunMemento(game, []), { failed:true });
    expect(html).toContain('脚步止于此');
    expect(html).not.toContain('纪念：');
    expect(html).not.toContain('放弃了紧急撤离');
    expect(runMementoHTML(null)).toBe('');
    expect(buildRunMemento({})).toBeNull();
    expect(extractionDoneHTML({ receipt:{} })).toContain('返回基地');
  });
  it('只记三条已证实经历，转义事件名、地点和纪念物', () => {
    const game = { ...source(), altarActivated:true, bossKilled:true };
    game.nodeRewards['0,1'].commission.status = 'applied';
    expect(buildRunMemento(game).moments).toHaveLength(3);
    const html = runMementoHTML({ version:1, trail:[{ layer:1, name:'<img src=x>', count:1 }],
      moments:['<script>bad()</script>'], representative:{ name:'<svg>', count:1 } });
    const root = document.createElement('div'); root.innerHTML = html;
    expect(root.querySelector('script, img, svg')).toBeNull();
  });
  it('失败回执保存的是倒下时已抢运的物品', async () => {
    window.SDT ||= { UI:{} };
    const { buildDeathReceipt } = await import('../game/src/run/game.session.death.js');
    const game = { ...source(), usedPocket:[] };
    const receipt = buildDeathReceipt({ game, rescuedCards:[{ card:{ name:'安全格里的木材', rarity:'古朴' }, count:1 }] });
    expect(receipt.memento.representative).toEqual({ name:'安全格里的木材', count:1 });
    expect(receipt.netTake.cardsStashed).toBe(1);
    expect(receipt.memento.moments.join('')).not.toContain('撤离成功');
  });
});

describe('非阻塞遭遇与凭据呈现', () => {
  it('仅指定特殊节点显示提示，重复开页保留信息且不再入场，换局重新允许', () => {
    const game = { layerIdx:3, trackPos:1, layerData:[] };
    expect(claimEncounterOpening(game, 'altar')).toBe(true);
    expect(claimEncounterOpening(game, 'altar')).toBe(false);
    game.layerData = [];
    expect(claimEncounterOpening(game, 'altar')).toBe(true);
    expect(encounterOpeningHTML('ordinary')).toBe('');
    const root = document.createElement('div');
    root.innerHTML = encounterOpeningHTML('tt6-mystery', { animate:true });
    expect(root.textContent).toContain('备用电源接通');
    expect(root.querySelector('button, [inert], [aria-busy]')).toBeNull();
    expect(encounterOpeningHTML('altar')).not.toContain('is-entering');
  });
  it('兑付页展示两个真实货位；神秘箱不揭示内容，呈现不更改价格和库存', () => {
    const stock = [{ card:{ name:'<火球>' }, price:0, free:true }, { card:{ name:'隐藏物品' }, mystery:true, price:0, free:true }];
    const before = JSON.stringify(stock), root = document.createElement('div');
    root.innerHTML = commissionGoodsHTML([0, 1], stock);
    expect(root.querySelectorAll('.commission-good')).toHaveLength(2);
    expect(root.textContent).toContain('商品仍在货架');
    expect(root.textContent).not.toContain('隐藏物品');
    expect(root.querySelectorAll('del')).toHaveLength(2);
    expect(JSON.stringify(stock)).toBe(before);
  });
});
