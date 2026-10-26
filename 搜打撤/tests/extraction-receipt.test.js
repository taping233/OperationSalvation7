/* SYS-02 结算真源（2026-10-03）：撤离结算产生一份「真实回执」，结算页/跑局记录/Agent 读同一份事实。
 * 钉死三件事：
 *   ① 回执字段完整性（clear / extract 两结局各一例）；
 *   ② 结算页从回执读数——clear/extract 主体文案可区分，数字（行动/用时/首探经验/净带回）来自回执字段；
 *   ③ 跑局记录与回执一致（与 G 现场反推口径冲突时以回执为准），CSV 追加列可对账。
 * 台架：① 用纯函数直测；② 复用 extraction-settlement.test.js 的 slot=null 真实 altar ESM 分支；
 * ③ 用真实 agent.recorder（与 agent-recorder.test.js 同款全局注入）。
 * 幂等（提交中断重试/刷新重建）另见 extraction-receipt-idempotency.test.js（真实两键事务台架）。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildExtractionReceipt } from '../game/src/hub/extraction.commands.js';

// —— ① 回执字段完整性 ——

const exploredOf = n => {
  const explored = {};
  for (let i = 0; i < n; i++) explored[`3,${i}`] = 1;
  return explored;
};

describe('回执字段完整性（clear/extract 各一例）', () => {
  it('clear：击破首脑终局撤离——结局/层/行动/首探经验/净带回/关键损失/时长齐备', () => {
    const r = buildExtractionReceipt({
      game: { bossKilled: true, layerIdx: 3, turn: 33, explored: exploredOf(12), coins: 7, elapsed: 95.4,
        ownedCards: ['入库', '入库', '遗珠', '遗珠', '杂卡'].map(name => ({
          card: { name, rarity: name === '遗珠' ? '传说' : '古朴' },
        })) },
      pending: {
        remainingCards: [{ card: { name: '遗珠', rarity: '传说' }, count: 2 }, { card: { name: '杂卡', rarity: '古朴' }, count: 1 }],
        totalPocketCount: 4, lostPocketCount: 1, resources: { wood: 2, rations: 3 },
      },
      isSha: () => false, xpMul: 1,
    });
    expect(r).toEqual({
      version: 1, outcome: 'clear', bossKilled: true, layersReached: 4, actions: 32,
      firstExplore: { moves: 12, xp: 44 },   // SYS-01 口径：20+12*2，与撤离实发经验同源
      savedCards: [{ card: { name: '入库', rarity: '古朴' }, count: 2 }],
      netTake: { cardsStashed: 2, pocketKept: 3, wood: 2, rations: 3 },   // 本局真实入库（携出 5 − 未入库 3）
      losses: { lostCount: 3, lostNotable: [{ name: '遗珠', rarity: '传说', count: 2 }], pocketLost: 1 },
      runCoins: 7, durationSec: 95,
    });
  });

  it('extract：保本撤离——旧档无 explored 回退 turn-1 口径，空缺字段安全归零', () => {
    const r = buildExtractionReceipt({
      game: { bossKilled: false, layerIdx: 1, turn: 21,   // 无 explored（旧档读档形态）、无 coins/elapsed
        ownedCards: [{ card: { name: '镭射', rarity: '古朴' } }, { card: { name: '镭射', rarity: '古朴' } }, { card: { name: '镭射', rarity: '古朴' } }] },
      pending: { remainingCards: [], resources: {} },
      isSha: () => false, xpMul: 1,
    });
    expect(r).toEqual({
      version: 1, outcome: 'extract', bossKilled: false, layersReached: 2, actions: 20,
      firstExplore: { moves: 20, xp: 60 },
      savedCards: [{ card: { name: '镭射', rarity: '古朴' }, count: 3 }],
      netTake: { cardsStashed: 3, pocketKept: 0, wood: 0, rations: 0 },
      losses: { lostCount: 0, lostNotable: [], pocketLost: 0 },
      runCoins: null, durationSec: 0,
    });
  });
});

// —— ② 结算页从回执读数 ——

const altarState = vi.hoisted(() => ({ game: {}, random: vi.fn(() => 0) }));
vi.mock('../game/src/run/game.session.js', () => ({
  MAP: { rules: { starterSha: 0, stashUpgradeWood: 1, stashUpgradeSlots: 1 } },
  MODES: {}, game: altarState.game, getActiveSlot: () => null,
  clearSave: vi.fn(), curLayer: () => null, enterLayer: vi.fn(), exitToTitle: vi.fn(), newUid: vi.fn(),
  saveGame: vi.fn(), scaledEnemy: vi.fn(), syncPlayTime: vi.fn(),
}));
vi.mock('../game/src/core/characters.js', () => ({ CHARACTERS: [], characterFor: () => null, characterName: () => '' }));
vi.mock('../game/src/core/shared.js', () => ({ clone: v => (v == null ? v : JSON.parse(JSON.stringify(v))), esc: String, escAttr: value => String(value).replaceAll('"', '&quot;') }));
vi.mock('../game/src/audio/sound.js', () => ({ tone: vi.fn() }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub: vi.fn() }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { ding: vi.fn() }, _set_cardPageOpen: vi.fn(), cardHTML: c => c.name }));
vi.mock('../game/src/core/random.js', () => ({
  Random: { random: altarState.random, seed: 1, restore: vi.fn() },
  SeededRandomService: class {
    constructor(seed) { this.state = { seed }; }
    restore(state) { this.state = state; }
    random() { return altarState.random(); }
    snapshot() { return this.state; }
  },
}));
vi.mock('../game/src/battle/battle-loader.js', async importOriginal => ({ ...await importOriginal(), ensureBattleReady: vi.fn(), startBattle: vi.fn() }));
vi.mock('../game/src/run/game.run.scenes.js', () => ({
  FIRE_RESTORABLE: [], consumeCurrentCell: vi.fn(), finishInstant: vi.fn(), grantEventCard: vi.fn(),
  nodeOpt: (act, label) => `<button data-act="${act}">${label}</button>`,
  // 页面壳含标题与副题行（真实 nodeShell 渲染 o.icon/o.title/o.sub）——结算页主体文案断言依赖它
  nodeShell: o => window.SDT.UI.showOverlay('', `${o.icon || ''} ${o.title || ''}<span class="sub">${o.sub || ''}</span>${o.body || ''}${o.foot || ''}`),
  openPocketRestore: vi.fn(), openShop: vi.fn(), preloadAllNodeShellBgs: vi.fn(), showRunTransition: vi.fn(),
}));
vi.mock('../game/src/run/game.nest.js', () => ({ unlockNest: vi.fn() }));
vi.mock('../game/src/hub/game.storage.js', () => ({ RunStorage: {} }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun: vi.fn(), readSettlementReceipt: vi.fn(), recoverSlot: vi.fn() }));

describe('结算页从回执读数（slot=null 真实 altar 分支）', () => {
  let UI, doExtract;
  const recordRun = vi.fn();

  const makeGame = ({ bossKilled = true, turn = 33, exploredKeys = 12, elapsed = 125 } = {}) => {
    const explored = exploredKeys != null ? exploredOf(exploredKeys) : undefined;
    return {
      state: 'modal', runActive: true, pendingExtraction: null, layerIdx: 3,
      hp: 20, maxHp: 30, coins: 7, turn, myClass: '侠客', mode: 'normal', bossKilled,
      ...(explored ? { explored } : {}),
      inventory: [{ name: '木材', count: 2 }, { name: '口粮', count: 3 }],
      usedPocket: [{ card: { id: 'a', name: '口袋卡' }, count: 4 }],
      ownedCards: [{ uid: 'u1', card: { id: 'b', name: '背包卡' } }],
      elapsed,
    };
  };

  beforeEach(async () => {
    vi.resetModules();
    recordRun.mockReset();
    for (const k of Object.keys(altarState.game)) delete altarState.game[k];
    Object.assign(altarState.game, makeGame());
    document.body.innerHTML = '<div id="body"></div>';
    UI = {
      acts: {}, log: vi.fn(), hideOverlay: vi.fn(), refresh: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '',
      showOverlay: (_t, html) => { document.body.innerHTML = html; }, act(name, fn) { this.acts[name] = fn; },
    };
    window.SDT = {
      UI, Base: { data: { wood: 0, rations: 0, pocket: [], stash: [], nestUnlocked: false, coins: 0, collection: {},
        _m01: { revision: 0, requests: {} },
        stats: { extracts: 0, bestRunCoins: 0, stashTotal: 0 } },
        isSha: () => false, stashRoom: () => 5, stashUsed: () => 0, stashCap: () => 5 },
      Sound: { sfx: vi.fn(), music: vi.fn() },
      Cards: { cardHTML: c => c.name, sellPrice: () => 1 },
      Meta: { track: vi.fn(), addXpToProgress: (p, a) => ({ after: { lv: p.lv || 1, xp: (p.xp || 0) + a } }) },
      Agent: { recorder: { recordRun } },
    };
    altarState.random.mockReset().mockReturnValue(0);
    ({ doExtract } = await import('../game/src/run/game.run.altar.js'));
  });

  const finishUp = async () => {
    expect(await doExtract()).toBe(true);
    await UI.acts.exFinish();
    if (document.querySelector('[data-act=exConfirmFinish]')) await UI.acts.exConfirmFinish();
  };

  it('clear 结局：主体文案突出「击破首脑+关键收获」，数字（行动/用时/首探经验）来自回执', async () => {
    await finishUp();
    const text = document.body.textContent;
    expect(text).toContain('首脑突破');
    expect(text).not.toContain('满载而归');
    expect(text).toContain('待复原 4 张');
    expect(document.querySelector('[data-act=again]')).toBeNull();
    expect(document.querySelector('[data-act=goBase]').textContent).toContain('返回基地');
    expect(document.querySelector('.exr-success-title').textContent).toContain('首脑突破');
    expect(text).toContain('卡牌入库0 张');
    expect(text).not.toContain('保本返回');
    expect(recordRun.mock.calls[0][1].receipt.actions).toBe(32);     // 页面主体读回执 actions
    expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('共 32 次行动'), 'ok');   // 日志行同读回执
    expect(text).toContain('02:05');     // 回执 durationSec=125
    expect(text).toContain('+44');            // 回执 firstExplore.xp（SYS-01 口径，非旧 turn 反推的 84）
    expect(text).toContain('第 4 层');        // 回执 layersReached
    expect(document.querySelector('[data-act="goBase"]')).not.toBeNull();
    expect(document.querySelector('[data-act="again"]')).toBeNull();
    expect(recordRun).toHaveBeenCalledTimes(1);
    const [outcome, detail] = recordRun.mock.calls[0];
    expect(outcome).toBe('clear');
    expect(detail.receipt).toMatchObject({ outcome: 'clear', bossKilled: true, layersReached: 4, actions: 32 });
    expect(detail.receipt.firstExplore).toEqual({ moves: 12, xp: 44 });
    expect(detail.savedCards).toEqual([]);   // 未选择入库，不能回退为 ownedCards 候选
    expect(detail).not.toHaveProperty('carriedCards');
  });

  it('records only the final receipt savedCards after actual storage selection', async () => {
    expect(await doExtract()).toBe(true);
    await UI.acts.exAll();
    await UI.acts.exFinish();
    if (document.querySelector('[data-act=exConfirmFinish]')) await UI.acts.exConfirmFinish();
    const [outcome, detail] = recordRun.mock.calls[0];
    expect(outcome).toBe('clear');
    expect(detail.savedCards).toEqual([{ card: { id: 'b', name: '背包卡' }, count: 1 }]);
    expect(detail.savedCards).toEqual(detail.receipt.savedCards);
    expect(detail).not.toHaveProperty('carriedCards');
  });

  it('uses a short smart-storage label while retaining capacity and value priority in its accessible description', async () => {
    altarState.game.ownedCards = Array.from({ length: 6 }, (_, i) => ({ uid: String(i), card: { id: 'b', name: '背包卡' } }));
    expect(await doExtract()).toBe(true);
    const smart = document.querySelector('[data-act="exSmart"]');
    expect(smart.textContent).toContain('按估值入库');
    expect(smart.textContent).not.toContain('上限仓库空格');
    expect(smart.title).toBe('按估值从高到低入库，同估值按背包原次序。');
    expect(document.querySelector('.exr-capacity').textContent).toContain('还能入库 5 张');
  });

  it('labels notable losses as a subset while preserving the full receipt count', async () => {
    altarState.game.ownedCards = [
      { uid: 'run-shoes', card: { name: '急速跑鞋', rarity: '古朴', type: '装备' } },
      { uid: 'ice', card: { name: '冰刺', rarity: '古朴', type: '法术' } },
      { uid: 'box', card: { name: '迷之匣', rarity: '史诗', type: '道具' } },
    ];
    await finishUp();
    expect(document.querySelector('.exr-receipt-details').textContent).toContain('未入库 3 张');
    expect(document.querySelector('.exr-receipt-details').textContent).toContain('迷之匣 ×1');
    expect(recordRun.mock.calls[0][1].receipt.losses).toMatchObject({
      lostCount: 3, lostNotable: [{ name: '迷之匣', rarity: '史诗', count: 1 }],
    });
  });

  it('extract 结局：说明安全撤离，不暗示没有损失，与 clear 区分', async () => {
    for (const k of Object.keys(altarState.game)) delete altarState.game[k];
    Object.assign(altarState.game, makeGame({ bossKilled: false, turn: 21, exploredKeys: null }));
    await finishUp();
    const text = document.body.textContent;
    expect(text).toContain('撤离成功');
    expect(text).not.toContain('保本返回');
    expect(text).toContain('已保存');
    expect(text).not.toContain('首脑突破');
    expect(text).not.toContain('击破第四层首脑');
    expect(recordRun.mock.calls[0][1].receipt.actions).toBe(20);     // 旧档无 explored：actions 仍为 turn-1
    expect(text).toContain('+60');            // 回退口径 20+(21-1)*2
    const [outcome, detail] = recordRun.mock.calls[0];
    expect(outcome).toBe('extract');
    expect(detail.receipt).toMatchObject({ outcome: 'extract', bossKilled: false, layersReached: 4, actions: 20 });
    expect(detail.savedCards).toEqual([]);
  });
});

// —— ③ 跑局记录与回执一致 ——

describe('跑局记录读回执（冲突以回执为准）', () => {
  let recordRun, exportCSV;
  const receipt = {
    version: 1, outcome: 'clear', bossKilled: true, layersReached: 4, actions: 32,
    firstExplore: { moves: 12, xp: 44 },
    netTake: { cardsStashed: 2, pocketKept: 3, wood: 2, rations: 3 },
    losses: { lostCount: 3, lostNotable: [{ name: '遗珠', rarity: '传说', count: 2 }], pocketLost: 1 },
    runCoins: 7, durationSec: 95,
  };

  beforeEach(async () => {
    localStorage.clear();
    // G 现场故意与回执冲突：层 99 / 行动 99 / 币 99 / 时长 999——记录必须全读回执
    window.SDT = window.SDT || {};
    window.SDT.Cards = { sellPrice: () => 5 };
    window.SDT.game = { mapSeed: 'seed-1', mode: 'standard', myClass: '侠客', layerIdx: 98, turn: 99, coins: 99, hp: 7, elapsed: 999, bossKilled: false };
    ({ recordRun, exportCSV } = await import('../game/src/agent/agent.recorder.js'));
  });

  it('有回执：结局/层/行动/币/时长/首探/净带回/损失全来自回执，原始回执整体留档', () => {
    const entry = recordRun('extract', { receipt, carriedCards: [{ card: { name: '背包卡', rarity: '古朴' }, count: 1 }] });
    expect(entry).toMatchObject({
      outcome: 'clear',          // 回执赢过调用方传入的 'extract'
      maxLayer: 4, turns: 32, coins: 7, durationSec: 95,
      bossKilled: true, firstExploreXp: 44, firstExploreMoves: 12,
      netTake: { cardsStashed: 2, pocketKept: 3, wood: 2, rations: 3 },
      losses: { lostCount: 3, pocketLost: 1 },
    });
    expect(entry.receipt).toEqual(receipt);
    expect(entry.hpLeft).toBe(7);   // 无回执字段的事实（终局血量）仍来自 G 现场
  });

  it('无回执（death/abandon/nest）：保持既有 G 现场口径不变', () => {
    const entry = recordRun('death', { why: '你倒下了' });
    expect(entry.outcome).toBe('death');
    expect(entry.maxLayer).toBe(99);
    expect(entry.turns).toBe(99);
    expect(entry.durationSec).toBe(999);
    expect(entry.bossKilled).toBe(false);
    expect(entry.netTake).toBeNull();
    expect(entry.receipt).toBeNull();
  });

  it('CSV 在原表尾追加回执派生列，行值可对账', () => {
    recordRun('extract', { receipt });
    const lines = exportCSV().trim().split('\n');
    const head = lines[0].split(',');
    for (const col of ['bossKilled', 'firstExploreXp', 'stashedCards', 'pocketKept', 'pocketLost', 'wood', 'rations', 'lostCount']) {
      expect(head).toContain(col);
    }
    const row = lines[1].split(',');
    const pick = col => row[head.indexOf(col)];
    expect(pick('outcome')).toBe('clear');
    expect(pick('bossKilled')).toBe('1');
    expect(pick('firstExploreXp')).toBe('44');
    expect(pick('stashedCards')).toBe('2');
    expect(pick('pocketKept')).toBe('3');
    expect(pick('pocketLost')).toBe('1');
    expect(pick('wood')).toBe('2');
    expect(pick('rations')).toBe('3');
    expect(pick('lostCount')).toBe('3');
  });
});
