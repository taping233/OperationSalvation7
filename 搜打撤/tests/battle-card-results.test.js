import { beforeEach, expect, it, vi } from 'vitest';
import { cardResultRows, showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
import { createBattleDraw } from '../game/src/battle/core/battle.draw.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

let stage;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage"></div></div>';
  stage = document.querySelector('.battle-stage');
  stage._battleToken = 1;
  runtime.set$hand([]);
  runtime.clearBattlePiles();
  runtime.set$lastDrawnUids([]);
  runtime.clearBattlePresentation();
});

it('真实发牌端口区分获得新牌和普通抽牌，合并重复卡名并标明去向', () => {
  const draw = createBattleDraw({ alive: () => [], fireAcquire: vi.fn() });
  draw.addTempCard({ id: 'a', name: '火球' });
  draw.addTempCard({ id: 'a', name: '火球' });
  draw.addTempCard({ id: 'b', name: '冰箭' });
  draw.addDeckCard({ id: 'c', name: '雷击' });
  showBattleCardResults(stage, [...runtime.cardAnims, { kind: 'draw', name: '普通抽牌' }]);
  const panel = stage.querySelector('.bt-card-results');
  expect(panel.textContent).toContain('获得卡牌 · 置入手牌【火球】×2、【冰箭】');
  expect(panel.textContent).toContain('获得卡牌 · 洗入牌库【雷击】');
  expect(panel.textContent).not.toContain('普通抽牌');
  expect(runtime.hand).toHaveLength(3);
  expect(runtime.drawPile).toHaveLength(1);
});

it('随机释放逐发列出实际卡牌、目标与来源，重绘保留记录，换场清空', () => {
  showBattleCardResults(stage, [
    { kind: 'surge', name: '火球', targetName: '敌人甲', i: 1, n: 4 },
    { kind: 'surge', name: '冰箭', targetName: '敌人乙', i: 2, n: 4 },
    { kind: 'surge', name: '三重火球', targetName: '敌人甲', sourceName: '火球符文', i: 1, n: 1 },
  ]);
  expect(stage.textContent).toContain('法力奔涌 · 随机释放 1/4【火球】 → 敌人甲');
  expect(stage.textContent).toContain('随机释放 2/4【冰箭】 → 敌人乙');
  expect(stage.textContent).toContain('火球符文 · 随机释放【三重火球】 → 敌人甲');
  stage.replaceChildren();
  showBattleCardResults(stage, []);
  expect(stage.querySelectorAll('.bt-card-result')).toHaveLength(3);
  stage._battleToken = 2;
  showBattleCardResults(stage, []);
  expect(stage.querySelector('.bt-card-results')).toBeNull();
});

it('只记录已结算的卡牌，转义卡名并保留最近六条结果', () => {
  expect(cardResultRows([{ kind: 'play', name: '打出的牌' }, { kind: 'burn', name: '消耗的牌' }])).toEqual([]);
  for (let i = 0; i < 8; i++) showBattleCardResults(stage, [{ kind: 'draw', acquired: true, name: `牌${i}<img onerror="bad()">` }]);
  expect(stage.querySelectorAll('.bt-card-result')).toHaveLength(6);
  expect(stage.textContent).not.toContain('牌0');
  expect(stage.textContent).toContain('牌7<img onerror="bad()">');
  expect(stage.querySelector('img')).toBeNull();
});
