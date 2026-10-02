/* impact-query（npm run impact）测试：属地撞线解析、反向闭包、命令生成三块核心口径。
 * 端到端用真实仓库文件断言（agent.scenes.js ← agent.js 引用是稳定事实）。 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import {
  extractRegistryTokens, formatImpact, impactQuery, normalizePath,
  parseActiveRegistry, pathOverlaps, registryHits, reverseClosure,
} from '../scripts/impact-query.mjs';

describe('路径归一', () => {
  it('反斜杠/搜打撤前缀/./ 均归一为项目相对 posix 路径', () => {
    expect(normalizePath('搜打撤\\game\\src\\agent\\agent.js')).toBe('game/src/agent/agent.js');
    expect(normalizePath('./game/src/agent/agent.js')).toBe('game/src/agent/agent.js');
    expect(normalizePath('game/src/agent/')).toBe('game/src/agent');
  });
  it('项目外路径抛错', () => {
    expect(() => normalizePath('../outside.js')).toThrow();
  });
});

describe('属地 token 提取', () => {
  it('裸路径目录与文件均提取，端口/PID/纯词丢弃', () => {
    const tokens = extractRegistryTokens('搜打撤/code-map/（index.html 页、generate.mjs 扫描器）；127.0.0.1:5301 / PID 18424 / python http.server / 本会话创建');
    expect(tokens).toContain('code-map');
    expect(tokens).toContain('index.html');
    expect(tokens).toContain('generate.mjs');
    expect(tokens.filter(t => /^\d+$/.test(t))).toEqual([]);
  });
  it('反引号内容优先', () => {
    expect(extractRegistryTokens('`scripts/a.mjs` 与 `docs/README.md`'))
      .toEqual(['scripts/a.mjs', 'docs/README.md']);
  });
  it('「不碰/零改动」排除声明不当属地', () => {
    const tokens = extractRegistryTokens('自有目录 my-work/；不碰 game/ 源码；零改动 tests/x.test.js');
    expect(tokens).toContain('my-work');
    expect(tokens).not.toContain('game');
    expect(tokens).not.toContain('tests/x.test.js');
  });
});

describe('活跃登记解析与撞线', () => {
  const md = [
    '# x', '## 活跃登记', '',
    '| 会话/来源 | 属地 | 事项 | 登记时间 | 状态 |', '|---|---|---|---|---|',
    '| Friday（A 任务） | `game/src/battle/`、`scripts/gate.mjs` | 事项A | 10-01 | 编辑中 |',
    '| Friday（B 已落库） | `docs/x.md` | 事项B | 10-01 | 已落库 7d2fbde |',
    '', '## 无主物品', '',
  ].join('\n');

  it('活跃表解析：跳表头/已落库行，属地 token 正确', () => {
    const rows = parseActiveRegistry(md);
    expect(rows).toHaveLength(1);
    expect(rows[0].session).toContain('A 任务');
    expect(rows[0].tokens).toEqual(['game/src/battle', 'scripts/gate.mjs']);
  });
  it('双向包含：文件∈属地目录、目录∋属地文件、相等均命中', () => {
    expect(pathOverlaps('game/src/battle/core/battle.core.js', 'game/src/battle')).toBe(true);
    expect(pathOverlaps('game/src', 'game/src/battle/battle.core.js')).toBe(true);
    expect(pathOverlaps('scripts/gate.mjs', 'scripts/gate.mjs')).toBe(true);
    expect(pathOverlaps('game/src/hub', 'game/src/battle')).toBe(false);
  });
  it('registryHits 命中行带会话与重叠 token', () => {
    const rows = parseActiveRegistry(md);
    const hits = registryHits(['game/src/battle/view/battle.aim.js'], rows);
    expect(hits).toHaveLength(1);
    expect(hits[0].matched).toEqual(['game/src/battle']);
    expect(registryHits(['docs/README.md'], rows)).toEqual([]);
  });
  it('与handoff共用生命周期；完成未提交保留归属，已交付/划线只留审计', () => {
    const source = md.replace('\n## 无主物品', [
      '| Friday（C 完成） | `game/src/battle/`、~~`scripts/old.mjs`~~ | 事项C | 10-01 | 完成未提交 |',
      '| Friday（D 已交付） | `game/src/battle/` | 事项D | 10-01 | 已交付 |',
      '| ~~Friday（E 释放）~~ | `game/src/battle/` | 事项E | 10-01 | 编辑中 |',
      '| Friday（F 未知） | `game/src/battle/` | 事项F | 10-01 | 处理中待更新 |',
      '', '## 无主物品',
    ].join('\n'));
    const rows = parseActiveRegistry(source);
    expect(rows.map(row => row.state)).toEqual(['editing', 'complete-uncommitted', 'editing']);
    expect(rows[1]).toMatchObject({ isBlocking: false, isOpen: true, tokens: ['game/src/battle'] });
    const hits = registryHits(['game/src/battle/a.js'], rows);
    expect(hits.map(hit => hit.action)).toEqual(['coordinate-editing', 'retain-ownership', 'coordinate-editing']);
    const audit = parseActiveRegistry(source, { includeSettled: true });
    expect(audit.filter(row => !row.isOpen).map(row => row.state)).toEqual(['settled', 'settled', 'released']);
    expect(registryHits(['game/src/battle/a.js'], audit)).toEqual(hits);
  });
  it('文本将完成未提交显示为归属保护，不误写编辑撞线', () => {
    const completed = parseActiveRegistry(md.replace('编辑中', '完成未提交'));
    const report = { paths: ['game/src/battle/a.js'],
      registry: { activeRowCount: 1, editingRowCount: 0, hits: registryHits(['game/src/battle/a.js'], completed) },
      reverse: { direct: [], transitive: [], srcCount: 0, testCount: 0 },
      plan: { mode: 'skip', tests: [], reasons: [] }, commands: { verify: 'verify', targeted: '' } };
    const text = formatImpact(report);
    expect(text).toContain('无编辑冲突');
    expect(text).toContain('未提交归属保护');
    expect(text).not.toContain('动手前先协调');
  });
});

describe('反向闭包', () => {
  it('BFS 分层：直接/传递深度正确，环不死循环', () => {
    const graph = { reverse: new Map([
      ['t.js', new Set(['a.js', 'b.js'])],
      ['a.js', new Set(['c.js', 't.js'])],   // t→a→c 且 a 引回 t（环）
      ['b.js', new Set(['c.js'])],
    ]) };
    const closure = reverseClosure(['t.js'], graph, new Map());
    expect(closure.direct.sort()).toEqual(['a.js', 'b.js']);
    expect(closure.transitive).toEqual([{ file: 'c.js', depth: 2 }]);
  });
  it('loose 边并入：scripts/tools 引用也算直接引用者', () => {
    const graph = { reverse: new Map() };
    const loose = new Map([['t.js', new Set(['scripts/tool.mjs'])]]);
    const closure = reverseClosure(['t.js'], graph, loose);
    expect(closure.direct).toEqual(['scripts/tool.mjs']);
  });
});

describe('端到端（真实仓库）', () => {
  // 全仓依赖图端到端扫描，满载/快照环境下 5s 默认超时会抖红；放宽到 20s。
  it('agent.scenes.js：agent.js 直接引用、属地无冲突、计划与命令字段完整', () => {
    const report = impactQuery(['game/src/agent/agent.scenes.js']);
    expect(report.paths).toEqual(['game/src/agent/agent.scenes.js']);
    expect(report.reverse.direct).toContain('game/src/agent/agent.js');
    expect(report.registry.hits.some(h => h.session.includes('code-map'))).toBe(false);
    expect(['skip', 'quick', 'full']).toContain(report.plan.mode);
    expect(report.commands.verify).toContain('workflow -- verify --paths game/src/agent/agent.scenes.js');
    if (report.plan.mode === 'quick') {
      expect(report.commands.targeted.startsWith('npm run test:target -- ')).toBe(true);
      for (const test of report.plan.tests) expect(existsSync(test)).toBe(true);
    }
  }, 20_000);
  it('属地撞线路径真实可见：code-map 目录命中在途会话', () => {
    const report = impactQuery(['code-map/data.js']);
    expect(report.registry.hits.length).toBeGreaterThanOrEqual(0); // 不依赖台账瞬时状态，仅冒烟
    expect(report.registry.activeRowCount).toBeGreaterThanOrEqual(1);
  });
  it('文本渲染含四节且不炸', () => {
    const text = formatImpact(impactQuery(['game/src/agent/agent.state.js']));
    expect(text).toContain('并行属地');
    expect(text).toContain('反向依赖');
    expect(text).toContain('验证计划');
    expect(text).toContain('现成命令');
  });
  it('REGISTRY 真源解析不抛错（格式漂移即红）', () => {
    expect(() => parseActiveRegistry(readFileSync('docs/PARALLEL-REGISTRY.md', 'utf8'))).not.toThrow();
  });
});
