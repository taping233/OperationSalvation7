import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const failures = JSON.parse(fs.readFileSync(path.join(directory,'failures.json'),'utf8'));
const report = process.argv[2] || 'repaired-failed-suites';
const relative = 'docs/evidence/2026-10-16-WF-completed-commit-1016/';
const log = fs.openSync(path.join(directory,report+'.log'),'w');
const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...Object.keys(failures.failuresByFile),
  '--reporter=json', '--outputFile='+relative+report+'.json'], { stdio:['ignore',log,log], windowsHide:true });
child.on('error',error=>{ console.error(error); process.exitCode=1; });
child.on('exit',code=>{ fs.closeSync(log); process.exitCode=code??1; console.log(JSON.stringify({report:relative+report+'.json',exitCode:code})); });
