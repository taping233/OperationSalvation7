import { defineConfig } from 'vitest/config';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const names = new Set([
  'getSnapshot', 'captureSnapshotInput', 'snapshotSignature', 'createBattleSnapshotSignature', 'createBattleSnapshot',
  'render', 'showBattleStage', 'syncBattleSlot', 'mountHandLayer', 'mountUnitLayer', 'updateHand', 'handGroupState',
  'updateUnits', 'updateFoes', 'updateSelfUnit', 'updateAllies', 'forecastEnemyTurn', 'calculateEnemyIntent',
  'unplayableReason', 'handUnplayableReason', 'inspectCardPlay', 'getCardPlayAvailability', 'getPreviewContext',
  'previewAction', 'performCardPlay', 'submitCardPlay', 'resolveCard', 'resolveCardWithFeedback',
]);
export default defineConfig({
  root,
  plugins: [{
    name: 'battle-read-only-segment-probe', enforce: 'pre',
    load(id){
      if((process.env.BATTLE_PROBE_AB==='1'||process.env.BATTLE_PROBE_SOURCE==='before') && id.replaceAll('\\','/').split('?')[0].endsWith('/game/src/battle/view/battle.layers.js'))
        return readFileSync(new URL('./battle.layers.js.before.txt',import.meta.url),'utf8');
    },
    transform(code, id) {
      if (!id.replaceAll('\\','/').includes('/game/src/battle/')) return;
      if(process.env.BATTLE_PROBE_AB==='1' && id.replaceAll('\\','/').endsWith('/view/battle.layers.js')){
        const original=`if (rec.sig !== renderSig) {\r\n        rec.card.innerHTML = SDT.Icons.rich(st.inner);\r\n        const desc = rec.card.querySelector('.hsc-desc');\r\n        if (desc && readingHint && !desc.textContent.includes(st.blockedReason || readingHint)) {\r\n          const hint = document.createElement('span');\r\n          hint.className = 'bt-rulehint';\r\n          hint.textContent = readingHint;\r\n          if (st.blockedReason) desc.prepend(hint);\r\n          else desc.appendChild(hint);\r\n        }\r\n        rec.sig = renderSig;\r\n      }`.replaceAll('\r\n','\n');
        const signature='const renderSig = `${st.inner}\\u0000${st.ruleHint}\\u0000${st.blockedReason}`;\n      ';
        code=code.replaceAll('\r\n','\n');if(!code.includes(signature+original))throw new Error('Review the updateHand source before replaying candidate');
        const finalSource=readFileSync(new URL('./battle.layers.js.after.txt',import.meta.url),'utf8').replaceAll('\r\n','\n');
        const start=finalSource.indexOf('      if (rec.sig !== st.inner) {');
        const end=finalSource.indexOf("      const face = rec.card.querySelector('.hs-card');",start);
        if(start<0||end<0)throw new Error('Missing saved production card/hint patch');
        const candidate=`if (globalThis.__battleCandidate) { ${finalSource.slice(start,end)} } else { ${signature}${original} }`;
        code=code.replace(signature+original,candidate);
      }
      if(process.env.BATTLE_PROBE_INSTRUMENT !== '1')return {code,map:null};
      const changes=[];
      simple(parse(code,{ecmaVersion:'latest',sourceType:'module'}),{
        FunctionDeclaration(node) {
          if (!names.has(node.id?.name)) return;
          const tag=`${id.replaceAll('\\','/').split('/game/src/')[1]}:${node.id.name}`;
          changes.push({at:node.body.start+1,text:`const __bp=globalThis.__battleProbe;const __bt=__bp?.enter(${JSON.stringify(tag)});try{`});
          changes.push({at:node.body.end-1,text:`}finally{if(__bp)__bp.leave(${JSON.stringify(tag)},__bt);}`});
        },
      });
      for(const edit of changes.sort((a,b)=>b.at-a.at)) code=code.slice(0,edit.at)+edit.text+code.slice(edit.at);
      return {code,map:null};
    },
  }],
  test:{environment:'jsdom',include:['docs/evidence/2026-10-18-WF-deep-runtime-1018/battle/probe.test.js'],pool:'forks',maxWorkers:1,minWorkers:1,testTimeout:120000},
});
