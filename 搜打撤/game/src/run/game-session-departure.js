/** Candidate preparation, transactional persistence and publication are separate
 * phases. Only the original rollback checkpoints copy state; all live access uses ports. */
export function createSessionDeparture({ readState, readServices, readUI, readStorage,
  Random, MAP, MODES, modeCfg, buildNewRunDerived, newUid, createRunSavePayload,
  createDeparturePersistence, planBaseDeparture, RunStorage, TX_KEY, resetRunCounters,
  applyModeRules, setLobby, enterLayer, nextTerminalGeneration, esc }) {
// 每局开始：固定携带 5 张初始牌「初始攻击」（同名堆叠）+ 1 张「火球」
// brought=1：开局带入的卡（放弃对局时无条件丢失，v0.21 规则）
// 2026-09-09 需求 #4 宠物加成：变形机器人 +2 张杀；火焰精灵把 5 张杀化为 5 张火球
function grantStarterSha(log = /** @param {Parameters<ReturnType<typeof readUI>['log']>} args */ (...args) => readUI().log(...args)) {
  const pet = readServices().Base.carriedPet ? readServices().Base.carriedPet() : null;
  /** @type {{extraSha?: number, shaToFireball?: boolean}} */
  const effect = (pet && pet.effect) || {};
  const shaN = MAP.rules.starterSha + (effect.extraSha || 0);
  const sha = readServices().Cards.all().find(c => c.id === readServices().Cards.SHA.id) || readServices().Cards.SHA;
  const fireball = readServices().Cards.all().find(c => c.id === 'tt3-fireball');
  if (effect.shaToFireball && fireball) {
    for (let i = 0; i < shaN; i++) {
      readState().game.ownedCards.push({ uid: newUid(), card: { ...fireball }, brought: 1 });
    }
    log(`[[icon:fire]] <b>火焰精灵</b>：起始背包中的 ${shaN} 张【初始攻击】化为 <b>${shaN} 张【火球】</b>`, 'ok');
  } else {
    for (let i = 0; i < shaN; i++) {
      readState().game.ownedCards.push({ uid: newUid(), card: { ...sha }, brought: 1 });
    }
    if (effect.extraSha) log(`[[icon:tools]] <b>变形机器人</b>：起始背包额外增加 <b>2 张【初始攻击】</b>（共 ${shaN} 张）`, 'ok');
  }
  // 2026-09-16 留言：初始不发火球（火球改为衍生稀有度）
}

let pendingDeparture = null;
let departureInFlight = null;
let pendingPublication = null;
let publicationGeneration = 0;

function restoreDepartureState(state, random) {
  for (const key of Object.keys(readState().game)) if (!Object.hasOwn(state, key)) delete readState().game[key];
  Object.assign(readState().game, state);
  Random.restore(random);
}

async function publishDeparture(publication) {
  const { candidate, options } = publication;
  // Keep completed stages in the live run: retries must not restore stale card,
  // Map/Set or RNG snapshots over work already completed by character confirmation.
  /** @type {Array<() => unknown>} */
  const stages = [
    () => { publication.restored = true; restoreDepartureState(candidate.state, candidate.random); },
    () => nextTerminalGeneration(),
    () => resetRunCounters(),
    () => applyModeRules(),
    () => setLobby(false),
    () => presentDeparture(candidate),
    () => enterLayer(readState().game.layerIdx, readState().game.trackPos, { preserveBossPlan: true, deferSave: true }),
    () => options.skipClassChoice || readState().game.myClass ? undefined : readState().runtime.openClassChoice(),
  ];
  while (publication.stage < stages.length) {
    if (!publication.handle.isCurrent()) return false;
    const value = await stages[publication.stage]();
    if (value === false) return false;
    publication.value = value;
    publication.stage++;
  }
  return publication.handle.isCurrent();
}

function presentDeparture(candidate) {
  // 出征存档已提交；单项声音或日志失败仍须继续发布地图与人物确认。
  try { readServices().Sound.music('board'); }
  catch (error) { console.warn('[departure] 出征音乐未播放', error); }
  try { readUI().clearLog(); }
  catch (error) { console.warn('[departure] 出征日志未清空', error); }
  candidate.logs.forEach(args => {
    try { readUI().log(.../** @type {Parameters<ReturnType<typeof readUI>['log']>} */ (args)); }
    catch (error) { console.warn('[departure] 出征日志未显示', error); }
  });
}

function retainPublication(candidate, options, contextCurrent, originCurrent, generation) {
  const publication = { candidate, options, stage: 0, restored: false, done: false, invalid: false, flight: null, value: undefined, handle: null };
  const isCurrent = () => {
    const game = readState().game;
    const valid = !publication.invalid && publicationGeneration === generation && contextCurrent() &&
      (!options.isPublicationCurrent ? !options.isCurrent || options.isCurrent() : options.isPublicationCurrent()) &&
      (publication.restored
        ? game.seed === candidate.state.seed && game.discoveredPairs === candidate.state.discoveredPairs &&
          game.runActive && !game.pendingExtraction && !game.extractionPending && !game.terminalPending &&
          !['title', 'done', 'terminalPending'].includes(game.state)
        : originCurrent());
    if (!valid) {
      publication.invalid = true;
      if (pendingPublication === publication) pendingPublication = null;
    }
    return !!valid;
  };
  const retry = () => {
    if (publication.flight) return publication.flight;
    if (!isCurrent() || publication.done) return Promise.resolve(publication.done && isCurrent());
    const flight = Promise.resolve().then(() => publishDeparture(publication)).then(ok => {
      if (ok) {
        publication.done = true;
        if (pendingPublication === publication) pendingPublication = null;
      }
      return ok;
    }).catch(error => {
      console.warn('[departure] 已保存的出征尚未完成发布', error);
      return false;
    }).finally(() => { if (publication.flight === flight) publication.flight = null; });
    publication.flight = flight;
    return flight;
  };
  publication.handle = { status: 'departure-pending', committed: true, retry, isCurrent };
  pendingPublication = publication;
  return publication;
}

// 已提交而发布未完成时返回 departure-pending；retry 只继续该候选的发布。
// isCurrent 属于原入口，isPublicationCurrent 延续转交后的同一次远征。
function newRun(mode, picks, options = {}) {
  if (pendingPublication?.handle.isCurrent()) return Promise.resolve(pendingPublication.handle);
  const slot = readState().activeSlot;
  const base = readServices().Base, baseGeneration = base._selectionGeneration;
  const originGame = readState().game;
  const seed = readState().game.seed;
  const originState = readState().game.state, originPairs = readState().game.discoveredPairs;
  const contextCurrent = () => readState().game === originGame && readState().activeSlot === slot && readServices().Base === base && base._selectionGeneration === baseGeneration && (slot == null || base.slot === slot);
  const originCurrent = () => readState().game.seed === seed && readState().game.state === originState && readState().game.discoveredPairs === originPairs;
  const current = () => contextCurrent() && originCurrent() && (!options.isCurrent || options.isCurrent());
  const request = JSON.stringify([slot, mode, picks, !!options.skipClassChoice, options.characterId || null]);
  if (departureInFlight) return departureInFlight.request === request ? departureInFlight.promise : Promise.resolve(false);
  const generation = ++publicationGeneration;
  const persistence = slot ? createDeparturePersistence({
    storage: readStorage(), baseApi: readServices().Base, runStore: RunStorage, txKey: TX_KEY,
  }) : null;
  const work = () => prepareNewRun(mode, picks, persistence, slot, options);
  const promise = (persistence ? persistence.withLock(slot, current, work) : Promise.resolve(current() ? work() : false))
    .then(result => {
      if (result?.candidate) {
        const publication = retainPublication(result.candidate, options, contextCurrent, originCurrent, generation);
        if (!current()) return publication.handle;
        return publication.handle.retry().then(ok => ok ? publication.value : publication.handle);
      }
      if (!current()) return false;
      if (result?.ok === false) readUI().log(`[[icon:cross]] ${result.message}`, 'warn');
      return false;
    }).finally(() => { if (departureInFlight?.promise === promise) departureInFlight = null; });
  departureInFlight = { request, promise };
  return promise;
}

function reportPendingRecovery(options, candidate) {
  if (typeof options.onRecoveryRequired !== 'function' || !candidate?.recovery) return;
  try { options.onRecoveryRequired({ ...candidate.recovery, picks: { ...candidate.recovery.picks } }); }
  catch (error) { console.warn('[departure] 出征恢复提示未完成', error); }
}

function prepareNewRun(mode, picks, persistence, slot, options) {
  if (persistence) {
    const pending = persistence.pending(slot);
    if (!pending.ok) { readUI().log(`[[icon:cross]] ${pending.message}`, 'warn'); return false; }
    if (pending.value) {
      const result = persistence.recover(slot);
      if (!result.ok) {
        if (pendingDeparture?.slot === slot && pendingDeparture.runId === pending.value.runId) reportPendingRecovery(options, pendingDeparture);
        readUI().log('[[icon:cross]] 出征存档尚未完成，请重试或重新进入档位继续恢复', 'warn'); return false;
      }
      if (pendingDeparture?.slot === slot && pendingDeparture.runId === pending.value.runId) {
        const candidate = pendingDeparture;
        pendingDeparture = null;
        return { candidate };
      }
      readUI().log('[[icon:download]] 已恢复上次出征，请返回选档继续原对局', 'warn');
      return false;
    }
  }
  const prepared = persistence ? persistence.prepare(slot, picks) : null;
  // Developer/test explorations have no slot: never debit an unrelated loaded Base slot.
  const departure = persistence ? prepared.ok && prepared.value.departure : planBaseDeparture(readServices().Base.data, picks).departure;
  if (!departure?.ok) {
    readUI().log(`[[icon:cross]] ${prepared?.message || '基地出征整备未保存，请重试；当前没有开始新局'}`, 'warn');
    return false;
  }
  const before = { ...readState().game }, random = Random.snapshot(), logs = [];
  let candidate;
  try {
    initializeNewRun(mode, departure, (...args) => logs.push(args), options.characterId);
    const payload = createRunSavePayload({ freshRun: true });
    if (!payload) throw new Error('路线快照校验失败');
    candidate = { slot, state: { ...readState().game }, random: Random.snapshot(), logs,
      recovery: { mode, picks: { ...(picks || {}) }, characterId: options.characterId || null } };
    restoreDepartureState(before, random);
    if (persistence) {
      const committed = persistence.commit(slot, prepared.value, payload);
      if (!committed.result.ok) {
        const pending = persistence.pending(slot);
        const journalWritten = committed.result.code === 'SAVE_FAILED_PENDING_RECOVERY'
          || pending.ok && pending.value?.runId === committed.runId;
        pendingDeparture = journalWritten
          ? { ...candidate, runId: committed.runId } : null;
        reportPendingRecovery(options, pendingDeparture);
        readUI().log('[[icon:cross]] 出征存档未完成，请重试；已开始的提交会从原出征继续恢复', 'warn');
        return false;
      }
    }
  } catch (error) {
    restoreDepartureState(before, random);
    readUI().log(`[[icon:cross]] 出征未完成：${esc(error.message || '无法准备存档')}，请重试`, 'warn');
    return false;
  }
  pendingDeparture = null;
  return { candidate };
}

// Only constructs candidate state. Persistence and all page/audio effects belong to newRun.
function initializeNewRun(mode, departure, log, characterId = null) {
  readState().game.seed = Random.reseed();
  readState().game.mapSeed = readState().game.seed;
  readState().game.encounterRotationVersion = 1;   // 仅新局启用同层编组轮换；旧档缺省继续原遭遇。
  buildNewRunDerived(readState().game.mapSeed);
  readState().game.mode = MODES[mode] ? mode : 'standard';
  readState().game.runActive = true;    // v0.21：从这一刻起才写对局存档
  readState().game.pendingExtraction = null;
  readState().game.extractionPending = null;
  readState().game.terminalPending = null;
  readState().game.battleActive = false;   // 新开局必须与旧战斗会话切割（防旧战斗快照混入新档——2026-09-18 实测）
  readState().game.inventory = [];
  readState().game.ownedCards = [];
  readState().game.shopStocks = {};   // 商店货架按局重置（D-1 防关门重刷）
  readState().game.cardOrder = [];
  readState().game.usedPocket = [];
  readState().game.eventLog = [];
  readState().game.fragments = 0;   // 员工通行证A碎片（Q6 隐藏计数器）
  readState().game.altarItemSacrificed = false;   // 祭坛道具献祭一次性锁（每局重置）
  readState().game.pendingEventLoot = null;
  readState().game.entrySupply = null;
  readState().game.nodeRewards = {};
  readState().game.nodeChestRewards = {};
  readState().game.myClass = null;
  readState().game.characterId = null;
  // Separate intent avoids the legacy characterId migration marking this
  // character as granted before the existing confirmation stage runs.
  readState().game.departureCharacterId = characterId || null;
  readState().game.classCard = null;
  readState().game.coins = modeCfg().startCoins || 0;
  readState().game.maxHp = MAP.rules.playerMaxHp;
  readState().game.hp = readState().game.maxHp;
  readState().game.atk = MAP.rules.playerAtk;
  readState().game.discoveredPairs = new Set();
  readState().game.turn = 1;
  readState().game.elapsed = 0;
  readState().game.elapsedTimeBaseline = 0;
  readState().game.elapsedSynced = 0;
  readState().game.altarFrom = null;
  readState().game.altarActivated = false;   // 第四层祭坛未激活——首脑格封印中
  readState().game.altarRewardPending = false;   // 祭坛奖励待领取（激活后置位，领取消耗）
  readState().game.bossPlan = null;   // 本层首脑预案（进层时重 roll，见 enterLayer）
  readState().game.surrenderedRun = false;   // 本局是否因主动撤离判负（区分战败/撤离失败文案）
  readState().game.bossKilled = false;   // 第四层击败首脑后才能终局撤离
  readState().game.visited = {};   // 已结算过的一次性格（防回头路重刷战斗/搜刮点/事件）
  readState().game.seen = {};      // 战争迷雾：走过的节点 + 当前相邻节点可见，其余隐藏
  readState().game.explored = {};   // 2026-10-03 老板（SYS-01）：首次踏入过的格（撤离经验只算首探量，防安全往返刷经验）
  log(`欢迎来到<b>代号7</b>：本次玩法【<b>${modeCfg().name}</b>】——${modeCfg().ckpt}`, 'sys');
  log('点击相邻节点前进，落脚触发事件；层间闸门通往更深区域，终层可完成撤离', 'sys');
  grantStarterSha(log);
  log(`[[icon:cards]] 随身携带初始牌【<b>初始攻击</b>】×${MAP.rules.starterSha}（不可入库 / 安全格）`, 'sys');   // 2026-09-16 留言「初始不给火球」：欢迎语去掉火球（已不再发放）
  let loaded = 0;
  for (const stack of departure.cards) {
    for (let i = 0; i < stack.count; i++) {
      readState().game.ownedCards.push({ uid: newUid(), card: { ...stack.card }, brought: 1 });
    }
    loaded += stack.count;
  }
  for (const name of departure.rejectedClassNames) {
    log(`[[icon:cross]] 职业卡【${esc(name)}】无法带入对局（带出后留在仓库）`, 'warn');
  }
  if (loaded) log(`[[icon:archive]] 从基地仓库携带 <b>${loaded}</b> 张卡牌出征`, 'loot');
  // 需求 #1：下一次出发后，基地消耗区清空（未复原的卡牌随之消散）
  if (departure.pocketCleared) {
    log(`[[icon:pocket]] 出发整理：基地消耗区已清空（${departure.dispersedPocketCount} 张未复原的卡牌消散了）`, 'dim');
  }
  // 需求 #4：携带宠物「旺财」的生命上限 +5
  const pet = readServices().Base.carriedPet ? readServices().Base.carriedPet() : null;
  if (pet && pet.effect && pet.effect.maxHp) {
    readState().game.maxHp += pet.effect.maxHp;
    readState().game.hp += pet.effect.maxHp;
    log(`[[icon:paw]] 携带宠物<b>「${esc(pet.name)}」</b>：生命上限 +${pet.effect.maxHp}（${readState().game.maxHp}）`, 'ok');
  } else if (pet) {
    log(`[[icon:paw]] 携带宠物<b>「${esc(pet.name)}」</b>：${esc(pet.desc.replace(/^携带效果：/, ''))}`, 'ok');
  }
  // Item 18（2026-09-16 老板定版）：储备币不进局——留在基地用于孵蛋与基地建设，
  // 局内币与基地储备币彻底分开（原「出发时全部随身带走」口径作废）
  // 四层图从第一层的多个入口之一开始；这是起点选择，不消耗行动力。
  const l1 = readState().game.layerData[0];
  const startIdx = l1.entrances[Math.floor(Random.random('gameplay') * l1.entrances.length)] || 0;
  enterLayer(0, startIdx, { deferSave: true, deferPresentation: true });
}


return { newRun };
}
