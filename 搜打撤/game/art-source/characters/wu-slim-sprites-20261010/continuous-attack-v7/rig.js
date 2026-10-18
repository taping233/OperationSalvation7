import {createRenderer as createIdleBody} from '../continuous-idle/motion.js';
export const SIZE={width:832,height:832,padX:40,padY:216,fps:60,frames:73,durationMs:1217};
export const REST={hip:[290,280],shoulder:[251,163],elbow:[224,232],wrist:[218,289]};
export const WEAPON=[[165,266],[172,258],[183,266],[221,290],[229,296],[238,291],[249,294],[247,302],[504,473],[512,478],[504,482],[240,310],[245,320],[237,315],[228,331],[223,329],[231,306],[210,290],[170,272]];
export const BLADE_ANCHORS={guard:[240,301],tip:[507,478]};
const BLADE=[[244,299],[252,302],[508,473],[512,478],[506,483],[239,310]];
const UPPER=[[236,150],[264,151],[267,174],[264,185],[246,207],[251,220],[242,248],[220,250],[202,247],[188,232],[196,220],[206,197],[225,179],[230,161]];
const LOWER=[[190,230],[223,219],[243,220],[260,244],[256,268],[239,276],[235,292],[232,305],[212,307],[207,297],[208,281],[198,272],[190,260],[183,247]];
const SLEEVE=[[183,230],[223,219],[246,220],[260,246],[260,278],[255,304],[243,325],[211,327],[192,310],[182,286],[178,249]];
const HAND=[[208,276],[219,273],[229,279],[234,290],[232,305],[218,306],[207,296],[206,284]];
const KEYS=[
 // phase, upper/lower/wrist degrees, torso radians, hip travel, crouch.
 [0,0,0,0,0,0,0], [4/30,25,-85,-4,-.025,-3,3],
 [7/30,65,-155,-8,-.04,-7,6], [.30,69,-158,-6,-.044,-8,6.5],
 // The elbow is lifted away from the torso. Release the forearm first,
 // then extend the shoulder and elbow together toward the target.
 [10/30,65,-118,-6,-.015,-3,5], [.355,30,-93,10,.005,2,5],
 [.385,-20,-48,18,.05,10,5], [.42,-65,15,26,.09,17,5],
 // Hold the impact pose for two frames; follow-through and recovery are slower.
 [.445,-65,15,26,.09,17,5], [.60,-55,38,-2,.06,12,3],
 [.80,-12,18,-12,.01,2,1], [1,0,0,0,0,0,0],
];
const rad=Math.PI/180;
const lerp=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
const TIMING=[[0,0],[.32,.30],[.37,1/3],[.45,.42],[.47,.445],[.68,.60],[.90,.85],[1,1]];
export function actionProgress(clock){const t=Math.max(0,Math.min(1,clock));let i=0;while(i<TIMING.length-2&&t>TIMING[i+1][0])i++;const a=TIMING[i],b=TIMING[i+1];return lerp(a[1],b[1],(t-a[0])/(b[0]-a[0]));}
function turn(point,pivot,angle){const x=point[0]-pivot[0],y=point[1]-pivot[1],c=Math.cos(angle),s=Math.sin(angle);return [pivot[0]+x*c-y*s,pivot[1]+x*s+y*c];}
export function pose(phase){
 const t=actionProgress(phase);let i=0;
 while(i<KEYS.length-2&&t>KEYS[i+1][0])i++;
 const a=KEYS[i],b=KEYS[i+1],u=(t-a[0])/(b[0]-a[0]),q=t>=10/30&&t<=.42?u:ease(u);
 const v=a.slice(1).map((n,j)=>lerp(n,b[j+1],q));
 return {phase:t,upper:v[0]*rad,lower:v[1]*rad,wrist:v[2]*rad,lean:v[3],lunge:v[4],squat:v[5]};
}
export function world(point,p){const q=turn(point,REST.hip,p.lean);return [q[0]+p.lunge,q[1]+p.squat];}
export function upperPoint(point,p){return world(turn(point,REST.shoulder,p.upper),p);}
export function lowerPoint(point,p){return world(turn(turn(point,REST.elbow,p.lower),REST.shoulder,p.upper),p);}
export function handPoint(point,p){return lowerPoint(turn(point,REST.wrist,p.wrist),p);}
export function geometry(p){return {shoulder:world(REST.shoulder,p),elbow:upperPoint(REST.elbow,p),wrist:lowerPoint(REST.wrist,p),weapon:WEAPON.map(point=>handPoint(point,p)),bladeGuard:handPoint(BLADE_ANCHORS.guard,p),bladeTip:handPoint(BLADE_ANCHORS.tip,p)};}
function canvas(){const c=document.createElement('canvas');c.width=576;c.height=560;return c;}
function path(points){const p=new Path2D();points.forEach((v,i)=>i?p.lineTo(...v):p.moveTo(...v));p.closePath();return p;}
function clip(image,points){const c=canvas(),ctx=c.getContext('2d');ctx.save();ctx.clip(path(points));ctx.drawImage(image,0,0);ctx.restore();return c;}
function stripAttachedHair(part,original,replacement){
 const n=576*560,a=part.data,o=original.data,r=replacement.data,candidate=new Uint8Array(n),seen=new Uint8Array(n),queue=[];
 for(let p=0;p<n;p++){
  const i=p*4;if(!a[i+3])continue;
  const lo=Math.min(o[i],o[i+1],o[i+2]),hi=Math.max(o[i],o[i+1],o[i+2]);
  candidate[p]=lo>118&&hi-lo<38&&o[i]-o[i+2]<11?1:0;
  const match=r[i+3]>96&&Math.min(r[i],r[i+1],r[i+2])>145&&r[i]-r[i+2]<11&&Math.max(Math.abs(o[i]-r[i]),Math.abs(o[i+1]-r[i+1]),Math.abs(o[i+2]-r[i+2]))<55;
  const x=p%576,y=Math.floor(p/576);
  const boundary=x===0||y===0||x===575||y===559||a[i-4+3]<32||a[i+4+3]<32||a[i-576*4+3]<32||a[i+576*4+3]<32;
  if(candidate[p]&&lo>150&&match&&boundary){queue.push(p);seen[p]=1;}
 }
 for(let k=0;k<queue.length;k++){
  const p=queue[k];a[p*4+3]=0;
  for(const q of [p-1,p+1,p-576,p+576]){
   if(q>=0&&q<n&&!seen[q]&&candidate[q]){seen[q]=1;queue.push(q);}
  }
 }
}
function layers(image,repair){
 const source=canvas(),ctx=source.getContext('2d');ctx.drawImage(image,0,0);
 const original=ctx.getImageData(0,0,576,560);
 const upper=clip(source,UPPER),lower=clip(source,SLEEVE),hand=clip(source,HAND),weapon=clip(source,WEAPON);
 const shoulderCover=clip(source,[[232,150],[264,150],[271,170],[266,183],[244,185],[231,171]]);
 const uc=upper.getContext('2d'),lc=lower.getContext('2d'),hc=hand.getContext('2d'),wc=weapon.getContext('2d');
 const u=uc.getImageData(0,0,576,560),l=lc.getImageData(0,0,576,560),h=hc.getImageData(0,0,576,560),w=wc.getImageData(0,0,576,560);
 const removal=canvas(),rc=removal.getContext('2d');rc.fillStyle='white';rc.fill(path(WEAPON));rc.strokeStyle='white';rc.lineWidth=8;rc.stroke(path(WEAPON));
 // The old grip/guard extends below the original blade polygon into the thigh.
 // Restore this whole occluded region from the existing clean repair.
 rc.fill(path([[217,312],[250,312],[266,331],[243,356],[216,344]]));
 const wm=rc.getImageData(0,0,576,560);
 const patched=canvas(),pc=patched.getContext('2d');
 // Align only the occluded repair pixels; retain the selected portrait elsewhere.
 pc.setTransform(.45,0,0,.458,6,1);pc.drawImage(repair,0,0);pc.setTransform(1,0,0,1,0,0);
 const replacement=pc.getImageData(0,0,576,560),body=ctx.getImageData(0,0,576,560);
 stripAttachedHair(u,original,replacement);stripAttachedHair(l,original,replacement);stripAttachedHair(w,original,replacement);
 for(let i=0;i<original.data.length;i+=4){
  const r=original.data[i],g=original.data[i+1],b=original.data[i+2],x=(i/4)%576,y=Math.floor(i/4/576);
  const metal=Math.max(r,g,b)-Math.min(r,g,b)<17&&r-b<11;
  if(!metal)w.data[i+3]=0;
  // Exclude pale back-hair at the outer sleeve boundary.
  const hair=(x<237&&y<180&&r+g+b>410&&r-b<8)||(x<198&&r+g+b>450&&Math.abs(r-b)<9);
  if(hair){u.data[i+3]=0;l.data[i+3]=0;}
  if(b-r>30&&b-g>15){u.data[i+3]=0;l.data[i+3]=0;h.data[i+3]=0;w.data[i+3]=0;}
  const skin=r>130&&r-b>10&&r-g>2;
  const cuff=y<283&&Math.max(r,g,b)<125&&original.data[i+3]>128;
  if(!skin&&!cuff)h.data[i+3]=0;
  if(w.data[i+3]>0){u.data[i+3]=0;l.data[i+3]=0;h.data[i+3]=0;}
  if(h.data[i+3]>0)l.data[i+3]=0;
  const removed=Math.max(u.data[i+3],l.data[i+3],h.data[i+3],wm.data[i+3]);
  if(removed>0){
   const ratio=original.data[i+3]?Math.min(1,removed/original.data[i+3]):0;
   for(let k=0;k<4;k++)body.data[i+k]=Math.round(lerp(original.data[i+k],replacement.data[i+k],ratio));
  }
 }
 uc.putImageData(u,0,0);lc.putImageData(l,0,0);hc.putImageData(h,0,0);wc.putImageData(w,0,0);
 // Keep every blade pixel instead of filtering out its warmer edge/shading.
 wc.save();wc.clip(path(BLADE));wc.drawImage(image,0,0);wc.restore();
 ctx.putImageData(body,0,0);
 return {body:source,upper,lower,hand,weapon,shoulderCover};
}
const BODY_SHADER=`
precision highp float;varying vec2 uv;uniform sampler2D image;uniform vec3 body;uniform float trail;
float bump(float v,float c,float r){float t=abs(v-c)/r;return t>=1.?0.:pow(1.-t*t,2.);}
vec2 move(vec2 p){
 float weight=1.-smoothstep(305.,485.,p.y);
 vec2 v=p-vec2(290.,280.);float c=cos(body.x),s=sin(body.x);
 vec2 d=(vec2(v.x*c-v.y*s,v.x*s+v.y*c)-v+body.yz)*weight;
 // Back hair and the free hand lag behind the thrust. The knees move under
 // the hips while the boot/sole region is planted on the accepted baseline.
 d.x-=trail*bump(p.x,135.,105.)*bump(p.y,267.,122.);
 d.x-=body.y*bump(p.x,415.,35.)*bump(p.y,280.,65.)*.55;
 float knee=bump(p.y,394.,76.);
 d.x+=(-body.z*.65*bump(p.x,220.,53.)+body.y*.40*bump(p.x,345.,62.))*knee;
 d.y+=body.z*.22*knee;
 if(p.y>485.)d=vec2(0.);return d;
}
void main(){vec2 p=vec2(uv.x,1.-uv.y)*vec2(576.,560.);vec2 q=p;for(int i=0;i<6;i++)q=p-move(q);gl_FragColor=texture2D(image,vec2(q.x/576.,1.-q.y/560.));}`;
function bodyRenderer(source){
 const out=canvas(),gl=out.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});
 if(!gl)throw new Error('当前内置浏览器未提供WebGL');
 const compile=(kind,code)=>{const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 position; varying vec2 uv;void main(){gl_Position=vec4(position,0.,1.);uv=(position+1.)*.5;}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,BODY_SHADER));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const a=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
 gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
 for(const name of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,name,gl.LINEAR);
 for(const name of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,name,gl.CLAMP_TO_EDGE);
 const body=gl.getUniformLocation(program,'body'),trail=gl.getUniformLocation(program,'trail');gl.viewport(0,0,576,560);
 return {canvas:out,render(p){const t=p.phase>=.42&&p.phase<=.445?.42:p.phase;gl.uniform3f(body,p.lean,p.lunge,p.squat);gl.uniform1f(trail,8*Math.sin(t*Math.PI)*Math.sin(t*Math.PI));gl.drawArrays(gl.TRIANGLES,0,6);}};
}
export function createAttackRenderer(output,image,repair,neutral){
 output.width=SIZE.width;output.height=SIZE.height;
 const parts=layers(image,repair),body=bodyRenderer(parts.body),ctx=output.getContext('2d');
 const idleBody=canvas(),idleBodyRender=createIdleBody(idleBody,parts.body);
 function parent(p){ctx.translate(REST.hip[0]+p.lunge,REST.hip[1]+p.squat);ctx.rotate(p.lean);ctx.translate(-REST.hip[0],-REST.hip[1]);}
 function upper(p){ctx.translate(...REST.shoulder);ctx.rotate(p.upper);ctx.translate(-REST.shoulder[0],-REST.shoulder[1]);}
 function lower(p){ctx.translate(...REST.elbow);ctx.rotate(p.lower);ctx.translate(-REST.elbow[0],-REST.elbow[1]);}
 function wrist(p){ctx.translate(...REST.wrist);ctx.rotate(p.wrist);ctx.translate(-REST.wrist[0],-REST.wrist[1]);}
 function paintPart(texture,p,isLower,isHand=false){ctx.save();parent(p);upper(p);if(isLower)lower(p);if(isHand)wrist(p);ctx.drawImage(texture,0,0);ctx.restore();}
 function scene(p,phase,debug,smear,idlePhase=null,guide=false){
  ctx.clearRect(0,0,SIZE.width,SIZE.height);ctx.save();ctx.translate(SIZE.padX,SIZE.padY);
  if(idlePhase===null){body.render(p);ctx.drawImage(body.canvas,0,0);}
  else{idleBodyRender(idlePhase,2);ctx.drawImage(idleBody,0,0);}
  // Restore the planted sole band before drawing the moving arm and sword.
  // A final clear here used to cut off the blade during recovery.
  ctx.clearRect(-SIZE.padX,490,SIZE.width,SIZE.height-490-SIZE.padY);
  ctx.drawImage(neutral,0,490,576,70,0,490,576,70);
  // Texture echoes are confined to the fast swing. No blur covers the face.
  if(smear&&idlePhase===null&&p.phase>1/3&&p.phase<.445){
   for(let i=7;i>=1;i--){
    const previous=pose(Math.max(.37,phase-i*.0075));
    ctx.save();ctx.globalAlpha=.06+(7-i)*.027;ctx.filter=`blur(${1.5+i*.22}px) brightness(1.8)`;
    paintPart(parts.lower,previous,true);paintPart(parts.weapon,previous,true,true);paintPart(parts.hand,previous,true,true);ctx.restore();
   }
  }
  paintPart(parts.upper,p,false);
  // The shoulder ruffle belongs to the dress, so it covers the moving sleeve root.
  ctx.save();parent(p);ctx.drawImage(parts.shoulderCover,0,0);ctx.restore();
  paintPart(parts.lower,p,true);paintPart(parts.weapon,p,true,true);paintPart(parts.hand,p,true,true);
  if(guide){const g=geometry(p);ctx.save();ctx.strokeStyle='#f4df9c';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...g.bladeGuard);ctx.lineTo(...g.bladeTip);ctx.stroke();for(let i=0;i<=4;i++){const a=g.bladeGuard,b=g.bladeTip;ctx.beginPath();ctx.arc(lerp(a[0],b[0],i/4),lerp(a[1],b[1],i/4),2.5,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  if(debug){const g=geometry(p);ctx.save();ctx.strokeStyle='#72eab4';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...g.shoulder);ctx.lineTo(...g.elbow);ctx.lineTo(...g.wrist);ctx.stroke();for(const q of [g.shoulder,g.elbow,g.wrist]){ctx.beginPath();ctx.arc(...q,4,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  ctx.restore();return p;
 }
 const render=(phase,debug=false,smear=true,guide=false)=>scene(pose(phase),phase,debug,smear,null,guide);
 render.idle=(phase,guide=false)=>{const p=pose(0),s=Math.sin(phase*Math.PI*2);p.upper=.003*s;p.lower=-.004*s;p.wrist=.001*s;return scene(p,0,false,false,phase,guide);};
 const restCanvas=document.createElement('canvas');restCanvas.width=SIZE.width;restCanvas.height=SIZE.height;render(0);restCanvas.getContext('2d').drawImage(output,0,0);
 render.rest=restCanvas;
 render.parts=parts;
 return render;
}
