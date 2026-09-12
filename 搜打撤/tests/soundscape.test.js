import { describe, expect, it } from 'vitest';
import { WinterSoundscape } from '../game/src/sound.scape.js';

function fakeContext() {
  const makeGain = () => {
    const gain = { kind: 'param', value: 0, targets: [], cancelScheduledValues() {}, setTargetAtTime(value) { this.targets.push(value); } };
    return { kind: 'gain', connections: [], connect(target) { this.connections.push(target); }, disconnect() {}, gain };
  };
  return {
    currentTime: 12, sampleRate: 8000,
    createGain: makeGain,
    createOscillator: () => ({ kind: 'osc', connections: [], connect(target) { this.connections.push(target); }, disconnect() {}, start() {}, stop() {}, type: '', frequency: { value: 0 } }),
    createBuffer: () => ({ getChannelData: () => new Float32Array(16) }),
    createBufferSource: () => ({ kind: 'source', connections: [], connect(target) { this.connections.push(target); }, disconnect() {}, start() {}, stop() {}, loop: false }),
    createBiquadFilter: () => ({ kind: 'filter', connections: [], connect(target) { this.connections.push(target); }, disconnect() {}, type: '', frequency: { value: 0 }, Q: { value: 0 } }),
  };
}

describe('冬境声景节点生命周期', () => {
  it('切换 title/board/battle 只保留当前层，销毁时停止并断开全部节点', () => {
    const context = fakeContext();
    const scape = new WinterSoundscape(context, {});
    expect(scape.mode).toBe(null);
    expect(scape.layers.size).toBe(3);
    const layers = [...scape.layers.values()];
    expect(scape.nodes.filter(node => node.kind === 'osc').every(node => node.connections.every(target => !layers.includes(target)))).toBe(true);
    expect(scape.nodes.some(node => node.kind === 'gain' && node.connections.some(target => target?.kind === 'param'))).toBe(true);
    scape.setMode('title'); expect(scape.mode).toBe('title');
    scape.setMode('battle'); expect(scape.mode).toBe('battle');
    scape.setMuted(true); scape.setVolume(0.15); expect(scape.root.gain.targets.at(-1)).toBe(0);
    scape.setMuted(false); expect(scape.root.gain.targets.at(-1)).toBe(0.15);
    scape.setPaused(true); expect(scape.paused).toBe(true);
    scape.setVolume(0.12); expect(scape.root.gain.targets.at(-1)).toBe(0);
    scape.setPaused(false); scape.setMode('board'); expect(scape.mode).toBe('board');
    expect(scape.root.gain.targets.at(-1)).toBe(0.12);
    const scheduled = scape.root.gain.targets.length;
    scape.setMode('board');
    expect(scape.root.gain.targets).toHaveLength(scheduled);
    expect(() => scape.destroy()).not.toThrow();
    expect(scape.nodes).toHaveLength(0);
    expect(scape.mode).toBe(null);
  });
});
