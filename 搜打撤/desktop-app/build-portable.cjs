const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectDir = __dirname;
const packageJson = require('./package.json');
const artifactName = packageJson.build.portable.artifactName;
const stagingDir = fs.mkdtempSync(path.join(path.parse(projectDir).root, 'c7-build-'));
const buildLogPath = path.join(stagingDir, 'build.log');
const tracePath = path.join(path.parse(projectDir).root, 'c7-trace.log');

// 同步打点：进程随时可能被外因终止（已观测），异步 stdout 会丢，只有同步文件写可靠
function mark(stage) {
  try {
    fs.appendFileSync(tracePath, `${new Date().toISOString()} pid=${process.pid} ${stage}\n`);
  } catch { /* 打点失败不影响主流程 */ }
}

process.on('exit', (code) => mark(`exit code=${code}`));

// 本进程只负责构建与产物验证；发布事务交给干净的子进程（publish-portable.cjs），
// 因为"长构建上下文 + 随后立即发布"的组合曾 100% 触发外力终止（4/4），
// 而干净进程执行同样发布事务从未复现（5/5）。
function runBuilder() {
  return new Promise((resolve) => {
    const builder = path.join(projectDir, 'node_modules', '.bin', 'electron-builder.cmd');
    const child = spawn(process.env.ComSpec, [
      '/d', '/c', builder, '--win', 'portable', `--config.directories.output=${stagingDir}`,
    ], {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const logStream = fs.createWriteStream(buildLogPath);
    const forward = (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    };
    child.stdout.on('data', forward);
    child.stderr.on('data', forward);
    child.on('error', (error) => logStream.end(() => resolve({ status: null, error })));
    child.on('close', (status) => logStream.end(() => resolve({ status, error: null })));
  });
}

function runPublisher() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'publish-portable.cjs'), stagingDir, projectDir], {
      cwd: projectDir,
      stdio: ['ignore', 'inherit', 'inherit'],
    });
    child.on('error', (error) => resolve({ status: null, error }));
    child.on('close', (status) => resolve({ status, error: null }));
  });
}

async function main() {
  mark(`start staging=${stagingDir}`);
  const startedAt = Date.now();
  const { status, error } = await runBuilder();
  mark(`builder done status=${status} error=${error ? error.message : 'none'}`);

  const source = path.join(stagingDir, artifactName);
  const stat = fs.existsSync(source) ? fs.statSync(source) : null;
  const artifactOk = stat != null && stat.size > 100 * 1024 * 1024 && stat.mtimeMs >= startedAt;
  if (!artifactOk) {
    throw new Error(`electron-builder 未产出有效产物（exit=${status}${error ? ` error=${error.message}` : ''}），构建日志：${buildLogPath}`);
  }
  if (status !== 0) {
    console.warn(`[build-portable] 构建进程退出码 ${status}，但产物已验证为本次新产出，继续发布`);
  }

  const published = await runPublisher();
  mark(`publisher done status=${published.status}`);
  if (published.status !== 0) {
    throw new Error(`发布子进程失败（exit=${published.status}${published.error ? ` error=${published.error.message}` : ''}）`);
  }
}

main().catch((error) => {
  mark(`main catch: ${error && error.stack || error}`);
  console.error(error);
  console.error(`Build staging preserved for diagnosis: ${stagingDir}`);
  process.exitCode = 1;
});
