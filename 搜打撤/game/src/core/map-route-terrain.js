// Revealed roads alone own these soft banks; generation and hit testing stay independent.
const paints = new WeakMap();
const palettes = [['#34424b','#72818a'],['#354654','#7b8d9b'],['#304b47','#6c8980'],['#42364d','#89758e']];
function edgeSeed(key){
  let seed=2166136261;
  for(const char of key)seed=Math.imul(seed^char.charCodeAt(0),16777619);
  return seed>>>0;
}
function sample(c,t) {
  const u=1-t;
  return {x:u*u*u*c.from.x+3*u*u*t*c.c1.x+3*u*t*t*c.c2.x+t*t*t*c.to.x,
    y:u*u*u*c.from.y+3*u*u*t*c.c1.y+3*u*t*t*c.c2.y+t*t*t*c.to.y};
}
function bake(road,scale,layer) {
  let seed=edgeSeed(road.edgeKey);
  const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
  const points=[],start=.24+random()*.12,span=.30+random()*.15;
  // Leave node artwork and names free; terrain follows the middle of the actual curve.
  for(let i=0;i<=12;i++){
    const t=start+i*span/12,p=sample(road.curve,t),q=sample(road.curve,t+.005);
    const length=Math.hypot(q.x-p.x,q.y-p.y)||1;
    points.push({...p,nx:-(q.y-p.y)/length,ny:(q.x-p.x)/length});
  }
  const pad=70*scale,xs=points.map(p=>p.x),ys=points.map(p=>p.y);
  const x=Math.min(...xs)-pad,y=Math.min(...ys)-pad;
  const width=Math.max(...xs)-x+pad,height=Math.max(...ys)-y+pad;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width/scale));canvas.height=Math.max(1,Math.ceil(height/scale));
  const b=canvas.getContext('2d');if(!b)return null;
  b.scale(1/scale,1/scale);b.translate(-x,-y);
  const [shadow,rim]=palettes[layer]||palettes[0];
  const sides=random()<.25?[-1,1]:[random()<.5?-1:1];
  for(const side of sides){
    const inner=[],outer=[];
    points.forEach((p,i)=>{
      const offset=(15+random()*5)*scale,spread=(17+random()*29)*scale*Math.sin(Math.PI*i/12);
      inner.push({x:p.x+p.nx*offset*side,y:p.y+p.ny*offset*side});
      outer.push({x:p.x+p.nx*(offset+spread)*side,y:p.y+p.ny*(offset+spread)*side});
    });
    // Broad irregular silhouettes, without masonry detail or a sharp contour.
    b.filter=`blur(${3.4*scale}px)`;b.globalAlpha=.45;b.fillStyle=shadow;
    b.beginPath();inner.concat([...outer].reverse()).forEach((p,i)=>i?b.lineTo(p.x,p.y):b.moveTo(p.x,p.y));
    b.closePath();b.fill();
    b.filter=`blur(${2.4*scale}px)`;b.strokeStyle=rim;b.globalAlpha=.20;b.lineWidth=4.5*scale;
    b.beginPath();inner.slice(2,10).forEach((p,i)=>i?b.lineTo(p.x,p.y):b.moveTo(p.x,p.y));b.stroke();
  }
  return {canvas,x,y,width,height,scale,layer};
}
export function drawMapRouteTerrain(ctx,road,scale,layer) {
  // Sparse banks retain open space; their placement is stable while the camera moves.
  if(edgeSeed(road.edgeKey)%3!==0)return;
  let paint=paints.get(road);
  if(!paint||paint.scale!==scale||paint.layer!==layer){
    paint=bake(road,scale,layer);if(!paint)return;paints.set(road,paint);
  }
  ctx.save();ctx.globalAlpha*=.72;
  ctx.drawImage(paint.canvas,paint.x,paint.y,paint.width,paint.height);ctx.restore();
}
