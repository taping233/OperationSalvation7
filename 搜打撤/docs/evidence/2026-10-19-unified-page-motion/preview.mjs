import { cpSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createServer } from 'vite';
const root = process.cwd();
const snapshot = path.join(root, '.tmp/page-motion-1019');
if (existsSync(snapshot)) throw new Error('Preview snapshot already exists; refusing overwrite');
mkdirSync(snapshot, { recursive: true });
cpSync(path.join(root, 'game'), path.join(snapshot, 'game'), { recursive: true,
  filter: source => source !== path.join(root, 'game/assets') });
symlinkSync(path.join(root, 'game/assets'), path.join(snapshot, 'game/assets'), 'junction');
cpSync(path.join(root, 'package.json'), path.join(snapshot, 'package.json'));
const files = ['game/src/ui/interface-motion.js','game/src/ui/surface-motion.js','game/src/ui/navigation-motion.js',
  'game/src/ui/motion-presets.js','game/src/ui/page-motion-profiles.js','game/src/ui/page-visual-ready.js',
  'game/src/ui/overlay.js','game/src/run/game.run.scenes.js','game/css/interface-motion.css',
  'game/css/page-transitions.css','game/css/page-visual-ready.css','game/css/expedition-transitions.css'];
const hashes = Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(path.join(snapshot,file))).digest('hex')]));
const server = await createServer({ configFile: false, root: path.join(snapshot,'game'), base:'./', publicDir:false,
  define:{ __BUILD_VERSION__: JSON.stringify('0.60.0-motion-review') },
  server: { host:'127.0.0.1', port:5321, strictPort:true, hmr:false, watch:{ignored:['**/*']}, fs:{allow:[root]} },
});
await server.listen();
writeFileSync(path.join(root,'docs/evidence/2026-10-19-unified-page-motion/preview.json'), JSON.stringify({
  directory:snapshot, port:5321, pid:process.pid, assets:'Read-only consumption of shared game/assets junction', hashes,
},null,2));
console.log(JSON.stringify({url:'http://127.0.0.1:5321/',pid:process.pid,snapshot}));
