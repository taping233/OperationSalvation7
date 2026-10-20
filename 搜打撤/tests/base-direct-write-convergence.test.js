import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
/* 直写收敛回归（2026-09-29 C 线）：game.bag.settle / meta.js / game.menu 的
 * 「直接改 Base.data 后保存」残留路径收敛为 Base 命令后的定向验证。
 * 每条命令覆盖：保存成功提交 / 保存失败仅内存推进（旧 checkpoint 语义）/ 未变分支不落盘。
 * 参考 tests/base-mutation.test.js 的 failWrites 桩法。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
// 游戏模块一律动态导入：静态导入会被提升到 window.SDT 初始化之前（cards.rules 需要 Icons）
const { RULES } = await import('../game/src/core/rules.js');
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');

const Base = window.SDT.Base;
const Meta = window.SDT.Meta;
const Cards = window.SDT.Cards;
const read = () => JSON.parse(localStorage.getItem(Base.SLOT_KEY(1)));

Cards.ensureTabletop();   // 播入全部卡牌种子（术语迁移与收藏池用）

beforeEach(async () => {
  localStorage.clear();
  window.SDT.MAP = { rules: RULES };
  window.SDT.Sound = { sfx: vi.fn() };
  window.SDT.UI = { log: vi.fn() };
  Base.use(1);
  Object.assign(Base.data, {
    wood: 10, rations: 20, coins: 80, keys: 10,
    eggBattles: 0, eggPity: 0, ammoTaught: false,
    stash: [], pocket: [], characters: {}, collXp: {}, collection: {},
  });
  Base.data.stats.kills = 0;
  Base.data.stats.bossKills = [];
  expect((await Base.save())).toBe(true);
});
afterEach(() => vi.restoreAllMocks());

function failWrites() {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
    if (key === Base.SLOT_KEY(1)) throw new Error('quota');
    return original.call(this, key, value);
  });
}

describe('宠物蛋战斗计数 recordEggBattle（原 game.bag.settle:184 直写）', () => {
  it('保存成功：内存与落盘同步推进，persisted:true', async () => {
    const r = (await Base.recordEggBattle());
    expect(r).toEqual({ eggBattles: 1, persisted: true });
    expect(Base.data.eggBattles).toBe(1);
    expect(read().eggBattles).toBe(1);
  });

  it('保存失败：仅内存推进、落盘保持原值、persisted:false（旧保底计数语义）', async () => {
    failWrites();
    const r = (await Base.recordEggBattle());
    expect(r).toEqual({ eggBattles: 1, persisted: false });
    expect(Base.data.eggBattles).toBe(1);
    expect(read().eggBattles).toBe(0);
  });
});

describe('教学旗 markAmmoTaught（原 game.bag.settle teachAmmoOnce 直写）', () => {
  it('保存成功：内存与落盘同步置位', async () => {
    expect((await Base.markAmmoTaught())).toBe(true);
    expect(Base.data.ammoTaught).toBe(true);
    expect(read().ammoTaught).toBe(true);
  });

  it('保存失败：内存已置位（重试层依赖旗子只弹一次）、落盘保持原值', async () => {
    failWrites();
    expect((await Base.markAmmoTaught())).toBe(false);
    expect(Base.data.ammoTaught).toBe(true);
    expect(read().ammoTaught).toBe(false);
  });
});

describe('战斗统计 recordMetaEvent（原 meta.js track 直写集群）', () => {
  it('普通击杀：kills+1、经验入账、一次落盘', async () => {
    const r = (await Base.recordMetaEvent('kill', { boss: false, cls: '侠客' }, () => 1));
    expect(r.changed).toBe(true);
    expect(Base.data.stats.kills).toBe(1);
    expect(Base.data.characters.wu.xp).toBe(6);
    expect(read().stats.kills).toBe(1);
    expect(read().characters.wu.xp).toBe(6);
  });

  it('首脑击杀：bossKills 去重登记、40 倍经验（80 点跨过 Lv.2 阈值）', async () => {
    (await Base.recordMetaEvent('kill', { boss: true, name: '荒渊巨兽', cls: '侠客' }, () => 1));
    (await Base.recordMetaEvent('kill', { boss: true, name: '荒渊巨兽', cls: '侠客' }, () => 1));
    expect(Base.data.stats.bossKills).toEqual(['荒渊巨兽']);
    expect(Base.data.stats.kills).toBe(2);
    expect(Base.data.characters.wu).toEqual({ lv: 2, xp: 30 });   // 80 经验：50 升级，余 30
    expect(read().stats.bossKills).toEqual(['荒渊巨兽']);
  });

  it('跨过阈值时随事件一次升级（checkpoint 可供播报）', async () => {
    Base.data.characters.wu = { lv: 1, xp: 45 };
    (await Base.save());
    const r = (await Base.recordMetaEvent('kill', { boss: false, cls: '侠客' }, () => 1));
    expect(r.gained.levelsGained).toBe(1);
    expect(r.gained.checkpoints).toEqual([{ lv: 2, xp: 1 }]);
    expect(Base.data.characters.wu).toEqual({ lv: 2, xp: 1 });
    expect(read().characters.wu).toEqual({ lv: 2, xp: 1 });
  });

  it('保存失败：统计与经验仅内存推进、落盘保持原值（旧 checkpoint 语义）', async () => {
    failWrites();
    const r = (await Base.recordMetaEvent('kill', { boss: true, name: '荒渊巨兽', cls: '侠客' }, () => 1));
    expect(r.persisted).toBe(false);
    expect(Base.data.stats.kills).toBe(1);
    expect(Base.data.characters.wu.xp).toBe(40);
    expect(read().stats.kills).toBe(0);
    expect(read().characters).toEqual({});
  });

  it('未知事件：不改状态、不落盘（未变分支）', async () => {
    const before = structuredClone(Base.data);
    const rawBefore = localStorage.getItem(Base.SLOT_KEY(1));
    const r = (await Base.recordMetaEvent('extract', {}));
    expect(r.changed).toBe(false);
    expect(Base.data).toEqual(before);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(rawBefore);
  });
});

describe('熟练度 addClassXp（原 Meta.addXP 直写集群）', () => {
  it('成功入账并落盘，重复调用累计', async () => {
    expect((await Base.addClassXp('侠客', 10)).levelsGained).toBe(0);
    expect((await Base.addClassXp('侠客', 10)).levelsGained).toBe(0);
    expect(Base.data.characters.wu.xp).toBe(20);
    expect(read().characters.wu.xp).toBe(20);
  });

  it('保存失败：经验仅内存推进、落盘保持原值', async () => {
    failWrites();
    const r = (await Base.addClassXp('侠客', 50));
    expect(r.levelsGained).toBe(1);
    expect(r.persisted).toBe(false);
    expect(Base.data.characters.wu).toEqual({ lv: 2, xp: 0 });
    expect(read().characters).toEqual({});
  });

  it('无效入参不落盘', async () => {
    const rawBefore = localStorage.getItem(Base.SLOT_KEY(1));
    expect((await Base.addClassXp('', 10)).levelsGained).toBe(0);
    expect((await Base.addClassXp('侠客', 0)).levelsGained).toBe(0);
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(rawBefore);
  });
});

describe('收藏经验回填 markCollXpSettled（原 meta.js syncCollXp 直写）', () => {
  it('标记成功落盘；保存失败仅内存推进', async () => {
    expect((await Base.markCollXpSettled(['wu-unique']))).toEqual({ changed: true, persisted: true });
    expect(Base.data.collXp['wu-unique']).toBe(true);
    expect(read().collXp['wu-unique']).toBe(true);
    failWrites();
    expect((await Base.markCollXpSettled(['late-id']))).toEqual({ changed: true, persisted: false });
    expect(Base.data.collXp['late-id']).toBe(true);
    expect(read().collXp['late-id']).toBeUndefined();
  });

  it('空入参不落盘', async () => {
    const rawBefore = localStorage.getItem(Base.SLOT_KEY(1));
    expect((await Base.markCollXpSettled([]))).toEqual({ changed: false, persisted: false });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(rawBefore);
  });

  it('Meta.syncCollXp 集成：只回填已收藏的职业卡', async () => {
    const classCard = Cards.all().find(c => c.rarity === '职业' && c.cls);
    const abilityCard = Cards.all().find(c => c.type === '能力卡');
    Base.data.collection[classCard.id] = { name: classCard.name, rarity: '职业', ts: 1 };
    Base.data.collection[abilityCard.id] = { name: abilityCard.name, rarity: abilityCard.rarity, ts: 2 };
    await Meta.syncCollXp();
    expect(Base.data.collXp[classCard.id]).toBe(true);
    expect(Base.data.collXp[abilityCard.id]).toBeUndefined();
    expect(read().collXp[classCard.id]).toBe(true);
  });
});

describe('术语迁移 applyStoredCardRenames（原 game.menu launch 直写）', () => {
  it('英雄卡更名与重复名追加-改：内存与落盘同步', async () => {
    Base.data.stash = [
      { card: { id: 'x-hero', name: '英雄招式', type: '英雄卡' }, count: 1 },
      { card: { id: 'tt7-imitate', name: '不变应万变', type: '法术' }, count: 2 },
    ];
    (await Base.save());
    expect((await Base.applyStoredCardRenames())).toEqual({ changed: true, persisted: true });
    expect(Base.data.stash[0].card.type).toBe('能力卡');
    expect(Base.data.stash[1].card.name).toBe('不变应万变-改');
    const stored = read();
    expect(stored.stash[0].card.type).toBe('能力卡');
    expect(stored.stash[1].card.name).toBe('不变应万变-改');
  });

  it('幂等：无目标时不再写档（revision 不变）', async () => {
    expect((await Base.applyStoredCardRenames())).toEqual({ changed: false, persisted: true });
    const rawBefore = localStorage.getItem(Base.SLOT_KEY(1));
    expect((await Base.applyStoredCardRenames())).toEqual({ changed: false, persisted: true });
    expect(localStorage.getItem(Base.SLOT_KEY(1))).toBe(rawBefore);
  });
});

describe('Meta.track / addXP 集成（收敛后编排不变）', () => {
  it('击杀埋点走命令：无升级不播报，升级时播报且状态落盘', async () => {
    (await Meta.track('kill', { boss: false, cls: '侠客' }));
    expect(window.SDT.Sound.sfx).not.toHaveBeenCalled();
    expect(Base.data.stats.kills).toBe(1);
    Base.data.characters.wu = { lv: 1, xp: 45 };
    (await Base.save());
    (await Meta.track('kill', { boss: false, cls: '侠客' }));
    expect(window.SDT.Sound.sfx).toHaveBeenCalledWith('levelup');
    expect(window.SDT.UI.log).toHaveBeenCalledWith(expect.stringContaining('熟练度提升'), 'ok');
    expect(Base.data.characters.wu).toEqual({ lv: 2, xp: 1 });
    expect(read().characters.wu).toEqual({ lv: 2, xp: 1 });
  });
});
