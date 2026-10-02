import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { registerHooks, createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../../..');
registerHooks({ load(url, context, next) {
  if (url.endsWith('.json')) return { format: 'module', source: `export default ${fs.readFileSync(new URL(url),'utf8')}`, shortCircuit: true };
  return next(url,context);
}});
const {dataSlice} = await import(pathToFileURL(path.join(root,'game/src/cards/cards.data.js')).href);
const cards = [...new Map(Object.values(dataSlice).filter(Array.isArray).flat().map(c=>[c.id,c])).values()];
const tally = (values) => values.reduce((a,v)=>(a[String(v)] = (a[String(v)]||0)+1,a),{});
const json = p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const walk = p=>fs.readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(p,e.name)):[path.join(p,e.name)]);
const src = walk(path.join(root,'game/src')).filter(p=>/\.(js|mjs|cjs)$/.test(p));
const strictConfigs = fs.readdirSync(root).filter(p=>/^jsconfig\..*\.json$/.test(p)).map(p=>({path:p,...json(p)})).filter(p=>p.compilerOptions?.strict);
const strictFiles = [...new Set(strictConfigs.flatMap(p=>p.files||[]))];
const strictSourceJs = strictFiles.filter(p=>p.startsWith('game/src/') && /\.(js|mjs|cjs)$/.test(p));
const require = createRequire(import.meta.url);
const {auditAssets} = require(path.join(root,'scripts/asset-audit-lib.cjs'));
const assets = auditAssets({root,paths:[]});
const known = json('tests/fixtures/card-effect-audit-known.json');
const evidenceFiles = [
  'README.md','docs/PENDING.md','docs/roadmap.md','docs/DEBT-CAMPAIGN-2026-10.md',
  'docs/evidence/2026-10-01-full-audit-fix-perf/README.md',
  'docs/evidence/2026-10-01-acceptance-scenes/README.md',
  'docs/evidence/2026-09-30-vertical-slice-review/review.md',
  'docs/evidence/2026-09-30-vertical-slice-review/continuation-result.md',
  'docs/evidence/2026-10-02-quality-art-fixes/README.md',
  'docs/evidence/2026-10-02-quality-art-fixes-crossplatform/README.md',
  'docs/production/engineering/AGENT-EXPERIMENTS.md',
  'docs/PERF-LEDGER-2026-09-29.md','docs/PHOTOLIB-PERF-TASK-2026-09-29.md',
  'game/src/run/chests.js','game/src/agent/agent.scenes.js','game/data/pets.json',
  'game/data/achievements.json','game/src/hub/game.storage.js',
  'output/r24-T2-challenger/summary.json','output/agent-ledger.jsonl'
];
const report = {
  measuredAt:new Date().toISOString(),method:'只读实际 dataSlice 导入链；按 id 去重。strict 为配置显式 files 清单，非传递闭包/逐行覆盖率。资产门 paths=[] 为存量债检查。',
  cards:{count:cards.length,structured:cards.filter(c=>c.rules).length,types:tally(cards.map(c=>c.type)),costs:tally(cards.map(c=>c.cost??'missing')),knownAuditClauses:known.known.length},
  pets:{count:json('game/data/pets.json').list.length,levelMax:json('game/data/pets.json').levelMax},
  achievements:json('game/data/achievements.json').achievements.length,
  sceneContent:Object.keys(json('game/data/scenes.json').scenes).length,
  acceptanceSceneCount:10,
  source:{jsFiles:src.length,physicalLines:src.reduce((n,p)=>n+fs.readFileSync(p,'utf8').split(/\r?\n/).length,0),strictConfigs:strictConfigs.map(p=>p.path),strictExplicitFiles:strictFiles.length,strictSourceJsFiles:strictSourceJs.length,strictSourceJsRatio:Number((strictSourceJs.length/src.length*100).toFixed(1)),strictOtherFiles:strictFiles.filter(p=>!strictSourceJs.includes(p))},
  assets:{ok:assets.ok,errors:assets.errors.length,warnings:assets.warnings.length,counts:tally(assets.issues.map(i=>i.code))},
  latestHistoricalBatch:json('output/r24-T2-challenger/summary.json').overall,
  inputs:evidenceFiles.map(p=>{const raw=fs.readFileSync(path.join(root,p));return {path:p,bytes:raw.length,sha256:createHash('sha256').update(raw).digest('hex')};})
};
fs.writeFileSync(path.join(out,'measurements.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,inputs:report.inputs.length},null,2));
