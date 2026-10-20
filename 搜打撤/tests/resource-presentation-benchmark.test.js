import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance as timer } from 'node:perf_hooks';
import os from 'node:os';
import frames from '../game/data/card-frame-layout.json';
import { DATA } from '../game/src/core/data-loader.js';
import { characterFor, CHARACTERS } from '../game/src/core/characters.js';
import ART_MANIFEST from '../game/src/generated/art-manifest.js';
import THUMB_MANIFEST from '../game/src/generated/thumb-manifest.js';
import { esc, escAttr } from '../game/src/core/shared.js';
import { PERFORMANCE_BUDGETS } from '../game/src/core/performance-budgets.js';
import { getQualityPreset } from '../game/src/core/performance-settings.js';
import { termKeyFor } from '../game/src/ui/term-tips.js';
import { displayCardDescription } from '../game/src/cards/card-description-text.js';
await import('../game/src/core/icons-bitmap.js');
await import('../game/src/cards/cards.js');
const evidence = process.env.RESOURCE_PRESENTATION_BEFORE_DIR;
const baseline = name => {
  if (!evidence) throw new Error('Set RESOURCE_PRESENTATION_BEFORE_DIR to the archived before-source directory.');
  return `${evidence}/${name}`;
};
const read = path => readFileSync(path, 'utf8');
const clean = text => text.replace(/^import .*;\n/gm, '').replace(/^export \{.*\};?$/gm, '').replace(/export function/g, 'function').replace(/import\.meta\.hot/g, 'false');
const make = (source, deps, result) => new Function(...Object.keys(deps), `${clean(source)}\nreturn ${result};`)(...Object.values(deps));
const viewSource = read('game/src/cards/cards.view.js');
const artSource = read('game/src/core/art.js');
let catalog;
const median = list => [...list].sort((a,b) => a-b)[Math.floor(list.length/2)];
function create(after) {
  const counts = { urlCalls:0, urlParses:0, frameComputations:0 };
  const urlSource = read(after ? 'game/src/core/asset-url.js' : baseline('asset-url.before.js')).replace('const hashIndex =', 'counts.urlParses++; const hashIndex =');
  const calculate = make(urlSource, { counts }, 'assetUrl');
  const assetUrl = path => { counts.urlCalls++; return calculate(path); };
  const frameSource = read(after ? 'game/src/cards/card-frame-presentation.js' : baseline('card-frame-presentation.before.js')).replace('const frame = frames[key];', 'counts.frameComputations++; const frame = frames[key];');
  const present = make(frameSource, { frames, assetUrl, counts }, 'cardFramePresentation');
  const SDT = { ...window.SDT, Cards: { ...window.SDT.Cards, all: () => catalog } };
  // No warming, network, subscriptions, or DOM hydration is executed by this factory.
  make(artSource, { SDT, sdtDefine:(key,value) => { SDT[key]=value; }, characterFor, CHARACTERS, assetUrl, DATA, ART_MANIFEST, THUMB_MANIFEST, esc, PERFORMANCE_BUDGETS, getQualityPreset, onPerformanceSettingsChange:() => () => {}, decodeImagesIn:() => {}, createForegroundImageYield:() => () => false }, 'null');
  const render = make(viewSource, { SDT, window:{ SDT }, termKeyFor, esc, escAttr, displayCardDescription, cardFramePresentation:present }, 'cardHTML');
  return { counts, render };
}
// Fresh instances force cardHTML construction, as on cloned card datasets. The
// existing WeakMap fast path for repeated identical card objects is separate.
function pass(context, rounds=1) {
  const output = [];
  for(let round=0;round<rounds;round++) for(const card of catalog) {
    for(const [cls,options] of [['sm',{low:true}],['lg',null],['sm',{hideCost:true}],['',{costOverride:{base:card.cost||0,v:1},dmgOverride:{bonus:2}}]]) {
      output.push(context.render({...card},cls,options));
    }
  }
  return output;
}
it.skipIf(!process.env.RESOURCE_PRESENTATION_BENCH)('compares complete mixed catalog card construction, cold and warm', () => {
  for (const name of ['ensureStarters','ensureSha','ensureTabletop','ensureDmgTypes','ensureEffectFields']) window.SDT.Cards[name]();
  catalog = window.SDT.Cards.all();
  const before=create(false), after=create(true);
  const firstBefore=pass(before), firstAfter=pass(after);
  expect(firstAfter).toEqual(firstBefore);
  const coldCounts = { before:{...before.counts}, after:{...after.counts} };
  pass(before,2); pass(after,2);
  const cold={before:[],after:[]}, warm={before:[],after:[]};
  for(let sample=0;sample<31;sample++) {
    for(const optimized of sample%2 ? [true,false] : [false,true]) {
      const label=optimized?'after':'before';
      const fresh=create(optimized), warmed=optimized?after:before;
      let start=timer.now(); pass(fresh); cold[label].push(timer.now()-start);
      start=timer.now(); pass(warmed,3); warm[label].push(timer.now()-start);
    }
  }
  const warmBefore={...before.counts}, warmAfter={...after.counts};
  pass(before); pass(after);
  const diff=(now,prior)=>Object.fromEntries(Object.keys(now).map(key=>[key,now[key]-prior[key]]));
  const report={environment:{node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0].model,vitest:'3.2.7',environment:'jsdom; JS string generation only; no browser layout, network, decode or FPS measured'},catalogCards:catalog.length,cardsPerPass:firstBefore.length,samples:31,coldCounts,warmCounts:{before:diff(before.counts,warmBefore),after:diff(after.counts,warmAfter)},coldPassMs:{before:median(cold.before),after:median(cold.after),samples:cold},warmThreePassMs:{before:median(warm.before),after:median(warm.after),samples:warm},identicalHtmlSha256:createHash('sha256').update(firstBefore.join('\n')).digest('hex')};
  if (process.env.RESOURCE_PRESENTATION_OUTPUT) writeFileSync(process.env.RESOURCE_PRESENTATION_OUTPUT, JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
});
