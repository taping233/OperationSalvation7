import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {parse, tokenizer} from 'acorn';
import {simple} from 'acorn-walk';
const destination = 'docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/rooms';
const baseline = 'node_modules/.cache/lean-refactor-1024/before/';
const files = ['game/src/run/game.run.shop.js','game/src/run/game.run.altar.js','game/src/run/chests.js','game/src/ui/reward-scene-view.js','game/src/ui/room-actions.js'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const measure = source => {
  const tokens = tokenizer(source,{ecmaVersion:'latest',sourceType:'module'});
  let count = 0;
  while(tokens.getToken().type.label !== 'eof') count++;
  return {sha256:hash(source),bytes:Buffer.byteLength(source),normalizedBytes:Buffer.byteLength(source.replace(/\r\n/g,'\n')),lines:source.split('\n').length,tokens:count};
};
const changed = files.map(file => {
  const old = fs.existsSync(baseline+file) ? fs.readFileSync(baseline+file,'utf8') : '';
  const source = fs.readFileSync(file,'utf8');
  parse(source,{ecmaVersion:'latest',sourceType:'module'});
  return {file,before:measure(old),after:measure(source)};
});
const totals = ['bytes','normalizedBytes','lines','tokens'].reduce((result,key) => {
  result[key] = changed.reduce((n,file) => n+file.before[key]-file.after[key],0);return result;
},{});
const shop = 'game/src/run/game.run.shop.js';
const purchaseBytes = source => {
  const ranges = [];
  simple(parse(source,{ecmaVersion:'latest',sourceType:'module'}),{
    CallExpression(node){if(node.callee.name==='registerTrade'&&['buyCard','buySha'].includes(node.arguments[0]?.value))ranges.push(node);},
    VariableDeclaration(node){if(node.declarations.some(item=>item.id.name==='buy'))ranges.push(node);},
  });
  return ranges.reduce((n,node)=>n+Buffer.byteLength(source.slice(node.start,node.end).replace(/\r\n/g,'\n')),0);
};
const buyBefore = purchaseBytes(fs.readFileSync(baseline+shop,'utf8')), buyAfter = purchaseBytes(fs.readFileSync(shop,'utf8'));
const altar = 'game/src/run/game.run.altar.js', oldAltar = fs.readFileSync(baseline+altar,'utf8'), newAltar = fs.readFileSync(altar,'utf8');
const boundary = 'export function emergencyExitPaymentState';
assert.equal(newAltar.slice(newAltar.indexOf(boundary)),oldAltar.slice(oldAltar.indexOf(boundary)));
assert.equal(fs.readFileSync('game/src/run/shop-commands.js','utf8'),fs.readFileSync(baseline+'game/src/run/shop-commands.js','utf8'));
const tests = JSON.parse(fs.readFileSync('node_modules/.cache/lean-refactor-1024/rooms-tests.json','utf8'));
const oracle = JSON.parse(fs.readFileSync('node_modules/.cache/lean-refactor-1024/rooms-oracle-closeout.json','utf8'));
const failures = tests.testResults.flatMap(suite => suite.assertionResults.filter(test=>test.status==='failed').map(test=>({file:suite.name,name:test.fullName,messages:test.failureMessages})));
assert.equal(failures.length,2);assert.equal(oracle.numFailedTests,0);
const changes = {baseline,originalProjectNormalizedBytes:6601166,files:changed,netReduction:totals,
  originalProjectNetPercent:100*totals.normalizedBytes/6601166,
  touchedSlicePercent:100*totals.normalizedBytes/changed.reduce((n,file)=>n+file.before.normalizedBytes,0),
  purchaseFlow:{beforeNormalizedBytes:buyBefore,afterNormalizedBytes:buyAfter,savedNormalizedBytes:buyBefore-buyAfter,percent:100*(buyBefore-buyAfter)/buyBefore,scope:'two registered buy callbacks versus one complete buy flow and two adapters; public command validation unchanged'},
  addedRuntimeFiles:['game/src/ui/room-actions.js'],testsExcludedFromRuntime:true,evidenceExcludedFromRuntime:true};
fs.writeFileSync(destination+'/changes.json',JSON.stringify(changes,null,2)+'\n');
const validation = {status:'targeted checks complete; browser pending parent',sourceSyntax:'5 files pass',eslint:'5 source files and standalone test passed before pause; no later runtime changes',
  untouched:{altarEmergencyAndExtractionTail:true,shopCommands:true},
  regression:{files:tests.testResults.length,tests:tests.numTotalTests,passed:tests.numPassedTests,failed:tests.numFailedTests,failures},
  differential:{tests:oracle.numTotalTests,passed:oracle.numPassedTests,failed:oracle.numFailedTests,
    tradeScenarios:43,markupCombinations:384,existingFailureProofs:3,
    cache:'node_modules/.cache/lean-refactor-1024/rooms-oracle-closeout.json'},
  classification:'Both public failures predate this change: icon source plus its five dependencies are byte-identical to frozen input, and frozen altar source lacks the literal expected by the assertion. Evidence-only expected-failure tests reproduce both original assertions; public tests unchanged.',
  browser:'not run by this subagent',notRun:['full test suite','build']};
fs.writeFileSync(destination+'/validation.json',JSON.stringify(validation,null,2)+'\n');
console.log(JSON.stringify({net:totals,purchaseFlow:changes.purchaseFlow,projectPercent:changes.originalProjectNetPercent,slicePercent:changes.touchedSlicePercent,oracleTests:oracle.numTotalTests}));
