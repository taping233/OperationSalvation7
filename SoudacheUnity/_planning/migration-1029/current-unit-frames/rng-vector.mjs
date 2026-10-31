import fs from 'node:fs';import path from 'node:path';import {fileURLToPath,pathToFileURL} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const {SeededRandomService}=await import(pathToFileURL(path.resolve(here,'../../../../搜打撤/game/src/core/random-service.js')));
const a=new SeededRandomService(123),b=new SeededRandomService(123);
const value={seed:123,sourceCall:'random("status", "generation")',sourceValue:a.random('status','generation'),legacyCall:'random("status")',legacyValue:b.random('status')};
fs.writeFileSync(path.join(here,'rng-source-vector.json'),JSON.stringify(value,null,2)+'\n');console.log(JSON.stringify(value));
