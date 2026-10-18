import fs from 'node:fs';
function edit(file, replacements) {
  let text = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  for (const [before, after] of replacements) {
    if (!text.includes(before)) { if (text.includes(after)) continue; throw Error(`${file}: missing ${before}`); }
    text = text.replaceAll(before, after);
  }
  fs.writeFileSync(file, text);
}
for (const name of ['battle-settlement-retry', 'chest-callback-lifecycle-audit', 'chests-reward-capacity-notice',
  'chest-multi-queue-regression', 'chest-click-flow', 'extra-legend-reward-persistence', 'four-player-chest-reload',
  'node-retrigger', 'nightshift-u10-teardown-guards', 'sys03-loot-shop-txn']) {
  const file = `tests/${name}.test.js`, text = fs.readFileSync(file, 'utf8');
  const replacements = [['chestClaim', 'chestNext'], ['chest-offer-page', 'cqo-overview']].filter(([before]) => text.includes(before));
  edit(file, replacements);
}
edit('tests/map-node-state.test.js', [['[1]).toBe(\'可回地图整理，回到此节点继续领取。\')', '[1]).toBe(\'待领奖 · 可回地图整理，回到此节点继续领取。\')']]);
edit('tests/shop-transaction-lifecycle.test.js', [['UI.el = { overlay: { hidden: false } };', 'UI.el = { ovBody: host, overlay: { hidden: false } };']]);
edit('tests/altar-completion-road-cache.test.js', [
  ['expect(completed.section.to.x).toBeGreaterThan(previousSection.to.x);', 'expect(completed.section).toEqual(previousSection); // Both states retain the same full node icon and status label.'],
]);
edit('tests/altar-node-completion-view.test.js', [
  ["'献祭激活 · 选择回赠'", "'完成前可回地图整理后重进。'"],
  ["'已激活 · 回赠待领取'", "'可回地图整理，回到此节点继续领取。'"],
  ["'祭坛 · 已完成'", "'祭坛'"], ["'内容已消耗'", "'内容已结算'"],
  [".toContain('查看本地内容')", ".toContain(pending ? '继续领奖' : '查看本地内容')"],
  ["expect(preview(g).querySelector('[data-route-enter]').disabled).toBe(false);\n    g.nodes[1].def.type = 'altar'", "expect(preview(g).querySelector('[data-route-enter]').disabled).toBe(true);\n    g.nodes[1].def.type = 'altar'"],
]);
edit('tests/expedition-view.test.js', [
  [".toContain('已探索')", ".toContain('已完成')"],
  ["'遭遇战 · 已完成'", "'遭遇战'"], [".toContain('内容已消耗')", ".toContain('内容已结算')"],
  ["['遭遇战 · 路线1（节点 2）', '遭遇战 · 路线2（节点 3）']", "['遭遇战 · 路线1（节点 2） · 未完成', '遭遇战 · 路线2（节点 3） · 未完成']"],
  ["expect(strip.querySelector('[data-route-enter]').disabled).toBe(false);\n    expect(document.querySelector('.expedition-toolbar-location'))", "expect(strip.querySelector('[data-route-enter]').disabled).toBe(true);\n    expect(document.querySelector('.expedition-toolbar-location'))"],
]);
