import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pose,geometry,SIZE,REST,WEAPON} from './rig.js';
const length=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const expectedUpper=length(REST.shoulder,REST.elbow),expectedLower=length(REST.elbow,REST.wrist),expectedSword=length(WEAPON[0],WEAPON[9]);
let boneError=0,swordError=0;const bounds=[Infinity,Infinity,-Infinity,-Infinity];
for(let i=0;i<=240;i++){
 const g=geometry(pose(i/240));
 boneError=Math.max(boneError,Math.abs(length(g.shoulder,g.elbow)-expectedUpper),Math.abs(length(g.elbow,g.wrist)-expectedLower));
 swordError=Math.max(swordError,Math.abs(length(g.weapon[0],g.weapon[9])-expectedSword));
 for(const [x,y] of g.weapon){
  assert(Number.isFinite(x+y));const sx=x+SIZE.padX,sy=y+SIZE.padY;
  assert(sx>0&&sx<SIZE.width&&sy>0&&sy<SIZE.height,'sword leaves canvas');
  assert(sy<634,'sword overlaps fixed sole band');
  bounds[0]=Math.min(bounds[0],sx);bounds[1]=Math.min(bounds[1],sy);bounds[2]=Math.max(bounds[2],sx);bounds[3]=Math.max(bounds[3],sy);
 }
}
assert(boneError<1e-9);assert(swordError<1e-9);
const a=pose(.30),b=pose(.35);
assert(Math.abs(b.upper-a.upper)<1e-12,'upper arm moves before lead finishes');
assert((b.lower-a.lower)*180/Math.PI>30,'forearm lead is not visible');
for(const key of ['upper','lower','wrist','lean','lunge','squat'])assert(Math.abs(pose(0)[key]-pose(1)[key])<1e-12);
const report={passed:true,samples:241,canvas:[SIZE.width,SIZE.height],boneLengthError:boneError,swordLengthError:swordError,weaponBounds:bounds,forearmLeadDegrees:(b.lower-a.lower)*180/Math.PI,upperArmDuringLeadDegrees:0,endpointPoseIdentical:true};
writeFileSync(new URL('./geometry-validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
