import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Shared authored geometry and PBR surfaces. Geometry is built in world units,
// independently of the board's logical cells and combat target rules.
const geoCache=new Map(), matCache=new Map(), texCache=new Map();
export {T};
export const C={snow:'#dbe5e4',stone:'#697b83',edge:'#a8b5b4',dark:'#283d4a',roof:'#354c5b',copper:'#527d80',brass:'#bd9d66',glass:'#b6ccce',light:'#ffcb80',paving:'#81999f',wood:'#665a4d'};
export function hash(n){const a=Math.sin(n*127.1+311.7)*43758.5453;return a-Math.floor(a);}
function pattern(kind){
  if(texCache.has(kind))return texCache.get(kind);
  if(typeof document==='undefined')return null;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#b2b5b4';ctx.fillRect(0,0,256,256);
  if(kind==='stone'||kind==='paving'){
    const rows=kind==='stone'?8:12,h=256/rows;
    for(let y=0;y<rows;y++)for(let x=-1;x<6;x++){
      const v=Math.floor(157+hash(x+19*y)*57);ctx.fillStyle=`rgb(${v},${v+3},${v+4})`;
      ctx.fillRect(x*64+(y%2)*32+1,y*h+1,61,h-3);
      ctx.fillStyle='#c9cdcb';ctx.fillRect(x*64+(y%2)*32+2,y*h+1,60,1);
    }
  }else if(kind==='roof'){
    for(let y=0;y<16;y++)for(let x=-1;x<8;x++){
      const v=Math.floor(145+hash(x+23*y)*55);ctx.fillStyle=`rgb(${v},${v+3},${v+5})`;
      ctx.fillRect(x*40+(y%2)*20,y*16,38,14);
    }
  }
  for(let i=0;i<4200;i++){const v=Math.floor(70+hash(i+91)*140);ctx.fillStyle=`rgba(${v},${v},${v},.10)`;ctx.fillRect(hash(i)*256,hash(i+71)*256,1+hash(i+11)*2,1);}
  const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.anisotropy=4;texCache.set(kind,tex);return tex;
}
export function surface(color,kind='matte'){
  if(color?.isMaterial)return color;
  const key=color+'|'+kind;if(matCache.has(key))return matCache.get(key);
  const metal=kind==='metal'||kind==='brass';
  const m=new T.MeshStandardMaterial({color,roughness:metal?.38:kind==='snow'?.94:.78,metalness:metal?.66:kind==='glass'?.28:.04});
  if(['stone','paving','roof'].includes(kind))m.map=pattern(kind);
  if(kind==='glow'){m.emissive=new T.Color(color);m.emissiveIntensity=.65;m.roughness=.38;}
  if(kind==='cloth')m.side=T.DoubleSide;
  matCache.set(key,m);return m;
}
export function geometry(kind){
  if(!geoCache.has(kind)){
    let g;
    if(kind==='sphere')g=new T.SphereGeometry(1,20,14);
    else if(kind==='cylinder')g=new T.CylinderGeometry(1,1,1,20);
    else if(kind==='cone')g=new T.ConeGeometry(1,1,12);
    else if(kind==='torus')g=new T.TorusGeometry(1,.055,6,48);
    else if(kind==='icosa')g=new T.IcosahedronGeometry(1,1);
    else g=new T.BoxGeometry(1,1,1);
    g.userData.shared=true;geoCache.set(kind,g);
  }return geoCache.get(kind);
}
export function mesh(parent,g,mat,pos=[0,0,0],scale=[1,1,1]){
  const m=new T.Mesh(g,surface(mat));m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
export function piece(parent,color,pos,scale,kind='box',finish='matte'){return mesh(parent,geometry(kind),surface(color,finish),pos,scale);}
export function beam(parent,a,b,r,mat,kind='cylinder'){
  const av=new T.Vector3(...a),bv=new T.Vector3(...b),d=bv.clone().sub(av);
  const m=mesh(parent,geometry(kind),mat,av.add(bv).multiplyScalar(.5).toArray(),[r,d.length(),r]);
  m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return m;
}
export function ring(parent,color,pos,radius,rotation=[Math.PI/2,0,0],thickness=1){
  const m=mesh(parent,geometry('torus'),surface(color,'metal'),pos,[radius,radius,radius*thickness]);m.rotation.set(...rotation);return m;
}
// Continuous elliptical cross sections form fitted torsos, boots, helmets and
// tailored hems without visibly intersecting primitive cylinders.
export function profile(parent,color,rings,{segments=24,finish='matte',cap=true}={}){
  const p=[],uv=[],ix=[];
  rings.forEach(([y,rx,rz,cx=0,cz=0],j)=>{for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;p.push(cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz);uv.push(i/segments,j/(rings.length-1));}});
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;ix.push(a,a+1,b,a+1,b+1,b);}
  if(cap)for(const j of [0,rings.length-1]){const [y,,,cx=0,cz=0]=rings[j],k=p.length/3;p.push(cx,y,cz);uv.push(.5,.5);for(let i=0;i<segments;i++){const a=j*(segments+1)+i;ix.push(...(j===0?[k,a,a+1]:[k,a+1,a]));}}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return mesh(parent,g,surface(color,finish));
}
export function ribbon(parent,color,points,widths,depth=.025){
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));const p=[],uv=[],ix=[],steps=18,sides=6;
  for(let j=0;j<=steps;j++){
    const t=j/steps,center=curve.getPoint(t),tangent=curve.getTangent(t);const right=new T.Vector3(0,0,1).cross(tangent).normalize();
    if(right.lengthSq()<.1)right.set(0,0,1);const other=tangent.clone().cross(right).normalize();
    const f=t*(widths.length-1),k=Math.min(widths.length-2,Math.floor(f)),w=T.MathUtils.lerp(widths[k],widths[k+1],f-k);
    for(let i=0;i<=sides;i++){const a=i/sides*2*Math.PI,q=center.clone().addScaledVector(right,Math.cos(a)*w).addScaledVector(other,Math.sin(a)*depth);p.push(q.x,q.y,q.z);uv.push(i/sides,t);}
  }
  for(let j=0;j<steps;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+sides+1;ix.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(ix);g.computeVertexNormals();return mesh(parent,g,surface(color,'cloth'));
}
export function archGeometry(width,height,depth,frame=.12){
  const key=`arch:${width}:${height}:${depth}:${frame}`;if(geoCache.has(key))return geoCache.get(key);
  const s=new T.Shape(),r=width/2,spring=height-r;
  s.moveTo(-r,0);s.lineTo(-r,spring);s.absarc(0,spring,r,Math.PI,0,true);s.lineTo(r,0);s.closePath();
  if(frame>0){const hole=new T.Path(),ir=r-frame;hole.moveTo(-ir,0);hole.lineTo(ir,0);hole.lineTo(ir,spring);hole.absarc(0,spring,ir,0,Math.PI,false);hole.closePath();s.holes.push(hole);}
  const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:10});g.translate(0,0,-depth/2);g.userData.shared=true;geoCache.set(key,g);return g;
}
export function bake(root){
  root.updateMatrixWorld(true);const batches=new Map();
  root.traverse(o=>{if(!o.isMesh)return;let g=o.geometry.clone().applyMatrix4(o.matrixWorld);if(g.index){const ng=g.toNonIndexed();g.dispose();g=ng;}if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
    const key=o.material;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(g);});
  const result=new T.Group();for(const [mat,list] of batches){const g=mergeGeometries(list,false);const m=mesh(result,g,mat);m.userData.ownedGeometry=true;list.forEach(g=>g.dispose());}
  return result;
}
export function dispose(root){root?.traverse(o=>{if(o.isMesh&&!o.geometry.userData.shared)o.geometry.dispose();});root?.clear();}
export function lightScene(scene,{battle=false}={}){
  const sky='#9bafb9';scene.background=new T.Color(sky);scene.fog=new T.Fog(sky,battle?25:44,battle?65:95);
  scene.add(new T.HemisphereLight('#d9eafa','#47535b',1.7));
  const sun=new T.DirectionalLight('#ffdfb0',3.0);sun.position.set(battle?-12:-8,27,16);sun.target.position.set(battle?0:15,0,battle?0:15);scene.add(sun,sun.target);
  sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const r=battle?21:24;Object.assign(sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:1,far:90});sun.shadow.bias=-.0004;sun.shadow.normalBias=.025;sun.shadow.radius=3;
  const rim=new T.DirectionalLight('#aacbdf',1.1);rim.position.set(14,9,-15);scene.add(rim);return sun;
}
