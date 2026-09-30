const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'game', 'version.json');
const canonical = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).version;
const mirrors = [
  path.join(root, 'package.json'),
  path.join(root, 'package-lock.json'),
  path.join(root, 'desktop-app', 'package.json'),
  path.join(root, 'desktop-app', 'package-lock.json'),
];

if (!/^\d+\.\d+\.\d+$/.test(canonical)) {
  throw new Error(`游戏版本必须是 SemVer（三段数字），当前为：${canonical}`);
}

for (const file of mirrors) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const actual = data.version;
  if (actual !== canonical) {
    throw new Error(`${path.relative(root, file)} 的版本 ${actual} 与 version.json 的 ${canonical} 不一致`);
  }
  if (file.endsWith('package-lock.json') && data.packages?.['']?.version !== canonical) {
    throw new Error(`${path.relative(root, file)} 的 packages[''] 版本与 version.json 的 ${canonical} 不一致`);
  }
}

console.log(`版本一致：${canonical}`);
