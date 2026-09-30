import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KEY as CARDS_KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { RunStorage } from '../game/src/hub/game.storage.js';

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

const MIGRATION_KEY = 'sdt-cards-bag-use-v2-seeded';
let Cards, game, bag, sampleCard;
beforeAll(async () => {
  await import('../game/src/main.js');
  document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
  await new Promise(resolveTick => setTimeout(resolveTick, 0));
  ({ game } = await import('../game/src/run/game.session.js'));
  bag = await import('../game/src/hub/game.bag.js');
  Cards = window.SDT.Cards;
  sampleCard = Cards.all().find(card => card.type === '法术' || card.type === '攻击');
});
afterAll(() => { vi.restoreAllMocks(); });

function setScenario({ hp = 20, maxHp = 100, ownedCards = [], usedPocket = [], inventory = [] } = {}) {
  Object.assign(game, {
    runActive: true, myClass: '剑士', battleActive: false, state: 'idle', hp, maxHp,
    ownedCards, usedPocket, inventory, safeCards: [], fragments: 0,
  });
}

async function useByCard(card) {
  bag.showBackpack();
  const inspect = [...document.querySelectorAll('.bag-grid [data-act="inspectStack"]')]
    .find(element => element.dataset.name === card.name);
  expect(inspect, `背包 UI 未显示 ${card.name}`).toBeTruthy();
  inspect.click();
  const zoom = document.getElementById('cardZoom');
  const use = zoom?.querySelector('[data-act="useDetailCard"]');
  expect(use).toBeTruthy();
  use.click();
  await new Promise(resolveTick => setTimeout(resolveTick, 280));
}

describe('原始定版背包规则与旧档回填', () => {
  const oldRaw = localStorage.getItem(CARDS_KEY);
  const oldMarker = localStorage.getItem(MIGRATION_KEY);

  afterAll(() => {
    Cards.clearAll();
    if (oldRaw == null) localStorage.removeItem(CARDS_KEY);
    else localStorage.setItem(CARDS_KEY, oldRaw);
    if (oldMarker == null) localStorage.removeItem(MIGRATION_KEY);
    else localStorage.setItem(MIGRATION_KEY, oldMarker);
    Cards.all();
  });

  it('原始 TABLETOP 定义包含规则，TABLETOP10 引用保持字符串，定义通过 schema', () => {
    const crystal = Cards.TABLETOP.find(card => card.id === 'tt-crystal');
    const elixir = Cards.TABLETOP3.find(card => card.id === 'tt3-savior-elixir');
    const potion = Cards.TABLETOP11.find(card => card.id === 'cmtn6bge52qt');
    expect(crystal.rules.bag.use).toEqual([{ op: 'restoreConsumed', amount: 3 }]);
    expect(elixir).toMatchObject({ heal: 99 });
    expect(elixir.rules.bag.use).toEqual([{ op: 'heal', amountField: 'heal' }]);
    expect(potion.rules.bag.use).toEqual([{ op: 'restoreConsumed', amount: 2 }]);
    expect(validateCardRules(crystal)).toMatchObject({ ok: true, errors: [], pending: [] });
    expect(validateCardRules(elixir)).toMatchObject({ ok: true, errors: [], pending: [] });
    expect(validateCardRules(potion)).toMatchObject({ ok: true, errors: [], pending: [] });
    const source = readFileSync(resolve(process.cwd(), 'game/src/cards/cards.data.js'), 'utf8');
    expect(source).toMatch(/"tt-crystal"/);
    expect(source).toMatch(/"tt3-savior-elixir"/);
  });

  it('marker 已存在而 live-sync 覆盖清除规则时按稳定 id 恢复，补 heal:99 且不覆盖玩家字段', () => {
    const originalCards = JSON.parse(JSON.stringify(Cards.all()));
    try {
      const oldCards = originalCards.map(card => {
        if (!['tt-crystal', 'tt3-savior-elixir'].includes(card.id)) return card;
        const old = { ...card, name: `玩家改名-${card.id}`, desc: `玩家文案-${card.id}`, customField: 'preserve' };
        delete old.rules;
        if (card.id === 'tt3-savior-elixir') delete old.heal;
        return old;
      });
      expect(Cards.saveAll(oldCards)).toBe(true);
      localStorage.setItem(MIGRATION_KEY, '1');
      const save = vi.spyOn(Cards, 'saveAll');

      Cards.ensureBagUseRules();
      const crystal = Cards.all().find(card => card.id === 'tt-crystal');
      const elixir = Cards.all().find(card => card.id === 'tt3-savior-elixir');
      expect(crystal.rules.bag.use).toEqual([{ op: 'restoreConsumed', amount: 3 }]);
      expect(elixir.rules.bag.use).toEqual([{ op: 'heal', amountField: 'heal' }]);
      expect(elixir.heal).toBe(99);
      expect(validateCardRules(crystal)).toMatchObject({ ok: true, errors: [], pending: [] });
      expect(validateCardRules(elixir)).toMatchObject({ ok: true, errors: [], pending: [] });
      expect(crystal).toMatchObject({ name: '玩家改名-tt-crystal', desc: '玩家文案-tt-crystal', customField: 'preserve' });
      expect(elixir).toMatchObject({ name: '玩家改名-tt3-savior-elixir', desc: '玩家文案-tt3-savior-elixir', customField: 'preserve' });
      expect(save).toHaveBeenCalledTimes(1);

      Cards.ensureBagUseRules();
      expect(save).toHaveBeenCalledTimes(1);
      save.mockRestore();
    } finally {
      Cards.saveAll(originalCards);
    }
  });

  it('保存失败时不改旧存档也不设置首次 marker', () => {
    const originalCards = JSON.parse(JSON.stringify(Cards.all()));
    vi.spyOn(Cards, 'saveAll').mockReturnValue(false);
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const oldCards = originalCards.map(card => {
        if (!['tt-crystal', 'tt3-savior-elixir'].includes(card.id)) return card;
        const old = { ...card };
        delete old.rules;
        if (card.id === 'tt3-savior-elixir') delete old.heal;
        return old;
      });
      Cards.saveAll.mockRestore();
      expect(Cards.saveAll(oldCards)).toBe(true);
      const before = localStorage.getItem(CARDS_KEY);
      localStorage.removeItem(MIGRATION_KEY);
      vi.spyOn(Cards, 'saveAll').mockReturnValue(false);

      Cards.ensureBagUseRules();

      expect(localStorage.getItem(CARDS_KEY)).toBe(before);
      expect(localStorage.getItem(MIGRATION_KEY)).toBeNull();
      expect(errors).toHaveBeenCalledWith('[cards] Structured rule migration save returned false; marker was not written.');
    } finally {
      vi.restoreAllMocks();
      Cards.saveAll(originalCards);
      if (oldMarker == null) localStorage.removeItem(MIGRATION_KEY);
      else localStorage.setItem(MIGRATION_KEY, oldMarker);
    }
  });

  it('真实背包 UI：改名改描述后的斗神酒按 heal:99 回满且只消耗自身 uid', async () => {
    const uid = 'bag-rule-elixir-user-uid';
    const original = Cards.all().find(card => card.id === 'tt3-savior-elixir');
    const card = { ...original, name: '玩家自定义药剂名', desc: '这是一段不含治疗数字的改写文案。' };
    setScenario({ hp: 35, maxHp: 100, ownedCards: [{ uid, card }, { uid: 'keep-owned-card', card: sampleCard }] });

    await useByCard(card);

    expect(game.hp).toBe(100);
    expect(game.ownedCards.some(entry => entry.uid === uid)).toBe(false);
    expect(game.ownedCards.map(entry => entry.uid)).toEqual(['keep-owned-card']);
  });

  it('真实背包 UI：改名改描述后的能源结晶按 amount:3 复原并生成新 uid', async () => {
    const uid = 'bag-rule-crystal-user-uid';
    const original = Cards.all().find(card => card.id === 'tt-crystal');
    const card = { ...original, name: '玩家改名的结晶', desc: '描述与复原数量无关。' };
    setScenario({
      ownedCards: [{ uid, card }],
      usedPocket: [{ card: { ...sampleCard }, count: 4 }],
    });

    await useByCard(card);

    const restored = game.ownedCards.filter(entry => entry.card.id === sampleCard.id);
    expect(game.ownedCards.some(entry => entry.uid === uid)).toBe(false);
    expect(restored).toHaveLength(3);
    expect(new Set(restored.map(entry => entry.uid)).size).toBe(3);
    expect(restored.every(entry => entry.uid !== uid && typeof entry.uid === 'string' && entry.uid.length > 0)).toBe(true);
    expect(game.usedPocket.reduce((count, entry) => count + entry.count, 0)).toBe(1);
  });

  it('真实旧档 loadGame 刷新无规则 ownedCards 快照，名称与描述采用现行卡库', async () => {
    const slot = 7;
    const session = await import('../game/src/run/game.session.js');
    const originalRun = RunStorage.read(slot);
    const originalBaseRaw = localStorage.getItem(`sdt_base_${slot}`);
    try {
      window.SDT.Base.use(slot);
      session._set_active_slot(slot);
      session.newRun('standard', [], { skipClassChoice: true });
      const source = Cards.all().find(card => card.id === 'tt-crystal');
      const stale = { ...source, name: '旧档旧名', desc: '旧档旧描述。' };
      delete stale.rules;
      game.ownedCards = [{ uid: 'legacy-crystal-uid', card: stale }];
      expect(session.saveGame()).toBe(true);

      expect(session.loadGame(slot).ok).toBe(true);

      const restored = game.ownedCards.find(entry => entry.uid === 'legacy-crystal-uid').card;
      expect(restored.rules.bag.use).toEqual([{ op: 'restoreConsumed', amount: 3 }]);
      expect(restored.name).toBe(source.name);
      expect(restored.desc).toBe(source.desc);
    } finally {
      if (originalRun) RunStorage.write(slot, originalRun);
      else RunStorage.remove(slot);
      if (originalBaseRaw == null) localStorage.removeItem(`sdt_base_${slot}`);
      else localStorage.setItem(`sdt_base_${slot}`, originalBaseRaw);
      session._set_active_slot(null);
    }
  });
});
