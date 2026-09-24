// 基地档「JSON 合法但字段类型损坏」兜底（2026-09-24 F1）：
// adopt() 对容器字段回落默认值并 console.warn 留痕；openSlotPicker 单档异常不卡整页。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGameMenuController } from '../game/src/ui/game.menu.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');

const Base = window.SDT.Base;
const SLOT_KEY = (i) => 'sdt-base-v2-slot' + i;

// 依赖注入构造选档页控制器（同 menu-recovery-entry 口径），peek 可按用例替换
function setupMenu({ peek } = {}) {
  const handlers = {};
  const UI = {
    showOverlay(_title, html) { document.body.innerHTML = html; },
    hideOverlay() { document.body.innerHTML = ''; },
    registerHelp() {}, helpBtn() { return ''; }, act(name, fn) { handlers[name] = fn; },
    log: vi.fn(), clearLog() {}, hideScreen() {}, showScreen() {}, refresh() {},
  };
  const controller = createGameMenuController({
    SDT: {
      Base: { peek: peek || ((i) => Base.peek(i)), use: vi.fn(), save: vi.fn(), data: { stash: [], pocket: [] }, issue: () => null, reset: vi.fn() },
      Cards: { applyAbilityRename: () => false, applyDuplicateRenames: () => false },
      Sound: { music() {} },
      Meta: { ACHIEVEMENTS: [], isUnlocked: () => false },
      Icons: { img: () => '' },
    },
    UI, game: { state: 'title' }, runtime: { resize() {}, openBaseHub: vi.fn(), showRunTransition: async () => {} },
    SLOT_COUNT: 5, esc: String, readSlot: () => null, loadGame: vi.fn(), clearSlot: vi.fn(),
    saveGame() {}, syncPlayTime() {}, clearSave() {}, clearAllSlots() {},
    getActiveSlot: () => null, setActiveSlot: vi.fn(), preflightRunMap: () => ({ ok: true }), hasRun: () => false,
    RunStorage: { has: () => false, issue: () => null }, recoverSlotIfPending: null,
  });
  return { controller, UI };
}

describe('基地档字段类型损坏兜底（F1）', () => {
  beforeEach(() => { localStorage.clear(); });

  it('JSON 合法但容器字段为字符串/数字/null/数组时 peek 不抛且回落默认值并留痕', () => {
    localStorage.setItem(SLOT_KEY(1), JSON.stringify({
      version: 2, coins: 7,
      stats: 'junk', characters: 3, classes: null, pets: 0,
      home: 'broken', appearance: [], goals: 7, story: true, achClaimed: 'no',
    }));
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const d = Base.peek(1);
      expect(d).not.toBeNull();
      expect(d.coins).toBe(7);   // 完好字段不动
      expect(d.stats).toMatchObject({ reviveKills: 0, extracts: 0, playSeconds: 0, bossKills: [] });
      // characters 被写坏成数字 → 回落 {} 后由 migrateCharacterProgress 按职业表补齐
      expect(Object.keys(d.characters).sort()).toEqual(['baita', 'changwuyu', 'heixiang', 'wu', 'xingyue']);
      expect(d.classes).toEqual({});
      expect(d.pets).toEqual({});
      expect(d.home).toEqual({ owned: {}, placements: [], displays: [] });
      expect(d.appearance).toEqual({ characterSkins: {}, selectedSkins: {} });
      expect(d.goals).toEqual({ tracked: [], presets: {} });
      expect(d.story).toEqual({ flags: {}, outcomes: {} });
      expect(d.achClaimed).toEqual({});
      const warned = warns.mock.calls.map(c => String(c[0])).join('\n');
      for (const f of ['stats', 'characters', 'classes', 'pets', 'home', 'appearance', 'goals', 'story', 'achClaimed'])
        expect(warned).toContain(`存档字段 ${f} 类型损坏`);
    } finally { warns.mockRestore(); }
    // 原档保留未写回
    expect(localStorage.getItem(SLOT_KEY(1))).toContain('"stats":"junk"');
  });

  it('完好老档缺字段不触发损坏告警（undefined ≠ 损坏，走 mergeDef 补齐）', () => {
    localStorage.setItem(SLOT_KEY(2), JSON.stringify({ version: 2, coins: 3 }));
    const warns = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const d = Base.peek(2);
      expect(d.coins).toBe(3);
      expect(d.stats).toBeTruthy();
      expect(warns.mock.calls.map(c => String(c[0])).join()).not.toContain('存档字段');
    } finally { warns.mockRestore(); }
  });

  it('损坏档存在时选档页五档全渲染、不抛异常', () => {
    localStorage.setItem(SLOT_KEY(1), JSON.stringify({ version: 2, stats: 'junk', characters: 3 }));
    const { controller } = setupMenu();
    expect(() => controller.startNewGame()).not.toThrow();
    const cardsEls = [...document.querySelectorAll('.slot-card')];
    expect(cardsEls.length).toBe(5);
    expect(cardsEls[0].className).toContain('slot-state-base');   // 损坏档回落默认后仍识别为有档
    expect(cardsEls[0].textContent).toContain('基地档案');
    expect(document.getElementById('slotRestoreError').hidden).toBe(true);
  });

  it('单档 peek 抛异常时选档页仍渲染其余档位并给出可见错误（原档不写回）', () => {
    const { controller } = setupMenu({
      peek: (i) => {
        if (i === 3) throw new TypeError("Cannot create property 'bossKills' on string 'junk'");
        return Base.peek(i);
      },
    });
    localStorage.setItem(SLOT_KEY(1), JSON.stringify({ version: 2, coins: 1 }));
    expect(() => controller.startNewGame()).not.toThrow();
    const cardsEls = [...document.querySelectorAll('.slot-card')];
    expect(cardsEls.length).toBe(5);
    const errCard = cardsEls.find(c => c.textContent.includes('档案数据异常'));
    expect(errCard, '仅档位 3 降级').toBeDefined();
    expect(errCard.textContent).toContain('档位 03');
    expect(errCard.querySelector('[data-act]')).toBeNull();   // 降级卡不给进入/删除等入口
    const errEl = document.getElementById('slotRestoreError');
    expect(errEl.hidden).toBe(false);
    expect(errEl.textContent).toContain('档位 03');
    expect(errEl.textContent).toContain('已保留原档');
  });
});
