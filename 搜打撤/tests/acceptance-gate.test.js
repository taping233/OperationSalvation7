import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {describe, expect, it, vi } from 'vitest';
import { DIRTY_SCAN_ROOTS, parseStagedStatus, planForPaths } from '../scripts/acceptance-gate.mjs';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

describe('分层验收选择', () => {
  it('测试文件小改只运行该测试', () => {
    const plan = planForPaths(['搜打撤/tests/battle-hand-selection-rules.test.js']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/battle-hand-selection-rules.test.js']);
  });

  it('纯战斗规则改动带直接测试与架构哨兵，不扩成启动全链', () => {
    const plan = planForPaths(['game/src/battle/core/battle.hand-selection.js']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toContain('tests/battle-hand-selection-rules.test.js');
    expect(plan.tests).toContain('tests/contracts.test.js');
    expect(plan.tests).toContain('tests/architecture-boundaries.test.js');
    expect(plan.tests).not.toContain('tests/boot.test.js');
  });

  it('卡牌稀有度规则改动选中直接契约测试', () => {
    const plan = planForPaths(['game/src/cards/card-rarity.js']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toContain('tests/card-render-context.test.js');
  });

  it('数据与剧情改动走定向，不再一票全量', () => {
    const pets = planForPaths(['game/data/pets.json']);
    expect(pets.mode).toBe('quick');
    expect(pets.tests).toContain('tests/cards-catalog.test.js');
    expect(planForPaths(['game/data/cards-sync.json']).tests).toContain('tests/cards-sync-snapshot-guard.test.js');
    expect(planForPaths(['narrative/events.ink']).tests).toEqual(['tests/compendium.test.js']);
  });

  it('公共规则与包配置、无契约脚本仍回退完整测试', () => {
    expect(planForPaths(['game/src/core/rule-config.js']).mode).toBe('full');
    expect(planForPaths(['game/src/hub/game.store.js']).mode).toBe('full');
    expect(planForPaths(['scripts/check-syntax.mjs']).mode).toBe('full');
    expect(planForPaths(['vite.config.js']).mode).toBe('full');
    expect(planForPaths(['package.json']).mode).toBe('full');
    expect(planForPaths(['tests/not-present.test.js']).mode).toBe('full');
  });

  it('lockfile 单独变化只跑架构哨兵', () => {
    const plan = planForPaths(['package-lock.json']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/architecture-boundaries.test.js', 'tests/contracts.test.js']);
  });

  it('fixture 变更定向到引用它的测试', () => {
    const plan = planForPaths(['tests/fixtures/card-effect-audit-known.json']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toContain('tests/card-audit.test.js');
  });

  it('被删除的源文件只跑引用它的测试与架构哨兵', () => {
    const plan = planForPaths(['game/src/battle/not-present.js']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toContain('tests/acceptance-gate.test.js');
    expect(plan.tests).toContain('tests/architecture-boundaries.test.js');
  });

  it('已映射的 Agent 工具只运行对应定向测试', () => {
    const compare = planForPaths(['game/tools/agent-compare.mjs']);
    expect(compare.mode).toBe('quick');
    expect(compare.tests).toEqual(['tests/agent-compare-provenance.test.js']);

    const compareProvenance = planForPaths(['game/tools/agent-compare-provenance.mjs']);
    expect(compareProvenance.mode).toBe('quick');
    expect(compareProvenance.tests).toEqual(['tests/agent-compare-provenance.test.js']);

    const runProvenance = planForPaths(['game/tools/agent-run-provenance.mjs']);
    expect(runProvenance.mode).toBe('quick');
    expect(runProvenance.tests).toEqual(['tests/agent-run-provenance.test.js']);
  });
  it('目录化后的战斗核心与运行态仍强制完整门', () => {
    for (const file of ['game/src/battle/core/battle.engine.js', 'game/src/battle/core/battle.core.js',
      'game/src/battle/runtime/battle.runtime.js', 'game/src/battle/runtime/battle.runtime.session.js']) {
      const plan = planForPaths([file]);
      expect(plan.mode).toBe('full');
      expect(plan.reasons).toContain('公共状态、启动、规则或迁移边界变更需要全量测试');
    }
  });
  it('已有直接契约的流程工具走快门，未知脚本仍全量', () => {
    const plan = planForPaths(['scripts/workflow-task.mjs']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/workflow-task.test.js']);
    expect(planForPaths(['scripts/workflow-evidence.mjs']).tests).toContain('tests/workflow-scope.test.js');
    expect(planForPaths(['scripts/acceptance-gate.mjs']).tests).toEqual(['tests/acceptance-gate.test.js']);
    expect(planForPaths(['scripts/sync-cards-from-live.mjs']).tests).toContain('tests/sync-cards-from-live.test.js');
    expect(planForPaths(['scripts/unknown-tool.mjs']).mode).toBe('full');
  });

  it('没有直接覆盖测试的 Agent 工具和其他 game/tools 改动回退完整测试', () => {
    for (const file of ['game/tools/agent-ledger.mjs', 'game/tools/agent-batch.mjs', 'game/tools/bake-card-thumbs.cjs']) {
      const plan = planForPaths([file]);
      expect(plan.mode, file).toBe('full');
      expect(plan.tests).toEqual([]);
    }
  });

  it('暂存快照的忽略文件扫描包含 game/tools', () => {
    expect(DIRTY_SCAN_ROOTS).toContain('搜打撤/game/tools');
  });

  it('纯样式修改不冒充 Vitest 验收', () => {
    expect(planForPaths(['game/css/winter.css']).mode).toBe('skip');
    expect(planForPaths(['docs/quality-gates.md']).mode).toBe('skip');
  });
  it('文档机器计划明确skip，不输出PASS', () => {
    const result = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--paths', 'docs/README.md', '--plan', '--json'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: 'skip', tests: [] });
    expect(result.stdout).not.toContain('PASS');
  });

  it('Windows 绝对路径仍映射到项目内测试', () => {
    const absolute = path.resolve('game/src/cards/card-rarity.js');
    expect(planForPaths([absolute]).tests).toContain('tests/card-render-context.test.js');
    expect(() => planForPaths(['docs/../../../outside/file'])).toThrow('不在 Vite 项目内');
  });

  it('命令行缺少 --paths 参数值时明确失败', () => {
    const result = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--paths', '--run'], {
      cwd: process.cwd(), encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--paths 后必须给出');
  });

  it('test:target 不给测试文件时拒绝退化为全量', () => {
    const result = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--target-tests'], {
      cwd: process.cwd(), encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('必须指定至少一个');
  });

  it('Git 零字节状态按状态与路径成对读取，不能吞掉删除项', () => {
    expect(parseStagedStatus(['M', '搜打撤/game/src/a.js', 'D', '搜打撤/tests/b.test.js']))
      .toEqual([
        { status: 'M', path: '搜打撤/game/src/a.js' },
        { status: 'D', path: '搜打撤/tests/b.test.js' },
      ]);
    expect(() => parseStagedStatus(['M'])).toThrow('输出不完整');
  });
});
