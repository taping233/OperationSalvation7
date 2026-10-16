import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VISIBLE_PLAYBACK_VERSION, planVisibleStep, runVisibleSteps } from '../scripts/visible-playback.mjs';

const button = (name, suffix = '') => `- button "${name}"${suffix}`;
const offer = ['- heading "获得宝箱" [level=3]', '- text: 领取宝箱后揭晓卡牌', '- text: 待领取宝箱 · 1 个', button('领取宝箱')].join('\n');
const reward = (buttons = [button('收下')]) => ['- heading "搜刮完成" [level=3]', '- complementary "奖励操作":', ...buttons].join('\n');
const done = reward([button('继续探索'), '- status: 1 张已入背包']);
const fixture = name => readFileSync(`docs/evidence/2026-10-16-WF-visible-playback/fixtures/${name}.txt`, 'utf8');
const preview = ['- text: 可以前往', button('关闭地点预览'), button('进入该地点')].join('\n');
const travel = ['- text: 前往中 · 1/1 段', button('关闭地点预览'), button('进入该地点', ' [disabled]')].join('\n');
const animation = name => `- heading "搜寻物资 · ${name}"\n- paragraph: 正在解锁封存物资。`;
afterEach(() => vi.restoreAllMocks());

function fakeTab(snapshots, { clickError = null, waitError = null, clickAdvance = true, count = 1, enabled = true, visible = true, onWait } = {}) {
  let index = 0;
  const calls = [];
  const tab = { playwright: {
    async domSnapshot() { calls.push(['snapshot', index]); return snapshots[index]; },
    getByRole(role, options) {
      calls.push(['locator', role, options]);
      return {
        async count() { return typeof count === 'function' ? count(index, options.name) : count; },
        async isEnabled() { return enabled; },
        async isVisible() { return visible; },
        async click(args) { calls.push(['click', options.name, args]); if (clickError) throw clickError; if (clickAdvance) index = Math.min(index + 1, snapshots.length - 1); },
        async waitFor(args) { calls.push(['waitFor', options.name, args]); onWait?.(); if (waitError) throw waitError; index = Math.min(index + 1, snapshots.length - 1); },
        and(other) { calls.push(['and', options.name, other.selector]); return this; },
      };
    },
    locator(selector) { calls.push(['selector', selector]); return { selector }; },
  } };
  return { tab, calls };
}

describe('visible playback pure planner', () => {
  it.each([[offer, '领取宝箱'], [reward(), '收下'], [done, '继续探索'], [preview, '进入该地点'],
    [reward([button('返回地图'), '- paragraph: 这里没有奖励']), '返回地图']])('allows a named transition only in a matching known state', (snapshot, label) => {
    expect(planVisibleStep(snapshot)).toMatchObject({ kind: 'action', action: { label, exact: true } });
  });
  it.each(['领取宝箱', '继续探索', '返回地图', '进入该地点', '收下'])('rejects a label alone: %s', name => {
    expect(planVisibleStep(button(name)).kind).toBe('stop');
  });
  it('supports the exact known rest-complete button description without widening labels', () => {
    const snapshot = `- heading "休整完毕"\n${button('继续探索 本处休整已经完成')}`;
    expect(planVisibleStep(snapshot)).toMatchObject({ kind: 'action', action: { label: '继续探索', name: '继续探索 本处休整已经完成' } });
    expect(planVisibleStep(snapshot.replace('本处休整已经完成', '消耗金币恢复生命')).kind).toBe('stop');
  });
  it('recognizes a parent-provided real built-in-tab location preview', () => {
    const snapshot = readFileSync('docs/evidence/2026-10-16-WF-visible-playback/node-preview-dom.txt', 'utf8');
    expect(planVisibleStep(snapshot)).toMatchObject({ kind: 'action', state: 'selected-reachable-location', action: { name: '进入该地点' } });
  });
  it.each([null, {}, '', '- snapshot truncated: ...'])('rejects invalid or truncated DOM: %s', snapshot => {
    expect(planVisibleStep(snapshot).kind).toBe('stop');
  });
  it('rejects multiple rewards, including disabled alternatives', () => {
    expect(planVisibleStep(reward([button('收下'), button('收下', ' [disabled]')])).reason).toBe('multiple-rewards');
  });
  it('rejects multi-reward capacity branches that rename other claims to bag actions', () => {
    expect(planVisibleStep(`${reward([button('收下'), button('整理背包'), button('整理背包')])}\n- text: 预计可收 0 张、1 张放不下`).reason).toBe('multiple-or-blocked-rewards');
    expect(planVisibleStep(`${reward()}\n- paragraph: 奖励可分别领取`).reason).toBe('multiple-or-blocked-rewards');
  });
  it('allows only the exact future chest-choice disclosure, not an active or conflicting choice', () => {
    const future = offer.replace('领取宝箱后揭晓卡牌', '领取宝箱后，从 3 张卡牌中选择 1 张');
    expect(planVisibleStep(future).kind).toBe('action');
    expect(planVisibleStep(`${future}\n- heading "选择收获"`).reason).toBe('card-choice');
    expect(planVisibleStep(`${offer}\n${button('收下')}`).reason).toBe('conflicting-states');
    expect(planVisibleStep(`${offer}\n${preview}`).reason).toBe('conflicting-states');
  });
  it('does not leave a completed-looking page with outstanding capacity-blocked rewards', () => {
    const snapshot = reward([button('继续探索'), '- status: 1 张已入背包', button('整理背包'), button('整理背包'), '- paragraph: 1 张放不下']);
    expect(planVisibleStep(snapshot).kind).toBe('stop');
  });
  it('rejects supply-complete text that contradicts an outstanding reward', () => {
    expect(planVisibleStep(`- heading "随行补给"\n- text: 已领取所有奖励\n- status: 1 张放不下\n${button('继续探索')}`).reason).toBe('conflicting-states');
  });
  it('recognizes a fixed single reward only with both observed heading and single-box dialog', () => {
    const snapshot = fixture('fixed-single-reward-dom');
    expect(VISIBLE_PLAYBACK_VERSION).toBe('20261016-r2.3');
    expect(planVisibleStep(snapshot)).toMatchObject({ kind: 'action', action: { label: '收下' } });
    expect(planVisibleStep(snapshot.replace('领取奖励', '未知事件')).kind).toBe('stop');
    expect(planVisibleStep(snapshot.replace('小型物资箱', '未知奖励箱')).kind).toBe('stop');
    expect(planVisibleStep(snapshot.replace('第 1 / 1', '第 1 / 2')).kind).toBe('stop');
  });
  it('does not combine a heading from elsewhere with the known fixed reward dialog', () => {
    const snapshot = fixture('fixed-single-reward-dom');
    expect(planVisibleStep(snapshot.replace('    - heading "领取奖励" [level=3]\n', '') + '\n- heading "领取奖励"').kind).toBe('stop');
    expect(planVisibleStep(snapshot + '\n- dialog "未知事件":\n  - button "继续探索"').kind).toBe('stop');
  });
  it('does not borrow claim buttons or completion evidence from outside the fixed dialog', () => {
    const claim = fixture('fixed-single-reward-dom').replace('      - button "收下"\n', '') + '\n- button "收下"';
    expect(planVisibleStep(claim).kind).toBe('stop');
    const done = fixture('fixed-single-reward-complete-dom');
    expect(planVisibleStep(done.replace('    - status: 1 张已入背包\n', '') + '\n- status: 1 张已入背包').kind).toBe('stop');
    expect(planVisibleStep(done.replace('      - button "继续探索"\n', '') + '\n- button "继续探索"').kind).toBe('stop');
    expect(planVisibleStep(done.replace('    - status: 1 张已入背包\n', '') + '\n- text: 随行补给 已领取所有奖励').kind).toBe('stop');
  });
  it('cannot recover fixed-reward authorization through a second dialog or unrelated legacy text', () => {
    const snapshot = fixture('fixed-single-reward-dom');
    expect(planVisibleStep(`${snapshot}\n- dialog "未知事件":\n  - heading "战斗胜利"`).reason).toBe('multiple-dialogs');
    expect(planVisibleStep(snapshot.replace('小型物资箱', '未知奖励箱') + '\n- heading "战斗胜利"').reason).toBe('unknown-reward-dialog');
    expect(planVisibleStep(snapshot.replace('领取奖励', '未知事件') + '\n- text: 战斗胜利').kind).toBe('stop');
  });
  it('recognizes the fixed reward completion as continue, without selecting rewards', () => {
    expect(planVisibleStep(fixture('fixed-single-reward-complete-dom'))).toMatchObject({ kind: 'action', state: 'completed', action: { label: '继续探索' } });
  });
  it('keeps multi-reward, card-choice, capacity and destructive guards on fixed rewards', () => {
    const snapshot = fixture('fixed-single-reward-dom');
    for (const suffix of [button('收下'), '- paragraph: 任选 1 张，其余卡牌永久放弃', '- paragraph: 奖励可分别领取', button('删除存档'), button('购买')]) {
      expect(planVisibleStep(`${snapshot}\n${suffix}`).kind).toBe('stop');
    }
  });
  it('rejects a card choice even when only one candidate fits', () => {
    expect(planVisibleStep(`${reward()}\n- text: 任选 1 张，其余卡牌永久放弃，无法找回`).reason).toBe('card-choice');
    expect(planVisibleStep(`${reward()}\n- heading "选择收获"`).reason).toBe('card-choice');
  });
  it.each(['删除存档', '覆盖存档', '丢弃', '购买', '确认放弃', '结束回合', '出牌'])('stops before protected action %s', name => {
    expect(planVisibleStep(`${offer}\n${button(name)}`).reason).toBe('protected-action');
  });
  it('rejects disabled and duplicate transition buttons', () => {
    expect(planVisibleStep(offer.replace(button('领取宝箱'), button('领取宝箱', ' [disabled]'))).reason).toBe('disabled-button');
    expect(planVisibleStep(`${offer}\n${button('领取宝箱')}`).reason).toBe('ambiguous-button');
  });
  it('stops unknown event decisions and visible failures', () => {
    expect(planVisibleStep(`${done}\n- region "事件选项"`).reason).toBe('event-or-irreversible-choice');
    expect(planVisibleStep(`${offer}\n- text: 错误：保存失败`).reason).toBe('visible-error');
  });
  it.each(['当前进度未保存，请查看存档错误提示。', '保存失败，请重试', '领取失败', '发生错误'])('stops visible save/acquisition errors: %s', warning => {
    expect(planVisibleStep(`${reward()}\n- status: ${warning}`).reason).toBe('visible-error');
  });
  it('stops destructive dialogs even when their confirmation button says only yes', () => {
    expect(planVisibleStep(`${done}\n- dialog "确认删除存档？"\n${button('是')}`).reason).toBe('protected-action');
  });
  it('allows narrowed options, never new actions', () => {
    expect(planVisibleStep(offer, { allowedActions: ['收下'] }).reason).toBe('action-not-allowed');
    expect(planVisibleStep(offer, { allowedActions: ['购买'] }).reason).toBe('invalid-options');
  });
  it('identifies known opening animation without a clickable action', () => {
    const snapshot = '- heading "搜寻物资 · 小宝箱"\n- paragraph: 正在解锁封存物资。';
    expect(planVisibleStep(snapshot)).toMatchObject({ kind: 'wait', waitFor: { role: 'heading', name: '搜寻物资 · 小宝箱', state: 'hidden' } });
  });
  it('waits for travel only with explicit progress, one disabled entry and one preview close', () => {
    expect(planVisibleStep(travel)).toMatchObject({ kind: 'wait', reason: 'known-travel-transition', state: 'traveling',
      waitFor: { role: 'button', name: '进入该地点', state: 'hidden', disabled: true } });
    for (const snapshot of [travel.replace('前往中 · 1/1 段', '准备迎敌'), travel.replace('[disabled]', ''),
      travel.replace(button('关闭地点预览'), ''), travel.replace('- text:', '- paragraph: 帮助说明：'), `${travel}\n${button('进入该地点', ' [disabled]')}`,
      `${travel}\n${button('关闭地点预览')}`, `${travel}\n- dialog "未知界面"`]) {
      expect(planVisibleStep(snapshot).kind).toBe('stop');
    }
  });
  it.each([['- heading "选择收获"', 'card-choice'], [button('结束回合'), 'protected-action'],
    ['- text: 保存失败', 'visible-error'], ['- region "事件选项"', 'event-or-irreversible-choice']])('does not wait through a protected travel page: %s', (suffix, reason) => {
    expect(planVisibleStep(`${travel}\n${suffix}`)).toMatchObject({ kind: 'stop', reason });
  });
  it('ref changes do not evade the loop guard', () => {
    const first = planVisibleStep(`${offer}\n- generic [ref=e1]`);
    expect(planVisibleStep(`${offer}\n- generic [ref=e2]`, { seenFingerprints: [first.summary.fingerprint] }).reason).toBe('loop-detected');
  });
});

describe('visible playback bounded runner (fake tab, no browser)', () => {
  it('takes a fresh DOM after every real click and preserves evidence', async () => {
    const { tab, calls } = fakeTab([offer, reward(), done, '- heading "探索地图"']);
    const result = await runVisibleSteps(tab, { maxSteps: 3 });
    expect(result.reason).toBe('unknown-state');
    expect(result.steps.map(step => step.action.label)).toEqual(['领取宝箱', '收下', '继续探索']);
    expect(result.steps.every(step => step.before && step.after && step.result === 'clicked')).toBe(true);
    expect(calls.filter(call => call[0] === 'snapshot')).toHaveLength(4);
    expect(calls.filter(call => call[0] === 'locator').every(call => call[2].exact === true)).toBe(true);
  });
  it('waits for observed animation state, without fixed sleeps', async () => {
    const animation = '- heading "搜寻物资 · 小宝箱"\n- paragraph: 正在解锁封存物资。';
    const { tab, calls } = fakeTab([offer, animation, reward(), '- heading "未知决策"']);
    const result = await runVisibleSteps(tab);
    expect(result.waits).toHaveLength(1);
    expect(result.waits[0].result).toBe('settled');
    expect(calls.find(call => call[0] === 'waitFor')).toEqual(['waitFor', '搜寻物资 · 小宝箱', { state: 'hidden', timeoutMs: 5000 }]);
  });
  it('returns control at the first multi-reward page', async () => {
    const { tab, calls } = fakeTab([offer, reward([button('收下'), button('收下')]), done]);
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('multiple-rewards');
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
  });
  it('never clicks disabled or destructive pages', async () => {
    for (const snapshot of [offer.replace(button('领取宝箱'), button('领取宝箱', ' [disabled]')), `${offer}\n${button('删除存档')}`]) {
      const { tab, calls } = fakeTab([snapshot]);
      expect((await runVisibleSteps(tab)).steps).toHaveLength(0);
      expect(calls.some(call => call[0] === 'click')).toBe(false);
    }
  });
  it('stops A → B → A loops before a repeated action', async () => {
    const { tab, calls } = fakeTab([offer, reward(), offer]);
    expect((await runVisibleSteps(tab)).reason).toBe('loop-detected');
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(2);
  });
  it('waits for a still-present clicked button once, then stops unchanged DOM', async () => {
    const { tab, calls } = fakeTab([offer], { clickAdvance: false });
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('animation-not-settled');
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
    expect(calls.filter(call => call[0] === 'waitFor')).toHaveLength(1);
  });
  it('honors maxSteps and rejects expansion beyond eight', async () => {
    const { tab, calls } = fakeTab([offer, reward(), done]);
    expect((await runVisibleSteps(tab, { maxSteps: 1 })).reason).toBe('max-steps');
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
    expect((await runVisibleSteps(tab, { maxSteps: 9 })).reason).toBe('invalid-options');
  });
  it.each([[{ count: 2 }, 'live-ambiguous-button'], [{ enabled: false }, 'live-disabled-button'], [{ visible: false }, 'live-hidden-button']])('rechecks live actionability before input: %s', async (options, reason) => {
    const { tab, calls } = fakeTab([offer], options);
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe(reason);
    expect(result.steps[0].result).toBe('not-clicked');
    expect(calls.some(call => call[0] === 'click')).toBe(false);
  });
  it('reclassifies one fresh DOM after live count zero and returns without clicking again', async () => {
    const map = fixture('map-after-reward-dom');
    const { tab, calls } = fakeTab([done, map], { count: 0 });
    // The second snapshot observes completion of an independently running transition.
    const domSnapshot = tab.playwright.domSnapshot;
    let reads = 0;
    tab.playwright.domSnapshot = async () => {
      const value = await domSnapshot();
      return ++reads === 2 ? map : value;
    };
    const result = await runVisibleSteps(tab);
    expect(result).toMatchObject({ status: 'stopped', reason: 'live-button-disappeared', refreshed: true, final: { kind: 'stop', reason: 'unknown-state' } });
    expect(result.steps.map(step => step.result)).toEqual(['not-clicked']);
    expect(result.steps[0].liveCount).toBe(0);
    expect(calls.some(call => call[0] === 'click')).toBe(false);
    expect(reads).toBe(2);
  });
  it('does not retry a disappeared button even if the refreshed DOM offers an allowed action', async () => {
    const { tab, calls } = fakeTab([done, fixture('fixed-single-reward-dom')], { count: 0 });
    const domSnapshot = tab.playwright.domSnapshot;
    let reads = 0;
    tab.playwright.domSnapshot = async () => ++reads === 2 ? fixture('fixed-single-reward-dom') : domSnapshot();
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('live-button-disappeared');
    expect(result.final).toMatchObject({ kind: 'action', action: { label: '收下' } });
    expect(calls.some(call => call[0] === 'click')).toBe(false);
    expect(reads).toBe(2);
  });
  it('collects the proven fixed single reward and continues within the strict click budget', async () => {
    const { tab, calls } = fakeTab([fixture('fixed-single-reward-dom'), fixture('fixed-single-reward-complete-dom'), fixture('map-after-reward-dom')]);
    const result = await runVisibleSteps(tab, { maxSteps: 2 });
    expect(result.steps.map(step => step.action.label)).toEqual(['收下', '继续探索']);
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(2);
    expect(result.final.reason).toBe('unknown-state');
  });
  it('stops after a successful travel click whose DOM is only an unknown heading', async () => {
    const { tab, calls } = fakeTab([preview, '- heading "2"']);
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('unknown-state');
    expect(result.steps[0].result).toBe('clicked');
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
  });
  it('settles explicit travel in the same run using the disabled locator intersection', async () => {
    const { tab, calls } = fakeTab([preview, travel, '- heading "未知决策"']);
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('unknown-state');
    expect(result.steps.map(step => step.action.label)).toEqual(['进入该地点']);
    expect(result.waits).toHaveLength(1);
    expect(calls).toContainEqual(['selector', ':disabled']);
    expect(calls).toContainEqual(['and', '进入该地点', ':disabled']);
    expect(calls).toContainEqual(['waitFor', '进入该地点', { state: 'hidden', timeoutMs: 5000 }]);
  });
  it('does not spend an extra click after travel consumes the last allowed action', async () => {
    const { tab, calls } = fakeTab([preview, travel, offer]);
    const result = await runVisibleSteps(tab, { maxSteps: 1 });
    expect(result.reason).toBe('max-steps');
    expect(result.waits).toHaveLength(1);
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
  });
  it.each([['- heading "选择收获"', 'card-choice'], [button('结束回合'), 'protected-action'],
    ['- heading "2"', 'unknown-state']])('stops without input after travel resolves to %s', async (arrival, reason) => {
    const { tab, calls } = fakeTab([travel, arrival]);
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe(reason);
    expect(result.waits).toHaveLength(1);
    expect(calls.some(call => call[0] === 'click')).toBe(false);
  });
  it('waits once on a closing clicked button even when unrelated UI changed the fingerprint', async () => {
    const leaving = fixture('reward-leaving-dom'), map = fixture('map-after-reward-dom');
    const { tab, calls } = fakeTab([done, leaving, map], { count: index => index === 1 ? 0 : 1 });
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('unknown-state');
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ result: 'clicked', waitedForButtonHidden: true });
    expect(result.waits).toHaveLength(1);
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
  });
  it('returns a new protected decision immediately even when the old clicked button remains', async () => {
    const { tab, calls } = fakeTab([done, `${done}\n- heading "选择收获"`]);
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('card-choice');
    expect(result.waits).toHaveLength(0);
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
  });
  it('resumes a disappeared button only through a newly observed known wait, without retrying', async () => {
    const { tab, calls } = fakeTab([offer, animation('小宝箱'), '- heading "选择收获"'], { count: 0 });
    const snapshots = [offer, animation('小宝箱'), '- heading "选择收获"'];
    tab.playwright.domSnapshot = async () => snapshots.shift();
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('card-choice');
    expect(result.steps[0]).toMatchObject({ result: 'not-clicked', refreshed: true });
    expect(result.waits).toHaveLength(1);
    expect(calls.some(call => call[0] === 'click')).toBe(false);
  });
  it('shares a ten-second wall-clock budget across all conditional waits', async () => {
    let now = 100;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { tab, calls } = fakeTab([travel, animation('小宝箱'), animation('密封物资箱'), reward()], { onWait() { now += now === 100 ? 6000 : 4000; } });
    const result = await runVisibleSteps(tab, { timeoutMs: 7000 });
    expect(result.reason).toBe('wait-budget-exhausted');
    expect(result.waits.map(wait => wait.timeoutMs)).toEqual([7000, 4000]);
    expect(calls.filter(call => call[0] === 'waitFor')).toHaveLength(2);
    expect(calls.some(call => call[0] === 'click')).toBe(false);
  });
  it('caps one individual wait at the shared ten-second budget even with a larger action timeout', async () => {
    const { tab, calls } = fakeTab([travel, '- heading "未知决策"']);
    await runVisibleSteps(tab, { timeoutMs: 30000 });
    expect(calls).toContainEqual(['waitFor', '进入该地点', { state: 'hidden', timeoutMs: 10000 }]);
  });
  it('charges post-click closing waits to the same total budget as animation waits', async () => {
    let now = 100;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    const { tab, calls } = fakeTab([done, `${done}\n- text: 工具栏已更新`, animation('小宝箱'), animation('密封物资箱')],
      { onWait() { now += now === 100 ? 6000 : 4000; } });
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('wait-budget-exhausted');
    expect(result.waits.map(wait => wait.timeoutMs)).toEqual([5000, 4000]);
    expect(result.steps[0]).toMatchObject({ result: 'clicked', waitedForButtonHidden: true });
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
  });
  it('bounds changing known animation snapshots to eight waits', async () => {
    const { tab, calls } = fakeTab(Array.from({ length: 10 }, (_, index) => animation(`箱${index}`)));
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('wait-limit');
    expect(result.waits).toHaveLength(8);
    expect(calls.some(call => call[0] === 'click')).toBe(false);
  });
  it('returns control on an animation wait error', async () => {
    const animation = '- heading "搜寻物资 · 小宝箱"\n- paragraph: 正在解锁封存物资。';
    const { tab } = fakeTab([offer, animation], { waitError: new Error('timeout') });
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('wait-error');
    expect(result.waits[0].result).toBe('error');
  });
  it('never retries after a click error and still captures post-action DOM', async () => {
    const { tab, calls } = fakeTab([offer], { clickError: new Error('strict mode violation') });
    const result = await runVisibleSteps(tab);
    expect(result.reason).toBe('click-error');
    expect(result.steps[0]).toMatchObject({ result: 'error', after: { fingerprint: expect.any(String) } });
    expect(calls.filter(call => call[0] === 'click')).toHaveLength(1);
    expect(calls.filter(call => call[0] === 'snapshot')).toHaveLength(2);
  });
});
