/** Owns run/session receipts and restoration write tracking. State and services
 * are read at use time; saveGame and saveSession retain distinct success semantics. */
export function createSessionPersistence({ readState, readServices, readUI, readStorage,
  Random, RunStorage, SLOT_COUNT, TX_KEY, createMapSnapshot, GENERATOR_VERSION, LAYOUT_VERSION,
  snapshotRunBattles, assertZones, publishSaveState, withSlotWriteLock }) {
let lastSaveFailWarnAt = 0;           // 写档失败警示 30s 节流（迭代评审 09-20 G-P3）：成功落盘即复位
let lastSaveConflictWarnAt = 0;
let pendingBattleSettlement = null;
// 只在同步装载期间收集原有保存调用；包括 enterLayer 间接触发的 saveGame。
let loadPersistence = null;
const loadPersistenceTasks = new WeakMap();

function recordLoadPersistence(target, reason, ok, code) {
  if (!loadPersistence) return;
  const attempt = { target, reason, ok: ok === true };
  if (!attempt.ok && code) attempt.code = code;
  loadPersistence.attempts.push(attempt);
  loadPersistence.status = loadPersistence.attempts.some(a => a.pending) ? 'pending'
    : loadPersistence.attempts.some(a => !a.ok) ? 'failed' : 'succeeded';
}

function saveBaseForLoad(reason) {
  return recordBaseSaveForLoad(reason, readServices().Base.save());
}

function recordBaseSaveForLoad(reason, ok, target = 'base') {
  if (ok && typeof ok.then === 'function') {
    const context = loadPersistence;
    if (!context) return ok;
    const attempt = { target, reason, ok: null, pending: true };
    context.attempts.push(attempt);
    context.status = 'pending';
    const task = Promise.resolve(ok).catch(() => false).then(saved => {
      attempt.ok = saved === true;
      delete attempt.pending;
      if (!attempt.ok) attempt.code = target === 'run' ? 'RUN_SAVE_FAILED' : 'BASE_SAVE_FAILED';
      context.status = context.attempts.some(a => a.pending) ? 'pending'
        : context.attempts.some(a => !a.ok) ? 'failed' : 'succeeded';
      return attempt.ok;
    });
    loadPersistenceTasks.get(context)?.push(task);
    return task;
  }
  recordLoadPersistence(target, reason, ok, target === 'run' ? 'RUN_SAVE_FAILED' : 'BASE_SAVE_FAILED');
  return ok;
}

function setBattleSettlementPending(slotId, runId) {
  pendingBattleSettlement = { slotId, runId, seed: readState().game.seed, runToken: readState().game.discoveredPairs };
}

function clearBattleSettlementPending(slotId, runId) {
  if (pendingBattleSettlement?.slotId === slotId && pendingBattleSettlement.runId === runId) pendingBattleSettlement = null;
}

function blocksSaveForPendingBattleSettlement() {
  if (!pendingBattleSettlement) return false;
  if (readState().activeSlot !== pendingBattleSettlement.slotId) {
    pendingBattleSettlement = null;
    return false;
  }
  const sameInMemoryRun = readState().game.seed === pendingBattleSettlement.seed && readState().game.discoveredPairs === pendingBattleSettlement.runToken;
  const currentIdentity = RunStorage.readIdentity(readState().activeSlot);
  if (currentIdentity.ok && currentIdentity.value.runId !== pendingBattleSettlement.runId) {
    pendingBattleSettlement = null;
    return false;
  }
  if (!sameInMemoryRun) {
    pendingBattleSettlement = null;
    return false;
  }
  return true;
}

const hasRun = (i) => RunStorage.has(i);                            // 该档有进行中的对局

function readSlot(i) {
  return RunStorage.read(i);
}

function migrateOldSave() {
  return RunStorage.migrateLegacy();
}

// 构造当前稳定点的唯一对局 payload。结算 pair 会直接提交它，因此此入口不
// 同步时长、不调用 Base.save，也不写 RunStorage。
function createRunSavePayload({ freshRun = false } = {}) {
  assertZones();
  const identity = readState().activeSlot ? RunStorage.readIdentity(readState().activeSlot) : null;
  const snapshotResult = readState().game.nestActive ? { ok: true, value: null } : createMapSnapshot({
    mapSeed: readState().game.mapSeed, generatorVersion: readState().game.generatorVersion, layoutVersion: readState().game.layoutVersion, layerData: readState().game.layerData,
    routeVersion: readState().game.routeVersion, routePlan: readState().game.routePlan,
  }, { layerIdx: readState().game.layerIdx, trackPos: readState().game.trackPos });
  if (!snapshotResult.ok) return null;
  const chestReward = readServices().Chests?.serialize?.(readState().game) || null;
  const nodeChestRewards = { ...(readState().game.nodeChestRewards || {}) };
  if (chestReward) nodeChestRewards[`${readState().game.layerIdx},${readState().game.trackPos}`] = chestReward;
  return {
    seed: Random.seed, rngState: Random.snapshot(),
    mapSeed: readState().game.mapSeed ?? Random.seed,
    encounterRotationVersion: readState().game.encounterRotationVersion === 1 ? 1 : 0,
    generatorVersion: readState().game.generatorVersion ?? GENERATOR_VERSION,
    layoutVersion: readState().game.layoutVersion ?? LAYOUT_VERSION,
    geometryVersion: readState().game.geometryVersion ?? null,
    routeVersion: readState().game.routeVersion ?? null,
    mapSnapshot: snapshotResult.value,
    layerIdx: readState().game.layerIdx, trackPos: readState().game.trackPos,
    hp: readState().game.hp, maxHp: readState().game.maxHp, coins: readState().game.coins, turn: readState().game.turn,
    atk: readState().game.atk, mode: readState().game.mode, myClass: readState().game.myClass || null, characterId: readState().game.characterId || null,
    inventory: readState().game.inventory, ownedCards: readState().game.ownedCards,
    cardOrder: readState().game.cardOrder || [],
    usedPocket: readState().game.usedPocket,
    eventLog: readState().game.eventLog || [],
    visited: readState().game.visited || {},
    seen: readState().game.seen || {},
    explored: readState().game.explored || null,   // 2026-10-03 老板（SYS-01）：首踏入格打标（撤离经验锚定首探）；旧档会话为 null 原样回写
    fragments: readState().game.fragments || 0,
    discovered: [...readState().game.discoveredPairs],
    bossKilled: !!readState().game.bossKilled,
    altarActivated: !!readState().game.altarActivated,   // 第四层祭坛是否已激活（首脑格准入条件）
    altarRewardPending: !!readState().game.altarRewardPending,   // 祭坛奖励待领取（回赠面板可重进，只能领一次）
    bossPlan: (readState().game.bossPlan == null ? null : readState().game.bossPlan),   // 本层首脑预案（进层 roll 一次存全层，2026-09-13 老板拍板）
    altarItemSacrificed: !!readState().game.altarItemSacrificed,   // 第四层祭坛道具献祭一次性锁（2026-09-19 老板定版）
    shopStocks: readState().game.shopStocks || {},   // 各商店货架（按格子/门持久，防关门重刷，2026-09-19 审计 D-1）
    chestReward, nodeChestRewards,
    entrySupply: readState().game.entrySupply || null,
    nodeRewards: readState().game.nodeRewards || {},
    runBattleStats: freshRun ? { version: 1, runId: null, fought: 0, won: 0, log: [] } : snapshotRunBattles(identity?.ok ? identity.value.runId : null),
    elapsed: readState().game.elapsed,
    elapsedTimeBaseline: Math.max(0, Number(readState().game.elapsedTimeBaseline) || 0),
    slot: readState().activeSlot, savedAt: Date.now(),
    // 战斗中退出/关窗（beforeunload）：只写战斗入场检查点；读档从本场战斗开头重开
    battle: (readState().game.battleActive && readServices().Battle && typeof readServices().Battle.serialize === 'function')
      ? readServices().Battle.serialize() : null,
    // 龙巢进行中状态（2026-09-18 断点续战）
    nestActive: !!readState().game.nestActive,
    nestPos: readState().game.nestPos == null ? 0 : readState().game.nestPos,
    cardBox: readState().game.cardBox || [],
    nestRunes: readState().game.nestRunes || [],
    nestEquipped: readState().game.nestEquipped || [],
    nestBossName: readState().game.nestBossName || null,
    nestKills: readState().game.nestKills || 0,
    nestBossDown: !!readState().game.nestBossDown,
    nestTargetedBox: readState().game.nestTargetedBox || 0,
    nestAltarChoice: readState().game.nestAltarChoice || null,
    nestShopStocks: readState().game.nestActive ? readState().game.nestShopStocks || {} : {},
    pendingRunePick: readState().game.pendingRunePick || null,
  };
}

// A receipt belongs to the exact in-memory run that initiated its write.
function captureSaveOwner() {
  const { game, activeSlot } = readState(), seed = game.seed, token = game.discoveredPairs;
  return () => readState().game === game && readState().activeSlot === activeSlot
    && game.seed === seed && game.discoveredPairs === token;
}

async function saveGame() {
  // 整理期间只有两键结算命令能推进存档，常规自动保存不得覆盖待入库状态。
  if (readState().game.pendingExtraction || readState().game.extractionPending || readState().game.terminalPending || blocksSaveForPendingBattleSettlement()) return false;
  // 战败倒地演出可延后 battle:end/doDeath；此时 battleActive 已清零，不能把致死血量写回进行中对局。
  if (readState().game.runActive && !readState().game.battleActive && readState().game.hp <= 0) return false;
  // v0.21：只有真正开局后（runActive）才写对局存档；在基地/标题界面不产生对局文件
  // 只保存稳定节点；动画中可能仍停在线段中间，退出/刷新后必须回到上一个落点。
  if ((!readState().game.runActive && !readState().game.nestActive) || readState().game.state === 'title' || readState().game.state === 'done' || readState().game.state === 'boot' || readState().game.state === 'moving') return;
  if (!readState().activeSlot) return;
  syncPlayTime();
  const payload = createRunSavePayload();
  if (!payload) {
    readUI().log('[[icon:cross]] 路线快照校验失败，本次未覆盖旧对局存档', 'warn');
    return false;
  }
  const writingSlot = readState().activeSlot, current = captureSaveOwner();
  publishSaveState('saving', 'run');
  const writing = RunStorage.write(writingSlot, payload);
  recordBaseSaveForLoad('save_game', writing, 'run');
  const ok = await writing;
  if (!current()) return ok;
  publishSaveState(ok ? 'saved' : 'failed', 'run', ok ? '对局检查点已保存' : '对局检查点尚未保存，请重试');
  if (!ok) {
    if (RunStorage.lastWriteIssue(readState().activeSlot) === 'STALE_SLOT') {
      const now = Date.now();
      if (now - lastSaveConflictWarnAt >= 30_000) {
        lastSaveConflictWarnAt = now;
        readUI().log('[[icon:cross]] 档位已在其他标签页更新，对局进度未保存，请重新载入档位后继续', 'warn');
        console.warn('[save] 对局存档版本冲突：请重新载入档位后继续');
      }
      return false;
    }
    // 写失败（典型：localStorage 配额满，五档对局+基地+留言共约 5MB）不提示就是无声丢档。
    // 30s 节流+成功复位（迭代评审 09-20 G-P3）：处置前持续丢进度有感知、腾出空间后立即恢复提醒
    const now = Date.now();
    if (now - lastSaveFailWarnAt >= 30_000) {
      lastSaveFailWarnAt = now;
      readUI().log('[[icon:cross]] 对局存档写入失败（存储空间可能已满），进度未被保存——请导出存档或删除旧档位', 'warn');
      console.error('[save] RunStorage.write 失败：对局进度未落盘（配额满或存储不可用）');
    }
  } else {
    lastSaveFailWarnAt = 0;   // 成功落盘=已恢复，下次失败立即提示（节流不吞「已恢复」后的第一次告警）
    lastSaveConflictWarnAt = 0;
  }
  return ok;
}
function syncPlayTime() {
  if (!readState().activeSlot || readServices().Base.slot !== readState().activeSlot) return Promise.resolve({ changed: false, persisted: true });
  const now = Math.max(0, Number(readState().game.elapsed) || 0), previous = Math.max(0, Number(readState().game.elapsedSynced) || 0);
  if (!(now > previous)) return Promise.resolve({ changed: false, persisted: true });
  // Reserve the checkpoint before waiting for the lock so overlapping saves never count the same seconds twice.
  readState().game.elapsedSynced = now;
  const identity = RunStorage.readIdentity(readState().activeSlot);
  const runId = identity.ok ? identity.value.runId : null;
  const current = captureSaveOwner();
  const result = Promise.resolve(readServices().Base.syncPlayTime(now, previous, runId));
  recordBaseSaveForLoad('play_time_sync', result.then(value => value.changed === false || value.persisted === true));
  result.then(value => { if (current() && 'persisted' in value && value.persisted === false) readUI().log('[[icon:cross]] 游玩时间尚未保存；本局内存进度保留，请重试保存', 'warn'); });
  return result;
}

async function saveSession() {
  const currentRun = captureSaveOwner(), slot = readState().activeSlot, base = readServices().Base;
  const current = () => currentRun() && readServices().Base === base && (!slot || base.slot === slot);
  const stale = () => ({ ok:false, code:'STALE_SLOT', message:'保存期间对局已变化' });
  publishSaveState('saving', 'session');
  const runSaved = await saveGame();
  if (!current()) return stale();
  const checkpoints = await base.flushWrites?.();
  if (!current()) return stale();
  const baseSaved = !slot || await base.save();
  if (!current()) return stale();
  const baseFailed = !baseSaved || (!slot && checkpoints?.ok === false);
  if (runSaved === false || baseFailed) { publishSaveState('failed', 'session', '部分进度尚未保存，请重试'); return { ok: false, code: baseFailed ? 'BASE_SAVE_FAILED' : 'RUN_SAVE_FAILED', message: '部分进度尚未保存，请重试' }; }
  publishSaveState('saved', 'session', '已保存');
  return { ok: true };
}

// 保全与两键顺序删除共用一次租约；失败报告部分完成，不回填跨键快照。
async function clearSlot(i, { preserveAbnormal = false } = {}) {
  const cleared = await withSlotWriteLock(i, lease => {
    if (preserveAbnormal) {
      try {
        if (readStorage().getItem(TX_KEY(i)) !== null || readStorage().getItem(`sdt-import-v1-slot${i}`) !== null) throw new Error('pending recovery');
        const baseRaw = readStorage().getItem(readServices().Base.SLOT_KEY(i)), runRaw = readStorage().getItem(RunStorage.key(i));
        if (baseRaw !== null) readStorage().setItem(readServices().Base.PRESERVED_KEY(i), baseRaw);
        if (runRaw !== null) readStorage().setItem(`sdt-run-${i}-preserved`, runRaw);
      } catch { return { ok: false, slot: i, code: 'PRESERVE_FAILED', message: '原档保全失败，尚未清空档位；请先导出或恢复存储空间' }; }
    }
    if (!RunStorage._removeLocked(i, lease)) return { ok: false, slot: i, code: 'RUN_DELETE_FAILED',
      message: '对局删除未完整完成，基地数据未删除；请检查存储状态后重试' };
    if (!readServices().Base._wipeLocked(i, lease)) return { ok: false, slot: i, code: 'BASE_DELETE_FAILED',
      message: '对局已删除，基地数据未能删除；请检查存储状态后重试' };
    return { ok: true, slot: i };
  });
  return cleared.ok ? cleared.value : { ok: false, slot: i, code: 'SLOT_DELETE_LOCK_FAILED', message: '尚未取得档位保存锁，档案未被删除；请重试' };
}
function clearSave() { return readState().activeSlot ? RunStorage.remove(readState().activeSlot) : Promise.resolve(true); }
async function clearAllSlots() {
  const results = [];
  for (let i = 1; i <= SLOT_COUNT; i++) results.push(await clearSlot(i));
  return { ok: results.every(result => result.ok), results };
}

function trackRestoration(restore, slot) {
  const persistence = { status: 'not_attempted', attempts: [] };
  const tasks = [];
  loadPersistenceTasks.set(persistence, tasks);
  const previous = loadPersistence;
  loadPersistence = persistence;
  try {
    const result = restore();
    const restoredSeed = readState().game.seed;
    const pendingPersistence = Promise.all(tasks).then(() => {
      if (persistence.status === 'failed') {
        if (readState().activeSlot === slot && readState().game.seed === restoredSeed) readUI().log(`[[icon:cross]] ${result.ok ? '对局已恢复，但恢复后的部分进度未保存' : '恢复过程中部分进度未保存'}，请勿将本次进入视为保存成功；请检查存储状态后重试保存`, 'warn');
        return { ok: false, code: persistence.attempts.find(attempt => attempt.ok === false)?.code || 'SAVE_FAILED' };
      }
      return { ok: true };
    });
    return { ...result, persistence, pendingPersistence };
  } finally {
    loadPersistence = previous;
  }
}

return { createRunSavePayload, saveGame, saveSession, syncPlayTime, clearSlot, clearSave, clearAllSlots,
  hasRun, readSlot, migrateOldSave, setBattleSettlementPending, clearBattleSettlementPending,
  saveBaseForLoad, recordBaseSaveForLoad, trackRestoration };
}
