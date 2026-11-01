// Root runs this after the complete source freeze. It calls the actual Vite queue,
// discover flow and seeded RNG; no browser/UI/production profile or Assets writes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = new URL('../../../搜打撤/game/src/', import.meta.url);
const [{ createInspectionDomain }, { createBattleDiscoverFlow }, { SeededRandomService }, { isRandomObtainableCard }]
  = await Promise.all([
    import(new URL('battle/effects/battle.card-inspection.domain.js', root)),
    import(new URL('battle/effects/battle.discover-flow.js', root)),
    import(new URL('core/random-service.js', root)),
    import(new URL('cards/card-obtainability.js', root)),
  ]);
const cards = [
  { id:'r6-a', name:'Alpha', type:'武术', rarity:'古朴', cost:1, variantKey:'first' },
  { id:'r6-b', name:'Beta', type:'法术', rarity:'稀有', cost:3 },
  { id:'r6-hidden', name:'Hidden', type:'法术', rarity:'古朴', cost:2, unrandom:true },
  { id:'r6-class', name:'Class', type:'法术', rarity:'职业', cls:'牧师', cost:4 },
  { id:'r6-derived', name:'Derived', type:'法术', rarity:'衍生', cost:0 },
  { id:'r6-initial', name:'Initial', type:'武术', rarity:'初始', cost:0 },
  { id:'r6-equipment', name:'Equipment', type:'装备', rarity:'古朴', cost:0 },
  { id:'r6-a', name:'Alpha', type:'武术', rarity:'古朴', cost:4, variantKey:'second' },
];
const describe = card => ({ id:card.id, variantKey:card.variantKey || null, cost:card.cost });
function scenario(catalog, seed, cancelSecond) {
  const random = new SeededRandomService(seed);
  const state = { game:{ ownedCards:[], log:() => {} }, granted:[], cardOverrides:new Map(), discoverQueue:[] };
  let current = null, sequence = 0;
  const inspection = createInspectionDomain({ normalizeCard:card => card }).createBattleCardInspection({
    cards:{ all:() => catalog, isRandomObtainable:isRandomObtainableCard }, readState:() => state, curseMeta:{},
  });
  const flow = createBattleDiscoverFlow({
    cards:{ all:() => catalog, isRandomObtainable:isRandomObtainableCard, sellPrice:() => 1,
      findByUid:inspection.findCard, addTempCard:card => { const uid=`source-temp-${++sequence}`; state.granted.push({ uid, card:structuredClone(card) }); return uid; },
      queueCardExecution:() => { throw new Error('Unexpected direct cast'); }, fireCatGift:() => {},
    },
    interaction:{ getJobs:() => state.discoverQueue, get:() => current, set:value => { current=value; }, requestRender:() => {} },
    random:{ next:() => random.random('battle','generation') },
    battle:{ currentClass:() => null, battleActive:() => true, firstAliveTarget:() => null, hasAliveFoes:() => true, sweepDead:() => {}, finishVictory:() => { throw new Error('Unexpected victory'); } },
    effects:{ returnToDeckBottom:() => {}, addArmor:() => 0, setCardOverride:(uid,card) => state.cardOverrides.set(uid,card),
      enqueueDelayed:() => { throw new Error('Unexpected delayed effect'); }, swapCardCosts:inspection.swapCardCosts },
    output:{ log:() => {} },
  });
  inspection.queueSwapCostDiscover();
  const queued = state.discoverQueue.length;
  flow.processDiscoverQueue();
  const result = { seed, cancelSecond, catalog, queued, rounds:[] };
  if (!current) { result.finalRandom=random.snapshot(); result.finalCards=[]; result.generatedCount=sequence; return result; }
  result.rounds.push({ options:current.options.map(describe), random:random.snapshot() });
  flow.pickDiscover(0);
  if (!current) throw new Error('Expected second real queued discovery');
  result.rounds.push({ options:current.options.map(describe), random:random.snapshot() });
  const first = state.granted[0];
  result.firstConfirmed=describe(first.card);
  result.secondIndex=Math.max(0,current.options.findIndex(card => card.cost !== first.card.cost));
  if (cancelSecond) flow.cancelDiscover(current.roundId); else flow.pickDiscover(result.secondIndex);
  result.finalRandom=random.snapshot();
  result.finalCards=state.granted.map(entry => describe(inspection.findCard(entry.uid).card));
  result.generatedCount=sequence;
  return result;
}
const output = process.argv[2];
if (!output) throw new Error('Pass the explicit output JSON path.');
const sources=['battle/effects/battle.card-inspection.domain.js','battle/effects/battle.discover-flow.js','battle/effects/battle.discover-candidates.js','battle/effects/battle.discover-state.js','cards/card-obtainability.js','cards/card-rarity.js','core/random-service.js','core/random-core.js','core/random-streams.js'];
const report={ purpose:'Actual Vite mist-box queue/discovery/RNG oracle on explicit controlled catalogs; UID port is a deterministic counter and acquisition/visual effects are omitted.',
  sourceScope:'Principal behavioural modules below; Root unified Vite input receipt covers transitive imports.',
  sources:sources.map(relative => ({ path:`搜打撤/game/src/${relative}`, sha256:createHash('sha256').update(fs.readFileSync(fileURLToPath(new URL(relative,root)))).digest('hex') })),
  cases:[scenario([],7,false),scenario([cards[0]],7,false),...[7,42,1106].flatMap(seed=>[scenario(cards,seed,false),scenario(cards,seed,true)])] };
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n','utf8');
process.stdout.write(JSON.stringify({output:path.resolve(output),cases:report.cases.length})+'\n');
