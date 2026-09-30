import {describe,expect,it} from 'vitest';
import {resolveEncounterGroup,selectEncounterSpec} from '../game/src/run/encounter-selector.js';
import map from '../game/data/map.json';

const seq=(...values)=>{let i=0;return()=>values[Math.min(i++,values.length-1)];};
describe('R7-a encounter selector',()=>{
  it('elite roll stays first and preserves existing probability path',()=>{
    const out=selectEncounterSpec(map.encounters[3],map.monsters,seq(.05,.99));
    expect(out.value).toMatchObject({kind:'elite',enemyIds:['dragon'],rewardKind:'elite'});
  });
  it('selects each reviewed group with fixed ordered enemy ids',()=>{
    const l2=selectEncounterSpec(map.encounters[1],map.monsters,seq(.99,.99));
    expect(l2.value).toMatchObject({kind:'group',encounterId:'l2-archer-cavalry',enemyIds:['archer','cavalry'],size:[2,2]});
    const l4=selectEncounterSpec(map.encounters[3],map.monsters,seq(.99,.99));
    expect(l4.value).toMatchObject({kind:'group',encounterId:'l4-fire-grass',enemyIds:['fire_el','grass_el'],size:[2,2]});
  });
  it('invalid selected group falls back by index without another random draw',()=>{
    let calls=0; const enc=structuredClone(map.encounters[1]); enc.groups[0].enemyIds=['missing','cavalry'];
    const out=selectEncounterSpec(enc,map.monsters,()=>{calls++;return .99;});
    expect(calls).toBe(1); expect(out.value).toMatchObject({kind:'entry',encounterId:'entry:infantry',fallbackReason:'INVALID_GROUP'});
  });
  it.each([
    ['duplicate id',enc=>enc.groups.push(structuredClone(enc.groups[0]))],
    ['wrong member count',enc=>{enc.groups[0].enemyIds=['archer'];}],
    ['wrong fixed size',enc=>{enc.groups[0].size=[1,2];}],
  ])('%s uses the same bounded fallback choice',(_name,breakGroup)=>{
    let calls=0;const enc=structuredClone(map.encounters[1]);breakGroup(enc);
    const out=selectEncounterSpec(enc,map.monsters,()=>{calls++;return .99;});
    expect(calls).toBe(1);expect(out.value.kind).toBe('entry');expect(out.value.fallbackReason).toBe('INVALID_GROUP');
  });
  it('resolves only one valid fixed catalog group for isolated QA',()=>{
    expect(resolveEncounterGroup(map.encounters,map.monsters,'l4-fire-grass').value.enemyIds).toEqual(['fire_el','grass_el']);
    expect(resolveEncounterGroup(map.encounters,map.monsters,'missing').code).toBe('INVALID_GROUP');
  });
});
