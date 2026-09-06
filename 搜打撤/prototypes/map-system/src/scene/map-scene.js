import { T, part, mergeStatic } from './primitives.js';
import { createActor, animateActor } from './actors.js';
const UNIT=1/48;
const TYPE_COLORS={battle:'#b86f60',boss:'#9b709a',altar:'#a98bbc',shop:'#dcba7c',chest:'#c9a765',fire:'#e3a969',door:'#93b8ae',entrance:'#91b8ae',emergencyExit:'#91b8ae'};
function createMapScene(game) {
  const scene=new T.Scene();scene.background=new T.Color('#9faeb4');scene.fog=new T.Fog('#9faeb4',32,75);
  scene.add(new T.HemisphereLight('#d1e2ef','#344957',1.05));
  const sun=new T.DirectionalLight('#fff1d7',1.65);sun.position.set(-12,28,9);scene.add(sun);
  const environment=new T.Group();
  part(environment,'#535f66',[15,-.60,15],[32,1.2,32]);
  part(environment,'#ced6d5',[15,.015,15],[30,.08,30]);
  const centers=game.nodes.map(n=>({...n,wx:n.x*UNIT,wz:n.y*UNIT}));
  // Roads retain exact logical ring order; scene decoration never changes movement topology.
  function road(a,b,color='#8c999c') {
    const dx=b.wx-a.wx,dz=b.wz-a.wz;
    const mesh=part(environment,color,[(a.wx+b.wx)/2,.10,(a.wz+b.wz)/2],[.32,.06,Math.hypot(dx,dz)]);
    mesh.rotation.y=Math.atan2(dx,dz);
  }
  for(let li=0;li<3;li++) {
    const ring=centers.filter(n=>n.li===li).sort((a,b)=>a.idx-b.idx);
    ring.forEach((n,i)=>road(n,ring[(i+1)%ring.length]));
  }
  for(const [li,layer] of game.layerData.entries()) for(const d of layer.doors||[]) {
    const a=centers.find(n=>n.li===li&&n.idx===d.at),b=centers.find(n=>n.li===d.toLayer&&n.idx===(d.arriveAt??0));
    if(a&&b)road(a,b,'#b7a57f');
  }
  for(let x=1;x<30;x+=2.5)for(let z=1;z<30;z+=2.5) {
    if(centers.some(n=>Math.hypot(n.wx-x,n.wz-z)<1.35))continue;
    const seed=Math.abs(Math.sin(x*31+z*71));
    if(seed<.3)continue;
    const h=.4+seed*1.5;
    part(environment,'#68777e',[x,h/2,z],[.8+seed*.5,h,.8]);
    part(environment,'#e0e5df',[x,h+.05,z],[.9+seed*.5,.12,.9]);
    if(seed>.68)part(environment,'#d8b876',[x,h*.63,z+.41],[.25,.32,.02]);
    part(environment,'#475963',[x-.34,h*.45,z+.45],[.10,h,.10]);
    part(environment,'#8e9f9f',[x,h*.25,z+.55],[1.1,.12,.32]);
    if(seed>.8){
      const debris=part(environment,'#697d83',[x+.60,.20,z+.2],[.40,.4,.6]);debris.rotation.y=seed*4;
    }
  }
  // Snow drifts, forest edge and perimeter pylons establish three readable districts.
  for(let i=0;i<52;i++){
    const a=i*2.399,r=13+(i%5)*.48,x=15+Math.cos(a)*r,z=15+Math.sin(a)*r;
    part(environment,'#364f52',[x,.85,z],[.50,1.6,.50],'cone');
    part(environment,'#d5dedb',[x,1.04,z],[.43,1.35,.43],'cone');
    part(environment,'#536067',[x,.2,z],[.10,.4,.10]);
  }
  for(let i=0;i<24;i++){
    const a=i*2.399,r=4+(i%4)*2.1,x=15+Math.cos(a)*r,z=15+Math.sin(a)*r;
    if(centers.some(n=>Math.hypot(n.wx-x,n.wz-z)<.7))continue;
    const snow=part(environment,'#e1e6e0',[x,.10,z],[.65,.15,.37],'sphere');snow.rotation.y=a;
  }
  const labels=[];
  for(const n of centers) {
    const group=new T.Group();group.position.set(n.wx,.1,n.wz);environment.add(group);
    const type=n.def.type,col=TYPE_COLORS[type]||'#a6b9bc';
    part(group,'#526168',[0,.07,0],[.75,.14,.75],'cylinder');
    part(group,col,[0,.16,0],[.63,.08,.63],'cylinder');
    if(type==='door'||type==='entrance'||type==='emergencyExit') {
      for(const x of [-.40,.40])part(group,'#52656b',[x,.65,0],[.17,1.1,.26]);
      part(group,col,[0,1.22,0],[1,.16,.3]);
    }else if(type==='shop') {
      part(group,'#576b68',[0,.43,0],[.80,.54,.65]);
      part(group,'#d9cba6',[0,.85,0],[1.05,.3,.9],'cone');
    }else if(type==='battle'||type==='boss') {
      part(group,'#50515e',[0,.5,0],[.58,.60,.50]);
      part(group,col,[0,.95,0],[.28,.5,.28],'cone');
    }else if(type==='altar') {
      part(group,'#665b77',[0,.4,0],[1,.5,1],'cylinder');
      part(group,'#c0abd7',[0,1.2,0],[.48,1.45,.48],'cone');
    }else if(type==='fire') {
      part(group,'#7e6653',[0,.3,0],[.55,.22,.5]);part(group,col,[0,.61,0],[.23,.5,.23],'cone');
    }else {part(group,type==='chest'?'#8a7558':'#74858a',[0,.35,0],[.45,.30,.38]);part(group,col,[0,.52,0],[.4,.04,.35]);}
    labels.push(n);
  }
  scene.add(mergeStatic(environment));
  let actor=createActor(game.characterId||game.myClass);actor.scale.multiplyScalar(.50);scene.add(actor);
  let actorKey=game.characterId||game.myClass;
  const halo=part(scene,'#e6bc75',[0,.18,0],[.57,.035,.57],'cylinder');
  function update(time) {
    const key=game.characterId||game.myClass;
    if(key!==actorKey){scene.remove(actor);actor=createActor(key);actor.scale.multiplyScalar(.50);scene.add(actor);actorKey=key;}
    const x=game.pos.x*UNIT,z=game.pos.y*UNIT;
    if(game.state==='moving') {const dx=x-actor.position.x,dz=z-actor.position.z;if(Math.hypot(dx,dz)>.001)actor.rotation.y=Math.atan2(dx,dz);}
    actor.position.set(x,.22,z);halo.position.set(x,.20,z);
    animateActor(actor,time,{moving:game.state==='moving'});
  }
  return {scene,labels,update};
}
export { createMapScene, UNIT };
