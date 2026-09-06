function createGameState(map) {
  return {
    map,
    toggles: { index: true },
    rings: [],
    layerIdx: 0,
    trackPos: 0,
    pos: { x: 0.5, y: 0.5 },
    hop: 0,
    state: 'boot',
    turn: 1,
    coins: 0,
    hp: map.rules.playerMaxHp,
    maxHp: map.rules.playerMaxHp,
    atk: map.rules.playerAtk,
    mode: 'standard',
    characterId: null,
    runActive: false,
    seed: null,
    battleActive: false,
    bossCleanupPending: false,
    ownedCards: [],
    cardOrder: [],
    usedPocket: [],
    shopStock: [],
    dice: null,
    diceHistory: [],
    inventory: [],
    discoveredPairs: new Set(),
    altarFrom: null,
    hover: null,
    moveTarget: null,
    time: 0,
    elapsed: 0,
    elapsedSynced: 0,
  };
}

class GameStore {
  constructor(map) {
    if (!map || !map.rules) throw new TypeError('GameStore 需要有效地图配置');
    this.state = createGameState(map);
  }

  getSnapshot() {
    const state = this.state;
    return Object.freeze({
      ...state,
      toggles: Object.freeze({ ...state.toggles }),
      rings: Object.freeze(state.rings.slice()),
      pos: Object.freeze({ ...state.pos }),
      ownedCards: Object.freeze(state.ownedCards.slice()),
      cardOrder: Object.freeze(state.cardOrder.slice()),
      usedPocket: Object.freeze(state.usedPocket.slice()),
      shopStock: Object.freeze(state.shopStock.slice()),
      diceHistory: Object.freeze(state.diceHistory.slice()),
      inventory: Object.freeze(state.inventory.slice()),
      discoveredPairs: Object.freeze([...state.discoveredPairs]),
    });
  }
}

window.SDT = window.SDT || {};
window.SDT.GameStore = GameStore;

export { GameStore, createGameState };
