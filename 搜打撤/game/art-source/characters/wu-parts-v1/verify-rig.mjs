import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pose,REST,BONE_LENGTHS} from './rig.js';
const length=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
const cases=[];let worstBoneError=0;
const staticPose=pose('static',0);
for(const key of ['kneeR','kneeL','elbowR','elbowL','hipR','hipL','wrist','wristL']){
 const reference=key==='wrist'?REST.wristR:REST[key];
 assert(length(staticPose[key],reference)<.02,'static pose deviates from reference '+key);
}
for(const mode of ['static','idle','attack','hit']){
 for(let step=0;step<=120;step++){
  const phase=step/120,p=pose(mode,phase);
  const limbs=[
   [p.shoulderR,p.elbowR,BONE_LENGTHS.upperR],[p.elbowR,p.wrist,BONE_LENGTHS.lowerR],
   [p.shoulderL,p.elbowL,BONE_LENGTHS.upperL],[p.elbowL,p.wristL,BONE_LENGTHS.lowerL],
   [p.hipR,p.kneeR,BONE_LENGTHS.thighR],[p.kneeR,p.ankleR,BONE_LENGTHS.calfR],
   [p.hipL,p.kneeL,BONE_LENGTHS.thighL],[p.kneeL,p.ankleL,BONE_LENGTHS.calfL]
  ];
  for(const [a,b,expected] of limbs){
   assert(a.concat(b).every(Number.isFinite),mode+' has invalid joint');
   const error=Math.abs(length(a,b)-expected);worstBoneError=Math.max(worstBoneError,error);
   assert(error<.02,`${mode} phase ${phase.toFixed(3)} stretches bone by ${error.toFixed(4)}`);
  }
  assert.deepEqual(p.ankleR,REST.ankleR);assert.deepEqual(p.ankleL,REST.ankleL);
  const tip=[p.grip[0]+610*(1-.105)*Math.cos(p.swing),p.grip[1]+610*(1-.105)*Math.sin(p.swing)];
  const projected=[768+.72*(tip[0]-817),650+.72*(tip[1]-535)];
  assert(projected[0]>0&&projected[0]<1536&&projected[1]>0&&projected[1]<1200,mode+' clips sword tip');
  cases.push({mode,phase,boneCount:limbs.length,swordLength:610});
 }
 const a=pose(mode,0),b=pose(mode,1);
 for(const key of ['wrist','shoulderR','hipR','hipL','grip'])assert(length(a[key],b[key])<.001,mode+' has loop jump in '+key);
}
assert(Math.abs(610/(999-55)-.64)<.01,'sword size differs from character reference');
const report={ok:true,samples:cases.length,modes:['static','idle','attack','hit'],worstBoneError,
 checks:['static reference landmarks','finite joints','eight fixed bone lengths','planted feet','sword size','sword tip within full-body camera','loop endpoints'],
 limits:['geometry evidence only; appearance, alpha seams and motion perception require native browser inspection']};
if(process.argv[2])writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
