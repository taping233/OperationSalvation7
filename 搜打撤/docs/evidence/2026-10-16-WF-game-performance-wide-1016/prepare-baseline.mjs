import {readFileSync,writeFileSync} from 'node:fs';
const folder=new URL('./',import.meta.url);
const source=readFileSync(new URL('before/game.cardslib.page.js',folder),'utf8');
const rebased=source.replace(/(['"])(\.\.?\/[^'"\n]+)\1/g,(whole,quote,path)=>
  quote+new URL(path,'http://game.local/src/hub/game.cardslib.page.js').pathname+quote);
writeFileSync(new URL('photo-render-before.js',folder),rebased);
