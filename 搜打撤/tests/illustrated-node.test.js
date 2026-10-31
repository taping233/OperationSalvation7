import { describe, expect, it, vi } from 'vitest';
import { eventSceneHTML } from '../game/src/ui/node-scene-view.js';
import { wireEventChoiceSelection } from '../game/src/ui/event-choice-selection.js';
import { fireRestDecisionHTML } from '../game/src/ui/fire-rest-view.js';
import { rewardSceneHTML, patchRewardScene } from '../game/src/ui/reward-scene-view.js';
import { chestRewardFrameHTML, chestRewardOverviewHTML, patchChestRewardOverview } from '../game/src/ui/chest-reward-overview.js';

const host = html => { const node = document.createElement('div'); node.innerHTML = html; return node; };
describe('插画节点公共组件', () => {
  it('无简介的嵌套选项不重复标题，保留不可用状态', () => {
    const page = host(eventSceneHTML({tone:'event',title:'终端',layer:0,body:'<button class="evt-opt" data-act="continue" data-option-state="blocked" disabled><span class="evt-opt-index">01</span><span class="evt-opt-copy"><b>继续</b></span><span class="evt-opt-state">条件不足</span></button>'}));
    const option = page.querySelector('.evt-opt');
    expect(option.querySelectorAll('b')).toHaveLength(1);
    expect(option.querySelector('.choice-detail').textContent).toBe('条件不足');
    expect(option.disabled).toBe(true);
  });
  it('选中只改变阅读状态，确认在选中项内，原动作仅执行一次', () => {
    const page = host(eventSceneHTML({tone:'event',title:'矿井',layer:0,body:'<button class="evt-opt" data-act="search"><b>搜寻</b><span>获得 3 币</span></button><button class="evt-opt" data-act="breach"><b>冒险挖深</b><span>损失 3 生命</span></button>'}));
    const root = page.firstElementChild, action = vi.fn();
    document.body.append(page);
    wireEventChoiceSelection(root, 'shared-component-test');
    page.addEventListener('click', event => { const button = event.target.closest('.evt-opt'); if (button) action(button.dataset.act); });
    const [search, breach] = root.querySelectorAll('.evt-opt'), confirm = root.querySelector('.event-choice-confirm');
    search.click(); expect(action).not.toHaveBeenCalled();
    expect(confirm.closest('.illustrated-choice-unit').querySelector('.evt-opt')).toBe(search);
    search.click(); expect(confirm.closest('.node-foot')).not.toBeNull();
    breach.click(); expect(confirm.closest('.illustrated-choice-unit').querySelector('.evt-opt')).toBe(breach);
    expect(root.querySelectorAll('.event-choice-confirm')).toHaveLength(1);
    confirm.click(); confirm.click(); expect(action).toHaveBeenCalledExactlyOnceWith('breach');
    page.remove();
  });
  it('火堆沿用各自的使用与容量禁用条件，虚影语义不同', () => {
    const page = host(eventSceneHTML({tone:'fire',title:'营火',layer:0,body:fireRestDecisionHTML({heal:10,hp:40,maxHp:40,hpFull:true,chance:30,restorable:3,fits:false,capacity:'16/16'})}));
    expect(page.querySelector('.illustrated-node')).not.toBeNull();
    const heal = page.querySelector('[data-act="fireHeal"]'), restore = page.querySelector('[data-act="fireRestore"]');
    expect(heal.disabled).toBe(true); expect(restore.disabled).toBe(true);
    expect(heal.querySelector('[data-choice-art="heal"]')).not.toBeNull();
    expect(restore.querySelector('[data-choice-art="cards"]')).not.toBeNull();
    expect(restore.textContent).toContain('背包空间不足');
    expect(page.querySelector('.event-choice-confirm')).toBeNull();
  });
  it('卡牌奖励保留独立布局，回执更新保留原卡牌节点', () => {
    const render = received => rewardSceneHTML({title:'收获',cards:`<article class="reward-unit" data-reward-index="0" data-reward-card="a"><button class="reward-card">原卡面</button>${received ? '<span class="reward-unit-state">已收下</span>' : '<button data-act="take">收下</button>'}</article>`,actions:'<button data-act="continue">继续探索</button>'});
    const page = host(render(false)), face = page.querySelector('.reward-card');
    expect(page.querySelector('.illustrated-node')).toBeNull();
    expect(page.querySelector('.room-reward > .reward-head')).not.toBeNull();
    expect(patchRewardScene(page, render(true))).toBe(true);
    expect(page.querySelector('.reward-card')).toBe(face);
    expect(page.querySelector('.reward-unit-state').textContent).toBe('已收下');
    expect(page.querySelector('.reward-foot [data-act="continue"]')).not.toBeNull();
  });
  it('多箱回执更新保留按钮与动作索引，不显示旧具象箱图', () => {
    const render = completed => chestRewardFrameHTML({overview:chestRewardOverviewHTML({boxes:[{index:2,name:'补给箱',choice:true,completed,takenCount:completed ? 1 : 0,art:'<img src="obsolete.webp">'}]})});
    const page = host(render(false)), button = page.querySelector('[data-act="chestOpen"]');
    expect(button.querySelector('[data-choice-art="cards"]')).not.toBeNull();
    expect(button.querySelector('img')).toBeNull();
    expect(patchChestRewardOverview(page, render(true))).toBe(true);
    expect(page.querySelector('[data-act="chestOpen"]')).toBe(button);
    expect(button.dataset.i).toBe('2'); expect(button.disabled).toBe(true);
  });
});
