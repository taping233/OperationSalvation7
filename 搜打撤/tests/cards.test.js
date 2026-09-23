/* cards.js 单元测试：抽卡/注能/回复/护甲词条推导 + 卡面角标（迁移自 selftest.js 第 2 节） */
import { describe, it, expect, beforeAll } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/core/art.js');

let Cards;
beforeAll(() => { Cards = window.SDT.Cards; });

const d = (desc) => Cards.deriveDraw({ desc });
const inf = (desc) => Cards.deriveInfuse({ desc });
const heal = (desc) => Cards.deriveHeal({ desc });
const armor = (desc) => Cards.deriveArmor({ desc });

describe('抽卡/注能/回复/护甲词条推导', () => {
  it('deriveDraw 抽 2 张牌', () => expect(d('摸底：抽 2 张牌。')).toBe(2));
  it('deriveDraw 优先已标注', () => expect(Cards.deriveDraw({ draw: 3, desc: '抽 2 张牌' })).toBe(3));
  it('deriveDraw 无词条', () => expect(d('造成 2 点伤害。')).toBe(0));
  it('deriveInfuse 注能(2)', () => expect(inf('注能(2)：额外施放 1 段。')).toBe(2));
  it('deriveInfuse 注能（2）全角', () => expect(inf('注能（1）：1′ 冰冻、流血、中毒。')).toBe(1));
  it('deriveInfuse 注能(小)=1', () => expect(inf('注能(小)：改为 8′。')).toBe(1));
  it('deriveInfuse 无词条', () => expect(inf('造成 3 点伤害，回复等量生命。')).toBe(0));
  it('deriveHeal 回复 6 点生命', () => expect(heal('回复 6 点生命。')).toBe(6));
  it('deriveHeal +4 血', () => expect(heal('+4 血。')).toBe(4));
  it('deriveHeal 优先结构化词条', () => expect(Cards.deriveHeal({ heal: 9, desc: '回复 2 点生命。' })).toBe(9));
  it('deriveArmor 获得 5 点护甲', () => expect(armor('获得 5 点护甲。')).toBe(5));
  it('deriveArmor +3 甲', () => expect(armor('+3 甲。')).toBe(3));
  it('deriveArmor 优先结构化词条', () => expect(Cards.deriveArmor({ armor: 8, desc: '获得 2 点护甲。' })).toBe(8));
});

describe('卡面角标', () => {
  beforeAll(() => {
    // 页面由 icons-bitmap 提供 TYPE_ART；测试环境补最小映射
    window.SDT.Icons = window.SDT.Icons || {};
    window.SDT.Icons.TYPE_ART = Cards.TYPE_ART;
  });
  it('卡面显示回复词条角标', () =>
    expect(Cards.cardHTML({ name: '疗愈', cost: 1, rarity: '初始', type: '法术', heal: 3 }).includes('回 3')).toBe(true));
  it('卡面显示护甲词条角标', () =>
    expect(Cards.cardHTML({ name: '铁壁', cost: 1, rarity: '初始', type: '武术', armor: 4 }).includes('甲 4')).toBe(true));
});

describe('出售资格与收购价', () => {
  it('固定卡按稳定 id 保持历史可出售清单，不随描述改写', () => {
    for (const id of ['tt-copper', 'tt-gold', 'tt-silver', 'tt3-diamond', 'tt3-garnet-marble']) {
      expect(Cards.isSellable({ id, desc: '效果说明已改写。' }), id).toBe(true);
    }
    expect(Cards.isSellable({ id: 'tt-crystal', desc: '可出售。' })).toBe(false);
    expect(Cards.isSellable({ id: 'cc-mana-surge', desc: '可出售。' })).toBe(false);
  });

  it('显式资格优先，非定版旧自定义卡保留描述兼容', () => {
    expect(Cards.isSellable({ id: 'tt-copper', sellable: false, desc: '可出售。' })).toBe(false);
    expect(Cards.isSellable({ id: 'tt-crystal', sellable: true, desc: '不可出售。' })).toBe(true);
    expect(Cards.isSellable({ id: 'legacy-custom-card', desc: '可出售。' })).toBe(true);
    expect(Cards.isSellable({ desc: '不可出售，也可出售。' })).toBe(false);
    expect(Cards.isSellable({ id: 'legacy-custom-card' })).toBe(false);
  });

  it('收购价优先使用币值，且不读取描述', () => {
    expect(Cards.sellPrice({ id: 'tt3-diamond', value: 16, desc: '改写后的说明。' })).toBe(16);
  });
});

describe('指定道具定名迁移', () => {
  it('按稳定 id 改名并合并旧内置金疮药', () => {
    const key = 'sdt-cards-item-renames-v1';
    const previousCards = Cards.all().map(card => ({ ...card }));
    const previousMarker = localStorage.getItem(key);
    try {
      localStorage.removeItem(key);
      Cards.saveAll([
        { id: 'tt-medneedle', name: '医疗针', type: '道具' },
        { id: 'tt3-savior-elixir', name: '救世灵药', type: '道具' },
        { id: 'builtin-jinchuangyao', name: '金疮药', type: '道具' },
        { id: 'tt-jinchuangyao', name: '金创药', type: '道具' },
      ]);
      Cards.ensureItemRenames();
      expect(Cards.all().map(card => [card.id, card.name])).toEqual([
        ['tt-medneedle', '急救合剂'],
        ['tt3-savior-elixir', '斗神酒'],
        ['tt-jinchuangyao', '金疮药'],
      ]);
    } finally {
      Cards.saveAll(previousCards);
      if (previousMarker == null) localStorage.removeItem(key);
      else localStorage.setItem(key, previousMarker);
    }
  });
});

describe('同名异 ID 卡牌定名迁移', () => {
  it('仅按稳定 ID 给后定义版本追加「-改」，且可重复执行', () => {
    const cards = [
      { id: 'cc-unmoved', name: '不变应万变' },
      { id: 'tt7-imitate', name: '不变应万变' },
      { id: 'tt2-jianghu', name: '江湖救急' },
      { id: 'cmtn1wnhhym', name: '江湖救急' },
    ];
    expect(Cards.applyDuplicateRenames(cards)).toBe(true);
    expect(cards.map(card => card.name)).toEqual(['不变应万变', '不变应万变-改', '江湖救急', '江湖救急-改']);
    expect(Cards.applyDuplicateRenames(cards)).toBe(false);
  });
});

describe('道具专属图片映射', () => {
  beforeAll(() => {
    window.SDT.Icons = window.SDT.Icons || {};
    window.SDT.Icons.TYPE_ART = Cards.TYPE_ART;
  });
  it('稳定 id 使用对应透明道具素材', () => {
    const html = window.SDT.Art.cardIcon({ id: 'tt3-savior-elixir', name: '斗神酒', type: '道具' });
    expect(html).toContain('cards/items/tt3-savior-elixir.webp');
  });
});
