import config from '../../../vite.config.js';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const project=fileURLToPath(new URL('../../../',import.meta.url));
const before=fileURLToPath(new URL('./before/',import.meta.url));
const files=['game/src/game.boot.js','game/src/ui/page-loading.js','game/src/ui/camp-entry.js',
  'game/src/ui/page-visual-ready.js','game/src/hub/game.cardslib.page.js','game/src/hub/hub.warehouse.js',
  'game/src/battle/view/battle.aim.js','game/src/battle/view/battle.frames.js','game/src/audio/sound.js'];
const normal=p=>path.resolve(p).replaceAll('\\','/');
const targets=new Map(files.map(file=>[normal(path.join(project,file)),normal(path.join(before,path.basename(file)))]));
const origins=new Map([...targets].map(([a,b])=>[b,a]));
export default {...config,plugins:[{name:'task-baseline-sources',enforce:'pre',resolveId(source,importer){
  if(!importer||!source.startsWith('.'))return;
  const owner=normal(importer.split('?')[0]),original=origins.get(owner);
  const target=normal(path.resolve(path.dirname(original||owner),source));
  return targets.get(target)||(original?target:undefined);
}},...config.plugins],test:{...config.test,maxWorkers:1,minWorkers:1}};
