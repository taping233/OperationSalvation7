import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import mapData from '../game/data/map.json';
import { hashSeed, nextRandom } from '../game/src/core/random-core.js';

const H = vi.hoisted(() => ({ game:{}, map:{}, random:() => .5, draws:0 }));
vi.mock('../game/src/core/random.js', () => ({ Random:{ random:() => { H.draws++; return H.random(); } } }));
vi.mock('../game/src/run/game.session.js', () => ({ game:H.game, MAP:H.map, bagCap:() => 16,
  newUid:() => 'fixture', pick:a => a[0], saveGame() {}, scaledEnemy:enemy => ({ ...enemy, scaled:true }), usedSlots:() => 0 }));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen() {}, cardHTML:() => '', Sfx:{} }));
vi.mock('../game/src/battle/battle-loader.js', () => ({ captureBattleContext:() => () => true, startBattle() {} }));
vi.mock('../game/src/run/game.run.data.js', () => ({ IMMEDIATE_SCENES:{}, NODE_BG:{}, PICKUP_BG:{}, PRELOAD_SCENES:[], SCENES:{}, WINTER_BATTLE_LAYERS:[] }));

let buildEncounter;
beforeAll(async () => {
  window.SDT = { UI:{}, Cards:{}, Sound:{} };
  Object.assign(H.map, mapData);
  ({ buildEncounter } = await import('../game/src/run/game.run.scenes.js'));
});
beforeEach(() => {
  H.draws = 0;
  Object.assign(H.game, { seed:'fresh-map', mapSeed:'fresh-map', layerIdx:2, trackPos:0, encounterRotationVersion:1,
    layerData:[{}, {}, { logical:[0, 1, 2, 3].map(i => ({ id:`third-${i}`, def:{ type:'battle' } })) }] });
});
const seeded = seed => {
  let state = hashSeed(seed);
  return () => { const step = nextRandom(state); state = step.state; return step.value; };
};
const encounter = (version, seed) => {
  H.game.encounterRotationVersion = version;
  H.random = seeded(seed); H.draws = 0;
  const enemies = buildEncounter(2);
  return { enemies, draws:H.draws };
};

describe('F38 新局第三层同档普通编组轮换', () => {
  it('各层300个种子固定一个本层精英，人数等于未替换的普通遭遇', () => {
    for (let layer = 0; layer < 4; layer++) {
      const pool = H.map.encounters[layer].guaranteedElite;
      const seen = new Set();
      for (let seed = 0; seed < 300; seed++) {
        H.random = seeded(`elite:${layer}:${seed}`);
        const mixed = buildEncounter(layer);
        const elites = mixed.filter(enemy => enemy.elite);
        expect(elites).toHaveLength(layer ? 1 : 0);
        if (layer) { expect(pool).toContain(elites[0].id); seen.add(elites[0].id); }
        expect(mixed.rewardKind).toBe('normal');
        H.map.encounters[layer].guaranteedElite = [];
        try {
          H.random = seeded(`elite:${layer}:${seed}`);
          expect(mixed).toHaveLength(buildEncounter(layer).length);
        } finally { H.map.encounters[layer].guaranteedElite = pool; }
      }
      if (layer) expect(seen.size).toBe(3);
    }
  });
  it('240个种子保持原人数、精英、奖励和随机流步数，只从同层既有普通池替代', () => {
    const normalIds = new Set(H.map.encounters[2].entries.map(entry => entry.id));
    const combinations = new Set();
    let rotated = 0;
    for (let seed = 0; seed < 240; seed++) {
      H.game.mapSeed = seed;
      H.game.trackPos = seed % 4;
      const old = encounter(0, seed), fresh = encounter(1, seed);
      expect(fresh.draws).toBe(old.draws);
      expect(fresh.enemies).toHaveLength(old.enemies.length);
      expect(fresh.enemies.encounterKind).toBe(old.enemies.encounterKind);
      expect(fresh.enemies.rewardKind).toBe(old.enemies.rewardKind);
      expect(fresh.enemies.risk).toBe(old.enemies.risk);
      expect(fresh.enemies.filter(enemy => enemy.elite)).toHaveLength(1);
      expect(H.map.encounters[2].guaranteedElite).toContain(fresh.enemies[0].id);
      {
        fresh.enemies.filter(enemy => !enemy.elite).forEach(enemy => {
          expect(normalIds.has(enemy.id)).toBe(true);
          expect(enemy).toEqual({ ...H.map.monsters[enemy.id], scaled:true });
          const entry = H.map.encounters[2].entries.find(item => item.id === enemy.id);
          expect(fresh.enemies.length).toBeGreaterThanOrEqual(entry.size[0]);
          expect(fresh.enemies.length).toBeLessThanOrEqual(entry.size[1]);
        });
        if (fresh.enemies.encounterId.startsWith('rotation:')) rotated++;
        combinations.add(fresh.enemies.map(enemy => enemy.id).join('+'));
      }
      expect(encounter(1, seed).enemies).toEqual(fresh.enemies);
    }
    expect(rotated).toBeGreaterThan(0);
    expect(combinations.size).toBeGreaterThanOrEqual(6);
  });
  it('连续节点保留普通怪轮换；人数1仅生成一个精英', () => {
    const combinations = [];
    for (let index = 0; index < 3; index++) {
      H.game.trackPos = index; H.random = () => .6;
      combinations.push(buildEncounter(2).map(enemy => enemy.id).join('+'));
    }
    expect(new Set(combinations).size).toBe(3);
    const values = [.1, 0, .2];
    H.random = () => values.shift() ?? .2;
    const single = buildEncounter(2);
    expect(single).toHaveLength(1);
    expect(single[0].elite).toBe(true);
    expect(H.map.encounters[2].guaranteedElite).toContain(single[0].id);
    expect(single.encounterId).toBe('entry:wolf_rider');
  });
  it('其他层即使带新局标记也沿用原编组', () => {
    for (const layer of [0, 1, 3]) {
      H.game.layerIdx = layer;
      H.game.layerData[layer] = { logical:[{ def:{ type:'battle' } }] };
      H.game.encounterRotationVersion = 0; H.random = seeded(`layer-${layer}`);
      const old = buildEncounter(layer);
      H.game.encounterRotationVersion = 1; H.random = seeded(`layer-${layer}`);
      expect(buildEncounter(layer)).toEqual(old);
    }
  });
});
