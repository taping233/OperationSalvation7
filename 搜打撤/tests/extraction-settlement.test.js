/* 撤离结算契约（迭代评审 09-20 G-P1：撤离经济零测试保护——第一道防线）：
 * 切片 game.run.altar doExtract 纯逻辑段，锁三件事：
 *   ① 消耗口袋 1/3 保留口径（逐张判定，保留/散失计数与日志一致）；
 *   ② 结算链完整：clearSave + 木材/口粮自动入库 + 口袋交还 depositCards + 整理页打开；
 *   ③ 首脑击杀后撤离必经 unlockNest 单一写点（legend 接音随 nest.js 版）。
 * 随身币清零/仓库满丢失逻辑位于整理页 goBase 链路（base.depositCards 内部），
 * 属浏览器级回归用例（QA 用例清单 #2），不在本切片范围。 */
import { beforeEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync('game/src/game.run.altar.js', 'utf8');

function buildDoExtract({ coinFlip = 0, bossKilled = true } = {}) {
  const game = {
    state: 'modal', runActive: true, layerIdx: 2,
    hp: 20, maxHp: 30, coins: 7, turn: 3, myClass: '侠客',
    bossKilled,
    inventory: [{ name: '木材', count: 2 }],
    usedPocket: [{ card: { id: 'a', name: '卡A' }, count: 4 }],
    ownedCards: [{ uid: 'u1', card: { id: 'b', name: '卡B' } }],
  };
  const UI = { log: vi.fn(), hideOverlay: vi.fn(), refresh: vi.fn() };
  const SDT = {
    Sound: { sfx: vi.fn(), music: vi.fn() },
    Base: { deposit: vi.fn(), depositCards: vi.fn(), isSha: () => false },
    Meta: { checkUnlocks: vi.fn(), track: vi.fn() },
  };
  const clearSave = vi.fn();
  const syncPlayTime = vi.fn();
  const unlockNest = vi.fn();
  const renderExtractStash = vi.fn();
  const Random = { random: () => coinFlip };   // 0=恒保留（<1/3）；0.99=恒散失（≥1/3）

  const code = source.slice(
    source.indexOf('function doExtract()'),
    source.indexOf('function renderExtractStash()'),
  );
  const doExtract = new Function(
    'game', 'UI', 'SDT', 'Random', 'clearSave', 'syncPlayTime', 'unlockNest', 'renderExtractStash',
    `${code}; return doExtract;`,
  )(game, UI, SDT, Random, clearSave, syncPlayTime, unlockNest, renderExtractStash);
  return { doExtract, game, UI, SDT, clearSave, unlockNest, renderExtractStash };
}

let ctx;
beforeEach(() => { ctx = buildDoExtract(); });

it('撤离结算：对局档清除 + 木材口粮自动入库 + 口袋交还 + 打开整理页', () => {
  const { doExtract, game, SDT, clearSave, renderExtractStash } = ctx;
  doExtract();
  expect(game.runActive).toBe(false);
  expect(game.state).toBe('done');
  expect(clearSave).toHaveBeenCalledOnce();
  expect(SDT.Base.deposit).toHaveBeenCalledWith(game.inventory);
  expect(SDT.Base.depositCards).toHaveBeenCalledTimes(1);
  expect(renderExtractStash).toHaveBeenCalledOnce();
  expect(SDT.Meta.track).toHaveBeenCalled();
});

it('消耗口袋 1/3 保留：恒保留侧（coinFlip<1/3）四张全带回且日志一致', () => {
  const { doExtract, game, UI, SDT } = buildDoExtract({ coinFlip: 0 });
  doExtract();
  expect(game.usedPocket).toHaveLength(1);
  expect(game.usedPocket[0].count).toBe(4);
  expect(UI.log).toHaveBeenCalledWith(
    expect.stringContaining('张只有 1/3 保留（带回 4 张，散失 0 张）'),
    'sys',
  );
  const deposited = SDT.Base.depositCards.mock.calls[0][0];
  expect(deposited).toHaveLength(1);
  expect(deposited[0].count).toBe(4);
});

it('消耗口袋 1/3 保留：恒散失侧（coinFlip≥1/3）全散失且不误入库', () => {
  const { doExtract, game, UI, SDT } = buildDoExtract({ coinFlip: 0.99 });
  doExtract();
  expect(game.usedPocket).toHaveLength(0);
  expect(UI.log).toHaveBeenCalledWith(
    expect.stringContaining('带回 0 张，散失 4 张'),
    'sys',
  );
  expect(SDT.Base.depositCards.mock.calls[0][0]).toHaveLength(0);
});

it('击败首脑后撤离必经 unlockNest 单一写点；未击败则不触发', () => {
  const withBoss = buildDoExtract({ bossKilled: true });
  withBoss.doExtract();
  expect(withBoss.unlockNest).toHaveBeenCalledOnce();

  const noBoss = buildDoExtract({ bossKilled: false });
  noBoss.doExtract();
  expect(noBoss.unlockNest).not.toHaveBeenCalled();
});
