// M03 家具目录。价格为首包暂定样板值，不代表最终经济平衡。
const specs = [
  { id: 'display-cabinet', name: '展示柜', priceCoins: 8, maxOwned: 2, allowedRotations: [0, 90, 180, 270], surface: 'floor', footprint: { width: 2, height: 1 }, assetIds: ['home-furniture-placeholder'], allowsOverlap: [], supports: [] },
  { id: 'work-table', name: '工作桌', priceCoins: 6, maxOwned: 2, allowedRotations: [0, 90, 180, 270], surface: 'floor', footprint: { width: 2, height: 1 }, assetIds: ['home-furniture-placeholder'], allowsOverlap: [], supports: ['table'] },
  { id: 'chair', name: '座椅', priceCoins: 3, maxOwned: 4, allowedRotations: [0, 90, 180, 270], surface: 'floor', footprint: { width: 1, height: 1 }, assetIds: ['home-furniture-placeholder'], allowsOverlap: [], supports: [] },
  { id: 'table-lamp', name: '灯', priceCoins: 4, maxOwned: 2, allowedRotations: [0, 180], surface: 'table', footprint: { width: 1, height: 1 }, assetIds: ['home-furniture-placeholder'], allowsOverlap: ['table'], supports: [] },
  { id: 'woven-rug', name: '地毯', priceCoins: 5, maxOwned: 2, allowedRotations: [0, 90, 180, 270], surface: 'floor', footprint: { width: 3, height: 2 }, assetIds: ['home-furniture-placeholder'], allowsOverlap: ['floor'], supports: [] },
  { id: 'wall-decoration', name: '墙饰', priceCoins: 4, maxOwned: 3, allowedRotations: [0, 180], surface: 'wall', footprint: { width: 2, height: 1 }, assetIds: ['home-furniture-placeholder'], allowsOverlap: [], supports: [] },
];

export const FURNITURE_CATALOG = Object.freeze(specs.map(spec => Object.freeze({
  ...spec,
  allowedRotations: Object.freeze([...spec.allowedRotations]),
  footprint: Object.freeze({ ...spec.footprint }),
  assetIds: Object.freeze([...spec.assetIds]),
  allowsOverlap: Object.freeze([...spec.allowsOverlap]),
  supports: Object.freeze([...spec.supports]),
})));

export const ROOM_SPEC = Object.freeze({
  id: 'base-room-01', width: 8, height: 6,
  zones: Object.freeze([
    Object.freeze({ id: 'room-floor', surface: 'floor', x: 0, y: 1, width: 8, height: 5 }),
    Object.freeze({ id: 'back-wall', surface: 'wall', x: 0, y: 0, width: 8, height: 1 }),
  ]),
  displaySlots: Object.freeze([
    Object.freeze({ id: 'display-left', accepts: Object.freeze(['collection', 'memorial']) }),
    Object.freeze({ id: 'display-right', accepts: Object.freeze(['collection', 'memorial']) }),
  ]),
});

export function furnitureById(id, catalog = FURNITURE_CATALOG) {
  return catalog.find(spec => spec.id === id) || null;
}
