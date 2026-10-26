import { EventEmitter } from 'node:events';
import { runInNewContext } from 'node:vm';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { DIRTY_SCAN_ROOTS, packageJsonScriptsOnlyDiff, parseStagedStatus, planForPaths, vitestEnvironment } from '../scripts/acceptance-gate.mjs';
import { planForPaths as selectPlan, reverseImports } from '../scripts/gate-plan.mjs';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

describe('分层验收选择', () => {
  it.each([
    'scripts/dependency-audit-diagnostics.mjs',
    'tests/tools/dependency-audit-diagnostics.test.mjs',
  ])('audit implementation or Node fixture change selects the Vitest bridge: %s', changed => {
    const plan = planForPaths([changed]);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toContain('tests/dependency-audit-diagnostics.test.js');
    expect(plan.tests.every(test => test.endsWith('.test.js'))).toBe(true);
    expect(plan.tests).not.toContain('tests/tools/dependency-audit-diagnostics.test.mjs');
  });

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

  it('公共规则与包配置仍回退完整测试；未映射脚本 R2 起回退轻契约', () => {
    expect(planForPaths(['game/src/core/rule-config.js']).mode).toBe('full');
    expect(planForPaths(['game/src/hub/game.store.js']).mode).toBe('full');
    // R2（10-01 拍板）：scripts/ 未映射/豁免脚本不再全量，回退契约测试+引用搜索+哨兵。
    const contract = planForPaths(['scripts/check-syntax.mjs']);
    expect(contract.mode).toBe('quick');
    expect(contract.tests).toContain('tests/scripts-contract.test.js');
    expect(contract.tests).toContain('tests/contracts.test.js');
    expect(planForPaths(['vite.config.js']).mode).toBe('full');
    expect(planForPaths(['package.json']).mode).toBe('full');
    expect(planForPaths(['tests/not-present.test.js']).mode).toBe('full');
  });

  it('lockfile 单独变化只跑架构哨兵', () => {
    const plan = planForPaths(['package-lock.json']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/architecture-boundaries.test.js', 'tests/contracts.test.js']);
  });

  it('package.json 仅 scripts 段变更走架构哨兵快门', () => {
    const plan = planForPaths(['package.json'], { packageJsonScriptsOnly: true });
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/architecture-boundaries.test.js', 'tests/contracts.test.js']);
    expect(plan.reasons.join('、')).toContain('仅 scripts 段');
  });

  it('scripts 豁免不覆盖 lockfile 与构建配置同变', () => {
    expect(planForPaths(['package.json', 'package-lock.json'], { packageJsonScriptsOnly: true }).mode).toBe('full');
    expect(planForPaths(['package.json', 'vite.config.js'], { packageJsonScriptsOnly: true }).mode).toBe('full');
  });

  it('scriptsOnlyDiff 只豁免 scripts 段，其余字段任何变化都不豁免', () => {
    const base = JSON.stringify({ name: 'x', version: '1', scripts: { dev: 'vite' } });
    expect(packageJsonScriptsOnlyDiff(base, JSON.stringify({ name: 'x', version: '1', scripts: { dev: 'vite --port 5200' } }))).toBe(true);
    expect(packageJsonScriptsOnlyDiff(base, JSON.stringify({ name: 'x', version: '1', scripts: {} }))).toBe(true);
    expect(packageJsonScriptsOnlyDiff(base, JSON.stringify({ name: 'x', version: '2', scripts: { dev: 'vite' } }))).toBe(false);
    expect(packageJsonScriptsOnlyDiff(base, JSON.stringify({ name: 'x', version: '1', scripts: { dev: 'vite' }, dependencies: { a: '^1' } }))).toBe(false);
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
  it('可见DOM转场辅助脚本映射至专属契约，不扩大选择范围', () => {
    const plan = planForPaths(['scripts/visible-playback.mjs']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/visible-playback.test.js']);
  });

  it('已有直接契约的流程工具走快门，未知脚本 R2 起回退轻契约（映射守卫兜底）', () => {
    const plan = planForPaths(['scripts/workflow-task.mjs']);
    expect(plan.mode).toBe('quick');
    expect(plan.tests).toEqual(['tests/workflow-task.test.js']);
    expect(planForPaths(['scripts/workflow-evidence.mjs']).tests).toContain('tests/workflow-scope.test.js');
    expect(planForPaths(['scripts/acceptance-gate.mjs']).tests).toEqual(['tests/acceptance-gate.test.js']);
    expect(planForPaths(['scripts/sync-cards-from-live.mjs']).tests).toContain('tests/sync-cards-from-live.test.js');
    // R2：未知/未登记脚本回退契约测试+哨兵；漏登记由 scripts-contract 守卫标红。
    const unknown = planForPaths(['scripts/unknown-tool.mjs']);
    expect(unknown.mode).toBe('quick');
    expect(unknown.tests).toContain('tests/scripts-contract.test.js');
    expect(unknown.reasons.join('、')).toContain('回退脚本契约测试');
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
  it('纯资产进入可执行快门，空定向列表不代表全量 Vitest', () => {
    const plan = planForPaths(['game/assets/characters/new.png']);
    expect(plan).toMatchObject({ mode: 'quick', tests: [] });
    expect(plan.paths).toEqual(['game/assets/characters/new.png']);
    expect(plan.reasons.join(' ')).toContain('增量素材检查');
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

describe('混树拒绝与 GATE_MANIFEST_OK 逃生口（10-02 补，机制补全）', () => {
  const { execFileSync } = require('node:child_process');
  const { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
  const os = require('node:os');
  function mixedFixture({ dirty = true, runnable = false } = {}) {
    const repo = mkdtempSync(path.join(os.tmpdir(), 'sdt-gate-mixed-'));
    const root = path.join(repo, '搜打撤');
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'tests'), { recursive: true });
    // Planning must work without the receipt/execution dependency chain in this fixture.
    for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs', 'architecture-graph.mjs']) {
      writeFileSync(path.join(root, 'scripts', name), readFileSync(path.resolve('scripts', name)));
    }
    writeFileSync(path.join(root, 'scripts/architecture-graph.mjs'), 'export const analyzeModule = () => ({ imports: [] });');
    if (runnable) {
      writeFileSync(path.join(root, 'package.json'), '{"type":"module"}');
      const stub = "import {appendFileSync} from 'node:fs'; appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(1))+'\\n'); if (process.argv[1].endsWith(process.env.FAIL_GATE_STEP || '/never-fail')) process.exit(7);";
      for (const file of ['scripts/compile-narrative.mjs', 'scripts/check-syntax.mjs', 'scripts/validate-data.mjs',
        'scripts/check-types.mjs', 'node_modules/eslint/bin/eslint.js', 'node_modules/vitest/vitest.mjs']) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), stub);
      }
      writeFileSync(path.join(root, 'scripts/asset-audit.cjs'), "require('node:fs').appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(1))+'\\n'); if (process.env.FAIL_GATE_STEP === 'asset-audit.cjs') process.exit(7);");
    }
    const gitAt = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repo, encoding: 'utf8' });
    writeFileSync(path.join(root, 'scripts/base.mjs'), 'export const a = 1;\n');
    gitAt('init', '-q'); gitAt('add', '.');
    gitAt('-c', 'user.name=F', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'base');
    writeFileSync(path.join(root, 'scripts/mine.mjs'), 'export const b = 2;\n');   // 我的暂存
    gitAt('add', '搜打撤/scripts/mine.mjs');
    if (dirty) writeFileSync(path.join(root, 'scripts/theirs.mjs'), 'export const c = 3;\n'); // 他人在途未跟踪
    return { repo, root, gitAt };
  }
  const cleanups = [];
  afterAll(() => { for (const dir of cleanups.splice(0)) rmSync(dir, { recursive: true, force: true }); });

  it('混树（他人在途未跟踪）拒绝 staged 验证', () => {
    const { repo, root } = mixedFixture(); cleanups.push(repo);
    const env = { ...process.env };
    delete env.GATE_MANIFEST_OK; // 外层 gate 可能带此变量跑测试，拒绝语义必须显式无逃生口
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--plan'], { cwd: repo, encoding: 'utf8', env });
    expect(result.status).not.toBe(0);
    expect(result.stderr + result.stdout).toContain('无法用工作树验证暂存快照');
  });
  it('GATE_MANIFEST_OK=1 显式放行并给出定向计划（与无主阻断共用逃生口）', () => {
    const { repo, root } = mixedFixture(); cleanups.push(repo);
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--plan'],
      { cwd: repo, encoding: 'utf8', env: { ...process.env, GATE_MANIFEST_OK: '1' } });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('[gate]');
  });
  it('强制full仍在编译前拒绝混树，不执行任一步骤', () => {
    const { repo, root } = mixedFixture({ runnable: true }); cleanups.push(repo);
    const env = { ...process.env }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--force-full', '--run'], { cwd: repo, encoding: 'utf8', env });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('无法用工作树验证暂存快照');
    expect(result.stdout).not.toContain('剧情编译');
  });
  it('干净暂存强制full执行编译、静态检查和未过滤测试（隔离门跳过素材审计）', () => {
    const { repo, root } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
    const env = { ...process.env }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--force-full', '--run'], { cwd: repo, encoding: 'utf8', env });
    expect(result.status).toBe(0);
    const calls = readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(calls).toHaveLength(6);
    expect(calls[0][0]).toContain('compile-narrative.mjs');
    expect(calls.slice(1, 5).map(c => path.basename(c[0])).sort()).toEqual(['check-syntax.mjs', 'check-types.mjs', 'eslint.js', 'validate-data.mjs']);
    expect(calls.some(c => c[0].includes('asset-audit'))).toBe(false);
    expect(calls[5].slice(1)).toEqual(['run', '--silent']);
    expect(result.stdout).toContain('PASS：full');
  });
  it('Vitest环境复制清除Git local-env-vars，保留全局与非Git配置且不修改原对象', () => {
    const names = execFileSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' }).trim().split('\n');
    const input = Object.freeze({ ...Object.fromEntries(names.map(key => [key, 'parent-' + key])),
      GATE_MANIFEST_OK: '1', PATH: process.env.PATH, SDT_GIT_ENV_PROBE: 'keep', GIT_OPTIONAL_LOCKS: '0' });
    const original = { ...input };
    const child = vitestEnvironment(input);
    expect(child).not.toBe(input);
    for (const key of names) expect(child).not.toHaveProperty(key);
    expect(child).not.toHaveProperty('GATE_MANIFEST_OK');
    expect(child).toMatchObject({ PATH: process.env.PATH, SDT_GIT_ENV_PROBE: 'keep', GIT_OPTIONAL_LOCKS: '0' });
    expect(input).toEqual(original);
  });
  function installGitProbeVitest(root) {
    writeFileSync(path.join(root, 'node_modules/vitest/vitest.mjs'), `
import {execFileSync} from 'node:child_process';
import {appendFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
const names=execFileSync('git',['rev-parse','--local-env-vars'],{encoding:'utf8'}).trim().split('\\n');
writeFileSync('vitest-environment.json',JSON.stringify(Object.fromEntries([...names,'GATE_MANIFEST_OK','SDT_GIT_ENV_PROBE','PATH'].filter(k=>k in process.env).map(k=>[k,process.env[k]]))));
const foreign=path.resolve('..','foreign-vitest');mkdirSync(foreign);writeFileSync(path.join(foreign,'value.txt'),'foreign fixture');
execFileSync('git',['init','-q'],{cwd:foreign});execFileSync('git',['add','value.txt'],{cwd:foreign});
if(!existsSync(path.join(foreign,'.git/index')))throw new Error('foreign Git fixture inherited the hook index');
appendFileSync('calls.jsonl',JSON.stringify(process.argv.slice(1))+'\\n');
`);
  }
  it('正常commit --only hook保留门索引，只隔离full Vitest的foreign Git夹具环境', () => {
    const { repo, root, gitAt } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
    installGitProbeVitest(root);
    const recorder = path.join(repo, '.git/record-hook-env.mjs');
    writeFileSync(recorder, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(path.join(root, 'hook-environment.json'))},JSON.stringify({GIT_INDEX_FILE:process.env.GIT_INDEX_FILE,GIT_CONFIG_PARAMETERS:process.env.GIT_CONFIG_PARAMETERS,PATH:process.env.PATH}));`);
    const hook = path.join(repo, '.git/hooks/pre-commit');
    writeFileSync(hook, `#!/bin/sh\n${JSON.stringify(process.execPath)} ${JSON.stringify(recorder)} || exit $?\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(root, 'scripts/acceptance-gate.mjs'))} --staged --force-full --run\n`);
    chmodSync(hook, 0o755);
    const result = spawnSync('git', ['-c', 'user.name=F', '-c', 'user.email=f@x.invalid', 'commit', '--only', '-m', 'fixture normal hook', '搜打撤/scripts/mine.mjs'],
      { cwd: repo, encoding: 'utf8', env: { ...process.env, SDT_GIT_ENV_PROBE: 'preserved-full' } });
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout + result.stderr).toContain('PASS：full');
    const hookEnv = JSON.parse(readFileSync(path.join(root, 'hook-environment.json'), 'utf8'));
    expect(hookEnv.GIT_INDEX_FILE).toBeTruthy();
    const child = JSON.parse(readFileSync(path.join(root, 'vitest-environment.json'), 'utf8'));
    expect(child).toMatchObject({ SDT_GIT_ENV_PROBE: 'preserved-full', PATH: hookEnv.PATH });
    expect(Object.keys(child).filter(k => k.startsWith('GIT_') || k === 'GATE_MANIFEST_OK')).toEqual([]);
    expect(gitAt('diff', '--cached', '--name-only').trim()).toBe('');
  });
  it('target Vitest同样隔离repo-local Git环境，保留其他变量且不改调用环境', () => {
    const { repo, root, gitAt } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
    installGitProbeVitest(root);
    writeFileSync(path.join(root, 'tests/selected.test.js'), '// selected fixture');
    const indexBefore = gitAt('ls-files', '--stage');
    const env = { ...process.env, GIT_INDEX_FILE: path.join(repo, '.git/index'), GIT_DIR: path.join(repo, '.git'), GIT_WORK_TREE: repo,
      GATE_MANIFEST_OK: '1', SDT_GIT_ENV_PROBE: 'preserved-target' };
    const original = { ...env };
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--target-tests', 'tests/selected.test.js'],
      { cwd: root, encoding: 'utf8', env });
    expect(result.status, result.stderr + result.stdout).toBe(0);
    const child = JSON.parse(readFileSync(path.join(root, 'vitest-environment.json'), 'utf8'));
    expect(child).toMatchObject({ SDT_GIT_ENV_PROBE: 'preserved-target', PATH: process.env.PATH });
    expect(Object.keys(child).filter(k => k.startsWith('GIT_') || k === 'GATE_MANIFEST_OK')).toEqual([]);
    expect(env).toEqual(original);
    expect(gitAt('ls-files', '--stage')).toBe(indexBefore);
  });
  it('强制full拒绝以quick冻结证据代替', () => {
    const result = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--staged', '--force-full', '--reuse', 'quick.json', '--run'], { cwd: process.cwd(), encoding: 'utf8' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('不能以冻结 quick 证据代替');
  });
  it('不把配置文件或源码误判为同名前缀备份的父路径', () => {
    const { repo, root, gitAt } = mixedFixture({ dirty: false }); cleanups.push(repo);
    mkdirSync(path.join(repo, '.codex'), { recursive: true });
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(repo, '.codex/config.toml'), '[sandbox_workspace_write]\nnetwork_access = true\n');
    gitAt('add', '.codex/config.toml');
    writeFileSync(path.join(root, 'docs/PARALLEL-REGISTRY.md'),
      '## 无主物品\n| `.codex/config.toml.bak-nai-*` | 等认领 |\n| `搜打撤/scripts/mine.mjs.backup` | 等认领 |\n');
    const env = { ...process.env }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--plan'],
      { cwd: repo, encoding: 'utf8', env });
    expect(result.status, result.stderr).toBe(0);
  });

  it('强制full也在编译前拒绝无主暂存物品', () => {
    const { repo, root } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
    mkdirSync(path.join(root, 'docs'), { recursive: true });
    writeFileSync(path.join(root, 'docs/PARALLEL-REGISTRY.md'), '## 无主物品\n| `搜打撤/scripts/mine.mjs` | 等认领 |\n');
    const env = { ...process.env }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--force-full', '--run'], { cwd: repo, encoding: 'utf8', env });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('REGISTRY 无主物品');
    expect(result.stdout).not.toContain('剧情编译');
  });
  it.each(['compile-narrative.mjs', 'check-syntax.mjs', 'validate-data.mjs', 'check-types.mjs', 'eslint.js'])(
    '强制full在%s失败时阻断，绝不执行Vitest', step => {
      const { repo, root } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
      const env = { ...process.env, FAIL_GATE_STEP: step }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--force-full', '--run'], { cwd: repo, encoding: 'utf8', env });
      expect(result.status).not.toBe(0);
      const calls = readFileSync(path.join(root, 'calls.jsonl'), 'utf8');
      expect(calls).not.toContain('vitest.mjs');
      expect(result.stdout).not.toContain('PASS');
    });
  it('纯资产quick空测试列表只跑编译与静态检查（隔离门跳过素材审计）', () => {
    const { repo, root, gitAt } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
    gitAt('-c', 'user.name=F', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'tool');
    mkdirSync(path.join(root, 'game/assets'), { recursive: true });
    writeFileSync(path.join(root, 'game/assets/new.png'), 'fixture');
    gitAt('add', '搜打撤/game/assets/new.png');
    const env = { ...process.env }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
    const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--run'], { cwd: repo, encoding: 'utf8', env });
    expect(result.status).toBe(0);
    const calls = readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(calls).toHaveLength(5);
    expect(calls.some(command => command[0].endsWith('vitest.mjs'))).toBe(false);
    expect(calls.some(c => c[0].includes('asset-audit'))).toBe(false);
    expect(result.stdout).toContain('PASS：quick');
  });
  it.each(['eslint.config.js', 'jsconfig.strict-ui.json'])(
    '强制full也阻断未跟踪质量配置%s', config => {
      const { repo, root } = mixedFixture({ dirty: false, runnable: true }); cleanups.push(repo);
      writeFileSync(path.join(root, config), '{}');
      const env = { ...process.env }; delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
      const result = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--staged', '--force-full', '--run'], { cwd: repo, encoding: 'utf8', env });
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain(config);
      expect(result.stdout).not.toContain('剧情编译');
    });
});

describe('planner 显式 root 与查询故障隔离', () => {
  const roots = [];
  const createRoot = () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-gate-root-'));
    roots.push(root);
    return root;
  };
  const put = (root, file, content) => {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  };
  afterAll(() => {
    for (const root of roots) {
      const relative = path.relative(os.tmpdir(), root);
      if (!relative.startsWith('sdt-gate-root-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
      rmSync(root, { recursive: true, force: true });
    }
  });
  it('skip 运行先审计素材再跑文档守卫，规划模式不执行检查', () => {
    const root = createRoot();
    for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs']) {
      put(root, 'scripts/' + name, readFileSync(path.resolve('scripts', name), 'utf8'));
    }
    put(root, 'scripts/architecture-graph.mjs', 'export const analyzeModule = () => ({ imports: [] });');
    put(root, 'scripts/asset-audit.cjs', "require('node:fs').appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(1))+'\\n');");
    put(root, 'scripts/workflow.mjs', "import {appendFileSync} from 'node:fs'; appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(1))+'\\n');");
    put(root, 'docs/README.md', '# fixture\n');
    put(root, 'package.json', '{"type":"module"}');
    const env = { ...process.env }; delete env.GATE_RECEIPT;
    const gate = path.join(root, 'scripts/acceptance-gate.mjs');
    const planned = spawnSync(process.execPath, [gate, '--paths', 'docs/README.md', '--plan'], { cwd: root, encoding: 'utf8', env });
    expect(planned.status).toBe(0);
    expect(planned.stdout).not.toContain('文档一致性守卫');
    expect(existsSync(path.join(root, 'calls.jsonl'))).toBe(false);
    const run = spawnSync(process.execPath, [gate, '--paths', 'docs/README.md', '--run'], { cwd: root, encoding: 'utf8', env });
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('文档一致性守卫');
    expect(run.stdout).not.toContain('PASS');
    const calls = readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(calls.map(args => path.basename(args[0]))).toEqual(['asset-audit.cjs', 'workflow.mjs']);
    expect(calls[0].slice(1)).toEqual(['--check', '--paths-json', '["docs/README.md"]']);
    expect(calls[1].slice(1)).toEqual(['docs']);
  });
  it('显式full不依赖某路径映射；fixture完整执行包含编译、静态步骤和无定向参数的套件', () => {
    const root = createRoot();
    for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs']) {
      put(root, 'scripts/' + name, readFileSync(path.resolve('scripts', name), 'utf8'));
    }
    put(root, 'scripts/architecture-graph.mjs', 'export const analyzeModule = () => ({ imports: [] });');
    const calls = 'calls.jsonl';
    const stub = "import {appendFileSync} from 'node:fs'; appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(1))+'\\n');";
    for (const file of ['scripts/compile-narrative.mjs', 'scripts/check-syntax.mjs', 'scripts/validate-data.mjs', 'scripts/check-types.mjs',
      'node_modules/eslint/bin/eslint.js', 'node_modules/vitest/vitest.mjs']) put(root, file, stub);
    put(root, 'scripts/asset-audit.cjs', "require('node:fs').appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(1))+'\\n');");
    put(root, 'package.json', '{"type":"module"}');
    const env = { ...process.env }; delete env.GATE_RECEIPT;
    const plan = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--full', '--plan', '--json'], { cwd: root, encoding: 'utf8', env });
    expect(plan.status).toBe(0);
    expect(JSON.parse(plan.stdout)).toMatchObject({ mode: 'full', paths: [], tests: [] });
    const run = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--full', '--run'], { cwd: root, encoding: 'utf8', env });
    expect(run.status).toBe(0);
    const executed = readFileSync(path.join(root, calls), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    expect(executed).toHaveLength(7);
    expect(executed.some(command => command[0].endsWith('compile-narrative.mjs'))).toBe(true);
    const vitest = executed.find(command => command[0].endsWith('vitest.mjs'));
    expect(vitest.slice(1)).toEqual(['run', '--silent']);
    expect(run.stdout).toContain('PASS：full');
    const mixed = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--full', '--paths', 'scripts/acceptance-gate.mjs', '--plan'], { cwd: root, encoding: 'utf8', env });
    expect(mixed.status).not.toBe(0);
    expect(mixed.stderr).toContain('不能与');
  });
  it.each(['scripts/check-syntax.mjs', 'scripts/validate-data.mjs', 'scripts/check-types.mjs',
    'node_modules/eslint/bin/eslint.js'])('正常CLI中%s失败不漏跑其他静态检查、不运行后续步骤', failing => {
    const root = createRoot();
    for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs']) {
      put(root, 'scripts/' + name, readFileSync(path.resolve('scripts', name), 'utf8'));
    }
    put(root, 'scripts/architecture-graph.mjs', 'export const analyzeModule = () => ({ imports: [] });');
    put(root, 'package.json', '{"type":"module"}');
    const checks = ['scripts/check-syntax.mjs', 'scripts/validate-data.mjs', 'scripts/check-types.mjs',
      'node_modules/eslint/bin/eslint.js'];
    for (const file of ['scripts/compile-narrative.mjs', ...checks, 'node_modules/vitest/vitest.mjs']) {
      put(root, file, `import {appendFileSync} from 'node:fs';
        appendFileSync('calls.jsonl', JSON.stringify(${JSON.stringify(file)})+'\\n');
        ${file === failing ? 'process.exitCode = 23;' : ''}`);
    }
    put(root, 'scripts/asset-audit.cjs', "require('node:fs').appendFileSync('calls.jsonl', '\"asset-audit\"\\n');");
    const env = { ...process.env }; delete env.GATE_RECEIPT;
    // Unknown options/variables must not become an injection channel. These are
    // intentionally ignored by the existing parser, never consumed as overrides.
    env.GATE_STATIC_RESULTS = '[{"ok":true}]';
    env.GATE_STATIC_CHECKER = 'fake-success.mjs';
    const run = spawnSync(process.execPath, [path.join(root, 'scripts/acceptance-gate.mjs'), '--full', '--run',
      '--static-checker=fake-success.mjs', '--static-results=success'], { cwd: root, encoding: 'utf8', env });
    expect(run.status).toBe(1);
    expect(run.stdout).toContain('"code":23,"signal":null');
    expect(run.stdout).not.toContain('PASS：');
    const calls = readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(calls).toHaveLength(5);
    expect(calls[0]).toBe('scripts/compile-narrative.mjs');
    expect(new Set(calls.slice(1))).toEqual(new Set(checks));
    expect(calls.slice(3)).toEqual(['scripts/check-types.mjs', 'node_modules/eslint/bin/eslint.js']);
    expect(calls).not.toContain('node_modules/vitest/vitest.mjs');
    expect(calls).not.toContain('asset-audit');
  });
  it('同一输入在两份root按各自真实依赖图选择，root缺失不能隐式读cwd', () => {
    const first = createRoot(), second = createRoot();
    for (const [root, name] of [[first, 'first'], [second, 'second']]) {
      put(root, 'game/src/local.js', 'export const local = 1;');
      put(root, `tests/${name}.test.js`, "import { local } from '../game/src/local.js';");
      mkdirSync(path.join(root, 'game/data'), { recursive: true });
    }
    expect(selectPlan(['game/src/local.js'], { root: first }).tests).toContain('tests/first.test.js');
    expect(selectPlan(['game/src/local.js'], { root: first }).tests).not.toContain('tests/second.test.js');
    expect(selectPlan(['game/src/local.js'], { root: second }).tests).toContain('tests/second.test.js');
    expect(reverseImports(first).reverse.get('game/src/local.js')).toEqual(new Set(['tests/first.test.js']));
    expect(() => selectPlan(['tests/first.test.js'])).toThrow('显式');
    expect(() => reverseImports()).toThrow('显式');
  });
  it('测试helper透明连接直接测试且循环不会遗漏或无限遍历', () => {
    const root = createRoot();
    put(root, 'game/src/local.js', 'export const local = 1;');
    put(root, 'tests/helpers/first.js', "import '../../game/src/local.js'; import './second.js';");
    put(root, 'tests/helpers/second.js', "import './first.js';");
    mkdirSync(path.join(root, 'game/data'), { recursive: true });
    for (let i = 0; i < 13; i++) put(root, `tests/helper-${i}.test.js`, "import './helpers/second.js';");
    const plan = selectPlan(['game/src/local.js'], { root });
    expect(plan.mode).toBe('quick');
    for (let i = 0; i < 13; i++) expect(plan.tests).toContain(`tests/helper-${i}.test.js`);
  });
  it('兼容导出从其他cwd导入仍定位模块项目，保持定向选择', () => {
    const root = createRoot();
    const url = pathToFileURL(path.resolve('scripts/acceptance-gate.mjs')).href;
    const code = `import { planForPaths } from ${JSON.stringify(url)}; console.log(JSON.stringify(planForPaths(['tests/battle-hand-selection-rules.test.js'])));`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ mode: 'quick', tests: ['tests/battle-hand-selection-rules.test.js'] });
  });
  it('handoff/status与属地解析只用轻依赖，receipt/planner/runner全部缺失也能导入', () => {
    const root = createRoot();
    mkdirSync(path.join(root, 'scripts'));
    for (const name of ['workflow-status.mjs', 'workflow-ledger.mjs', 'workflow-memory.mjs', 'registry-paths.mjs']) {
      copyFileSync(path.resolve('scripts', name), path.join(root, 'scripts', name));
    }
    const url = pathToFileURL(path.join(root, 'scripts/workflow-status.mjs')).href;
    const code = `import { handoff } from ${JSON.stringify(url)}; console.log(typeof handoff);`;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('function');
  });
});

// Test-only harness: evaluate the exact private collector/scheduler source without
// adding production exports, checker overrides, environment switches or CLI flags.
describe('静态检查原生结果与调度边界', () => {
  const source = readFileSync(path.resolve('scripts/acceptance-gate.mjs'), 'utf8');
  const start = source.indexOf('function runNodeCaptured(');
  const end = source.indexOf('\nfunction printPlan(', start);
  const load = (spawnChild, root = process.cwd()) => {
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    let output = '';
    const api = runInNewContext(source.slice(start, end) + '\n({ runNodeCaptured, runStaticChecks })', {
      spawn: spawnChild, PROJECT_ROOT: root,
      process: { execPath: process.execPath, stdout: { write: text => { output += text; } } },
    });
    return { ...api, output: () => output };
  };
  const child = () => Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(), stderr: new EventEmitter(),
  });
  it('等待close保留error之后的所有输出、原始error和终止字段', async () => {
    const processChild = child();
    const api = load(() => processChild);
    const pending = api.runNodeCaptured([], 'fixture');
    const error = Object.assign(new Error('spawn fixture ENOENT'), { code: 'ENOENT' });
    processChild.stdout.emit('data', Buffer.from('before\n'));
    processChild.emit('error', error);
    processChild.stderr.emit('data', Buffer.from('after\n'));
    processChild.emit('close', -2, null);
    const result = await pending;
    expect(result).toMatchObject({ ok: false, code: -2, signal: null, output: 'before\nafter\n' });
    expect(result.error).toBe(error);
  });
  it.each([[0, null, true], [7, null, false], [null, 'SIGTERM', false]])(
    '退出结果code=%s signal=%s不改变成功条件', async (code, signal, ok) => {
      const processChild = child();
      const pending = load(() => processChild).runNodeCaptured([], 'fixture');
      processChild.emit('close', code, signal);
      expect(await pending).toMatchObject({ ok, code, signal, error: null, output: '' });
    },
  );
  it('捕获真实spawn错误而不是把缺失cwd当作成功', async () => {
    const missing = path.join(os.tmpdir(), 'sdt-absent-' + process.pid + '-' + Date.now(), 'missing');
    const result = await load(spawn, missing).runNodeCaptured(['--version'], 'missing cwd');
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe('ENOENT');
    expect(result.code).not.toBe(0);
    expect(result.signal).toBe(null);
  });
  it('同步spawn异常也保留原生对象', async () => {
    const error = new TypeError('fixture spawn argument failure');
    const result = await load(() => { throw error; }).runNodeCaptured([], 'fixture');
    expect(result).toMatchObject({ ok: false, code: null, signal: null, output: '' });
    expect(result.error).toBe(error);
  });
  it.each(['throw', 'error'])('首项%s失败仍尝试全部四项', async mode => {
    const calls = [];
    const failure = Object.assign(new Error('native spawn failure'), { code: 'ENOENT' });
    const api = load((_node, args) => {
      calls.push(args[0]);
      if (calls.length === 1 && mode === 'throw') throw failure;
      const proc = child(), first = calls.length === 1;
      queueMicrotask(() => {
        if (first) proc.emit('error', failure);
        proc.emit('close', first ? -2 : 0, null);
      });
      return proc;
    });
    await expect(api.runStaticChecks()).rejects.toThrow('语法检查 失败');
    expect(calls).toEqual(['scripts/check-syntax.mjs', 'scripts/validate-data.mjs',
      'scripts/check-types.mjs', 'node_modules/eslint/bin/eslint.js']);
    expect(api.output()).toContain('"message":"native spawn failure","code":"ENOENT"');
  });
  it('并发轻检查完成后才运行重检查；失败仍尝试全部且完整打印诊断', async () => {
    const running = new Map(), calls = [], ended = [];
    const api = load((_node, args) => {
      const name = args[0];
      calls.push([...args]);
      if (name === 'scripts/check-types.mjs') expect(ended).toEqual(['syntax', 'data']);
      if (name.includes('eslint')) expect(ended).toEqual(['syntax', 'data', 'type']);
      const proc = child(); running.set(name, proc);
      return proc;
    });
    const pending = api.runStaticChecks();
    // Attach rejection handler before driving errors (no unhandled rejection).
    const failed = expect(pending).rejects.toThrow('语法检查、内容数据检查、类型契约检查、ESLint 失败');
    expect(calls.map(args => args[0])).toEqual(['scripts/check-syntax.mjs', 'scripts/validate-data.mjs']);
    const syntax = running.get('scripts/check-syntax.mjs');
    syntax.stdout.emit('data', Buffer.from('syntax out\n'));
    syntax.stderr.emit('data', Buffer.from('syntax err\n'));
    ended.push('syntax'); syntax.emit('close', 7, null);
    await Promise.resolve(); expect(calls).toHaveLength(2);
    const data = running.get('scripts/validate-data.mjs');
    data.stdout.emit('data', Buffer.from(' \n'));
    ended.push('data'); data.emit('close', 8, null);
    // Promise.all and its awaiting scheduler each have a microtask continuation.
    await Promise.resolve(); await Promise.resolve();
    expect(calls).toHaveLength(3);
    const types = running.get('scripts/check-types.mjs');
    ended.push('type'); types.emit('close', null, 'SIGTERM');
    await Promise.resolve();
    expect(calls).toHaveLength(4);
    const lint = running.get('node_modules/eslint/bin/eslint.js');
    const error = Object.assign(new Error('native failure'), { code: 'ENOENT', syscall: 'spawn node' });
    lint.emit('error', error); lint.stderr.emit('data', Buffer.from('late stderr\n'));
    lint.emit('close', -2, null);
    await failed;
    expect(calls).toEqual([
      ['scripts/check-syntax.mjs'], ['scripts/validate-data.mjs'], ['scripts/check-types.mjs'],
      ['node_modules/eslint/bin/eslint.js', 'game/src', 'tests', 'scripts', 'game/tools', '*config.{js,mjs,cjs}',
        '--cache', '--cache-location', 'node_modules/.cache/eslint/.eslintcache'],
    ]);
    expect(api.output()).toContain('syntax out\nsyntax err\n');
    expect(api.output()).toContain(' \n\n');
    expect(api.output()).toContain('late stderr\n');
    expect(api.output()).toContain('"code":7,"signal":null');
    expect(api.output()).toContain('"code":null,"signal":"SIGTERM"');
    expect(api.output()).toContain('"message":"native failure","code":"ENOENT"');
    expect(api.output()).not.toContain('：OK');
  });
});
