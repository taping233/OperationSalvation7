// Only revealed coordinates enter this fog mask. Distant silhouettes never encode hidden rooms.
const masks=new WeakMap();
function bake(nodes,density){
  const margin=540,x=Math.min(...nodes.map(n=>n.x))-margin,y=Math.min(...nodes.map(n=>n.y))-margin;
  const width=Math.max(...nodes.map(n=>n.x))-x+margin,height=Math.max(...nodes.map(n=>n.y))-y+margin;
  density=Math.min(density,2048/Math.max(width,height));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.ceil(width*density));canvas.height=Math.max(1,Math.ceil(height*density));
  const b=canvas.getContext('2d');if(!b)return null;
  b.scale(density,density);b.translate(-x,-y);
  b.fillStyle='rgba(3,10,18,.58)';b.fillRect(x,y,width,height);
  // Atmospheric strata, independent of actual hidden positions, roads and node identities.
  for(let i=0;i<5;i++){
    const px=x+260+(width-520)*(.12+i*.19),py=y+260+(height-520)*(.25+(i%3)*.23);
    const haze=b.createRadialGradient(px,py,0,px,py,260);
    haze.addColorStop(0,'rgba(92,125,142,.10)');haze.addColorStop(1,'rgba(28,47,61,0)');
    b.fillStyle=haze;b.fillRect(px-260,py-260,520,520);
  }
  b.globalCompositeOperation='destination-out';
  for(const node of nodes){
    const clear=b.createRadialGradient(node.x,node.y,70,node.x,node.y,205);
    clear.addColorStop(0,'rgba(0,0,0,1)');clear.addColorStop(.40,'rgba(0,0,0,.94)');clear.addColorStop(1,'rgba(0,0,0,0)');
    b.fillStyle=clear;b.fillRect(node.x-205,node.y-205,410,410);
  }
  return {canvas,x,y,width,height};
}

export function drawMapFrontierDepth(ctx,game,geometry){
  const nodes=geometry.nodes.filter(n=>n.li===game.layerIdx);
  const total=game.layerData[game.layerIdx]?.logical?.length||0;
  if(!nodes.length||nodes.length>=total)return;
  const density=Math.min(1,2**Math.ceil(Math.log2(Math.max(.08,game.cam.zoom))));
  let mask=masks.get(geometry);
  if(!mask||mask.density!==density){
    const paint=bake(nodes,density);if(!paint)return;
    mask={...paint,density};masks.set(geometry,mask);
  }
  const {cx,cy,viewW,viewH,zoom}=game.cam;
  const left=cx-viewW/(2*zoom),top=cy-viewH/(2*zoom),right=left+viewW/zoom,bottom=top+viewH/zoom;
  const x1=Math.max(left,Math.min(right,mask.x)),x2=Math.max(left,Math.min(right,mask.x+mask.width));
  const y1=Math.max(top,Math.min(bottom,mask.y)),y2=Math.max(top,Math.min(bottom,mask.y+mask.height));
  ctx.save();ctx.fillStyle='rgba(3,10,18,.58)';
  ctx.fillRect(left,top,right-left,y1-top);ctx.fillRect(left,y2,right-left,bottom-y2);
  ctx.fillRect(left,y1,x1-left,y2-y1);ctx.fillRect(x2,y1,right-x2,y2-y1);
  ctx.drawImage(mask.canvas,mask.x,mask.y,mask.width,mask.height);ctx.restore();
}
