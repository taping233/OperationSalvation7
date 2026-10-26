import { endAbandonedNodeContent, endNodeContent, nodeContentEndedAt } from './node-reward-state.js';

/** Synchronous restoration admission and field replay. Presentation and storage
 * commands are ports so restoration keeps its original order without importing UI. */
export function createSessionRestoration({ readState, readServices, readUI, development,
  RunStorage, validateRunSave, validatePendingExtraction, planMapRestore, traceRestoreStep,
  Random, installDerived, MODES, MAP, applyModeRules, refreshCardClones, eventChoiceRewardAt,
  restoreRunBattles, setLobby, enterLayer, saveGame, saveBaseForLoad, recordBaseSaveForLoad, trackRestoration }) {
const numOr = (v, d) => { const n = +v; return Number.isFinite(n) ? n : d; };

function preflightRunMap(slot) {
  const identity = RunStorage.readIdentity(slot);
  if (identity.code === 'RECOVERY_REQUIRED' || identity.code === 'STORAGE_READ_FAILED') return { ...identity, preserveRun: true };
  const s = RunStorage.readForPreflight(slot);
  if (!s) {
    const issue = RunStorage.issue(slot);
    return { ok:false, code:issue==='tooNew'?'RUN_TOO_NEW':issue==='readFailed'?'STORAGE_READ_FAILED':'RUN_UNREADABLE', message:RunStorage.loadIssueMessage(slot) || '对局存档无法读取', preserveRun:true };
  }
  const structure = validateRunSave(s);
  if (!structure.ok) return structure;
  if (s.pendingExtraction != null) {
    const pending = validatePendingExtraction(s.pendingExtraction);
    if (!pending.ok) return { ...pending, preserveRun: true };
    // readForPreflight 可能已由 prev 自愈主档，撤离身份须按生效原串重新核验。
    const effectiveIdentity = RunStorage.readIdentity(slot);
    if (effectiveIdentity.code === 'STORAGE_READ_FAILED') return { ...effectiveIdentity, preserveRun: true };
    if (!effectiveIdentity.ok || effectiveIdentity.value.runId !== s.pendingExtraction.runId) {
      return { ok: false, code: 'INVALID_EXTRACTION_IDENTITY', message: '撤离整理记录与对局身份不一致', preserveRun: true };
    }
  }
  const planned=planMapRestore(s);
  return planned.ok?{ok:true,value:{run:s,plan:planned.value}}:planned;
}

function loadGame(slot) {
  const restore = () => trackRestoration(() => restoreGame(slot), slot);
  return development ? traceRestoreStep('load-game', restore) : restore();
}

function restoreGame(slot) {
  const preflight=preflightRunMap(slot);
  if(!preflight.ok) {
    if (preflight.code === 'RUN_UNREADABLE') readUI().log(`[[icon:cross]] ${preflight.message}，原档已保留`, 'warn');
    else if (preflight.code === 'RUN_TOO_NEW') readUI().log('[[icon:cross]] 对局存档来自更新版本的游戏，无法读取', 'warn');
    else readUI().log(`[[icon:cross]] ${preflight.message}，原档已保留`, 'warn');
    return preflight;
  }
  const {run:s,plan}=preflight.value;
  const identity = RunStorage.readIdentity(slot);
  if (identity.code === 'STORAGE_READ_FAILED') {
    readUI().log(`[[icon:cross]] ${identity.message}，原档已保留`, 'warn');
    return { ...identity, preserveRun: true };
  }
  const accepted = RunStorage.acceptLoad(slot, s);
  if (!accepted.ok) {
    readUI().log(`[[icon:cross]] ${accepted.message}，原档已保留`, 'warn');
    return accepted;
  }
  restoreRunBattles(s.runBattleStats, identity.ok ? identity.value.runId : null);
  readState().game.seed = Random.restore(s.rngState || s.seed);
  if (plan.source !== 'nest') installDerived(plan.layerData, plan.mapSeed, plan.generatorVersion, plan.layoutVersion, plan.routeVersion, plan.routePlan);
  readServices().Base.use(slot);   // 该档位的基地数据（仓库/熟练度/成就/卡背）
  const bi = readServices().Base.issue(slot);
  if (bi === 'corrupt') readUI().log('[[icon:cross]] 该档位基地数据损坏，原档已保留，本次以空档案启动', 'warn');
  else if (bi === 'tooNew') readUI().log('[[icon:cross]] 该档位基地数据来自更新版本的游戏，已以空档案启动', 'warn');
  readState().game.runActive = true;
  setLobby(false);      // 直接回到棋盘上的对局：恢复左侧栏
  readState().game.hp = numOr(s.hp, MAP.rules.playerMaxHp);   // 归一化（09-20）：迁移链之后执行，坏字段回退默认
  readState().game.maxHp = numOr(s.maxHp, MAP.rules.playerMaxHp);
  readState().game.atk = numOr(s.atk, MAP.rules.playerAtk);
  readState().game.coins = numOr(s.coins, 0); readState().game.turn = numOr(s.turn, 1);
  readState().game.mode = MODES[s.mode] ? s.mode : 'standard';
  readState().game.myClass = s.myClass || null;
  readState().game.characterId = s.characterId || null;
  applyModeRules();
  readState().game.inventory = Array.isArray(s.inventory) ? s.inventory : [];
  readState().game.ownedCards = Array.isArray(s.ownedCards) ? s.ownedCards : [];
  readState().game.cardBox = Array.isArray(s.cardBox) ? s.cardBox : [];
  // 能力卡术语迁移（原「英雄卡」类型，2026-09-08 定版）：存档内整卡副本与基地仓库/口袋同步更名
  {
    const copies = readState().game.ownedCards.map(o => o.card)
      .concat(readState().game.cardBox || [])
      .concat((readServices().Base.data.stash || []).concat(readServices().Base.data.pocket || []).map(st => st.card));
    const abilityChanged = readServices().Cards.applyAbilityRename(copies);
    const duplicateChanged = readServices().Cards.applyDuplicateRenames(copies);
    if (abilityChanged || duplicateChanged) saveBaseForLoad('card_rename');
  }
  readState().game.cardOrder = Array.isArray(s.cardOrder) ? s.cardOrder : [];
  readState().game.usedPocket = Array.isArray(s.usedPocket) ? s.usedPocket : [];
  // 背包/仓库/消耗区卡牌快照刷新（2026-09-10 留言 #22/#37）：发牌时存的是卡库快照克隆且
  // 从不随版本更新——旧档里「血蝠风暴」还卡着旧费用 4（每回合 2 费永远注能不了）、「法力奔涌」
  // 带着旧措辞描述（识别正则失配整卡无效）。读档时按 id 用现行卡库刷新克隆。
  refreshCardClones(readState().game.ownedCards.map(o => o.card)
    .concat(readState().game.usedPocket.map(p => p.card))
    .concat(readState().game.cardBox || [])
    .concat((readServices().Base.data.stash || []).concat(readServices().Base.data.pocket || []).map(st => st.card).filter(Boolean)));
  readState().game.eventLog = Array.isArray(s.eventLog) ? s.eventLog : [];
  // 迷雾与防重刷（旧档无字段 → {}，走【全部可见/可重复】的兼容路径）
  readState().game.visited = (s.visited && typeof s.visited === 'object') ? s.visited : {};
  readState().game.seen = (s.seen && typeof s.seen === 'object') ? s.seen : {};
  // 2026-10-03 老板（SYS-01）：首踏入格打标（撤离经验只统计首次有效探索）；旧档无字段 → null，
  // 本会话移动不补标、撤离结算回退旧口径 turn-1（存量进度不缩水）
  readState().game.explored = (s.explored && typeof s.explored === 'object') ? s.explored : null;
  readState().game.fragments = +s.fragments || 0;   // 员工通行证A碎片（旧档无字段 → 0）
  readState().game.bossKilled = !!s.bossKilled;     // 本局是否已击败首脑（终局撤离条件）
  readState().game.encounterRotationVersion = s.encounterRotationVersion === 1 ? 1 : 0;
  readState().game.altarActivated = !!s.altarActivated;   // 第四层祭坛是否已激活（首脑格准入条件，旧档无字段 → false）
  readState().game.altarRewardPending = !!s.altarRewardPending;   // 祭坛奖励待领取（旧档无字段 → false）
  readState().game.bossPlan = (s.bossPlan == null ? null : +s.bossPlan);   // 本层首脑预案（旧档无字段 → null，进 boss 格时现 roll）
  readState().game.pendingEventLoot = null;
  readState().game.entrySupply = s.entrySupply || null;
  readState().game.nodeRewards = s.nodeRewards || {};
  readState().game.nodeChestRewards = s.nodeChestRewards || {};
  if (s.chestReward) readState().game.nodeChestRewards[`${s.chestReward.layerIdx},${s.chestReward.trackPos}`] = s.chestReward;
  readState().game.discoveredPairs = new Set(s.discovered || []);
  readState().game.elapsed = s.elapsed || 0;
  const elapsedCheckpoint = readServices().Base.data.stats.playTimeCheckpoint;
  if (identity.ok && elapsedCheckpoint?.runId === identity.value.runId) {
    readState().game.elapsed = Math.max(Number(readState().game.elapsed) || 0, Number(elapsedCheckpoint.elapsed) || 0);
  }
  readState().game.elapsedTimeBaseline = Math.max(0, Number(s.elapsedTimeBaseline ?? s.elapsed) || 0);
  readState().game.altarItemSacrificed = !!s.altarItemSacrificed;   // 祭坛道具献祭一次性锁（旧档无字段 → false）
  readState().game.shopStocks = (s.shopStocks && typeof s.shopStocks === 'object') ? s.shopStocks : {};
  // 旧存档只有本局 elapsed：首次读取时按 max 语义迁入累计游玩时间。
  if (identity.ok && s.elapsedTimeBaseline != null) {
    const elapsedRecovery = Promise.resolve(readServices().Base.syncPlayTime(readState().game.elapsed, readState().game.elapsedTimeBaseline, identity.value.runId));
    recordBaseSaveForLoad('elapsed_recovery', elapsedRecovery.then(value => value.changed === false || value.persisted === true));
  } else if ((Number(readServices().Base.data.stats.playSeconds) || 0) < (Number(readState().game.elapsed) || 0)) {
    const elapsedMigration = Promise.resolve(readServices().Base.migrateElapsed(readState().game.elapsed));
    recordBaseSaveForLoad('elapsed_migration', elapsedMigration.then(value => value.changed === false || value.persisted === true));
  }
  readState().game.elapsedSynced = Number(readState().game.elapsed) || 0;
  readState().game.extractionPending = null;
  readState().game.terminalPending = null;
  readState().game.pendingExtraction = s.pendingExtraction || null;
  if (readState().game.pendingExtraction) {
    readState().game.battleActive = false;
    readState().game.nestActive = false;
    readState().game.layerIdx = s.layerIdx;
    readState().game.trackPos = s.trackPos;
    readState().game.state = 'modal';
    const restored = readState().runtime.resumeExtraction(readState().game.pendingExtraction);
    if (!restored?.ok) return { ...(restored || { code: 'EXTRACTION_UNAVAILABLE' }), ok: false, preserveRun: true };
    return { ok: true, value: true };
  }
  if (plan.source === 'nest') {
    // 龙巢进行中存档：恢复牌盒/符文/进度并直接回到巢穴地图（2026-09-18 断点续战）
    readState().game.nestActive = true;
    readState().game.nestPos = s.nestPos || 0;
    readState().game.nestRunes = s.nestRunes || [];
    readState().game.nestEquipped = s.nestEquipped || [];
    readState().game.nestBossName = s.nestBossName || '？？？';
    readState().game.nestKills = s.nestKills || 0;
    readState().game.nestBossDown = s.nestBossDown === true;
    readState().game.nestTargetedBox = s.nestTargetedBox || 0;
    readState().game.nestAltarChoice = s.nestAltarChoice || null;
    readState().game.nestShopStocks = s.nestShopStocks || {};
    readState().game.pendingRunePick = s.pendingRunePick || null;
    readState().game.nestBoss = null;   // 模板不序列化；开战时按已保存所主名称恢复。
    readUI().log(`[[icon:download]] 已读取【档位 ${slot}】存档——研究所远征继续`, 'ok');
    readServices().Nest.renderNestMap();
    if (s.battle && readServices().Battle && typeof readServices().Battle.restore === 'function') {
      if (readServices().Battle.restore(readState().game, s.battle)) saveGame();
    }
    return {ok:true,value:true};
  }
  readState().game.nestActive = false;
  const safeLayer = s.layerIdx;
  const safeIdx = s.trackPos;
  readState().game.layerIdx = safeLayer;
  readState().game.trackPos = safeIdx;
  endAbandonedNodeContent(readState().game);
  const ended = nodeContentEndedAt(readState().game);
  if (ended) endNodeContent(readState().game, safeLayer, safeIdx);
  const pendingChest = ended ? null : s.chestReward;
  // Reattach a pending reward before allowing enterLayer to write a run snapshot.
  enterLayer(safeLayer, safeIdx, { preserveBossPlan:true, deferSave:!!pendingChest });
  readServices().Sound.music('board');
  readUI().log(`[[icon:download]] 已读取【档位 ${slot}】存档`, 'ok');
  if (!readState().game.myClass) return { ok:true, value:true, classChoiceEntry:readState().runtime.openClassChoice({ recoveringRun:true }) };   // 同步恢复结果附带选角就绪，不把 Promise 写入 game/存档
  else if (pendingChest) {
    const resume = pendingChest.context?.battleSettlement ? readState().runtime.resumeBattleRewards : readState().runtime.resumeChestsOnCell;
    if (!resume?.(pendingChest)) {
      readState().game.state = 'modal';
      readUI().log('[[icon:cross]] 待领奖励恢复未完成，原档已保留，请重新进入此档位', 'warn');
      return { ok:false, code:'REWARD_RESTORE_FAILED', preserveRun:true };
    }
    readUI().log('[[icon:archive]] 已恢复揭晓的搜刮点奖励，内容与已领取进度不变', 'ok');
  }
  else if (eventChoiceRewardAt(readState().game)) {
    if (!readState().runtime.resumeEventCardChoice()) {
      readState().game.state = 'modal';
      readUI().log('[[icon:cross]] 未领事件奖励恢复未完成，候选与付款记录已保留，请重新进入此档位', 'warn');
      return { ok:false, code:'EVENT_CHOICE_RESTORE_FAILED', preserveRun:true };
    }
  }
  else if (!ended && s.battle && readServices().Battle && typeof readServices().Battle.restore === 'function') {
    if (readServices().Battle.restore(readState().game, s.battle)) {
      saveGame();   // 恢复后立刻回写，防二次退出丢进度
    }
  }
  return {ok:true,value:true};
}

return { loadGame, preflightRunMap };
}
