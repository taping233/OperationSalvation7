import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/2026-10-13-WF-four-player-fixes-1013');
const target = path.join(root, '.tmp/WF-four-player-fixes-1013/runtime');
if (!process.argv.includes('--finalize')) {
if (fs.existsSync(target)) throw new Error('隔离目录已存在，拒绝重写');
fs.mkdirSync(target, { recursive: true });
function copyTree(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name), to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyTree(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
    else throw new Error(`非普通文件：${from}`);
  }
}
for (const dir of ['game/src', 'game/css', 'game/data', 'tests', 'scripts']) copyTree(path.join(root, dir), path.join(target, dir));
for (const file of fs.readdirSync(root).filter(f => /^(package(-lock)?\.json|vite.*\.js|.*config.*\.json|eslint\.config\.mjs)$/.test(f))) {
  fs.copyFileSync(path.join(root, file), path.join(target, file));
}
for (const file of fs.readdirSync(path.join(root, 'game'), { withFileTypes: true }).filter(f => f.isFile())) {
  fs.copyFileSync(path.join(root, 'game', file.name), path.join(target, 'game', file.name));
}
for (const dir of ['node_modules', 'game/assets']) fs.symlinkSync(path.join(root, dir), path.join(target, dir), 'junction');
}
const files = ['game/src/ui/interface-motion.js', 'game/src/run/game.run.flow.js', 'game/src/run/game.run.scenes.js', 'game/src/battle/core/battle.enemy-phase.js'];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const fingerprint = Object.fromEntries(files.map(file => [file, sha(path.join(target, file))]));
fs.writeFileSync(path.join(evidence, 'isolation.json'), JSON.stringify({ at: new Date().toISOString(), target, assets: '只读复用共享素材junction', dependencies: '复用现有node_modules junction，未安装', fingerprint }, null, 2));
console.log(JSON.stringify({ target, files: files.length, status: 'isolated' }));
