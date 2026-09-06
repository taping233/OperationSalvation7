// 发布事务独立进程：由 build-portable.cjs 在构建完成后调用。
// 长构建进程上下文中紧接着执行发布事务曾 100% 触发外力终止（已观测 4 次），
// 干净进程执行同样事务从未复现（对照 5 次），故把发布隔离到本进程。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const [stagingDir, projectDir] = process.argv.slice(2);
const artifactName = require(path.join(projectDir, 'package.json')).build.portable.artifactName;
const tracePath = path.join(path.parse(projectDir).root, 'c7-trace.log');

function mark(stage) {
  try {
    fs.appendFileSync(tracePath, `${new Date().toISOString()} pid=${process.pid} [publish] ${stage}\n`);
  } catch { /* 打点失败不影响主流程 */ }
}

function say(message) {
  // 不用 fs.writeSync(1)：对管道的同步写在发布场景曾触发 node fail-fast（0xC0000409），
  // 成功宣告同步落 trace 文件，stdout 走异步尽力而为
  try {
    fs.appendFileSync(tracePath, `${new Date().toISOString()} pid=${process.pid} [publish] ${message}\n`);
  } catch { /* 打点失败不影响主流程 */ }
  process.stdout.write(`${message}\n`);
}

process.on('exit', (code) => mark(`exit code=${code}`));

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

// 大目录删除放独立进程做：本进程被外因终止时清理仍能完成
function cleanUpLater(paths) {
  const script = `const fs=require('fs');for(const p of ${JSON.stringify(paths)}){try{fs.rmSync(p,{recursive:true,force:true})}catch(e){console.error(p,e.message)}}`;
  const child = spawn(process.execPath, ['-e', script], { detached: true, stdio: 'ignore' });
  child.unref();
}

async function main() {
  mark(`start staging=${stagingDir}`);
  const source = path.join(stagingDir, artifactName);
  const stat = fs.statSync(source);
  if (stat.size <= 100 * 1024 * 1024) {
    throw new Error(`产物大小异常：${stat.size}`);
  }

  const outputDir = path.join(projectDir, 'dist');
  const target = path.join(outputDir, artifactName);
  const next = `${target}.next-${process.pid}`;
  const previous = `${target}.previous-${Date.now()}`;
  fs.mkdirSync(outputDir, { recursive: true });
  mark('copy begin');
  fs.copyFileSync(source, next);
  mark('copy end');

  mark('hash begin');
  const [sourceHash, nextHash] = await Promise.all([sha256(source), sha256(next)]);
  mark('hash end');
  if (sourceHash !== nextHash) {
    fs.rmSync(next, { force: true });
    throw new Error(`产物复制校验失败（sha256 不一致），暂存保留：${stagingDir}`);
  }

  let backedUp = false;
  try {
    if (fs.existsSync(target)) {
      mark('backup rename begin');
      fs.renameSync(target, previous);
      backedUp = true;
    }
    mark('publish rename begin');
    fs.renameSync(next, target);
    mark('publish rename end');
  } catch (renameError) {
    mark(`rename error: ${renameError.message}`);
    if (!fs.existsSync(target) && backedUp) fs.renameSync(previous, target);
    throw renameError;
  }
  // rename 成功后 next 已不存在；曾在此处 rmSync 刚消失的中文长名路径并触发
  // node fail-fast（0xC0000409），不要再对它做任何文件系统操作

  say(`Portable release: ${target}`);
  say(`sha256: ${nextHash}`);
  mark('announce done');

  cleanUpLater(backedUp ? [stagingDir, previous] : [stagingDir]);
  mark('cleanup spawned');
}

main().catch((error) => {
  mark(`main catch: ${error && error.stack || error}`);
  console.error(error);
  console.error(`Build staging preserved for diagnosis: ${stagingDir}`);
  process.exitCode = 1;
});
