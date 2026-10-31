import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
const game = fileURLToPath(new URL('../../../../搜打撤/game/', import.meta.url));
const load = relative => import(pathToFileURL(game + relative).href);
const [{ stackCapOf }, { departureSummary }, identity, shared, story, economy] = await Promise.all([
  load('src/core/card-capacity.js'), load('src/hub/departure.summary.js'), load('src/hub/base-departure.commands.js'),
  load('src/hub/commands.shared.js'), load('src/home/story.last-lamp.js'), load('src/hub/base-economy.js')]);
const text = readFileSync(game + 'src/hub/preparation.commands.js', 'utf8');
const context = { ...shared, clone: value => structuredClone(value), stackCapOf, departureSummary,
  departureStackKey: identity.departureStackKey, findDepartureStack: identity.findDepartureStack,
  readBase() {}, readBaseReceipt() {}, commitBase() {} };
// Remove import/export wrappers only; every normalizer and preview executes the current source body.
vm.runInNewContext(text.replace(/^import .*;\r?$/gm, '').replace(/^export /gm, '')
  + '\nglobalThis.api={getPreparation,normalizePicks,previewDeployment};', context);
const catalog = JSON.parse(readFileSync(new URL('../battle/current-catalog.json', import.meta.url), 'utf8')).cards;
const pets = JSON.parse(readFileSync(game + 'data/pets.json', 'utf8')).list;
const list = (await load('src/core/characters.js')).CHARACTERS;
const martial = catalog.find(card => card.type === '武术' && card.rarity === '古朴');
const equipment = catalog.find(card => card.type === '装备' && card.rarity === '古朴');
const resource = catalog.find(card => card.type === '资源' && card.rarity === '古朴');
const classCard = catalog.find(card => card.rarity === '职业');
const box = catalog.find(card => card.id === 'tt2-pearlbox');
const ref = (card, count) => ({card:{cardId:card.id},count});
const base = { stash:[{card:martial,count:8},{card:equipment,count:30},{card:resource,count:9},{card:classCard,count:1},{card:box,count:1}],
  characters:Object.fromEntries(list.map(card=>[card.id,{lv:1,xp:0}])), pets:Object.fromEntries(pets.map(pet=>[pet.id,{lv:1}])),petSel:'dog',selMode:'standard' };
const cases = [[],[ref(martial,4)],[ref(equipment,3)],[ref(resource,7),ref(box,1)],[ref(martial,9)],
  [ref(classCard,1)],[ref(equipment,19)],[{card:{cardId:'missing-card'},count:1}],
  [ref(martial,2),ref(martial,3)]];
const previews = [];
for (const petId of ['dog','robot','fire','penguin']) for (const picks of cases) {
  const preset={id:'preset-1',name:'fixture',characterId:list[0].id,petId,picks};
  const result=context.api.previewDeployment({baseSnapshot:base,preset,cardCatalog:catalog,characters:list,pets,bagCapacity:16,starterCount:5});
  previews.push({base,preset,result});
}
const normalizers=[{}, {goals:{tracked:[' a ','a','b','c','d'],presets:{}}}, {goals:{tracked:[],presets:{'preset-1':{name:'自定',picks:[ref(martial,2),ref(martial,3)]}}}}]
  .map(input=>({input,result:context.api.getPreparation(input)}));
const storyVectors=[];
let snapshot={story:{flags:{},outcomes:{}}};
for(let segmentId=1;segmentId<=3;segmentId++) {
  const runId='run-'+segmentId,eventInstanceId=story.makeLastLampEventInstanceId(runId,segmentId-1,7);
  const choiceId=segmentId===3?'open_beacon':'continue';
  const inspected=story.inspectLastLamp(snapshot,{runId,eventInstanceId});
  const prepared=story.prepareLastLampChoice(snapshot,{runId,eventInstanceId,segmentId,choiceId});
  storyVectors.push({before:snapshot,input:{runId,eventInstanceId,segmentId,choiceId},inspected,prepared});
  snapshot=prepared.value.afterState;
}
const alternateBefore=storyVectors[2].before;
const alternateInput={runId:'shaded-run',eventInstanceId:story.makeLastLampEventInstanceId('shaded-run',2,9),segmentId:3,choiceId:'shaded_marker'};
storyVectors.push({before:alternateBefore,input:alternateInput,inspected:story.inspectLastLamp(alternateBefore,alternateInput),prepared:story.prepareLastLampChoice(alternateBefore,alternateInput)});
const corruptStories=[];
for(const mutate of [s=>s.outcomes['last-lamp'].stage=1.5,s=>s.flags=null,s=>delete s.outcomes['last-lamp'].segments['2'],s=>s.outcomes['last-lamp'].ending='invalid',s=>s.outcomes['last-lamp'].segments['3'].mementoId='invalid',s=>s.outcomes['last-lamp'].runs={}]) {
 const input=structuredClone(snapshot.story);mutate(input);corruptStories.push({input,ok:story.validateLastLampState(input).ok});
}
const pickVectors=[[],[{card:{cardId:' a ',variantKey:' v '},count:2}],[ref(martial,40),ref(martial,60)],[ref(martial,0)],[ref(martial,100)],[{card:{cardId:''},count:1}],null]
 .map(input=>({input,result:context.api.normalizePicks(input)}));
const packVectors=[];
for(const room of [0,3,4,8]) {
  let state={coins:0,wood:0,rations:0,keys:0,stash:[{card:{id:'tt-econpack',name:'经济卡包'},count:2}]};
  const port=economy.createBaseEconomy({read:()=>state,room:()=>room,mutate:fn=>fn(state),appendCards:(draft,cards)=>draft.stash.push(...cards)});
  const cards=Array.from({length:5},()=>({card:martial,count:1}));
  packVectors.push({room,result:port.openCardPack('tt-econpack',cards),remaining:state.stash[0]?.count,total:state.stash.reduce((sum,s)=>sum+s.count,0)});
}
writeFileSync(new URL('source-hub-vectors.json',import.meta.url),JSON.stringify({previews,normalizers,pickVectors,storyVectors,corruptStories,packVectors},null,2));
console.log(JSON.stringify({previews:previews.length,normalizers:normalizers.length,story:storyVectors.length,pack:packVectors.length}));
