import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { generateLayeredMap } from '../game/src/run/map-generator.js';
import { createLayeredMap, createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { createMapSnapshot, hydrateMapSnapshot, planMapRestore, validateMapSnapshot } from '../game/src/run/map-snapshot.js';
import { applyRouteOverlay } from '../game/src/ui/route-overlay.js';
import { buildNewRunDerived, installDerived } from '../game/src/run/game.session.map.js';
import { game } from '../game/src/run/game.session.kernel.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const golden = [
  [0, 'a27f2332bdc4b0a1b86f9efea127a824b0877fc1bd325deeb6c08807e123bb91'],
  [42, '433485b962adbccd6bb23454460a356edc71f46a42555c629982d0a9516bc028'],
  ['bit-eq-check', '47ad1d293127229500866b9b286b583e7227e9a8d7f14609dbb9a30434c27cdd'],
  ['audit-map-20261017-0', '735572d63273c35837d2e82b30ce5bb999d35279e6a93066e3d30ca4d51cf432'],
  ['audit-map-20261017-24', '5fa762bac6d4b8cd34765c22249cbe569b0c73be37462108ef610943d02dd601'],
  ['audit-map-20261017-625', '9d669315c65f8161f1f536a6ff493699198e3a9dba3a3b9996369e9784378b3c'],
];
const make = (seed, version, routed = false) => {
  let layerData = version === 3 ? createLayeredMap(seed) : createCurrentLayeredMap(seed), routeVersion, routePlan;
  if (routed) ({ layerData, routeVersion, routePlan } = applyRouteOverlay({ generatorVersion: version, layoutVersion: 9, layerData }).value);
  return createMapSnapshot({ mapSeed: seed, generatorVersion: version, layoutVersion: 9, layerData, routeVersion, routePlan });
};

describe('地图3/9冻结与现行6/9明确分派', () => {
  it.each(golden)('旧seed %s的完整输出保持冻结金样例', (seed, sha) => { expect(hash(generateLayeredMap(seed))).toBe(sha); });

  it('无快照旧3/9重建保留已知旧图缺陷，不悄悄修成新图', () => {
    for (const [seed] of golden) {
      const restored = planMapRestore({ seed, generatorVersion: 3, layoutVersion: 9, layerIdx: 1, trackPos: 2 });
      expect(restored.ok).toBe(true); expect(restored.value.source).toBe('legacy-3/9');
      expect(restored.value.layerData.map(layer => layer.logical)).toEqual(createLayeredMap(seed).map(layer => layer.logical));
    }
    expect(planMapRestore({ seed: 'new-without-snapshot', generatorVersion: 4, layoutVersion: 9, layerIdx: 0, trackPos: 0 })).toMatchObject({ ok: false, preserveRun: true, code: 'UNSUPPORTED_LEGACY_MAP' });
  });

  it.each([[3, false], [3, true], [5, false], [5, true], [6, false], [6, true]])('%s版有无路线%s的快照逐字往返且保当前位置/内容索引', (version, routed) => {
    const made = make('version-roundtrip', version, routed); expect(made.ok).toBe(true);
    expect(made.value.generatorVersion).toBe(version); expect(made.value.snapshotVersion).toBe(routed ? 2 : 1);
    const run = { mapSeed: made.value.mapSeed, generatorVersion: version, layoutVersion: 9, layerIdx: 2, trackPos: 6,
      mapSnapshot: made.value, visited: { '2,6': 1 }, nodeEventBindings: { '2,6': { eventId: 'kept' } } };
    const before = JSON.stringify(run), restored = planMapRestore(run);
    expect(restored.ok).toBe(true); expect(restored.value.source).toBe('snapshot');
    expect(JSON.stringify(run)).toBe(before);
    expect(createMapSnapshot(restored.value).value).toEqual(made.value);
    expect(hydrateMapSnapshot(made.value).value.layerData[2].logical[6]).toEqual(restored.value.layerData[2].logical[6]);
  });

  it('旧缺陷快照仍可恢复，伪造6/9身份必须经过新最终quality', () => {
    const old = make('audit-map-20261017-625', 3).value;
    expect(validateMapSnapshot(old).ok).toBe(true);
    const forged = structuredClone(old); forged.generatorVersion = 6;
    expect(validateMapSnapshot(forged)).toMatchObject({ ok: false, preserveRun: true, code: 'INVALID_MAP_SNAPSHOT' });
    for (const generatorVersion of [2, 8, 999]) expect(validateMapSnapshot({ ...old, generatorVersion })).toMatchObject({ ok: false, code: 'UNSUPPORTED_MAP_SNAPSHOT' });
  });

  it('新局安装7/9并保存独立快照；安装旧快照不会重新调用新局生成', () => {
    buildNewRunDerived('real-derived-new');
    expect(game).toMatchObject({ mapSeed: 'real-derived-new', generatorVersion: 7, layoutVersion: 9, routeVersion: null });
    const saved = createMapSnapshot(game); expect(saved.ok).toBe(true); expect(saved.value.snapshotVersion).toBe(1);
    const old = planMapRestore({ seed: 'audit-map-20261017-625', generatorVersion: 3, layoutVersion: 9, layerIdx: 0, trackPos: 2 }).value;
    installDerived(old.layerData, old.mapSeed, old.generatorVersion, old.layoutVersion, old.routeVersion, old.routePlan);
    expect(game.generatorVersion).toBe(3);
    expect(game.layerData[0].nodes.some(node => node.type === 'shop')).toBe(false);
    const restored = hydrateMapSnapshot(saved.value).value;
    installDerived(restored.layerData, restored.mapSeed, restored.generatorVersion, restored.layoutVersion, restored.routeVersion, restored.routePlan);
    expect(createMapSnapshot(game).value).toEqual(saved.value);
  });

  it('旧生成器源文件字节冻结，防维护时误把新规则并回旧身份', () => {
    const bytes = readFileSync('game/src/run/map-generator.js','utf8').replaceAll('\r\n','\n');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe('96b71377d001d5086332df4e9fcb50229dfeb6ba7821e88c7152ad56f619af0c');
    const adapter = readFileSync('game/src/run/layeredMap.js', 'utf8').replace(/\r\n/g, '\n');
    const oldFunction = adapter.slice(adapter.indexOf('export function createLayeredMap'), adapter.indexOf('// 新局入口独立')).trim();
    expect(createHash('sha256').update(oldFunction).digest('hex')).toBe('1377e373720c9673f0d4154b9f20e942c3c8a1b85ffbdf92cf86f4741c9a8e4f');
  });
});
