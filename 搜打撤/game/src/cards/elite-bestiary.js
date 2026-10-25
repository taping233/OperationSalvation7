import mapData from '../../data/map.json' with { type: 'json' };

// 精英图鉴和战斗共用现行怪物来源；生物卡只供照相馆浏览。
const encounters = /** @type {{guaranteedElite?: string[]}[]} */ (mapData.encounters);
const monsters = /** @type {Record<string, {name:string, atk:number, hp:number, desc?:string}>} */ (mapData.monsters);
export const eliteBestiaryCards = encounters.flatMap((encounter, layer) =>
  (encounter.guaranteedElite || []).map(id => {
    const enemy = monsters[id];
    return {
      id: `foe-${id}`, name: enemy.name, cost: 0, rarity: '衍生', type: '生物',
      unrandom: true, sellable: false, value: 0, art: id,
      desc: `攻击 ${enemy.atk} / 生命 ${enemy.hp}。第${layer + 1}层精英。${enemy.desc || ''}`,
    };
  }));
