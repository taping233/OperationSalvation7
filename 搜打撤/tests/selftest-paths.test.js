/* ROOT-06 回归：node game/selftest.js 必须能跑完（退出码 0），路径清单不得再指向
 * 目录化前的旧文件（game.menu.js → ui/game.menu.js 等）。 */
import {describe, it, expect, vi } from 'vitest';
import { spawnSync } from 'node:child_process';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const REPO = process.cwd();

describe('ROOT-06 零依赖自测入口（域目录路径）', () => {
  it('node game/selftest.js 跑完输出自测结果，退出码 0，无 ENOENT', () => {
    const r = spawnSync(process.execPath, ['game/selftest.js'], {
      cwd: REPO, encoding: 'utf8', timeout: 120000,
    });
    expect(r.error ?? null, `spawn 失败: ${r.error}`).toBeNull();
    const out = (r.stdout || '') + (r.stderr || '');
    expect(out).not.toMatch(/ENOENT/);
    expect(r.status, `自测未通过：\n${out.slice(-2000)}`).toBe(0);
    expect(out).toContain('✔ 档位概览仅展示游玩时间与已解锁成就');
    expect(out).toContain('全部通过');
  });
});
