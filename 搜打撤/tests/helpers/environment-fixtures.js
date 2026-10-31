export function battleRules(energy, handMax, bossDeckSize, starterSha, startDraw, turnDraw) {
  return { battleEnergy: energy, battleHandMax: handMax, bossDeckSize: bossDeckSize, starterSha: starterSha, battleStartDraw: startDraw, battleTurnDraw: turnDraw, diceSides: 6 };
}

export function battleViewMocks(rich, reducedMotion, energy, handMax, starterSha, startDraw) {
  return { Icons: { img: () => '', rich: rich, TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => reducedMotion },
  MAP: { rules: { battleEnergy: energy, battleHandMax: handMax, bossDeckSize: 15, starterSha: starterSha, battleStartDraw: startDraw, battleTurnDraw: 1 }, items: {} } };
}

export function overlayElements() {
  return { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
}

// Preserve the real module facade across fixture setup; imported registries
// (Chests, Nest, UI) must keep the same object the runtime modules captured.
export async function connectSdtFixture(ports) {
  const { default: facade } = await import('../../game/src/core/sdt-facade.js');
  Object.assign(facade, ports);
  window.SDT = facade;
  return facade;
}

export function playerFields(hp, maxHp, atk, spellPower, myClass, characterId) {
  return { hp: hp, maxHp: maxHp, atk: atk, spellPower: spellPower, coins: 0,
    myClass: myClass, characterId: characterId, state: 'idle', battleActive: false };
}

export function resetEventGame(holder, readEvents, overrides = {}) {
  holder.saves = []; holder.uid = 0; holder.slot = null; holder.narrative = async () => null;
  // A new case is a fresh run. Preserve the captured game object, not prior
  // event history, pending state or ad-hoc fields left by another case.
  for (const key of Object.keys(holder.game)) delete holder.game[key];
  Object.assign(holder.game, { seed: 7, state: 'idle', layerIdx: 0, trackPos: 1, hp: 1, maxHp: 35, visited: {}, ownedCards: [], usedPocket: [], myClass: '武', runActive: true, coins: 18, fragments: 0,
    altarActivated:false, altarRewardPending:false, altarItemSacrificed:false, nodeRewards:{}, eventLog:[], entrySupply:null,
    discoveredPairs: new Set(), layerData: [{ logical: [{ def: { type: 'entrance' } }, { def: { type: 'event' } }] }],
    canReceiveCard: () => true, heal: n => holder.game.hp = Math.min(holder.game.maxHp, holder.game.hp + n),
    grantCard: (card, opts) => (readEvents()).grantEventCard(card, opts), bagCap:() => 9, usedSlots:() => holder.game.ownedCards.length,
  }, overrides);
}

export function damageRuleFields(area, target) {
  return { version: 1, battle: { target: { side: 'enemy', area: area } }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: target }] } };
}

export function eventCardMocks(holder) {
  return { game: holder.game, Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: { bagCap:() => 9 },
    MAP:{ chestKinds:{ small:{ name:'小型物资箱' } } },
    Cards: { DROP_WEIGHTS:{ 古朴:1 }, all: () => holder.cards, classPool: () => holder.cards.filter(c => c.type === '能力卡'), sellPrice:() => 1, isRandomObtainable: () => true, cardHTML: c => `<span>${c.name}</span>` } };
}

export function canvasTraps(makeContext) {
  return { get: (_t, k) => {
      if (k === 'canvas') return null;
      if (k === 'measureText') return () => ({ width: 10 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient' ||
          k === 'createPattern' || k === 'getImageData') return () => ({ addColorStop: () => {}, data: [] });
      return () => makeContext();
    },
    set: () => true,
    apply: () => makeContext() };
}

export function bindEventRoot(readUI) {
(readUI()).el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) (readUI())._acts[button.dataset.act]?.(button.dataset); });
  (readUI())._acts = {}; (readUI())._overlayInerted = []; (readUI())._lastMode = null; (readUI())._hideTimer = null; (readUI())._roomActive = true;
}

export function eventMapMocks(holder) {
  return { game: holder.game, MAP: { rules: { fireHeal:10, fireClassCardChance:1, bossDeckSize:15, starterSha:5, battleStartDraw:5, battleTurnDraw:1, battleHandMax:8 }, monsters:{}, altar:{ bosses:[] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0 };
}

export function frameMocks() {
  return { attach: () => Promise.resolve(false), hide() {}, cacheStats: () => ({}), play() {},
  setPaused() {}, presentDeath() {}, isLiveBattleFigure: () => false, actionImpactRemaining: () => null };
}

export function eventMapActions(holder) {
  return { curLayer: () => holder.game.layerData[holder.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => holder.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {} };
}

export function altarMocks(holder, readVi) {
  return { Sound: { sfx: (readVi()).fn(), scene: (readVi()).fn() },
    Icons: { rich: x => x },
    Meta: { addXpToProgress: x => ({ after: x }), track: (readVi()).fn() },
    Cards: {
      all: () => [
        { id: 'lg1', name: '传说甲', rarity: '传说', type: '法术' },
        { id: 'eq1', name: '装备甲', rarity: '史诗', type: '装备' },
      ],
      classPool: () => [{ id: 'ab1', name: '能力甲', rarity: '职业', type: '能力卡' }],
      isRandomObtainable: () => true,
      randomClassCard: () => null,
      cardHTML: c => c.name,
      sellPrice: () => 1,
    },
    MAP: { chestKinds:{ small:{ name:'小型物资箱' } } },
    Base: { isSha: () => false, bagCap:() => holder.bagCapN },
    Motion: undefined };
}

export function inventoryFields(hp, maxHp, spellPower, myClass) {
  return { inventory: [], usedPocket: [], hp: hp, maxHp: maxHp, atk: 4, spellPower: spellPower, coins: 0, myClass: myClass,
    state: 'idle', battleActive: false };
}

export function eventUiMocks(readUI) {
  return { _acts:{}, _baseActs:{}, _roomActive:true, el:{},
    act:(name, fn) => (readUI())._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {} };
}

export function pixiFrameMocks(holder) {
  return { utils: { isWebGLSupported: () => true },
  RENDERER_TYPE: { WEBGL: 1, CANVAS: 2 },
  Application: holder.Application,
  Sprite: holder.Sprite,
  Texture: { EMPTY: holder.emptyTexture },
  Assets: {
    load: async url => {
      holder.loaded.push(url);
      holder.inFlight += 1;
      holder.maxInFlight = Math.max(holder.maxInFlight, holder.inFlight);
      try {
        if (holder.loadGate) await holder.loadGate;
        if (holder.blocked) await holder.blocked(url);
        if (holder.loadDelayMs) await new Promise(resolve => setTimeout(resolve, holder.loadDelayMs));
        if ([...holder.missing].some(path => url.includes(path))) throw new Error('missing specific frame');
        if ([...holder.idlePaths].some(path => url.includes(path))) {
          if (holder.idleEnabled) return holder.idleTexture;
          throw new Error('missing test idle frame');
        }
        if (url.includes('/sprite-v1/') && !url.includes('/neutral.webp')) return { id: url };
        if (url.includes('/atk-wind.webp')) return holder.extraTexture;
        throw new Error('missing test frame');
      } finally { holder.inFlight -= 1; }
    },
    unload: async url => {
      holder.unloaded.push(url);
      if (holder.unloadGate) await holder.unloadGate;
    },
  } };
}

export function chestBaseMocks(readVi) {
  return { Base: { data:{eggPity:0,eggBattles:0}, save:(readVi()).fn(), petEggDropChance:() => 0,
      recordPetEggChestResult:(readVi()).fn(), bagCap:() => 10, isSha:() => false },
    Sound: { sfx:(readVi()).fn() }, Icons: { rich:html => html } };
}

export function audioGainFields() {
  return { connect: () => {}, disconnect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} } };
}

export function extractionMocks(readVi) {
  return { FIRE_RESTORABLE: [], consumeCurrentCell: (readVi()).fn(), finishInstant: (readVi()).fn(), grantEventCard: (readVi()).fn(),
  nodeOpt: (act, label) => `<button data-act="${act}">${label}</button>`,
  nodeShell: ({ body = '', foot = '' }) => window.SDT.UI.showOverlay('', `${body}${foot}`),
  openPocketRestore: (readVi()).fn(), openShop: (readVi()).fn(), preloadAllNodeShellBgs: (readVi()).fn(), showRunTransition: (readVi()).fn() };
}

export function chestMocks(cards, readVi, readDrop) {
  return { Icons: { rich: html => html }, Sound: { sfx: (readVi()).fn() },
    MAP: { chestKinds: { small: { name: '小箱', cards: 2, coins: [2, 2] } } },
    Cards: { RARITIES: ['古朴', '稀有', '史诗', '传说'], all: () => cards, randomDropCard: (readDrop()), pickOfRarity: () => cards[0],
      classPool: () => [], rarityOf: card => card.rarity, sellPrice: () => 1, cardHTML: card => `<span>${card.name}</span>` },
    Base: { slot: 1, data: {}, save() {}, petEggDropChance: () => 0, recordPetEggChestResult() {}, bagCap: () => 16, isSha: () => false } };
}

export function eventCapacityPorts(holder, pending) {
  return { readStacks:() => holder.game.ownedCards.filter(o => !o.safe).map(o => ({card:o.card,uids:[o.uid],count:1})),
    canReceive:() => holder.game.canReceiveCard(pending.card), capacity:() => '背包 9/9 格',
    moveToSafe:stack => { holder.game.ownedCards.find(o => o.uid === stack.uids[0]).safe=true; return true; },
    discardOne:() => false };
}

export function altarStateFields() {
  return { coins: 0, fragments: 0, visited: {},
    ownedCards: [], usedPocket: [], inventory: [],
    // 祭坛/火堆运行期标记：原地 assign 复用同一 game 对象时必须显式复位，
    // 否则上一用例的激活/上锁状态会泄漏到下一用例
    altarActivated: undefined, altarItemSacrificed: undefined, altarRewardPending: undefined,
    bossKilled: false, _fireRestKey: undefined, nodeRewards: {} };
}

export function eventSaveActions(holder) {
  return { newUid: () => `u${++holder.uid}`, pick: a => a[0],
  saveGame: () => { holder.saves.push(JSON.parse(JSON.stringify(holder.game))); return true; },
  scaledEnemy: a => a };
}

export function mountBattleRoot() {
Element.prototype.animate = () => ({ finished: Promise.resolve(), cancel() {}, onfinish: null });
  localStorage.setItem('sdt-intent-legend', '1');
  document.body.innerHTML = '<div id="overlay"><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
}

export function runPendingFields() {
  return { usedPocket: [], cardOrder: [], pendingExtraction: null, extractionPending: null,
    terminalPending: null, battleActive: false, nestActive: false, hp: 20, maxHp: 30,
    elapsed: 0, elapsedSynced: 0 };
}

export function quietUiMocks() {
  return { clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {}, showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; } };
}

export function acquireRuleFields(count, poolKind, destination, action) {
  return { version: 1, battle: { target: { side: 'self', area: false } },
        triggers: { onPlay: [{ op: 'acquire', n: count, pool: { kind: poolKind }, dest: destination, act: action }] } };
}
