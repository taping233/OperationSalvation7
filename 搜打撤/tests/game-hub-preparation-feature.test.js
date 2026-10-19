// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createHubPreparationFeature } from '../game/src/hub/game.hub.preparation.js';

function createHarness({ availableCards = 2, failCommit = false, commitGate = null, presetSelection = {} } = {}) {
  const card = { id: 'card-a', name: '北境短刀', rarity: '普通', type: '武术' };
  let revision = 4;
  let snapshot = {
    stash: availableCards ? [{ card, count: availableCards }] : [],
    characters: { baita: { lv: 1 } },
    pets: { robot: { lv: 1 } },
    goals: {
      tracked: [],
      presets: {
        'preset-1': { id: 'preset-1', name: '猛攻', characterId: null, petId: null, ...presetSelection, picks: [{ card: { cardId: card.id }, count: 1 }] },
        'preset-2': { id: 'preset-2', name: '跑刀', characterId: null, petId: null, picks: [] },
      },
    },
  };
  const root = { isConnected: true };
  const view = {
    openPanel: vi.fn(() => root),
    buildModel: vi.fn(input => input),
    mount: vi.fn((mountedRoot, options) => {
      const controller = { update: vi.fn(), dispose: vi.fn() };
      view.lastIntent = options.onIntent;
      view.controller = controller;
      return controller;
    }),
    lastIntent: null,
    controller: null,
  };
  const navigation = { applyPicks: vi.fn(), openDeparture: vi.fn(), returnToBase: vi.fn() };
  const reportError = vi.fn();
  const commitBase = vi.fn(async (_context, command) => {
    if (failCommit) return { ok: false, message: '保存失败' };
    if (commitGate) return commitGate(_context, command);
    snapshot = structuredClone(command.afterState);
    revision++;
    return { ok: true, revision };
  });
  const readBase = vi.fn(() => ({ ok: true, value: snapshot, revision }));
  const feature = createHubPreparationFeature({
    data: {
      readBase,
      readBaseReceipt: vi.fn(async () => ({ ok: true, value: null })),
      commitBase,
      slotId: () => 'slot-1',
      cardCatalog: () => [card],
      characters: () => [{ id: 'baita' }],
      pets: () => [{ id: 'robot' }],
      bagCapacity: () => 5,
    },
    view,
    navigation,
    reportError,
    formatError: error => error.message || '读取失败',
    requestId: prefix => `${prefix}-test`,
  });
  return { feature, view, navigation, reportError, commitBase, readBase, readSnapshot: () => snapshot };
}

describe('基地整备功能端口', () => {
  it('Node 下无 DOM/global 也可装载；重复 open 幂等，dispose 后丢弃迟到 UI 更新', async () => {
    expect(globalThis.window).toBeUndefined();
    const h = createHarness();
    expect(h.feature.open()).toBe(true);
    expect(h.feature.open()).toBe(true);
    expect(h.view.openPanel).toHaveBeenCalledTimes(1);
    expect(h.view.mount).toHaveBeenCalledTimes(1);

    const staleIntent = h.view.lastIntent;
    await staleIntent({ type: 'goal-add', payload: { targetId: 'card-a' } });
    expect(h.readSnapshot().goals.tracked).toEqual(['card-a']);
    expect(h.commitBase).toHaveBeenCalledTimes(1);

    h.feature.dispose();
    expect(h.view.controller.dispose).toHaveBeenCalledTimes(1);
    await staleIntent({ type: 'goal-add', payload: { targetId: 'late-card' } });
    expect(h.commitBase).toHaveBeenCalledTimes(1);
  });

  it('预设缺卡时留在原页并显示提示；命令提交失败时不导航', async () => {
    const h = createHarness({ availableCards: 0, failCommit: true });
    h.feature.open();
    await h.view.lastIntent({ type: 'preset-apply', payload: { presetId: 'preset-1' } });
    expect(h.navigation.applyPicks).not.toHaveBeenCalled();
    expect(h.navigation.openDeparture).not.toHaveBeenCalled();
    expect(h.view.controller.update).toHaveBeenCalledWith(expect.objectContaining({ error: '库存或资格已变化，预设无法应用。' }));

    await h.view.lastIntent({ type: 'goal-add', payload: { targetId: 'card-a' } });
    expect(h.navigation.openDeparture).not.toHaveBeenCalled();
    expect(h.view.controller.update).toHaveBeenLastCalledWith(expect.objectContaining({ error: '保存失败' }));
  });

  it('初次与重绘读取失败都明确报告，不重复提交', async () => {
    const initialFailure = createHarness();
    initialFailure.feature.open();
    initialFailure.readBase.mockReturnValue({ ok: false, message: '档位失效' });
    await initialFailure.view.lastIntent({ type: 'goal-add', payload: { targetId: 'card-a' } });
    expect(initialFailure.reportError).toHaveBeenCalledWith('档位失效');
    expect(initialFailure.commitBase).not.toHaveBeenCalled();

    const repaintFailure = createHarness();
    repaintFailure.feature.open();
    const readCurrent = () => ({ ok: true, value: repaintFailure.readSnapshot(), revision: 4 });
    repaintFailure.readBase.mockReset()
      .mockImplementationOnce(readCurrent)
      .mockImplementationOnce(readCurrent)
      .mockReturnValue({ ok: false, message: '档位读取失败' });
    await repaintFailure.view.lastIntent({ type: 'goal-add', payload: { targetId: 'card-a' } });
    expect(repaintFailure.commitBase).toHaveBeenCalledTimes(1);
    expect(repaintFailure.reportError).toHaveBeenCalledWith('档位读取失败');
  });

  it('页面关闭时等待中的命令结果不会继续写入已卸载视图', async () => {
    let finishCommit;
    const gate = new Promise(resolve => { finishCommit = resolve; });
    const h = createHarness({ commitGate: () => gate });
    h.feature.open();
    const pendingIntent = h.view.lastIntent({ type: 'goal-add', payload: { targetId: 'card-a' } });
    await Promise.resolve();
    expect(h.commitBase).toHaveBeenCalledTimes(1);
    // A3-PREP-04 后命令挂起期间已推送 busy:true 帧（dispose 前的合法 UI 更新）；
    // 断言口径精确化为「dispose 后调用数不增」——迟到结果不得继续写入已卸载视图。
    const updatesBeforeDispose = h.view.controller.update.mock.calls.length;
    h.feature.dispose();
    finishCommit({ ok: true, revision: 5 });
    await pendingIntent;
    expect(h.view.controller.update.mock.calls.length).toBe(updatesBeforeDispose);
    expect(h.view.controller.dispose).toHaveBeenCalledTimes(1);
  });

  it('有效预设一次性替换带入卡并离开整备视图', async () => {
    const h = createHarness();
    h.feature.open();
    await h.view.lastIntent({ type: 'preset-apply', payload: { presetId: 'preset-1' } });
    expect(h.navigation.applyPicks).toHaveBeenCalledWith({ 'card:card-a': 1 });
    expect(h.navigation.openDeparture).toHaveBeenCalledTimes(1);
    expect(h.view.controller.dispose).toHaveBeenCalledTimes(1);
  });

  it('非默认人物与宠物随预设卡牌一并交给出征入口', async () => {
    const h = createHarness({ presetSelection: { characterId: 'baita', petId: 'robot' } });
    h.feature.open();
    await h.view.lastIntent({ type: 'preset-apply', payload: { presetId: 'preset-1' } });
    expect(h.navigation.applyPicks).toHaveBeenCalledExactlyOnceWith(
      { 'card:card-a': 1 }, { characterId: 'baita', petId: 'robot' });
    expect(h.navigation.openDeparture).toHaveBeenCalledOnce();
    expect(h.commitBase).not.toHaveBeenCalled();
  });

  it('A3-PREP-04 异步 intent 期间推送 busy:true，命令 settle 后回 false', async () => {
    let releaseCommit;
    const gate = new Promise(resolve => { releaseCommit = resolve; });
    const h = createHarness({ commitGate: () => gate });
    h.feature.open();
    const pending = h.view.lastIntent({ type: 'goal-add', payload: { targetId: 'card-a' } });
    await Promise.resolve();   // onIntent 同步段（卫语句 + setBusy(true)）已执行完
    expect(h.view.controller.update).toHaveBeenCalled();
    const busyFrames = h.view.controller.update.mock.calls.map(([model]) => model.busy);
    expect(busyFrames.at(-1)).toBe(true);   // 命令挂起期间最后一帧 busy:true
    releaseCommit({ ok: true, revision: 5 });
    await pending;
    const frames = h.view.controller.update.mock.calls.map(([model]) => model.busy);
    expect(frames).toContain(true);
    expect(frames.at(-1)).toBe(false);      // settle 后复位 busy:false
  });

  it('A3-PREP-04 命令抛异常同样回 busy:false（try/finally 兜底）', async () => {
    const h = createHarness({ commitGate: () => { throw new Error('boom'); } });
    h.feature.open();
    await expect(h.view.lastIntent({ type: 'goal-add', payload: { targetId: 'card-a' } })).rejects.toThrow('boom');
    const frames = h.view.controller.update.mock.calls.map(([model]) => model.busy);
    expect(frames).toContain(true);
    expect(frames.at(-1)).toBe(false);
  });
});
