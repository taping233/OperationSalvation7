// @vitest-environment node
// WF-xart-z1 批次2 三项表现增强的定向回归（研究来源：docs/evidence/2026-10-03-WF-xart-z1/）：
//   A5-DEATH-01   死亡结算页补 losses 明细行（读 token.receipt.losses）
//   A5-EXSTASH-01 整理入库页区分带入卡（o.brought 角标）
//   A3-PREP-02(b) 预设预览按分段占格计容（同名超 cap 多占格）
// 批次4 追加：
//   A5-ABANDON-01 放弃页抢运清单由纯文本改为 doom-loot 卡面网格（与死亡页同视觉语言）
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { extractionStashHTML } from '../game/src/ui/extraction-rewards-view.js';

const death = readFileSync('game/src/run/game.session.death.js', 'utf8');
const altar = readFileSync('game/src/run/game.run.altar.js', 'utf8');
const depart = readFileSync('game/src/hub/game.hub.depart.js', 'utf8');
const menu = readFileSync('game/src/ui/game.menu.pages.js', 'utf8');

let commands;
beforeAll(async () => {
  commands = await import('../game/src/hub/preparation.commands.js');
});

describe('A5-DEATH-01 死亡页展示关键损失明细', () => {
  it('doom-panel 消费 token.receipt.losses 逐名表达', () => {
    expect(death).toContain('token.receipt?.losses');
    expect(death).toContain('deathLoss.lostNotable.map(c => `【${esc(c.name)}】`)');
    expect(death).toContain("uiDisclosure({label:'物资明细与保留规则',className:'doom-details'");
    expect(death).toContain('${lossDetails}');
  });
});

describe('A5-DEATH-02 死亡抢运张数与回执同口径', () => {
  it('finish 的 savedN 读 token.cards（含珍珠盒中 stored 资源卡），与回执 cardsStashed 同源', () => {
    expect(death).toContain('const savedN = token.cards.reduce((a, b) => a + (b.count || 1), 0);');
    // token.cards 即 doDeath 传入 buildDeathReceipt 的 rescuedCards（每条 count:1，按条数求和恒等）
    expect(death).toContain('rescuedCards: cards');
    expect(death).toContain('A5-DEATH-02');
    // 旧口径（cardStacks(true) 安全格堆叠）不再用于张数统计；卡面列表/recordRun 的 token.saved 保留
    expect(death).not.toContain('token.saved.reduce');
  });
});

describe('A5-ABANDON-01 放弃页抢运清单卡面网格', () => {
  it('keptHTML 有卡分支复用 doom-loot 卡面网格形态（与死亡页同视觉语言）', () => {
    expect(menu).toContain('doom-loot');
    expect(menu).toContain('doom-cards');
    expect(menu).toContain('SDT.Cards.cardHTML(s.card, \'sm\')');
    // 封顶 6 张 + 溢出行，与死亡页 token.saved 同构
    expect(menu).toContain('slice(0, 6)');
    expect(menu).toContain('doom-more');
  });
  it('放弃页不包裹 doom-panel（保持标准 overlay 卡片外观），空清单仍为纯文本 ov-note', () => {
    expect(menu).not.toContain('doom-panel');
    expect(menu).toContain('安全格里没有对局中获得的卡牌');
  });
});

describe('A5-EXSTASH-01 整理页带入卡角标', () => {
  it('renderExtractStash 按 o.brought 计数，纯展示页标注出发曾带入记录', () => {
    expect(altar).toContain('broughtByName');
    expect(altar).toContain('if (o.brought) broughtByName.set(o.card.name');
    const card={id:'brought-card',name:'携入卡',rarity:'稀有',type:'武术'};
    const options={remainingCards:[{card,count:3}],room:3,cardHTML:item=>item.name};
    const html=extractionStashHTML({...options,broughtByName:new Map([[card.name,2]])});
    expect(html).toContain('class="exr-brought"');
    expect(html).toContain('出发曾带入 ×2');
    expect(html).toContain('不代表剩余卡的来源');
    expect(extractionStashHTML(options)).not.toContain('class="exr-brought"');
  });
});

describe('A3-PREP-02 预设预览按分段占格计容', () => {
  const card = { id: 'card-a', name: '北境短刀', rarity: '普通', type: '武术' };
  const preset5 = {
    id: 'preset-1', name: '堆叠', characterId: null, petId: null,
    picks: [{ card: { cardId: card.id }, count: 5 }],
  };
  const base = { stash: [{ card, count: 5 }], characters: {}, pets: {} };
  const args = { baseSnapshot: base, preset: preset5, mode: 'standard', cardCatalog: [card], characters: [], pets: [] };

  it('同名 5 张按 cap=3 分段占 2 格（不再是种类数 1 格）', () => {
    const preview = commands.previewDeployment({ ...args, bagCapacity: 16 });
    expect(preview.costs.slotsUsed).toBe(4);   // 普通牌 ceil(5/3)=2 + 初始攻击 ceil(5/3)=2
    expect(preview.costs.extraStackSlots).toBe(2);
    expect(preview.canStart).toBe(true);
  });

  it('容量判定按分段格数：3 格容量装不下（5 张同名 + 5 张初始攻击）', () => {
    const preview = commands.previewDeployment({ ...args, bagCapacity: 3 });
    expect(preview.costs.slotsUsed).toBe(4);
    expect(preview.canStart).toBe(false);
    expect(preview.errors).toContain('BAG_CAPACITY_EXCEEDED');
  });

  it('整备文案不再把来源封顶说成局内规则（帮助分段已按 10-04 老板令整体移除，保留上限提示口径）', () => {
    expect(depart).toContain('每格叠放上限，局内超出会另占一格');
    expect(depart).not.toContain('超出部分另占一格');
  });
});
