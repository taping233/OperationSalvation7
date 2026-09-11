// 五层修复批次验收（2026-09-09）：layerChests 五组 / 门标签取层名 / 旧三环数据已迁出 mapData
globalThis.window = {};
await import('../../game/src/mapData.js');
const { createLayeredMap } = await import('../../game/src/layeredMap.js');
const MAP = window.SDT.MAP;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓', name, extra); }
  else { fail++; console.log('  ✗', name, extra); }
};

console.log('\n[1] layerChests 补齐五层');
ok('layerChests 有 5 组', MAP.layerChests.length === 5, `实际 ${MAP.layerChests.length}`);
const kinds = new Set(Object.keys(MAP.chestKinds));
MAP.layerChests.forEach((table, li) => {
  ok(`第 ${li + 1} 层掉落表非空且组合合法`, Array.isArray(table) && table.length > 0
    && table.every(combo => combo.every(p => kinds.has(p.k))), `组合 ${table.length} 组`);
});
ok('每层掉落强度不弱于前一层（按大宝箱数单调不减）',
  MAP.layerChests.every((t, li) => li === 0 || Math.max(...t.map(c => c.reduce((a, p) => a + (p.k === 'large' ? (Array.isArray(p.n) ? p.n[0] : p.n) : 0), 0)))
    >= Math.max(...MAP.layerChests[li - 1].map(c => c.reduce((a, p) => a + (p.k === 'large' ? (Array.isArray(p.n) ? p.n[0] : p.n) : 0), 0)))));

console.log('\n[2] 层间门标签取 layerData 名字（旧代码用 MAP.layers[toLayer].name 会取空）');
for (const seed of [0, 7, 123, 20260909, 'boss']) {
  const ld = createLayeredMap(seed);
  let bad = [];
  ld.forEach((layer, li) => (layer.doors || []).forEach(d => {
    const label = ld[d.toLayer]?.name || '下一层';
    if (!ld[d.toLayer]?.name || !/^第[1-5]层/.test(label)) bad.push(`${li}->${d.toLayer}:${label}`);
  }));
  ok(`seed ${seed} 全部门标签可解析`, bad.length === 0, bad.join(','));
}

console.log('\n[3] mapData 不再携带旧三环数据');
ok('无 MAP.layers', !('layers' in MAP));
ok('无 MAP.center', !('center' in MAP));
ok('保留 centerColor / altar', !!MAP.centerColor && Array.isArray(MAP.altar?.bosses) && MAP.altar.bosses.length === 3);

console.log('\n[4] encounters 自带 risk（去掉 MAP.layers 回退后仍能出风险标签）');
ok('5 组遭遇都有 risk', MAP.encounters.length === 5 && MAP.encounters.every(e => !!e.risk),
  MAP.encounters.map(e => e.risk).join('/'));

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
