import fs from 'node:fs';
function edit(file,edits){let text=fs.readFileSync(file,'utf8');for(const [before,after]of edits){if(!text.includes(before))throw new Error(`${file}: ${before}`);text=text.split(before).join(after);}fs.writeFileSync(file,text);}
edit('tests/chests-reward-capacity-notice.test.js',[
  ["expect(notice()).toBe('已入背包 2 张，1 张放不下');","expect(notice()).toBe('暂时无法领取');"],
  ["expect(notice()).toBe('已入背包 2 张');","expect(notice()).toBe('');"],
  ["expect(notice()).toBe('已入背包 1 张，2 张放不下');","expect(notice()).toBe('暂时无法领取');"],
  ["expect(notice()).toBe('预计可收 1 张 · 1 张待整理，奖励保留。');","expect(notice()).toBe('');"],
  ["expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('1 张待整理');","expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')).toBeNull();"],
  ["organizeWood(); expect(notice()).toBe('已入背包 1 张');","organizeWood(); expect(notice()).toBe('');"],
  ["expect(notice()).toContain('放不下');","expect(notice()).toBe('暂时无法领取');"],
  ["expect(notice()).toBe('预计可收 2 张 · 1 张待整理，奖励保留。');","expect(notice()).toBe('');"],
  ["expect(notice()).toContain('1 张放不下');","expect(notice()).toBe('暂时无法领取');"],
  ["expect(notice()).toBe('已入背包 0 张，1 张放不下');","expect(notice()).toBe('暂时无法领取');"],
  ["expect(notice()).toBe('「致命穿刺」当前放不下');","expect(notice()).toBe('暂时无法领取');"],
  ["expect(notice()).toBe(kind === 'small' ? '预计可收 1 张 · 2 张待整理，奖励保留。' : '');","expect(notice()).toBe('');"],
  ["expect(message).toContain('「致命穿刺」当前放不下');","expect(message).toBe('暂时无法领取');"],
  ["expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('1 张放不下');","expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toBe('暂时无法领取');"],
  ["expect(notice()).toBe('已入背包 1 张，1 张放不下');","expect(notice()).toBe('暂时无法领取');"],
  ['visibleNotice[message] || message','visibleNotice[message] ?? message'],
]);
edit('tests/reward-picker-heading.test.js',[
  ["'随机收获 · 1 张'","'随机收获'"],["'领取奖励 · 全部可领'","'领取奖励'"],["'领取附赠奖励'","'附赠奖励'"],["'领取 1 张'","'领取奖励'"],
]);
edit('tests/reward-presentation-contract.test.js',[
  ["'chestMakeRoom', '腾位置领取'","'chestMakeRoom', '整理背包'"],
  ['expect(document.body.textContent).toBe(rewardCardStatus(state, true));',"expect(document.body.textContent).toBe(state === 'received' ? '已选择' : '已放弃');"],
]);
edit('tests/chest-click-flow.test.js',[
  ["expect(ovBody.querySelector('.cqo-notice').textContent).toContain('已收下 1 张');","expect(ovBody.querySelector('.cqo-receipt-count').textContent).toBe('1 张');\n    expect(ovBody.querySelector('.cqo-notice').textContent).toBe('');"],
]);
edit('tests/chest-callback-lifecycle-audit.test.js',[
  ["expect(root.querySelector('.reward-count').textContent).toBe('共 1 张');","expect(root.querySelector('.reward-count')).toBeNull();"],
]);
edit('tests/chest-extra-rewards-choice.test.js',[
  ["expect(h.body.querySelector('.reward-count').textContent).toContain(`共 ${h.saved().current.cards.length} 张 · 含额外 1 张`);","expect(h.body.querySelector('.reward-count')).toBeNull();"],
  ["['已永久放弃', '已永久放弃']","['已放弃', '已放弃']"],
]);
edit('tests/chest-batch-receipt.test.js',[
  ["expect.soft(ovBody.querySelector('.cqo-notice').textContent).toBe(claimed ? `已收下 ${claimed} 张${index === 0 ? ' · 还有奖励' : ''}` : '');","expect.soft(ovBody.querySelector('.cqo-notice').textContent).toBe('');"],
]);
edit('tests/reward-capacity-preview.test.js',[
  ["expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('预计可收 1 张 · 1 张待整理');","expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')).toBeNull();"],
  ["expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')?.textContent).toContain('当前候选都放不下');","expect(H.UI.el.ovBody.querySelector('.reward-capacity-note')).toBeNull();\n    expect(H.UI.el.ovBody.querySelector('[data-act=chestMakeRoom]').textContent).toBe('整理背包');"],
]);
edit('tests/event-reward-layout.test.js',[
  ["'border-radius':'0'","'border-radius':'6px'"],["toBe('#c9b477')","toBe('#91c2c6')"],
]);
