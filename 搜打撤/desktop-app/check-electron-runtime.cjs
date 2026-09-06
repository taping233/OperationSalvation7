const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const packageJson = require('./package.json');
const expected = packageJson.devDependencies.electron.replace(/^[^0-9]*/, '');
const executable = path.resolve(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');

if (!fs.existsSync(executable)) {
  console.error('Electron 运行时缺失。请在 desktop-app 目录运行：node node_modules/electron/install.js');
  process.exit(1);
}

const probe = spawnSync(executable, ['--version'], { encoding: 'utf8', windowsHide: true });
const actual = (probe.stdout || '').trim().replace(/^v/, '');
if (probe.status !== 0 || actual !== expected) {
  console.error(`Electron 运行时版本不匹配：期望 ${expected}，实际 ${actual || '无法读取'}`);
  process.exit(1);
}

console.log(`Electron 运行时一致：${actual}`);
