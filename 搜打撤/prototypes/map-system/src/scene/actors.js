import { T, part } from './primitives.js';
import { CHARACTERS, characterFor } from '../characters.js';
/** Articulated low-poly models. Stable named joints also serve the GLB export pipeline. */
function createActor(id) {
  const c=characterFor(id)||CHARACTERS[0], root=new T.Group();
  root.name=c.id;
  const rig=new T.Group(); root.add(rig); rig.name='rig';rig.scale.setScalar(c.scale);
  const broad=c.id==='xuanli'?1.5:1;
  part(rig,c.outfit,[0,1.55,0],[.36*broad,.85,.24],'cylinder');
  part(rig,'#202932',[0,1.03,0],[.34*broad,.23,.24],'cylinder');
  part(rig,c.color,[0,1.42,.215],[.10,.66,.035]);
  const head=new T.Group();head.position.y=2.22;head.name='head';rig.add(head);
  part(head,c.skin,[0,0,0],[.3,.34,.26],'sphere');
  part(head,c.hair,[0,.16,-.025],[.32,.25,.285],'sphere');
  part(head,c.skin,[0,-.03,.11],[.27,.29,.19],'sphere');
  for(const side of [-1,1]) {
    part(head,'#202932',[side*.105,.035,.268],[.045,.045,.018]);
    part(head,c.hair,[side*.25,.04,-.005],[.10,.25,.22],'sphere');
    const fringe=part(head,c.hair,[side*.12,.22,.23],[.10,.23,.09],'cone');fringe.rotation.z=side*.35;
  }
  if(c.id==='shuangling') {
    part(head,c.color,[0,.16,-.32],[.17,.12,.12]);
    const pony=part(head,c.hair,[0,-.18,-.4],[.17,.72,.17],'sphere');pony.rotation.x=-.35;
  }
  if(c.id==='baiqi') for(const side of [-1,1]) {
    const glass=part(head,'#36424b',[side*.115,.045,.282],[.20,.12,.023]);
    part(glass,'#a4b8bd',[0,0,.6],[.78,.66,.2]);
  }
  if(c.id==='lituan') {
    part(head,'#a17b4d',[0,.3,0],[.49,.07,.43],'cylinder');
    part(head,'#796048',[0,.43,0],[.31,.25,.29],'cylinder');
    part(rig,'#8a6544',[.40,1.18,-.05],[.34,.48,.33]);
  }
  if(c.id==='dengkui') {
    part(rig,'#364d4a',[0,1.57,-.36],[.47,.60,.26]);
    part(rig,'#efc873',[0,1.66,-.51],[.32,.35,.035]);
    part(rig,'#82bcb0',[.25,1.78,.235],[.11,.22,.02]);
    part(rig,'#82bcb0',[.25,1.78,.25],[.21,.07,.02]);
  }
  if(c.id==='baiqi'||c.id==='dengkui') for(const side of [-1,1]) part(rig,c.outfit,[side*.22,.98,-.10],[.30,.58,.37]);
  // Layered coat panels and shoulder straps break up the silhouette.
  for(const side of [-1,1]) {
    const coat=part(rig,c.outfit,[side*.26,.97,-.10],[.29,.60,.28]);coat.rotation.z=side*.12;
    part(rig,'#67747b',[side*.27,1.72,.22],[.055,.40,.035]);
    part(rig,c.color,[side*.22,1.18,.24],[.14,.10,.07]);
  }
  const joints={};
  for(const side of [-1,1]) {
    const leg=new T.Group(); leg.name=side<0?'legL':'legR';leg.position.set(side*.19*broad,1.04,0);rig.add(leg);
    part(leg,'#26323b',[0,-.37,0],[.115,.68,.125],'cylinder');part(leg,'#19232a',[0,-.83,.07],[.25,.25,.40]);
    const arm=new T.Group();arm.name=side<0?'armL':'armR';arm.position.set(side*.46*broad,1.9,0);rig.add(arm);
    part(arm,c.id==='xuanli'?c.skin:c.outfit,[0,-.25,0],[.125*broad,.49,.14],'cylinder');
    part(arm,'#26333c',[0,-.57,.02],[.13*broad,.26,.15],'cylinder');
    if(c.id==='xuanli')part(arm,'#586369',[0,-.54,.1],[.38,.38,.42]);
    joints[leg.name]=leg;joints[arm.name]=arm;
  }
  if(c.id==='shuangling') {
    part(joints.armR,'#bacad0',[.06,-.53,.66],[.06,.065,1.23]);
    part(joints.armR,c.color,[.06,-.53,.12],[.25,.13,.08]);
  } else if(c.id==='lituan'||c.id==='dengkui') {
    part(joints.armR,'#aa9a72',[0,-.43,.30],[.10,1.25,.1]);
    part(joints.armR,c.color,[0,.26,.30],[.22,.26,.2],'sphere');
  } else if(c.id==='baiqi') {
    const seal=part(joints.armR,c.color,[0,-.3,.6],[.36,.36,.07]);seal.rotation.z=Math.PI/4;
  }
  root.userData={rig,joints,head,character:c};
  return root;
}
function animateActor(actor,time,{moving=false,hit=0,dead=false,attack=0}={}) {
  const {rig,joints}=actor.userData;
  const stride=moving?Math.sin(time*11)*.55:Math.sin(time*2)*.025;
  joints.legL.rotation.x=stride;joints.legR.rotation.x=-stride;
  joints.armL.rotation.x=-stride; joints.armR.rotation.x=stride-attack*1.45;
  rig.position.y=moving?Math.abs(Math.sin(time*11))*.055:Math.sin(time*2)*.018;
  rig.rotation.z=dead?-Math.PI/2:hit*Math.sin(time*55)*.09;
}
function createEnemy(id='scavenger') {
  const root=createActor(id.includes('orc')?'xuanli':id.includes('el')?'baiqi':'shuangling');
  const color=id.includes('fire')?'#b76348':id.includes('water')?'#659eae':id.includes('grass')?'#708b65':id.includes('boss')?'#8b677f':'#616e70';
  const helmet=new T.Group(); root.userData.head.add(helmet);
  part(helmet,color,[0,.09,.04],[.34,.30,.31],'sphere');
  part(helmet,'#ee9a6c',[0,.04,.355],[.43,.055,.025]);
  if(id.includes('boss')) {root.scale.setScalar(1.35);for(const s of [-1,1])part(helmet,'#c6bdac',[s*.30,.4,0],[.12,.45,.13],'cone');}
  if(id.includes('el')) {const gem=part(helmet,color,[0,.48,0],[.32,.55,.32],'cone');gem.rotation.z=.2;}
  return root;
}
export { createActor, createEnemy, animateActor };
