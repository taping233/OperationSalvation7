/* 8138 验收服守护（照相馆二期临时工具）：拉起隔离 worktree 的 vite，进程退出自动重启。
 * 停止：往 %TEMP%/photolib-acc/ 写 STOP 文件，或直接杀本进程（taskkill /T）。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/serve-8138.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const WORKTREE = 'D:/素材/代号柒/.photolib-acc/搜打撤';
const VITE = 'D:/素材/代号柒/搜打撤/node_modules/vite/bin/vite.js';
const CFG = 'C:/Users/太平/AppData/Local/Temp/photolib-acc/vite.config.mjs';
const PORT = 8138;
const STOP = path.join(os.tmpdir(), 'photolib-acc', 'STOP');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), '[serve-8138]', ...a);

let n = 0;
while (n < 200) {
  if (fs.existsSync(STOP)) { log('检测到 STOP，退出'); break; }
  n++;
  log(`第 ${n} 次拉起 vite（端口 ${PORT}）…`);
  const child = spawn(process.execPath, [VITE, '--config', CFG, '--port', String(PORT), '--strictPort'], { cwd: WORKTREE });
  child.stdout.on('data', () => {});
  child.stderr.on('data', d => log('vite-stderr:', String(d).trim().slice(0, 200)));
  await new Promise(resolve => {
    child.once('exit', code => { log(`vite 退出 code=${code}，2 秒后重启（STOP 文件可停）`); setTimeout(resolve, 2000); });
  });
  if (fs.existsSync(STOP)) { log('检测到 STOP，退出'); break; }
}
