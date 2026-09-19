import { sdtDefine } from './sdt-facade.js';

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
    dice: null,
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
      rings: freezeRows(state.rings),
      pos: Object.freeze({ ...state.pos }),
      ownedCards: freezeRows(state.ownedCards),
      cardOrder: Object.freeze(state.cardOrder.slice()),
      usedPocket: freezeRows(state.usedPocket),
      shopStock: freezeRows(state.shopStock),
      inventory: freezeRows(state.inventory),
      discoveredPairs: Object.freeze([...state.discoveredPairs]),
    });
  }
}

// 快照只读保障（2026-09-11 架构批次 1）：集合元素逐行浅拷贝后冻结——
// 视图改快照内嵌对象会 TypeError（ESM strict）而不是静默污染 state。
// map / hover / moveTarget / dice 等节点或第三方对象保持引用：地图节点
// 的 visited 由渲染层就地标记，不属于快照只读范畴。
function freezeRows(rows) {
  return Object.freeze((rows || []).map((row) => {
    return (row && typeof row === 'object') ? Object.freeze({ ...row }) : row;
  }));
}

sdtDefine('GameStore', GameStore);

export { GameStore, createGameState };
