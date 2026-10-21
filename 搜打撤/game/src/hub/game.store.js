// @ts-check
import { sdtDefine } from '../core/sdt-facade.js';

/** @typedef {import('./game.store.types.js').GameMap} GameMap */
/** @typedef {import('./game.store.types.js').GameState} GameState */
/** @typedef {import('./game.store.types.js').GameSnapshot} GameSnapshot */

/** @param {GameMap} map @returns {GameState} */
function createGameState(map) {
  return {
    map,
    toggles: { index: false },
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
    const copies = new WeakMap();
    // 新增普通数据字段默认隔离；这些地图/交互对象明确保留运行态引用。
    const runtimeKeys = new Set(['map', 'altarFrom', 'hover', 'moveTarget']);
    /** @type {GameSnapshot} */
    const snapshot = Object.create(Object.getPrototypeOf(state));
    copies.set(state, snapshot);
    for (const key of Reflect.ownKeys(state)) {
      const property = Object.getOwnPropertyDescriptor(state, key);
      if (!property.enumerable) continue;
      if ('value' in property) {
        const value = property.value;
        property.value = key === 'rings' ? freezeRows(value)
          : key === 'discoveredPairs' ? Object.freeze([...value])
          : typeof key === 'string' && runtimeKeys.has(key) ? value
          : freezeDataValue(value, copies);
      }
      // 顶层和嵌套数据均保留访问器端口，不求值其动态结果。
      Object.defineProperty(snapshot, key, property);
    }
    return Object.freeze(snapshot);
  }
}

// rings 保留既有一层行复制：行内节点/渲染对象仍是运行态引用。
function freezeRows(rows) {
  return Object.freeze((rows || []).map((row) => {
    return (row && typeof row === 'object') ? Object.freeze({ ...row }) : row;
  }));
}

// 普通对象/数组逐层隔离（含未知扩展字段）；函数及带原型对象作为不透明
// 运行态引用，不遍历、不冻结。WeakMap 保留共享/循环图，只冻结新副本。
function freezeDataValue(value, copies) {
  if (!value || typeof value !== 'object') return value;
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return value;
  if (copies.has(value)) return copies.get(value);
  const copy = Array.isArray(value) ? new Array(value.length) : Object.create(prototype);
  copies.set(value, copy);
  for (const key of Reflect.ownKeys(value)) {
    const property = Object.getOwnPropertyDescriptor(value, key);
    if (!property.enumerable) continue;
    // 不执行 getter；访问器也是运行态端口，保持其原有描述符。
    Object.defineProperty(copy, key, 'value' in property
      ? { ...property, value: freezeDataValue(property.value, copies) }
      : property);
  }
  return Object.freeze(copy);
}

sdtDefine('GameStore', GameStore);

export { GameStore };
