import {T,C,mesh,piece,beam,ring,profile,ribbon,surface,bake,dispose} from './atelier.js';
import {CHARACTERS,characterFor} from '../characters.js';

function coatPanel(parent,color,start,end,length=1.1){
  const p=[],uv=[],ix=[],rows=10,cols=18;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const u=i/cols,v=j/rows,a=start+(end-start)*u,r=.28+v*.16+Math.sin(u*Math.PI*6)*.024*v;
    p.push(Math.sin(a)*r,1.72-v*length+Math.sin(u*Math.PI)*.045*v,Math.cos(a)*r*.79-v*.09);uv.push(u,v);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;ix.push(a,b,a+1,a+1,b,b+1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();mesh(parent,g,surface(color,'cloth'));
}
function hand(parent,x,y,z,color,gauntlet=false){
  piece(parent,color,[x,y,z],[.080,.11,.046],'sphere');
  for(let i=0;i<4;i++){const xx=x+(i-1.5)*.031,len=.08+(1-Math.abs(i-1.5)/2)*.027;beam(parent,[xx,y-.05,z],[xx,y-.05-len,z+.02],.015,surface(color));piece(parent,color,[xx,y-.05-len,z+.02],[.016,.022,.018],'sphere');}
  beam(parent,[x-.057,y+.015,z],[x-.10,y-.057,z+.043],.025,surface(color));
  if(gauntlet){piece(parent,'#4c5960',[x,y+.025,z+.048],[.108,.115,.043],'sphere','metal');for(let i=0;i<4;i++)piece(parent,C.brass,[x+(i-1.5)*.044,y-.08,z+.05],[.018,.025,.025],'box','metal');}
}
function face(head,c,{mask=false}={}){
  piece(head,c.skin,[0,0,0],[.234,.285,.224],'sphere');
  piece(head,c.skin,[0,-.091,.104],[.181,.161,.138],'sphere');
  for(const side of [-1,1])piece(head,c.skin,[side*.231,-.012,-.003],[.035,.067,.027],'sphere');
  if(mask){
    profile(head,'#667680',[[-.19,.11,.07,0,.173],[-.1,.19,.095,0,.174],[.04,.203,.065,0,.180],[.09,.175,.035,0,.175]],{finish:'metal'});
    for(const side of [-1,1]){piece(head,'#182832',[side*.097,.043,.232],[.058,.013,.012],'sphere');piece(head,'#dcaa77',[side*.097,.043,.244],[.037,.009,.007],'sphere','glow');}
    for(let i=-1;i<=1;i++)piece(head,'#2b3b42',[i*.045,-.112,.265],[.019,.06,.01]);return;
  }
  piece(head,c.skin,[0,-.015,.236],[.024,.038,.036],'sphere');
  const eyeColor=c.id==='dengkui'?'#bc9a60':c.id==='baiqi'?'#776c83':c.id==='lituan'?'#95683f':'#628a99';
  for(const side of [-1,1]){
    piece(head,'#e7e5e0',[side*.091,.031,.217],[.072,.028,.034],'sphere');
    piece(head,eyeColor,[side*.091,.032,.247],[.025,.026,.009],'sphere');piece(head,'#17262e',[side*.091,.032,.255],[.010,.021,.007],'sphere');
    piece(head,'#f5f3e7',[side*.088,.043,.261],[.007,.007,.003],'sphere','glow');
    ribbon(head,'#293039',[[side*.034,.050,.241],[side*.094,.064,.245],[side*.160,.043,.221]],[.005,.008,.001],.003);
    beam(head,[side*.04,.113,.218],[side*.147,.105,.197],.009,surface(c.hair));
  }
  ribbon(head,'#9e7270',[[-.035,-.131,.237],[0,-.135,.247],[.035,-.13,.236]],[.001,.005,.001],.002);
}
function hair(head,c){
  const cap=new T.SphereGeometry(1,28,18,0,Math.PI*2,0,Math.PI*.56);mesh(head,cap,surface(c.hair),[0,.074,-.031],[.25,.275,.246]);
  if(c.id==='xuanli'){
    for(let i=0;i<13;i++){const a=i*.9;piece(head,c.hair,[Math.sin(a)*.19,.245+Math.cos(a)*.025,Math.cos(a)*.18],[.068,.14,.07],'icosa').rotation.z=Math.sin(a)*.3;}return;
  }
  const short=c.id==='baiqi';
  for(let i=0;i<9;i++){
    const x=(i-4)*.055,tip=short?.03:-.04;
    ribbon(head,c.hair,[[x*.55,.29,-.025],[x,.225,.175],[x+(i%2?.025:-.035),tip+(i%3)*.031,.239]],[.031,.041,.001],.028);
  }
  for(const side of [-1,1]){
    const len=c.id==='dengkui'?.34:short?.14:.45;
    for(let i=0;i<4;i++)ribbon(head,c.hair,[[side*.21,.19,-.11+i*.058],[side*.25,-.05,-.1+i*.05],[side*(.22+i*.018),-len,-.07+i*.04]],[.035,.039,.001],.032);
  }
  if(c.id==='shuangling'){
    piece(head,'#3c4149',[0,.16,-.262],[.10,.055,.062],'sphere');
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2;ribbon(head,c.hair,[[Math.sin(a)*.065,.18,-.27],[.04+Math.sin(a)*.13,.03,-.49],[.16+Math.sin(a)*.10,-.38,-.58],[.25+Math.sin(a)*.10,-.92,-.58]],[.047,.056,.042,.001],.035);}
  }
}
function sword(parent){
  const blade=new T.Shape();blade.moveTo(-.044,0);blade.lineTo(-.042,1.12);blade.lineTo(0,1.30);blade.lineTo(.042,1.12);blade.lineTo(.044,0);blade.closePath();
  const g=new T.ExtrudeGeometry(blade,{depth:.017,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.004,bevelThickness:.004});
  const group=new T.Group();group.position.set(.03,-.75,.105);group.rotation.x=-1.03;group.rotation.z=-.22;parent.add(group);
  mesh(group,g,surface('#ccd9dd','metal'),[0,-.01,0]);piece(group,'#23303a',[0,-.13,.008],[.046,.26,.048],'cylinder');piece(group,C.brass,[0,0,.005],[.30,.05,.07],'box','metal');
  for(let i=0;i<5;i++)ring(group,'#8e8674',[0,-.04-i*.04,.007],.026);return group;
}
function build(c,{enemy=false,id=''}={}){
  const root=new T.Group(),rig=new T.Group(),torso=new T.Group(),head=new T.Group();root.name=c.id;root.add(rig);rig.name='rig';rig.add(torso);head.position.y=2.86;rig.add(head);
  const strong=c.id==='xuanli'||id.includes('orc'),broad=strong?1.43:1,white=c.id==='baiqi'||c.id==='dengkui',cloth=enemy?'#4a5358':white?'#d4d8d2':c.id==='lituan'?'#625748':'#d4dad7';
  const dark=enemy?'#28373e':'#222e38';
  profile(torso,dark,[[1.38,.23*broad,.15],[1.49,.27*broad,.17],[1.65,.19*broad,.13],[1.85,.235*broad,.16],[2.09,.295*broad,.19],[2.29,.30*broad,.17],[2.38,.13,.115]],{finish:'cloth'});
  if(strong){for(const s of [-1,1]){piece(torso,c.skin,[s*.23,2.12,.065],[.24,.28,.19],'sphere');piece(torso,'#354049',[s*.19,2.15,.23],[.20,.20,.055],'sphere','metal');}}
  if(white||enemy){
    for(const s of [-1,1])ribbon(torso,cloth,[[s*.23,2.37,.13],[s*.255,2.12,.195],[s*.20,1.85,.16],[s*.25,1.5,.19]],[.09,.10,.10,.12],.032);
    for(let i=0;i<4;i++)piece(torso,C.brass,[.13,2.01-i*.13,.193],[.022,.025,.013],'sphere','metal');
  }
  for(const s of [-1,1]){
    coatPanel(torso,cloth,s<0?-Math.PI:-.0,s<0?-.38:Math.PI-.38,c.id==='lituan'?.62:white?1.12:1.03);
    ribbon(torso,'#424b50',[[s*.23,2.32,.193],[s*.23,1.92,.183],[s*.20,1.64,.165]],[.025,.025,.025],.008);
    piece(torso,C.brass,[s*.23,2.18,.21],[.069,.05,.02],'box','metal');
    ribbon(torso,c.color,[[s*.235,1.69,.18],[s*.31,1.40,.24],[s*.39,.81,.23]],[.022,.021,.022],.006);
    piece(torso,dark,[s*.27,1.54,.22],[.11,.13,.058],'box','cloth');piece(torso,C.brass,[s*.27,1.57,.282],[.025,.035,.012],'box','metal');
  }
  profile(torso,'#514c45',[[1.62,.22*broad,.162],[1.70,.225*broad,.167]],{finish:'cloth'});piece(torso,C.brass,[0,1.66,.184],[.13,.095,.026],'box','metal');piece(torso,dark,[0,1.66,.203],[.08,.05,.01]);
  piece(torso,c.skin,[0,2.47,0],[.093,.24,.093],'cylinder');profile(torso,dark,[[2.34,.14,.13],[2.47,.125,.11]],{finish:'cloth'});
  face(head,c,{mask:enemy});if(!enemy)hair(head,c);else{
    const hood=new T.SphereGeometry(1,24,16,Math.PI*.28,Math.PI*1.45);mesh(head,hood,surface(cloth,'cloth'),[0,.03,-.015],[.29,.34,.27]);
    ribbon(head,cloth,[[-.25,-.08,.14],[-.24,.18,.18],[0,.32,.17],[.24,.18,.18],[.25,-.08,.14]],[.035,.042,.035,.042,.035],.018);
  }
  if(c.id==='baiqi'&&!enemy){for(const s of [-1,1]){ring(head,'#586168',[s*.097,.033,.267],.072,[0,0,0],.35).scale.y*=.64;}beam(head,[-.025,.04,.267],[.025,.04,.267],.006,surface('#586168','metal'));}
  if(c.id==='lituan'&&!enemy){
    profile(head,'#8b7455',[[.24,.50,.43],[.28,.52,.45],[.32,.29,.265],[.50,.265,.24],[.55,.22,.20]],{finish:'cloth'});
    profile(head,'#383938',[[.33,.292,.267],[.39,.285,.259]],{finish:'cloth'});piece(head,C.brass,[.04,.365,.272],[.07,.05,.02],'box','metal');
  }
  if(c.id==='dengkui'&&!enemy){
    piece(torso,'#35484a',[0,2.04,-.33],[.46,.63,.29],'box','metal');piece(torso,'#bfa77b',[0,2.04,-.491],[.29,.40,.05],'box','metal');piece(torso,C.light,[0,2.05,-.526],[.18,.26,.025],'box','glow');
    for(const s of [-1,1])piece(torso,dark,[s*.20,2.03,-.5],[.04,.65,.05]);
    piece(torso,'#dfded4',[.25,2.11,.22],[.13,.19,.015]);piece(torso,'#4d807d',[.25,2.11,.232],[.08,.028,.009]);piece(torso,'#4d807d',[.25,2.11,.235],[.028,.10,.008]);
  }
  const joints={};
  for(const s of [-1,1]){
    const leg=new T.Group();leg.position.set(s*.17*broad,1.43,0);leg.name=s<0?'legL':'legR';rig.add(leg);joints[leg.name]=leg;
    profile(leg,dark,[[-.73,.088,.096],[-.53,.10,.112],[-.28,.132*broad,.13],[0,.138*broad,.142]],{finish:'cloth'});
    profile(leg,enemy?'#343d40':'#28313a',[[-1.39,.125,.19,0,.09],[-1.33,.143,.24,0,.075],[-1.22,.12,.17,0,.02],[-.97,.087,.102],[-.71,.105,.108]],{finish:'matte'});
    piece(leg,'#131f29',[0,-1.39,.08],[.29,.065,.49]);piece(leg,'#69717a',[0,-.73,.098],[.077,.099,.026],'sphere','metal');
    for(let i=0;i<3;i++){piece(leg,'#485157',[0,-.92-i*.12,.119],[.21,.04,.02]);piece(leg,C.brass,[s*.075,-.92-i*.12,.137],[.036,.04,.016],'box','metal');}
    const arm=new T.Group();arm.position.set(s*.345*broad,2.27,0);arm.name=s<0?'armL':'armR';rig.add(arm);joints[arm.name]=arm;
    profile(arm,strong?c.skin:cloth,[[-.44,.09*broad,.094],[-.25,.12*broad,.13],[-.05,.14*broad,.14],[.05,.12*broad,.12]],{finish:'cloth'});
    profile(arm,dark,[[-.78,.071*broad,.063,0,.04],[-.65,.093*broad,.092,0,.02],[-.44,.10*broad,.096]],{finish:'cloth'});
    if(strong){piece(arm,'#4a5862',[0,-.60,.02],[.22,.25,.18],'sphere','metal');for(const k of [-1,1])piece(arm,C.brass,[k*.14,-.60,.15],[.035,.28,.032],'box','metal');}
    profile(arm,C.brass,[[-.78,.076*broad,.067,0,.04],[-.75,.081*broad,.072,0,.04]],{finish:'metal'});
    hand(arm,0,-.865,.04,enemy||!white?dark:c.skin,strong);
    arm.rotation.z=s*.11;arm.userData.restZ=s*.11;
  }
  if(c.id==='shuangling'&&!enemy)sword(joints.armR);
  if(enemy){
    if(/archer|jav/.test(id)){
      beam(joints.armR,[0,-.88,.09],[0,-.68,.80],.034,surface(C.wood));beam(joints.armR,[-.32,-.74,.51],[.32,-.74,.51],.028,surface(C.dark,'metal'));beam(joints.armR,[-.32,-.74,.51],[0,-.82,.27],.006,surface('#bab4a6'));beam(joints.armR,[.32,-.74,.51],[0,-.82,.27],.006,surface('#bab4a6'));
    }else{beam(joints.armR,[0,-.87,.02],[0,-.65,.65],.03,surface(C.wood));piece(joints.armR,'#899495',[0,-.64,.55],[.06,.29,.21],'box','metal').rotation.x=.36;}
  }
  if(c.id==='baiqi'&&!enemy){const seal=new T.Group();seal.position.set(0,-.73,.36);joints.armL.add(seal);ring(seal,'#ac95c1',[0,0,0],.21,[0,0,0]);for(let i=0;i<6;i++){const a=i*Math.PI/3;beam(seal,[Math.sin(a)*.18,Math.cos(a)*.18,0],[Math.sin(a+Math.PI*2/3)*.18,Math.cos(a+Math.PI*2/3)*.18,0],.007,surface('#ae95c6','glow'));}}
  if(['lituan','dengkui'].includes(c.id)&&!enemy){
    const lantern=new T.Group();joints.armR.add(lantern);lantern.position.set(0,-1.01,.05);ring(lantern,C.brass,[0,0,0],.105,[0,0,0]);piece(lantern,C.light,[0,-.24,0],[.14,.19,.14],'sphere','glow');
    for(let i=0;i<6;i++){const a=i/6*Math.PI*2;beam(lantern,[Math.sin(a)*.11,-.07,Math.cos(a)*.11],[Math.sin(a)*.13,-.41,Math.cos(a)*.13],.013,surface(C.brass,'metal'));}ring(lantern,C.brass,[0,-.4,0],.14);ring(lantern,C.brass,[0,-.09,0],.12);
  }
  // Bake each rigid joint separately. This retains articulation and reduces
  // the hundreds of clothing/hair details to a small set of material draws.
  for(const group of [torso,head,...Object.values(joints)]){
    const pos=group.position.clone(),rot=group.rotation.clone();group.position.set(0,0,0);group.rotation.set(0,0,0);rig.updateMatrixWorld(true);
    const baked=bake(group);dispose(group);group.add(baked);group.position.copy(pos);group.rotation.copy(rot);
  }
  rig.scale.setScalar(c.id==='lituan'?.76:strong?1.12:1);
  root.userData={rig,joints,head,character:c,height:3.45*(c.id==='lituan'?.76:strong?1.12:1)};return root;
}
export function createActor(id){return build(characterFor(id)||CHARACTERS[0]);}
export function createEnemy(id='infantry'){
  const strong=/orc|wolf|cavalry|dragon/.test(id),element=/(_el|boss_elem)/.test(id);
  const c={...CHARACTERS[strong?3:1],id:strong?'xuanli':'enemy',skin:strong?'#71867a':'#b19883',color:'#a78c68'};
  const root=build(c,{enemy:true,id});root.name=id;
  if(id.startsWith('boss'))root.scale.setScalar(1.28);
  if(element){const col=id==='fire_el'?'#c4845d':id==='water_el'?'#72a6b8':'#97ad86';for(let i=0;i<6;i++){const a=i/6*Math.PI*2;piece(root,col,[Math.sin(a)*.65,2.1+(i%3)*.38,Math.cos(a)*.35],[.09,.24,.09],'icosa','glow');}}
  if(id==='dragon'){root.scale.setScalar(1.4);for(const s of [-1,1])ribbon(root,'#556b6d',[[s*.4,2.6,-.2],[s*1.1,3.7,-.5],[s*1.7,2.5,-.65]],[.04,.46,.001],.035);}
  return root;
}
export function animateActor(actor,time,{moving=false,hit=0,dead=false,attack=0,guard=false}={}){
  const {rig,joints,head}=actor.userData;if(!rig)return;
  const stride=moving?Math.sin(time*8)*.38:Math.sin(time*1.8)*.012;
  joints.legL.rotation.x=stride;joints.legR.rotation.x=-stride;
  joints.armL.rotation.x=-stride*.75-(guard?.45:.10);joints.armR.rotation.x=stride*.75-attack*.95-.18;
  joints.armR.rotation.z=joints.armR.userData.restZ-attack*.40;
  rig.position.y=moving?Math.abs(Math.sin(time*8))*.035:Math.sin(time*1.8)*.008;
  rig.rotation.z=dead?-.98:hit*Math.sin(time*39)*.045;head.rotation.y=Math.sin(time*.67)*.025;
}
