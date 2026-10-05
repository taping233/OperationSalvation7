/* SYS-11（2026-10-03）定向测试：跑局记录能诚实回答「这局是谁打的、被干预过什么、为什么停」。
 *  ① 干预履历：调试干预必进 interventions 且 provenance 不再是纯 human（mixed）；
 *  ② 死亡局收益来自收据（与 G 现场反推口径冲突时回执赢，同 SYS-02 模式）；
 *  ③ 停止原因三态（completed/stalled/aborted，error 附带）+ autoRun 集成落 entry.stopReason；
 *  ④ 旧记录（无 provenance/stopReason）读取不炸，明细显示「未记录」，CSV 新列留空。 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// —— 轻量 mock：runner 集成段只隔离 game.session / game.run.flow 两个重模块（driver-restore 同款）
const fixture = vi.hoisted(() => ({ game: {}, slot: 1 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => fixture.slot, startNewGame: vi.fn(),
  curLayer: () => null, bagCap: () => 16, usedSlots: () => 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

// 记录器/数据页与实机同路径读 window.SDT（death.js 顶层解引用 window.SDT.UI，先备好）
window.SDT = window.SDT || {};
window.SDT.UI = window.SDT.UI || {};
window.SDT.Sound = window.SDT.Sound || { sfx() {} };
window.SDT.Cards = { sellPrice: (card) => (card?.rarity === '传说' ? 20 : 5) };

const { recordRun, noteIntervention, noteStopReason, classifyStop, listRuns,
  resetRunCounters, exportCSV, setDriver, getDriver } =
  await import('../game/src/agent/agent.recorder.js');
const { aggregate } = await import('../game/src/agent/agent.stats.js');
const { autoRun, stopRun } = await import('../game/src/agent/agent.runner.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const { bustSigCache } = await import('../game/src/agent/agent.state.js');

const setGame = (patch = {}) => {
  window.SDT.game = {
    mapSeed: 'seed-1', mode: 'standard', myClass: '战士', characterId: 'heixiang',
    layerIdx: 2, turn: 42, coins: 13, hp: 7, elapsed: 321, ownedCards: [], usedPocket: [],
    ...patch,
  };
};

beforeEach(() => {
  localStorage.clear();
  setDriver('human');
  setGame();
});

// —— ① 干预履历与 provenance 三态 ——
describe('SYS-11 干预履历与 provenance 三态', () => {
  it('纯人局：无干预 → driver=human、履历为空、stopReason 未记录（null）', () => {
    const entry = recordRun('extract', {});
    expect(entry.provenance).toEqual({ driver: 'human', agentDriver: null, interventions: [] });
    expect(entry.stopReason).toBeNull();
    expect(entry.driver).toBe('human');   // 顶层既有口径不动
  });

  it('调试干预必进履历且 provenance 不再是纯 human：dev 命令后 recordRun 断言 mixed', () => {
    noteIntervention('debug-command', '战斗调试:win');
    noteIntervention('dev-console', '加币:50');
    const entry = recordRun('extract', {});
    expect(entry.provenance.driver).toBe('mixed');
    expect(entry.provenance.interventions).toHaveLength(2);
    expect(entry.provenance.interventions[0]).toMatchObject({ source: 'debug-command', action: '战斗调试:win' });
    expect(entry.provenance.interventions[0].ts).toBeGreaterThan(0);   // 时间点
    expect(entry.provenance.interventions[1]).toMatchObject({ source: 'dev-console', action: '加币:50' });
    expect(entry.provenance.interventions[0].at).toEqual({ turn: 42, layer: 3 });   // 当时回合/层快照
  });

  it('纯 agent 局：结算时 driverTag 已被 autoRun 还原 human，provenance 依旧诚实记 agent', () => {
    setDriver('greedy');
    setDriver('human');   // 模拟 autoRun finally 还原（粘滞 runDriver 不被清）
    expect(getDriver()).toBe('human');
    const entry = recordRun('death', { why: '你倒下了' });
    expect(entry.provenance.driver).toBe('agent');
    expect(entry.provenance.agentDriver).toBe('greedy');
    expect(entry.provenance.interventions).toEqual([]);
  });

  it('agent 驱动 + 场景注入干预 → mixed 且保留具体驱动标签', () => {
    setDriver('llm');
    noteIntervention('scene-inject', '跳转节点:商店');
    const entry = recordRun('extract', {});
    expect(entry.provenance.driver).toBe('mixed');
    expect(entry.provenance.agentDriver).toBe('llm');
  });

  it('记录收口即清履历：不污染下一局', () => {
    noteIntervention('debug-command', '战斗调试:win');
    recordRun('extract', {});
    const second = recordRun('extract', {});
    expect(second.provenance).toEqual({ driver: 'human', agentDriver: null, interventions: [] });
    expect(listRuns()[0].provenance.driver).toBe('mixed');
  });

  it('resetRunCounters 清粘滞驱动/履历/停止原因（批跑逐局调用语义）', () => {
    setDriver('random');
    noteIntervention('debug-command', '战斗调试:energy');
    noteStopReason('spin');
    resetRunCounters();
    const entry = recordRun('extract', {});
    expect(entry.provenance).toEqual({ driver: 'human', agentDriver: null, interventions: [] });
    expect(entry.stopReason).toBeNull();
  });
});

// —— ③ 停止原因结构化 ——
describe('SYS-11 停止原因结构化', () => {
  it('classifyStop 三态 + 错误态：正常完成/卡死疑似/手动中止（含驱动方主动停）/错误', () => {
    expect(classifyStop('terminal-pending')).toBe('completed');
    expect(classifyStop('run-end')).toBe('completed');
    expect(classifyStop('until')).toBe('completed');
    expect(classifyStop('spin')).toBe('stalled');
    expect(classifyStop('wait-limit')).toBe('stalled');
    expect(classifyStop('battle-stall')).toBe('stalled');
    expect(classifyStop('no-progress')).toBe('stalled');
    expect(classifyStop('cancelled')).toBe('aborted');
    expect(classifyStop('decide-null')).toBe('aborted');
    expect(classifyStop('already-running')).toBe('aborted');
    expect(classifyStop('step-errors')).toBe('error');
    expect(classifyStop('step-exception')).toBe('error');
    expect(classifyStop('未知码')).toBe('unknown');
  });

  it('卡死疑似点带当前场景+等待动作，随 recordRun 落 entry.stopReason', () => {
    noteStopReason({ code: 'spin', phase: 'loot', turn: 7, waitingAction: 'ui:evtChoice', steps: 33 });
    const entry = recordRun('abandon', {});
    expect(entry.stopReason).toMatchObject({
      code: 'spin', kind: 'stalled', phase: 'loot', turn: 7,
      waitingAction: 'ui:evtChoice', steps: 33,
    });
  });

  it('纯码字符串也能记（最小结构），下一次记录不残留', () => {
    noteStopReason('wait-limit');
    expect(recordRun('abandon', {}).stopReason).toEqual({ code: 'wait-limit', kind: 'stalled' });
    expect(recordRun('abandon', {}).stopReason).toBeNull();
  });
});

// —— ② 死亡收据 ——
describe('SYS-11 死亡链收益接回执', () => {
  it('buildDeathReceipt 与撤离回执同形：收益=抢运清单、散失=其余+口袋、首探经验不发', async () => {
    const { buildDeathReceipt } = await import('../game/src/run/game.session.death.js');
    const rescuedCard = { name: '江湖救急', rarity: '传说', type: '事件' };
    const game = {
      ownedCards: [
        { card: rescuedCard, safe: true },
        { card: { name: '火球', rarity: '史诗', type: '法术' }, safe: false },
        { card: { name: '木材车', rarity: '古朴', type: '道具' }, safe: false },
      ],
      usedPocket: [{ card: { name: 'A' }, count: 2 }, { card: { name: 'B' }, count: 1 }],
      layerIdx: 2, turn: 21, coins: 15, elapsed: 200.6, bossKilled: false,
      explored: { a: 1, b: 2, c: 3 },   // 首探量走 SYS-01 口径（explored 键数）
    };
    const rescuedCards = game.ownedCards.filter(o => o.safe).map(o => ({ card: o.card, count: 1 }));
    const receipt = buildDeathReceipt({ game, rescuedCards });
    expect(receipt).toMatchObject({
      version: 1, outcome: 'death', bossKilled: false, layersReached: 3, actions: 20,
      firstExplore: { moves: 3, xp: 0 },
      netTake: { cardsStashed: 1, pocketKept: 0, wood: 0, rations: 0 },
      losses: { lostCount: 2, pocketLost: 3 },
      runCoins: 15, durationSec: 200,
    });
    expect(receipt.losses.lostNotable).toEqual([
      expect.objectContaining({ name: '火球', rarity: '史诗' }),
    ]);
  });

  it('死亡局收益读回执：与 G 现场冲突时回执赢（recordRun 通用通道，SYS-02 同款断言）', () => {
    setGame({ layerIdx: 98, turn: 99, coins: 99, elapsed: 999, hp: 0 });
    const receipt = {
      version: 1, outcome: 'death', bossKilled: false, layersReached: 3, actions: 20,
      firstExplore: { moves: 9, xp: 0 },
      netTake: { cardsStashed: 2, pocketKept: 0, wood: 0, rations: 0 },
      losses: { lostCount: 4, lostNotable: [], pocketLost: 3 },
      runCoins: 15, durationSec: 180,
    };
    const entry = recordRun('death', {
      why: '你倒下了',
      savedCards: [{ card: { name: '江湖救急', rarity: '传说', type: '事件' }, count: 1 }],
      receipt,
    });
    expect(entry).toMatchObject({
      outcome: 'death', maxLayer: 3, turns: 20, coins: 15, durationSec: 180,
      firstExploreXp: 0, firstExploreMoves: 9,
      netTake: { cardsStashed: 2, pocketKept: 0 },
      losses: { lostCount: 4, pocketLost: 3 },
    });
    expect(entry.receipt).toEqual(receipt);   // 原始回执整体留档
    expect(entry.hpLeft).toBe(0);             // 无回执字段的事实（终局血量）仍来自 G 现场
    expect(entry.carriedValue).toBe(20);      // carried 仍按 savedCards 既有口径
  });
});

// —— ④ 旧记录兼容 ——
describe('SYS-11 旧记录兼容（无 provenance/stopReason）', () => {
  const legacyRun = {
    id: 'run-legacy', ts: 1700000000000, driver: 'human', outcome: 'death', why: '你倒下了',
    seed: 's', mode: 'standard', class: '战士', characterId: null, maxLayer: 2, node: null,
    turns: 18, coins: 3, hpLeft: 0, durationSec: 90, bossKilled: false,
    battles: { fought: 2, won: 0 }, lastBattles: [], carried: [], carriedValue: 0, receipt: null,
  };

  it('listRuns/aggregate/exportCSV 读取不炸，byDriver 切分正常，CSV 新列留空', () => {
    localStorage.setItem('sdt-run-records', JSON.stringify([legacyRun]));
    const runs = listRuns();
    expect(runs[0].provenance).toBeUndefined();
    expect(runs[0].stopReason).toBeUndefined();
    const agg = aggregate(runs);
    expect(agg.byDriver.unknown.runs).toBe(1);
    const lines = exportCSV().trim().split('\n');
    const head = lines[0].split(',');
    for (const col of ['provenanceDriver', 'interventions', 'stopReason']) expect(head).toContain(col);
    const row = lines[1].split(',');
    expect(row[head.indexOf('provenanceDriver')]).toBe('');
    expect(row[head.indexOf('interventions')]).toBe('');
    expect(row[head.indexOf('stopReason')]).toBe('');
  });

  it('数据页明细：旧记录显示「未记录」，新混合局标「混」，纯人局/Agent 局照常可辨', async () => {
    localStorage.setItem('sdt-run-records', JSON.stringify([legacyRun]));
    noteIntervention('debug-command', '战斗调试:win');
    recordRun('extract', {});
    setDriver('greedy');
    recordRun('extract', {});
    const { dataPanelHTML } = await import('../game/src/agent/agent.data.js');
    const html = dataPanelHTML();
    expect(html).toContain('未记录');
    expect(html).toContain('混合干预');
    expect(html).toContain('Agent·脚本·贪心');
    expect(html).not.toContain('undefined');
  });
});

// —— ③ 补充：autoRun 集成——真实收口写 entry.stopReason ——
describe('SYS-11 autoRun 停止原因落记录（集成）', () => {
  const options = { preSettled: true, allowEmpty: true, quietMs: 1, pollMs: 1, timeoutMs: 100, commandTimeoutMs: 100 };

  beforeEach(() => {
    Object.assign(fixture.game, { state: 'idle', runActive: true, battleActive: false, nestActive: false,
      discoveredPairs: new Set(), nestRunes: [], turn: 1, ownedCards: [], inventory: [], usedPocket: [] });
    fixture.slot = 1;
    document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
    window.SDT.game = fixture.game;
    window.SDT.UI = { _acts: {} };
    setTurbo(true);
    bustSigCache();
    resetRunCounters();   // 批跑同款：每局开跑前清计数与履历
  });

  it('驱动方主动停（decide-null）→ kind=aborted，trace 与 entry 同码', async () => {
    setDriver('human');
    const trace = await autoRun({ decide: () => null, driver: 'greedy', maxSteps: 3, ...options });
    expect(trace.stopReason).toBe('decide-null');
    const entry = recordRun('abandon', {});
    expect(entry.stopReason).toMatchObject({ code: 'decide-null', kind: 'aborted' });
    expect(entry.provenance.driver).toBe('agent');   // 粘滞驱动标签进 provenance
    expect(entry.provenance.agentDriver).toBe('greedy');
  });

  it('手动中止（stopRun）→ kind=aborted；entry 顶层 driver 仍为既有口径', async () => {
    setDriver('human');
    let called = 0;
    const decide = () => { if (!called++) stopRun(); return { type: 'sys', name: 'noop' }; };
    const trace = await autoRun({ decide, driver: 'random', maxSteps: 50, waitLimitMs: 50, ...options });
    expect(trace.stopReason).toBe('cancelled');
    const entry = recordRun('abandon', {});
    expect(entry.stopReason).toMatchObject({ code: 'cancelled', kind: 'aborted' });
    expect(entry.driver).toBe('human');
  });
});
