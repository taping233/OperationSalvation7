export const SETTINGS = {width:576,height:560,frames:72,fps:24,durationMs:3000};

// One continuous displacement field, evaluated on the same painted texture.
// Compact weights stop at their region boundary; the waist and feet are fixed.
export const FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uImage;
uniform float uPhase;
uniform float uStrength;
const float PI=3.141592653589793;
float bump(float value,float center,float radius){
 float t=abs(value-center)/radius;
 return t>=1.0?0.0:pow(1.0-t*t,2.0);
}
vec2 movement(vec2 p){
 float t=uPhase*2.0*PI;
 float inhale=(1.0-cos(t))*0.5;
 float hand=sin(t);
 float lag=sin(t-0.30)+sin(0.30);
 vec2 d=vec2(0.0);
 // Chest movement fades to zero before both face and waist.
 float chest=bump(p.x,296.0,67.0)*bump(p.y,181.0,43.0);
 d.y-=1.65*inhale*chest;
 // Continuous sleeve/hand motion with zero weight at the shoulder.
 float rightHand=bump(p.x,222.0,55.0)*bump(p.y,274.0,90.0);
 d+=vec2(0.65*hand,-0.65*inhale)*rightHand;
 float leftHand=bump(p.x,401.0,49.0)*bump(p.y,274.0,63.0);
 d+=vec2(1.15*hand,-0.75*inhale)*leftHand;
 // Sword is nearly rigid: tiny angular motion about the hand/grip.
 vec2 grip=vec2(224.0,284.0);
 vec2 axis=normalize(vec2(286.0,183.0));
 vec2 rel=p-grip;
 float along=dot(rel,axis);
 float across=abs(dot(rel,vec2(-axis.y,axis.x)));
 float blade=1.0-smoothstep(5.0,11.0,across);
 blade*=smoothstep(-53.0,-32.0,along)*(1.0-smoothstep(345.0,354.0,along));
 float angle=0.00175*hand;
 d+=blade*(vec2(-rel.y,rel.x)*angle+vec2(0.55*hand,-0.45*inhale));
 // Hair tips follow the hands by a small phase delay; root/head stay fixed.
 float hair=bump(p.x,135.0,97.0)*bump(p.y,271.0,103.0);
 d.x+=0.55*lag*hair;
 // Never deform the head/face, waist or planted feet.
 if(p.y<138.0||p.y>485.0)d=vec2(0.0);
 if(p.x>262.0&&p.x<316.0&&p.y>216.0&&p.y<241.0)d=vec2(0.0);
 return d*uStrength;
}
void main(){
 vec2 p=vec2(vUv.x,1.0-vUv.y)*vec2(576.0,560.0);
 // Two inverse-field iterations keep small local movements coherent.
 vec2 q=p-movement(p);
 q=p-movement(q);
 gl_FragColor=texture2D(uImage,vec2(q.x/576.0,1.0-q.y/560.0));
}`;

export function createRenderer(canvas,image){
 const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,preserveDrawingBuffer:true,antialias:false});
 if(!gl)throw new Error('当前内置浏览器未提供WebGL，无法绘制连续待机');
 const compile=(kind,source)=>{
  const shader=gl.createShader(kind);gl.shaderSource(shader,source);gl.compileShader(shader);
  if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
  return shader;
 };
 const program=gl.createProgram();
 gl.attachShader(program,compile(gl.VERTEX_SHADER,'attribute vec2 aPosition; varying vec2 vUv; void main(){gl_Position=vec4(aPosition,0.,1.);vUv=(aPosition+1.)*.5;}'));
 gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
 gl.useProgram(program);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
 const position=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
 const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 const phase=gl.getUniformLocation(program,'uPhase');
 const strength=gl.getUniformLocation(program,'uStrength');
 gl.viewport(0,0,canvas.width,canvas.height);
 return function render(value,gain=2){gl.uniform1f(phase,value);gl.uniform1f(strength,gain);gl.drawArrays(gl.TRIANGLES,0,6);};
}
