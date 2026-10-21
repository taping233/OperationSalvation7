/* 反馈12条·B组（12）：手牌区沉/升动画的相位终态所有权。
 * 手牌常驻层跨渲染复用，下沉动画 fill:forwards 会一直压着它；升回动画只能由
 * 「渲染前采样」触发，而采样只在本渲染有出牌事件时才发生——敌→玩家那一帧无事件时，
 * 既不建升回也不 cancel，手牌就永久停在下方+虚化。 */
import { afterEach, beforeEach, expect, it } from 'vitest';

document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
const ovBody = document.getElementById('ovBody');
const overlay = document.getElementById('overlay');
window.SDT = {
  UI: { overlay, el: { overlay, ovBody }, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {} },
  Sound: { sfx() {}, music() {}, setDucked() {}, setBoss() {} },
  Motion: { reduceMotion: () => false },
  Icons: { img: () => '', rich: value => String(value || ''), TYPE_ART: {} },
  Art: { has: () => false },
  Meta: { track() {} },
};

const { animateBattleTransition } = await import('../game/src/battle/view/battle.anim.view.js');

/** @type {{keyframes: any[], options: any, cancelled: boolean, playState: string, currentTime: number, cancel(): void, onfinish: null}[]} */
let created;
const stage = () => /** @type {HTMLElement} */ (ovBody.querySelector('.battle-stage'));
const prevView = phase => ({ phase, cards: {}, energy: 0, drawPile: 0 });
/** 先把舞台摆到敌方相位并建立一次下沉动画 */
function sinkDown() {
  stage().dataset.phase = 'enemy';
  animateBattleTransition(prevView('player'), ovBody, [], 0);
  expect(created).toHaveLength(1);
  expect(created[0].options.fill).toBe('forwards');
  expect(created[0].keyframes[1].transform).toBe('translateY(72%)');
  return created[0];
}

beforeEach(() => {
  created = [];
  Element.prototype.animate = function (keyframes, options) {
    const anim = {
      keyframes: [...keyframes], options: { ...options }, cancelled: false,
      // 报告为已结束：animateSafe 的兜底看门狗只在 running 且未推进时 cancel，
      // 测试只关心「谁主动 cancel」，不让看门狗污染断言。
      playState: 'finished', currentTime: (options?.duration || 0) + 1000, onfinish: null,
      cancel() { this.cancelled = true; },
    };
    created.push(anim);
    return anim;
  };
  ovBody.innerHTML = `<div class="battle-stage sts" data-phase="enemy">
    <div class="battle-stage-shade"></div>
    <div class="sts-arena"></div>
    <div class="sts-hud"><div class="bt-hand sts-hand"><div class="bt-slot"></div></div></div>
  </div>`;
  stage()._battleToken = 1;
});
afterEach(() => {
  delete Element.prototype.animate;
  ovBody.innerHTML = '';
});

it('敌→玩家且本渲染无出牌事件时，仍收回沉底动画并升起手牌', () => {
  const sink = sinkDown();
  stage().dataset.phase = 'player';
  // 复现反馈：prevView 为 null（takeCardAnims 空 → captureBattleView 未采样）
  animateBattleTransition(null, ovBody, [], 0);
  expect(sink.cancelled, '陈旧 fill:forwards 下沉必须被收回').toBe(true);
  expect(created).toHaveLength(2);
  const rise = created[1];
  expect(rise.cancelled).toBe(false);
  expect(rise.keyframes[0].transform).toBe('translateY(72%)');
  expect(rise.keyframes[1].transform).toBe('translateY(0)');
  expect(rise.options.fill).toBe('forwards');
  expect(rise.options.duration).toBe(380);
});

it('敌方相位内的无事件渲染不打断沉底终态', () => {
  const sink = sinkDown();
  animateBattleTransition(null, ovBody, [], 0);
  animateBattleTransition(null, ovBody, [], 0);
  expect(sink.cancelled).toBe(false);
  expect(created).toHaveLength(1);
});

it('敌→目标态同样升回；已在基位的相位切换不建多余动画', () => {
  const sink = sinkDown();
  stage().dataset.phase = 'targeting';
  animateBattleTransition(null, ovBody, [], 0);
  expect(sink.cancelled, '离开敌方相位即升回').toBe(true);
  expect(created[1].keyframes[1].transform).toBe('translateY(0)');
  // player → targeting：CSS 不下沉，不能凭空造一次 72% 起跳
  stage().dataset.phase = 'player';
  animateBattleTransition(prevView('targeting'), ovBody, [], 0);
  expect(created).toHaveLength(2);
  expect(created[1].cancelled, '基位一致时升回动画继续持有终态').toBe(false);
  stage().dataset.phase = 'targeting';
  animateBattleTransition(prevView('player'), ovBody, [], 0);
  expect(created, '沉/升维度未翻转不新建动画').toHaveLength(2);
});

it('带采样的正常敌→玩家仍走同一条升回路径', () => {
  const sink = sinkDown();
  stage().dataset.phase = 'player';
  animateBattleTransition(prevView('enemy'), ovBody, [], 0);
  expect(sink.cancelled).toBe(true);
  expect(created[1].keyframes[1].transform).toBe('translateY(0)');
  expect(created[1].options.duration).toBe(380);
});

it('减少动态偏好下全部动画被丢弃，不留下任何终态持有', () => {
  const sink = sinkDown();
  window.SDT.Motion.reduceMotion = () => true;
  stage().dataset.phase = 'player';
  animateBattleTransition(null, ovBody, [], 0);
  expect(sink.cancelled).toBe(true);
  expect(created).toHaveLength(1);
  window.SDT.Motion.reduceMotion = () => false;
});
