import { test } from 'vitest';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers';
import { SampleSfxBank, resolveSfx } from '../game/src/audio/sound.bank.js';
import { attackCue } from '../game/src/battle/view/battle.attack-cues.js';

function fixture() {
  const started = [], sources = [];
  let time = 0;
  const param = () => ({ value: 0, cancelScheduledValues() {}, setTargetAtTime() {} });
  const ctx = { currentTime: 0,
    createGain: () => ({ gain: param(), connect() {}, disconnect() {} }),
    createBufferSource() {
      const source = { playbackRate: param(), connect() {}, disconnect() {},
        start() { started.push(source); }, stop() { source.stopped = true; } };
      sources.push(source); return source;
    },
    async decodeAudioData() { return { duration: .2 }; },
  };
  const catalog = { cues: ['click', 'hurt', 'fireLoop', 'windSnowLoop'].map(id => ({
    id, loop: id.endsWith('Loop'), variants: [{ src: `assets/${id}.ogg` }],
  })) };
  const bank = new SampleSfxBank(ctx, {}, { catalog, clock: () => time,
    fetcher: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }) });
  return { bank, started, sources, advance: value => { time = value; } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('旧触发名与敌我回合能路由到新采样', () => {
  assert.equal(resolveSfx('hit'), 'attackSlash');
  assert.equal(resolveSfx('strike'), 'attackPierce');
  assert.equal(resolveSfx('phase', { side: 'foe' }), 'phaseFoe');
  assert.equal(resolveSfx('phase', { side: 'self' }), 'phaseSelf');
});
test('不同材质卡牌选择独立命中声，未提供卡牌时保留原契约', () => {
  for (const [name, expected] of [['火球', 'attackFire'], ['坚冰结界', 'attackIce'],
    ['充能射线', 'attackLightning'], ['致命穿刺', 'attackPierce'], ['饱和打击', 'attackBlunt'],
    ['毒箭', 'attackPoison'], ['长弓', 'attackArrow'], ['幻梦', 'attackPsychic']]) {
    assert.equal(attackCue('spell', { name }).hitSound, expected);
  }
  assert.equal(attackCue('attack').hitSound, null);
  assert.equal(attackCue('unknown', { name: '火球' }), undefined);
});
test('慢解码不会把过期点击补播到后续页面', async () => {
  const { bank, started, advance } = fixture();
  bank.play('click'); advance(300); await flush();
  assert.equal(started.length, 0);
});
test('关闭音效会停止在播声音并取消尚未解码的命中', async () => {
  const { bank, started } = fixture();
  bank.play('click'); await flush();
  assert.equal(started.length, 1);
  bank.play('hurt'); bank.setEnabled(false); await flush();
  assert.equal(started.length, 1);
  assert.equal(started[0].stopped, true);
});
test('快速换场景只启动最后的环境循环，退出停止', async () => {
  const { bank, started } = fixture();
  bank.ambient('fireLoop'); bank.ambient('windSnowLoop'); await flush();
  assert.equal(started.length, 1);
  assert.equal(started[0].loop, true);
  bank.ambient(null);
  assert.equal(started[0].stopped, true);
});
