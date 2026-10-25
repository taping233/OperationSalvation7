import { describe, expect, it, vi } from 'vitest';
import { archiveV3HTML, bindArchiveV3 } from '../game/src/hub/hub.archive-v3.js';
vi.mock('../game/src/hub/hub.reward-feedback.js', () => ({bindRewardFeedback:() => {}}));
vi.mock('../game/src/hub/hub.collection-v4.js', () => ({bindCollectionCards:() => {},collectionCardsHTML:() => ''}));

function exercise(view, state) {
  const archive = {archiveV3HTML,bindArchiveV3}, actions = new Map();
  const entries = state === 'empty' ? [] : [
    { id:'one&"', name:'甲<&"', desc:'第一项目标 < &', need:1, reward:{wood:3,card:'card'}, back:'back' },
    { id:'all', name:'乙', desc:'第二项目标', need:3, reward:{keys:2} },
  ];
  const meta = {
    ACHIEVEMENTS:entries, COLL_MILESTONES:entries, isUnlocked:() => state !== 'locked', isClaimed:() => state === 'claimed',
    collMsReached:entry => state !== 'locked' && entry.need === 1, isCollClaimed:() => state === 'claimed',
    collMsNeed:entry => entry.need, collTotal:() => 3, collProgress:() => state === 'locked' ? 0 : 2,
    collRewardText:entry => `<span>${entry.id === 'all' ? '钥匙' : '木材'} ×3</span>`,
  };
  const base = { slot:1 }, cards = { all:() => [{id:'card',name:'奖励<&'}], CARD_BACKS:[{id:'back',name:'卡背<&'}] };
  const rawHTML = archive.archiveV3HTML({base,meta,cards,view});
  document.body.innerHTML = `<main id="hubMain">${rawHTML}</main>`;
  archive.bindArchiveV3({base,meta,cards,ui:{act:(name, action) => actions.set(name,action)}});
  const root = document.querySelector('.hub-archive-v3');
  const receipts = [];
  for (const button of root.querySelectorAll('[data-act="archiveV12Record"]')) {
    const detail = root.querySelector('.av12-record-detail');
    button.focus();
    actions.get('archiveV12Record')(button.dataset);
    receipts.push({ detail:detail.innerHTML, retained:detail === root.querySelector('.av12-record-detail'),
      focus:document.activeElement === button,
      selection:[...root.querySelectorAll('[data-act="archiveV12Record"]')].map(row => [row.className,row.getAttribute('aria-pressed')]) });
  }
  actions.get('archiveV12Record')({index:'invalid'});
  return { rawHTML, root, dom:root.outerHTML, receipts };
}

describe('archive record public behavior', () => {
  it.each(['empty','locked','pending','claimed'])('keeps only pending rewards: %s', state => {
    const {root,receipts} = exercise('rewards',state);
    const pending = state === 'pending';
    expect(root.querySelectorAll('.av12-record')).toHaveLength(pending ? 3 : 0);
    expect(root.querySelectorAll('.av12-record-detail .av3-inbox-reward')).toHaveLength(pending ? 1 : 0);
    if (!pending) expect(root.querySelector('.av3-inbox-empty').textContent).toContain('当前没有待领取奖励');
    else {
      expect(root.querySelector('.av12-record b').textContent).toBe('甲<&"');
      expect(receipts).toHaveLength(3);
      expect(receipts[0].detail).toContain('奖励&lt;&amp;');
      expect(receipts[0].detail).toContain('第一项目标 &lt; &amp;');
      expect(receipts[2].detail).toContain('data-act="claimColl"');
      expect(root.querySelector('.av12-record-detail [data-act="claimColl"]').dataset.id).toBe('one&"');
      expect(root.querySelector('.av12-record-detail h3').textContent).toBe('收集 1 张');
    }
    receipts.forEach((receipt,index) => {
      expect(receipt.retained).toBe(true); expect(receipt.focus).toBe(true);
      expect(receipt.selection.map(row => row[1])).toEqual(['0','1','2'].map(value => String(Number(value) === index)));
    });
  });
  it.each(['empty','locked','pending','claimed'])('shows milestone states and selects details without replacing focus: %s', state => {
    const {root,receipts} = exercise('classes',state);
    expect(receipts).toHaveLength(state === 'empty' ? 0 : 2);
    if (state === 'empty') expect(root.querySelector('.av12-record-detail').textContent).toBe('暂无收藏里程碑');
    else {
      expect(root.querySelectorAll('.av12-record b')[1].textContent).toBe('收集完成');
      expect(root.querySelector('.av12-record-detail h3').textContent).toBe('收集完成');
      expect(receipts[0].detail).toContain(state === 'claimed' ? '已领取' : state === 'locked' ? '未达成' : '可领取');
      expect(receipts[0].detail.includes('data-act="claimColl"')).toBe(state === 'pending');
      receipts.forEach((receipt,index) => {
        expect(receipt.retained).toBe(true); expect(receipt.focus).toBe(true);
        expect(receipt.selection.map(row => row[1])).toEqual([String(index === 0),String(index === 1)]);
      });
    }
  });
  it('reads collection metadata once per original occurrence and preserves two render passes', () => {
    const calls = [];
    const meta = { ACHIEVEMENTS:[],COLL_MILESTONES:[{id:'one'}],collMsReached:() => true,isCollClaimed:() => false,
      collMsNeed:() => {calls.push('need');return calls.filter(value => value === 'need').length;},
      collTotal:() => {calls.push('total');return 9;},collRewardText:() => {calls.push('reward');return '木材';} };
    const template = document.createElement('template');
    template.innerHTML = archiveV3HTML({base:{slot:2},meta,cards:{all:() => [],CARD_BACKS:[]},view:'rewards'});
    expect(calls).toEqual(['need','total','need','reward','need','total','need']);
    expect(template.content.querySelector('.av12-record b').textContent).toBe('收集 4 张');
    expect(template.content.querySelector('.av12-record-detail h3').textContent).toBe('收集 2 张');
  });
});
