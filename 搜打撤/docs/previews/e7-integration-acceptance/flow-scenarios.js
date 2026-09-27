// E7 QA only. Registered before boot; production modules are imported on demand.
export function register(ctx) {
  let running = false;
  let stopRequested = false;
  let policy = null;
  let policyRun = null;
  const options = { commandTimeoutMs: 12000, timeoutMs: 5000 };
  const record = (event, data = {}) => ctx.record(event, { source: 'E7 flow QA', ...data });
  const live = () => {
    ctx.assertIsolatedOrigin();
    const sdt = ctx.getSDT(), game = ctx.getGame();
    if (!sdt?.Agent || !game) throw new Error('请先启动真实主入口并等待加载完成');
    return { sdt, game, agent: sdt.Agent };
  };
  const slotOf = sdt => {
    const slot = Number(sdt.Base?.slot);
    if (!Number.isInteger(slot) || slot < 1 || slot > 5) throw new Error('当前没有有效隔离测试档位');
    return slot;
  };
  const snapshot = reason => {
    const { sdt, game, agent } = live();
    const battle = sdt.Battle?.getSnapshot?.();
    const data = {
      reason, origin: location.origin, state: game.state, runActive: game.runActive,
      slot: sdt.Base?.slot, seed: game.seed, layerIdx: game.layerIdx, trackPos: game.trackPos,
      hp: game.hp, coins: game.coins, visited: game.visited,
      ownedCards: game.ownedCards, usedPocket: game.usedPocket,
      eggBattles: sdt.Base?.data?.eggBattles, slots: ctx.readSlots(),
      observation: agent.observe(),
      battle: battle && { phase: battle.phase, busy: battle.busy, token: battle.battleToken,
        queue: battle.actionQueueLength, foes: battle.foes, energy: battle.energy },
      overlay: document.getElementById('ovTitle')?.textContent || '',
      log: document.getElementById('log')?.textContent?.slice(-6000) || '',
    };
    record('flow-snapshot', data);
    return data;
  };
  const add = (id, label, fn) => ctx.register(id, label, async () => {
    ctx.assertIsolatedOrigin();
    return await fn();
  });
  const exclusive = fn => async () => {
    if (running) throw new Error('已有 Agent 推进在途；请等待或按停止推进');
    running = true; stopRequested = false;
    try { return await fn(); } finally { running = false; }
  };
  const decideFor = (agent, game) => {
    if (!policy || policyRun !== game.discoveredPairs) {
      policy = agent.policies.greedy({ resetSlots: false, preferNest: false });
      policyRun = game.discoveredPairs;
    }
    return obs => {
      if (stopRequested || !game.runActive || game.state === 'battleSettlement') return null;
      const action = policy(obs);
      // QA must not automatically replace/delete slots, abandon runs or discard cards.
      if (action && /delSlot|overwriteSlot|newSlot|enterSlot|wipe|clear|abandon|discard/i.test(action.name || '')) {
        record('agent-action-blocked', { action, reason: '需人工操作，不在自动推进范围' });
        return null;
      }
      return action;
    };
  };
  add('flow-record', 'E3/E4 记录真实状态与存储', () => snapshot('manual'));
  add('flow-hover-help', 'E2 显示人工 hover 步骤', () => record('manual-hover-required', {
    entry: '/@fs/D:/素材/代号柒/搜打撤/docs/previews/e2-snapshot-acceptance/index.html',
    actions: ['点注能样本', '真实鼠标移至初始攻击，观察提示', '点选后移至右侧总督，观察伤害预览',
      '移出后确认预览恢复', 'Esc 取消，点记录当前证据'],
    limitation: '当前工具无真实 hover；此按钮不执行、不合成鼠标事件，不能据此判通过',
  }));
  add('flow-arm-run', '注入：下一次当前档 run 写失败（最终整理确认前）', () => {
    const { sdt, game } = live();
    if (!game.runActive) throw new Error('仅允许在隔离测试远征中布防');
    const slot = slotOf(sdt);
    snapshot('before-run-write-fault');
    ctx.armStorageFault({ slot, method: 'setItem', key: `sdt-save-v2-slot${slot}`, times: 1 });
    record('settlement-fault-armed', { slot, boundary: '下一次 run 写；需由写入轨迹确认命中最终 saving，不凭按钮名判定' });
  });
  add('flow-arm-run-two', '注入：当前档连续2次run写失败', () => {
    const { sdt, game } = live();
    if (!game.runActive) throw new Error('仅允许在隔离测试远征中布防');
    const slot = slotOf(sdt);
    snapshot('before-two-run-write-failures');
    ctx.armStorageFault({ slot, method: 'setItem', key: `sdt-save-v2-slot${slot}`, times: 2 });
    record('settlement-fault-armed', { slot, times: 2,
      boundary: '连续阻断两次 run 写；用于最终 commit 与后续一次恢复，是否保持 retry/journal 以实际轨迹为准' });
  });
  add('flow-arm-journal', '注入：下一次当前档 journal 写失败', () => {
    const { sdt, game } = live();
    if (!game.runActive) throw new Error('仅允许在隔离测试远征中布防');
    const slot = slotOf(sdt);
    snapshot('before-journal-write-fault');
    ctx.armStorageFault({ slot, method: 'setItem', key: `sdt-tx-v1-slot${slot}`, times: 1 });
    record('settlement-fault-armed', { slot, boundary: '日志前失败；必须在真实最终结算动作后检查命中记录' });
  });
  add('flow-disarm', '停止存储故障注入', () => {
    ctx.disarmStorageFault(); record('storage-fault-disarmed');
  });
  add('flow-step', '真实 Agent 单步（当前测试远征）', exclusive(async () => {
    const { agent, game } = live();
    if (!game.runActive) throw new Error('请通过真实 UI 新档整备并开始远征');
    const result = await agent.step(decideFor(agent, game), { ...options });
    record('agent-step', { action: result.action, result: result.res, done: result.done,
      stopReason: result.stopReason, error: result.error, settleStalled: result.settleStalled });
    snapshot('after-single-step');
    return result.res;
  }));
  add('flow-bounded', '真实 Agent 有界推进：最多 90 动作 / 3 次胜利', exclusive(async () => {
    const { sdt, agent, game } = live();
    if (!game.runActive) throw new Error('请先通过真实 UI 开始隔离测试远征');
    const slot = slotOf(sdt), token = game.discoveredPairs;
    const initialWins = Number(sdt.Base.data.eggBattles || 0);
    const decide = decideFor(agent, game), started = Date.now();
    let steps = 0, reason = 'max-steps';
    snapshot('bounded-start');
    try {
      while (steps < 90) {
        if (stopRequested) { reason = 'operator-stop'; break; }
        if (sdt.Base.slot !== slot || game.discoveredPairs !== token) { reason = 'context-changed'; break; }
        if (!game.runActive) { reason = 'run-ended'; break; }
        if (game.state === 'battleSettlement') { reason = 'settlement-pending'; break; }
        if (Number(sdt.Base.data.eggBattles || 0) - initialWins >= 3) { reason = 'three-wins'; break; }
        if (Date.now() - started >= 180000) { reason = 'three-minute-bound'; break; }
        const result = await agent.step(decide, { ...options });
        steps++;
        record('bounded-step', { step: steps, action: result.action, result: result.res,
          phase: result.obs?.phase, state: game.state, eggBattles: sdt.Base.data.eggBattles });
        if (result.stopReason || result.error || result.done || result.res?.ok === false || result.settleStalled) {
          reason = result.stopReason || result.error || (result.done ? 'policy-stop' : result.settleStalled ? 'settle-stalled' : 'command-rejected');
          break;
        }
      }
    } finally {
      record('bounded-finished', { steps, reason, elapsedMs: Date.now() - started,
        permanentCountDelta: Number(sdt.Base.data.eggBattles || 0) - initialWins,
        scope: '有限当前远征，实际到达场景见逐步记录；非全部长局通过' });
      snapshot('bounded-end');
    }
  }));
  add('flow-stop', '停止 QA 推进（保留当前在途动作）', () => {
    stopRequested = true; record('agent-stop-requested', { note: '不取消已受理生产命令；该命令返回后停止下一步' });
  });
  for (const [mode, label] of [['delay', '布防模块延迟'], ['fail', '布防模块失败'], ['release', '释放延迟模块'], ['none', '停止模块故障']]) {
    add(`flow-module-${mode}`, `E4 注入：${label}`, async () => {
      const result = await ctx.configureModuleFault({ mode });
      record('module-fault-control', { mode, result,
        boundary: '选角页会后台预取；必须在首次模块请求前布防，以服务命中日志为准；已加载时无效' });
      return result;
    });
  }
  add('flow-title', 'E4 受控退出：调用真实 showTitle', async () => {
    const { game } = live();
    if (running) throw new Error('先停止 QA Agent 推进，再测试退出归属');
    record('controlled-title-exit', { previousState: game.state, naturalUi: false });
    const { showTitle } = await import('/src/run/game.session.js');
    showTitle();
    snapshot('after-controlled-title-exit');
  });
  for (const kind of ['act', 'step']) {
    add(`flow-enter-${kind}`, `E4 Agent ${kind}：进入首个可见档位`, exclusive(async () => {
      const { agent } = live();
      const action = agent.observe().actions.find(a => a.type === 'ui' && a.name === 'enterSlot');
      if (!action) throw new Error('请先打开真实选档页，确保有可进入的隔离测试档');
      if (kind === 'act') {
        const accepted = agent.act(action);
        record('agent-enter-accepted', { action, result: accepted,
          boundary: 'async 初始 ok 仅受理；不表示完成或持久化。请观察后记录状态，不立即重派' });
        return accepted;
      }
      const result = await agent.step(() => action, { ...options });
      record('agent-enter-completed', { action, result: result.res, stopReason: result.stopReason,
        boundary: '完成成功也不等于持久化成功，另核 persistence 提示与存储' });
      snapshot('after-enter-step');
      return result.res;
    }));
  }
}
