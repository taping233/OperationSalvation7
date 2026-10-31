import assert from 'node:assert/strict';
import { findMapTravelPath } from '../../../../搜打撤/game/src/run/map-travel-path.js';
import { planBaseDeparture } from '../../../../搜打撤/game/src/hub/base-departure.commands.js';
import { mapNodeStatus } from '../../../../搜打撤/game/src/core/map-node-state.js';

const game={layerIdx:1,trackPos:0,layerData:[{logical:[{def:{type:'door'},next:[[1,0]]}]},{logical:[{def:{type:'entrance'},next:[[0,0]]}]}]};
assert.deepEqual(findMapTravelPath(game,{li:0,idx:0}),[{li:0,idx:0}]);
console.log('PASS current web allows an authored cross-layer return edge');
const {departure,afterState}=planBaseDeparture({stash:[],pocket:[{card:{id:'probe',name:'Probe'},count:2}]},{});
assert.equal(departure.ok,true);assert.equal(afterState.pocket.length,0);assert.equal(departure.dispersedPocketCount,2);
console.log('PASS current web successful departure clears the prior base pocket');
const shopGame={layerIdx:0,trackPos:0,nodeRewards:{'0,0':{version:1,type:'closed'}}};
assert.equal(mapNodeStatus(shopGame,{li:0,idx:0,def:{type:'shop'}}).id,'shop-closed');
console.log('PASS current web classifies an actually departed shop as closed');
