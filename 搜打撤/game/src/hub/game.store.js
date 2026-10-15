// @ts-check
import { sdtDefine } from '../core/sdt-facade.js';

/** @typedef {import('./game.store.types.js').GameMap} GameMap */
/** @typedef {import('./game.store.types.js').GameState} GameState */
/** @typedef {import('./game.store.types.js').GameSnapshot} GameSnapshot */

/** @param {GameMap} map @returns {GameState} */
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
    ownedCards: [],
    cardOrder: [],
    usedPocket: [],
    shopStock: [],
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
  /** @param {GameMap} map */
  constructor(map) {
    if (!map || !map.rules) throw new TypeError('GameStore 需要有效地图配置');
    this.state = createGameState(map);
  }

  /** @returns {GameSnapshot} */
  getSnapshot() {
    const state = this.state;
    return Object.freeze({
      ...state,
      toggles: Object.freeze({ ...state.toggles }),
      rings: freezeRows(state.rings),
      pos: Object.freeze({ ...state.pos }),
      ownedCards: freezeDataRows(state.ownedCards),
      cardOrder: Object.freeze(state.cardOrder.slice()),
      usedPocket: freezeDataRows(state.usedPocket),
      shopStock: freezeDataRows(state.shopStock),
      ...(state.shopStocks ? { shopStocks: freezeDataValue(state.shopStocks) } : {}),
      inventory: freezeRows(state.inventory),
      discoveredPairs: Object.freeze([...state.discoveredPairs]),
    });
  }
}

// 一层行快照；适用于 inventory 这类目前只有标量字段的集合。
function freezeRows(rows) {
  return Object.freeze((rows || []).map((row) => {
    return (row && typeof row === 'object') ? Object.freeze({ ...row }) : row;
  }));
}

// 卡牌、货架与消耗区包含嵌套纯数据，应逐层隔离；带原型对象保留引用。
function freezeDataRows(rows) {
  return Object.freeze((rows || []).map((row) => freezeDataValue(row)));
}

function freezeDataValue(value) {
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;

  const copy = Array.isArray(value)
    ? value.map(freezeDataValue)
    : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freezeDataValue(child)]));
  return Object.freeze(copy);
}

sdtDefine('GameStore', GameStore);

export { GameStore };
