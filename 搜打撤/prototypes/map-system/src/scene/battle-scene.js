import { T, part, mergeStatic } from './primitives.js';
import { createActor, createEnemy, animateActor } from './actors.js';
function createBattleScene(){
  const scene=new T.Scene();scene.background=new T.Color('#283942');
  scene.add(new T.HemisphereLight('#e5eff4','#344652',1.05));const sun=new T.DirectionalLight('#ffe0b7',1.6);sun.position.set(-8,15,10);scene.add(sun);
  const env=new T.Group();part(env,'#a7b5b7',[0,-.25,0],[50,.5,24]);
  for(let i=-20;i<22;i+=3){const h=2+Math.abs(Math.sin(i))*4;part(env,'#435760',[i,h/2,-7],[2,h,2]);part(env,'#d0d8d5',[i,h+.1,-7],[2.1,.2,2.1]);part(env,'#bca67a',[i,h*.65,-5.98],[.5,.5,.02]);}
  for(let i=-18;i<20;i+=2.1){
    part(env,'#526974',[i,1.8,-5.5],[.12,3.6,.2]);
    part(env,'#657a81',[i,2.8,-5.4],[1.7,.12,.2]);
    const rubble=part(env,'#819394',[i,.18,-3],[.6,.35,.4]);rubble.rotation.y=i;
    part(env,'#d4dfd9',[i,.32,-3],[.65,.09,.45]);
  }
  part(env,'#697c83',[0,.015,1],[44,.04,1.8]);
  for(let i=-20;i<21;i+=2)part(env,'#b8baaa',[i,.05,1],[.7,.025,.08]);
  scene.add(mergeStatic(env));
  const camera=new T.OrthographicCamera(-12,12,6,-6,.1,100);camera.position.set(0,8,20);camera.lookAt(0,1,0);
  const actors=new Map();let previous=null,actionUntil=0,layoutKey='',cachedTargets=[];
  function sync(snapshot,time,canvasRect){
    const aspect=canvasRect.width/canvasRect.height;camera.left=-8*aspect;camera.right=8*aspect;camera.top=8;camera.bottom=-8;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    if(previous&&snapshot){if(snapshot.player.hp!==previous.player.hp||snapshot.foes.some((f,i)=>f.hp!==previous.foes[i]?.hp))actionUntil=time+.5;}
    previous=snapshot;
    const stage=document.querySelector('.battle-stage');
    const sizeKey=[canvasRect.width,canvasRect.height].join('|');
    const relayout=stage!==layoutKey||sizeKey!==scene.userData.sizeKey;
    if(relayout){layoutKey=stage;scene.userData.sizeKey=sizeKey;}
    const targets=relayout?[{key:'self',id:snapshot.player.characterId||snapshot.player.myClass,el:document.querySelector('#btSelf .sts-figure'),dead:snapshot.player.hp<=0},...snapshot.foes.map((f,i)=>({key:`foe-${i}`,id:f.id||f.name,el:document.querySelector(`.bt-foe[data-eidx="${i}"] .sts-figure`),dead:f.dead}))]:cachedTargets;
    cachedTargets=targets;
    const live=new Set();const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,0,1),0);
    for(const t of targets){if(!t.el)continue;live.add(t.key);let actor=actors.get(t.key);if(!actor||actor.userData.sourceId!==t.id){if(actor)scene.remove(actor);actor=t.key==='self'?createActor(t.id):createEnemy(t.id);actor.userData.sourceId=t.id;actors.set(t.key,actor);scene.add(actor);}
      if(relayout){const r=t.el.getBoundingClientRect(),x=(r.left+r.width/2-canvasRect.left)/canvasRect.width*2-1,y=1-(r.bottom-canvasRect.top)/canvasRect.height*2;
      ray.setFromCamera(new T.Vector2(x,y),camera);const p=new T.Vector3();ray.ray.intersectPlane(plane,p);actor.position.copy(p);actor.scale.setScalar(Math.max(.4,r.height/canvasRect.height*16/2.7));actor.rotation.y=t.key==='self'?.5:-.5;}
      const dead=t.key==='self'?snapshot.player.hp<=0:snapshot.foes[Number(t.key.split('-')[1])]?.dead;
      animateActor(actor,time,{dead,attack:time<actionUntil&&!t.dead?Math.sin((actionUntil-time)*6):0,hit:time<actionUntil?1:0});
    }
    for(const [key,actor] of actors)if(!live.has(key)){scene.remove(actor);actors.delete(key);}
  }
  return {scene,camera,sync};
}
export { createBattleScene };
