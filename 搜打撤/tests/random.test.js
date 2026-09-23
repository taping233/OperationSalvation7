import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Random, SeededRandomService, setRandomService } from '../game/src/core/random.js';

describe('带种子的随机数服务', () => {
  it('同 seed、同命名流产生相同序列', () => {
    const first = new SeededRandomService(20260904);
    const second = new SeededRandomService(20260904);
    expect(Array.from({ length: 8 }, () => first.random('dice')))
      .toEqual(Array.from({ length: 8 }, () => second.random('dice')));
  });

  it('命名流互不干扰', () => {
    const withEffects = new SeededRandomService(7);
    const gameplayOnly = new SeededRandomService(7);
    withEffects.random('audio');
    withEffects.random('visual');
    expect(withEffects.random('enemy')).toBe(gameplayOnly.random('enemy'));
  });

  it('快照恢复后从准确位置继续', () => {
    const source = new SeededRandomService(42);
    source.random('loot');
    const snapshot = source.snapshot();
    const expected = source.random('loot');
    const restored = new SeededRandomService(1);
    restored.restore(snapshot);
    expect(restored.random('loot')).toBe(expected);
    expect(restored.seed).toBe(42);
  });

  it('允许注入实现完整契约的随机数服务', () => {
    const injected = new SeededRandomService(99);
    setRandomService(injected);
    expect(Random.seed).toBe(99);
    expect(Random.random('dice')).toEqual(expect.any(Number));
  });

  it('源码不再绕过随机数服务，且对局存档包含 seed 与流状态', () => {
    const root = resolve(process.cwd(), 'game/src');
    const listJs = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = resolve(dir, e.name);
      return e.isDirectory() ? listJs(p) : (e.name.endsWith('.js') && e.name !== 'random.js' ? [p] : []);
    });
    const sources = listJs(root).map((p) => readFileSync(p, 'utf8'));
    expect(sources.length).toBeGreaterThan(100);   // 目录化后递归扫描全树，防止根层只剩入口文件时断言假松
    expect(sources.join('\n')).not.toContain('Math.random()');
    const session = readFileSync(resolve(root, 'run/game.session.js'), 'utf8');
    expect(session).toContain('seed: Random.seed, rngState: Random.snapshot()');
    expect(session).toContain('Random.restore(s.rngState || s.seed)');
  });
});
