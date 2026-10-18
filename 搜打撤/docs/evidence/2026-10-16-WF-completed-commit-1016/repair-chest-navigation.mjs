import fs from 'node:fs';
const update = (file, transform) => fs.writeFileSync(file, transform(fs.readFileSync(file,'utf8').replaceAll('\r\n','\n')));
for (const name of ['chest-click-flow','nightshift-u10-teardown-guards','sys03-loot-shop-txn','chest-multi-queue-regression']) {
  update(`tests/${name}.test.js`, text => {
    text = text.replace(/(?:ovBody|body)\.querySelector\('\[data-act="chestContinue"\]'\)\.click\(\)/g, 'continueChestRewards(acts)');
    text = text.replaceAll("ovBody.querySelector('[data-act=\"chestCoins\"]').click()", 'collectOverviewCoins(acts)');
    text = text.replaceAll('expect(game.gainCoins).toHaveBeenCalledTimes(1)', 'collectOverviewCoins(acts); expect(game.gainCoins).toHaveBeenCalledTimes(1)');
    text = text.replaceAll("querySelector('.reward-notice')", "querySelector('.reward-capacity-note')");
    if (!text.includes('from \'./helpers/chest-actions.js\'')) text = "import { continueChestRewards, collectOverviewCoins } from './helpers/chest-actions.js';\n" + text;
    else text = text.replace('import { continueChestRewards }', 'import { continueChestRewards, collectOverviewCoins }');
    return text;
  });
}
update('tests/chest-click-flow.test.js', t => t
  .replace("expect(ovBody.querySelector('.reward-unit.got .reward-card')).not.toBeNull();", "expect(ovBody.querySelector('.cqo-box-complete')).not.toBeNull();")
  .replace("querySelector('.reward-final').textContent).toContain('1 张已入背包')", "querySelector('.cqo-notice').textContent).toContain('已收下 1 张')"));
update('tests/extra-legend-reward-persistence.test.js', t => t
  .replace('import { continueChestRewards }', 'import { continueChestRewards, openChestPicker }')
  .replace(/(expect\(state\.module\.resumeBattleRewards\([^\n]+\)\)\.toBe\(true\);)/g, '$1 openChestPicker(state.actions);'));
update('tests/chests-reward-capacity-notice.test.js', t => {
  const expected = {
    '「致命穿刺」当前放不下，整理背包后可重试':'「致命穿刺」当前放不下',
    '已入背包 1 张，2 张放不下，整理背包后可重试':'已入背包 1 张，2 张放不下',
    '「黑市装备」已入本次远征背包':'「黑市装备」已入背包',
  };
  t = t.replace('const notice =', `const visibleNotice = ${JSON.stringify(expected)};\nconst notice =`);
  t = t.replace(/(expect\(notice\(\)\)\.toBe\('[^']*?)，整理背包后可重试('\))/g, '$1$2');
  t = t.replaceAll('expect(notice()).toBe(message)', 'expect(notice()).toBe(visibleNotice[message] || message)');
  t = t.replace("expect(notice()).toBe('已入背包 0 张，1 张放不下');\n    open({ message:", "expect(notice()).toBe('预计可收 2 张 · 1 张待整理，奖励保留。');\n    open({ message:");
  t = t.replace('[data-act="chestOpenBag"][data-i="1"]', '[data-act="chestOpenBag"]');
  t = t.replace("querySelector('.chest-warn')?.textContent).toContain('0 张、1 张放不下')", "querySelector('.reward-capacity-note')?.textContent).toContain('1 张放不下')");
  return t;
});
