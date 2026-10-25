import { readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const tests = readdirSync('tests').filter(name=>/^agent-.*\.test\.js$/.test(name)).map(name=>'tests/'+name);
const args=['node_modules/vitest/vitest.mjs','run',...tests,'--maxWorkers=1','--no-file-parallelism','--reporter=json','--outputFile=docs/evidence/2026-10-23-project-bug-audit/agent-tests.json'];
const result=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:8*1024*1024});
writeFileSync(new URL('./agent-tests.log',import.meta.url),JSON.stringify({command:[process.execPath,...args],status:result.status,signal:result.signal,error:result.error?.message})+'\n'+result.stdout+'\n'+result.stderr);
console.log(JSON.stringify({files:tests.length,status:result.status,signal:result.signal,error:result.error?.message}));
process.exitCode=result.status ?? 1;
