import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const knownRules = new Set(['../AGENTS.md', 'AGENTS.md', 'docs/README.md', 'docs/quality-gates.md', 'docs/SPEC-PROCESS.md', 'docs/WORKFLOW-TOOLS.md',
  'docs/production/engineering/MAKER-HANDBOOK.md', 'docs/production/qa/ACCEPTANCE-MATRIX.md']);

// 口径真源表（10-02 方向②）：每个口径一个权威文件；signature 取「完整表述特有」的短语，
// 指针式引用（见某文档）天然不命中。真源外命中只作 review 候选——收敛为指针或确认为有语境的复述，不阻断。
const RULE_AUTHORITIES = [
  { topic: '内置浏览器边界', home: ['../AGENTS.md', 'AGENTS.md'],
    signature: /(?:仅|只)[^。；]{0,6}内置浏览器|内置浏览器[^。；]{0,30}(?:Edge|CDP|headless)|(?:不用|不换|禁用)[^。；]{0,10}(?:Edge|CDP|headless)/ },
  { topic: '验收分级与质量门', home: ['docs/quality-gates.md'], signature: /A 档|B 档|验收分级/ },
  { topic: '提交授权', home: ['../AGENTS.md', 'AGENTS.md'], signature: /不自动提交|打包提交默认/ },
  { topic: '删除与回滚报批', home: ['../AGENTS.md', 'AGENTS.md'],
    signature: /删除[^。；]{0,30}(?:先列|报批|获同意)|回滚[^。；]{0,12}(?:须|需)授权/ },
  { topic: '登记与销账', home: ['../AGENTS.md', 'AGENTS.md', 'docs/PARALLEL-REGISTRY.md'], signature: /动作先行|同轮紧随/ },
  { topic: '端口约定', home: ['../AGENTS.md', 'AGENTS.md', 'docs/PARALLEL-REGISTRY.md'], signature: /53xx|8139/ },
  { topic: '冻结引擎', home: ['../AGENTS.md', 'AGENTS.md'],
    signature: /(?:Godot|Unity|EXE)[^。；]{0,15}冻结|冻结[^。；]{0,15}(?:Godot|Unity|EXE)/ },
  { topic: '验收证据目录', home: ['../AGENTS.md', 'AGENTS.md'], signature: /验收证据[^。；]{0,25}evidence|evidence[^。；]{0,25}验收证据/ },
];

function scopedDocuments(root) {
  const files = [];
  const visit = directory => {
    if (!existsSync(path.join(root, directory))) return;
    for (const entry of readdirSync(path.join(root, directory), { withFileTypes: true })) {
      if (entry.isSymbolicLink() || /^(?:archive|evidence|previews|modules)$/.test(entry.name)) continue;
      const relative = path.posix.join(directory, entry.name);
      if (entry.isDirectory()) visit(relative);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(relative);
    }
  };
  if (existsSync(path.join(root, 'docs'))) for (const entry of readdirSync(path.join(root, 'docs'), { withFileTypes: true })) {
    if (entry.isFile() && !entry.isSymbolicLink() && entry.name.endsWith('.md')) files.push('docs/' + entry.name);
  }
  visit('docs/production');
  for (const file of ['README.md', 'AGENTS.md', '../AGENTS.md']) if (existsSync(path.join(root, file))) files.push(file);
  return [...new Set(files)].sort();
}

function visibleLines(text) {
  let fence = null;
  return text.split(/\r?\n/).map(line => {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = null;
      return '';
    }
    return fence ? '' : line.replace(/`[^`]*`/g, '');
  });
}

function links(line) {
  return [...line.matchAll(/!?\[[^\]]*\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+"[^"]*")?\s*\)/g)].map(match => match[1] ?? match[2]);
}

/** Bounded mechanical review; findings are candidates, never automatic archive/delete decisions. */
export function validateDocumentation(root) {
  root = path.resolve(root);
  if (!existsSync(path.join(root, 'docs'))) throw new Error('项目 docs 目录不可达，请核对 --root');
  const scannedFiles = scopedDocuments(root);
  const findings = [];
  const identical = new Map();
  let checkedRelativeLinks = 0;
  for (const file of scannedFiles) {
    const text = readFileSync(path.join(root, file), 'utf8');
    const digest = createHash('sha256').update(text).digest('hex');
    if (!identical.has(digest)) identical.set(digest, []);
    identical.get(digest).push(file);
    const explicitRule = knownRules.has(file) || /文档状态[：:]\s*现行(?:规范|规则|.*办法)/.test(text.slice(0, 2500));
    let historical = false;
    const lines = visibleLines(text);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (/^\s*#{1,6}\s/.test(line)) historical = /历史|归档|上一轮|已决|已释放|\b20\d{2}[-/]\d{2}[-/]\d{2}\b/.test(line);
      const authority = historical ? 'historical-section' : explicitRule ? 'current-rule' : 'unclassified-reference';
      for (const target of links(line)) {
        if (/^(?:[a-z][a-z\d+.-]*:|#|\/\/|\/)/i.test(target)) continue;
        const rawFile = target.split('#')[0].split('?')[0];
        if (!rawFile) continue;
        let linked;
        try { linked = decodeURIComponent(rawFile); }
        catch { findings.push({ file, line: index + 1, kind: 'invalid-link-encoding', authority, reason: '相对链接百分号编码不可解析', target, review: true }); continue; }
        checkedRelativeLinks++;
        if (!existsSync(path.resolve(root, path.dirname(file), linked))) findings.push({ file, line: index + 1,
          kind: 'missing-relative-link', authority, reason: '相对链接目标当前不可达；需核对路径或历史替代入口', target, review: true });
      }
      if (/不自动提交|禁止自动提交|不得自动提交|不构成.*提交|不再.*(?:三级|双提交)|不(?:要求|代表|意味着|表示)[^。；]*(?:双提交|自动提交)|旧.*不.*执行|原文.*留档/.test(line)) continue;
      const rules = [
        { kind: 'codex-only-browser', match: /(?:仅(?:用|使用)?|只(?:用|使用)?|到|在)\s*Codex\s*内置浏览器|浏览器[^。；]*仅[^。；]*Codex/, reason: '可能保留仅 Codex 的浏览器口径；现行规则要求当前平台内置浏览器' },
        { kind: 'fixed-full-acceptance', match: /三级验收|定向\s*(?:→|->)\s*全量\s*(?:→|->)\s*实页|每次[^。；]*全量|固定[^。；]*全量/, reason: '可能将分级质量门写成固定全套；需核对条件与引用上下文' },
        { kind: 'implicit-commit', match: /自动提交|双提交|完成后[^。；]*(?:提交|推送)|验收通过[^。；]*(?:提交|推送)/, reason: '可能含隐式提交步骤；提交授权须核对当前老板指示' },
      ];
      for (const rule of rules) {
        if (rule.kind === 'codex-only-browser' && /当前平台|Codex\s*(?:或|\/|和)\s*ZCode/.test(line)) continue;
        if (rule.match.test(line)) findings.push({ file, line: index + 1, kind: rule.kind, authority,
          reason: historical ? '历史日期段命中，仅提示来源核对，不判定现行冲突' : rule.reason, review: true });
      }
      // 口径真源检测：现行段的完整表述出现在真源外 → 收敛候选（历史段豁免，指针式不命中）
      if (!historical) for (const rule of RULE_AUTHORITIES) {
        if (rule.home.includes(file)) continue;
        if (rule.signature.test(line)) findings.push({ file, line: index + 1, kind: 'duplicated-rule', authority,
          reason: `「${rule.topic}」完整表述在真源（${rule.home[0]}）之外；收敛为指针或确认为有语境的复述`, topic: rule.topic, review: true });
      }
    }
  }
  for (const [sha256, files] of identical) if (files.length > 1) for (const file of files) findings.push({ file, line: 1,
    kind: 'identical-document', authority: 'unclassified-reference', reason: '同正文文档需确认各自职责与唯一维护处，不据此归档', matches: files.filter(other => other !== file), sha256, review: true });
  return { schemaVersion: 1, root, scannedFiles, checkedRelativeLinks, findings, reviewRequired: findings.length > 0,
    limits: ['只扫描 docs 根层、production、项目 README/AGENTS 与仓库 AGENTS', '跳过 archive/evidence/previews/modules 与代码块',
      '链接仅检查文件可达，不验证标题锚点、运行素材或外部网址', '模式命中只作人工复核候选，不证明全项目语义一致',
      '口径真源检测只提示收敛候选，不阻断也不自动改写', '无自动写入、移动、删除、提交'] };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  try {
    let root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    for (let index = 0; index < args.length; index++) {
      if (args[index] === '--json') continue;
      if (args[index] === '--root' && args[index + 1] && !args[index + 1].startsWith('--')) root = path.resolve(args[++index]);
      else throw new Error('仅支持 --json 与 --root <项目目录>');
    }
    const result = validateDocumentation(root);
    console.log(json ? JSON.stringify({ ok: true, ...result }) : `扫描 ${result.scannedFiles.length} 文件、${result.checkedRelativeLinks} 相对链接；${result.findings.length} 项待复核\n` + result.findings.map(item => `${item.file}:${item.line} [${item.kind}/${item.authority}] ${item.reason}`).join('\n'));
  } catch (error) {
    console[json ? 'log' : 'error'](json ? JSON.stringify({ ok: false, error: error.message }) : error.message);
    process.exitCode = 1;
  }
}
