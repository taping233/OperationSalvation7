#!/usr/bin/env node
// setup-commit-gate.mjs —— 一次性挂载「提交前全量测试门禁」（commit gate）。
//
// 用法（Git Bash 或 cmd 均可，在仓库任意位置执行）：
//     node 搜打撤/scripts/setup-commit-gate.mjs
// 卸载：
//     git config --unset core.hooksPath
//
// 做的事：
//     git config core.hooksPath  <本仓库绝对路径>/搜打撤/.githooks
//   用绝对路径是为了在仓库任意子目录提交、以及各临时 worktree 中都能命中钩子；
//   换了克隆目录 / 新机器需重新执行本脚本一次。钩子本体见
//   搜打撤/.githooks/pre-commit（触发口径、绕过口写在其头注释里）。
//
// 环境：仅依赖本机 node + git，无网络访问。

import { execFileSync } from 'node:child_process';
import { existsSync, chmodSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // <repo>/搜打撤/scripts
const hooksDir = resolve(here, '..', '.githooks'); // <repo>/搜打撤/.githooks
const hookFile = join(hooksDir, 'pre-commit');

if (!existsSync(hookFile)) {
  console.error(`[gate] FATAL: hook not found: ${hookFile}`);
  process.exit(1);
}

const top = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: here,
  encoding: 'utf8',
}).trim();
const hooksPathValue = hooksDir.replace(/\\/g, '/');
if (!hooksPathValue.replace(/\\/g, '/').startsWith(top.replace(/\\/g, '/'))) {
  console.error(`[gate] FATAL: hooks dir not inside repo: ${hooksPathValue} (top=${top})`);
  process.exit(1);
}

execFileSync('git', ['config', 'core.hooksPath', hooksPathValue], { stdio: 'inherit' });
try {
  chmodSync(hookFile, 0o755);
} catch {
  /* Windows 上无可执行位，忽略 */
}

const readBack = execFileSync('git', ['config', '--get', 'core.hooksPath'], {
  encoding: 'utf8',
}).trim();
console.log(`[gate] core.hooksPath -> ${readBack}`);
console.log('[gate] commit gate installed: pre-commit will run the full test suite');
console.log('[gate] when staged changes touch 搜打撤/game/src, 搜打撤/game/data or 搜打撤/tests.');
