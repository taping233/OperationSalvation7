import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath}from'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..'),packet=JSON.parse(fs.readFileSync(path.join(here,'current-catalog.json'),'utf8'));
const verify=process.argv.includes('--check'),write=(file,content)=>verify?assert.equal(fs.readFileSync(file,'utf8'),content):fs.writeFileSync(file,content);
const data='// Generated from current Cards.PRICE/SHOP_WEIGHTS/DROP_WEIGHTS.\nusing System.Collections.Generic;\nnamespace Sdt.Core { public static class CurrentBalanceData {\n'
 +Object.entries(packet.policies).map(([key,values])=>' public static readonly IReadOnlyDictionary<string,'+(key==='dropWeights'?'double':'int')+'> '+key[0].toUpperCase()+key.slice(1)+'=new Dictionary<string,'+(key==='dropWeights'?'double':'int')+'> { '+Object.entries(values).map(([k,v])=>'{'+JSON.stringify(k)+','+v+'}').join(', ')+' };').join('\n')+'\n} }\n';
write(path.join(root,'Assets/Scripts/Sdt.Core/Data/CurrentBalanceData.cs'),data);
const target=path.join(root,'Assets/Scripts/Sdt.Core/GameRules.cs'),old=fs.readFileSync(target,'utf8'),aliases=old.slice(old.indexOf('        // 顶层别名'));
const groups={...packet.config,map:{diceSides:6,...packet.config.map}};
const rules='// Generated from the current rule-config.js; top-level aliases preserve existing callers.\nnamespace Sdt.Core { public static class GameRules {\n'+Object.entries(groups).map(([name,values])=>' public static class '+name[0].toUpperCase()+name.slice(1)+' {\n'+Object.entries(values).map(([k,v])=>'  public const '+(Number.isInteger(v)?'int':'double')+' '+k[0].toUpperCase()+k.slice(1)+' = '+v+';').join('\n')+'\n }').join('\n')+'\n'+aliases;
write(target,rules);console.log(JSON.stringify({groups:Object.keys(packet.config),policies:packet.policies}));
