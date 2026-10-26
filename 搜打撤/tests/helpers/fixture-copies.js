import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Byte copies avoid Windows fs.cp metadata/readonly failures. Preserve POSIX
// executable modes; fixture Git operations refresh their own copied stat data.
function captureTree(source, relative = '', directories = [], files = []) {
  for (const entry of readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), name = path.join(relative, entry.name);
    if (entry.isDirectory()) { directories.push(name); captureTree(from, name, directories, files); }
    else if (entry.isFile()) {
      files.push({ name, bytes: readFileSync(from), mode: process.platform === 'win32' ? null : statSync(from).mode & 0o777 });
    } else throw new Error('测试基线包含非普通文件：' + from);
  }
  return { directories, files };
}

// Prepare once; each case receives a physical copy, including its own Git index,
// refs, objects and ignored fixture dependencies. No shared object store or links.
export function createFixtureCopies(prefix, initialize) {
  if (!/^sdt-[a-z0-9-]+-$/.test(prefix)) throw new Error('无效的测试临时目录前缀');
  const owned = new Set();
  let seed = null, snapshot = null;
  function createEmpty() {
    const directory = mkdtempSync(path.join(os.tmpdir(), prefix));
    owned.add(directory);
    return directory;
  }
  return {
    createEmpty,
    create() {
      if (!seed) {
        seed = mkdtempSync(path.join(os.tmpdir(), prefix + 'seed-'));
        owned.add(seed);
        initialize(seed);
        snapshot = captureTree(seed);
      }
      if (!snapshot) throw new Error('测试基线初始化失败，拒绝复制半成品');
      const destination = createEmpty();
      for (const directory of snapshot.directories) mkdirSync(path.join(destination, directory));
      for (const file of snapshot.files) {
        const target = path.join(destination, file.name);
        writeFileSync(target, file.bytes);
        if (file.mode !== null) chmodSync(target, file.mode);
      }
      return destination;
    },
    dispose() {
      // Each case keeps a separate directory. Remove owned copies together after
      // all cases settle, so Windows needs at most one fallback shell per file.
      for (const directory of owned) {
        const relative = path.relative(path.resolve(os.tmpdir()), path.resolve(directory));
        if (!relative.startsWith(prefix) || relative.includes(path.sep)
          || path.isAbsolute(relative)) throw new Error('拒绝清理非自有测试目录');
      }
      for (const directory of owned) {
        try { rmSync(directory, { recursive: true, force: true }); }
        catch (error) { if (process.platform !== 'win32') throw error; }
      }
      const remaining = [...owned].filter(directory => existsSync(directory));
      if (remaining.length && process.platform === 'win32') {
        execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
          '$targets = ConvertFrom-Json -InputObject $env:SDT_FIXTURE_COPY_PATHS; foreach ($target in $targets) { Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop }'],
        { env: { ...process.env, SDT_FIXTURE_COPY_PATHS: JSON.stringify(remaining) }, windowsHide: true });
      }
      for (const directory of owned) {
        if (existsSync(directory)) throw new Error('测试目录清理失败：' + directory);
      }
      owned.clear();
      seed = null; snapshot = null;
    },
  };
}
