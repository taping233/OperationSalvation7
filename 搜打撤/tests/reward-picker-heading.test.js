import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { rewardPickerTitle } from '../game/src/ui/reward-picker-heading.js';
import { chestRewardOverviewHTML } from '../game/src/ui/chest-reward-overview.js';
it.each([
  [{isPick:true,count:3},'选择 1 张'],
  [{isPick:true,randomSingle:true,count:1},'选择 1 张'],
  [{randomSingle:true,count:1},'随机收获'],
  [{randomSingle:true,count:2},'领取奖励'],
  [{choice:true,count:4},'附赠奖励'],
  [{count:1},'领取奖励'],
  [{count:3},'领取奖励'],
  [{finished:true,isPick:true},'奖励已处理'],
])('标题遵循当前模式 %j',(input,expected)=>expect(rewardPickerTitle(input)).toBe(expected));
it('成功回执按实际入包张数计数，不按候选或去重种类计数',()=>{
  document.body.innerHTML=chestRewardOverviewHTML({claimedCards:[{name:'冰刺'},{name:'冰刺'}],boxes:[{index:0,lostCount:3,cardCount:5}]});
  expect(document.querySelector('.cqo-receipt-count').textContent).toBe('2 张');
  expect(document.querySelectorAll('.cqo-receipt li')).toHaveLength(1);
  expect(document.querySelector('.cqo-receipt li').textContent).toBe('冰刺 ×2');
  expect(document.querySelector('.cqo-receipt-icon').textContent).toBe('[[icon:bag]]');
  document.body.innerHTML=chestRewardOverviewHTML({boxes:[{index:0,lostCount:3,completed:true}]});
  expect(document.querySelector('.cqo-receipt')).toBeNull();
});
it('fixture 无游戏 bootstrap/存档/音频，使用真实标题与回执 view',()=>{
  const source=readFileSync('game/dev/reward-hierarchy-review.js','utf8');
  expect(source).toContain('rewardPickerTitle');expect(source).toContain('chestRewardOverviewHTML');
  expect(source).not.toMatch(/localStorage|persistSave|Sound\.|main\.js|run\/chests/);
});
