import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverMemory, hasProjectPath, searchMemory } from '../scripts/workflow-memory.mjs';

const temporaryRoots = [];
function fixture() {
  const home = mkdtempSync(path.join(os.tmpdir(), 'sdt-memory-test-'));
  temporaryRoots.push(home);
  return home;
}
function put(file, text) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text);
  return file;
}
function project(home, name, text) {
  return put(path.join(home, '.zcode/cli/memories/projects', name, 'memory/MEMORY.md'), text);
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'sdt-memory-test-'))) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('只读动态记忆入口', () => {
  it('真实CLI转发query与limit，非法参数不退回全量discover', () => {
    const home = fixture();
    const repo = path.resolve(process.cwd(), '..');
    put(path.join(home, '.codex/memories/memory_summary.md'), `项目 ${repo}`);
    put(path.join(home, '.codex/memories/MEMORY.md'), `# topic\ncwd=${repo}\nworkflow receipt\n`);
    const args = ['scripts/workflow.mjs', 'memory', '--home', home, '--query', 'workflow receipt', '--limit', '1', '--json'];
    const result = JSON.parse(execFileSync(process.execPath, args, { encoding: 'utf8' }));
    expect(result).toMatchObject({ status: 'matched', source: 'codex', limit: 1 });
    expect(result.matches).toHaveLength(1);
    expect(() => execFileSync(process.execPath, ['scripts/workflow.mjs', 'memory', '--limit', '1', '--json'], { stdio: 'pipe' })).toThrow();
  });
  it('显式query按仓库与全部关键词过滤，带来源行号且不执行引用内容', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    put(path.join(home, '.codex/memories/memory_summary.md'), `项目 ${repo}`);
    const source = put(path.join(home, '.codex/memories/MEMORY.md'),
      `# Task Group: workflow\ncwd=${repo}\n\n## Knowledge\nworkflow task 小修免登记历史建议\n[topic](secret.md)\n\n# Task Group: neighbour\ncwd=${repo}2\nworkflow task 不相关\n\n# Task Group: one-term\ncwd=${repo}\nworkflow only\n`);
    put(path.join(home, '.codex/memories/secret.md'), '不允许自动读入的引用正文');
    const before = readFileSync(source, 'utf8');
    mkdirSync(path.join(home, '.zcode/cli/memories/projects/unrelated-bad/memory/MEMORY.md'), { recursive: true });
    const result = searchMemory(repo, { home, query: 'workflow task' });
    expect(result.status).toBe('matched');
    expect(result.warnings).toEqual([]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ source, startLine: 1, title: 'Task Group: workflow' });
    expect(result.matches[0].excerpt).toContain('5: workflow task');
    expect(JSON.stringify(result)).not.toContain('不相关');
    expect(JSON.stringify(result)).not.toContain('不允许自动读入的引用正文');
    expect(readFileSync(source, 'utf8')).toBe(before);
  });
  it('索引无当前仓库时不从正文猜测身份；query和limit失败必须显式返回', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    put(path.join(home, '.codex/memories/memory_summary.md'), '# unrelated');
    put(path.join(home, '.codex/memories/MEMORY.md'), `# secret\ncwd=${repo}\nworkflow`);
    expect(searchMemory(repo, { home, query: 'workflow' }).status).toBe('project-not-indexed');
    for (const limit of [0, 11, 1.5, 'bad']) expect(() => searchMemory(repo, { home, query: 'workflow', limit })).toThrow();
    expect(() => searchMemory(repo, { home, query: '  ' })).toThrow();
    expect(() => searchMemory(repo, { home, query: 'x'.repeat(201) })).toThrow();
  });
  it('匹配数与输出有界，正文截断导致缺失命中时不宣称全库无结果', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    put(path.join(home, '.codex/memories/memory_summary.md'), `cwd=${repo}`);
    const source = put(path.join(home, '.codex/memories/MEMORY.md'), Array.from({ length: 5 }, (_, i) =>
      `# topic${i}\ncwd=${repo}\nworkflow ${'x'.repeat(1800)}`).join('\n'));
    const result = searchMemory(repo, { home, query: 'workflow', limit: 2 });
    expect(result.matches).toHaveLength(2);
    expect(result.totalMatchedTopics).toBe(5);
    expect(result.moreMatches).toBe(true);
    expect(result.matches.every(hit => hit.excerpt.length <= 1600 && hit.excerptTruncated)).toBe(true);
    writeFileSync(source, '# topic\ncwd=' + repo + '\n' + 'x'.repeat(530000) + '\nneedle');
    expect(searchMemory(repo, { home, query: 'needle' })).toMatchObject({ status: 'incomplete', truncated: true, matches: [] });
  });
  it('真实知识优先于历史索引和关键词堆砌，query不只返回战报入口', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    put(path.join(home, '.codex/memories/memory_summary.md'), `cwd=${repo}`);
    put(path.join(home, '.codex/memories/MEMORY.md'), `# Task Group: workflow\ncwd=${repo}\n` +
      '## Task 1: history\n### keywords\nworkflow task\n' + 'rollout_metadata\n'.repeat(30) +
      '## Reusable knowledge\n- task 小改不建任务，只有跨会话需要时才建\n');
    const result = searchMemory(repo, { home, query: 'workflow task', limit: 1 });
    expect(result.matches[0].excerpt).toContain('小改不建任务');
  });
  it('换机从 USERPROFILE 发现，不依赖固定用户与 project 哈希', () => {
    const home = fixture();
    const repo = path.join(home, '新的中文用户', '代号柒');
    const summary = put(path.join(home, '.codex/memories/memory_summary.md'), `项目 ${repo}`);
    put(path.join(home, '.codex/memories/MEMORY.md'), '不应该返回的历史正文');
    const memory = project(home, 'project-new-hash', `项目路径：\`${repo}\``);
    const result = discoverMemory(repo, { env: { USERPROFILE: home } });
    expect(result.codex.summaryPath).toBe(summary);
    expect(result.codex.projectEvidence).toHaveLength(1);
    expect(result.zcode.selected).toBe(memory);
    expect(JSON.stringify(result)).not.toContain('不应该返回的历史正文');
    expect(readFileSync(memory, 'utf8')).toBe(`项目路径：\`${repo}\``);
  });
  it('显式 home 优先，而 CODEX_HOME 可独立配置', () => {
    const home = fixture();
    const custom = path.join(home, 'portable-codex');
    put(path.join(custom, 'memories/memory_summary.md'), '# 索引');
    const result = discoverMemory(home, { env: { USERPROFILE: home, CODEX_HOME: custom } });
    expect(result.codex.home).toBe(custom);
    const explicit = discoverMemory(home, { home, env: { USERPROFILE: 'wrong', CODEX_HOME: custom } });
    expect(explicit.codex.home).toBe(path.join(home, '.codex'));
    expect(discoverMemory(home, { home, codexHome: custom }).codex.summaryAvailable).toBe(true);
  });
  it('完整路径边界排除邻居项目；Windows 路径大小写和分隔符可匹配', () => {
    expect(hasProjectPath('`D:\\素材\\代号柒2\\搜打撤`', 'D:\\素材\\代号柒')).toBe(false);
    expect(hasProjectPath('`D:\\素材\\代号柒-old`', 'D:\\素材\\代号柒')).toBe(false);
    expect(hasProjectPath('`d:/素材/代号柒/搜打撤/docs/README.md`', 'D:\\素材\\代号柒')).toBe(true);
    expect(hasProjectPath('代号柒、搜打撤', 'D:\\素材\\代号柒')).toBe(false);
  });
  it('两个精确匹配不猜测最新 hash，不自动选中', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    project(home, 'project-old', `cwd=${repo}`);
    project(home, 'project-new', `cwd=${repo}`);
    const result = discoverMemory(repo, { home });
    expect(result.zcode.status).toBe('ambiguous');
    expect(result.zcode.matched).toHaveLength(2);
    expect(result.zcode.selected).toBeNull();
    expect(result.zcode.needsConfirmation).toBe(true);
  });
  it('无精确匹配返回候选原因，旧迁移库不能误判成当前库', () => {
    const home = fixture();
    const repo = path.join(home, '代号柒');
    project(home, 'project-other', `cwd=${repo}2`);
    put(path.join(home, '.zcode/memories/MEMORY.md'), `cwd=${repo}`);
    const result = discoverMemory(repo, { home });
    expect(result.zcode.status).toBe('not-found');
    expect(result.zcode.candidates[0].matched).toBe(false);
    expect(result.historicalOnly).toMatchObject({ exists: true, usableAsCurrent: false });
    expect(result.zcode.selected).toBeNull();
  });
  it('项目 JSON 仅识别白名单完整路径字段，名称不能冒充项目身份', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    const memory = project(home, 'arbitrary-name', '# 无路径索引');
    put(path.join(path.dirname(path.dirname(memory)), 'metadata.json'), JSON.stringify({ name: repo, cwd: repo }));
    const result = discoverMemory(repo, { home });
    expect(result.zcode.status).toBe('matched');
    expect(result.zcode.matched[0].evidence).toEqual([expect.objectContaining({ type: 'metadata-repository-path', key: 'cwd' })]);
  });
  it('从游戏子目录向上找仓库，索引只读16KB且不读取引用正文', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    mkdirSync(path.join(repo, '.git'), { recursive: true });
    mkdirSync(path.join(repo, '搜打撤'), { recursive: true });
    const memory = project(home, 'project-bounded', '# 索引\n[topic](topic.md)\n' + 'x'.repeat(17000) + ` cwd=${repo}`);
    put(path.join(path.dirname(memory), 'topic.md'), `cwd=${repo}\n正文秘密`);
    const result = discoverMemory(path.join(repo, '搜打撤'), { home });
    expect(result.repositoryRoot).toBe(repo);
    expect(result.zcode.status).toBe('review-required');
    expect(result.zcode.candidates[0].indexTruncated).toBe(true);
    expect(result.zcode.selected).toBeNull();
    expect(JSON.stringify(result)).not.toContain('正文秘密');
  });
  it('存在不可读项目索引时不能宣称其他唯一命中已唯一确认', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    project(home, 'project-good', `cwd=${repo}`);
    mkdirSync(path.join(home, '.zcode/cli/memories/projects/project-bad/memory/MEMORY.md'), { recursive: true });
    const result = discoverMemory(repo, { home });
    expect(result.zcode.status).toBe('review-required');
    expect(result.zcode.selected).toBeNull();
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: 'skipped-project-index' }));
  });
  it('超过目录上限时不把已见的唯一命中当作唯一库', () => {
    const home = fixture();
    const repo = path.join(home, 'repo');
    for (let index = 0; index < 101; index++) project(home, `project-${String(index).padStart(3, '0')}`, index === 0 ? `cwd=${repo}` : '# 索引');
    const result = discoverMemory(repo, { home });
    expect(result.zcode.status).toBe('review-required');
    expect(result.zcode.scannedDirectories).toBe(100);
    expect(result.zcode.selected).toBeNull();
  });
});
