/* 背包道具基线：通过真实背包 UI 与状态入口验证道具效果、uid 去向和容量约束。 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

window.HTMLCanvasElement.prototype.getContext = () => ({
    measureText: () => ({ width: 10 }), clearRect() {}, fillRect() {}, drawImage() {},
    save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, arc() {}, fill() {}, stroke() {},
    setTransform() {}, resetTransform() {}, createLinearGradient: () => ({ addColorStop() {} }),
});
window.Audio = window.Audio || class { play() { return Promise.resolve(); } pause() {} load() {} addEventListener() {} };
window.fetch = globalThis.fetch = () => Promise.resolve({ ok: true, status: 200, json: async () => ({ version: 'test' }) });
{
  const html = readFileSync(resolve(process.cwd(), 'game/index.html'), 'utf8');
  document.head.innerHTML = '';
  document.body.innerHTML = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)[1].replace(/<script[\s\S]*?<\/script>/g, '');
}

let game, session, bag, elixir, crystal, sampleCard;
beforeAll(async () => {
  const timerNames = ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
    'requestAnimationFrame', 'cancelAnimationFrame'];
  vi.useFakeTimers({ toFake: timerNames });
  // jsdom's window can retain a distinct timer wrapper from the fake global.
  for (const name of timerNames) {
    if (window[name] !== globalThis[name]) vi.spyOn(window, name).mockImplementation(globalThis[name]);
  }
  for (const surface of [globalThis, window]) {
    const before = vi.getTimerCount();
    const timeout = surface.setTimeout(() => {}, 1000);
    const interval = surface.setInterval(() => {}, 1000);
    const frame = surface.requestAnimationFrame(() => {});
    expect(vi.getTimerCount()).toBe(before + 3);
    surface.clearTimeout(timeout);
    surface.clearInterval(interval);
    surface.cancelAnimationFrame(frame);
    expect(vi.getTimerCount()).toBe(before);
  }
  await import('../game/src/main.js');
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  await vi.advanceTimersByTimeAsync(0);
  session = await import('../game/src/run/game.session.js');
  bag = await import('../game/src/hub/game.bag.js');
  game = session.game;
  elixir = window.SDT.Cards.all().find(c => c.id === 'tt3-savior-elixir');
  crystal = window.SDT.Cards.all().find(c => c.id === 'tt-crystal');
  sampleCard = window.SDT.Cards.all().find(c => c.type === '法术' || c.type === '攻击');
});

afterAll(() => {
  try {
    vi.clearAllTimers();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    try { vi.useRealTimers(); } finally { vi.restoreAllMocks(); }
  }
});

function setScenario({ hp = 20, maxHp = 100, ownedCards = [], usedPocket = [], inventory = [] } = {}) {
  Object.assign(game, {
    runActive: true, myClass: '剑士', battleActive: false, state: 'idle', hp, maxHp,
    ownedCards, usedPocket, inventory, safeCards: [], fragments: 0,
  });
}

async function useItem(cardId, uid) {
  bag.showBackpack();
  const card = typeof cardId === 'string' ? window.SDT.Cards.all().find(c => c.id === cardId) : cardId;
  const inspect = [...document.querySelectorAll('.bag-grid [data-act="inspectStack"]')]
    .find(el => el.dataset.name === card.name);
  expect(inspect, `背包 UI 未渲染道具 ${cardId}`).toBeTruthy();
  inspect.click();
  const zoom = document.getElementById('cardZoom');
  expect(zoom).toBeTruthy();
  const use = zoom.querySelector('[data-act="useDetailCard"]');
  expect(use).toBeTruthy();
  use.click();
  // Disabled restoration keeps its detail open; close it before the next isolated scenario.
  if (use.disabled) zoom.querySelector('.cz-backdrop')?.click();
  await vi.advanceTimersByTimeAsync(280);
  return uid;
}

describe('背包道具旧行为基线', () => {
  it('斗神酒满血时不消耗 uid 或改变生命值', async () => {
    const uid = 'baseline-elixir-full';
    setScenario({ hp: 100, maxHp: 100, ownedCards: [{ uid, card: { ...elixir } }] });
    await useItem('tt3-savior-elixir', uid);
    expect(game.hp).toBe(100);
    expect(game.ownedCards.map(o => o.uid)).toContain(uid);
  });

  it('斗神酒非满血时消耗道具 uid 并按生命上限治疗', async () => {
    const uid = 'baseline-elixir-injured';
    setScenario({ hp: 35, maxHp: 100, ownedCards: [{ uid, card: { ...elixir } }] });
    await useItem('tt3-savior-elixir', uid);
    expect(game.hp).toBe(100);
    expect(game.ownedCards.some(o => o.uid === uid)).toBe(false);
  });

  it('能源结晶复原最多三张并把新 uid 放回 ownedCards', async () => {
    const crystalUid = 'baseline-crystal-three';
    setScenario({
      ownedCards: [{ uid: crystalUid, card: { ...crystal } }],
      usedPocket: [{ card: { ...sampleCard }, count: 4 }],
    });
    await useItem('tt-crystal', crystalUid);
    const restored = game.ownedCards.filter(o => o.card.id === sampleCard.id);
    expect(game.ownedCards.some(o => o.uid === crystalUid)).toBe(false);
    expect(restored).toHaveLength(3);
    expect(new Set(restored.map(o => o.uid)).size).toBe(3);
    expect(restored.every(o => typeof o.uid === 'string' && o.uid.length > 0)).toBe(true);
    expect(game.usedPocket.reduce((n, p) => n + p.count, 0)).toBe(1);
  });

  it('背包容量不足时只复原可容纳数量，剩余留在消耗区', async () => {
    const uid = 'baseline-crystal-capacity';
    const filler = Array.from({ length: session.bagCap() - 1 }, (_, i) => ({
      name: `容量占位物资${i}`, value: 1, count: 1, tier: '普通',
    }));
    setScenario({
      ownedCards: [{ uid, card: { ...crystal } }], inventory: filler,
      usedPocket: [{ card: { ...sampleCard }, count: 3 }],
    });
    await useItem('tt-crystal', uid);
    expect(game.ownedCards.some(o => o.uid === uid)).toBe(false);
    expect(game.ownedCards.filter(o => o.card.id === sampleCard.id)).toHaveLength(1);
    expect(game.usedPocket.reduce((n, p) => n + p.count, 0)).toBe(2);
    expect(session.usedSlots()).toBe(session.bagCap());
  });

  it('消耗区为空时能源结晶不消耗', async () => {
    const uid = 'baseline-crystal-empty';
    setScenario({ ownedCards: [{ uid, card: { ...crystal } }], usedPocket: [] });
    await useItem('tt-crystal', uid);
    expect(game.ownedCards.map(o => o.uid)).toContain(uid);
    expect(game.usedPocket).toHaveLength(0);
  });

  it('结构化治疗读取 card.heal；改写名称/描述不改变治疗量且只消费一次', async () => {
    const uid = 'structured-heal-once';
    const card = {
      ...elixir, name: '改名后的药剂', desc: '无关说明，旧文本提到回复 4 点生命。', heal: 30,
      rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } },
    };
    setScenario({ hp: 45, maxHp: 100, ownedCards: [{ uid, card }] });
    await useItem(card, uid);
    expect(game.hp).toBe(75);
    expect(game.ownedCards.filter(o => o.uid === uid)).toHaveLength(0);
  });

  it('结构化治疗满血不消耗道具 uid', async () => {
    const uid = 'structured-heal-full';
    const card = {
      ...elixir, name: '满血测试酒', desc: '描述不包含治疗信息。', heal: 25,
      rules: { version: 1, bag: { use: [{ op: 'heal', amountField: 'heal' }] } },
    };
    setScenario({ hp: 100, maxHp: 100, ownedCards: [{ uid, card }] });
    await useItem(card, uid);
    expect(game.hp).toBe(100);
    expect(game.ownedCards.some(o => o.uid === uid)).toBe(true);
  });

  it('结构化复原按声明数量执行一次，名称/描述不影响复原量', async () => {
    const uid = 'structured-restore-three';
    const card = {
      ...crystal, name: '改名后的结晶', desc: '全新的描述；旧 ID 和旧文字仍对应三张。',
      rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 3 }] } },
    };
    setScenario({
      ownedCards: [{ uid, card }], usedPocket: [{ card: { ...sampleCard }, count: 4 }],
    });
    await useItem(card, uid);
    expect(game.ownedCards.some(o => o.uid === uid)).toBe(false);
    expect(game.ownedCards.filter(o => o.card.id === sampleCard.id)).toHaveLength(3);
    expect(game.usedPocket.reduce((n, p) => n + p.count, 0)).toBe(1);
  });

  it('结构化复原遇到容量不足只恢复可放入数量', async () => {
    const uid = 'structured-restore-capacity';
    const card = {
      ...crystal, name: '容量测试结晶', desc: '改写描述，不匹配旧规则。',
      rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 3 }] } },
    };
    const filler = Array.from({ length: session.bagCap() - 1 }, (_, i) => ({
      name: `结构容量占位${i}`, value: 1, count: 1, tier: '普通',
    }));
    setScenario({
      ownedCards: [{ uid, card }], inventory: filler,
      usedPocket: [{ card: { ...sampleCard }, count: 3 }],
    });
    await useItem(card, uid);
    expect(game.ownedCards.filter(o => o.card.id === sampleCard.id)).toHaveLength(1);
    expect(game.usedPocket.reduce((n, p) => n + p.count, 0)).toBe(2);
    expect(session.usedSlots()).toBe(session.bagCap());
  });

  it('结构化复原空口袋不消费道具 uid', async () => {
    const uid = 'structured-restore-empty';
    const card = {
      ...crystal, name: '空袋测试结晶', desc: '空袋时应留存。',
      rules: { version: 1, bag: { use: [{ op: 'restoreConsumed', amount: 3 }] } },
    };
    setScenario({ ownedCards: [{ uid, card }], usedPocket: [] });
    await useItem(card, uid);
    expect(game.ownedCards.some(o => o.uid === uid)).toBe(true);
    expect(game.usedPocket).toHaveLength(0);
  });
});


describe('复原道具满包零收益保护', () => {
  it.each(['tt-crystal', 'cmtn6bge52qt'])('%s同堆两张满包时详情禁用，直接执行也不消耗', async id => {
    const card = window.SDT.Cards.all().find(c => c.id === id);
    const ownedCards = [1, 2].map(n => ({ uid:`blocked-${n}`, card }));
    const inventory = Array.from({length:session.bagCap() - 1}, (_, i) => ({name:`满包物资${i}`, count:1}));
    setScenario({ownedCards, inventory, usedPocket:[{card:{...sampleCard}, count:2}]});
    const before = JSON.stringify({owned:game.ownedCards, pocket:game.usedPocket});
    bag.showBackpack();
    const tile = [...document.querySelectorAll('[data-act="inspectStack"]')].find(el => el.dataset.name === card.name);
    expect(tile.querySelector('.bag-tstate').textContent).toBe('需腾位');
    expect(tile.querySelector('.bag-tstate').title).toContain('背包空间不足');
    tile.click();
    const use = document.querySelector('#cardZoom [data-act="useDetailCard"]');
    expect(use.disabled).toBe(true); expect(use.textContent).toContain('先腾位再复原');
    document.querySelector('#cardZoom .cz-backdrop').click();
    await vi.advanceTimersByTimeAsync(280);
    const {useStructuredBagRule} = await import('../game/src/hub/game.bag.rules.js');
    const save = vi.fn(), log = vi.fn();
    useStructuredBagRule(card, 0, {UI:{log}, SDT:window.SDT, game, Random:{}, newUid:vi.fn(), saveGame:save, showBackpack:vi.fn(), usedSlots:session.usedSlots, bagCap:session.bagCap});
    expect(JSON.stringify({owned:game.ownedCards, pocket:game.usedPocket})).toBe(before);
    expect(save).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('卡牌未消耗'), 'warn');
  });

  it('满包只剩一张结晶时可腾出其格，仍允许复原', async () => {
    const inventory = Array.from({length:session.bagCap() - 1}, (_, i) => ({name:`单张物资${i}`, count:1}));
    setScenario({ownedCards:[{uid:'last-crystal', card:crystal}], inventory, usedPocket:[{card:{...sampleCard}, count:2}]});
    bag.showBackpack();
    const tile = [...document.querySelectorAll('[data-act="inspectStack"]')].find(el => el.dataset.name === crystal.name);
    expect(tile.querySelector('.bag-tstate').textContent).toBe('可用');
    tile.click();
    const use = document.querySelector('#cardZoom [data-act="useDetailCard"]');
    expect(use.disabled).toBe(false); use.click();
    await vi.advanceTimersByTimeAsync(280);
    expect(game.ownedCards.some(o => o.uid === 'last-crystal')).toBe(false);
    expect(game.ownedCards.filter(o => o.card.name === sampleCard.name)).toHaveLength(1);
    expect(game.usedPocket[0].count).toBe(1);
  });

  it('背包帮助遵循地图营火随机复原，不混用通用手选页', () => {
    const source = readFileSync('game/src/hub/game.bag.js', 'utf8');
    expect(source).toContain('每次随机复原最多 2 张');
    expect(source).not.toContain('在营火选择要复原的卡牌');
  });
});

it('真实卡库通行证C的背包按钮可用，消费后只获得一张传说卡', async () => {
  const token=window.SDT.Cards.all().find(c=>c.id==='tt4-shine-token');
  setScenario({ownedCards:[{uid:'token-c',card:{...token}}]});
  await useItem('tt4-shine-token','token-c');
  expect(game.ownedCards).toHaveLength(1);
  expect(game.ownedCards[0].uid).not.toBe('token-c');
  expect(game.ownedCards[0].card.rarity).toBe('传说');
});
