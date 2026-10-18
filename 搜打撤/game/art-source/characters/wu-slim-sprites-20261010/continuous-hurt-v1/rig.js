import {createAttackRenderer,SIZE as SOURCE_SIZE,REST,geometry} from '../continuous-attack-v7/rig.js';
export {geometry};
export const SIZE={...SOURCE_SIZE,fps:60,frames:43,durationMs:717};
const KEYS=[
 [0,0,0,0,0,0,0],
 [.08,16,-32,10,-.14,-16,6],
 [.14,16,-32,10,-.14,-16,6],
 [.28,14,-24,5,-.11,-12,5],
 [.50,6,-10,3,-.045,-5,2],
 [.76,-1,3,-3,.008,1,.7],
 [1,0,0,0,0,0,0],
];
const rad=Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t;
export function pose(phase){const t=Math.max(0,Math.min(1,phase));let i=0;while(i<KEYS.length-2&&t>KEYS[i+1][0])i++;const a=KEYS[i],b=KEYS[i+1];let u=(t-a[0])/(b[0]-a[0]);u=i===0?1-(1-u)**3:u*u*(3-2*u);const v=a.slice(1).map((n,j)=>lerp(n,b[j+1],u));return {phase:t,upper:v[0]*rad,lower:v[1]*rad,wrist:v[2]*rad,lean:v[3],lunge:v[4],squat:v[5]};}
const FRAGMENT=`precision highp float;varying vec2 uv;uniform sampler2D image;uniform vec3 body;uniform float lag;
float bump(float v,float c,float r){float t=abs(v-c)/r;return t>=1.?0.:pow(1.-t*t,2.);}
vec2 move(vec2 p){float weight=1.-smoothstep(305.,485.,p.y);vec2 v=p-vec2(290.,280.);float c=cos(body.x),s=sin(body.x);vec2 d=(vec2(v.x*c-v.y*s,v.x*s+v.y*c)-v+body.yz)*weight;
 d.x+=lag*bump(p.x,135.,105.)*bump(p.y,267.,122.);
 float free=bump(p.x,415.,50.)*bump(p.y,280.,75.);d.x+=body.y*.55*free;d.y-=body.z*free;
 float knee=bump(p.y,394.,76.);d.x+=(-body.z*.55*bump(p.x,220.,53.)+body.y*.18*bump(p.x,345.,62.))*knee;d.y+=body.z*.2*knee;if(p.y>485.)d=vec2(0.);return d;}
void main(){vec2 p=vec2(uv.x,1.-uv.y)*vec2(576.,560.);vec2 q=p;for(int i=0;i<6;i++)q=p-move(q);gl_FragColor=texture2D(image,vec2(q.x/576.,1.-q.y/560.));}`;
function bodyRenderer(source){const c=document.createElement('canvas');c.width=576;c.height=560;const gl=c.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});if(!gl)throw new Error('未提供WebGL');const compile=(kind,code)=>{const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 position;varying vec2 uv;void main(){gl_Position=vec4(position,0.,1.);uv=(position+1.)*.5;}'));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);for(const n of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,n,gl.LINEAR);for(const n of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,n,gl.CLAMP_TO_EDGE);const body=gl.getUniformLocation(program,'body'),lag=gl.getUniformLocation(program,'lag');gl.viewport(0,0,576,560);return {canvas:c,render(p){gl.uniform3f(body,p.lean,p.lunge,p.squat);gl.uniform1f(lag,14*Math.sin(Math.min(1,p.phase/.55)*Math.PI)*Math.exp(-p.phase*2));gl.drawArrays(gl.TRIANGLES,0,6);}};}
export function createHurtRenderer(output,image,repair,neutral){
 output.width=SIZE.width;output.height=SIZE.height;const referenceCanvas=document.createElement('canvas'),reference=createAttackRenderer(referenceCanvas,image,repair,neutral),parts=reference.parts,body=bodyRenderer(parts.body),ctx=output.getContext('2d');
 function parent(p){ctx.translate(REST.hip[0]+p.lunge,REST.hip[1]+p.squat);ctx.rotate(p.lean);ctx.translate(-REST.hip[0],-REST.hip[1]);}
 function paint(texture,p,lower=false,hand=false){ctx.save();parent(p);ctx.translate(...REST.shoulder);ctx.rotate(p.upper);ctx.translate(-REST.shoulder[0],-REST.shoulder[1]);if(lower){ctx.translate(...REST.elbow);ctx.rotate(p.lower);ctx.translate(-REST.elbow[0],-REST.elbow[1]);}if(hand){ctx.translate(...REST.wrist);ctx.rotate(p.wrist);ctx.translate(-REST.wrist[0],-REST.wrist[1]);}ctx.drawImage(texture,0,0);ctx.restore();}
 const render=(phase,debug=false,smear=true,guide=false)=>{
  const p=pose(phase);ctx.clearRect(0,0,SIZE.width,SIZE.height);if(phase<=0||phase>=1){ctx.drawImage(reference.rest,0,0);return p;}ctx.save();ctx.translate(SIZE.padX,SIZE.padY);
  if(smear&&phase>0&&phase<.20){for(let i=3;i>=1;i--){const previous=pose(Math.max(0,phase-i*.018));ctx.save();ctx.globalAlpha=.035+(3-i)*.025;ctx.filter='blur(2px)';body.render(previous);ctx.drawImage(body.canvas,0,0);paint(parts.lower,previous,true);paint(parts.weapon,previous,true,true);ctx.restore();}}
  body.render(p);ctx.drawImage(body.canvas,0,0);ctx.clearRect(-SIZE.padX,490,SIZE.width,SIZE.height-490-SIZE.padY);ctx.drawImage(neutral,0,490,576,70,0,490,576,70);
  paint(parts.upper,p);ctx.save();parent(p);ctx.drawImage(parts.shoulderCover,0,0);ctx.restore();paint(parts.lower,p,true);paint(parts.weapon,p,true,true);paint(parts.hand,p,true,true);
  if(debug||guide){const g=geometry(p);ctx.save();ctx.strokeStyle='#f4df9c';ctx.lineWidth=1;ctx.beginPath();if(guide){ctx.moveTo(...g.bladeGuard);ctx.lineTo(...g.bladeTip);}else{ctx.moveTo(...g.shoulder);ctx.lineTo(...g.elbow);ctx.lineTo(...g.wrist);}ctx.stroke();ctx.restore();}
  ctx.restore();return p;
 };
 render.idle=(phase,guide=false)=>{reference.idle(phase,guide);ctx.clearRect(0,0,SIZE.width,SIZE.height);ctx.drawImage(referenceCanvas,0,0);};render.parts=parts;render.rest=reference.rest;return render;
}
