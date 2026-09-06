import {T,C,hash,piece,mesh,beam,ring,archGeometry,surface,profile} from './atelier.js';

export function windowBay(parent,x,y,z,w=.34,h=.68){
  mesh(parent,archGeometry(w,h,.045,0),surface(C.light,'glow'),[x,y,z]);
  mesh(parent,archGeometry(w+.10,h+.08,.085,.06),surface(C.edge,'stone'),[x,y-.02,z+.01]);
  piece(parent,C.dark,[x,y+h*.45,z+.05],[.032,h*.84,.04]);
  piece(parent,C.dark,[x,y+h*.52,z+.06],[w,.028,.04]);
  piece(parent,C.snow,[x,y-.05,z+.06],[w+.21,.065,.18],'box','snow');
}
export function spire(parent,x,y,z,r=.25,h=1.0){
  profile(parent,C.roof,[[y,r,r],[y+.08,r*1.06,r*1.06],[y+h*.65,r*.24,r*.24],[y+h,.005,.005]],{finish:'roof'}).position.set(x,0,z);
  piece(parent,C.brass,[x,y+h+.09,z],[.024,.20,.024],'cylinder','metal');
}
export function gable(parent,w,h,d,y){
  const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(0,h);s.lineTo(w/2,0);s.closePath();
  const g=new T.ExtrudeGeometry(s,{depth:d,bevelEnabled:false});g.translate(0,y,-d/2);mesh(parent,g,surface(C.roof,'roof'));
  for(const side of [-1,1]){
    const angle=Math.atan2(h,w/2),slant=Math.hypot(w/2,h);
    const snow=piece(parent,C.snow,[side*w/4,y+h/2+.025,0],[slant,.075,d+.05],'box','snow');snow.rotation.z=-side*angle;
  }
  piece(parent,C.dark,[0,y+h+.03,0],[.07,.06,d+.10],'box','metal');
}
export function townhouse(parent,{x=0,z=0,w=1.6,d=1.05,h=1.8,rotation=0,seed=1,tower=false}={}){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;parent.add(g);
  piece(g,C.dark,[0,.13,0],[w+.18,.26,d+.16],'box','stone');
  piece(g,seed%3===0?'#78898e':C.stone,[0,h/2+.23,0],[w,h,d],'box','stone');
  for(const y of [.32,h*.52+.24,h+.22])piece(g,C.edge,[0,y,0],[w+.10,.09,d+.10],'box','stone');
  for(const side of [-1,1])for(const zz of [-1,1]){
    piece(g,C.edge,[side*(w/2-.06),h/2+.23,zz*(d/2+.018)],[.10,h,.11],'box','stone');
    for(let y=.38;y<h;y+=.28)piece(g,C.stone,[side*(w/2-.07),y,zz*(d/2+.06)],[.14,.12,.13],'box','stone');
  }
  const cols=Math.max(2,Math.round(w/.57)),floors=Math.max(1,Math.round(h/.95));
  for(const side of [-1,1]){
    const facade=new T.Group();facade.rotation.y=side<0?Math.PI:0;g.add(facade);
    for(let row=0;row<floors;row++)for(let i=0;i<cols;i++)windowBay(facade,(i-(cols-1)/2)*w/cols,.39+row*(h/floors),d/2+.015,.28,Math.min(.63,h/floors*.73));
  }
  gable(g,w+.23,.54+hash(seed)*.3,d+.18,h+.25);
  for(const side of [-1,1]){
    const dormer=new T.Group();dormer.position.set(side*w*.27,h+.28,d*.40);g.add(dormer);
    piece(dormer,C.stone,[0,.19,0],[.38,.39,.3],'box','stone');windowBay(dormer,0,.04,.17,.22,.33);gable(dormer,.50,.25,.38,.37);
  }
  piece(g,C.stone,[-w*.27,h+.87,-d*.2],[.20,.71,.22],'box','stone');piece(g,C.snow,[-w*.27,h+1.24,-d*.2],[.26,.07,.28],'box','snow');
  for(let i=0;i<5;i++)piece(g,C.snow,[-w*.43+i*w*.19,h+.16,d*.58],[.025,.13+hash(seed+i)*.13,.025],'cone','snow');
  if(tower){
    const tx=w*.42,tz=-d*.27,th=h+1.0;piece(g,C.dark,[tx,th/2,tz],[.32,th,.32],'cylinder','stone');
    for(let i=0;i<4;i++){const a=i*Math.PI/2;piece(g,C.edge,[tx+Math.sin(a)*.3,th*.65,tz+Math.cos(a)*.3],[.085,th*.75,.085],'box','stone');}
    ring(g,C.edge,[tx,th,tz],.33);spire(g,tx,th,tz,.41,1.15);
  }
  return g;
}
export function arcade(parent,{x=0,z=0,length=5,height=1.7,rotation=0}={}){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;parent.add(g);const count=Math.round(length/.92);
  for(let i=0;i<count;i++){
    const px=(i-(count-1)/2)*.92;
    mesh(g,archGeometry(.83,height,.36,.13),surface(C.stone,'stone'),[px,.1,0]);
    piece(g,C.edge,[px-.45,height*.43,0],[.15,height,.44],'box','stone');
    piece(g,C.snow,[px,height+.13,0],[.98,.09,.47],'box','snow');
    if(i%2===0)spire(g,px-.45,height+.2,0,.13,.49);
  }
  piece(g,C.edge,[0,height+.035,0],[count*.92+.1,.19,.5],'box','stone');return g;
}
export function lamp(parent,x,z,y=0,scale=1){
  const g=new T.Group();g.position.set(x,y,z);g.scale.setScalar(scale);parent.add(g);
  piece(g,C.dark,[0,.08,0],[.16,.16,.16],'cylinder','metal');piece(g,C.dark,[0,.65,0],[.027,1.1,.027],'cylinder','metal');
  piece(g,C.brass,[0,1.14,0],[.13,.07,.13],'box','metal');piece(g,C.light,[0,1.3,0],[.105,.22,.105],'box','glow');
  for(const a of [-1,1])for(const b of [-1,1])piece(g,C.dark,[a*.065,1.29,b*.065],[.016,.26,.016],'box','metal');
  piece(g,C.dark,[0,1.47,0],[.18,.13,.18],'cone','metal');piece(g,C.snow,[0,1.5,0],[.14,.09,.14],'cone','snow');return g;
}
export function pine(parent,x,z,h=2,seed=1){
  const g=new T.Group();g.position.set(x,0,z);parent.add(g);piece(g,C.wood,[0,h*.35,0],[.055,h*.7,.055],'cylinder');
  for(let j=0;j<5;j++){
    const y=h*(.22+j*.15),r=h*(.25-j*.038);
    for(let k=0;k<7;k++){const a=k/7*Math.PI*2+j*.72+seed,p=piece(g,j%2?'#385c5b':'#2c4a4f',[Math.sin(a)*r*.40,y,Math.cos(a)*r*.40],[r*.52,h*.17,r*.72],'icosa');p.rotation.y=a;
      const snow=piece(g,C.snow,[Math.sin(a)*r*.47,y+h*.09,Math.cos(a)*r*.47],[r*.40,h*.055,r*.52],'icosa','snow');snow.rotation.y=a;
    }
  }return g;
}
export function observatory(parent,x,z,scale=1){
  const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  for(let i=0;i<3;i++)piece(g,i===2?C.edge:C.stone,[0,.08+i*.10,0],[1.45-i*.10,.10,1.45-i*.10],'cylinder','stone');
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2,col=new T.Group();col.rotation.y=a;g.add(col);
    mesh(col,archGeometry(.49,1.28,.14,.10),surface(C.stone,'stone'),[0,.35,1.08]);
    piece(col,C.edge,[.26,.95,1.08],[.13,1.3,.22],'box','stone');
    piece(col,C.light,[0,1.4,1.065],[.20,.17,.03],'box','glow');
  }
  piece(g,C.stone,[0,1.71,0],[1.19,.21,1.19],'cylinder','stone');ring(g,C.brass,[0,1.8,0],1.21);
  profile(g,C.copper,[[1.82,1.16,1.16],[2.00,1.14,1.14],[2.28,1.02,1.02],[2.54,.78,.78],[2.75,.40,.40],[2.84,.02,.02]],{segments:48,finish:'metal'});
  for(let i=0;i<12;i++){
    const a=i/12*Math.PI*2;const points=[[1.82,1.17],[2.05,1.13],[2.3,1.01],[2.55,.77],[2.76,.40],[2.86,.025]];
    for(let j=0;j<points.length-1;j++){const [y,r]=points[j],[yy,rr]=points[j+1];beam(g,[Math.sin(a)*r,y,Math.cos(a)*r],[Math.sin(a)*rr,yy,Math.cos(a)*rr],.021,surface(C.brass,'metal'));}
  }
  ring(g,C.edge,[0,2.23,0],1.048);spire(g,0,2.85,0,.13,.52);ring(g,C.brass,[0,3.48,0],.21,[0,0,0]);
  // Accessible altar under an open colonnade, visually distinct from boss seals.
  piece(g,C.dark,[0,.52,0],[.50,.35,.50],'cylinder','metal');ring(g,C.light,[0,.73,0],.52);return g;
}
export function gate(parent,x,z,rotation=0,scale=1){
  const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;g.scale.setScalar(scale);parent.add(g);
  mesh(g,archGeometry(1.45,1.6,.36,.2),surface(C.stone,'stone'),[0,.10,0]);
  for(const side of [-1,1]){
    piece(g,C.dark,[side*.85,.88,0],[.36,1.75,.46],'box','stone');piece(g,C.snow,[side*.85,1.78,0],[.43,.08,.54],'box','snow');spire(g,side*.85,1.80,0,.25,.75);
    lamp(g,side*.99,.23,0,.64);
  }return g;
}
export function chest(parent,x,z,scale=1){
  const g=new T.Group();g.position.set(x,0,z);g.scale.setScalar(scale);parent.add(g);
  piece(g,C.wood,[0,.22,0],[.62,.36,.44],'box','stone');piece(g,C.dark,[0,.41,0],[.34,.11,.24],'cylinder','metal').rotation.z=Math.PI/2;
  for(const side of [-1,1])piece(g,C.brass,[side*.23,.28,.235],[.07,.40,.045],'box','metal');piece(g,C.brass,[0,.29,.25],[.1,.14,.04],'box','metal');return g;
}
