// @vitest-environment node
// 2026-10-21 老板实测反馈 12 条第 8 条（C组）：「返回地图」有时候在左边有时候
// 在右边。契约：全站页脚统一右对齐（.node-foot flex-end，与共享 .ov-btns
// flex-end、cqo-actions、shop-back、battle-decision-actions 惯例一致），并把
// 各页返回键钉为行内最右一枚（order:9）；事件载入两屏的返回键从正文移入页脚。
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import postcss from 'postcss';

const read = path => readFileSync(path, 'utf8');

function rulesOf(path) {
  const list = [];
  postcss.parse(read(path)).walkRules(r => list.push(r));
  return list;
}
const declOf = (rules, selector) => {
  const rule = rules.find(r => r.selectors.includes(selector));
  if (!rule) return null;
  const out = {};
  rule.walkDecls(d => { out[d.prop] = d.value; });
  return out;
};

it('共享页脚 .node-foot 全部右对齐，不再有 flex-start/center 分叉', () => {
  const entry = rulesOf('game/css/entry-events.css');
  const footSelectors = entry.filter(r => r.selector.includes('.event-decisions > .node-foot'));
  expect(footSelectors).toHaveLength(2); // 事件场景（非主题）与主题场景各一条
  for (const rule of footSelectors) {
    const out = {};
    rule.walkDecls(d => { out[d.prop] = d.value; });
    expect(out['justify-content']).toBe('flex-end');
  }
  expect(read('game/css/entry-events.css')).not.toMatch(/\.event-decisions > \.node-foot \{[^}]*flex-start/);
});

it('各页返回键钉为页脚行内最右一枚（order:9 覆盖全部返回键 act）', () => {
  const rules = rulesOf('game/css/entry-events.css');
  const order = declOf(rules, '#overlay .node-foot > :is([data-act="evtReturn"],[data-act="eventCardReturn"],[data-act="eventEntryCancel"],[data-act="nodeDecisionLeave"],[data-act="fireDone"],[data-act="bossGateBack"],[data-act="bossGateLockedBack"])');
  expect(order).toMatchObject({ order: '9' });
  // 全站枚举：rg「返回地图」的每一处返回键都必须落在右侧行动行（CSS 钉位或本就右列）。
  const files = [
    'game/src/run/game.run.altar.js', 'game/src/run/game.run.flow.js', 'game/src/run/game.run.events.js',
    'game/src/run/game.run.shop.js', 'game/src/run/game.run.scenes.js', 'game/src/run/game.run.resources.js',
    'game/src/run/event-lifecycle.js', 'game/src/run/event-card-choice.js', 'game/src/ui/chest-reward-overview.js',
    'game/src/run/chests.js', 'game/src/ui/node-scene-view.js', 'game/src/ui/fire-rest-view.js',
  ];
  for (const file of files) expect(read(file)).toContain('返回地图');
  // 商店页与资源页的返回键本就位于右侧行动列（结构保证，不需要 order 钉位）。
  expect(read('game/css/expedition-shop.css')).toMatch(/\.shop-market-footer \.shop-back \{ order:3/);
});

it('事件载入两屏的返回地图从正文移入页脚（与其他节点页同一行位）', () => {
  const source = read('game/src/run/event-lifecycle.js');
  expect(source).not.toMatch(/body:'<button class="ov-btn[^>]*data-act="eventEntryCancel"/);
  expect(source).toMatch(/foot:'<button class="ov-btn" data-act="eventEntryCancel" data-cancel="true">返回地图<\/button>'/);
  expect(source).toMatch(/foot:'<button class="ov-btn ok" data-act="eventEntryRetry">重试载入<\/button>'/);
});

it('奖励总览与独立拾取页的返回地图同样钉在行动行最右', () => {
  const rules = rulesOf('game/css/chest-reward-overview.css');
  expect(declOf(rules, 'body #overlay .card .cqo-frame .cqo-overview .cqo-actions > [data-act="chestReturn"]')).toMatchObject({ order: '9' });
  expect(declOf(rules, 'body #overlay .card:has(.reward-standalone-picker) .reward-standalone-picker .reward-footer-info > [data-act="chestReturn"]')).toMatchObject({ order: '9', 'margin-left': 'auto' });
  // 节点场景顶栏退出键保持统一左上（同族 archive-back 位置约定，不参与页脚行）。
  expect(read('game/src/ui/node-scene-view.js')).toContain('class="archive-back"');
});
