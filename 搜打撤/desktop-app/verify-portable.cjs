// Exercise the delivered NSIS launcher in Node mode, without opening the game UI.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { createHash } = require('node:crypto');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function verifyPortable(artifact, output) {
  if (process.platform !== 'win32') throw Error('Portable launcher verification requires Windows');
  artifact = path.resolve(artifact);
  if (!fs.statSync(artifact).isFile()) throw Error('Artifact is not a file');
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'c7-portable-check-'));
  const temp = path.join(work, '临时 resources'); fs.mkdirSync(temp);
  const hold = path.join(work, 'hold.cjs');
  fs.writeFileSync(hold, `
const fs=require('node:fs'),path=require('node:path');
const dir=__dirname,role=process.argv[2],root=path.dirname(process.execPath);
const resources=path.join(root,'resources/game'),inventory=[];
function walk(folder,rel=''){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const name=rel+entry.name,file=path.join(folder,entry.name);if(entry.isDirectory())walk(file,name+'/');else inventory.push({path:name,size:fs.statSync(file).size});}}
walk(resources);
const samples=['index.html','assets/portraits/full/wu.webp'];
const missing=[];const check=()=>{for(const name of samples)if(!fs.existsSync(path.join(resources,name))&&!missing.includes(name))missing.push(name);};
check();
fs.writeFileSync(path.join(dir,role+'.json'),JSON.stringify({pid:process.pid,root,files:inventory.length,missing}));
if(role==='second')process.exit(missing.length?1:0);
let ended=false;
function finish(){if(ended)return;ended=true;check();for(const item of inventory){try{if(fs.statSync(path.join(resources,item.path)).size!==item.size)missing.push(item.path);}catch{missing.push(item.path);}}
fs.writeFileSync(path.join(dir,'first-final.json'),JSON.stringify({root,files:inventory.length,missing:[...new Set(missing)]}));process.exit(missing.length?1:0);}
setInterval(()=>{check();if(fs.existsSync(path.join(dir,'stop')))finish();},25);
setTimeout(finish,150000);
`);
  const children = [];
  const start = role => {
    const child = spawn(artifact, [hold, role], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', TEMP: temp, TMP: temp },
      windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    });
    child.stderr.on('data', bytes => fs.appendFileSync(path.join(work, 'stderr.log'), bytes));
    child.on('error', error => { child.launchError = error; });
    children.push(child); return child;
  };
  const waitFile = async (file, child) => {
    for (let i = 0; i < 1800; i++) {
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
      if (child.launchError || child.exitCode != null || child.signalCode != null) throw Error(`Launcher exited before ${path.basename(file)}: ${child.launchError || child.exitCode || child.signalCode}`);
      await delay(50);
    }
    throw Error(`Timed out waiting for ${path.basename(file)}`);
  };
  const waitExit = async child => {
    for (let i = 0; i < 1800; i++) { if (child.exitCode != null || child.signalCode != null) return child.exitCode ?? child.signalCode; await delay(50); }
    throw Error('Portable launcher did not exit');
  };
  try {
    const first = start('first'), a = await waitFile(path.join(work, 'first.json'), first);
    const second = start('second'), b = await waitFile(path.join(work, 'second.json'), second);
    const secondExit = await waitExit(second);
    fs.writeFileSync(path.join(work, 'stop'), 'stop own verification');
    const firstExit = await waitExit(first);
    const final = JSON.parse(fs.readFileSync(path.join(work, 'first-final.json'), 'utf8'));
    const hash = createHash('sha256');
    for await (const bytes of fs.createReadStream(artifact)) hash.update(bytes);
    const report = { artifact, artifactSHA256: hash.digest('hex'), work, first: a, second: b, final, firstExit, secondExit,
      passed: a.root !== b.root && a.files > 0 && !a.missing.length && !b.missing.length && !final.missing.length && firstExit === 0 && secondExit === 0 };
    fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
    if (!report.passed) throw Error(`Portable resources changed during overlapping launches: ${output}`);
    console.log(`Portable overlap PASS: ${a.files} resources retained; ${output}`);
    return report;
  } finally {
    fs.writeFileSync(path.join(work, 'stop'), 'stop own verification');
    for (const child of children) if (child.exitCode == null) {
      // Only stop processes created by this verifier, never other running games.
      try { await waitExit(child); } catch { child.kill(); }
    }
  }
}

if (require.main === module) {
  const artifact = process.argv[2];
  if (!artifact) { console.error('Usage: node verify-portable.cjs <exe> [report.json]'); process.exitCode = 1; }
  else verifyPortable(artifact, path.resolve(process.argv[3] || artifact + '.verification.json'))
    .catch(error => { console.error(error); process.exitCode = 1; });
}
module.exports = { verifyPortable };
